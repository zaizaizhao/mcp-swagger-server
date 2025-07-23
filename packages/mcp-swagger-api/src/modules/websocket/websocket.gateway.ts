import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ServerMetricsService } from '../servers/services/server-metrics.service';
import { ServerHealthService } from '../servers/services/server-health.service';
import { AlertService } from './services/alert.service';
import { NotificationService } from './services/notification.service';
import { WebSocketMetricsService } from './services/websocket-metrics.service';

interface ClientInfo {
  id: string;
  connectedAt: Date;
  subscribedRooms: Set<string>;
  lastActivity: Date;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/monitoring',
})
export class MonitoringGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MonitoringGateway.name);
  private readonly clients = new Map<string, ClientInfo>();
  private readonly rooms = new Set<string>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly serverMetrics: ServerMetricsService,
    private readonly serverHealth: ServerHealthService,
    private readonly alertService: AlertService,
    private readonly notificationService: NotificationService,
    private readonly wsMetricsService: WebSocketMetricsService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    this.setupEventListeners();
  }

  handleConnection(client: Socket) {
    const clientInfo: ClientInfo = {
      id: client.id,
      connectedAt: new Date(),
      subscribedRooms: new Set(),
      lastActivity: new Date(),
    };

    this.clients.set(client.id, clientInfo);
    this.logger.log(`Client connected: ${client.id}`);

    // 记录WebSocket连接指标
    this.wsMetricsService.recordConnection(client);

    // 发送初始连接确认
    client.emit('connection-established', {
      clientId: client.id,
      timestamp: new Date().toISOString(),
      availableRooms: Array.from(this.rooms),
    });

    // 发送当前系统状态
    this.sendInitialData(client);
  }

  handleDisconnect(client: Socket) {
    const clientInfo = this.clients.get(client.id);
    if (clientInfo) {
      this.clients.delete(client.id);
      this.logger.log(`Client disconnected: ${client.id}`);
    }

    // 记录WebSocket断开连接指标
    this.wsMetricsService.recordDisconnection(client.id, 'client_disconnect');
  }

  /**
   * 订阅系统指标推送
   */
  @SubscribeMessage('subscribe-system-metrics')
  handleSubscribeSystemMetrics(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { interval?: number }
  ) {
    const room = 'system-metrics';
    client.join(room);
    this.rooms.add(room);
    
    const clientInfo = this.clients.get(client.id);
    if (clientInfo) {
      clientInfo.subscribedRooms.add(room);
      clientInfo.lastActivity = new Date();
    }

    this.logger.log(`Client ${client.id} subscribed to system metrics`);
    
    // 记录订阅指标
    this.wsMetricsService.recordSubscription(client.id, room);
    
    // 立即发送当前系统指标
    this.sendSystemMetrics(client);
    
    client.emit('subscription-confirmed', {
      room,
      interval: data.interval || 5000,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 订阅服务器指标推送
   */
  @SubscribeMessage('subscribe-server-metrics')
  handleSubscribeServerMetrics(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { serverId: string; interval?: number }
  ) {
    const room = `server-metrics-${data.serverId}`;
    client.join(room);
    this.rooms.add(room);
    
    const clientInfo = this.clients.get(client.id);
    if (clientInfo) {
      clientInfo.subscribedRooms.add(room);
      clientInfo.lastActivity = new Date();
    }

    this.logger.log(`Client ${client.id} subscribed to server ${data.serverId} metrics`);
    
    // 记录订阅指标
    this.wsMetricsService.recordSubscription(client.id, room);
    
    // 立即发送当前服务器指标
    this.sendServerMetrics(client, data.serverId);
    
    client.emit('subscription-confirmed', {
      room,
      serverId: data.serverId,
      interval: data.interval || 5000,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 订阅服务器日志推送
   */
  @SubscribeMessage('subscribe-server-logs')
  handleSubscribeServerLogs(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { serverId: string; level?: string }
  ) {
    const room = `server-logs-${data.serverId}`;
    client.join(room);
    this.rooms.add(room);
    
    const clientInfo = this.clients.get(client.id);
    if (clientInfo) {
      clientInfo.subscribedRooms.add(room);
      clientInfo.lastActivity = new Date();
    }

    this.logger.log(`Client ${client.id} subscribed to server ${data.serverId} logs`);
    
    // 记录订阅指标
    this.wsMetricsService.recordSubscription(client.id, room);
    
    client.emit('subscription-confirmed', {
      room,
      serverId: data.serverId,
      level: data.level || 'info',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 订阅告警通知
   */
  @SubscribeMessage('subscribe-alerts')
  handleSubscribeAlerts(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { severity?: string[] }
  ) {
    const room = 'alerts';
    client.join(room);
    this.rooms.add(room);
    
    const clientInfo = this.clients.get(client.id);
    if (clientInfo) {
      clientInfo.subscribedRooms.add(room);
      clientInfo.lastActivity = new Date();
    }

    this.logger.log(`Client ${client.id} subscribed to alerts`);
    
    // 记录订阅指标
    this.wsMetricsService.recordSubscription(client.id, room);
    
    client.emit('subscription-confirmed', {
      room,
      severity: data.severity || ['warning', 'error', 'critical'],
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 取消订阅
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string }
  ) {
    client.leave(data.room);
    
    const clientInfo = this.clients.get(client.id);
    if (clientInfo) {
      clientInfo.subscribedRooms.delete(data.room);
      clientInfo.lastActivity = new Date();
    }

    this.logger.log(`Client ${client.id} unsubscribed from ${data.room}`);
    
    // 记录取消订阅指标
    this.wsMetricsService.recordUnsubscription(client.id, data.room);
    
    client.emit('unsubscription-confirmed', {
      room: data.room,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 获取连接状态
   */
  @SubscribeMessage('get-connection-status')
  handleGetConnectionStatus(@ConnectedSocket() client: Socket) {
    const clientInfo = this.clients.get(client.id);
    
    client.emit('connection-status', {
      clientId: client.id,
      connectedAt: clientInfo?.connectedAt,
      subscribedRooms: Array.from(clientInfo?.subscribedRooms || []),
      lastActivity: clientInfo?.lastActivity,
      totalClients: this.clients.size,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 定时推送系统指标
   */
  @Cron(CronExpression.EVERY_5_SECONDS)
  async pushSystemMetrics() {
    // 检查server和adapter是否可用
    if (!this.server || !this.server.sockets || !this.server.sockets.adapter || !this.server.sockets.adapter.rooms) {
      return;
    }

    if (this.server.sockets.adapter.rooms.has('system-metrics')) {
      try {
        const metrics = await this.serverMetrics.collectSystemMetrics();
        this.server.to('system-metrics').emit('system-metrics-update', {
          data: metrics,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        this.logger.error('Failed to push system metrics:', error);
      }
    }
  }

  /**
   * 定时推送服务器指标
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async pushServerMetrics() {
    // 检查server和adapter是否可用
    if (!this.server || !this.server.sockets || !this.server.sockets.adapter || !this.server.sockets.adapter.rooms) {
      return;
    }

    for (const room of this.rooms) {
      if (room.startsWith('server-metrics-') && this.server.sockets.adapter.rooms.has(room)) {
        const serverId = room.replace('server-metrics-', '');
        try {
          const metrics = await this.serverMetrics.collectServerMetrics(serverId);
          this.server.to(room).emit('server-metrics-update', {
            serverId,
            data: metrics,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          this.logger.error(`Failed to push metrics for server ${serverId}:`, error);
        }
      }
    }
  }

  /**
   * 监听服务器状态变化事件
   */
  @OnEvent('server.status.changed')
  handleServerStatusChanged(payload: { serverId: string; status: string; timestamp: Date }) {
    this.server.emit('server-status-changed', {
      serverId: payload.serverId,
      status: payload.status,
      timestamp: payload.timestamp.toISOString(),
    });

    // 发送到特定服务器的订阅者
    const room = `server-metrics-${payload.serverId}`;
    if (this.server && this.server.sockets && this.server.sockets.adapter && this.server.sockets.adapter.rooms && this.server.sockets.adapter.rooms.has(room)) {
      this.server.to(room).emit('server-status-changed', {
        serverId: payload.serverId,
        status: payload.status,
        timestamp: payload.timestamp.toISOString(),
      });
    }
  }

  /**
   * 监听服务器健康状态变化事件
   */
  @OnEvent('server.health.changed')
  handleServerHealthChanged(payload: { serverId: string; healthy: boolean; error?: string; timestamp: Date }) {
    this.server.emit('server-health-changed', {
      serverId: payload.serverId,
      healthy: payload.healthy,
      error: payload.error,
      timestamp: payload.timestamp.toISOString(),
    });

    // 如果健康状态变为不健康，发送告警
    if (!payload.healthy) {
      this.sendAlert({
        type: 'server-unhealthy',
        severity: 'warning',
        serverId: payload.serverId,
        message: `Server ${payload.serverId} is unhealthy: ${payload.error || 'Unknown error'}`,
        timestamp: payload.timestamp,
      });
    }
  }

  /**
   * 监听日志事件
   */
  @OnEvent('server.log')
  handleServerLog(payload: { serverId: string; level: string; message: string; timestamp: Date; source: string }) {
    const room = `server-logs-${payload.serverId}`;
    if (this.server && this.server.sockets && this.server.sockets.adapter && this.server.sockets.adapter.rooms && this.server.sockets.adapter.rooms.has(room)) {
      this.server.to(room).emit('server-log', {
        serverId: payload.serverId,
        level: payload.level,
        message: payload.message,
        source: payload.source,
        timestamp: payload.timestamp.toISOString(),
      });
    }

    // 如果是错误或警告级别，发送告警
    if (['error', 'warn', 'fatal'].includes(payload.level.toLowerCase())) {
      this.sendAlert({
        type: 'log-alert',
        severity: payload.level === 'fatal' ? 'critical' : payload.level === 'error' ? 'error' : 'warning',
        serverId: payload.serverId,
        message: payload.message,
        source: payload.source,
        timestamp: payload.timestamp,
      });
    }
  }

  /**
   * 发送告警
   */
  private sendAlert(alert: {
    type: string;
    severity: string;
    serverId?: string;
    message: string;
    source?: string;
    timestamp: Date;
  }) {
    if (this.server && this.server.sockets && this.server.sockets.adapter && this.server.sockets.adapter.rooms && this.server.sockets.adapter.rooms.has('alerts')) {
      this.server.to('alerts').emit('alert', {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: alert.type,
        severity: alert.severity,
        serverId: alert.serverId,
        message: alert.message,
        source: alert.source,
        timestamp: alert.timestamp.toISOString(),
      });
    }
  }

  /**
   * 发送初始数据
   */
  private async sendInitialData(client: Socket) {
    try {
      // 发送系统概览
      const systemMetrics = await this.serverMetrics.collectSystemMetrics();
      client.emit('initial-system-metrics', {
        data: systemMetrics,
        timestamp: new Date().toISOString(),
      });

      // 发送连接统计
      client.emit('connection-stats', {
        totalClients: this.clients.size,
        activeRooms: Array.from(this.rooms),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to send initial data:', error);
    }
  }

  /**
   * 发送系统指标
   */
  private async sendSystemMetrics(client: Socket) {
    try {
      const metrics = await this.serverMetrics.collectSystemMetrics();
      client.emit('system-metrics-update', {
        data: metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to send system metrics:', error);
    }
  }

  /**
   * 发送服务器指标
   */
  private async sendServerMetrics(client: Socket, serverId: string) {
    try {
      const metrics = await this.serverMetrics.collectServerMetrics(serverId);
      client.emit('server-metrics-update', {
        serverId,
        data: metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Failed to send server metrics for ${serverId}:`, error);
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners() {
    // 监听系统级别的事件
    this.eventEmitter.on('system.alert', (alert) => {
      this.sendAlert(alert);
    });

    // 监听性能阈值告警
    this.eventEmitter.on('performance.threshold.exceeded', (data) => {
      this.sendAlert({
        type: 'performance-threshold',
        severity: 'warning',
        serverId: data.serverId,
        message: `Performance threshold exceeded: ${data.metric} = ${data.value} (threshold: ${data.threshold})`,
        timestamp: new Date(),
      });
    });
  }

  /**
   * 获取连接统计
   */
  getConnectionStats() {
    return {
      totalClients: this.clients.size,
      activeRooms: Array.from(this.rooms),
      clientDetails: Array.from(this.clients.entries()).map(([id, info]) => ({
        id,
        connectedAt: info.connectedAt,
        subscribedRooms: Array.from(info.subscribedRooms),
        lastActivity: info.lastActivity,
      })),
    };
  }

  /**
   * 广播系统通知
   */
  broadcastSystemNotification(notification: {
    type: string;
    title: string;
    message: string;
    severity?: string;
  }) {
    this.server.emit('system-notification', {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    });
  }
}