import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { SessionConfig, OperationFilter } from '../types';
import { configManager } from './config-manager';

// Dynamic import for ES module
type Chalk = typeof import('chalk');

export interface ServerStats {
  uptime: number;
  requests: number;
  errors: number;
  startTime: Date;
  lastRequest?: Date;
  lastError?: Date;
}

export interface ServerStatus {
  isRunning: boolean;
  config?: SessionConfig;
  stats?: ServerStats;
  process?: ChildProcess;
  pid?: number;
}

export class ServerManager extends EventEmitter {
  private runningServers: Map<string, ServerStatus> = new Map();
  private logBuffer: Map<string, string[]> = new Map();
  private maxLogLines: number = 1000;
  private debugMode: boolean = false;
  private chalk?: Chalk;
  private modulesInitialized: boolean = false;

  constructor() {
    super();
    this.setupProcessHandlers();
    // debugMode will be initialized in initModules
  }

  /**
   * 初始化动态导入的模块
   */
  private async initModules(): Promise<void> {
    if (this.modulesInitialized) {
      return;
    }
    
    const { default: chalk } = await import('chalk');
    this.chalk = chalk;
    this.debugMode = await configManager.get('debugMode') || false;
    this.modulesInitialized = true;
  }

  /**
   * 启动服务器
   */
  async startServer(config: SessionConfig): Promise<{ success: boolean; error?: string; serverId?: string }> {
    const serverId = this.generateServerId(config);
    
    // 检查是否已经在运行
    if (this.isServerRunning(serverId)) {
      return {
        success: false,
        error: '服务器已在运行中'
      };
    }

    try {
      const process = await this.spawnServerProcess(config);
      const stats: ServerStats = {
        uptime: 0,
        requests: 0,
        errors: 0,
        startTime: new Date()
      };

      const serverStatus: ServerStatus = {
        isRunning: true,
        config,
        stats,
        process,
        pid: process.pid
      };

      this.runningServers.set(serverId, serverStatus);
      this.logBuffer.set(serverId, []);
      this.setupProcessMonitoring(serverId, process);
      this.startStatsTracking(serverId);

      this.emit('serverStarted', { serverId, config });
      
      return {
        success: true,
        serverId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '启动服务器失败'
      };
    }
  }

  /**
   * 停止服务器
   */
  async stopServer(serverId: string): Promise<{ success: boolean; error?: string }> {
    const serverStatus = this.runningServers.get(serverId);
    
    if (!serverStatus || !serverStatus.isRunning) {
      return {
        success: false,
        error: '服务器未在运行'
      };
    }

    try {
      if (serverStatus.process) {
        // 优雅关闭
        serverStatus.process.kill('SIGTERM');
        
        // 等待进程结束，如果超时则强制杀死
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            if (serverStatus.process && !serverStatus.process.killed) {
              serverStatus.process.kill('SIGKILL');
            }
            resolve();
          }, 5000);

          serverStatus.process!.on('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }

      serverStatus.isRunning = false;
      this.runningServers.delete(serverId);
      this.logBuffer.delete(serverId);

      this.emit('serverStopped', { serverId, config: serverStatus.config });
      
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '停止服务器失败'
      };
    }
  }

  /**
   * 重启服务器
   */
  async restartServer(serverId: string): Promise<{ success: boolean; error?: string; newServerId?: string }> {
    const serverStatus = this.runningServers.get(serverId);
    
    if (!serverStatus || !serverStatus.config) {
      return {
        success: false,
        error: '服务器配置不存在'
      };
    }

    const config = serverStatus.config;
    
    // 停止现有服务器
    const stopResult = await this.stopServer(serverId);
    if (!stopResult.success) {
      return stopResult;
    }

    // 等待一小段时间确保端口释放
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 启动新服务器
    const startResult = await this.startServer(config);
    
    return {
      success: startResult.success,
      error: startResult.error,
      newServerId: startResult.serverId
    };
  }

  /**
   * 获取服务器状态
   */
  getServerStatus(serverId: string): ServerStatus | undefined {
    return this.runningServers.get(serverId);
  }

  /**
   * 获取所有运行中的服务器
   */
  getRunningServers(): Map<string, ServerStatus> {
    return new Map(this.runningServers);
  }

  /**
   * 检查服务器是否在运行
   */
  isServerRunning(serverId: string): boolean {
    const status = this.runningServers.get(serverId);
    return status?.isRunning || false;
  }

  /**
   * 获取服务器日志
   */
  getServerLogs(serverId: string, lines?: number): string[] {
    const logs = this.logBuffer.get(serverId) || [];
    return lines ? logs.slice(-lines) : logs;
  }

  /**
   * 清空服务器日志
   */
  clearServerLogs(serverId: string): void {
    this.logBuffer.set(serverId, []);
  }

  /**
   * 停止所有服务器
   */
  async stopAllServers(): Promise<void> {
    const stopPromises = Array.from(this.runningServers.keys()).map(serverId => 
      this.stopServer(serverId)
    );
    
    await Promise.all(stopPromises);
  }

  /**
   * 生成服务器 ID
   */
  private generateServerId(config: SessionConfig): string {
    return `${config.name}-${config.transport}-${Date.now()}`;
  }

  /**
   * 启动服务器进程
   */
  private async spawnServerProcess(config: SessionConfig): Promise<ChildProcess> {
    const args = await this.buildServerArgs(config);
    const cliPath = require.resolve('../../cli.ts');
    
    const childProcess = spawn('ts-node', [cliPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
        DEBUG: this.debugMode ? '1' : '0'
      },
      cwd: process.cwd()
    });

    const serverTimeout = await configManager.get('serverTimeout');
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        childProcess.kill();
        reject(new Error('服务器启动超时'));
      }, serverTimeout);

      childProcess.on('spawn', () => {
        clearTimeout(timeout);
        resolve(childProcess);
      });

      childProcess.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * 构建服务器启动参数
   */
  private async buildServerArgs(config: SessionConfig): Promise<string[]> {
    const args: string[] = [];

    // OpenAPI URL
    args.push('--url', config.openApiUrl);

    // 传输协议
    args.push('--transport', config.transport);

    // 端口 (仅对 SSE 和 Streamable)
    if (config.port && ['sse', 'streamable'].includes(config.transport)) {
      args.push('--port', config.port.toString());
    }

    // 认证
    if (config.auth && config.auth.token) {
      args.push('--auth-type', config.auth.type);
      args.push('--auth-token', config.auth.token);
    }

    // 自定义请求头
    if (config.customHeaders) {
      for (const [key, value] of Object.entries(config.customHeaders)) {
        args.push('--header', `${key}:${value}`);
      }
    }

    // 添加操作过滤参数
    if (config.operationFilter) {
      const filter = config.operationFilter;
      
      // 添加方法过滤
      if (filter.methods?.include && filter.methods.include.length > 0) {
        args.push('--filter-methods-include', filter.methods.include.join(','));
      }
      if (filter.methods?.exclude && filter.methods.exclude.length > 0) {
        args.push('--filter-methods-exclude', filter.methods.exclude.join(','));
      }
      
      // 添加路径过滤
      if (filter.paths?.include && filter.paths.include.length > 0) {
        args.push('--filter-paths-include', filter.paths.include.join(','));
      }
      if (filter.paths?.exclude && filter.paths.exclude.length > 0) {
        args.push('--filter-paths-exclude', filter.paths.exclude.join(','));
      }
    }

    // 文件监控
    if (await configManager.get('watchFiles')) {
      args.push('--watch');
    }

    return args;
  }

  /**
   * 设置进程监控
   */
  private setupProcessMonitoring(serverId: string, process: ChildProcess): void {
    const serverStatus = this.runningServers.get(serverId);
    if (!serverStatus) return;

    // 监听标准输出
    process.stdout?.on('data', (data) => {
      const log = data.toString().trim();
      this.addLog(serverId, `[OUT] ${log}`);
      
      // 解析请求日志
      if (log.includes('Request:') || log.includes('GET') || log.includes('POST')) {
        if (serverStatus.stats) {
          serverStatus.stats.requests++;
          serverStatus.stats.lastRequest = new Date();
        }
      }
    });

    // 监听标准错误
    process.stderr?.on('data', (data) => {
      const log = data.toString().trim();
      this.addLog(serverId, `[ERR] ${this.chalk?.red(log) || log}`);
      
      if (serverStatus.stats) {
        serverStatus.stats.errors++;
        serverStatus.stats.lastError = new Date();
      }
    });

    // 监听进程退出
    process.on('exit', (code, signal) => {
      this.addLog(serverId, `[SYS] 进程退出: code=${code}, signal=${signal}`);
      
      if (serverStatus.isRunning) {
        serverStatus.isRunning = false;
        this.emit('serverCrashed', { serverId, config: serverStatus.config, code, signal });
      }
    });

    // 监听进程错误
    process.on('error', (error) => {
      this.addLog(serverId, `[SYS] 进程错误: ${error.message}`);
      
      if (serverStatus.stats) {
        serverStatus.stats.errors++;
        serverStatus.stats.lastError = new Date();
      }
      
      this.emit('serverError', { serverId, config: serverStatus.config, error });
    });
  }

  /**
   * 开始统计跟踪
   */
  private startStatsTracking(serverId: string): void {
    const interval = setInterval(() => {
      const serverStatus = this.runningServers.get(serverId);
      
      if (!serverStatus || !serverStatus.isRunning || !serverStatus.stats) {
        clearInterval(interval);
        return;
      }

      // 更新运行时间
      const now = new Date();
      serverStatus.stats.uptime = Math.floor((now.getTime() - serverStatus.stats.startTime.getTime()) / 1000);
    }, 1000);
  }

  /**
   * 添加日志
   */
  private addLog(serverId: string, message: string): void {
    const logs = this.logBuffer.get(serverId) || [];
    const timestamp = new Date().toISOString();
    logs.push(`[${timestamp}] ${message}`);
    
    // 限制日志行数
    if (logs.length > this.maxLogLines) {
      logs.splice(0, logs.length - this.maxLogLines);
    }
    
    this.logBuffer.set(serverId, logs);
    this.emit('serverLog', { serverId, message });
  }

  /**
   * 设置进程处理器
   */
  private setupProcessHandlers(): void {
    // 优雅关闭
    const gracefulShutdown = async () => {
      await this.initModules();
      console.log(this.chalk?.yellow('\n正在关闭所有服务器...') || '\n正在关闭所有服务器...');
      await this.stopAllServers();
      process.exit(0);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
    // 处理未捕获的异常
    process.on('uncaughtException', async (error) => {
      await this.initModules();
      console.error(this.chalk?.red('未捕获的异常:') || '未捕获的异常:', error);
      gracefulShutdown();
    });

    process.on('unhandledRejection', async (reason) => {
      await this.initModules();
      console.error(this.chalk?.red('未处理的 Promise 拒绝:') || '未处理的 Promise 拒绝:', reason);
      gracefulShutdown();
    });
  }
}

// 单例实例
export const serverManager = new ServerManager();