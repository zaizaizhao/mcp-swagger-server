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
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  namespace: '/monitoring',
  // 添加WebSocket特定配置
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
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
    console.log("客户端连接", client);
    
    const clientInfo: ClientInfo = {
      id: client.id,
      connectedAt: new Date(),
      subscribedRooms: new Set(),
      lastActivity: new Date(),
    };
    console.log("客户端连接", clientInfo);
    this.clients.set(client.id, clientInfo);
    this.logger.log(`Client connected: ${client.id} from ${client.handshake.address}`);
    this.logger.log(`Client handshake query: ${JSON.stringify(client.handshake.query, null, 2)}`);
    this.logger.log(`Client handshake headers: ${JSON.stringify(client.handshake.headers, null, 2)}`);
    this.logger.log(`Total connected clients: ${this.clients.size}`);
    this.logger.log(`Client transport: ${client.conn.transport.name}`);
    this.logger.log(`Client upgraded: ${client.conn.upgraded}`);

    // 添加通用消息监听器来调试所有接收到的事件
    client.onAny((eventName, ...args) => {
      this.logger.log(`[DEBUG] Received event '${eventName}' from client ${client.id} with args:`, args);
    });
    
    // 监听客户端断开前的事件
    client.on('disconnecting', (reason) => {
      this.logger.log(`🔄 Client ${client.id} is disconnecting with reason: ${reason}`);
      const rooms = Array.from(client.rooms);
      this.logger.log(`🔄 Client ${client.id} was in rooms: ${rooms}`);
      this.logger.log(`🔄 Client transport before disconnect: ${client.conn.transport.name}`);
      this.logger.log(`🔄 Client connection state: connected=${client.connected}, disconnected=${client.disconnected}`);
    });
    
    // 添加错误事件监听
    client.on('error', (error) => {
      this.logger.error(`❌ Client ${client.id} error:`, error);
    });
    
    // 添加ping/pong监听
    client.on('ping', () => {
      this.logger.debug(`🏓 Ping received from client ${client.id}`);
    });
    
    client.on('pong', (latency) => {
      this.logger.debug(`🏓 Pong received from client ${client.id}, latency: ${latency}ms`);
    });

    // 记录WebSocket连接指标
    this.wsMetricsService.recordConnection(client);

    // 发送初始连接确认
    client.emit('connection-established', {
      clientId: client.id,
      timestamp: new Date().toISOString(),
      availableRooms: Array.from(this.rooms),
      transport: client.conn.transport.name,
      upgraded: client.conn.upgraded,
    });

    // 发送当前系统状态
    this.sendInitialData(client);
  }

  handleDisconnect(client: Socket) {
    const clientInfo = this.clients.get(client.id);
    if (clientInfo) {
      this.logger.log(`Client disconnected: ${client.id} from ${client.handshake.address}`);
      this.logger.log(`Disconnection reason: ${client.disconnected ? 'client initiated' : 'server initiated'}`);
      this.logger.log(`Subscribed rooms before disconnect: ${Array.from(clientInfo.subscribedRooms)}`);
      
      // 清理客户端的所有房间订阅
      clientInfo.subscribedRooms.forEach(room => {
        client.leave(room);
        this.logger.log(`Client ${client.id} left room: ${room}`);
      });
      
      this.clients.delete(client.id);
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
    this.logger.log(`[handleSubscribeServerMetrics] 📥 Client ${client.id} requesting to join room: ${room}`);
    this.logger.log(`[handleSubscribeServerMetrics] 📋 Subscription data:`, JSON.stringify(data, null, 2));
    this.logger.log(`[handleSubscribeServerMetrics] 🔍 Client connection state: connected=${client.connected}, disconnected=${client.disconnected}`);
    
    try {
      // 验证客户端状态
      if (!client.connected) {
        this.logger.error(`[handleSubscribeServerMetrics] ❌ Client ${client.id} is not connected!`);
        return;
      }
      
      // 加入房间
      this.logger.log(`[handleSubscribeServerMetrics] 🚪 Adding client ${client.id} to room ${room}`);
      client.join(room);
      this.rooms.add(room);
      
      // 立即验证房间加入是否成功
      const roomMap = this.server?.sockets?.adapter?.rooms?.get(room);
      const roomSize = roomMap ? roomMap.size : 0;
      this.logger.log(`[handleSubscribeServerMetrics] ✅ Client ${client.id} joined room ${room}, current room size: ${roomSize}`);
      
      if (roomSize === 0) {
        this.logger.error(`[handleSubscribeServerMetrics] 🚨 CRITICAL: Room size is 0 immediately after join!`);
        this.logger.error(`[handleSubscribeServerMetrics] 🔍 Room map:`, roomMap);
        this.logger.error(`[handleSubscribeServerMetrics] 🔍 Server adapter:`, !!this.server?.sockets?.adapter);
      }
      
      const clientInfo = this.clients.get(client.id);
      if (clientInfo) {
        clientInfo.subscribedRooms.add(room);
        clientInfo.lastActivity = new Date();
        this.logger.log(`[handleSubscribeServerMetrics] Updated client info, subscribed rooms: ${Array.from(clientInfo.subscribedRooms)}`);
      } else {
        this.logger.warn(`[handleSubscribeServerMetrics] ⚠️ Client info not found for ${client.id}`);
      }

      this.logger.log(`[handleSubscribeServerMetrics] 🎯 Client ${client.id} subscribed to server ${data.serverId} metrics, room: ${room}`);
      
      // 记录订阅指标
      this.wsMetricsService.recordSubscription(client.id, room);
      
      // 立即发送当前服务器指标
      this.logger.log(`[handleSubscribeServerMetrics] 📤 Sending current metrics to client ${client.id}`);
      this.sendServerMetrics(client, data.serverId);
      
      // 发送订阅确认
      const confirmationData = {
        room,
        serverId: data.serverId,
        interval: data.interval || 5000,
        timestamp: new Date().toISOString(),
      };
      this.logger.log(`[handleSubscribeServerMetrics] 📨 Sending subscription confirmation:`, confirmationData);
      client.emit('subscription-confirmed', confirmationData);
      
      this.logger.log(`[handleSubscribeServerMetrics] ✅ Subscription confirmed for client ${client.id}, room: ${room}`);
      
      // 额外验证：检查房间状态（多次检查）
      const verificationChecks = [500, 1000, 2000];
      verificationChecks.forEach((delay, index) => {
        setTimeout(() => {
          const verifyRoomMap = this.server?.sockets?.adapter?.rooms?.get(room);
          const verifyRoomSize = verifyRoomMap ? verifyRoomMap.size : 0;
          this.logger.log(`[handleSubscribeServerMetrics] 🔍 Room verification ${index + 1} after ${delay}ms - ${room}: size=${verifyRoomSize}`);
          
          if (verifyRoomSize === 0) {
            this.logger.error(`[handleSubscribeServerMetrics] ❌ Client ${client.id} disappeared from room ${room} after ${delay}ms!`);
            this.logger.error(`[handleSubscribeServerMetrics] Client connection state: connected=${client.connected}, disconnected=${client.disconnected}`);
            
            // 尝试重新添加客户端到房间
            if (client.connected) {
              this.logger.log(`[handleSubscribeServerMetrics] 🔄 Attempting to re-add client ${client.id} to room ${room}`);
              client.join(room);
              
              // 再次验证
              setTimeout(() => {
                const reVerifyRoomMap = this.server?.sockets?.adapter?.rooms?.get(room);
                const reVerifyRoomSize = reVerifyRoomMap ? reVerifyRoomMap.size : 0;
                this.logger.log(`[handleSubscribeServerMetrics] 🔍 Re-verification after rejoin - ${room}: size=${reVerifyRoomSize}`);
              }, 200);
            }
          } else {
            this.logger.log(`[handleSubscribeServerMetrics] ✅ Room ${room} still has ${verifyRoomSize} clients after ${delay}ms`);
          }
        }, delay);
      });
      
    } catch (error) {
      this.logger.error(`[handleSubscribeServerMetrics] ❌ Error during subscription:`, error);
    }
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
   * 处理心跳ping
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() data: { timestamp: number }) {
    this.logger.debug(`🏓 Received ping from client ${client.id}, timestamp: ${data.timestamp}`);
    
    // 更新客户端活动时间
    const clientInfo = this.clients.get(client.id);
    if (clientInfo) {
      clientInfo.lastActivity = new Date();
    }
    
    // 发送pong响应
    client.emit('pong', {
      timestamp: data.timestamp,
      serverTime: Date.now(),
      latency: Date.now() - data.timestamp
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
      if (room.startsWith('server-metrics-')) {
        const serverId = room.replace('server-metrics-', '');
        
        // 检查是否有客户端订阅了这个房间
        const roomSet = this.server?.sockets?.adapter?.rooms?.get(room);
        const roomSize = roomSet ? roomSet.size : 0;
        const hasClients = roomSize > 0;
        
        this.logger.log(`Room ${room} size: ${roomSize}, has clients: ${hasClients}`);
        
        if (!hasClients) {
          // 不再显示警告，因为这是正常情况（没有客户端订阅时）
          this.logger.debug(`No clients subscribed to room ${room}`);
          continue;
        }
        
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
  handleServerStatusChanged(payload: { serverId: string; status: string; timestamp?: Date }) {
    const timestamp = payload.timestamp || new Date();
    this.server.emit('server-status-changed', {
      serverId: payload.serverId,
      status: payload.status,
      timestamp: timestamp.toISOString(),
    });

    // 发送到特定服务器的订阅者
    const room = `server-metrics-${payload.serverId}`;
    if (this.server && this.server.sockets && this.server.sockets.adapter && this.server.sockets.adapter.rooms && this.server.sockets.adapter.rooms.has(room)) {
      this.server.to(room).emit('server-status-changed', {
        serverId: payload.serverId,
        status: payload.status,
        timestamp: timestamp.toISOString(),
      });
    }
  }

  /**
   * 监听服务器健康状态变化事件
   */
  @OnEvent('server.health.changed')
  handleServerHealthChanged(payload: { serverId: string; healthy: boolean; error?: string; timestamp?: Date }) {
    const timestamp = payload.timestamp || new Date();
    this.server.emit('server-health-changed', {
      serverId: payload.serverId,
      healthy: payload.healthy,
      error: payload.error,
      timestamp: timestamp.toISOString(),
    });

    // 如果健康状态变为不健康，发送告警
    if (!payload.healthy) {
      this.sendAlert({
        type: 'server-unhealthy',
        severity: 'warning',
        serverId: payload.serverId,
        message: `Server ${payload.serverId} is unhealthy: ${payload.error || 'Unknown error'}`,
        timestamp: timestamp,
      });
    }
  }

  /**
   * 监听日志事件
   */
  @OnEvent('server.log')
  handleServerLog(payload: { serverId: string; level: string; message: string; timestamp?: Date; source: string }) {
    const timestamp = payload.timestamp || new Date();
    const room = `server-logs-${payload.serverId}`;
    if (this.server && this.server.sockets && this.server.sockets.adapter && this.server.sockets.adapter.rooms && this.server.sockets.adapter.rooms.has(room)) {
      this.server.to(room).emit('server-log', {
        serverId: payload.serverId,
        level: payload.level,
        message: payload.message,
        source: payload.source,
        timestamp: timestamp.toISOString(),
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
        timestamp: timestamp,
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
   * 监听进程信息变化事件
   */
  @OnEvent('process.info.updated')
  handleProcessInfoUpdated(payload: { serverId: string; processInfo: any; timestamp?: Date }) {
    this.logger.log(`Received process.info.updated event for server ${payload.serverId}`);
    const timestamp = payload.timestamp || new Date();
    const room = `server-metrics-${payload.serverId}`;
    
    // 使用更可靠的方法检查房间
    const roomSet = this.server?.sockets?.adapter?.rooms?.get(room);
    const roomSize = roomSet ? roomSet.size : 0;
    const hasClients = roomSize > 0;
    
    this.logger.log(`Room ${room} size: ${roomSize}, has clients: ${hasClients}`);
    
    if (hasClients) {
      try {
        this.server.to(room).emit('server-metrics-update', {
          serverId: payload.serverId,
          data: payload.processInfo,
          timestamp: timestamp.toISOString(),
        });
        this.logger.log(`✅ Emitted server-metrics-update to room ${room} with ${roomSize} clients`);
      } catch (error) {
        this.logger.error(`Failed to emit to room ${room}:`, error);
      }
    } else {
      // 不再显示警告，因为这是正常情况（没有客户端订阅时）
      this.logger.debug(`No clients subscribed to room ${room}`);
    }
  }

  /**
   * 监听进程日志事件
   */
  @OnEvent('process.logs.updated')
  handleProcessLogsUpdated(payload: { serverId: string; logData: any; timestamp?: Date }) {
    const timestamp = payload.timestamp || new Date();
    const room = `server-logs-${payload.serverId}`;
    if (this.server && this.server.sockets && this.server.sockets.adapter && this.server.sockets.adapter.rooms && this.server.sockets.adapter.rooms.has(room)) {
      this.server.to(room).emit('process:logs', {
        serverId: payload.serverId,
        logData: payload.logData,
        timestamp: timestamp.toISOString(),
      });
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