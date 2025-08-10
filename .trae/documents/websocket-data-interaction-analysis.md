# WebSocket 数据交互技术分析文档

## 1. 概述

本文档详细分析 MCP Swagger UI 和 API 项目之间的 WebSocket 数据交互流程，用于排查实时数据通信问题。

### 1.1 架构概览

```
前端 UI (Vue3 + Socket.IO Client)
        ↕ WebSocket 连接
后端 API (NestJS + Socket.IO Server)
        ↕ 数据处理
进程监控服务 + 系统指标收集
```

## 2. WebSocket 连接架构

### 2.1 连接配置

**前端连接地址：**
```typescript
// packages/mcp-swagger-ui/src/services/websocket.ts
export const websocketService = new WebSocketService('http://localhost:3001/monitoring');
```

**后端监听配置：**
```typescript
// packages/mcp-swagger-api/src/modules/websocket/websocket.gateway.ts
@WebSocketGateway({
  namespace: '/monitoring',
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
})
export class MonitoringGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
```

### 2.2 连接流程

1. **前端发起连接**
   ```typescript
   // WebSocketService.connect()
   this.socket = io(this.url, {
     transports: ['websocket', 'polling'],
     timeout: 20000,
     reconnection: true,
     reconnectionAttempts: 5,
     reconnectionDelay: 1000,
   });
   ```

2. **后端处理连接**
   ```typescript
   handleConnection(client: Socket) {
     this.logger.log(`Client connected: ${client.id}`);
     this.connectedClients.set(client.id, {
       socket: client,
       subscriptions: new Set(),
       connectedAt: new Date(),
     });
   }
   ```

## 3. 前端 WebSocket 实现

### 3.1 WebSocket 服务类

**文件位置：** `packages/mcp-swagger-ui/src/services/websocket.ts`

```typescript
class WebSocketService {
  private socket: Socket | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;

  // 连接方法
  async connect(): Promise<boolean> {
    if (this.isConnected() || this.isConnecting) {
      return true;
    }

    this.isConnecting = true;
    
    try {
      this.socket = io(this.url, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.setupSocketEventHandlers();
      
      return new Promise((resolve) => {
        this.socket!.on('connect', () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.emitEvent('connect');
          resolve(true);
        });

        this.socket!.on('connect_error', (error) => {
          this.isConnecting = false;
          this.emitEvent('connect_error', error);
          resolve(false);
        });
      });
    } catch (error) {
      this.isConnecting = false;
      throw error;
    }
  }
}
```

### 3.2 WebSocket Store

**文件位置：** `packages/mcp-swagger-ui/src/stores/websocket.ts`

```typescript
export const useWebSocketStore = () => {
  // 连接状态管理
  const connected = ref(false);
  const connecting = ref(false);
  const subscriptions = ref(new Set<string>());

  // 订阅进程信息
  const subscribeToProcessInfo = (serverId: string) => {
    if (!connected.value) {
      console.warn('[WebSocketStore] Not connected, cannot subscribe to process info');
      return;
    }

    const subscriptionKey = `process:info:${serverId}`;
    websocketService.subscribeToProcessInfo(serverId);
    subscriptions.value.add(subscriptionKey);
  };

  // 订阅进程日志
  const subscribeToProcessLogs = (serverId: string) => {
    if (!connected.value) {
      console.warn('[WebSocketStore] Not connected, cannot subscribe to process logs');
      return;
    }

    const subscriptionKey = `process:logs:${serverId}`;
    websocketService.subscribeToProcessLogs(serverId);
    subscriptions.value.add(subscriptionKey);
  };
};
```

### 3.3 组件中的使用

**文件位置：** `packages/mcp-swagger-ui/src/modules/servers/ServerDetail.vue`

```typescript
// 组件挂载时建立连接和订阅
onMounted(async () => {
  // 确保WebSocket连接
  if (!websocketStore.connected) {
    await websocketStore.connect();
  }
  
  // 立即订阅进程信息和日志
  websocketStore.subscribeToProcessInfo(serverId.value);
  websocketStore.subscribeToProcessLogs(serverId.value);

  // 订阅进程信息更新事件
  websocketStore.subscribe("process:info", (data: any) => {
    if (data.serverId === serverId.value) {
      processInfo.value = data.processInfo;
      // 更新资源图表
      if (activeTab.value === 'process') {
        updateResourceCharts();
      }
    }
  });

  // 订阅进程日志更新事件
  websocketStore.subscribe("process:logs", (data: any) => {
    if (data.serverId === serverId.value) {
      processLogs.value.push({
        id: Date.now().toString(),
        level: data.logData.level,
        message: data.logData.message,
        timestamp: data.logData.timestamp,
        metadata: data.logData.metadata
      });
      
      // 保持日志列表在合理大小
      if (processLogs.value.length > 500) {
        processLogs.value = processLogs.value.slice(-400);
      }
    }
  });
});
```

## 4. 后端 WebSocket 实现

### 4.1 WebSocket 网关

**文件位置：** `packages/mcp-swagger-api/src/modules/websocket/websocket.gateway.ts`

```typescript
@WebSocketGateway({
  namespace: '/monitoring',
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
})
export class MonitoringGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MonitoringGateway.name);
  private connectedClients = new Map<string, ClientInfo>();
  private server: Server;

  // 处理服务器指标订阅
  @SubscribeMessage('subscribe-server-metrics')
  async handleSubscribeServerMetrics(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { serverId: string; interval?: number },
  ) {
    const { serverId, interval = 5000 } = data;
    const room = `server-metrics-${serverId}`;
    
    this.logger.log(`Client ${client.id} subscribing to server metrics for ${serverId}`);
    
    // 加入房间
    await client.join(room);
    
    // 记录订阅信息
    const clientInfo = this.connectedClients.get(client.id);
    if (clientInfo) {
      clientInfo.subscriptions.add(room);
    }
    
    // 立即发送当前服务器指标
    try {
      const currentMetrics = await this.processResourceMonitorService.getProcessInfo(serverId);
      if (currentMetrics) {
        client.emit('process:info', {
          serverId,
          processInfo: currentMetrics,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.logger.error(`Failed to get initial metrics for server ${serverId}:`, error);
    }
    
    this.logger.log(`Client ${client.id} joined room ${room}`);
  }

  // 处理服务器日志订阅
  @SubscribeMessage('subscribe-server-logs')
  async handleSubscribeServerLogs(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { serverId: string; level?: string },
  ) {
    const { serverId, level } = data;
    const room = `server-logs-${serverId}`;
    
    this.logger.log(`Client ${client.id} subscribing to server logs for ${serverId}`);
    
    // 加入房间
    await client.join(room);
    
    // 记录订阅信息
    const clientInfo = this.connectedClients.get(client.id);
    if (clientInfo) {
      clientInfo.subscriptions.add(room);
    }
    
    this.logger.log(`Client ${client.id} joined room ${room}`);
  }
}
```

### 4.2 数据推送机制

```typescript
// 推送服务器指标数据
pushServerMetrics(serverId: string, metrics: any) {
  const room = `server-metrics-${serverId}`;
  this.server.to(room).emit('process:info', {
    serverId,
    processInfo: metrics,
    timestamp: new Date().toISOString(),
  });
}

// 推送服务器日志数据
pushServerLogs(serverId: string, logData: any) {
  const room = `server-logs-${serverId}`;
  this.server.to(room).emit('process:logs', {
    serverId,
    logData,
    timestamp: new Date().toISOString(),
  });
}
```

### 4.3 进程资源监控服务

**文件位置：** `packages/mcp-swagger-api/src/modules/servers/services/process-resource-monitor.service.ts`

```typescript
@Injectable()
export class ProcessResourceMonitorService {
  private readonly logger = new Logger(ProcessResourceMonitorService.name);
  private monitoringIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    @Inject(forwardRef(() => MonitoringGateway))
    private readonly monitoringGateway: MonitoringGateway,
  ) {}

  /**
   * 开始监控进程资源
   */
  startMonitoring(serverId: string, pid: number, interval: number = 5000): void {
    // 如果已经在监控，先停止
    this.stopMonitoring(serverId);

    const monitoringInterval = setInterval(async () => {
      try {
        const processInfo = await this.getProcessInfo(serverId, pid);
        if (processInfo) {
          // 通过WebSocket推送数据
          this.monitoringGateway.pushServerMetrics(serverId, processInfo);
        }
      } catch (error) {
        this.logger.error(`Failed to monitor process ${pid} for server ${serverId}:`, error);
      }
    }, interval);

    this.monitoringIntervals.set(serverId, monitoringInterval);
    this.logger.log(`Started monitoring process ${pid} for server ${serverId} with interval ${interval}ms`);
  }

  /**
   * 获取进程信息
   */
  async getProcessInfo(serverId: string, pid?: number): Promise<ProcessInfo | null> {
    try {
      if (!pid) {
        // 从进程管理器获取PID
        const processManager = this.moduleRef.get(ProcessManagerService, { strict: false });
        const runningProcess = processManager.getRunningProcess(serverId);
        if (!runningProcess?.pid) {
          return null;
        }
        pid = runningProcess.pid;
      }

      const processInfo = await pidusage(pid);
      
      return {
        pid,
        cpu: Math.round(processInfo.cpu * 100) / 100,
        memory: {
          rss: processInfo.memory,
          heapUsed: 0, // pidusage不提供heap信息
          heapTotal: 0,
          external: 0,
        },
        uptime: Math.floor(processInfo.elapsed / 1000),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to get process info for PID ${pid}:`, error);
      return null;
    }
  }
}
```

## 5. 数据流向分析

### 5.1 服务器指标数据流

```
1. 前端组件挂载 → 发送 subscribe-server-metrics 事件
2. 后端接收订阅 → 客户端加入 server-metrics-{serverId} 房间
3. 后端立即发送当前指标 → process:info 事件
4. 定时监控服务 → 每5秒收集进程信息
5. 推送到房间 → process:info 事件
6. 前端接收数据 → 更新 processInfo 状态
7. 组件响应式更新 → UI 显示最新数据
```

### 5.2 服务器日志数据流

```
1. 前端组件挂载 → 发送 subscribe-server-logs 事件
2. 后端接收订阅 → 客户端加入 server-logs-{serverId} 房间
3. 进程日志产生 → 日志监控服务捕获
4. 推送到房间 → process:logs 事件
5. 前端接收数据 → 添加到 processLogs 数组
6. 组件响应式更新 → 日志列表显示新条目
```

### 5.3 事件映射表

| 前端发送事件 | 后端处理方法 | 后端推送事件 | 前端接收处理 |
|-------------|-------------|-------------|-------------|
| subscribe-server-metrics | handleSubscribeServerMetrics | process:info | 更新 processInfo |
| subscribe-server-logs | handleSubscribeServerLogs | process:logs | 添加到 processLogs |
| unsubscribe | handleUnsubscribe | - | 清理订阅 |

## 6. 关键代码路径

### 6.1 前端订阅流程

```typescript
// 1. 组件挂载时
ServerDetail.vue:onMounted() 
  → websocketStore.connect()
  → websocketStore.subscribeToProcessInfo(serverId)
  → websocketService.subscribeToProcessInfo(serverId)
  → socket.emit('subscribe-server-metrics', { serverId, interval: 5000 })
```

### 6.2 后端处理流程

```typescript
// 2. 后端接收和处理
MonitoringGateway.handleSubscribeServerMetrics()
  → client.join(`server-metrics-${serverId}`)
  → processResourceMonitorService.getProcessInfo(serverId)
  → client.emit('process:info', data)
  → processResourceMonitorService.startMonitoring(serverId, pid)
```

### 6.3 数据推送流程

```typescript
// 3. 定时推送数据
ProcessResourceMonitorService.startMonitoring()
  → setInterval(() => {
      getProcessInfo(serverId, pid)
      → monitoringGateway.pushServerMetrics(serverId, processInfo)
      → server.to(`server-metrics-${serverId}`).emit('process:info', data)
    }, interval)
```

### 6.4 前端接收流程

```typescript
// 4. 前端接收和更新
WebSocketService.setupSocketEventHandlers()
  → socket.on('process:info', (data) => emitEvent('process:info', data))
  → WebSocketStore.setupEventListeners()
  → websocketService.on('process:info', (data) => { /* 处理数据 */ })
  → ServerDetail.vue 订阅事件处理器
  → processInfo.value = data.processInfo
```

## 7. 常见问题排查

### 7.1 连接问题

**症状：** WebSocket 连接失败

**排查步骤：**
1. 检查后端服务是否启动在 3001 端口
2. 检查 CORS 配置是否包含前端地址
3. 检查网络防火墙设置
4. 查看浏览器开发者工具 Network 标签页

**关键日志：**
```
前端：[WebSocketService] Socket connected: false
后端：Client connected: {client.id}
```

### 7.2 订阅问题

**症状：** 发送订阅请求但后端未收到

**排查步骤：**
1. 检查前端连接状态：`websocketStore.connected`
2. 检查事件名称是否匹配：`subscribe-server-metrics`
3. 检查数据格式：`{ serverId, interval }`
4. 查看后端日志是否有订阅记录

**关键代码：**
```typescript
// 前端发送
this.emit("subscribe-server-metrics", { serverId, interval: 5000 });

// 后端接收
@SubscribeMessage('subscribe-server-metrics')
async handleSubscribeServerMetrics(@MessageBody() data: { serverId: string; interval?: number })
```

### 7.3 数据推送问题

**症状：** 后端有数据但前端收不到

**排查步骤：**
1. 检查客户端是否成功加入房间
2. 检查房间名称是否一致：`server-metrics-${serverId}`
3. 检查进程监控服务是否正常运行
4. 检查事件名称：`process:info`

**关键日志：**
```
后端：Client {client.id} joined room server-metrics-{serverId}
后端：Pushing metrics to room server-metrics-{serverId}
前端：[ServerDetail] Received process:info event
```

### 7.4 内存泄漏问题

**症状：** 长时间运行后内存占用过高

**排查步骤：**
1. 检查组件卸载时是否清理订阅
2. 检查定时器是否正确清理
3. 检查事件监听器是否移除
4. 检查日志数组是否限制大小

**关键代码：**
```typescript
// 组件卸载清理
onUnmounted(() => {
  websocketStore.unsubscribeFromProcessInfo(serverId.value);
  websocketStore.unsubscribeFromProcessLogs(serverId.value);
  // 清理定时器
  if (processLogUpdateInterval) {
    clearInterval(processLogUpdateInterval);
  }
});
```

### 7.5 性能问题

**症状：** 数据更新频率过高导致界面卡顿

**优化措施：**
1. 调整监控间隔：默认 5000ms
2. 限制日志数组大小：最多 500 条
3. 使用防抖或节流处理高频更新
4. 优化图表渲染性能

## 8. 调试技巧

### 8.1 前端调试

```typescript
// 开启详细日志
const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) {
  console.log('[WebSocket] Connection state:', websocketStore.connected);
  console.log('[WebSocket] Subscriptions:', Array.from(subscriptions.value));
}
```

### 8.2 后端调试

```typescript
// 在 WebSocket 网关中添加详细日志
this.logger.debug(`Room ${room} has ${this.server.sockets.adapter.rooms.get(room)?.size || 0} clients`);
this.logger.debug(`Pushing data to room ${room}:`, data);
```

### 8.3 网络调试

1. 使用浏览器开发者工具的 Network 标签页查看 WebSocket 连接
2. 使用 Socket.IO 的调试模式：`localStorage.debug = 'socket.io-client:socket'`
3. 检查 WebSocket 帧数据传输

## 9. 总结

本文档详细分析了 MCP Swagger 项目中 WebSocket 数据交互的完整流程，包括：

- **连接建立**：前端 Socket.IO 客户端连接到后端 `/monitoring` 命名空间
- **事件订阅**：通过房间机制实现精确的数据推送
- **数据流向**：从进程监控到 WebSocket 推送再到前端更新的完整链路
- **问题排查**：常见问题的诊断方法和解决方案

通过这个文档，开发者可以快速定位 WebSocket 通信问题，优化数据传输性能，确保实时监控功能的稳定运行。