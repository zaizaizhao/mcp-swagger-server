import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface RestartConfig {
  // 重启策略
  maxRetries: number;           // 最大重试次数
  retryDelay: number;          // 重试延迟（毫秒）
  backoffMultiplier: number;   // 退避乘数
  maxRetryDelay: number;       // 最大重试延迟
  
  // 健康检查
  healthCheckInterval: number; // 健康检查间隔
  healthCheckTimeout: number;  // 健康检查超时
  
  // 重启触发条件
  autoRestart: boolean;        // 是否自动重启
  restartOnError: boolean;     // 错误时重启
  restartOnExit: boolean;      // 退出时重启
  restartOnMemoryLimit: number; // 内存限制重启（MB）
  
  // 日志配置
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logToFile: boolean;
  logFilePath?: string;
}

export interface ServerStats {
  startTime: Date;
  restartCount: number;
  lastRestartTime?: Date;
  lastRestartReason?: string;
  isRunning: boolean;
  processId?: number;
  memoryUsage?: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
}

export class MCPServerManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: RestartConfig;
  private stats: ServerStats;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private restartPromise: Promise<void> | null = null;
  private isShuttingDown = false;
  
  // PID 文件路径
  private pidFilePath: string;
  private statsFilePath: string;

  constructor(
    private serverScript: string,
    private serverArgs: string[] = [],
    config: Partial<RestartConfig> = {}
  ) {
    super();
    
    // 默认配置
    this.config = {
      maxRetries: 5,
      retryDelay: 1000,
      backoffMultiplier: 1.5,
      maxRetryDelay: 30000,
      healthCheckInterval: 30000,
      healthCheckTimeout: 5000,
      autoRestart: true,
      restartOnError: true,
      restartOnExit: true,
      restartOnMemoryLimit: 512, // 512MB
      logLevel: 'info',
      logToFile: true,
      logFilePath: join(process.cwd(), 'mcp-server.log'),
      ...config
    };

    // 初始化统计信息
    this.stats = {
      startTime: new Date(),
      restartCount: 0,
      isRunning: false
    };

    // 文件路径
    this.pidFilePath = join(process.cwd(), 'mcp-server.pid');
    this.statsFilePath = join(process.cwd(), 'mcp-server-stats.json');
    
    // 加载之前的统计信息
    this.loadStats();
    
    // 设置进程退出处理
    this.setupExitHandlers();
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.log('warn', '服务器已经在运行中');
      return;
    }

    this.log('info', `启动 MCP 服务器: ${this.serverScript} ${this.serverArgs.join(' ')}`);

    try {
      this.process = spawn('node', [this.serverScript, ...this.serverArgs], {
        stdio: ['pipe', 'pipe', 'pipe'], //父子进程的标准输入、输出、错误都通过管道连接（可读写流）
        env: { ...process.env, MCP_MANAGED: 'true' }, //继承父进程环境变量，并额外加上 MCP_MANAGED 标记
        detached: false //子进程不会脱离父进程，父进程退出时子进程也会被终止
      }); 

      if (!this.process.pid) {
        throw new Error('无法获取进程 PID');
      }

      // 更新状态
      this.stats.isRunning = true;
      this.stats.processId = this.process.pid;
      this.stats.startTime = new Date();
      this.saveStats();
      this.savePidFile();

      // 设置进程事件监听
      this.setupProcessHandlers();
      
      // 启动健康检查
      if (this.config.healthCheckInterval > 0) {
        this.startHealthCheck();
      }

      this.emit('started', this.stats);
      this.log('info', `服务器已启动，PID: ${this.process.pid}`);

    } catch (error) {
      this.log('error', `启动服务器失败: ${error}`);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 停止服务器
   */
  async stop(force = false): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (!this.process || this.process.killed) {
      this.log('warn', '服务器已经停止');
      return;
    }

    this.log('info', `停止服务器 (PID: ${this.process.pid})`);

    return new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.log('warn', '强制终止服务器进程');
          this.process.kill('SIGKILL');
        }
      }, force ? 1000 : 5000);

      this.process.once('exit', () => {
        clearTimeout(timeout);
        this.stats.isRunning = false;
        this.stats.processId = undefined;
        this.saveStats();
        this.removePidFile();
        this.emit('stopped');
        resolve();
      });

      // 优雅关闭
      this.process.kill('SIGTERM');
    });
  }

  /**
   * 重启服务器
   */
  async restart(reason = '手动重启'): Promise<void> {
    if (this.restartPromise) {
      this.log('info', '重启已在进行中，等待完成...');
      return this.restartPromise;
    }

    this.restartPromise = this.performRestart(reason);
    
    try {
      await this.restartPromise;
    } finally {
      this.restartPromise = null;
    }
  }

  /**
   * 执行重启
   */
  private async performRestart(reason: string): Promise<void> {
    this.log('info', `重启服务器，原因: ${reason}`);
    
    this.stats.restartCount++;
    this.stats.lastRestartTime = new Date();
    this.stats.lastRestartReason = reason;
    
    // 停止当前服务器
    await this.stop();
    
    // 计算重试延迟
    const delay = Math.min(
      this.config.retryDelay * Math.pow(this.config.backoffMultiplier, this.stats.restartCount - 1),
      this.config.maxRetryDelay
    );
    
    this.log('info', `等待 ${delay}ms 后重启...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // 启动新服务器
    await this.start();
    
    this.emit('restarted', { reason, restartCount: this.stats.restartCount });
  }

  /**
   * 设置进程事件处理
   */
  private setupProcessHandlers(): void {
    if (!this.process) return;

    // 进程退出处理
    this.process.on('exit', (code, signal) => {
      this.log('warn', `服务器进程退出，代码: ${code}, 信号: ${signal}`);
      this.stats.isRunning = false;
      this.stats.processId = undefined;
      this.saveStats();
      this.removePidFile();

      if (!this.isShuttingDown && this.config.autoRestart && this.config.restartOnExit) {
        if (this.stats.restartCount < this.config.maxRetries) {
          this.restart(`进程退出 (${code}/${signal})`);
        } else {
          this.log('error', '达到最大重试次数，停止自动重启');
          this.emit('maxRetriesReached');
        }
      }
    });

    // 错误处理
    this.process.on('error', (error) => {
      this.log('error', `服务器进程错误: ${error}`);
      this.emit('processError', error);

      if (!this.isShuttingDown && this.config.autoRestart && this.config.restartOnError) {
        if (this.stats.restartCount < this.config.maxRetries) {
          this.restart(`进程错误: ${error.message}`);
        } else {
          this.log('error', '达到最大重试次数，停止自动重启');
          this.emit('maxRetriesReached');
        }
      }
    });

    // 输出处理
    if (this.process.stdout) {
      this.process.stdout.on('data', (data) => {
        this.log('debug', `STDOUT: ${data.toString().trim()}`);
      });
    }

    if (this.process.stderr) {
      this.process.stderr.on('data', (data) => {
        this.log('debug', `STDERR: ${data.toString().trim()}`);
      });
    }
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      if (!this.process || this.process.killed) {
        return;
      }

      try {
        // 检查进程是否还存在
        process.kill(this.process.pid!, 0);
        
        // 检查内存使用
        const memUsage = process.memoryUsage();
        this.stats.memoryUsage = memUsage;
        
        const memoryMB = memUsage.rss / 1024 / 1024;
        if (memoryMB > this.config.restartOnMemoryLimit) {
          this.log('warn', `内存使用超限: ${memoryMB.toFixed(2)}MB > ${this.config.restartOnMemoryLimit}MB`);
          this.restart(`内存使用超限: ${memoryMB.toFixed(2)}MB`);
          return;
        }

        this.emit('healthCheck', { memoryMB, isHealthy: true });
        
      } catch (error) {
        this.log('error', `健康检查失败: ${error}`);
        if (this.config.autoRestart) {
          this.restart('健康检查失败');
        }
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * 获取服务器状态
   */
  getStats(): ServerStats {
    return { ...this.stats };
  }

  /**
   * 获取配置
   */
  getConfig(): RestartConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<RestartConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.log('info', '配置已更新');
    this.emit('configUpdated', this.config);
  }

  /**
   * 保存统计信息
   */
  private saveStats(): void {
    try {
      writeFileSync(this.statsFilePath, JSON.stringify(this.stats, null, 2));
    } catch (error) {
      this.log('error', `保存统计信息失败: ${error}`);
    }
  }

  /**
   * 加载统计信息
   */
  private loadStats(): void {
    try {
      if (existsSync(this.statsFilePath)) {
        const data = readFileSync(this.statsFilePath, 'utf8');
        const savedStats = JSON.parse(data);
        this.stats = {
          ...this.stats,
          ...savedStats,
          startTime: new Date(savedStats.startTime),
          lastRestartTime: savedStats.lastRestartTime ? new Date(savedStats.lastRestartTime) : undefined
        };
      }
    } catch (error) {
      this.log('error', `加载统计信息失败: ${error}`);
    }
  }

  /**
   * 保存 PID 文件
   */
  private savePidFile(): void {
    if (this.process && this.process.pid) {
      try {
        writeFileSync(this.pidFilePath, this.process.pid.toString());
      } catch (error) {
        this.log('error', `保存 PID 文件失败: ${error}`);
      }
    }
  }

  /**
   * 删除 PID 文件
   */
  private removePidFile(): void {
    try {
      if (existsSync(this.pidFilePath)) {
        require('fs').unlinkSync(this.pidFilePath);
      }
    } catch (error) {
      this.log('error', `删除 PID 文件失败: ${error}`);
    }
  }

  /**
   * 设置退出处理
   */
  private setupExitHandlers(): void {
    const cleanup = async () => {
      this.log('info', '正在关闭服务器管理器...');
      this.isShuttingDown = true;
      await this.stop(true);
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('uncaughtException', (error) => {
      this.log('error', `未捕获的异常: ${error}`);
      cleanup();
    });
  }

  /**
   * 日志记录
   */
  private log(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    // 控制台输出
    if (this.shouldLog(level)) {
      console.log(logMessage);
    }
    
    // 文件输出
    if (this.config.logToFile && this.config.logFilePath) {
      try {
        require('fs').appendFileSync(this.config.logFilePath, logMessage + '\n');
      } catch (error) {
        console.error('写入日志文件失败:', error);
      }
    }
  }

  /**
   * 判断是否应该记录日志
   */
  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }
}

export default MCPServerManager;
