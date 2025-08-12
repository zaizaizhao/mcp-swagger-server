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
  private readonly roomMembers = new Map<string, Set<string>>(); // 内部房间成员跟踪
  private readonly debugEnabled = process.env.WS_DEBUG === 'true';

  private d(message: string, meta?: any) {
    if (!this.debugEnabled) return;
    if (meta !== undefined) {
      this.logger.log(`[DEBUG] ${message} ${typeof meta === 'string' ? meta : JSON.stringify(meta)}`);
    } else {
      this.logger.log(`[DEBUG] ${message}`);
    }
  }

  private getNamespace(): any {
    // 统一获取命名空间实例
    return (this.server as any)?.of?.('/monitoring') || this.server;
  }

  private addRoomMember(room: string, clientId: string) {
    let set = this.roomMembers.get(room);
    if (!set) {
      set = new Set<string>();
      this.roomMembers.set(room, set);
    }
    set.add(clientId);
  }

  private removeRoomMember(room: string, clientId: string) {
    const set = this.roomMembers.get(room);
    if (set) {
      set.delete(clientId);
      if (set.size === 0) this.roomMembers.delete(room);
    }
  }

  private getRoomInternalSize(room: string) {
    return this.roomMembers.get(room)?.size || 0;
  }

  private emitToRoom(room: string, event: string, payload: any) {
    const ns = this.getNamespace();
    // 如果 adapter 丢失但内部记录存在, 逐个成员直发
    const internal = this.roomMembers.get(room);
    if (!internal || internal.size === 0) return;
    try {
      if (ns?.to) {
        ns.to(room).emit(event, payload);
      } else {
        // 兜底: 直接对每个 socket 单播
        internal.forEach(id => {
          const s = ns.sockets?.get?.(id) || (ns.sockets && (ns.sockets as any)[id]);
          s?.emit(event, payload);
        });
      }
    } catch (e) {
      this.logger.error(`[emitToRoom] Failed emit to ${room}:`, e);
    }
  }

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
    // 仅关键日志
    const clientInfo: ClientInfo = {
      id: client.id,
      connectedAt: new Date(),
      subscribedRooms: new Set(),
      lastActivity: new Date(),
    };
    this.clients.set(client.id, clientInfo);
    this.logger.log(`Client connected: ${client.id}`);
    this.d(`Handshake query: ${JSON.stringify(client.handshake.query)}`);

    if (this.debugEnabled) {
      // 可选调试事件监听
      client.onAny((eventName, ...args) => {
        this.d(`Received event '${eventName}' from ${client.id}`);
      });
    }

    client.on('disconnecting', (reason) => {
      this.d(`Client ${client.id} disconnecting: ${reason}`);
    });

    client.on('error', (error) => {
      this.logger.error(`Client ${client.id} error: ${error}`);
    });

    this.wsMetricsService.recordConnection(client);

    client.emit('connection-established', {
      clientId: client.id,
      timestamp: new Date().toISOString(),
      availableRooms: Array.from(this.rooms),
      transport: client.conn.transport.name,
      upgraded: client.conn.upgraded,
    });

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
        this.removeRoomMember(room, client.id);
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
    this.addRoomMember(room, client.id);
    const clientInfo = this.clients.get(client.id);
    if (clientInfo) {
      clientInfo.subscribedRooms.add(room);
      clientInfo.lastActivity = new Date();
    }
    this.logger.log(`Client ${client.id} subscribed system metrics`);
    this.wsMetricsService.recordSubscription(client.id, room);
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
    try {
      client.join(room);
      this.rooms.add(room);
      this.addRoomMember(room, client.id);
      this.wsMetricsService.recordSubscription(client.id, room);

      const clientInfo = this.clients.get(client.id);
      if (clientInfo) {
        clientInfo.subscribedRooms.add(room);
        clientInfo.lastActivity = new Date();
      }

      // 仅输出一次成功日志
      this.logger.log(`Client ${client.id} subscribed server metrics ${data.serverId}`);

      client.emit('subscription-confirmed', {
        room,
        serverId: data.serverId,
        interval: data.interval || 5000,
        timestamp: new Date().toISOString(),
      });

      this.sendServerMetrics(client, data.serverId);
    } catch (e) {
      this.logger.error('subscribe-server-metrics error', e);
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
    this.addRoomMember(room, client.id);
    
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
    this.addRoomMember(room, client.id);
    
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
    this.removeRoomMember(data.room, client.id);
    
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
    // 不再记录详细 ping 日志
    const clientInfo = this.clients.get(client.id);
    if (clientInfo) clientInfo.lastActivity = new Date();
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
    const ns = this.getNamespace();
    for (const [room, members] of this.roomMembers.entries()) {
      if (!room.startsWith('server-metrics-')) continue;
      const activeMembers = Array.from(members).filter(id => ns.sockets?.get?.(id));
      if (activeMembers.length === 0) continue;
      const serverId = room.replace('server-metrics-', '');
      try {
        const metrics = await this.serverMetrics.collectServerMetrics(serverId);
        this.emitToRoom(room, 'server-metrics-update', {
          serverId,
          data: metrics,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        this.logger.error(`pushServerMetrics ${serverId} error`, error);
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
    const room = `server-metrics-${payload.serverId}`;
    const internalSize = this.getRoomInternalSize(room);
    
    // 添加调试日志
    this.logger.debug(`[handleProcessInfoUpdated] Processing event for server ${payload.serverId}`);
    this.logger.debug(`[handleProcessInfoUpdated] Room: ${room}, clients: ${internalSize}`);
    this.logger.debug(`[handleProcessInfoUpdated] ProcessInfo data:`, {
      hasResourceMetrics: !!payload.processInfo?.resourceMetrics,
      resourceMetrics: payload.processInfo?.resourceMetrics,
      processInfoKeys: payload.processInfo ? Object.keys(payload.processInfo) : []
    });
    
    if (internalSize > 0) {
      // 修改事件名称从 'server-metrics-update' 改为 'process:info'
      this.emitToRoom(room, 'process:info', {
        serverId: payload.serverId,
        processInfo: payload.processInfo, // 确保数据结构包含 processInfo 字段
        timestamp: (payload.timestamp || new Date()).toISOString(),
      });
      
      this.logger.debug(`[handleProcessInfoUpdated] Emitted 'process:info' event to room ${room}`);
    } else {
      this.logger.debug(`[handleProcessInfoUpdated] No clients in room ${room}, skipping emit`);
    }
  }

  /**
   * 监听进程日志事件
   */
  @OnEvent('process.logs.updated')
  handleProcessLogsUpdated(payload: { serverId: string; logData: any; timestamp?: Date }) {
    const timestamp = payload.timestamp || new Date();
    const room = `server-logs-${payload.serverId}`;
    const internalSize = this.getRoomInternalSize(room);
    
    // 添加调试日志
    this.logger.debug(`[handleProcessLogsUpdated] Processing log event for server ${payload.serverId}`);
    this.logger.debug(`[handleProcessLogsUpdated] Room: ${room}, clients: ${internalSize}`);
    this.logger.debug(`[handleProcessLogsUpdated] LogData:`, {
      hasLogData: !!payload.logData,
      logDataKeys: payload.logData ? Object.keys(payload.logData) : [],
      logDataType: typeof payload.logData
    });
    
    if (internalSize > 0) {
      this.emitToRoom(room, 'process:logs', {
        serverId: payload.serverId,
        logData: payload.logData,
        timestamp: timestamp.toISOString(),
      });
      
      this.logger.debug(`[handleProcessLogsUpdated] Emitted 'process:logs' event to room ${room}`);
    } else {
      this.logger.debug(`[handleProcessLogsUpdated] No clients in room ${room}, skipping emit`);
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

  /**
   * 调试：转储房间信息
   */
  @SubscribeMessage('debug-dump-rooms')
  handleDebugDumpRooms(@ConnectedSocket() client: Socket) {
    try {
      const nsAdapter: any = (this.server as any)?.of?.('/monitoring')?.adapter || (this.server as any)?.adapter;
      const adapterRooms: Record<string, any> = {};
      if (nsAdapter?.rooms) {
        for (const [name, set] of nsAdapter.rooms) {
          adapterRooms[name] = Array.from(set);
        }
      }
      const clientInfo = this.clients.get(client.id);
      const payload = {
        serverHasAdapter: !!nsAdapter,
        adapterRoomNames: Object.keys(adapterRooms),
        adapterRooms,
        clientId: client.id,
        clientRooms: Array.from(client.rooms),
        trackedClientRooms: clientInfo ? Array.from(clientInfo.subscribedRooms) : [],
        timestamp: new Date().toISOString(),
      };
      this.logger.log(`[debug-dump-rooms] Emitting rooms dump to ${client.id}`);
      client.emit('rooms-dump', payload);
    } catch (e) {
      this.logger.error('[debug-dump-rooms] error', e);
    }
  }
}