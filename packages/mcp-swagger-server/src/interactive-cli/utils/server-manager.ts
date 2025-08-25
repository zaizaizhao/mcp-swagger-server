import { EventEmitter } from 'events';
import { SessionConfig, OperationFilter } from '../types/index';
import { configManager } from './config-manager';
import chalk from 'chalk';
import { runStdioServer, runSseServer, runStreamableServer } from '../../server';
import { AuthConfig } from 'mcp-swagger-parser';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

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
  serverPromise?: Promise<void>;
  abortController?: AbortController;
}

export class ServerManager extends EventEmitter {
  private runningServers: Map<string, ServerStatus> = new Map();
  private logBuffer: Map<string, string[]> = new Map();
  private maxLogLines: number = 1000;
  private debugMode: boolean = false;
  private chalk = chalk;

  constructor() {
    super();
    this.setupProcessHandlers();
    this.initDebugMode();
  }

  /**
   * 初始化调试模式
   */
  private async initDebugMode(): Promise<void> {
    this.debugMode = await configManager.get('debugMode') || false;
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
      const { serverPromise, abortController } = await this.startServerProcess(config);
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
        serverPromise,
        abortController
      };

      this.runningServers.set(serverId, serverStatus);
      this.logBuffer.set(serverId, []);
      this.setupServerMonitoring(serverId, serverPromise, abortController);
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
      if (serverStatus.abortController) {
        serverStatus.abortController.abort();
      }
      
      // 等待服务器停止
      if (serverStatus.serverPromise) {
        try {
          await Promise.race([
            serverStatus.serverPromise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('服务器停止超时')), 5000)
            )
          ]);
        } catch (error) {
          // 忽略由于abort导致的错误
          if (error instanceof Error && !error.message.includes('abort')) {
            console.warn('服务器停止时出现错误:', error.message);
          }
        }
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
  private async startServerProcess(config: SessionConfig): Promise<{ serverPromise: Promise<void>; abortController: AbortController }> {
    const abortController = new AbortController();
    
    // 加载OpenAPI数据
    let openApiData = null;
    if (config.openApiUrl) {
      try {
        if (this.isUrl(config.openApiUrl)) {
          const response = await axios.get(config.openApiUrl);
          openApiData = response.data;
        } else {
          // 本地文件处理
          const filePath = path.resolve(config.openApiUrl);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          openApiData = JSON.parse(fileContent);
        }
      } catch (error) {
        throw new Error(`加载OpenAPI数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }

    // 构建认证配置
    const authConfig: AuthConfig = {
      type: config.auth?.type || 'none',
      ...(config.auth?.type === 'bearer' && config.auth.token ? {
        bearer: {
          source: 'static',
          token: config.auth.token
        }
      } : {})
    };

    // 构建操作过滤器 - 优先使用接口选择配置中的过滤器
    const operationFilter = config.interfaceSelection?.operationFilter || config.operationFilter;

    // 调试输出：显示传递给服务器的operationFilter
    console.log(`\n[DEBUG] 服务器启动配置:`);
    console.log(`- 配置名称: ${config.name}`);
    console.log(`- 传输协议: ${config.transport}`);
    console.log(`- 是否有接口选择配置: ${config.interfaceSelection ? 'Yes' : 'No'}`);
    if (config.interfaceSelection?.operationFilter) {
      console.log(`- 使用接口选择中的operationFilter`);
      console.log(`- operationFilter详情:`, JSON.stringify(config.interfaceSelection.operationFilter, null, 2));
    } else if (config.operationFilter) {
      console.log(`- 使用默认operationFilter`);
      console.log(`- operationFilter详情:`, JSON.stringify(config.operationFilter, null, 2));
    } else {
      console.log(`- 未设置operationFilter，将转换所有接口`);
    }

    // 启动对应的服务器
    let serverPromise: Promise<void>;
    
    switch (config.transport.toLowerCase()) {
      case 'stdio':
        serverPromise = runStdioServer(
          openApiData,
          authConfig,
          config.customHeaders,
          this.debugMode,
          operationFilter
        );
        break;
      case 'sse':
        const ssePort = config.port || 3322;
        serverPromise = runSseServer(
          '/sse',
          ssePort,
          openApiData,
          authConfig,
          config.customHeaders,
          this.debugMode,
          operationFilter
        );
        break;
      case 'streamable':
        const streamPort = config.port || 3322;
        serverPromise = runStreamableServer(
          '/mcp',
          streamPort,
          openApiData,
          authConfig,
          config.customHeaders,
          this.debugMode,
          operationFilter
        );
        break;
      default:
        throw new Error(`不支持的传输协议: ${config.transport}`);
    }

    return { serverPromise, abortController };
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
   * 设置服务器监控
   */
  private setupServerMonitoring(serverId: string, serverPromise: Promise<void>, abortController: AbortController): void {
    const serverStatus = this.runningServers.get(serverId);
    if (!serverStatus) return;

    // 监控服务器Promise状态
    serverPromise
      .then(() => {
        const message = `服务器 ${serverId} 正常结束`;
        this.addLog(serverId, `[SYS] ${message}`);
        
        if (serverStatus) {
          serverStatus.isRunning = false;
        }
        
        this.emit('serverStopped', { serverId, config: serverStatus.config });
      })
      .catch((error: Error) => {
        const errorMessage = `服务器 ${serverId} 错误: ${error.message}`;
        this.addLog(serverId, `[ERR] ${this.chalk.red(errorMessage)}`);
        
        if (serverStatus) {
          serverStatus.isRunning = false;
          if (serverStatus.stats) {
            serverStatus.stats.errors++;
            serverStatus.stats.lastError = new Date();
          }
        }
        
        this.emit('serverError', { serverId, config: serverStatus.config, error });
      });

    // 监听abort信号
    abortController.signal.addEventListener('abort', () => {
      const message = `服务器 ${serverId} 被手动停止`;
      this.addLog(serverId, `[SYS] ${message}`);
      
      if (serverStatus) {
        serverStatus.isRunning = false;
      }
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
      console.log(this.chalk.yellow('\n正在关闭所有服务器...'));
      await this.stopAllServers();
      process.exit(0);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
    // 处理未捕获的异常
    process.on('uncaughtException', async (error) => {
      console.error(this.chalk.red('未捕获的异常:'), error);
      gracefulShutdown();
    });

    process.on('unhandledRejection', async (reason) => {
      console.error(this.chalk.red('未处理的 Promise 拒绝:'), reason);
      gracefulShutdown();
    });
  }
}

// 单例实例
export const serverManager = new ServerManager();