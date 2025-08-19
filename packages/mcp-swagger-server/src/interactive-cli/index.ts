// Dynamic imports for ES modules
import type { QuestionCollection, Answers } from 'inquirer';
type Inquirer = {
  prompt: <T extends Answers = Answers>(questions: QuestionCollection<T>) => Promise<T>;
};
type Ora = (text?: string) => {
  start(): any;
  stop(): any;
  succeed(text?: string): any;
  fail(text?: string): any;
};
type Boxen = (text: string, options?: any) => string;
type Chalk = typeof import('chalk');
type Table = typeof import('cli-table3');
import { SessionManager } from './managers/session-manager';
import { OpenAPIWizard } from './wizards/openapi-wizard';
import { UIManager } from './ui/ui-manager';
import { configManager, ConfigManager } from './utils/config-manager';
import { serverManager, ServerManager } from './utils/server-manager';
// Server and loadOpenAPIData imports removed - will be implemented later
import { OperationFilter } from './types';
import { SessionConfig } from './types';

export interface InteractiveCLIOptions {
  port?: number;
  transport?: 'stdio' | 'sse' | 'ws';
  configFile?: string;
  debug?: boolean;
}



export class InteractiveCLI {
  private sessionManager: SessionManager;
  private openApiWizard: OpenAPIWizard;
  private uiManager: UIManager;
  private configManager: ConfigManager;
  private serverManager: ServerManager;
  // private currentServer?: Server; // TODO: 实现 Server 类
  private currentServerId?: string;
  private isRunning: boolean = false;
  
  // Dynamic module imports
  private inquirer?: Inquirer;
  private ora?: Ora;
  private boxen?: Boxen;
  private chalk?: Chalk;
  private Table?: Table;
  private modulesInitialized: boolean = false;

  constructor(private options: InteractiveCLIOptions = {}) {
    this.sessionManager = new SessionManager();
    this.openApiWizard = new OpenAPIWizard();
    this.uiManager = new UIManager();
    this.configManager = configManager;
    this.serverManager = serverManager;
    
    // 设置服务器事件监听
    this.setupServerEventListeners();
  }
  
  /**
   * 初始化动态导入的模块
   */
  private async initModules(): Promise<void> {
    if (this.modulesInitialized) {
      return;
    }
    
    const { default: inquirer } = await import('inquirer');
    const { default: ora } = await import('ora');
    const { default: boxen } = await import('boxen');
    const { default: chalk } = await import('chalk');
    const { default: Table } = await import('cli-table3');
    
    this.inquirer = inquirer;
    this.ora = ora;
    this.boxen = boxen;
    this.chalk = chalk;
    this.Table = Table;
    this.modulesInitialized = true;
  }

  /**
   * 启动交互式 CLI
   */
  async start(): Promise<void> {
    await this.initModules();
    this.isRunning = true;
    
    this.uiManager.clear();
    
    if (await this.configManager.get('showWelcome')) {
      await this.showWelcome();
    }
    
    while (this.isRunning) {
      try {
        await this.showMainMenu();
      } catch (error) {
        await this.uiManager.showError('发生错误', error instanceof Error ? error : undefined);
        
        const { continueRunning } = await this.inquirer!.prompt([
          {
            type: 'confirm',
            name: 'continueRunning',
            message: '是否继续运行？',
            default: true
          }
        ]);
        
        if (!continueRunning) {
          this.isRunning = false;
        }
      }
    }
    
    // 停止所有运行中的服务器
    await this.serverManager.stopAllServers();
    
    await this.uiManager.showSuccess('👋 再见！');
  }

  /**
   * 显示欢迎信息
   */
  private async showWelcome(): Promise<void> {
    await this.initModules();
    const welcomeContent = `${this.chalk!.cyan.bold('🚀 MCP Swagger Server 交互式 CLI')}

${this.chalk!.gray('这个工具可以帮助您轻松配置和管理 OpenAPI 到 MCP 的转换服务')}

${this.chalk!.yellow('主要功能:')}
• 🆕 创建新的 OpenAPI 配置
• 📋 管理现有配置
• 🚀 快速启动服务器
• ⚙️  全局设置
• 📊 查看状态和统计信息`;

    await this.uiManager.showBox(welcomeContent, {
      title: '欢迎',
      borderColor: 'cyan',
      padding: 2
    });
  }

  /**
   * 设置服务器事件监听器
   */
  private setupServerEventListeners(): void {
    this.serverManager.on('serverStarted', async ({ serverId, config }) => {
      await this.uiManager.showSuccess(`服务器已启动: ${config.name} (${serverId})`);
      this.currentServerId = serverId;
    });

    this.serverManager.on('serverStopped', async ({ serverId, config }) => {
      await this.uiManager.showInfo(`服务器已停止: ${config?.name || serverId}`);
      if (this.currentServerId === serverId) {
        this.currentServerId = undefined;
      }
    });

    this.serverManager.on('serverCrashed', async ({ serverId, config, code, signal }) => {
      await this.uiManager.showError(`服务器崩溃: ${config?.name || serverId} (code: ${code}, signal: ${signal})`);
      if (this.currentServerId === serverId) {
        this.currentServerId = undefined;
      }
    });

    this.serverManager.on('serverError', async ({ serverId, config, error }) => {
      await this.uiManager.showError(`服务器错误: ${config?.name || serverId}`, error);
    });
  }

  /**
   * 显示主菜单
   */
  private async showMainMenu(): Promise<void> {
    await this.uiManager.showSeparator();
    
    // 显示当前状态
    const runningServers = this.serverManager.getRunningServers();
    if (runningServers.size > 0) {
      await this.uiManager.showInfo(`当前运行中的服务器: ${runningServers.size} 个`);
    }
    
    const sessions = await this.sessionManager.getAllSessions();
    const choices = [
      {
        name: '🆕 创建新的 OpenAPI 配置',
        value: 'create-new'
      },
      {
        name: '📋 管理现有配置',
        value: 'manage-sessions',
        disabled: sessions.length === 0 ? '(暂无配置)' : false
      },
      {
        name: '🚀 快速启动服务器',
        value: 'quick-start',
        disabled: sessions.length === 0 ? '(暂无配置)' : false
      },
      {
        name: '⚙️  全局设置',
        value: 'settings'
      },
      {
        name: '📊 查看状态',
        value: 'status'
      },
      {
        name: '❓ 帮助',
        value: 'help'
      },
      {
        name: '🚪 退出',
        value: 'exit'
      }
    ];

    const { action } = await this.inquirer!.prompt([
      {
        type: 'list',
        name: 'action',
        message: '请选择操作:',
        choices,
        pageSize: 10
      }
    ]);

    await this.handleAction(action);
  }

  /**
   * 处理用户选择的操作
   */
  private async handleAction(action: string): Promise<void> {
    switch (action) {
      case 'create-new':
        await this.createNewConfig();
        break;
      case 'manage-sessions':
        await this.manageConfigs();
        break;
      case 'quick-start':
        await this.quickStart();
        break;
      case 'settings':
        await this.showSettings();
        break;
      case 'status':
        await this.showStatus();
        break;
      case 'help':
        await this.uiManager.showHelp();
        await this.waitForKeyPress();
        break;
      case 'exit':
        await this.exit();
        break;
      default:
        await this.uiManager.showError('未知操作');
    }
  }

  /**
   * 创建新配置
   */
  private async createNewConfig(): Promise<void> {
    await this.uiManager.showBox('🆕 创建新配置', { title: '新建配置', borderColor: 'green' });
    
    try {
      const config = await this.openApiWizard.runWizard();
      
      if (config) {
        await this.sessionManager.saveSession(config);
        await this.configManager.addRecentConfig(config.id);
        await this.uiManager.showSuccess('配置已保存！');
        
        const { startNow } = await this.inquirer!.prompt([
          {
            type: 'confirm',
            name: 'startNow',
            message: '是否立即启动服务器？',
            default: true
          }
        ]);
        
        if (startNow) {
          await this.startServerWithConfig(config);
        }
      }
    } catch (error) {
      await this.uiManager.showError('创建配置失败', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 管理配置
   */
  private async manageConfigs(): Promise<void> {
    const sessions = await this.sessionManager.getAllSessions();
    
    if (sessions.length === 0) {
      await this.uiManager.showInfo('暂无保存的配置');
      return;
    }
    
    await this.uiManager.showSessionList(sessions);
    
    const choices = sessions.map(session => ({
      name: `${session.name} (${session.transport})`,
      value: session.id
    }));

    choices.push({ name: '🔙 返回主菜单', value: 'back' });

    const { sessionId } = await this.inquirer!.prompt([
      {
        type: 'list',
        name: 'sessionId',
        message: '选择要管理的配置:',
        choices,
        pageSize: 10
      }
    ]);

    if (sessionId === 'back') {
      return;
    }

    await this.manageSession(sessionId);
  }

  /**
   * 管理单个会话
   */
  private async manageSession(sessionId: string): Promise<void> {
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      await this.uiManager.showError('配置不存在');
      return;
    }

    await this.uiManager.showSessionDetails(session);

    const { action } = await this.inquirer!.prompt([
      {
        type: 'list',
        name: 'action',
        message: `管理配置: ${session.name}`,
        choices: [
          { name: '🚀 启动服务器', value: 'start' },
          { name: '✏️  编辑配置', value: 'edit' },
          { name: '📋 查看详情', value: 'view' },
          { name: '🗑️  删除配置', value: 'delete' },
          { name: '🔙 返回', value: 'back' }
        ]
      }
    ]);

    switch (action) {
      case 'start':
        await this.startServerWithConfig(session);
        break;
      case 'edit':
        await this.editSession(session);
        break;
      case 'view':
        await this.viewSession(session);
        break;
      case 'delete':
        await this.deleteSession(session);
        break;
      case 'back':
        break;
    }
  }

  /**
   * 使用配置启动服务器
   */
  private async startServerWithConfig(config: SessionConfig): Promise<void> {
    try {
      const result = await this.serverManager.startServer(config);
      if (result.success && result.serverId) {
        this.currentServerId = result.serverId;
      } else {
        throw new Error(result.error || '服务器启动失败');
      }
      
      // 更新最近使用时间
      await this.sessionManager.updateSession(config.id, {
        ...config,
        lastUsed: new Date().toISOString()
      });
      
      await this.uiManager.showSuccess(`服务器已启动: ${config.name}`);
      
      if (config.transport === 'sse' && config.port) {
        await this.uiManager.showInfo(`访问地址: http://localhost:${config.port}`);
      }
      
    } catch (error) {
      await this.uiManager.showError('服务器启动失败', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 启动服务器
   */
  private async startServer(config: SessionConfig): Promise<void> {
    if (this.isRunning) {
      console.log(this.chalk!.yellow('服务器已在运行中'));
      return;
    }

    const spinner = this.ora!('启动服务器...').start();
    
    try {
      // 加载 OpenAPI 数据
      // TODO: 实现 loadOpenAPIData 函数
      // const openApiData = await loadOpenAPIData(config.openApiUrl);
      
      // TODO: 创建并启动服务器
       // this.currentServer = new Server({
       //   openApiData,
       //   operationFilter: config.operationFilter,
       //   customHeaders: config.customHeaders
       // });

      // TODO: 启动服务器
      // await this.currentServer.start({
      //   transport: config.transport,
      //   port: config.port
      // });

      this.isRunning = true;
      spinner.succeed(`服务器启动成功！`);
      
      console.log(this.boxen!(
        this.chalk!.green.bold('🎉 服务器运行中') + '\n\n' +
        this.chalk!.gray(`配置: ${config.name}`) + '\n' +
        this.chalk!.gray(`传输: ${config.transport}`) + '\n' +
        (config.port ? this.chalk!.gray(`端口: ${config.port}`) + '\n' : '') +
        this.chalk!.gray(`OpenAPI: ${config.openApiUrl}`),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'green'
        }
      ));

      // 更新最后使用时间
      await this.sessionManager.updateLastUsed(config.id);
      
      // 显示服务器控制菜单
      await this.showServerControls();
      
    } catch (error) {
      spinner.fail('服务器启动失败');
      throw error;
    }
  }

  /**
   * 显示服务器控制菜单
   */
  private async showServerControls(): Promise<void> {
    while (this.isRunning) {
      const { action } = await this.inquirer!.prompt([
        {
          type: 'list',
          name: 'action',
          message: '服务器控制:',
          choices: [
            { name: '📊 查看状态', value: 'status' },
            { name: '🔄 重启服务器', value: 'restart' },
            { name: '⏹️  停止服务器', value: 'stop' },
            { name: '🔙 返回主菜单 (保持服务器运行)', value: 'back' }
          ]
        }
      ]);

      switch (action) {
        case 'status':
          await this.showServerStatus();
          break;
        case 'restart':
          await this.restartServer();
          break;
        case 'stop':
          await this.stopServer();
          return;
        case 'back':
          return;
      }
    }
  }

  /**
   * 停止服务器
   */
  private async stopServer(): Promise<void> {
    if (!this.currentServerId) {
      await this.uiManager.showWarning('服务器未在运行');
      return;
    }

    try {
      await this.uiManager.showInfo('正在停止服务器...');
      
      const result = await this.serverManager.stopServer(this.currentServerId);
      
      if (result.success) {
        this.currentServerId = undefined;
        await this.uiManager.showSuccess('服务器已停止');
      } else {
        await this.uiManager.showError('停止服务器失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      await this.uiManager.showError('停止服务器失败', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 重启服务器
   */
  private async restartServer(): Promise<void> {
    console.log(this.chalk!.cyan('重启服务器...'));
    await this.stopServer();
    // 这里需要保存当前配置以便重启
    // 实现细节待完善
  }

  /**
   * 显示服务器状态
   */
  private async showServerStatus(): Promise<void> {
    if (!this.currentServerId) {
      await this.uiManager.showWarning('服务器未在运行');
      return;
    }

    // 显示服务器状态信息
    console.log(this.chalk!.green('✅ 服务器运行中'));
    // 更多状态信息待实现
  }

  /**
   * 快速启动
   */
  private async quickStart(): Promise<void> {
    await this.uiManager.showBox('选择一个最近使用的配置快速启动服务器\n或者创建新的配置', {
      title: '🎯 快速启动'
    });
    
    const recentConfigs = await this.configManager.getRecentConfigs();
    
    if (recentConfigs.length === 0) {
      await this.uiManager.showInfo('暂无最近使用的配置');
      return;
    }
    
    const sessions = [];
    for (const configId of recentConfigs.slice(0, 5)) {
      const session = await this.sessionManager.getSession(configId);
      if (session) {
        sessions.push(session);
      }
    }
    
    if (sessions.length === 0) {
      await this.uiManager.showInfo('最近使用的配置已失效');
      return;
    }
    
    const choices = sessions.map(session => ({
      name: `${session.name} (${session.transport})`,
      value: session.id
    }));
    
    const { sessionId } = await this.inquirer!.prompt([
      {
        type: 'list',
        name: 'sessionId',
        message: '选择配置快速启动:',
        choices,
        pageSize: 5
      }
    ]);
    
    const session = await this.sessionManager.getSession(sessionId);
    if (session) {
      await this.configManager.addRecentConfig(sessionId);
      await this.startServerWithConfig(session);
    }
  }

  /**
   * 编辑会话
   */
  private async editSession(session: SessionConfig): Promise<void> {
    await this.uiManager.showBox(`✏️ 编辑配置: ${session.name}`, { title: '编辑模式', borderColor: 'yellow' });
    
    try {
      const updatedConfig = await this.openApiWizard.editConfiguration(session);
      
      if (updatedConfig) {
        await this.sessionManager.updateSession(session.id, updatedConfig);
        await this.uiManager.showSuccess('配置已更新！');
      }
    } catch (error) {
      await this.uiManager.showError('编辑配置失败', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 查看会话详情
   */
  private async viewSession(session: SessionConfig): Promise<void> {
    await this.uiManager.showSessionDetails(session);
    await this.waitForKeyPress();
  }

  /**
   * 删除会话
   */
  private async deleteSession(session: SessionConfig): Promise<void> {
    const { confirm } = await this.inquirer!.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `确定要删除配置 "${session.name}" 吗？`,
        default: false
      }
    ]);

    if (confirm) {
      await this.sessionManager.deleteSession(session.id);
      await this.configManager.removeRecentConfig(session.id);
      await this.uiManager.showSuccess('配置已删除');
    }
  }

  /**
   * 显示最近配置
   */
  private async showRecentConfigs(): Promise<void> {
    const recentConfigs = await this.configManager.getRecentConfigs();
    
    if (recentConfigs.length === 0) {
      await this.uiManager.showInfo('暂无最近使用的配置');
      return;
    }
    
    const sessions = [];
    for (const configId of recentConfigs) {
      const session = await this.sessionManager.getSession(configId);
      if (session) {
        sessions.push(session);
      }
    }
    
    if (sessions.length === 0) {
      await this.uiManager.showInfo('最近使用的配置已失效');
      return;
    }
    
    await this.uiManager.showSessionList(sessions);
    
    const choices = sessions.map(session => ({
      name: `${session.name} (${session.transport})`,
      value: session.id
    }));
    
    choices.push({ name: '🔙 返回主菜单', value: 'back' });
    
    const { sessionId } = await this.inquirer!.prompt([
      {
        type: 'list',
        name: 'sessionId',
        message: '选择配置进行操作:',
        choices,
        pageSize: 10
      }
    ]);
    
    if (sessionId === 'back') {
      return;
    }
    
    await this.manageSession(sessionId);
  }

  /**
   * 显示设置
   */
  private async showSettings(): Promise<void> {
    const config = await this.configManager.getConfig();
    
    const settingsContent = [
      `默认传输协议: ${config.defaultTransport}`,
      `默认端口: ${config.defaultPort}`,
      `UI 主题: ${config.theme}`,
      `日志级别: ${config.logLevel}`,
      `服务器超时: ${config.serverTimeout}ms`
    ].join('\n');
    
    await this.uiManager.showBox(settingsContent, {
      title: '⚙️ 全局设置',
      borderColor: 'blue'
    });
    
    const choices = [
      { name: '🌐 默认传输协议', value: 'transport' },
      { name: '🎨 UI 主题', value: 'theme' },
      { name: '📊 日志级别', value: 'logLevel' },
      { name: '🔄 重置所有设置', value: 'reset' },
      { name: '🔙 返回主菜单', value: 'back' }
    ];
    
    const { setting } = await this.inquirer!.prompt([
      {
        type: 'list',
        name: 'setting',
        message: '选择要配置的设置:',
        choices
      }
    ]);
    
    if (setting === 'back') {
      return;
    }
    
    if (setting === 'reset') {
      const { confirm } = await this.inquirer!.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: '确定要重置所有设置吗？',
          default: false
        }
      ]);
      
      if (confirm) {
        await this.configManager.resetConfig();
        await this.uiManager.showSuccess('设置已重置');
      }
      return;
    }
    
    await this.configureSetting(setting);
  }

  /**
   * 显示状态
   */
  private async showStatus(): Promise<void> {
    const serverStatus = this.currentServerId ? this.serverManager.getServerStatus(this.currentServerId) : undefined;
    const stats = await this.sessionManager.getSessionStats();
    const config = await this.configManager.getConfig();
    
    // 显示服务器状态
    if (serverStatus && serverStatus.config) {
      await this.uiManager.showServerStatus(serverStatus.config, serverStatus.isRunning);
    }
    
    // 显示配置统计
    await this.uiManager.showStats({
      total: stats.total,
      byTransport: stats.byTransport,
      recentlyUsed: stats.recentlyUsed
    });
    
    await this.waitForKeyPress();
  }

  /**
   * 配置设置
   */
  private async configureSetting(setting: string): Promise<void> {
    const config = await this.configManager.getConfig();
    
    switch (setting) {
      case 'transport':
        const { transport } = await this.inquirer!.prompt([
          {
            type: 'list',
            name: 'transport',
            message: '选择默认传输协议:',
            choices: [
              { name: 'STDIO', value: 'stdio' },
              { name: 'SSE (Server-Sent Events)', value: 'sse' },
              { name: 'WebSocket', value: 'ws' }
            ],
            default: config.defaultTransport
          }
        ]);
        await this.configManager.setConfig({ defaultTransport: transport });
        await this.uiManager.showSuccess(`默认传输协议已设置为: ${transport}`);
        break;
        
      case 'theme':
        const { theme } = await this.inquirer!.prompt([
          {
            type: 'list',
            name: 'theme',
            message: '选择 UI 主题:',
            choices: [
              { name: '默认', value: 'default' },
              { name: '暗色', value: 'dark' },
              { name: '亮色', value: 'light' }
            ],
            default: config.theme
          }
        ]);
        await this.configManager.setConfig({ theme });
        await this.uiManager.showSuccess(`UI 主题已设置为: ${theme}`);
        break;
        
      case 'logLevel':
        const { logLevel } = await this.inquirer!.prompt([
          {
            type: 'list',
            name: 'logLevel',
            message: '选择日志级别:',
            choices: [
              { name: 'Debug', value: 'debug' },
              { name: 'Info', value: 'info' },
              { name: 'Warn', value: 'warn' },
              { name: 'Error', value: 'error' }
            ],
            default: config.logLevel
          }
        ]);
        await this.configManager.setConfig({ logLevel });
        await this.uiManager.showSuccess(`日志级别已设置为: ${logLevel}`);
        break;
    }
  }

  /**
   * 等待按键
   */
  private async waitForKeyPress(): Promise<void> {
    await this.inquirer!.prompt([
      {
        type: 'input',
        name: 'continue',
        message: '按 Enter 键继续...'
      }
    ]);
  }

  /**
   * 退出程序
   */
  private async exit(): Promise<void> {
    const runningServers = this.serverManager.getRunningServers();
    
    if (runningServers.size > 0) {
      const { stopServers } = await this.inquirer!.prompt([
        {
          type: 'confirm',
          name: 'stopServers',
          message: `有 ${runningServers.size} 个服务器正在运行，是否停止后退出？`,
          default: true
        }
      ]);

      if (stopServers) {
        await this.serverManager.stopAllServers();
      }
    }

    this.isRunning = false;
    await this.uiManager.showSuccess('👋 再见！');
  }
}