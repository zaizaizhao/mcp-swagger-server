import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { HealthCheckResultEntity } from '../entities/health-check-result.entity';
import { ProcessManagerService } from './process-manager.service';
import {
  HealthCheckResult,
  ProcessInfo,
  ProcessStatus,
  ProcessEvent,
  ProcessManagerConfig,
  DEFAULT_PROCESS_CONFIG
} from '../interfaces/process.interface';
import { MCPServerEntity, TransportType } from '../../../database/entities/mcp-server.entity';

@Injectable()
export class ProcessHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProcessHealthService.name);
  private readonly healthCheckIntervals = new Map<string, NodeJS.Timeout>();
  private readonly config: ProcessManagerConfig;
  private isShuttingDown = false;

  constructor(
    @InjectRepository(HealthCheckResultEntity)
    private readonly healthCheckRepository: Repository<HealthCheckResultEntity>,
    @InjectRepository(MCPServerEntity)
    private readonly serverRepository: Repository<MCPServerEntity>,
    private readonly processManager: ProcessManagerService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.config = {
      ...DEFAULT_PROCESS_CONFIG,
      healthCheckInterval: this.configService.get<number>('HEALTH_CHECK_INTERVAL', DEFAULT_PROCESS_CONFIG.healthCheckInterval),
      healthCheckTimeout: this.configService.get<number>('HEALTH_CHECK_TIMEOUT', DEFAULT_PROCESS_CONFIG.healthCheckTimeout),
    };
  }

  async onModuleInit() {
    this.logger.log('Process Health Service initialized');
    // 启动时为所有运行中的进程设置健康检查
    await this.initializeHealthChecks();
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    this.logger.log('Shutting down health check intervals...');
    
    // 清理所有健康检查定时器
    for (const [serverId, interval] of this.healthCheckIntervals) {
      clearInterval(interval);
      this.logger.log(`Cleared health check interval for server ${serverId}`);
    }
    this.healthCheckIntervals.clear();
  }

  /**
   * 初始化健康检查
   */
  private async initializeHealthChecks(): Promise<void> {
    try {
      const runningProcesses = this.processManager.getAllProcessInfo()
        .filter(process => process.status === ProcessStatus.RUNNING);

      for (const processInfo of runningProcesses) {
        await this.startHealthCheck(processInfo.id);
      }

      this.logger.log(`Initialized health checks for ${runningProcesses.length} running processes`);
    } catch (error) {
      this.logger.error('Failed to initialize health checks:', error);
    }
  }

  /**
   * 开始健康检查
   */
  async startHealthCheck(serverId: string): Promise<void> {
    if (this.healthCheckIntervals.has(serverId)) {
      this.logger.warn(`Health check already running for server ${serverId}`);
      return;
    }

    this.logger.log(`Starting health check for server ${serverId}`);

    // 立即执行一次健康检查
    await this.performHealthCheck(serverId);

    // 设置定期健康检查
    const interval = setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.performHealthCheck(serverId);
      }
    }, this.config.healthCheckInterval);

    this.healthCheckIntervals.set(serverId, interval);
  }

  /**
   * 停止健康检查
   */
  stopHealthCheck(serverId: string): void {
    const interval = this.healthCheckIntervals.get(serverId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(serverId);
      this.logger.log(`Stopped health check for server ${serverId}`);
    }
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck(serverId: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      // 获取进程信息
      const processInfo = this.processManager.getProcessInfo(serverId);
      if (!processInfo || processInfo.status !== ProcessStatus.RUNNING) {
        throw new Error(`Process not running for server ${serverId}`);
      }

      // 获取服务器配置
      const server = await this.serverRepository.findOne({ where: { id: serverId } });
      if (!server) {
        throw new Error(`Server configuration not found for ${serverId}`);
      }

      // 根据传输类型执行不同的健康检查
      const healthCheckResult = await this.checkServerHealth(server, processInfo);
      const responseTime = Date.now() - startTime;

      result = {
        healthy: healthCheckResult.healthy,
        responseTime,
        status: healthCheckResult.status,
        data: healthCheckResult.data,
        lastCheck: new Date(),
        memoryUsage: processInfo.memoryUsage,
        cpuUsage: processInfo.cpuUsage,
      };

      // 更新进程内存和CPU使用情况
      await this.updateProcessMetrics(processInfo);

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      result = {
        healthy: false,
        responseTime,
        error: error.message,
        lastCheck: new Date(),
      };

      this.logger.error(`Health check failed for server ${serverId}:`, error);
    }

    // 保存健康检查结果
    await this.saveHealthCheckResult(serverId, result);

    // 发送健康检查事件
    const event: ProcessEvent = {
      processId: serverId,
      eventType: 'health_check',
      timestamp: new Date(),
      data: {
        healthy: result.healthy,
        responseTime: result.responseTime,
        error: result.error
      }
    };
    this.eventEmitter.emit('process.health_check', event);

    // 如果健康检查失败，发送错误事件
    if (!result.healthy) {
      this.eventEmitter.emit('process.health_check_failed', {
        processId: serverId,
        eventType: 'health_check',
        timestamp: new Date(),
        data: {
          error: result.error
        }
      });
    }

    return result;
  }

  /**
   * 检查服务器健康状态（CLI spawn模式）
   */
  private async checkServerHealth(server: MCPServerEntity, processInfo: ProcessInfo): Promise<HealthCheckResult> {
    try {
      switch (server.transport) {
        case TransportType.STREAMABLE:
        case TransportType.SSE:
          // 使用进程配置中的健康检查端点
          const endpoint = processInfo.config?.healthCheck?.endpoint || `http://localhost:${server.port}/health`;
          return await this.httpHealthCheck(endpoint);
        
        case TransportType.WEBSOCKET:
          return await this.websocketHealthCheck(`ws://localhost:${server.port}`);
        
        default:
          throw new Error(`Unsupported transport type: ${server.transport}`);
      }
    } catch (error) {
      this.logger.error(`Health check failed for server ${server.id}:`, error);
      return {
        healthy: false,
        error: error.message,
        lastCheck: new Date()
      };
    }
  }

  /**
   * HTTP健康检查（CLI spawn模式）
   */
  private async httpHealthCheck(endpoint: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const response = await firstValueFrom(
        this.httpService.get(endpoint, {
          timeout: this.config.healthCheckTimeout,
        })
      );
      
      return {
        healthy: response.status === 200,
        responseTime: Date.now() - startTime,
        status: response.status,
        data: response.data,
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error.message,
        lastCheck: new Date()
      };
    }
  }

  /**
   * WebSocket健康检查（CLI spawn模式）
   */
  private async websocketHealthCheck(endpoint: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    // TODO: 实现WebSocket健康检查
    // 这里可以尝试建立WebSocket连接来检查健康状态
    return {
        healthy: true,
        responseTime: Date.now() - startTime,
        status: 200,
        lastCheck: new Date()
      };
  }



  /**
   * 更新进程指标（CLI spawn模式）
   */
  private async updateProcessMetrics(processInfo: ProcessInfo): Promise<void> {
    try {
      const metrics = await this.processManager.getProcessMetrics(processInfo.id);
      if (metrics) {
        processInfo.memoryUsage = metrics.memoryUsage;
        processInfo.cpuUsage = metrics.cpuUsage;
      }
    } catch (error) {
      this.logger.warn(`Failed to update process metrics for ${processInfo.id}:`, error);
    }
  }

  /**
   * 保存健康检查结果（CLI spawn模式）
   */
  private async saveHealthCheckResult(serverId: string, result: HealthCheckResult): Promise<void> {
    try {
      const entity = this.healthCheckRepository.create({
        serverId,
        isHealthy: result.healthy,
        responseTime: result.responseTime,
        error: result.error,
        memoryUsage: result.memoryUsage,
        cpuUsage: result.cpuUsage,
        timestamp: result.lastCheck,
      });
      
      await this.healthCheckRepository.save(entity);
    } catch (error) {
      this.logger.error(`Failed to save health check result for server ${serverId}:`, error);
    }
  }

  /**
   * 获取健康检查历史
   */
  async getHealthCheckHistory(serverId: string, limit = 100): Promise<HealthCheckResult[]> {
    try {
      const entities = await this.healthCheckRepository.find({
        where: { serverId },
        order: { timestamp: 'DESC' },
        take: limit,
      });

      return entities.map(entity => ({
        healthy: entity.isHealthy,
        responseTime: entity.responseTime,
        error: entity.error,
        memoryUsage: entity.memoryUsage,
        cpuUsage: entity.cpuUsage,
        lastCheck: entity.timestamp,
      }));
    } catch (error) {
      this.logger.error(`Failed to get health check history for ${serverId}:`, error);
      return [];
    }
  }

  /**
   * 获取最新的健康检查结果
   */
  async getLatestHealthCheck(serverId: string): Promise<HealthCheckResult | null> {
    try {
      const entity = await this.healthCheckRepository.findOne({
        where: { serverId },
        order: { timestamp: 'DESC' },
      });

      if (!entity) {
        return null;
      }

      return {
        healthy: entity.isHealthy,
        responseTime: entity.responseTime,
        error: entity.error,
        memoryUsage: entity.memoryUsage,
        cpuUsage: entity.cpuUsage,
        lastCheck: entity.timestamp,
      };
    } catch (error) {
      this.logger.error(`Failed to get latest health check for ${serverId}:`, error);
      return null;
    }
  }

  /**
   * 清理旧的健康检查记录
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldHealthChecks(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7); // 保留7天的记录

      const result = await this.healthCheckRepository.delete({
        timestamp: LessThan(cutoffDate)
      });

      this.logger.log(`Cleaned up ${result.affected} old health check records`);
    } catch (error) {
      this.logger.error('Failed to cleanup old health check records:', error);
    }
  }

  /**
   * 获取服务器健康状态统计
   */
  async getHealthStats(serverId: string, hours = 24): Promise<{
    totalChecks: number;
    healthyChecks: number;
    unhealthyChecks: number;
    averageResponseTime: number;
    uptime: number;
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - hours);

      const checks = await this.healthCheckRepository.find({
        where: {
          serverId,
          timestamp: LessThan(cutoffDate)
        },
        order: { timestamp: 'DESC' }
      });

      const totalChecks = checks.length;
      const healthyChecks = checks.filter(check => check.isHealthy).length;
      const unhealthyChecks = totalChecks - healthyChecks;
      const averageResponseTime = totalChecks > 0 
        ? checks.reduce((sum, check) => sum + check.responseTime, 0) / totalChecks 
        : 0;
      const uptime = totalChecks > 0 ? (healthyChecks / totalChecks) * 100 : 0;

      return {
        totalChecks,
        healthyChecks,
        unhealthyChecks,
        averageResponseTime,
        uptime
      };
    } catch (error) {
      this.logger.error(`Failed to get health stats for ${serverId}:`, error);
      return {
        totalChecks: 0,
        healthyChecks: 0,
        unhealthyChecks: 0,
        averageResponseTime: 0,
        uptime: 0
      };
    }
  }
}