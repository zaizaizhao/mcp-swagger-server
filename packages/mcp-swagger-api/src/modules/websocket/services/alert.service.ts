import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

import { LogEntryEntity, LogLevel, LogSource } from '../../../database/entities/log-entry.entity';
import { MCPServerEntity } from '../../../database/entities/mcp-server.entity';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  serverId?: string;
  serverName?: string;
  source?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved?: boolean;
  resolvedAt?: Date;
}

export enum AlertType {
  SYSTEM_ERROR = 'system-error',
  SERVER_DOWN = 'server-down',
  SERVER_UNHEALTHY = 'server-unhealthy',
  HIGH_CPU_USAGE = 'high-cpu-usage',
  HIGH_MEMORY_USAGE = 'high-memory-usage',
  HIGH_ERROR_RATE = 'high-error-rate',
  SLOW_RESPONSE_TIME = 'slow-response-time',
  CONNECTION_FAILED = 'connection-failed',
  AUTHENTICATION_FAILED = 'authentication-failed',
  TOOL_EXECUTION_FAILED = 'tool-execution-failed',
  CONFIGURATION_ERROR = 'configuration-error',
  DISK_SPACE_LOW = 'disk-space-low',
  NETWORK_ERROR = 'network-error',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface AlertThreshold {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  duration?: number; // 持续时间（秒）
  severity: AlertSeverity;
  enabled: boolean;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private readonly alerts = new Map<string, Alert>();
  private readonly thresholds = new Map<string, AlertThreshold>();
  private readonly metricHistory = new Map<string, { value: number; timestamp: Date }[]>();

  constructor(
    @InjectRepository(LogEntryEntity)
    private readonly logRepository: Repository<LogEntryEntity>,
    @InjectRepository(MCPServerEntity)
    private readonly serverRepository: Repository<MCPServerEntity>,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    this.initializeDefaultThresholds();
  }

  /**
   * 创建告警
   */
  async createAlert(alertData: Partial<Alert>): Promise<Alert> {
    const alert: Alert = {
      id: this.generateAlertId(),
      type: alertData.type || AlertType.SYSTEM_ERROR,
      severity: alertData.severity || AlertSeverity.WARNING,
      title: alertData.title || 'System Alert',
      message: alertData.message || 'An alert has been triggered',
      serverId: alertData.serverId,
      source: alertData.source,
      metadata: alertData.metadata || {},
      timestamp: new Date(),
      acknowledged: false,
      resolved: false,
    };

    // 如果有服务器ID，获取服务器名称
    if (alert.serverId) {
      try {
        const server = await this.serverRepository.findOne({ where: { id: alert.serverId } });
        if (server) {
          alert.serverName = server.name;
        }
      } catch (error) {
        this.logger.warn(`Failed to get server name for alert: ${error.message}`);
      }
    }

    this.alerts.set(alert.id, alert);

    // 记录到日志
    await this.logAlert(alert);

    // 发送事件
    this.eventEmitter.emit('alert.created', alert);
    this.eventEmitter.emit('system.alert', alert);

    this.logger.warn(`Alert created: ${alert.type} - ${alert.message}`);

    return alert;
  }

  /**
   * 确认告警
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<Alert | null> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return null;
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    this.eventEmitter.emit('alert.acknowledged', alert);

    this.logger.log(`Alert acknowledged: ${alertId} by ${acknowledgedBy}`);

    return alert;
  }

  /**
   * 解决告警
   */
  async resolveAlert(alertId: string): Promise<Alert | null> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return null;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();

    this.eventEmitter.emit('alert.resolved', alert);

    this.logger.log(`Alert resolved: ${alertId}`);

    return alert;
  }

  /**
   * 获取所有告警
   */
  getAlerts(filters?: {
    severity?: AlertSeverity[];
    type?: AlertType[];
    serverId?: string;
    acknowledged?: boolean;
    resolved?: boolean;
    limit?: number;
  }): Alert[] {
    let alerts = Array.from(this.alerts.values());

    if (filters) {
      if (filters.severity) {
        alerts = alerts.filter(alert => filters.severity!.includes(alert.severity));
      }
      if (filters.type) {
        alerts = alerts.filter(alert => filters.type!.includes(alert.type));
      }
      if (filters.serverId) {
        alerts = alerts.filter(alert => alert.serverId === filters.serverId);
      }
      if (filters.acknowledged !== undefined) {
        alerts = alerts.filter(alert => alert.acknowledged === filters.acknowledged);
      }
      if (filters.resolved !== undefined) {
        alerts = alerts.filter(alert => alert.resolved === filters.resolved);
      }
    }

    // 按时间倒序排列
    alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters?.limit) {
      alerts = alerts.slice(0, filters.limit);
    }

    return alerts;
  }

  /**
   * 获取告警统计
   */
  getAlertStats(): {
    total: number;
    bySeverity: Record<AlertSeverity, number>;
    byType: Record<string, number>;
    acknowledged: number;
    resolved: number;
    active: number;
  } {
    const alerts = Array.from(this.alerts.values());
    
    const stats = {
      total: alerts.length,
      bySeverity: {
        [AlertSeverity.INFO]: 0,
        [AlertSeverity.WARNING]: 0,
        [AlertSeverity.ERROR]: 0,
        [AlertSeverity.CRITICAL]: 0,
      },
      byType: {} as Record<string, number>,
      acknowledged: 0,
      resolved: 0,
      active: 0,
    };

    alerts.forEach(alert => {
      stats.bySeverity[alert.severity]++;
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
      
      if (alert.acknowledged) stats.acknowledged++;
      if (alert.resolved) stats.resolved++;
      if (!alert.resolved) stats.active++;
    });

    return stats;
  }

  /**
   * 检查指标阈值
   */
  checkMetricThreshold(metric: string, value: number, serverId?: string): void {
    const threshold = this.thresholds.get(metric);
    if (!threshold || !threshold.enabled) {
      return;
    }

    // 记录指标历史
    const key = serverId ? `${metric}-${serverId}` : metric;
    if (!this.metricHistory.has(key)) {
      this.metricHistory.set(key, []);
    }
    
    const history = this.metricHistory.get(key)!;
    history.push({ value, timestamp: new Date() });
    
    // 保留最近10分钟的数据
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    this.metricHistory.set(key, history.filter(h => h.timestamp > tenMinutesAgo));

    // 检查阈值
    const isThresholdExceeded = this.evaluateThreshold(threshold, value);
    
    if (isThresholdExceeded) {
      // 检查持续时间
      if (threshold.duration) {
        const durationAgo = new Date(Date.now() - threshold.duration * 1000);
        const recentValues = history.filter(h => h.timestamp > durationAgo);
        const allExceeded = recentValues.every(h => this.evaluateThreshold(threshold, h.value));
        
        if (!allExceeded) {
          return;
        }
      }

      // 创建告警
      this.createAlert({
        type: this.getAlertTypeForMetric(metric),
        severity: threshold.severity,
        title: `${metric} threshold exceeded`,
        message: `${metric} value ${value} ${threshold.operator} ${threshold.value}`,
        serverId,
        metadata: {
          metric,
          value,
          threshold: threshold.value,
          operator: threshold.operator,
        },
      });

      // 发送性能阈值事件
      this.eventEmitter.emit('performance.threshold.exceeded', {
        metric,
        value,
        threshold: threshold.value,
        operator: threshold.operator,
        serverId,
      });
    }
  }

  /**
   * 设置阈值
   */
  setThreshold(metric: string, threshold: AlertThreshold): void {
    this.thresholds.set(metric, threshold);
    this.logger.log(`Threshold set for ${metric}: ${threshold.operator} ${threshold.value}`);
  }

  /**
   * 获取阈值配置
   */
  getThresholds(): Map<string, AlertThreshold> {
    return new Map(this.thresholds);
  }

  /**
   * 清理过期告警
   */
  cleanupExpiredAlerts(maxAge: number = 7 * 24 * 60 * 60 * 1000): number { // 默认7天
    const cutoffTime = new Date(Date.now() - maxAge);
    let cleanedCount = 0;

    for (const [id, alert] of this.alerts.entries()) {
      if (alert.timestamp < cutoffTime && alert.resolved) {
        this.alerts.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired alerts`);
    }

    return cleanedCount;
  }

  /**
   * 初始化默认阈值
   */
  private initializeDefaultThresholds(): void {
    const defaultThresholds: Array<[string, AlertThreshold]> = [
      ['cpu_usage', {
        metric: 'cpu_usage',
        operator: 'gt',
        value: 80,
        duration: 300, // 5分钟
        severity: AlertSeverity.WARNING,
        enabled: true,
      }],
      ['memory_usage', {
        metric: 'memory_usage',
        operator: 'gt',
        value: 85,
        duration: 300,
        severity: AlertSeverity.WARNING,
        enabled: true,
      }],
      ['error_rate', {
        metric: 'error_rate',
        operator: 'gt',
        value: 5, // 5%
        duration: 60,
        severity: AlertSeverity.ERROR,
        enabled: true,
      }],
      ['response_time', {
        metric: 'response_time',
        operator: 'gt',
        value: 5000, // 5秒
        duration: 120,
        severity: AlertSeverity.WARNING,
        enabled: true,
      }],
      ['disk_usage', {
        metric: 'disk_usage',
        operator: 'gt',
        value: 90,
        duration: 0,
        severity: AlertSeverity.CRITICAL,
        enabled: true,
      }],
    ];

    defaultThresholds.forEach(([metric, threshold]) => {
      this.thresholds.set(metric, threshold);
    });

    this.logger.log('Default alert thresholds initialized');
  }

  /**
   * 评估阈值
   */
  private evaluateThreshold(threshold: AlertThreshold, value: number): boolean {
    switch (threshold.operator) {
      case 'gt': return value > threshold.value;
      case 'gte': return value >= threshold.value;
      case 'lt': return value < threshold.value;
      case 'lte': return value <= threshold.value;
      case 'eq': return value === threshold.value;
      default: return false;
    }
  }

  /**
   * 根据指标获取告警类型
   */
  private getAlertTypeForMetric(metric: string): AlertType {
    const metricToType: Record<string, AlertType> = {
      'cpu_usage': AlertType.HIGH_CPU_USAGE,
      'memory_usage': AlertType.HIGH_MEMORY_USAGE,
      'error_rate': AlertType.HIGH_ERROR_RATE,
      'response_time': AlertType.SLOW_RESPONSE_TIME,
      'disk_usage': AlertType.DISK_SPACE_LOW,
    };

    return metricToType[metric] || AlertType.SYSTEM_ERROR;
  }

  /**
   * 生成告警ID
   */
  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 记录告警到日志
   */
  private async logAlert(alert: Alert): Promise<void> {
    try {
      const logLevel = this.getLogLevelForSeverity(alert.severity);
      
      const logEntry = this.logRepository.create({
        level: logLevel,
        message: `[ALERT] ${alert.title}: ${alert.message}`,
        source: LogSource.SYSTEM,
        serverId: alert.serverId,
        metadata: {
          alertId: alert.id,
          alertType: alert.type,
          alertSeverity: alert.severity,
          ...alert.metadata,
        },
        timestamp: alert.timestamp,
      });

      await this.logRepository.save(logEntry);
    } catch (error) {
      this.logger.error('Failed to log alert:', error);
    }
  }

  /**
   * 根据告警严重程度获取日志级别
   */
  private getLogLevelForSeverity(severity: AlertSeverity): LogLevel {
    switch (severity) {
      case AlertSeverity.INFO: return LogLevel.INFO;
      case AlertSeverity.WARNING: return LogLevel.WARN;
      case AlertSeverity.ERROR: return LogLevel.ERROR;
      case AlertSeverity.CRITICAL: return LogLevel.FATAL;
      default: return LogLevel.WARN;
    }
  }
}