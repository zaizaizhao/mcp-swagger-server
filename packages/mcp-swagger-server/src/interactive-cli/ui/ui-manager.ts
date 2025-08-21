import { SessionConfig } from '../types';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import ora from 'ora';
import { themeManager } from '../themes';
import type { Theme } from '../themes';
import { configManager } from '../utils/config-manager';

type Ora = any;

export interface ProgressOptions {
  text: string;
  color?: 'cyan' | 'green' | 'yellow' | 'red' | 'blue' | 'magenta';
}

export interface TableColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  formatter?: (value: any) => string;
}

export class UIManager {
  private activeSpinners: Map<string, Ora> = new Map();
  private theme: Theme;

  constructor() {
    this.theme = themeManager.getCurrentTheme();
    this.initializeTheme();
  }

  private async initializeTheme() {
    try {
      const configTheme = await configManager.get('theme');
      if (configTheme && themeManager.hasTheme(configTheme)) {
        themeManager.setTheme(configTheme);
        this.theme = themeManager.getCurrentTheme();
      }
    } catch (error) {
      // 如果配置加载失败，使用默认主题
      console.warn('Failed to load theme from config, using default theme');
    }
  }

  /**
   * 更新主题
   */
  updateTheme(): void {
    this.theme = themeManager.getCurrentTheme();
  }

  /**
   * 显示成功消息
   */
  async showSuccess(message: string): Promise<void> {
    console.log(chalk.hex(this.theme.colors.success)(this.theme.icons.success + ' ' + message));
  }

  /**
   * 显示错误消息
   */
  async showError(message: string, error?: Error): Promise<void> {
    console.log(chalk.hex(this.theme.colors.error)(this.theme.icons.error + ' ' + message));
    if (error && process.env.DEBUG) {
      console.log(chalk.hex(this.theme.colors.text.muted)(error.stack));
    }
  }

  /**
   * 显示警告消息
   */
  async showWarning(message: string): Promise<void> {
    console.log(chalk.hex(this.theme.colors.warning)(this.theme.icons.warning + '  ' + message));
  }

  /**
   * 显示信息消息
   */
  async showInfo(message: string): Promise<void> {
    console.log(chalk.hex(this.theme.colors.info)(this.theme.icons.info + '  ' + message));
  }

  /**
   * 显示调试消息
   */
  async showDebug(message: string): Promise<void> {
    if (process.env.DEBUG) {
      console.log(chalk.hex(this.theme.colors.text.muted)('🐛 ' + message));
    }
  }

  /**
   * 创建进度指示器
   */
  async createSpinner(id: string, options: ProgressOptions): Promise<Ora> {
    const spinner = ora({
      text: options.text,
      color: options.color || 'cyan'
    });
    
    this.activeSpinners.set(id, spinner);
    return spinner;
  }

  /**
   * 获取进度指示器
   */
  getSpinner(id: string): Ora | undefined {
    return this.activeSpinners.get(id);
  }

  /**
   * 停止并移除进度指示器
   */
  stopSpinner(id: string, success: boolean = true, message?: string): void {
    const spinner = this.activeSpinners.get(id);
    if (spinner) {
      if (success) {
        spinner.succeed(message);
      } else {
        spinner.fail(message);
      }
      this.activeSpinners.delete(id);
    }
  }

  /**
   * 停止所有进度指示器
   */
  stopAllSpinners(): void {
    for (const [id, spinner] of this.activeSpinners) {
      spinner.stop();
      this.activeSpinners.delete(id);
    }
  }

  /**
   * 显示带边框的消息
   */
  async showBox(
    content: string,
    options?: {
      title?: string;
      borderColor?: string;
      padding?: number;
      themeStyle?: 'default' | 'accent' | 'success' | 'error' | 'warning';
    }
  ): Promise<void> {
    let borderStyleConfig = this.theme.borderStyle.default;
    let borderColor = options?.borderColor || this.theme.colors.primary;
    
    // 根据主题样式选择边框
    if (options?.themeStyle) {
      switch (options.themeStyle) {
        case 'accent':
          borderStyleConfig = this.theme.borderStyle.accent;
          borderColor = this.theme.colors.accent;
          break;
        case 'success':
          borderStyleConfig = this.theme.borderStyle.success;
          borderColor = this.theme.colors.success;
          break;
        case 'error':
          borderStyleConfig = this.theme.borderStyle.error;
          borderColor = this.theme.colors.error;
          break;
        case 'warning':
          borderStyleConfig = this.theme.borderStyle.warning;
          borderColor = this.theme.colors.warning;
          break;
      }
    }

    const boxOptions: boxen.Options = {
      padding: borderStyleConfig.padding || options?.padding || 1,
      margin: borderStyleConfig.margin || 1,
      borderStyle: borderStyleConfig.borderStyle as any,
      borderColor: borderStyleConfig.borderColor || borderColor,
      title: options?.title,
      titleAlignment: 'center'
    };

    console.log(boxen(content, boxOptions));
  }

  /**
   * 显示表格
   */
  async showTable<T extends Record<string, any>>(
    data: T[],
    columns: TableColumn[],
    options?: {
      title?: string;
      style?: 'compact' | 'normal' | 'fancy';
    }
  ): Promise<void> {
    if (data.length === 0) {
      await this.showInfo('暂无数据');
      return;
    }

    const tableStyle = this.getTableStyle(options?.style || 'normal');
    const tableOptions = {
      colWidths: columns.map(col => col.width || 20),
      ...this.theme.tableStyle,
      head: columns.map(col => col.header)
    };
    
    const table = new Table(tableOptions);

    for (const row of data) {
      const tableRow = columns.map(col => {
        const value = row[col.key];
        return col.formatter ? col.formatter(value) : String(value || '');
      });
      table.push(tableRow);
    }

    if (options?.title) {
      console.log(chalk.hex(this.theme.colors.accent).bold('\n' + options.title));
    }
    console.log(table.toString());
  }

  /**
   * 获取表格样式
   */
  private getTableStyle(style: 'compact' | 'normal' | 'fancy') {
    switch (style) {
      case 'compact':
        return {
          chars: {
            'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
            'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
            'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '',
            'right': '', 'right-mid': '', 'middle': ' '
          },
          style: { 'padding-left': 0, 'padding-right': 0 }
        };
      case 'fancy':
        return {
          chars: {
            'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
            'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
            'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
            'right': '║', 'right-mid': '╢', 'middle': '│'
          }
        };
      default:
        return {};
    }
  }

  /**
   * 显示会话列表
   */
  async showSessionList(sessions: SessionConfig[]): Promise<void> {
    if (sessions.length === 0) {
      await this.showInfo('暂无保存的配置');
      return;
    }

    const columns: TableColumn[] = [
      { header: '名称', key: 'name', width: 20 },
      { header: '传输协议', key: 'transport', width: 12 },
      { header: '端口', key: 'port', width: 8, formatter: (value) => value || 'N/A' },
      { header: 'OpenAPI URL', key: 'openApiUrl', width: 40, formatter: (value) => this.truncateUrl(value) },
      { header: '最后使用', key: 'lastUsed', width: 20, formatter: (value) => this.formatDate(value) }
    ];

    await this.showTable(sessions, columns, { title: this.theme.icons.session + ' 保存的配置' });
  }

  /**
   * 显示会话详情
   */
  async showSessionDetails(session: SessionConfig): Promise<void> {
    const details = [
      ['ID', session.id],
      ['名称', session.name],
      ['OpenAPI URL', session.openApiUrl],
      ['传输协议', session.transport],
      ['端口', session.port?.toString() || 'N/A'],
      ['创建时间', this.formatDate(session.createdAt)],
      ['最后使用', this.formatDate(session.lastUsed)]
    ];

    if (session.auth) {
      details.push(['认证类型', session.auth.type]);
      details.push(['Token', this.maskToken(session.auth.token || '')]);
    }

    if (session.customHeaders && Object.keys(session.customHeaders).length > 0) {
      details.push(['自定义请求头', Object.keys(session.customHeaders).join(', ')]);
    }

    if (session.operationFilter) {
      const filter = session.operationFilter;
      if (filter.methods) {
        const methodInfo = filter.methods.include 
          ? `包含: ${filter.methods.include.join(', ')}`
          : `排除: ${filter.methods.exclude?.join(', ') || ''}`;
        details.push(['方法过滤', methodInfo]);
      }
      if (filter.paths) {
        const pathInfo = filter.paths.include 
          ? `包含: ${filter.paths.include.join(', ')}`
          : `排除: ${filter.paths.exclude?.join(', ') || ''}`;
        details.push(['路径过滤', pathInfo]);
      }
    }

    const table = new Table({
      head: ['属性', '值'],
      colWidths: [15, 50]
    });

    details.forEach(([key, value]) => {
      table.push([key, value]);
    });

    console.log(chalk.hex(this.theme.colors.accent).bold(`\n${this.theme.icons.session} 配置详情: ${session.name}`));
    console.log(table.toString());
  }

  /**
   * 显示服务器状态
   */
  async showServerStatus(config: SessionConfig, isRunning: boolean, stats?: {
    uptime: number;
    requests: number;
    errors: number;
  }): Promise<void> {
    const statusColor = isRunning ? this.theme.colors.success : this.theme.colors.error;
    const statusIcon = isRunning ? this.theme.icons.success : this.theme.icons.error;
    const status = chalk.hex(statusColor)(`${statusIcon} ${isRunning ? '运行中' : '已停止'}`);
    
    let content = `状态: ${status}\n`;
    content += `配置: ${config.name}\n`;
    content += `传输: ${config.transport}\n`;
    if (config.port) {
      content += `端口: ${config.port}\n`;
    }
    content += `OpenAPI: ${this.truncateUrl(config.openApiUrl)}`;

    if (stats && isRunning) {
      content += `\n\n运行时间: ${this.formatUptime(stats.uptime)}`;
      content += `\n请求数: ${stats.requests}`;
      content += `\n错误数: ${stats.errors}`;
    }

    await this.showBox(content, {
      title: this.theme.icons.server + '  服务器状态',
      borderColor: isRunning ? this.theme.colors.success : this.theme.colors.error,
      themeStyle: isRunning ? 'accent' : 'default'
    });
  }

  /**
   * 显示统计信息
   */
  async showStats(stats: {
    total: number;
    byTransport: Record<string, number>;
    recentlyUsed: number;
  }): Promise<void> {
    let content = `总配置数: ${stats.total}\n`;
    content += `最近使用: ${stats.recentlyUsed}\n\n`;
    content += '按传输协议分布:\n';
    
    for (const [transport, count] of Object.entries(stats.byTransport)) {
      content += `  ${transport}: ${count}\n`;
    }

    await this.showBox(content.trim(), {
      title: this.theme.icons.stats + ' 统计信息',
      borderColor: this.theme.colors.accent,
      themeStyle: 'accent'
    });
  }

  /**
   * 显示帮助信息
   */
  async showHelp(): Promise<void> {
    const helpContent = `
${chalk.hex(this.theme.colors.accent).bold('🚀 MCP Swagger Server - 交互式 CLI')}

${chalk.hex(this.theme.colors.warning)('主要功能:')}
• 🆕 创建新的 OpenAPI 配置
• 📋 管理现有配置 (查看、编辑、删除)
• 🚀 快速启动服务器
• ⚙️  全局设置
• 📊 查看状态和统计信息

${chalk.hex(this.theme.colors.warning)('支持的传输协议:')}
• 📟 STDIO - 标准输入输出 (推荐用于 Claude Desktop)
• 🌊 SSE - Server-Sent Events (适用于 Web 应用)
• 🔄 Streamable - 流式传输 (适用于实时应用)

${chalk.hex(this.theme.colors.warning)('高级功能:')}
• 🔍 操作过滤器 - 控制哪些 API 操作被转换
• 🔐 认证配置 - Bearer Token 支持
• 📋 自定义请求头 - 添加额外的 HTTP 头
• 💾 会话管理 - 保存和重用配置

${chalk.hex(this.theme.colors.warning)('快捷键:')}
• Ctrl+C - 退出当前操作
• ↑/↓ - 导航菜单选项
• Space - 选择/取消选择 (多选)
• Enter - 确认选择

${chalk.hex(this.theme.colors.warning)('更多信息:')}
• 项目主页: https://github.com/your-repo/mcp-swagger-server
• 文档: https://docs.mcp-swagger-server.com
• 问题反馈: https://github.com/your-repo/mcp-swagger-server/issues
`;

    console.log(helpContent);
  }

  /**
   * 清屏
   */
  clear(): void {
    console.clear();
  }

  /**
   * 显示分隔线
   */
  async showSeparator(char: string = '─', length: number = 50): Promise<void> {
    console.log(chalk.gray(char.repeat(length)));
  }

  /**
   * 格式化日期
   */
  private formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * 截断 URL
   */
  private truncateUrl(url: string, maxLength: number = 35): string {
    if (url.length <= maxLength) {
      return url;
    }
    return url.substring(0, maxLength - 3) + '...';
  }

  /**
   * 掩码 Token
   */
  private maskToken(token: string): string {
    if (token.length <= 8) {
      return '*'.repeat(token.length);
    }
    return token.substring(0, 4) + '*'.repeat(token.length - 8) + token.substring(token.length - 4);
  }

  /**
   * 格式化运行时间
   */
  private formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
}