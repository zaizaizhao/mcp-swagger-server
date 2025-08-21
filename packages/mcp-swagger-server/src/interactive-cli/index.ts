// Static imports for ES modules
import type { QuestionCollection, Answers } from 'inquirer';
import inquirer from 'inquirer';
import ora from 'ora';
import boxen from 'boxen';
import chalk from 'chalk';
import Table from 'cli-table3';
import figlet from 'figlet';

type Inquirer = {
  prompt: <T extends Answers = Answers>(questions: QuestionCollection<T>) => Promise<T>;
};
import { SessionManager } from './managers/session-manager';
import { OpenAPIWizard } from './wizards/openapi-wizard';
import { UIManager } from './ui/ui-manager';
import { themeManager } from './themes';
import { configManager, ConfigManager } from './utils/config-manager';
import { serverManager, ServerManager } from './utils/server-manager';
// Server and loadOpenAPIData imports removed - will be implemented later
import { OperationFilter } from './types';
import { SessionConfig } from './types';
import { runStdioServer, runSseServer, runStreamableServer } from '../server';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface InteractiveCLIOptions {
  port?: number;
  transport?: 'stdio' | 'sse' | 'streamable';
  configFile?: string;
  debug?: boolean;
  openapi?: string;
  endpoint?: string;
  authType?: string;
  bearerToken?: string;
  debugHeaders?: boolean;
  operationFilterParameters?: string;
  operationFilterTags?: string;
  operationFilterPaths?: string;
  customHeaders?: string;
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
  
  // Static module references
  private inquirer: Inquirer;

  constructor(private options: InteractiveCLIOptions = {}) {
    this.sessionManager = new SessionManager();
    this.openApiWizard = new OpenAPIWizard();
    this.uiManager = new UIManager();
    this.configManager = configManager;
    this.serverManager = serverManager;
    this.inquirer = inquirer;
    
    // 设置服务器事件监听
    this.setupServerEventListeners();
  }
  


  /**
   * 启动交互式 CLI
   */
  async start(): Promise<void> {
    this.isRunning = true;
    
    this.uiManager.clear();
    
    // 检查是否提供了 openapi 参数，如果有则直接启动服务
    if (this.options.openapi) {
      await this.startDirectMode();
      return;
    }
    
    if (await this.configManager.get('showWelcome')) {
      await this.showWelcome();
    }
    
    while (this.isRunning) {
      try {
        await this.showMainMenu();
      } catch (error) {
        await this.uiManager.showError('发生错误', error instanceof Error ? error : undefined);
        
        const { continueRunning } = await this.inquirer.prompt([
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
    const theme = themeManager.getCurrentTheme();
    const welcomeContent = `${chalk.hex(theme.colors.accent).bold.bgBlack(figlet.textSync('MCP Swagger Server (Mss)', { font: 'Small' }))}

${chalk.hex(theme.colors.muted)('这个工具可以帮助您轻松配置和管理 OpenAPI 到 MCP 的转换服务')}

${chalk.hex(theme.colors.warning)('主要功能:')}
${theme.icons.create} 创建新的 OpenAPI 配置
${theme.icons.session} 管理现有配置
${theme.icons.server} 快速启动服务器
${theme.icons.settings} 全局设置
${theme.icons.stats} 查看状态和统计信息`;;

    await this.uiManager.showBox(welcomeContent, {
      title: theme.icons.welcome + ' 欢迎',
      themeStyle: 'accent',
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
    const theme = themeManager.getCurrentTheme();
    const choices = [
      {
        name: theme.icons.create + ' 创建新的 OpenAPI 配置',
        value: 'create-new'
      },
      {
        name: theme.icons.session + ' 管理现有配置',
        value: 'manage-sessions',
        disabled: sessions.length === 0 ? '(暂无配置)' : false
      },
      {
        name: theme.icons.server + ' 快速启动服务器',
        value: 'quick-start',
        disabled: sessions.length === 0 ? '(暂无配置)' : false
      },
      {
        name: theme.icons.settings + ' 全局设置',
        value: 'settings'
      },
      {
        name: theme.icons.stats + ' 查看状态',
        value: 'status'
      },
      {
        name: theme.icons.help + ' 帮助',
        value: 'help'
      },
      {
        name: theme.icons.exit + ' 退出',
        value: 'exit'
      }
    ];

    const { action } = await this.inquirer.prompt([
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
    const theme = themeManager.getCurrentTheme();
    await this.uiManager.showBox(theme.icons.create + ' 创建新配置', { 
      title: '新建配置', 
      themeStyle: 'success' 
    });
    
    try {
      const config = await this.openApiWizard.runWizard();
      
      if (config) {
        const savedConfig = await this.sessionManager.saveSession(config);
        await this.configManager.addRecentConfig(savedConfig.id);
        await this.uiManager.showSuccess('配置已保存！');
        
        const { startNow } = await this.inquirer.prompt([
          {
            type: 'confirm',
            name: 'startNow',
            message: '是否立即启动服务器？',
            default: true
          }
        ]);
        
        if (startNow) {
          await this.startServerWithConfig(savedConfig);
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

    const theme = themeManager.getCurrentTheme();
    choices.push({ name: theme.icons.back + ' 返回主菜单', value: 'back' });

    const { sessionId } = await this.inquirer.prompt([
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

    const theme = themeManager.getCurrentTheme();
    const { action } = await this.inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `管理配置: ${session.name}`,
        choices: [
          { name: theme.icons.server + ' 启动服务器', value: 'start' },
          { name: theme.icons.edit + ' 编辑配置', value: 'edit' },
          { name: theme.icons.view + ' 查看详情', value: 'view' },
          { name: theme.icons.delete + ' 删除配置', value: 'delete' },
          { name: theme.icons.back + ' 返回', value: 'back' }
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
        
        // 更新最近使用时间
        await this.sessionManager.updateSession(config.id, {
          ...config,
          lastUsed: new Date().toISOString()
        });
        
        await this.uiManager.showSuccess(`服务器已启动: ${config.name}`);
        
        if (config.transport === 'sse' && config.port) {
          await this.uiManager.showInfo(`访问地址: http://localhost:${config.port}`);
        } else if (config.transport === 'streamable' && config.port) {
          await this.uiManager.showInfo(`访问地址: http://localhost:${config.port}/mcp`);
        } else if (config.transport === 'stdio') {
          await this.uiManager.showInfo('服务器已启动，使用 stdio 传输协议');
        }
        
      } else {
        throw new Error(result.error || '服务器启动失败');
      }
      
    } catch (error) {
      await this.uiManager.showError('服务器启动失败', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * 启动服务器
   */
  private async startServer(config: SessionConfig): Promise<void> {
    if (this.isRunning) {
      console.log(chalk.yellow('服务器已在运行中'));
      return;
    }

    const spinner = ora('启动服务器...').start();
    
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
      
      console.log(boxen(
          chalk.green.bold('🎉 服务器运行中') + '\n\n' +
          chalk.gray(`配置: ${config.name}`) + '\n' +
          chalk.gray(`传输: ${config.transport}`) + '\n' +
          (config.port ? chalk.gray(`端口: ${config.port}`) + '\n' : '') +
          chalk.gray(`OpenAPI: ${config.openApiUrl}`),
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
      const { action } = await this.inquirer.prompt([
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
    console.log(chalk.cyan('重启服务器...'));
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
    console.log(chalk.green('✅ 服务器运行中'));
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
    
    const { sessionId } = await this.inquirer.prompt([
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
    const { confirm } = await this.inquirer.prompt([
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
    
    const { sessionId } = await this.inquirer.prompt([
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
    
    const { setting } = await this.inquirer.prompt([
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
      const { confirm } = await this.inquirer.prompt([
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
        const { transport } = await this.inquirer.prompt([
          {
            type: 'list',
            name: 'transport',
            message: '选择默认传输协议:',
            choices: [
              { name: 'STDIO', value: 'stdio' },
              { name: 'SSE (Server-Sent Events)', value: 'sse' },
              { name: 'Streamable', value: 'streamable' }
            ],
            default: config.defaultTransport
          }
        ]);
        await this.configManager.setConfig({ defaultTransport: transport });
        await this.uiManager.showSuccess(`默认传输协议已设置为: ${transport}`);
        break;
        
      case 'theme':
        const { theme } = await this.inquirer.prompt([
          {
            type: 'list',
            name: 'theme',
            message: '选择 UI 主题:',
            choices: [
              { name: '默认', value: 'default' },
              { name: '暗红赛博', value: 'dark-red-cyber' },
              { name: '紧凑', value: 'compact' },
              { name: '华丽', value: 'fancy' }
            ],
            default: config.theme
          }
        ]);
        await this.configManager.setConfig({ theme });
        await this.uiManager.showSuccess(`UI 主题已设置为: ${theme}`);
        break;
        
      case 'logLevel':
        const { logLevel } = await this.inquirer.prompt([
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
    await this.inquirer.prompt([
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
      const { stopServers } = await this.inquirer.prompt([
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

  /**
   * 停止交互式 CLI
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * 直接启动模式 - 兼容cli.ts的命令行参数启动
   */
  private async startDirectMode(): Promise<void> {
    try {
      console.log(chalk.cyan('🚀 MCP Swagger Server - 直接启动模式'));
      console.log();
      
      // 显示配置信息
      await this.showDirectModeConfig();
      
      // 加载OpenAPI数据
      let openApiData = null;
      if (this.options.openapi) {
        console.log(chalk.blue('📡 加载 OpenAPI 规范'));
        openApiData = await this.loadOpenAPIData(this.options.openapi);
        
        if (openApiData) {
          console.log();
          console.log(chalk.gray('  API 信息:'));
          if (openApiData.info?.title) {
            console.log(chalk.gray(`  📝 标题: ${openApiData.info.title}`));
          }
          if (openApiData.info?.version) {
            console.log(chalk.gray(`  🔖 版本: ${openApiData.info.version}`));
          }
          if (openApiData.paths) {
            const pathCount = Object.keys(openApiData.paths).length;
            console.log(chalk.gray(`  🛣️ 路径: ${pathCount} 个端点`));
          }
        }
      }
      
      // 构建认证配置
      const authConfig = this.buildAuthConfig();
      
      // 构建操作过滤器
      const operationFilter = this.buildOperationFilter();
      
      // 构建自定义请求头
      const customHeaders = this.buildCustomHeaders();
      
      console.log();
      console.log(chalk.blue('🚀 启动服务器'));
      
      // 根据传输协议启动服务器
      const transport = this.options.transport || 'stdio';
      const port = this.options.port || 3322;
      
      switch (transport.toLowerCase()) {
        case 'stdio':
          console.log(chalk.yellow('正在启动 STDIO 服务器...'));
          console.log(chalk.gray('  💬 适用于 AI 客户端集成（如 Claude Desktop）'));
          await runStdioServer(openApiData, authConfig, customHeaders, this.options.debugHeaders, operationFilter);
          break;
          
        case 'streamable':
          console.log(chalk.yellow('正在启动 Streamable 服务器...'));
          const streamEndpoint = this.options.endpoint || '/mcp';
          const streamUrl = `http://localhost:${port}${streamEndpoint}`;
          console.log(chalk.gray(`  🌐 服务器地址: ${streamUrl}`));
          console.log(chalk.gray('  🔗 适用于 Web 应用集成'));
          await runStreamableServer(streamEndpoint, port, openApiData, authConfig, customHeaders, this.options.debugHeaders, operationFilter);
          break;
          
        case 'sse':
          console.log(chalk.yellow('正在启动 SSE 服务器...'));
          const sseEndpoint = this.options.endpoint || '/sse';
          const sseUrl = `http://localhost:${port}${sseEndpoint}`;
          console.log(chalk.gray(`  📡 SSE 端点: ${sseUrl}`));
          console.log(chalk.gray('  ⚡ 适用于实时 Web 应用'));
          await runSseServer(sseEndpoint, port, openApiData, authConfig, customHeaders, this.options.debugHeaders, operationFilter);
          break;
          
        default:
          throw new Error(`不支持的传输协议: ${transport}，支持的协议: stdio, sse, streamable`);
      }
      
      // 服务器启动成功
      console.log();
      console.log('='.repeat(60));
      console.log(chalk.green('✓ MCP Swagger Server 启动成功！'));
      
      if (transport !== 'stdio') {
        const serverUrl = `http://localhost:${port}${this.options.endpoint || (transport === 'sse' ? '/sse' : '/mcp')}`;
        console.log(chalk.gray(`  🛑 服务器运行在: ${serverUrl}`));
      }
      
      console.log(chalk.gray('  💡 按 Ctrl+C 停止服务器'));
      console.log('='.repeat(60));
      
    } catch (error: any) {
      console.log();
      console.log(chalk.red(`✗ 服务器启动失败: ${error.message}`));
      process.exit(1);
    }
  }
  
  /**
   * 显示直接启动模式的配置信息
   */
  private async showDirectModeConfig(): Promise<void> {
    const transport = this.options.transport || 'stdio';
    const port = this.options.port || 3322;
    
    console.log(chalk.blue('📋 服务器配置'));
    console.log('-'.repeat(20));
    console.log(`传输协议: ${chalk.white(transport.toUpperCase())}`);
    console.log(`端口号: ${chalk.white(port.toString())} ${chalk.gray(transport === 'stdio' ? '(STDIO 模式不使用端口)' : '')}`);
    console.log(`数据源: ${chalk.white(this.options.openapi || '未指定')} ${chalk.gray(this.options.openapi ? (this.isUrl(this.options.openapi) ? '远程 URL' : '本地文件') : '')}`);
    
    // 显示认证配置
    const authType = this.options.authType || 'none';
    console.log(`认证类型: ${chalk.white(authType.toUpperCase())}`);
    
    if (authType === 'bearer' && this.options.bearerToken) {
      console.log(`Token 来源: ${chalk.white('静态配置')} ${chalk.gray('✓ 已配置')}`);
    }
    
    console.log();
  }
  
  /**
   * 加载OpenAPI数据
   */
  private async loadOpenAPIData(source: string): Promise<any> {
    try {
      if (this.isUrl(source)) {
        console.log(chalk.yellow(`正在从远程 URL 加载 OpenAPI 规范...`));
        console.log(chalk.gray(`  📡 ${source}`));
        const response = await axios.get(source);
        console.log(chalk.green('✓ 远程 OpenAPI 规范加载成功'));
        return response.data;
      } else {
        console.log(chalk.yellow(`正在从本地文件加载 OpenAPI 规范...`));
        const filePath = path.resolve(source);
        console.log(chalk.gray(`  📁 ${filePath}`));
        const content = fs.readFileSync(filePath, 'utf-8');
        
        let data;
        if (source.endsWith('.yaml') || source.endsWith('.yml')) {
          console.log(chalk.gray('  🔄 解析 YAML 格式...'));
          const yaml = await import('js-yaml');
          data = yaml.load(content);
        } else {
          console.log(chalk.gray('  🔄 解析 JSON 格式...'));
          data = JSON.parse(content);
        }
        
        console.log(chalk.green('✓ 本地 OpenAPI 规范加载成功'));
        return data;
      }
    } catch (error: any) {
      console.log(chalk.red(`✗ 加载 OpenAPI 规范失败: ${error.message}`));
      console.log(chalk.gray(`  源: ${source}`));
      throw error;
    }
  }
  
  /**
   * 检查是否为URL
   */
  private isUrl(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * 构建认证配置
   */
  private buildAuthConfig(): any {
    const authType = this.options.authType || 'none';
    
    if (authType === 'bearer' && this.options.bearerToken) {
      return {
        type: 'bearer',
        bearer: {
          source: 'static',
          token: this.options.bearerToken
        }
      };
    }
    
    return { type: 'none' };
  }
  
  /**
   * 构建操作过滤器
   */
  private buildOperationFilter(): any {
    if (this.options.operationFilterParameters) {
      return {
        parameters: this.options.operationFilterParameters.split(',').map(p => p.trim())
      };
    }
    
    if (this.options.operationFilterTags) {
      return {
        tags: this.options.operationFilterTags.split(',').map(t => t.trim())
      };
    }
    
    if (this.options.operationFilterPaths) {
      return {
        paths: this.options.operationFilterPaths.split(',').map(p => p.trim())
      };
    }
    
    return null;
  }
  
  /**
   * 构建自定义请求头
   */
  private buildCustomHeaders(): any {
    const headers: any = {};
    
    if (this.options.customHeaders) {
      const headerPairs = this.options.customHeaders.split(',');
      for (const pair of headerPairs) {
        const [key, value] = pair.split(':').map(s => s.trim());
        if (key && value) {
          headers[key] = value;
        }
      }
    }
    
    return Object.keys(headers).length > 0 ? headers : null;
  }
}