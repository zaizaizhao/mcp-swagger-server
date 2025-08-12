import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ProcessInfoEntity } from '../entities/process-info.entity';
import { ProcessLogEntity } from '../entities/process-log.entity';
import {
  ProcessConfig,
  ProcessInfo,
  ProcessStatus,
  ProcessEvent,
  ProcessManagerConfig,
  DEFAULT_PROCESS_CONFIG,
  LogLevel
} from '../interfaces/process.interface';
import { ProcessResourceMonitorService, ProcessResourceMetrics, SystemResourceInfo } from './process-resource-monitor.service';
import { ProcessLogMonitorService, ProcessLogEntry } from './process-log-monitor.service';

@Injectable()
export class ProcessManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(ProcessManagerService.name);
  private readonly processes = new Map<string, ChildProcess>();
  private readonly processInfo = new Map<string, ProcessInfo>();
  private readonly config: ProcessManagerConfig;
  private readonly execAsync = promisify(exec);

  constructor(
    @InjectRepository(ProcessInfoEntity)
    private readonly processInfoRepository: Repository<ProcessInfoEntity>,
    @InjectRepository(ProcessLogEntity)
    private readonly processLogRepository: Repository<ProcessLogEntity>,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly resourceMonitor: ProcessResourceMonitorService,
    private readonly logMonitor: ProcessLogMonitorService,
  ) {
    this.config = {
      ...DEFAULT_PROCESS_CONFIG,
      processTimeout: this.configService.get<number>('PROCESS_TIMEOUT', DEFAULT_PROCESS_CONFIG.processTimeout),
      defaultMaxRetries: this.configService.get<number>('PROCESS_MAX_RETRIES', DEFAULT_PROCESS_CONFIG.defaultMaxRetries),
      defaultRestartDelay: this.configService.get<number>('PROCESS_RESTART_DELAY', DEFAULT_PROCESS_CONFIG.defaultRestartDelay),
      healthCheckInterval: this.configService.get<number>('HEALTH_CHECK_INTERVAL', DEFAULT_PROCESS_CONFIG.healthCheckInterval),
      pidDirectory: this.configService.get<string>('PID_DIRECTORY', DEFAULT_PROCESS_CONFIG.pidDirectory),
      logDirectory: this.configService.get<string>('LOG_DIRECTORY', DEFAULT_PROCESS_CONFIG.logDirectory),
    };

    this.ensureDirectories();
    this.setupEventListeners();
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down all processes...');
    const shutdownPromises = Array.from(this.processes.keys()).map(serverId => 
      this.stopProcess(serverId, true)
    );
    await Promise.allSettled(shutdownPromises);
  }

  /**
   * 启动进程（支持CLI spawn）
   */
  async startProcess(config: ProcessConfig): Promise<ProcessInfo> {
    const { id: serverId } = config;
    
    // 检查进程是否已经在运行
    if (this.processes.has(serverId)) {
      const existingInfo = this.processInfo.get(serverId);
      if (existingInfo && existingInfo.status === ProcessStatus.RUNNING) {
        throw new Error(`Process for server ${serverId} is already running`);
      }
    }

    this.logger.log(`Starting process for server: ${serverId} using ${config.scriptPath}`);
    await this.logProcess(serverId, LogLevel.INFO, `Starting process for server: ${config.name}`);

    try {
      // 更新状态为启动中
      await this.updateProcessStatus(serverId, ProcessStatus.STARTING);
      console.log('config', config);
      
      // 创建子进程 - 支持CLI可执行文件
      const childProcess = spawn(config.scriptPath, config.args, {
        cwd: config.cwd || process.cwd(),
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
        shell: process.platform === 'win32', // Windows需要shell
      });

      if (!childProcess.pid) {
        throw new Error('Failed to start process - no PID assigned');
      }

      // 创建进程信息
      const processInfo: ProcessInfo = {
        id: serverId,
        name: config.name,
        pid: childProcess.pid,
        startTime: new Date(),
        status: ProcessStatus.RUNNING,
        restartCount: 0,
        updatedAt: new Date(),
        config,
        process: childProcess,
      };

      // 存储进程引用和信息
      this.processes.set(serverId, childProcess);
      this.processInfo.set(serverId, processInfo);

      // 设置进程事件监听
      this.setupProcessListeners(serverId, childProcess, config);

      // 启动资源监控
      this.resourceMonitor.startMonitoring(
        serverId, 
        childProcess.pid, 
        10000 // 10秒间隔
      );

      // 启动日志监控
      this.logMonitor.startLogMonitoring(
        serverId,
        childProcess.pid,
        config.logFilePath
      );

      // 监控子进程输出
      this.setupProcessOutputMonitoring(processInfo);

      // 手动触发一个测试日志以验证logProcess方法
      await this.logProcess(serverId, LogLevel.INFO, `Process monitoring started for ${config.name} (PID: ${childProcess.pid})`);
      this.logger.log(`[TEST] Manual log triggered for server ${serverId}`);

      // 保存到数据库
      await this.saveProcessInfo(processInfo);

      // 写入PID文件
      await this.writePidFile(serverId, childProcess.pid);

      // 发送启动事件
      const event: ProcessEvent = {
        processId: serverId,
        eventType: 'started',
        timestamp: new Date(),
        data: { 
          pid: childProcess.pid,
          scriptPath: config.scriptPath,
          args: config.args,
          transport: config.mcpConfig?.transport
        }
      };
      this.eventEmitter.emit('process.started', event);

      this.logger.log(`Process started successfully for server ${serverId} with PID ${childProcess.pid}`);
      await this.logProcess(serverId, LogLevel.INFO, `Process started with PID ${childProcess.pid}`);

      return processInfo;
    } catch (error) {
      this.logger.error(`Failed to start process for server ${serverId}:`, error);
      await this.logProcess(serverId, LogLevel.ERROR, `Failed to start process: ${error.message}`);
      await this.updateProcessStatus(serverId, ProcessStatus.ERROR, error.message);
      throw error;
    }
  }

  /**
   * 停止进程
   */
  async stopProcess(serverId: string, force = false): Promise<void> {
    const childProcess = this.processes.get(serverId);
    const processInfo = this.processInfo.get(serverId);

    if (!childProcess || !processInfo) {
      this.logger.warn(`No running process found for server ${serverId}`);
      return;
    }

    this.logger.log(`Stopping process for server ${serverId} (PID: ${processInfo.pid})`);
    await this.logProcess(serverId, LogLevel.INFO, `Stopping process (PID: ${processInfo.pid})`);

    try {
      // 停止监控
      this.resourceMonitor.stopMonitoring(serverId);
      this.logMonitor.stopLogMonitoring(serverId);
      
      // 更新状态为停止中
      await this.updateProcessStatus(serverId, ProcessStatus.STOPPING);
      
      // 根据平台选择不同的进程终止方式
      if (process.platform === 'win32') {
        // Windows平台使用taskkill命令
        await this.stopProcessOnWindows(serverId, processInfo.pid, force);
      } else {
        // Unix/Linux平台使用信号机制
        await this.stopProcessOnUnix(serverId, childProcess, force);
      }

      // 清理资源
      await this.cleanupProcess(serverId);

      this.logger.log(`Process stopped successfully for server ${serverId}`);
      await this.logProcess(serverId, LogLevel.INFO, 'Process stopped successfully');
    } catch (error) {
      this.logger.error(`Failed to stop process for server ${serverId}:`, error);
      await this.logProcess(serverId, LogLevel.ERROR, `Failed to stop process: ${error.message}`);
      throw error;
    }
  }

  /**
   * Windows平台停止进程
   */
  private async stopProcessOnWindows(serverId: string, pid: number, force: boolean): Promise<void> {
    try {
      if (!force) {
        // 尝试优雅关闭 - 使用taskkill不带/f参数
        this.logger.log(`Attempting graceful shutdown for process ${pid} on Windows`);
        await this.logProcess(serverId, LogLevel.INFO, `Attempting graceful shutdown using taskkill`);
        
        try {
          await this.execAsync(`taskkill /pid ${pid} /t`);
          
          // 等待进程关闭，如果超时则强制终止
          const checkInterval = 500; // 每500ms检查一次
          const maxWaitTime = this.config.processTimeout;
          let waitedTime = 0;
          
          while (waitedTime < maxWaitTime) {
            try {
              // 检查进程是否还存在
              await this.execAsync(`tasklist /fi "PID eq ${pid}" | findstr ${pid}`);
              // 如果没有抛出异常，说明进程还存在
              await new Promise(resolve => setTimeout(resolve, checkInterval));
              waitedTime += checkInterval;
            } catch {
              // 进程已经不存在了
              this.logger.log(`Process ${pid} terminated gracefully`);
              await this.logProcess(serverId, LogLevel.INFO, 'Process terminated gracefully');
              return;
            }
          }
          
          // 超时，强制终止
          this.logger.warn(`Process ${pid} did not shut down gracefully, forcing termination`);
          await this.logProcess(serverId, LogLevel.WARN, 'Graceful shutdown timeout, forcing termination');
          await this.execAsync(`taskkill /pid ${pid} /t /f`);
        } catch (error) {
          this.logger.warn(`Graceful shutdown failed for process ${pid}, forcing termination:`, error);
          await this.logProcess(serverId, LogLevel.WARN, `Graceful shutdown failed: ${error.message}`);
          await this.execAsync(`taskkill /pid ${pid} /t /f`);
        }
      } else {
        // 强制终止
        this.logger.log(`Force terminating process ${pid} on Windows`);
        await this.logProcess(serverId, LogLevel.INFO, `Force terminating process using taskkill /f`);
        await this.execAsync(`taskkill /pid ${pid} /t /f`);
      }
    } catch (error) {
      this.logger.error(`Failed to terminate process ${pid} on Windows:`, error);
      await this.logProcess(serverId, LogLevel.ERROR, `Failed to terminate process: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unix/Linux平台停止进程
   */
  private async stopProcessOnUnix(serverId: string, childProcess: ChildProcess, force: boolean): Promise<void> {
    try {
      if (!force) {
        // 尝试优雅关闭
        this.logger.log(`Attempting graceful shutdown using SIGTERM`);
        await this.logProcess(serverId, LogLevel.INFO, `Attempting graceful shutdown using SIGTERM`);
        
        childProcess.kill('SIGTERM');
        
        // 等待进程优雅关闭
        const gracefulShutdown = new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            this.logger.warn(`Process ${serverId} did not shut down gracefully, forcing termination`);
            childProcess.kill('SIGKILL');
            resolve();
          }, this.config.processTimeout);

          childProcess.once('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });

        await gracefulShutdown;
      } else {
        // 强制终止
        this.logger.log(`Force terminating process using SIGKILL`);
        await this.logProcess(serverId, LogLevel.INFO, `Force terminating process using SIGKILL`);
        childProcess.kill('SIGKILL');
      }
    } catch (error) {
      this.logger.error(`Failed to terminate process on Unix/Linux:`, error);
      await this.logProcess(serverId, LogLevel.ERROR, `Failed to terminate process: ${error.message}`);
      throw error;
    }
  }

  /**
   * 重启进程
   */
  async restartProcess(serverId: string, config: ProcessConfig): Promise<ProcessInfo> {
    this.logger.log(`Restarting process for server ${serverId}`);
    await this.logProcess(serverId, LogLevel.INFO, 'Restarting process');

    try {
      // 先停止现有进程
      if (this.processes.has(serverId)) {
        await this.stopProcess(serverId);
      }

      // 等待一段时间后重新启动
      await new Promise(resolve => setTimeout(resolve, this.config.defaultRestartDelay));

      // 增加重启计数
      const existingInfo = this.processInfo.get(serverId);
      const restartCount = existingInfo ? existingInfo.restartCount + 1 : 1;

      // 启动新进程
      const processInfo = await this.startProcess(config);
      processInfo.restartCount = restartCount;

      // 更新数据库
      await this.saveProcessInfo(processInfo);

      return processInfo;
    } catch (error) {
      this.logger.error(`Failed to restart process for server ${serverId}:`, error);
      await this.logProcess(serverId, LogLevel.ERROR, `Failed to restart process: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取进程信息
   */
  getProcessInfo(serverId: string): ProcessInfo | undefined {
    return this.processInfo.get(serverId);
  }

  /**
   * 获取所有进程信息
   */
  getAllProcessInfo(): ProcessInfo[] {
    return Array.from(this.processInfo.values());
  }

  /**
   * 检查进程是否运行
   */
  isProcessRunning(serverId: string): boolean {
    const processInfo = this.processInfo.get(serverId);
    return processInfo?.status === ProcessStatus.RUNNING;
  }

  /**
   * 获取进程指标（CLI spawn模式）
   */
  async getProcessMetrics(serverId: string): Promise<{ memoryUsage?: any; cpuUsage?: any } | null> {
    const processInfo = this.processInfo.get(serverId);
    if (!processInfo || !processInfo.process) {
      return null;
    }

    try {
      // 使用新的资源监控服务获取真实的进程指标
      const resourceMetrics = await this.resourceMonitor.getProcessResourceMetrics(processInfo.pid);
      if (resourceMetrics) {
        return {
          memoryUsage: { rss: resourceMetrics.memory },
          cpuUsage: { user: resourceMetrics.cpu }
        };
      }
      
      // 回退到原有实现
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      return {
        memoryUsage,
        cpuUsage
      };
    } catch (error) {
      this.logger.error(`Failed to get process metrics for ${serverId}:`, error);
      return null;
    }
  }

  /**
   * 获取进程完整信息（改进版）
   */
  async getProcessFullInfo(serverId: string): Promise<{
    basicInfo: ProcessInfo;
    resourceMetrics: ProcessResourceMetrics | null;
    systemInfo: SystemResourceInfo;
    resourceHistory: ProcessResourceMetrics[];
    recentLogs: ProcessLogEntry[];
  } | null> {
    const basicInfo = this.getProcessInfo(serverId);
    if (!basicInfo) {
      return null;
    }
    
    const [resourceMetrics, systemInfo, resourceHistory, recentLogs] = await Promise.all([
      this.resourceMonitor.getProcessResourceMetrics(basicInfo.pid),
      Promise.resolve(this.resourceMonitor.getSystemResourceInfo()),
      Promise.resolve(this.resourceMonitor.getResourceHistory(serverId, 100)),
      Promise.resolve(this.logMonitor.getLogHistory(serverId, 50))
    ]);
    
    return {
      basicInfo,
      resourceMetrics,
      systemInfo,
      resourceHistory,
      recentLogs
    };
  }

  /**
   * 监控进程输出
   */
  private setupProcessOutputMonitoring(processInfo: ProcessInfo): void {
    const { id: serverId, pid, process: childProcess } = processInfo;
    
    // 监控标准输出
    if (childProcess.stdout) {
      childProcess.stdout.on('data', async (data: Buffer) => {
        const message = data.toString().trim();
        if (message) {
          // 添加到日志监控器
          const logEntry: ProcessLogEntry = {
            serverId,
            pid,
            timestamp: new Date(),
            level: 'stdout',
            source: 'process',
            message
          };
          this.logMonitor.addLogEntry(serverId, logEntry);
          
          // 同时调用logProcess方法以触发WebSocket事件
          await this.logProcess(serverId, LogLevel.INFO, `STDOUT: ${message}`);
        }
      });
    }
    
    // 监控标准错误
    if (childProcess.stderr) {
      childProcess.stderr.on('data', async (data: Buffer) => {
        const message = data.toString().trim();
        if (message) {
          // 添加到日志监控器
          const logEntry: ProcessLogEntry = {
            serverId,
            pid,
            timestamp: new Date(),
            level: 'stderr',
            source: 'process',
            message
          };
          this.logMonitor.addLogEntry(serverId, logEntry);
          
          // 同时调用logProcess方法以触发WebSocket事件
          await this.logProcess(serverId, LogLevel.ERROR, `STDERR: ${message}`);
        }
      });
    }
  }

  /**
   * 设置进程事件监听
   */
  private setupProcessListeners(serverId: string, childProcess: ChildProcess, config: ProcessConfig): void {
    // 监听进程退出
    childProcess.on('exit', async (code, signal) => {
      this.logger.log(`Process ${serverId} exited with code ${code} and signal ${signal}`);
      await this.logProcess(serverId, LogLevel.INFO, `Process exited with code ${code} and signal ${signal}`);
      
      const processInfo = this.processInfo.get(serverId);
      if (processInfo) {
        processInfo.exitCode = code;
        processInfo.exitSignal = signal;
      }
      
      const event: ProcessEvent = {
        processId: serverId,
        eventType: 'stopped',
        timestamp: new Date(),
        data: { code, signal }
      };
      this.eventEmitter.emit('process.stopped', event);

      await this.cleanupProcess(serverId);
    });

    // 监听进程错误
    childProcess.on('error', async (error) => {
      this.logger.error(`Process ${serverId} encountered an error:`, error);
      await this.logProcess(serverId, LogLevel.ERROR, `Process error: ${error.message}`);
      
      const event: ProcessEvent = {
        processId: serverId,
        eventType: 'error',
        timestamp: new Date(),
        data: { error: error.message }
      };
      this.eventEmitter.emit('process.error', event);

      await this.updateProcessStatus(serverId, ProcessStatus.ERROR, error.message);
    });

    // 监听标准输出
    if (childProcess.stdout) {
      childProcess.stdout.on('data', async (data) => {
        const message = data.toString().trim();
        if (message) {
          await this.logProcess(serverId, LogLevel.INFO, `STDOUT: ${message}`);
        }
      });
    }

    // 监听标准错误
    if (childProcess.stderr) {
      childProcess.stderr.on('data', async (data) => {
        const message = data.toString().trim();
        if (message) {
          await this.logProcess(serverId, LogLevel.ERROR, `STDERR: ${message}`);
        }
      });
    }
  }

  /**
   * 清理进程资源
   */
  private async cleanupProcess(serverId: string): Promise<void> {
    // 移除进程引用
    this.processes.delete(serverId);
    
    // 更新进程状态
    await this.updateProcessStatus(serverId, ProcessStatus.STOPPED);
    
    // 删除PID文件
    await this.deletePidFile(serverId);
  }

  /**
   * 更新进程状态
   */
  private async updateProcessStatus(serverId: string, status: ProcessStatus, error?: string): Promise<void> {
    const processInfo = this.processInfo.get(serverId);
    if (processInfo) {
      processInfo.status = status;
      processInfo.updatedAt = new Date();
      if (error) {
        processInfo.lastError = error;
      }
      await this.saveProcessInfo(processInfo);
    }
  }

  /**
   * 保存进程信息到数据库
   */
  private async saveProcessInfo(processInfo: ProcessInfo): Promise<void> {
    try {
      const entity = this.processInfoRepository.create({
        serverId: processInfo.id,
        pid: processInfo.pid,
        startTime: processInfo.startTime,
        status: processInfo.status,
        restartCount: processInfo.restartCount,
        lastError: processInfo.lastError,
        memoryUsage: processInfo.memoryUsage,
        cpuUsage: processInfo.cpuUsage,
        updatedAt: processInfo.updatedAt,
      });
      
      await this.processInfoRepository.save(entity);
      
      // 发射进程信息更新事件 - 使用WebSocket网关期望的数据结构
      this.eventEmitter.emit('process.info.updated', {
        serverId: processInfo.id,
        processInfo: {
          ...processInfo,
          // 构建包含基本信息的process对象
          process: {
            pid: processInfo.pid
          }
        },
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error(`Failed to save process info for ${processInfo.id}:`, error);
    }
  }

  /**
   * 记录进程日志
   */
  private async logProcess(serverId: string, level: LogLevel, message: string, metadata?: Record<string, any>): Promise<void> {
    // 添加调试日志：方法开始
    this.logger.debug(`[logProcess] Starting to log process for serverId: ${serverId}, level: ${level}, message: ${message}`);
    
    try {
      const logEntity = this.processLogRepository.create({
        serverId: serverId,
        level,
        message,
        metadata,
        timestamp: new Date(),
      });
      
      await this.processLogRepository.save(logEntity);
      
      // 添加调试日志：成功保存日志实体
      this.logger.debug(`[logProcess] Successfully saved log entity for serverId: ${serverId}, logId: ${logEntity.id}`);
      
      // 发射进程日志更新事件
      const eventData = {
        serverId: serverId,
        logData: {
          level,
          message,
          metadata,
          timestamp: logEntity.timestamp
        },
        timestamp: new Date()
      };
      
      this.eventEmitter.emit('process.logs.updated', eventData);
      
      // 添加调试日志：成功发射事件
      this.logger.debug(`[logProcess] Successfully emitted process.logs.updated event for serverId: ${serverId}`, eventData);
      
    } catch (error) {
      // 添加更详细的错误日志
      this.logger.error(`[logProcess] Failed to save process log for serverId: ${serverId}, level: ${level}, message: ${message}`, {
        error: error.message,
        stack: error.stack,
        serverId,
        level,
        message,
        metadata
      });
    }
  }

  /**
   * 写入PID文件
   */
  private async writePidFile(serverId: string, pid: number): Promise<void> {
    try {
      const pidFilePath = path.join(this.config.pidDirectory, `${serverId}.pid`);
      await fs.writeFile(pidFilePath, pid.toString());
    } catch (error) {
      this.logger.error(`Failed to write PID file for ${serverId}:`, error);
    }
  }

  /**
   * 删除PID文件
   */
  private async deletePidFile(serverId: string): Promise<void> {
    try {
      const pidFilePath = path.join(this.config.pidDirectory, `${serverId}.pid`);
      await fs.unlink(pidFilePath);
    } catch (error) {
      // 忽略文件不存在的错误
      if (error.code !== 'ENOENT') {
        this.logger.error(`Failed to delete PID file for ${serverId}:`, error);
      }
    }
  }

  /**
   * 确保必要的目录存在
   */
  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.config.pidDirectory, { recursive: true });
      await fs.mkdir(this.config.logDirectory, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create directories:', error);
    }
  }

  /**
    * 设置事件监听器
    */
   private setupEventListeners(): void {
     // 监听资源更新事件并转换为进程信息更新事件
     this.eventEmitter.on('process.resource_update', async (data: {
       serverId: string;
       metrics: ProcessResourceMetrics;
       timestamp: Date;
     }) => {
       const { serverId, metrics } = data;
       const processInfo = this.processInfo.get(serverId);
       
       if (processInfo) {
          // 更新进程信息中的资源使用情况
          // 注意：ProcessInfo中的memoryUsage和cpuUsage是NodeJS类型，这里我们将资源指标存储在其他字段中
          processInfo.updatedAt = new Date();
          
          // 如果需要存储简单的数值，可以添加到processInfo的其他字段或metadata中
          // 这里我们保持原有的NodeJS类型字段不变，资源数据通过事件传递
         
         // 获取系统资源信息
         const systemInfo = this.resourceMonitor.getSystemResourceInfo();
         
         // 构建完整的进程信息数据
         const fullProcessInfo = {
           ...processInfo,
           resourceMetrics: metrics,
           systemInfo,
           // 构建包含基本信息的process对象
           process: {
             pid: processInfo.pid
           }
         };
         
         // 发射进程信息更新事件
         this.eventEmitter.emit('process.info.updated', {
           serverId: serverId,
           processInfo: fullProcessInfo,
           timestamp: new Date()
         });
         
         // 直接保存到数据库，不发射额外事件
         try {
           const entity = this.processInfoRepository.create({
             serverId: processInfo.id,
             pid: processInfo.pid,
             startTime: processInfo.startTime,
             status: processInfo.status,
             restartCount: processInfo.restartCount,
             lastError: processInfo.lastError,
             memoryUsage: processInfo.memoryUsage,
             cpuUsage: processInfo.cpuUsage,
             updatedAt: processInfo.updatedAt,
           });
           
           await this.processInfoRepository.save(entity);
         } catch (error) {
           this.logger.error(`Failed to save process info for ${processInfo.id}:`, error);
         }
       }
     });
   }
}