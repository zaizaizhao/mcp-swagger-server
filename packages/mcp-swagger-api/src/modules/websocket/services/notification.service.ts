import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Alert, AlertSeverity } from './alert.service';

export interface NotificationChannel {
  id: string;
  name: string;
  type: NotificationChannelType;
  enabled: boolean;
  config: Record<string, any>;
  filters?: NotificationFilter[];
}

export enum NotificationChannelType {
  EMAIL = 'email',
  WEBHOOK = 'webhook',
  SLACK = 'slack',
  TEAMS = 'teams',
  DISCORD = 'discord',
  SMS = 'sms',
  WEBSOCKET = 'websocket',
}

export interface NotificationFilter {
  field: string;
  operator: 'eq' | 'ne' | 'in' | 'nin' | 'gt' | 'lt' | 'gte' | 'lte';
  value: any;
}

export interface Notification {
  id: string;
  channelId: string;
  alertId: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  timestamp: Date;
  status: NotificationStatus;
  attempts: number;
  lastAttempt?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly channels = new Map<string, NotificationChannel>();
  private readonly notifications = new Map<string, Notification>();
  private readonly maxRetries = 3;
  private readonly retryDelay = 5000; // 5秒

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializeDefaultChannels();
  }

  /**
   * 添加通知渠道
   */
  addChannel(channel: NotificationChannel): void {
    this.channels.set(channel.id, channel);
    this.logger.log(`Notification channel added: ${channel.name} (${channel.type})`);
  }

  /**
   * 移除通知渠道
   */
  removeChannel(channelId: string): boolean {
    const removed = this.channels.delete(channelId);
    if (removed) {
      this.logger.log(`Notification channel removed: ${channelId}`);
    }
    return removed;
  }

  /**
   * 获取所有通知渠道
   */
  getChannels(): NotificationChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * 更新通知渠道
   */
  updateChannel(channelId: string, updates: Partial<NotificationChannel>): boolean {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return false;
    }

    Object.assign(channel, updates);
    this.logger.log(`Notification channel updated: ${channelId}`);
    return true;
  }

  /**
   * 发送通知
   */
  async sendNotification(alert: Alert, channelIds?: string[]): Promise<void> {
    const targetChannels = channelIds 
      ? channelIds.map(id => this.channels.get(id)).filter(Boolean) as NotificationChannel[]
      : Array.from(this.channels.values()).filter(channel => channel.enabled);

    for (const channel of targetChannels) {
      // 检查过滤器
      if (!this.shouldSendToChannel(alert, channel)) {
        continue;
      }

      const notification: Notification = {
        id: this.generateNotificationId(),
        channelId: channel.id,
        alertId: alert.id,
        title: alert.title,
        message: this.formatMessage(alert, channel),
        severity: alert.severity,
        timestamp: new Date(),
        status: NotificationStatus.PENDING,
        attempts: 0,
      };

      this.notifications.set(notification.id, notification);
      await this.sendToChannel(notification, channel);
    }
  }

  /**
   * 获取通知历史
   */
  getNotifications(filters?: {
    channelId?: string;
    alertId?: string;
    status?: NotificationStatus;
    severity?: AlertSeverity;
    limit?: number;
  }): Notification[] {
    let notifications = Array.from(this.notifications.values());

    if (filters) {
      if (filters.channelId) {
        notifications = notifications.filter(n => n.channelId === filters.channelId);
      }
      if (filters.alertId) {
        notifications = notifications.filter(n => n.alertId === filters.alertId);
      }
      if (filters.status) {
        notifications = notifications.filter(n => n.status === filters.status);
      }
      if (filters.severity) {
        notifications = notifications.filter(n => n.severity === filters.severity);
      }
    }

    // 按时间倒序排列
    notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters?.limit) {
      notifications = notifications.slice(0, filters.limit);
    }

    return notifications;
  }

  /**
   * 获取通知统计
   */
  getNotificationStats(): {
    total: number;
    byStatus: Record<NotificationStatus, number>;
    byChannel: Record<string, number>;
    bySeverity: Record<AlertSeverity, number>;
    successRate: number;
  } {
    const notifications = Array.from(this.notifications.values());
    
    const stats = {
      total: notifications.length,
      byStatus: {
        [NotificationStatus.PENDING]: 0,
        [NotificationStatus.SENT]: 0,
        [NotificationStatus.FAILED]: 0,
        [NotificationStatus.RETRYING]: 0,
      },
      byChannel: {} as Record<string, number>,
      bySeverity: {
        [AlertSeverity.INFO]: 0,
        [AlertSeverity.WARNING]: 0,
        [AlertSeverity.ERROR]: 0,
        [AlertSeverity.CRITICAL]: 0,
      },
      successRate: 0,
    };

    let successCount = 0;

    notifications.forEach(notification => {
      stats.byStatus[notification.status]++;
      stats.byChannel[notification.channelId] = (stats.byChannel[notification.channelId] || 0) + 1;
      stats.bySeverity[notification.severity]++;
      
      if (notification.status === NotificationStatus.SENT) {
        successCount++;
      }
    });

    stats.successRate = notifications.length > 0 ? (successCount / notifications.length) * 100 : 0;

    return stats;
  }

  /**
   * 监听告警创建事件
   */
  @OnEvent('alert.created')
  async handleAlertCreated(alert: Alert): Promise<void> {
    await this.sendNotification(alert);
  }

  /**
   * 监听告警确认事件
   */
  @OnEvent('alert.acknowledged')
  async handleAlertAcknowledged(alert: Alert): Promise<void> {
    // 发送确认通知（可选）
    const acknowledgeChannels = Array.from(this.channels.values())
      .filter(channel => channel.enabled && channel.config.notifyOnAcknowledge);

    if (acknowledgeChannels.length > 0) {
      const acknowledgeAlert = {
        ...alert,
        title: `Alert Acknowledged: ${alert.title}`,
        message: `Alert has been acknowledged by ${alert.acknowledgedBy}`,
      };

      await this.sendNotification(acknowledgeAlert, acknowledgeChannels.map(c => c.id));
    }
  }

  /**
   * 监听告警解决事件
   */
  @OnEvent('alert.resolved')
  async handleAlertResolved(alert: Alert): Promise<void> {
    // 发送解决通知（可选）
    const resolveChannels = Array.from(this.channels.values())
      .filter(channel => channel.enabled && channel.config.notifyOnResolve);

    if (resolveChannels.length > 0) {
      const resolveAlert = {
        ...alert,
        title: `Alert Resolved: ${alert.title}`,
        message: `Alert has been resolved`,
      };

      await this.sendNotification(resolveAlert, resolveChannels.map(c => c.id));
    }
  }

  /**
   * 重试失败的通知
   */
  async retryFailedNotifications(): Promise<void> {
    const failedNotifications = Array.from(this.notifications.values())
      .filter(n => n.status === NotificationStatus.FAILED && n.attempts < this.maxRetries);

    for (const notification of failedNotifications) {
      const channel = this.channels.get(notification.channelId);
      if (channel) {
        notification.status = NotificationStatus.RETRYING;
        await this.sendToChannel(notification, channel);
      }
    }
  }

  /**
   * 清理过期通知
   */
  cleanupExpiredNotifications(maxAge: number = 30 * 24 * 60 * 60 * 1000): number { // 默认30天
    const cutoffTime = new Date(Date.now() - maxAge);
    let cleanedCount = 0;

    for (const [id, notification] of this.notifications.entries()) {
      if (notification.timestamp < cutoffTime) {
        this.notifications.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired notifications`);
    }

    return cleanedCount;
  }

  /**
   * 发送到指定渠道
   */
  private async sendToChannel(notification: Notification, channel: NotificationChannel): Promise<void> {
    notification.attempts++;
    notification.lastAttempt = new Date();

    try {
      switch (channel.type) {
        case NotificationChannelType.WEBSOCKET:
          await this.sendWebSocketNotification(notification, channel);
          break;
        case NotificationChannelType.WEBHOOK:
          await this.sendWebhookNotification(notification, channel);
          break;
        case NotificationChannelType.EMAIL:
          await this.sendEmailNotification(notification, channel);
          break;
        case NotificationChannelType.SLACK:
          await this.sendSlackNotification(notification, channel);
          break;
        default:
          throw new Error(`Unsupported notification channel type: ${channel.type}`);
      }

      notification.status = NotificationStatus.SENT;
      this.logger.log(`Notification sent successfully: ${notification.id} via ${channel.type}`);
      
      // 发送成功事件
      this.eventEmitter.emit('notification.sent', notification);

    } catch (error) {
      notification.error = error.message;
      notification.status = notification.attempts >= this.maxRetries 
        ? NotificationStatus.FAILED 
        : NotificationStatus.RETRYING;

      this.logger.error(`Failed to send notification ${notification.id} via ${channel.type}:`, error);
      
      // 发送失败事件
      this.eventEmitter.emit('notification.failed', notification);

      // 如果还有重试机会，安排重试
      if (notification.attempts < this.maxRetries) {
        setTimeout(() => {
          this.sendToChannel(notification, channel);
        }, this.retryDelay * notification.attempts);
      }
    }
  }

  /**
   * 发送WebSocket通知
   */
  private async sendWebSocketNotification(notification: Notification, channel: NotificationChannel): Promise<void> {
    // 通过事件发送WebSocket通知
    this.eventEmitter.emit('websocket.notification', {
      type: 'alert',
      data: {
        id: notification.id,
        alertId: notification.alertId,
        title: notification.title,
        message: notification.message,
        severity: notification.severity,
        timestamp: notification.timestamp,
      },
    });
  }

  /**
   * 发送Webhook通知
   */
  private async sendWebhookNotification(notification: Notification, channel: NotificationChannel): Promise<void> {
    const { url, method = 'POST', headers = {} } = channel.config;
    
    if (!url) {
      throw new Error('Webhook URL is required');
    }

    const payload = {
      id: notification.id,
      alertId: notification.alertId,
      title: notification.title,
      message: notification.message,
      severity: notification.severity,
      timestamp: notification.timestamp,
    };

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * 发送邮件通知
   */
  private async sendEmailNotification(notification: Notification, channel: NotificationChannel): Promise<void> {
    // TODO: 实现邮件发送逻辑
    // 这里可以集成邮件服务提供商（如SendGrid、AWS SES等）
    this.logger.warn('Email notification not implemented yet');
    throw new Error('Email notification not implemented');
  }

  /**
   * 发送Slack通知
   */
  private async sendSlackNotification(notification: Notification, channel: NotificationChannel): Promise<void> {
    const { webhookUrl } = channel.config;
    
    if (!webhookUrl) {
      throw new Error('Slack webhook URL is required');
    }

    const color = this.getSeverityColor(notification.severity);
    const payload = {
      attachments: [{
        color,
        title: notification.title,
        text: notification.message,
        fields: [
          {
            title: 'Severity',
            value: notification.severity.toUpperCase(),
            short: true,
          },
          {
            title: 'Time',
            value: notification.timestamp.toISOString(),
            short: true,
          },
        ],
        footer: 'MCP Swagger Monitor',
        ts: Math.floor(notification.timestamp.getTime() / 1000),
      }],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook request failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * 检查是否应该发送到指定渠道
   */
  private shouldSendToChannel(alert: Alert, channel: NotificationChannel): boolean {
    if (!channel.enabled) {
      return false;
    }

    if (!channel.filters || channel.filters.length === 0) {
      return true;
    }

    return channel.filters.every(filter => this.evaluateFilter(alert, filter));
  }

  /**
   * 评估过滤器
   */
  private evaluateFilter(alert: Alert, filter: NotificationFilter): boolean {
    const fieldValue = this.getFieldValue(alert, filter.field);
    
    switch (filter.operator) {
      case 'eq': return fieldValue === filter.value;
      case 'ne': return fieldValue !== filter.value;
      case 'in': return Array.isArray(filter.value) && filter.value.includes(fieldValue);
      case 'nin': return Array.isArray(filter.value) && !filter.value.includes(fieldValue);
      case 'gt': return fieldValue > filter.value;
      case 'lt': return fieldValue < filter.value;
      case 'gte': return fieldValue >= filter.value;
      case 'lte': return fieldValue <= filter.value;
      default: return true;
    }
  }

  /**
   * 获取字段值
   */
  private getFieldValue(alert: Alert, field: string): any {
    const fields = field.split('.');
    let value: any = alert;
    
    for (const f of fields) {
      value = value?.[f];
    }
    
    return value;
  }

  /**
   * 格式化消息
   */
  private formatMessage(alert: Alert, channel: NotificationChannel): string {
    const template = channel.config.messageTemplate || '{message}';
    
    return template
      .replace('{title}', alert.title)
      .replace('{message}', alert.message)
      .replace('{severity}', alert.severity)
      .replace('{type}', alert.type)
      .replace('{serverName}', alert.serverName || 'Unknown')
      .replace('{timestamp}', alert.timestamp.toISOString());
  }

  /**
   * 获取严重程度颜色
   */
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.INFO: return 'good';
      case AlertSeverity.WARNING: return 'warning';
      case AlertSeverity.ERROR: return 'danger';
      case AlertSeverity.CRITICAL: return '#ff0000';
      default: return '#cccccc';
    }
  }

  /**
   * 生成通知ID
   */
  private generateNotificationId(): string {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 初始化默认通知渠道
   */
  private initializeDefaultChannels(): void {
    // WebSocket 渠道（默认启用）
    this.addChannel({
      id: 'websocket-default',
      name: 'WebSocket Notifications',
      type: NotificationChannelType.WEBSOCKET,
      enabled: true,
      config: {
        messageTemplate: '[{severity}] {title}: {message}',
      },
    });

    // 从配置中加载其他渠道
    const webhookUrl = this.configService.get<string>('WEBHOOK_NOTIFICATION_URL');
    if (webhookUrl) {
      this.addChannel({
        id: 'webhook-default',
        name: 'Default Webhook',
        type: NotificationChannelType.WEBHOOK,
        enabled: true,
        config: {
          url: webhookUrl,
          method: 'POST',
        },
      });
    }

    const slackWebhookUrl = this.configService.get<string>('SLACK_WEBHOOK_URL');
    if (slackWebhookUrl) {
      this.addChannel({
        id: 'slack-default',
        name: 'Default Slack',
        type: NotificationChannelType.SLACK,
        enabled: true,
        config: {
          webhookUrl: slackWebhookUrl,
        },
        filters: [
          {
            field: 'severity',
            operator: 'in',
            value: [AlertSeverity.ERROR, AlertSeverity.CRITICAL],
          },
        ],
      });
    }

    this.logger.log('Default notification channels initialized');
  }
}