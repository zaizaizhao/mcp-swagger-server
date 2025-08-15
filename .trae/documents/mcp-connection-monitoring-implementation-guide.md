# MCP 客户端连接监控实施指南

## 1. 实施概述

本指南提供了在 `mcp-swagger-server` 项目中实现 MCP 客户端连接监控的详细步骤和代码示例。

### 1.1 实施目标
- 在 API 进程中实时访问 MCP 服务器的 `activeTransports` 连接信息
- 提供 RESTful API 接口获取连接统计
- 支持 WebSocket 实时推送连接状态变化
- 集成到现有的监控系统中

### 1.2 修改文件清单
- `packages/mcp-swagger-server/src/transportUtils/stream.ts`
- `packages/mcp-swagger-api/src/modules/mcp/services/mcp.service.ts`
- `packages/mcp-swagger-api/src/modules/mcp/mcp.controller.ts` (新建)
- `packages/mcp-swagger-api/src/modules/websocket/websocket.gateway.ts`

## 2. 步骤一：扩展 Stream.ts 连接监控

### 2.1 添加类型定义

在 `packages/mcp-swagger-server/src/transportUtils/stream.ts` 文件开头添加：

```typescript
// 添加连接信息接口
export interface ConnectionInfo {
  sessionId: string;
  clientIP: string;
  userAgent: string;
  connectedAt: Date;
  lastActivity: Date;
  requestCount: number;
}

export interface ConnectionStats {
  activeConnections: number;
  totalConnections: number;
  connections: ConnectionInfo[];
  lastUpdated: Date;
}

export interface ConnectionMonitor {
  onConnectionChange?: (stats: ConnectionStats) => void;
  onConnectionEstablished?: (connection: ConnectionInfo) => void;
  onConnectionClosed?: (sessionId: string, duration: number) => void;
}
```

### 2.2 修改 startStreamableMcpServer 函数

```typescript
export async function startStreamableMcpServer(
  server: McpServer, 
  endpoint: string, 
  port: number,
  eventStore: EventStore = new InMemoryEventStore(),
  connectionMonitor?: ConnectionMonitor // 新增参数
): Promise<Server> {
  const activeTransports: Record<
    string,
    {
      server: McpServer;
      transport: StreamableHTTPServerTransport;
    }
  > = {};

  // 新增：连接信息跟踪
  const connectionInfoMap = new Map<string, ConnectionInfo>();
  let totalConnectionCount = 0;

  // 新增：获取连接统计的辅助函数
  const getConnectionStats = (): ConnectionStats => {
    return {
      activeConnections: connectionInfoMap.size,
      totalConnections: totalConnectionCount,
      connections: Array.from(connectionInfoMap.values()),
      lastUpdated: new Date()
    };
  };

  // 新增：通知连接变化的辅助函数
  const notifyConnectionChange = () => {
    if (connectionMonitor?.onConnectionChange) {
      connectionMonitor.onConnectionChange(getConnectionStats());
    }
  };

  const handleRequest: RequestHandlers["handleRequest"] = async (
    req: IncomingMessage,
    res: ServerResponse,
  ) => {
    if (!req.url) {
      res.writeHead(400).end("No URL");
      return;
    }

    const reqUrl = new URL(req.url, "http://localhost");

    // 新增：内部连接统计 API
    if (req.method === 'GET' && reqUrl.pathname === '/internal/connections') {
      const stats = getConnectionStats();
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(stats));
      return;
    }

    // Handle POST requests to endpoint
    if (req.method === "POST" && reqUrl.pathname === endpoint) {
      try {
        const sessionId = Array.isArray(req.headers["mcp-session-id"])
          ? req.headers["mcp-session-id"][0]
          : req.headers["mcp-session-id"];
        let transport: StreamableHTTPServerTransport;

        const body = await getBody(req);

        // 更新现有连接的活动时间和请求计数
        if (sessionId && connectionInfoMap.has(sessionId)) {
          const connInfo = connectionInfoMap.get(sessionId)!;
          connInfo.lastActivity = new Date();
          connInfo.requestCount++;
          connectionInfoMap.set(sessionId, connInfo);
        }

        if (sessionId && activeTransports[sessionId]) {
          transport = activeTransports[sessionId].transport;
          server = activeTransports[sessionId].server;
        } else if (!sessionId && isInitializeRequest(body)) {
          transport = new StreamableHTTPServerTransport({
            eventStore: eventStore || new InMemoryEventStore(),
            onsessioninitialized: (_sessionId: string) => {
              // 创建连接信息
              const connectionInfo: ConnectionInfo = {
                sessionId: _sessionId,
                clientIP: req.socket.remoteAddress || 'unknown',
                userAgent: req.headers['user-agent'] || 'unknown',
                connectedAt: new Date(),
                lastActivity: new Date(),
                requestCount: 1
              };

              // 存储连接信息
              connectionInfoMap.set(_sessionId, connectionInfo);
              activeTransports[_sessionId] = { server, transport };
              totalConnectionCount++;

              // 通知监听器
              if (connectionMonitor?.onConnectionEstablished) {
                connectionMonitor.onConnectionEstablished(connectionInfo);
              }
              notifyConnectionChange();

              console.log(`New MCP client connected: ${_sessionId} from ${connectionInfo.clientIP}`);
            },
            sessionIdGenerator: randomUUID,
          });

          // Handle the server close event.
          transport.onclose = async () => {
            const sid = transport.sessionId;
            if (sid && activeTransports[sid]) {
              const connectionInfo = connectionInfoMap.get(sid);
              const duration = connectionInfo 
                ? Date.now() - connectionInfo.connectedAt.getTime() 
                : 0;

              try {
                await server?.close();
              } catch (error) {
                console.error("Error closing server:", error);
              }

              // 清理连接信息
              delete activeTransports[sid];
              connectionInfoMap.delete(sid);

              // 通知监听器
              if (connectionMonitor?.onConnectionClosed) {
                connectionMonitor.onConnectionClosed(sid, duration);
              }
              notifyConnectionChange();

              console.log(`MCP client disconnected: ${sid}, duration: ${duration}ms`);
            }
          };

          server.connect(transport);
          await transport.handleRequest(req, res, body);
          return;
        } else {
          // Error handling...
          res.setHeader("Content-Type", "application/json");
          res.writeHead(400).end(
            JSON.stringify({
              error: {
                code: -32000,
                message: "Bad Request: No valid session ID provided",
              },
              id: null,
              jsonrpc: "2.0",
            }),
          );
          return;
        }

        await transport.handleRequest(req, res, body);
      } catch (error) {
        console.error("Error handling request:", error);
        res.setHeader("Content-Type", "application/json");
        res.writeHead(500).end(
          JSON.stringify({
            error: { code: -32603, message: "Internal Server Error" },
            id: null,
            jsonrpc: "2.0",
          }),
        );
      }
      return;
    }

    // 其余现有代码保持不变...
    // Handle GET requests to endpoint
    // Handle DELETE requests to endpoint
    // ...
  };

  const cleanup = () => {
    for (const { server, transport } of Object.values(activeTransports)) {
      transport.close();
      server.close();
    }
    connectionInfoMap.clear();
  };

  // Create the HTTP server using our factory
  const httpServer = createBaseHttpServer(port, endpoint, {
    handleRequest,
    cleanup,
    serverType: "HTTP Streamable Server",
  });

  // 新增：将连接统计方法附加到 HTTP 服务器实例
  (httpServer as any).getConnectionStats = getConnectionStats;
  (httpServer as any).getActiveConnections = () => connectionInfoMap.size;
  (httpServer as any).getConnectionInfo = (sessionId: string) => connectionInfoMap.get(sessionId);

  return httpServer;
}
```

## 3. 步骤二：修改 MCP Service

### 3.1 更新 mcp.service.ts

在 `packages/mcp-swagger-api/src/modules/mcp/services/mcp.service.ts` 中添加：

```typescript
import { 
  createMcpServer, 
  runStreamableServer, 
  runSseServer,
  transformOpenApiToMcpTools,
  startStreamableMcpServer,
  startSseMcpServer,
  ConnectionMonitor,
  ConnectionInfo,
  ConnectionStats
} from 'mcp-swagger-server';

@Injectable()
export class MCPService implements OnModuleDestroy {
  // 现有属性...
  private connectionStats: ConnectionStats = {
    activeConnections: 0,
    totalConnections: 0,
    connections: [],
    lastUpdated: new Date()
  };

  // 新增：创建连接监控器
  private createConnectionMonitor(): ConnectionMonitor {
    return {
      onConnectionChange: (stats: ConnectionStats) => {
        this.connectionStats = stats;
        
        // 更新监控服务中的活跃连接数
        const monitoringService = this.moduleRef?.get('MCPMonitoringService', { strict: false });
        if (monitoringService && typeof monitoringService.updateActiveConnections === 'function') {
          monitoringService.updateActiveConnections(stats.activeConnections);
        }
        
        // 发出事件供其他服务监听
        this.eventEmitter.emit('mcp.connections.updated', stats);
        
        this.logger.debug(`MCP connections updated: ${stats.activeConnections} active, ${stats.totalConnections} total`);
      },
      
      onConnectionEstablished: (connection: ConnectionInfo) => {
        this.logger.log(`New MCP client connected: ${connection.sessionId} from ${connection.clientIP} (${connection.userAgent})`);
        this.eventEmitter.emit('mcp.connection.established', connection);
      },
      
      onConnectionClosed: (sessionId: string, duration: number) => {
        this.logger.log(`MCP client disconnected: ${sessionId}, session duration: ${Math.round(duration / 1000)}s`);
        this.eventEmitter.emit('mcp.connection.closed', { sessionId, duration });
      }
    };
  }

  // 修改 startServer 方法
  private async startServer(): Promise<string> {
    if (!this.currentServer) {
      throw new Error('No MCP server instance available');
    }

    const { port, transport } = this.serverConfig;

    try {
      this.logger.log(`Starting MCP server with transport: ${transport}, port: ${port}`);
      
      switch (transport) {
        case 'streamable':
          this.logger.log('Starting streamable server with connection monitoring...');
          this.httpServer = await startStreamableMcpServer(
            this.currentServer!, 
            '/mcp', 
            port,
            undefined, // eventStore
            this.createConnectionMonitor() // 连接监控器
          );
          return `http://localhost:${port}/mcp`;
          
        case 'sse':
          this.logger.log('Starting SSE server...');
          setImmediate(() => {
            startSseMcpServer(this.currentServer!, '/sse', port);
          });
          return `http://localhost:${port}/sse`;
          
        default:
          throw new Error(`Unsupported transport: ${transport}`);
      }
    } catch (error) {
      this.logger.error('Failed to start server:', error);
      throw error;
    }
  }

  // 新增：获取连接统计
  getConnectionStats(): ConnectionStats {
    // 尝试从 HTTP 服务器获取实时数据
    if (this.httpServer && typeof (this.httpServer as any).getConnectionStats === 'function') {
      return (this.httpServer as any).getConnectionStats();
    }
    // 返回缓存的数据
    return this.connectionStats;
  }

  // 新增：获取活跃连接数
  getActiveConnectionCount(): number {
    if (this.httpServer && typeof (this.httpServer as any).getActiveConnections === 'function') {
      return (this.httpServer as any).getActiveConnections();
    }
    return this.connectionStats.activeConnections;
  }

  // 新增：获取特定连接信息
  getConnectionInfo(sessionId: string): ConnectionInfo | undefined {
    if (this.httpServer && typeof (this.httpServer as any).getConnectionInfo === 'function') {
      return (this.httpServer as any).getConnectionInfo(sessionId);
    }
    return this.connectionStats.connections.find(conn => conn.sessionId === sessionId);
  }

  // 修改现有的 getServerStatus 方法
  getServerStatus(): MCPServerStatus {
    const connectionStats = this.getConnectionStats();
    
    return {
      isRunning: this.isServerRunning,
      toolsCount: this.currentTools.length,
      endpoint: this.serverEndpoint,
      tools: this.currentTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      })),
      config: this.serverConfig,
      // 新增连接信息
      connections: {
        active: connectionStats.activeConnections,
        total: connectionStats.totalConnections,
        details: connectionStats.connections
      }
    };
  }

  // 修改 healthCheck 方法
  async healthCheck(): Promise<{
    healthy: boolean;
    toolsCount: number;
    lastCheck: Date;
    serverRunning: boolean;
    endpoint?: string;
    connections: {
      active: number;
      total: number;
    };
  }> {
    const lastCheck = new Date();
    const connectionStats = this.getConnectionStats();
    
    return {
      healthy: this.isServerRunning && this.currentServer !== null,
      serverRunning: this.isServerRunning,
      toolsCount: this.currentTools.length,
      endpoint: this.serverEndpoint,
      connections: {
        active: connectionStats.activeConnections,
        total: connectionStats.totalConnections
      },
      lastCheck
    };
  }
}
```

## 4. 步骤三：创建 MCP Controller

### 4.1 创建 mcp.controller.ts

在 `packages/mcp-swagger-api/src/modules/mcp/` 目录下创建 `mcp.controller.ts`：

```typescript
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { MCPService } from './services/mcp.service';

@ApiTags('MCP')
@Controller('mcp')
export class MCPController {
  constructor(private readonly mcpService: MCPService) {}

  @Get('status')
  @ApiOperation({ summary: '获取 MCP 服务器状态' })
  @ApiResponse({ status: 200, description: '服务器状态信息' })
  async getServerStatus() {
    return this.mcpService.getServerStatus();
  }

  @Get('health')
  @ApiOperation({ summary: 'MCP 服务器健康检查' })
  @ApiResponse({ status: 200, description: '健康检查结果' })
  async healthCheck() {
    return this.mcpService.healthCheck();
  }

  @Get('connections')
  @ApiOperation({ summary: '获取 MCP 客户端连接统计' })
  @ApiResponse({ 
    status: 200, 
    description: '客户端连接统计信息',
    schema: {
      type: 'object',
      properties: {
        activeConnections: { type: 'number', description: '当前活跃连接数' },
        totalConnections: { type: 'number', description: '总连接数' },
        connections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sessionId: { type: 'string' },
              clientIP: { type: 'string' },
              userAgent: { type: 'string' },
              connectedAt: { type: 'string', format: 'date-time' },
              lastActivity: { type: 'string', format: 'date-time' },
              requestCount: { type: 'number' }
            }
          }
        },
        lastUpdated: { type: 'string', format: 'date-time' }
      }
    }
  })
  async getConnections() {
    return this.mcpService.getConnectionStats();
  }

  @Get('connections/count')
  @ApiOperation({ summary: '获取活跃连接数' })
  @ApiResponse({ status: 200, description: '活跃连接数' })
  async getActiveConnectionCount() {
    return {
      activeConnections: this.mcpService.getActiveConnectionCount(),
      timestamp: new Date()
    };
  }

  @Get('connections/:sessionId')
  @ApiOperation({ summary: '获取特定连接信息' })
  @ApiParam({ name: 'sessionId', description: '会话ID' })
  @ApiResponse({ status: 200, description: '连接详细信息' })
  @ApiResponse({ status: 404, description: '连接不存在' })
  async getConnectionInfo(@Param('sessionId') sessionId: string) {
    const connectionInfo = this.mcpService.getConnectionInfo(sessionId);
    
    if (!connectionInfo) {
      return {
        error: 'Connection not found',
        sessionId
      };
    }
    
    return connectionInfo;
  }

  @Get('tools')
  @ApiOperation({ summary: '获取 MCP 工具列表' })
  @ApiResponse({ status: 200, description: 'MCP 工具列表' })
  async getTools() {
    return this.mcpService.getTools();
  }
}
```

### 4.2 更新 mcp.module.ts

```typescript
import { Module } from '@nestjs/common';
import { MCPService } from './services/mcp.service';
import { MCPController } from './mcp.controller';
import { ToolManagerService } from './services/tool-manager.service';

@Module({
  controllers: [MCPController],
  providers: [MCPService, ToolManagerService],
  exports: [MCPService, ToolManagerService],
})
export class MCPModule {}
```

## 5. 步骤四：WebSocket 集成

### 5.1 更新 websocket.gateway.ts

在 `packages/mcp-swagger-api/src/modules/websocket/websocket.gateway.ts` 中添加：

```typescript
import { OnEvent } from '@nestjs/event-emitter';
import { MCPService } from '../mcp/services/mcp.service';

@WebSocketGateway({
  namespace: 'monitoring',
  cors: {
    origin: '*',
  },
})
export class MonitoringGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly mcpService: MCPService // 注入 MCP 服务
  ) {}

  // 新增：订阅 MCP 连接统计
  @SubscribeMessage('subscribe_mcp_connections')
  async handleSubscribeMcpConnections(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { serverId?: string }
  ) {
    const room = `mcp_connections_${data.serverId || 'default'}`;
    await client.join(room);
    
    this.logger.log(`Client ${client.id} subscribed to MCP connections for room: ${room}`);
    
    // 立即发送当前连接状态
    const stats = this.mcpService.getConnectionStats();
    client.emit('mcp_connections_data', {
      timestamp: new Date(),
      ...stats
    });
    
    return { status: 'subscribed', room, timestamp: new Date() };
  }

  // 新增：取消订阅 MCP 连接统计
  @SubscribeMessage('unsubscribe_mcp_connections')
  async handleUnsubscribeMcpConnections(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { serverId?: string }
  ) {
    const room = `mcp_connections_${data.serverId || 'default'}`;
    await client.leave(room);
    
    this.logger.log(`Client ${client.id} unsubscribed from MCP connections for room: ${room}`);
    
    return { status: 'unsubscribed', room, timestamp: new Date() };
  }

  // 监听 MCP 连接变化事件
  @OnEvent('mcp.connections.updated')
  handleMcpConnectionsUpdated(stats: any) {
    this.server.to('mcp_connections_default').emit('mcp_connections_data', {
      timestamp: new Date(),
      ...stats
    });
    
    this.logger.debug(`Pushed MCP connection stats to clients: ${stats.activeConnections} active connections`);
  }

  // 监听单个连接建立事件
  @OnEvent('mcp.connection.established')
  handleMcpConnectionEstablished(connection: any) {
    this.server.to('mcp_connections_default').emit('mcp_connection_established', {
      timestamp: new Date(),
      connection
    });
  }

  // 监听单个连接关闭事件
  @OnEvent('mcp.connection.closed')
  handleMcpConnectionClosed(data: any) {
    this.server.to('mcp_connections_default').emit('mcp_connection_closed', {
      timestamp: new Date(),
      ...data
    });
  }
}
```

## 6. 步骤五：前端集成示例

### 6.1 WebSocket 客户端示例

```typescript
// 前端 WebSocket 服务示例
class MCPConnectionMonitor {
  private socket: Socket;
  
  constructor(serverUrl: string) {
    this.socket = io(`${serverUrl}/monitoring`);
    this.setupEventListeners();
  }
  
  private setupEventListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to MCP monitoring');
      // 订阅 MCP 连接统计
      this.socket.emit('subscribe_mcp_connections', { serverId: 'default' });
    });
    
    this.socket.on('mcp_connections_data', (data) => {
      console.log('MCP Connections Update:', data);
      this.updateConnectionDisplay(data);
    });
    
    this.socket.on('mcp_connection_established', (data) => {
      console.log('New MCP Connection:', data.connection);
      this.showConnectionNotification('connected', data.connection);
    });
    
    this.socket.on('mcp_connection_closed', (data) => {
      console.log('MCP Connection Closed:', data);
      this.showConnectionNotification('disconnected', data);
    });
  }
  
  private updateConnectionDisplay(data: any) {
    // 更新 UI 显示连接统计
    document.getElementById('active-connections')!.textContent = data.activeConnections;
    document.getElementById('total-connections')!.textContent = data.totalConnections;
    
    // 更新连接列表
    const connectionsList = document.getElementById('connections-list');
    if (connectionsList) {
      connectionsList.innerHTML = data.connections.map((conn: any) => `
        <div class="connection-item">
          <div class="session-id">${conn.sessionId}</div>
          <div class="client-info">${conn.clientIP} - ${conn.userAgent}</div>
          <div class="timing">Connected: ${new Date(conn.connectedAt).toLocaleString()}</div>
          <div class="requests">Requests: ${conn.requestCount}</div>
        </div>
      `).join('');
    }
  }
  
  private showConnectionNotification(type: 'connected' | 'disconnected', data: any) {
    // 显示连接/断开通知
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = `Client ${type}: ${data.sessionId || data.connection?.sessionId}`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
  }
}

// 使用示例
const monitor = new MCPConnectionMonitor('http://localhost:3001');
```

### 6.2 REST API 调用示例

```typescript
// REST API 调用示例
class MCPApiClient {
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  
  async getConnectionStats() {
    const response = await fetch(`${this.baseUrl}/api/mcp/connections`);
    return response.json();
  }
  
  async getActiveConnectionCount() {
    const response = await fetch(`${this.baseUrl}/api/mcp/connections/count`);
    return response.json();
  }
  
  async getConnectionInfo(sessionId: string) {
    const response = await fetch(`${this.baseUrl}/api/mcp/connections/${sessionId}`);
    return response.json();
  }
  
  async getServerStatus() {
    const response = await fetch(`${this.baseUrl}/api/mcp/status`);
    return response.json();
  }
}

// 使用示例
const apiClient = new MCPApiClient('http://localhost:3001');

// 获取连接统计
apiClient.getConnectionStats().then(stats => {
  console.log('Connection Stats:', stats);
});

// 定期轮询连接数
setInterval(async () => {
  const count = await apiClient.getActiveConnectionCount();
  console.log('Active Connections:', count.activeConnections);
}, 5000);
```

## 7. 测试验证

### 7.1 单元测试示例

```typescript
// mcp.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { MCPService } from './mcp.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('MCPService', () => {
  let service: MCPService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MCPService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            on: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MCPService>(MCPService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return initial connection stats', () => {
    const stats = service.getConnectionStats();
    expect(stats).toEqual({
      activeConnections: 0,
      totalConnections: 0,
      connections: [],
      lastUpdated: expect.any(Date)
    });
  });

  it('should return active connection count', () => {
    const count = service.getActiveConnectionCount();
    expect(count).toBe(0);
  });
});
```

### 7.2 集成测试

```bash
# 启动服务
npm run start:dev

# 测试 API 端点
curl http://localhost:3001/api/mcp/connections
curl http://localhost:3001/api/mcp/connections/count
curl http://localhost:3001/api/mcp/status

# 测试 WebSocket 连接
# 使用浏览器开发者工具或 WebSocket 测试工具连接到
# ws://localhost:3001/monitoring
```

## 8. 部署注意事项

### 8.1 环境变量配置

```bash
# .env 文件
MCP_CONNECTION_MONITORING_ENABLED=true
MCP_CONNECTION_LOG_LEVEL=debug
MCP_CONNECTION_HISTORY_LIMIT=1000
```

### 8.2 性能优化

- 连接信息缓存策略
- WebSocket 推送频率控制
- 内存使用监控
- 连接历史数据清理

### 8.3 安全考虑

- API 端点访问控制
- 敏感信息过滤
- 连接信息脱敏
- WebSocket 认证

通过以上实施步骤，您可以在 API 进程中完全访问和监控 MCP 服务器的客户端连接情况，实现实时监控和管理的需求。