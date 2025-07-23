import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Socket } from 'socket.io';

export interface WebSocketConnection {
  id: string;
  socketId: string;
  clientId?: string;
  userAgent?: string;
  ipAddress?: string;
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: Set<string>;
  messagesSent: number;
  messagesReceived: number;
  bytesTransferred: number;
  status: ConnectionStatus;
}

export enum ConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  IDLE = 'idle',
  ACTIVE = 'active',
}

export interface WebSocketMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  totalBytesTransferred: number;
  averageConnectionDuration: number;
  peakConnections: number;
  connectionsBySubscription: Record<string, number>;
  messageRatePerSecond: number;
  errorRate: number;
  uptime: number;
}

export interface ConnectionEvent {
  type: 'connect' | 'disconnect' | 'message' | 'error' | 'subscribe' | 'unsubscribe';
  connectionId: string;
  timestamp: Date;
  data?: any;
}

@Injectable()
export class WebSocketMetricsService {
  private readonly logger = new Logger(WebSocketMetricsService.name);
  private readonly connections = new Map<string, WebSocketConnection>();
  private readonly events: ConnectionEvent[] = [];
  private readonly maxEvents = 10000; // 保留最近10000个事件
  private readonly idleTimeout = 5 * 60 * 1000; // 5分钟无活动视为空闲
  
  private startTime = new Date();
  private peakConnections = 0;
  private totalConnectionsEver = 0;
  private totalDisconnections = 0;
  private totalErrors = 0;
  private lastMessageCount = 0;
  private messageRateHistory: number[] = [];

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.logger.log('WebSocket metrics service initialized');
  }

  /**
   * 记录新连接
   */
  recordConnection(socket: Socket): void {
    const connection: WebSocketConnection = {
      id: this.generateConnectionId(),
      socketId: socket.id,
      clientId: socket.handshake.query.clientId as string,
      userAgent: socket.handshake.headers['user-agent'],
      ipAddress: socket.handshake.address,
      connectedAt: new Date(),
      lastActivity: new Date(),
      subscriptions: new Set(),
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0,
      status: ConnectionStatus.CONNECTED,
    };

    this.connections.set(connection.id, connection);
    this.totalConnectionsEver++;

    // 更新峰值连接数
    const currentConnections = this.getActiveConnectionCount();
    if (currentConnections > this.peakConnections) {
      this.peakConnections = currentConnections;
    }

    this.recordEvent({
      type: 'connect',
      connectionId: connection.id,
      timestamp: new Date(),
      data: {
        socketId: socket.id,
        clientId: connection.clientId,
        userAgent: connection.userAgent,
        ipAddress: connection.ipAddress,
      },
    });

    this.logger.log(`New WebSocket connection: ${connection.id} (${socket.id})`);
    
    // 发送连接事件
    this.eventEmitter.emit('websocket.connection.created', connection);
  }

  /**
   * 记录连接断开
   */
  recordDisconnection(socketId: string, reason?: string): void {
    const connection = this.findConnectionBySocketId(socketId);
    if (!connection) {
      return;
    }

    connection.status = ConnectionStatus.DISCONNECTED;
    this.totalDisconnections++;

    this.recordEvent({
      type: 'disconnect',
      connectionId: connection.id,
      timestamp: new Date(),
      data: { reason },
    });

    this.logger.log(`WebSocket disconnection: ${connection.id} (${socketId}) - ${reason || 'unknown'}`);
    
    // 发送断开连接事件
    this.eventEmitter.emit('websocket.connection.closed', connection);

    // 延迟删除连接记录（保留一段时间用于统计）
    setTimeout(() => {
      this.connections.delete(connection.id);
    }, 60000); // 1分钟后删除
  }

  /**
   * 记录消息发送
   */
  recordMessageSent(socketId: string, event: string, data: any): void {
    const connection = this.findConnectionBySocketId(socketId);
    if (!connection) {
      return;
    }

    connection.messagesSent++;
    connection.lastActivity = new Date();
    connection.status = ConnectionStatus.ACTIVE;
    
    const messageSize = this.calculateMessageSize(data);
    connection.bytesTransferred += messageSize;

    this.recordEvent({
      type: 'message',
      connectionId: connection.id,
      timestamp: new Date(),
      data: {
        direction: 'sent',
        event,
        size: messageSize,
      },
    });
  }

  /**
   * 记录消息接收
   */
  recordMessageReceived(socketId: string, event: string, data: any): void {
    const connection = this.findConnectionBySocketId(socketId);
    if (!connection) {
      return;
    }

    connection.messagesReceived++;
    connection.lastActivity = new Date();
    connection.status = ConnectionStatus.ACTIVE;
    
    const messageSize = this.calculateMessageSize(data);
    connection.bytesTransferred += messageSize;

    this.recordEvent({
      type: 'message',
      connectionId: connection.id,
      timestamp: new Date(),
      data: {
        direction: 'received',
        event,
        size: messageSize,
      },
    });
  }

  /**
   * 记录订阅
   */
  recordSubscription(socketId: string, subscription: string): void {
    const connection = this.findConnectionBySocketId(socketId);
    if (!connection) {
      return;
    }

    connection.subscriptions.add(subscription);
    connection.lastActivity = new Date();

    this.recordEvent({
      type: 'subscribe',
      connectionId: connection.id,
      timestamp: new Date(),
      data: { subscription },
    });

    this.logger.debug(`Subscription added: ${connection.id} -> ${subscription}`);
  }

  /**
   * 记录取消订阅
   */
  recordUnsubscription(socketId: string, subscription: string): void {
    const connection = this.findConnectionBySocketId(socketId);
    if (!connection) {
      return;
    }

    connection.subscriptions.delete(subscription);
    connection.lastActivity = new Date();

    this.recordEvent({
      type: 'unsubscribe',
      connectionId: connection.id,
      timestamp: new Date(),
      data: { subscription },
    });

    this.logger.debug(`Subscription removed: ${connection.id} -> ${subscription}`);
  }

  /**
   * 记录错误
   */
  recordError(socketId: string, error: Error): void {
    const connection = this.findConnectionBySocketId(socketId);
    
    this.totalErrors++;

    this.recordEvent({
      type: 'error',
      connectionId: connection?.id || 'unknown',
      timestamp: new Date(),
      data: {
        message: error.message,
        stack: error.stack,
      },
    });

    this.logger.error(`WebSocket error: ${error.message}`, error.stack);
  }

  /**
   * 获取当前指标
   */
  getMetrics(): WebSocketMetrics {
    const activeConnections = this.getActiveConnectionCount();
    const idleConnections = this.getIdleConnectionCount();
    const totalMessagesSent = this.getTotalMessagesSent();
    const totalMessagesReceived = this.getTotalMessagesReceived();
    const totalBytesTransferred = this.getTotalBytesTransferred();
    const averageConnectionDuration = this.getAverageConnectionDuration();
    const connectionsBySubscription = this.getConnectionsBySubscription();
    const messageRatePerSecond = this.getMessageRatePerSecond();
    const errorRate = this.getErrorRate();
    const uptime = Date.now() - this.startTime.getTime();

    return {
      totalConnections: this.totalConnectionsEver,
      activeConnections,
      idleConnections,
      totalMessagesSent,
      totalMessagesReceived,
      totalBytesTransferred,
      averageConnectionDuration,
      peakConnections: this.peakConnections,
      connectionsBySubscription,
      messageRatePerSecond,
      errorRate,
      uptime,
    };
  }

  /**
   * 获取连接列表
   */
  getConnections(filters?: {
    status?: ConnectionStatus;
    subscription?: string;
    clientId?: string;
    limit?: number;
  }): WebSocketConnection[] {
    let connections = Array.from(this.connections.values());

    if (filters) {
      if (filters.status) {
        connections = connections.filter(conn => conn.status === filters.status);
      }
      if (filters.subscription) {
        connections = connections.filter(conn => conn.subscriptions.has(filters.subscription!));
      }
      if (filters.clientId) {
        connections = connections.filter(conn => conn.clientId === filters.clientId);
      }
    }

    // 按连接时间倒序排列
    connections.sort((a, b) => b.connectedAt.getTime() - a.connectedAt.getTime());

    if (filters?.limit) {
      connections = connections.slice(0, filters.limit);
    }

    return connections;
  }

  /**
   * 获取事件历史
   */
  getEvents(filters?: {
    type?: ConnectionEvent['type'];
    connectionId?: string;
    limit?: number;
    since?: Date;
  }): ConnectionEvent[] {
    let events = [...this.events];

    if (filters) {
      if (filters.type) {
        events = events.filter(event => event.type === filters.type);
      }
      if (filters.connectionId) {
        events = events.filter(event => event.connectionId === filters.connectionId);
      }
      if (filters.since) {
        events = events.filter(event => event.timestamp >= filters.since!);
      }
    }

    // 按时间倒序排列
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters?.limit) {
      events = events.slice(0, filters.limit);
    }

    return events;
  }

  /**
   * 获取连接统计
   */
  getConnectionStats(): {
    byStatus: Record<ConnectionStatus, number>;
    byUserAgent: Record<string, number>;
    bySubscription: Record<string, number>;
    connectionDurations: number[];
    messageDistribution: { sent: number[]; received: number[] };
  } {
    const connections = Array.from(this.connections.values());
    
    const stats = {
      byStatus: {
        [ConnectionStatus.CONNECTED]: 0,
        [ConnectionStatus.DISCONNECTED]: 0,
        [ConnectionStatus.IDLE]: 0,
        [ConnectionStatus.ACTIVE]: 0,
      },
      byUserAgent: {} as Record<string, number>,
      bySubscription: {} as Record<string, number>,
      connectionDurations: [] as number[],
      messageDistribution: {
        sent: [] as number[],
        received: [] as number[],
      },
    };

    connections.forEach(connection => {
      stats.byStatus[connection.status]++;
      
      if (connection.userAgent) {
        const userAgent = this.simplifyUserAgent(connection.userAgent);
        stats.byUserAgent[userAgent] = (stats.byUserAgent[userAgent] || 0) + 1;
      }
      
      connection.subscriptions.forEach(subscription => {
        stats.bySubscription[subscription] = (stats.bySubscription[subscription] || 0) + 1;
      });
      
      const duration = Date.now() - connection.connectedAt.getTime();
      stats.connectionDurations.push(duration);
      
      stats.messageDistribution.sent.push(connection.messagesSent);
      stats.messageDistribution.received.push(connection.messagesReceived);
    });

    return stats;
  }

  /**
   * 定时更新连接状态
   */
  @Cron(CronExpression.EVERY_MINUTE)
  updateConnectionStatuses(): void {
    const now = new Date();
    let updatedCount = 0;

    for (const connection of this.connections.values()) {
      if (connection.status === ConnectionStatus.DISCONNECTED) {
        continue;
      }

      const timeSinceLastActivity = now.getTime() - connection.lastActivity.getTime();
      
      if (timeSinceLastActivity > this.idleTimeout) {
        if (connection.status !== ConnectionStatus.IDLE) {
          connection.status = ConnectionStatus.IDLE;
          updatedCount++;
        }
      } else if (connection.status === ConnectionStatus.IDLE) {
        connection.status = ConnectionStatus.ACTIVE;
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      this.logger.debug(`Updated status for ${updatedCount} connections`);
    }
  }

  /**
   * 定时计算消息速率
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  calculateMessageRate(): void {
    const currentMessageCount = this.getTotalMessagesSent() + this.getTotalMessagesReceived();
    const messagesSinceLastCheck = currentMessageCount - this.lastMessageCount;
    const rate = messagesSinceLastCheck / 10; // 每秒消息数
    
    this.messageRateHistory.push(rate);
    
    // 保留最近60个数据点（10分钟）
    if (this.messageRateHistory.length > 60) {
      this.messageRateHistory.shift();
    }
    
    this.lastMessageCount = currentMessageCount;
  }

  /**
   * 定时发送指标事件
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  emitMetricsEvent(): void {
    const metrics = this.getMetrics();
    this.eventEmitter.emit('websocket.metrics.updated', metrics);
  }

  /**
   * 清理过期事件
   */
  @Cron(CronExpression.EVERY_HOUR)
  cleanupEvents(): void {
    if (this.events.length > this.maxEvents) {
      const toRemove = this.events.length - this.maxEvents;
      this.events.splice(0, toRemove);
      this.logger.log(`Cleaned up ${toRemove} old WebSocket events`);
    }
  }

  // 私有方法

  private findConnectionBySocketId(socketId: string): WebSocketConnection | undefined {
    return Array.from(this.connections.values()).find(conn => conn.socketId === socketId);
  }

  private getActiveConnectionCount(): number {
    return Array.from(this.connections.values())
      .filter(conn => conn.status === ConnectionStatus.CONNECTED || conn.status === ConnectionStatus.ACTIVE)
      .length;
  }

  private getIdleConnectionCount(): number {
    return Array.from(this.connections.values())
      .filter(conn => conn.status === ConnectionStatus.IDLE)
      .length;
  }

  private getTotalMessagesSent(): number {
    return Array.from(this.connections.values())
      .reduce((total, conn) => total + conn.messagesSent, 0);
  }

  private getTotalMessagesReceived(): number {
    return Array.from(this.connections.values())
      .reduce((total, conn) => total + conn.messagesReceived, 0);
  }

  private getTotalBytesTransferred(): number {
    return Array.from(this.connections.values())
      .reduce((total, conn) => total + conn.bytesTransferred, 0);
  }

  private getAverageConnectionDuration(): number {
    const connections = Array.from(this.connections.values());
    if (connections.length === 0) return 0;

    const totalDuration = connections.reduce((total, conn) => {
      const duration = Date.now() - conn.connectedAt.getTime();
      return total + duration;
    }, 0);

    return totalDuration / connections.length;
  }

  private getConnectionsBySubscription(): Record<string, number> {
    const result: Record<string, number> = {};
    
    for (const connection of this.connections.values()) {
      for (const subscription of connection.subscriptions) {
        result[subscription] = (result[subscription] || 0) + 1;
      }
    }
    
    return result;
  }

  private getMessageRatePerSecond(): number {
    if (this.messageRateHistory.length === 0) return 0;
    
    const sum = this.messageRateHistory.reduce((total, rate) => total + rate, 0);
    return sum / this.messageRateHistory.length;
  }

  private getErrorRate(): number {
    const totalMessages = this.getTotalMessagesSent() + this.getTotalMessagesReceived();
    if (totalMessages === 0) return 0;
    
    return (this.totalErrors / totalMessages) * 100;
  }

  private calculateMessageSize(data: any): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  private simplifyUserAgent(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    return 'Other';
  }

  private generateConnectionId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private recordEvent(event: ConnectionEvent): void {
    this.events.push(event);
    
    // 如果事件太多，删除最旧的
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }
}