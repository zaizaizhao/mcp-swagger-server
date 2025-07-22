import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import { MCPServerEntity, ServerStatus } from '../../../database/entities/mcp-server.entity';
import { LogEntryEntity, LogLevel, LogSource } from '../../../database/entities/log-entry.entity';
import { ServerManagerService, ServerInstance } from './server-manager.service';
import { ServerLifecycleService } from './server-lifecycle.service';

export interface HealthCheckResult {
  serverId: string;
  serverName: string;
  healthy: boolean;
  responseTime?: number;
  error?: string;
  timestamp: Date;
  endpoint?: string;
  uptime?: number;
}

export interface ServerHealthMetrics {
  serverId: string;
  serverName: string;
  status: ServerStatus;
  healthy: boolean;
  uptime: number;
  lastHealthCheck: Date;
  healthCheckCount: number;
  failedHealthChecks: number;
  successRate: number;
  averageResponseTime: number;
  endpoint?: string;
}

@Injectable()
export class ServerHealthService {
  private readonly logger = new Logger(ServerHealthService.name);
  private readonly healthCheckHistory = new Map<string, HealthCheckResult[]>();
  private readonly healthCheckIntervals = new Map<string, NodeJS.Timeout>();
  private readonly maxHistorySize = 100;

  constructor(
    @InjectRepository(MCPServerEntity)
    private readonly serverRepository: Repository<MCPServerEntity>,
    @InjectRepository(LogEntryEntity)
    private readonly logRepository: Repository<LogEntryEntity>,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly serverManager: ServerManagerService,
    private readonly lifecycleService: ServerLifecycleService,
  ) {
    this.initializeHealthChecks();
  }

  /**
   * 初始化健康检查
   */
  private async initializeHealthChecks(): Promise<void> {
    try {
      const runningServers = await this.serverRepository.find({
        where: { status: ServerStatus.RUNNING },
      });

      for (const server of runningServers) {
        this.startHealthCheck(server.id);
      }

      this.logger.log(`Initialized health checks for ${runningServers.length} running servers`);
    } catch (error) {
      this.logger.error('Failed to initialize health checks:', error);
    }
  }

  /**
   * 启动服务器健康检查
   */
  startHealthCheck(serverId: string): void {
    // 如果已经有健康检查在运行，先停止它
    this.stopHealthCheck(serverId);

    const interval = this.configService.get<number>('MCP_SERVER_HEALTH_CHECK_INTERVAL', 30000); // 30秒默认间隔
    
    const healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck(serverId);
    }, interval);

    this.healthCheckIntervals.set(serverId, healthCheckInterval);
    this.logger.debug(`Started health check for server ${serverId} with ${interval}ms interval`);
  }

  /**
   * 停止服务器健康检查
   */
  stopHealthCheck(serverId: string): void {
    const interval = this.healthCheckIntervals.get(serverId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(serverId);
      this.logger.debug(`Stopped health check for server ${serverId}`);
    }
  }

  /**
   * 执行单次健康检查
   */
  async performHealthCheck(serverId: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      const instance = this.serverManager.getServerInstance(serverId);
      if (!instance) {
        throw new Error('Server instance not found');
      }

      if (instance.entity.status !== ServerStatus.RUNNING) {
        throw new Error(`Server is not running (status: ${instance.entity.status})`);
      }

      // 执行健康检查
      const healthy = await this.lifecycleService.healthCheck(instance);
      const responseTime = Date.now() - startTime;

      result = {
        serverId,
        serverName: instance.entity.name,
        healthy,
        responseTime,
        timestamp: new Date(),
        endpoint: instance.entity.endpoint,
        uptime: instance.startTime ? Math.floor((Date.now() - instance.startTime.getTime()) / 1000) : 0,
      };

      // 更新数据库中的健康状态
      await this.updateServerHealth(serverId, healthy);

      // 如果健康状态发生变化，发送事件
      if (instance.entity.healthy !== healthy) {
        this.eventEmitter.emit('server.health.changed', {
          serverId,
          serverName: instance.entity.name,
          previousHealth: instance.entity.healthy,
          currentHealth: healthy,
          responseTime,
        });
      }

      // 记录健康检查日志
      if (!healthy) {
        await this.logHealthCheckFailure(serverId, instance.entity.name, 'Health check failed');
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      result = {
        serverId,
        serverName: 'Unknown',
        healthy: false,
        responseTime,
        error: error.message,
        timestamp: new Date(),
      };

      // 更新数据库中的健康状态
      await this.updateServerHealth(serverId, false, error.message);

      // 记录错误日志
      await this.logHealthCheckFailure(serverId, result.serverName, error.message, error);

      this.logger.warn(`Health check failed for server ${serverId}: ${error.message}`);
    }

    // 保存健康检查历史
    this.saveHealthCheckHistory(serverId, result);

    return result;
  }

  /**
   * 获取服务器健康状态
   */
  async getServerHealth(serverId: string): Promise<ServerHealthMetrics> {
    const server = await this.serverRepository.findOne({ where: { id: serverId } });
    if (!server) {
      throw new Error(`Server with ID ${serverId} not found`);
    }

    const instance = this.serverManager.getServerInstance(serverId);
    const history = this.healthCheckHistory.get(serverId) || [];
    
    // 计算统计信息
    const healthCheckCount = history.length;
    const failedHealthChecks = history.filter(h => !h.healthy).length;
    const successRate = healthCheckCount > 0 ? ((healthCheckCount - failedHealthChecks) / healthCheckCount) * 100 : 0;
    const averageResponseTime = history.length > 0 
      ? history.reduce((sum, h) => sum + (h.responseTime || 0), 0) / history.length 
      : 0;
    
    const uptime = instance?.startTime 
      ? Math.floor((Date.now() - instance.startTime.getTime()) / 1000) 
      : 0;

    return {
      serverId,
      serverName: server.name,
      status: server.status,
      healthy: server.healthy,
      uptime,
      lastHealthCheck: server.lastHealthCheck || new Date(),
      healthCheckCount,
      failedHealthChecks,
      successRate,
      averageResponseTime,
      endpoint: server.endpoint,
    };
  }

  /**
   * 获取所有服务器的健康状态
   */
  async getAllServersHealth(): Promise<ServerHealthMetrics[]> {
    const servers = await this.serverRepository.find();
    const healthMetrics: ServerHealthMetrics[] = [];

    for (const server of servers) {
      try {
        const metrics = await this.getServerHealth(server.id);
        healthMetrics.push(metrics);
      } catch (error) {
        this.logger.error(`Failed to get health metrics for server ${server.id}:`, error);
      }
    }

    return healthMetrics;
  }

  /**
   * 获取服务器健康检查历史
   */
  getHealthCheckHistory(serverId: string, limit: number = 50): HealthCheckResult[] {
    const history = this.healthCheckHistory.get(serverId) || [];
    return history.slice(-limit).reverse(); // 返回最新的记录
  }

  /**
   * 清理服务器健康检查历史
   */
  clearHealthCheckHistory(serverId: string): void {
    this.healthCheckHistory.delete(serverId);
  }

  /**
   * 定时清理过期的健康检查历史
   */
  @Cron(CronExpression.EVERY_HOUR)
  private async cleanupHealthCheckHistory(): Promise<void> {
    const maxAge = this.configService.get<number>('HEALTH_CHECK_HISTORY_MAX_AGE', 24 * 60 * 60 * 1000); // 24小时
    const cutoffTime = new Date(Date.now() - maxAge);

    for (const [serverId, history] of this.healthCheckHistory.entries()) {
      const filteredHistory = history.filter(h => h.timestamp > cutoffTime);
      
      if (filteredHistory.length !== history.length) {
        this.healthCheckHistory.set(serverId, filteredHistory);
        this.logger.debug(`Cleaned up health check history for server ${serverId}`);
      }
    }
  }

  /**
   * 定时检查不健康的服务器
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  private async checkUnhealthyServers(): Promise<void> {
    try {
      const unhealthyServers = await this.serverRepository.find({
        where: {
          status: ServerStatus.RUNNING,
          healthy: false,
        },
      });

      for (const server of unhealthyServers) {
        const history = this.healthCheckHistory.get(server.id) || [];
        const recentFailures = history.slice(-5).filter(h => !h.healthy).length;
        
        // 如果连续5次健康检查失败，考虑重启服务器
        if (recentFailures >= 5) {
          this.logger.warn(`Server ${server.name} has failed ${recentFailures} consecutive health checks`);
          
          this.eventEmitter.emit('server.health.critical', {
            serverId: server.id,
            serverName: server.name,
            consecutiveFailures: recentFailures,
          });

          // 可选：自动重启不健康的服务器
          const autoRestart = this.configService.get<boolean>('AUTO_RESTART_UNHEALTHY_SERVERS', false);
          if (autoRestart) {
            try {
              await this.serverManager.restartServer(server.id);
              this.logger.log(`Auto-restarted unhealthy server ${server.name}`);
            } catch (error) {
              this.logger.error(`Failed to auto-restart server ${server.name}:`, error);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to check unhealthy servers:', error);
    }
  }

  /**
   * 更新服务器健康状态
   */
  private async updateServerHealth(
    serverId: string,
    healthy: boolean,
    errorMessage?: string
  ): Promise<void> {
    await this.serverRepository.update(serverId, {
      healthy,
      lastHealthCheck: new Date(),
      errorMessage: healthy ? null : errorMessage,
    });
  }

  /**
   * 保存健康检查历史
   */
  private saveHealthCheckHistory(serverId: string, result: HealthCheckResult): void {
    let history = this.healthCheckHistory.get(serverId) || [];
    
    // 添加新的结果
    history.push(result);
    
    // 限制历史记录大小
    if (history.length > this.maxHistorySize) {
      history = history.slice(-this.maxHistorySize);
    }
    
    this.healthCheckHistory.set(serverId, history);
  }

  /**
   * 记录健康检查失败日志
   */
  private async logHealthCheckFailure(
    serverId: string,
    serverName: string,
    message: string,
    error?: any
  ): Promise<void> {
    await this.logRepository.save({
      level: LogLevel.WARN,
      source: LogSource.HEALTH_CHECK,
      message: `Health check failed for server '${serverName}': ${message}`,
      serverId,
      context: {
        serverName,
        error: error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : undefined,
      },
      component: 'ServerHealthService',
      operation: 'healthCheck',
      stackTrace: error?.stack,
    });
  }

  /**
   * 服务器启动时的事件处理
   */
  onServerStarted(serverId: string): void {
    this.startHealthCheck(serverId);
  }

  /**
   * 服务器停止时的事件处理
   */
  onServerStopped(serverId: string): void {
    this.stopHealthCheck(serverId);
  }

  /**
   * 模块销毁时清理资源
   */
  onModuleDestroy(): void {
    // 清理所有健康检查间隔
    for (const [serverId, interval] of this.healthCheckIntervals.entries()) {
      clearInterval(interval);
      this.logger.debug(`Cleaned up health check interval for server ${serverId}`);
    }
    
    this.healthCheckIntervals.clear();
    this.healthCheckHistory.clear();
  }
}