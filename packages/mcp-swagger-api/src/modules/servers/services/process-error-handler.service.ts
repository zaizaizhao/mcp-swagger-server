import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { ProcessLogEntity } from '../entities/process-log.entity';
import { ProcessInfoEntity } from '../entities/process-info.entity';
import {
  ProcessErrorType,
  ProcessErrorEvent,
  RestartPolicyType,
  ProcessLog,
  ProcessConfig,
  LogLevel,
  ProcessManagerConfig,
  DEFAULT_PROCESS_CONFIG
} from '../interfaces/process.interface';
import { ProcessManagerService } from './process-manager.service';

@Injectable()
export class ProcessErrorHandlerService {
  private readonly logger = new Logger(ProcessErrorHandlerService.name);
  private readonly config: ProcessManagerConfig;
  private readonly restartAttempts = new Map<string, number>();
  private readonly restartTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectRepository(ProcessLogEntity)
    private readonly logRepository: Repository<ProcessLogEntity>,
    @InjectRepository(ProcessInfoEntity)
    private readonly processInfoRepository: Repository<ProcessInfoEntity>,
    private readonly processManager: ProcessManagerService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    this.config = {
      ...DEFAULT_PROCESS_CONFIG,
      maxRestartAttempts: this.configService.get<number>('MAX_RESTART_ATTEMPTS', DEFAULT_PROCESS_CONFIG.maxRestartAttempts),
      restartDelay: this.configService.get<number>('RESTART_DELAY', DEFAULT_PROCESS_CONFIG.restartDelay),
    };
  }

  /**
   * 处理进程错误
   */
  async handleProcessError(errorEvent: ProcessErrorEvent): Promise<void> {
    const { processId: serverId, errorType, error, timestamp } = errorEvent;
    
    this.logger.error(`Process error for server ${serverId}: ${errorType}`, error);

    // 记录错误日志
    await this.logError(serverId, errorType, error, timestamp);

    // 更新进程信息中的错误状态
    await this.updateProcessErrorInfo(serverId, error);

    // 根据错误类型和重启策略决定是否重启
    await this.handleRestartLogic(serverId, errorType, error);

    // 发送错误事件
    this.eventEmitter.emit('process.error_handled', {
      serverId,
      errorType,
      error: error.message,
      timestamp
    });
  }

  /**
   * 记录错误日志
   */
  private async logError(
    serverId: string,
    errorType: ProcessErrorType,
    error: Error,
    timestamp: Date
  ): Promise<void> {
    try {
      const logEntry: ProcessLog = {
        id: '', // 将由数据库生成
        processId: serverId,
        level: LogLevel.ERROR,
        message: `${errorType}: ${error.message}`,
        metadata: {
          errorType,
          stack: error.stack,
          timestamp: timestamp.toISOString()
        },
        timestamp
      };

      await this.saveLog(logEntry);
    } catch (logError) {
      this.logger.error(`Failed to log error for server ${serverId}:`, logError);
    }
  }

  /**
   * 更新进程错误信息
   */
  private async updateProcessErrorInfo(serverId: string, error: Error): Promise<void> {
    try {
      await this.processInfoRepository.update(
        { serverId },
        {
          lastError: error.message,
          updatedAt: new Date()
        }
      );
    } catch (updateError) {
      this.logger.error(`Failed to update process error info for ${serverId}:`, updateError);
    }
  }

  /**
   * 处理重启逻辑
   */
  private async handleRestartLogic(
    serverId: string,
    errorType: ProcessErrorType,
    error: Error
  ): Promise<void> {
    // 获取进程信息以确定重启策略
    const processInfo = this.processManager.getProcessInfo(serverId);
    if (!processInfo) {
      this.logger.warn(`No process info found for server ${serverId}, skipping restart logic`);
      return;
    }

    const restartPolicy = RestartPolicyType.ON_FAILURE; // 默认使用ON_FAILURE策略
    
    // 根据重启策略决定是否重启
    const shouldRestart = this.shouldRestart(restartPolicy, errorType);
    if (!shouldRestart) {
      this.logger.log(`Restart not required for server ${serverId} with policy ${restartPolicy}`);
      return;
    }

    // 检查重启次数限制
    const currentAttempts = this.restartAttempts.get(serverId) || 0;
    if (currentAttempts >= this.config.maxRestartAttempts) {
      this.logger.error(
        `Max restart attempts (${this.config.maxRestartAttempts}) reached for server ${serverId}`
      );
      
      await this.logInfo(
        serverId,
        `Max restart attempts reached. Server will not be restarted automatically.`
      );
      
      // 发送最大重启次数达到事件
      this.eventEmitter.emit('process.max_restarts_reached', {
        serverId,
        attempts: currentAttempts,
        timestamp: new Date()
      });
      
      return;
    }

    // 执行重启
    await this.scheduleRestart(serverId, currentAttempts + 1);
  }

  /**
   * 判断是否应该重启
   */
  private shouldRestart(restartPolicy: RestartPolicyType, errorType: ProcessErrorType): boolean {
    switch (restartPolicy) {
      case RestartPolicyType.ALWAYS:
        return true;
      
      case RestartPolicyType.ON_FAILURE:
        return errorType === ProcessErrorType.PROCESS_EXIT || 
               errorType === ProcessErrorType.PROCESS_ERROR ||
               errorType === ProcessErrorType.HEALTH_CHECK_FAILED;
      
      case RestartPolicyType.NEVER:
        return false;
      
      default:
        return false;
    }
  }

  /**
   * 安排重启
   */
  private async scheduleRestart(serverId: string, attemptNumber: number): Promise<void> {
    // 清除之前的重启定时器
    const existingTimer = this.restartTimers.get(serverId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 计算重启延迟（指数退避）
    const delay = this.calculateRestartDelay(attemptNumber);
    
    this.logger.log(
      `Scheduling restart for server ${serverId} (attempt ${attemptNumber}/${this.config.maxRestartAttempts}) in ${delay}ms`
    );

    await this.logInfo(
      serverId,
      `Scheduling restart attempt ${attemptNumber}/${this.config.maxRestartAttempts} in ${delay}ms`
    );

    // 设置重启定时器
    const timer = setTimeout(async () => {
      try {
        this.restartTimers.delete(serverId);
        await this.executeRestart(serverId, attemptNumber);
      } catch (error) {
        this.logger.error(`Failed to execute restart for server ${serverId}:`, error);
      }
    }, delay);

    this.restartTimers.set(serverId, timer);
  }

  /**
   * 计算重启延迟（指数退避）
   */
  private calculateRestartDelay(attemptNumber: number): number {
    // 指数退避：基础延迟 * 2^(尝试次数-1)
    const baseDelay = this.config.restartDelay;
    const exponentialDelay = baseDelay * Math.pow(2, attemptNumber - 1);
    
    // 限制最大延迟为5分钟
    const maxDelay = 5 * 60 * 1000; // 5分钟
    
    return Math.min(exponentialDelay, maxDelay);
  }

  /**
   * 执行重启
   */
  private async executeRestart(serverId: string, attemptNumber: number): Promise<void> {
    try {
      this.logger.log(`Executing restart for server ${serverId} (attempt ${attemptNumber})`);
      
      // 更新重启尝试次数
      this.restartAttempts.set(serverId, attemptNumber);
      
      // 记录重启尝试
      await this.logInfo(serverId, `Attempting restart (${attemptNumber}/${this.config.maxRestartAttempts})`);
      
      // 更新数据库中的重启次数
      await this.processInfoRepository.update(
        { serverId },
        {
          restartCount: attemptNumber,
          updatedAt: new Date()
        }
      );

      // 创建基本的ProcessConfig（这里需要从服务器实体获取更详细的配置）
      const processConfig: ProcessConfig = {
        id: serverId,
        name: `server-${serverId}`,
        scriptPath: 'server.js',
        args: [],
        env: process.env,
        cwd: process.cwd(),
        timeout: 30000,
        processTimeout: 30000,
        maxRetries: this.config.maxRestartAttempts,
        maxRestartAttempts: this.config.maxRestartAttempts,
        restartDelay: this.config.restartDelay,
        healthCheck: {
          enabled: true,
          interval: 30000,
          timeout: 5000,
          retries: 3
        },
        memoryLimit: 512,
        cpuLimit: 80
      };

      // 执行重启
      const processInfo = await this.processManager.restartProcess(serverId, processConfig);
      
      if (processInfo) {
        this.logger.log(`Successfully restarted server ${serverId}`);
        await this.logInfo(serverId, `Server restarted successfully on attempt ${attemptNumber}`);
        
        // 重启成功，重置重启计数器
        this.restartAttempts.delete(serverId);
        
        // 发送重启成功事件
        this.eventEmitter.emit('process.restart_success', {
          serverId,
          attemptNumber,
          timestamp: new Date()
        });
      } else {
        throw new Error('Process restart failed');
      }
    } catch (error) {
      this.logger.error(`Restart attempt ${attemptNumber} failed for server ${serverId}:`, error);
      
      await this.logError(
        serverId,
        ProcessErrorType.RESTART_FAILED,
        error as Error,
        new Date()
      );
      
      // 发送重启失败事件
      this.eventEmitter.emit('process.restart_failed', {
        serverId,
        attemptNumber,
        error: error.message,
        timestamp: new Date()
      });
      
      // 如果还有重启机会，继续尝试
      if (attemptNumber < this.config.maxRestartAttempts) {
        await this.scheduleRestart(serverId, attemptNumber + 1);
      } else {
        this.logger.error(`All restart attempts exhausted for server ${serverId}`);
        await this.logError(
          serverId,
          ProcessErrorType.MAX_RESTARTS_REACHED,
          new Error('All restart attempts exhausted'),
          new Date()
        );
      }
    }
  }

  /**
   * 保存日志
   */
  private async saveLog(log: ProcessLog): Promise<void> {
    try {
      const entity = this.logRepository.create({
        serverId: log.processId,
        level: log.level,
        message: log.message,
        metadata: log.metadata,
        timestamp: log.timestamp,
      });
      
      await this.logRepository.save(entity);
    } catch (error) {
      this.logger.error(`Failed to save log for server ${log.processId}:`, error);
    }
  }

  /**
   * 记录信息日志
   */
  private async logInfo(serverId: string, message: string): Promise<void> {
    const logEntry: ProcessLog = {
      id: '',
      processId: serverId,
      level: LogLevel.INFO,
      message,
      metadata: {},
      timestamp: new Date()
    };
    
    await this.saveLog(logEntry);
  }

  /**
   * 取消重启
   */
  cancelRestart(serverId: string): void {
    const timer = this.restartTimers.get(serverId);
    if (timer) {
      clearTimeout(timer);
      this.restartTimers.delete(serverId);
      this.logger.log(`Cancelled restart for server ${serverId}`);
    }
    
    // 重置重启计数器
    this.restartAttempts.delete(serverId);
  }

  /**
   * 重置重启计数器
   */
  resetRestartCounter(serverId: string): void {
    this.restartAttempts.delete(serverId);
    this.logger.log(`Reset restart counter for server ${serverId}`);
  }

  /**
   * 获取重启尝试次数
   */
  getRestartAttempts(serverId: string): number {
    return this.restartAttempts.get(serverId) || 0;
  }

  /**
   * 获取进程日志
   */
  async getProcessLogs(
    serverId: string,
    level?: LogLevel,
    limit = 100
  ): Promise<ProcessLog[]> {
    try {
      const whereCondition: any = { serverId };
      if (level) {
        whereCondition.level = level;
      }

      const entities = await this.logRepository.find({
        where: whereCondition,
        order: { timestamp: 'DESC' },
        take: limit,
      });

      return entities.map(entity => ({
        id: entity.id,
        processId: entity.serverId,
        level: entity.level,
        message: entity.message,
        metadata: entity.metadata,
        timestamp: entity.timestamp,
      }));
    } catch (error) {
      this.logger.error(`Failed to get process logs for ${serverId}:`, error);
      return [];
    }
  }

  /**
   * 清理旧日志
   */
  async cleanupOldLogs(daysToKeep = 7): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.logRepository
        .createQueryBuilder()
        .delete()
        .where('timestamp < :cutoffDate', { cutoffDate })
        .execute();

      this.logger.log(`Cleaned up ${result.affected} old log entries`);
    } catch (error) {
      this.logger.error('Failed to cleanup old logs:', error);
    }
  }

  /**
   * 获取错误统计
   */
  async getErrorStats(serverId: string, hours = 24): Promise<{
    totalErrors: number;
    errorsByType: Record<string, number>;
    restartAttempts: number;
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - hours);

      const logs = await this.logRepository.find({
        where: {
          serverId,
          level: LogLevel.ERROR,
          timestamp: cutoffDate
        }
      });

      const errorsByType: Record<string, number> = {};
      
      for (const log of logs) {
        const errorType = log.metadata?.errorType || 'UNKNOWN';
        errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
      }

      return {
        totalErrors: logs.length,
        errorsByType,
        restartAttempts: this.getRestartAttempts(serverId)
      };
    } catch (error) {
      this.logger.error(`Failed to get error stats for ${serverId}:`, error);
      return {
        totalErrors: 0,
        errorsByType: {},
        restartAttempts: 0
      };
    }
  }
}