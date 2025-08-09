import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { spawn, ChildProcess } from 'child_process';
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

@Injectable()
export class ProcessManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(ProcessManagerService.name);
  private readonly processes = new Map<string, ChildProcess>();
  private readonly processInfo = new Map<string, ProcessInfo>();
  private readonly config: ProcessManagerConfig;

  constructor(
    @InjectRepository(ProcessInfoEntity)
    private readonly processInfoRepository: Repository<ProcessInfoEntity>,
    @InjectRepository(ProcessLogEntity)
    private readonly processLogRepository: Repository<ProcessLogEntity>,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
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
      // 更新状态为停止中
      await this.updateProcessStatus(serverId, ProcessStatus.STOPPING);

      // 尝试优雅关闭
      if (!force) {
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
        childProcess.kill('SIGKILL');
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
      // 对于CLI spawn模式，我们需要通过其他方式获取进程指标
      // 这里返回基本的内存和CPU使用情况
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
    } catch (error) {
      this.logger.error(`Failed to save process info for ${processInfo.id}:`, error);
    }
  }

  /**
   * 记录进程日志
   */
  private async logProcess(serverId: string, level: LogLevel, message: string, metadata?: Record<string, any>): Promise<void> {
    try {
      const logEntity = this.processLogRepository.create({
        serverId: serverId,
        level,
        message,
        metadata,
        timestamp: new Date(),
      });
      
      await this.processLogRepository.save(logEntity);
    } catch (error) {
      this.logger.error(`Failed to save process log for ${serverId}:`, error);
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
}