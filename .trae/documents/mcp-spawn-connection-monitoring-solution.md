# MCP Spawn 架构下的连接监控解决方案

## 1. 问题分析

### 1.1 Spawn 架构挑战

当使用 `spawn` 方式启动 MCP 服务器时，面临以下挑战：

- **进程隔离**：MCP 服务器运行在独立的子进程中，无法直接访问 `activeTransports` 对象
- **内存隔离**：父进程（API）和子进程（MCP Server）拥有独立的内存空间
- **通信限制**：需要通过 IPC、HTTP 或文件系统等方式进行跨进程通信
- **实时性要求**：连接状态变化需要实时传递给 API 进程

### 1.2 当前 Spawn 架构

```
┌─────────────────┐    spawn    ┌─────────────────┐
│   API Process   │ ──────────► │  MCP Process    │
│  (NestJS API)   │             │ (MCP Server)    │
│                 │             │                 │
│ - REST API      │             │ - activeTransports
│ - WebSocket     │             │ - Connection Info
│ - Monitoring    │             │ - Stream Handler
└─────────────────┘             └─────────────────┘
```

## 2. 解决方案对比

### 2.1 方案一：HTTP 内部 API（推荐）

**核心思路**：在 MCP 子进程中暴露内部 HTTP API，供父进程调用获取连接信息。

**优点**：
- 标准化接口，易于实现和维护
- 支持实时查询
- 网络协议成熟稳定
- 易于调试和测试

**缺点**：
- 轻微的网络开销
- 需要额外的端口管理

### 2.2 方案二：IPC 通信

**核心思路**：通过进程间通信（IPC）传递连接状态变化事件。

**优点**：
- 性能最优，无网络开销
- 支持双向通信
- 实时性最好

**缺点**：
- 实现复杂度较高
- 平台兼容性问题
- 调试困难

### 2.3 方案三：共享文件系统

**核心思路**：MCP 进程定期写入连接信息到文件，API 进程读取。

**优点**：
- 实现简单
- 跨平台兼容性好
- 支持持久化

**缺点**：
- 实时性差
- 文件 I/O 开销
- 并发访问问题

## 3. 推荐实现：HTTP 内部 API 方案

### 3.1 架构设计

```
┌─────────────────┐              ┌─────────────────┐
│   API Process   │              │  MCP Process    │
│                 │              │                 │
│ ┌─────────────┐ │   HTTP API   │ ┌─────────────┐ │
│ │ MCP Service │ │ ──────────► │ │ Internal    │ │
│ │             │ │              │ │ HTTP Server │ │
│ └─────────────┘ │              │ └─────────────┘ │
│                 │              │                 │
│ ┌─────────────┐ │              │ ┌─────────────┐ │
│ │ WebSocket   │ │              │ │ Connection  │ │
│ │ Gateway     │ │              │ │ Monitor     │ │
│ └─────────────┘ │              │ └─────────────┘ │
└─────────────────┘              └─────────────────┘
```

### 3.2 MCP 子进程修改

#### 3.2.1 扩展 stream.ts

```typescript
// packages/mcp-swagger-server/src/transportUtils/stream.ts

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

// 全局连接管理器
class GlobalConnectionManager {
  private static instance: GlobalConnectionManager;
  private connectionInfoMap = new Map<string, ConnectionInfo>();
  private totalConnectionCount = 0;
  private internalServer?: Server;

  static getInstance(): GlobalConnectionManager {
    if (!GlobalConnectionManager.instance) {
      GlobalConnectionManager.instance = new GlobalConnectionManager();
    }
    return GlobalConnectionManager.instance;
  }

  // 启动内部 HTTP 服务器
  startInternalServer(port: number = 0): Promise<number> {
    return new Promise((resolve, reject) => {
      this.internalServer = createServer((req, res) => {
        if (!req.url) {
          res.writeHead(400).end('No URL');
          return;
        }

        const reqUrl = new URL(req.url, 'http://localhost');
        
        // 设置 CORS 头
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');

        switch (reqUrl.pathname) {
          case '/connections':
            if (req.method === 'GET') {
              const stats = this.getConnectionStats();
              res.writeHead(200);
              res.end(JSON.stringify(stats));
            } else {
              res.writeHead(405).end('Method Not Allowed');
            }
            break;

          case '/connections/count':
            if (req.method === 'GET') {
              res.writeHead(200);
              res.end(JSON.stringify({
                activeConnections: this.connectionInfoMap.size,
                timestamp: new Date()
              }));
            } else {
              res.writeHead(405).end('Method Not Allowed');
            }
            break;

          case '/health':
            if (req.method === 'GET') {
              res.writeHead(200);
              res.end(JSON.stringify({
                status: 'healthy',
                connections: this.connectionInfoMap.size,
                timestamp: new Date()
              }));
            } else {
              res.writeHead(405).end('Method Not Allowed');
            }
            break;

          default:
            res.writeHead(404).end('Not Found');
        }
      });

      this.internalServer.listen(port, () => {
        const address = this.internalServer!.address();
        const actualPort = typeof address === 'object' && address ? address.port : port;
        console.log(`Internal connection API server listening on port ${actualPort}`);
        resolve(actualPort);
      });

      this.internalServer.on('error', reject);
    });
  }

  // 添加连接
  addConnection(connectionInfo: ConnectionInfo): void {
    this.connectionInfoMap.set(connectionInfo.sessionId, connectionInfo);
    this.totalConnectionCount++;
    console.log(`New MCP client connected: ${connectionInfo.sessionId} from ${connectionInfo.clientIP}`);
  }

  // 更新连接活动
  updateConnectionActivity(sessionId: string): void {
    const connInfo = this.connectionInfoMap.get(sessionId);
    if (connInfo) {
      connInfo.lastActivity = new Date();
      connInfo.requestCount++;
      this.connectionInfoMap.set(sessionId, connInfo);
    }
  }

  // 移除连接
  removeConnection(sessionId: string): number {
    const connectionInfo = this.connectionInfoMap.get(sessionId);
    const duration = connectionInfo 
      ? Date.now() - connectionInfo.connectedAt.getTime() 
      : 0;
    
    this.connectionInfoMap.delete(sessionId);
    console.log(`MCP client disconnected: ${sessionId}, duration: ${duration}ms`);
    return duration;
  }

  // 获取连接统计
  getConnectionStats(): ConnectionStats {
    return {
      activeConnections: this.connectionInfoMap.size,
      totalConnections: this.totalConnectionCount,
      connections: Array.from(this.connectionInfoMap.values()),
      lastUpdated: new Date()
    };
  }

  // 获取特定连接信息
  getConnectionInfo(sessionId: string): ConnectionInfo | undefined {
    return this.connectionInfoMap.get(sessionId);
  }

  // 关闭内部服务器
  close(): void {
    if (this.internalServer) {
      this.internalServer.close();
      this.internalServer = undefined;
    }
  }
}

// 修改 startStreamableMcpServer 函数
export async function startStreamableMcpServer(
  server: McpServer, 
  endpoint: string, 
  port: number,
  eventStore: EventStore = new InMemoryEventStore(),
  internalApiPort?: number // 新增：内部 API 端口
): Promise<{ httpServer: Server; internalApiPort: number }> {
  const activeTransports: Record<
    string,
    {
      server: McpServer;
      transport: StreamableHTTPServerTransport;
    }
  > = {};

  // 获取全局连接管理器
  const connectionManager = GlobalConnectionManager.getInstance();
  
  // 启动内部 API 服务器
  const actualInternalApiPort = await connectionManager.startInternalServer(internalApiPort);

  const handleRequest: RequestHandlers["handleRequest"] = async (
    req: IncomingMessage,
    res: ServerResponse,
  ) => {
    if (!req.url) {
      res.writeHead(400).end("No URL");
      return;
    }

    const reqUrl = new URL(req.url, "http://localhost");

    // Handle POST requests to endpoint
    if (req.method === "POST" && reqUrl.pathname === endpoint) {
      try {
        const sessionId = Array.isArray(req.headers["mcp-session-id"])
          ? req.headers["mcp-session-id"][0]
          : req.headers["mcp-session-id"];
        let transport: StreamableHTTPServerTransport;

        const body = await getBody(req);

        // 更新现有连接的活动时间
        if (sessionId) {
          connectionManager.updateConnectionActivity(sessionId);
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

              // 添加到全局连接管理器
              connectionManager.addConnection(connectionInfo);
              activeTransports[_sessionId] = { server, transport };
            },
            sessionIdGenerator: randomUUID,
          });

          // Handle the server close event.
          transport.onclose = async () => {
            const sid = transport.sessionId;
            if (sid && activeTransports[sid]) {
              try {
                await server?.close();
              } catch (error) {
                console.error("Error closing server:", error);
              }

              // 从全局连接管理器移除
              connectionManager.removeConnection(sid);
              delete activeTransports[sid];
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
    connectionManager.close();
  };

  // Create the HTTP server using our factory
  const httpServer = createBaseHttpServer(port, endpoint, {
    handleRequest,
    cleanup,
    serverType: "HTTP Streamable Server",
  });

  return { httpServer, internalApiPort: actualInternalApiPort };
}
```

### 3.3 API 父进程修改

#### 3.3.1 创建连接监控客户端

```typescript
// packages/mcp-swagger-api/src/modules/mcp/services/connection-monitor.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import axios, { AxiosInstance } from 'axios';

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

@Injectable()
export class ConnectionMonitorService {
  private readonly logger = new Logger(ConnectionMonitorService.name);
  private httpClient: AxiosInstance;
  private internalApiUrl: string;
  private pollingInterval?: NodeJS.Timeout;
  private lastConnectionCount = 0;

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.httpClient = axios.create({
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  // 初始化连接监控
  initialize(internalApiPort: number, host: string = 'localhost'): void {
    this.internalApiUrl = `http://${host}:${internalApiPort}`;
    this.logger.log(`Initialized connection monitor with internal API: ${this.internalApiUrl}`);
    
    // 启动轮询
    this.startPolling();
  }

  // 启动轮询监控
  private startPolling(intervalMs: number = 2000): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(async () => {
      try {
        const stats = await this.getConnectionStats();
        
        // 检查连接数是否发生变化
        if (stats.activeConnections !== this.lastConnectionCount) {
          this.eventEmitter.emit('mcp.connections.updated', stats);
          this.lastConnectionCount = stats.activeConnections;
        }
      } catch (error) {
        this.logger.warn('Failed to poll connection stats:', error.message);
      }
    }, intervalMs);

    this.logger.log(`Started connection polling with interval: ${intervalMs}ms`);
  }

  // 停止轮询
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
      this.logger.log('Stopped connection polling');
    }
  }

  // 获取连接统计
  async getConnectionStats(): Promise<ConnectionStats> {
    try {
      const response = await this.httpClient.get(`${this.internalApiUrl}/connections`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get connection stats:', error.message);
      return {
        activeConnections: 0,
        totalConnections: 0,
        connections: [],
        lastUpdated: new Date()
      };
    }
  }

  // 获取活跃连接数
  async getActiveConnectionCount(): Promise<number> {
    try {
      const response = await this.httpClient.get(`${this.internalApiUrl}/connections/count`);
      return response.data.activeConnections || 0;
    } catch (error) {
      this.logger.error('Failed to get active connection count:', error.message);
      return 0;
    }
  }

  // 获取特定连接信息
  async getConnectionInfo(sessionId: string): Promise<ConnectionInfo | null> {
    try {
      const stats = await this.getConnectionStats();
      return stats.connections.find(conn => conn.sessionId === sessionId) || null;
    } catch (error) {
      this.logger.error('Failed to get connection info:', error.message);
      return null;
    }
  }

  // 健康检查
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get(`${this.internalApiUrl}/health`);
      return response.data.status === 'healthy';
    } catch (error) {
      this.logger.error('Connection monitor health check failed:', error.message);
      return false;
    }
  }

  // 清理资源
  onModuleDestroy(): void {
    this.stopPolling();
  }
}
```

#### 3.3.2 修改 MCP Service

```typescript
// packages/mcp-swagger-api/src/modules/mcp/services/mcp.service.ts

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { spawn, ChildProcess } from 'child_process';
import { ConnectionMonitorService, ConnectionStats } from './connection-monitor.service';

@Injectable()
export class MCPService implements OnModuleDestroy {
  private readonly logger = new Logger(MCPService.name);
  private mcpProcess?: ChildProcess;
  private internalApiPort?: number;
  private connectionStats: ConnectionStats = {
    activeConnections: 0,
    totalConnections: 0,
    connections: [],
    lastUpdated: new Date()
  };

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly connectionMonitor: ConnectionMonitorService
  ) {}

  // 启动 MCP 服务器进程
  async startMcpServer(config: any): Promise<string> {
    try {
      // 生成随机端口用于内部 API
      const internalApiPort = Math.floor(Math.random() * (65535 - 49152) + 49152);
      
      // 启动 MCP 服务器子进程
      this.mcpProcess = spawn('node', [
        'dist/index.js', // MCP 服务器入口文件
        '--port', config.port.toString(),
        '--transport', config.transport,
        '--internal-api-port', internalApiPort.toString(),
        '--config', JSON.stringify(config)
      ], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        cwd: process.cwd()
      });

      // 监听子进程输出
      this.mcpProcess.stdout?.on('data', (data) => {
        this.logger.log(`MCP Server: ${data.toString().trim()}`);
        
        // 解析内部 API 端口信息
        const output = data.toString();
        const portMatch = output.match(/Internal connection API server listening on port (\d+)/);
        if (portMatch) {
          this.internalApiPort = parseInt(portMatch[1]);
          this.logger.log(`Detected internal API port: ${this.internalApiPort}`);
          
          // 初始化连接监控
          this.connectionMonitor.initialize(this.internalApiPort);
        }
      });

      this.mcpProcess.stderr?.on('data', (data) => {
        this.logger.error(`MCP Server Error: ${data.toString().trim()}`);
      });

      this.mcpProcess.on('exit', (code) => {
        this.logger.warn(`MCP Server process exited with code: ${code}`);
        this.connectionMonitor.stopPolling();
      });

      // 等待进程启动
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('MCP Server startup timeout'));
        }, 10000);

        const checkStartup = () => {
          if (this.internalApiPort) {
            clearTimeout(timeout);
            resolve(void 0);
          } else {
            setTimeout(checkStartup, 100);
          }
        };
        checkStartup();
      });

      return `http://localhost:${config.port}/mcp`;
    } catch (error) {
      this.logger.error('Failed to start MCP server:', error);
      throw error;
    }
  }

  // 获取连接统计
  async getConnectionStats(): Promise<ConnectionStats> {
    if (this.connectionMonitor) {
      try {
        this.connectionStats = await this.connectionMonitor.getConnectionStats();
      } catch (error) {
        this.logger.warn('Failed to get real-time connection stats, using cached data');
      }
    }
    return this.connectionStats;
  }

  // 获取活跃连接数
  async getActiveConnectionCount(): Promise<number> {
    if (this.connectionMonitor) {
      try {
        return await this.connectionMonitor.getActiveConnectionCount();
      } catch (error) {
        this.logger.warn('Failed to get real-time connection count, using cached data');
      }
    }
    return this.connectionStats.activeConnections;
  }

  // 获取特定连接信息
  async getConnectionInfo(sessionId: string): Promise<any> {
    if (this.connectionMonitor) {
      try {
        return await this.connectionMonitor.getConnectionInfo(sessionId);
      } catch (error) {
        this.logger.warn('Failed to get connection info');
      }
    }
    return this.connectionStats.connections.find(conn => conn.sessionId === sessionId);
  }

  // 健康检查
  async healthCheck(): Promise<any> {
    const connectionStats = await this.getConnectionStats();
    const isHealthy = this.mcpProcess && !this.mcpProcess.killed;
    const monitorHealthy = this.connectionMonitor ? await this.connectionMonitor.healthCheck() : false;
    
    return {
      healthy: isHealthy && monitorHealthy,
      serverRunning: isHealthy,
      monitorRunning: monitorHealthy,
      connections: {
        active: connectionStats.activeConnections,
        total: connectionStats.totalConnections
      },
      lastCheck: new Date()
    };
  }

  // 停止 MCP 服务器
  async stopMcpServer(): Promise<void> {
    if (this.mcpProcess) {
      this.connectionMonitor.stopPolling();
      this.mcpProcess.kill('SIGTERM');
      
      // 等待进程退出
      await new Promise((resolve) => {
        this.mcpProcess!.on('exit', resolve);
        setTimeout(() => {
          if (!this.mcpProcess!.killed) {
            this.mcpProcess!.kill('SIGKILL');
          }
          resolve(void 0);
        }, 5000);
      });
      
      this.mcpProcess = undefined;
      this.internalApiPort = undefined;
    }
  }

  // 清理资源
  async onModuleDestroy(): Promise<void> {
    await this.stopMcpServer();
  }
}
```

#### 3.3.3 更新 MCP Controller

```typescript
// packages/mcp-swagger-api/src/modules/mcp/mcp.controller.ts

import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { MCPService } from './services/mcp.service';

@ApiTags('MCP')
@Controller('mcp')
export class MCPController {
  constructor(private readonly mcpService: MCPService) {}

  @Get('connections')
  @ApiOperation({ summary: '获取 MCP 客户端连接统计' })
  @ApiResponse({ status: 200, description: '客户端连接统计信息' })
  async getConnections() {
    return await this.mcpService.getConnectionStats();
  }

  @Get('connections/count')
  @ApiOperation({ summary: '获取活跃连接数' })
  @ApiResponse({ status: 200, description: '活跃连接数' })
  async getActiveConnectionCount() {
    const count = await this.mcpService.getActiveConnectionCount();
    return {
      activeConnections: count,
      timestamp: new Date()
    };
  }

  @Get('connections/:sessionId')
  @ApiOperation({ summary: '获取特定连接信息' })
  @ApiParam({ name: 'sessionId', description: '会话ID' })
  @ApiResponse({ status: 200, description: '连接详细信息' })
  @ApiResponse({ status: 404, description: '连接不存在' })
  async getConnectionInfo(@Param('sessionId') sessionId: string) {
    const connectionInfo = await this.mcpService.getConnectionInfo(sessionId);
    
    if (!connectionInfo) {
      return {
        error: 'Connection not found',
        sessionId
      };
    }
    
    return connectionInfo;
  }

  @Get('health')
  @ApiOperation({ summary: 'MCP 服务器健康检查' })
  @ApiResponse({ status: 200, description: '健康检查结果' })
  async healthCheck() {
    return await this.mcpService.healthCheck();
  }
}
```

#### 3.3.4 WebSocket 集成

```typescript
// packages/mcp-swagger-api/src/modules/websocket/websocket.gateway.ts

import { OnEvent } from '@nestjs/event-emitter';
import { MCPService } from '../mcp/services/mcp.service';

@WebSocketGateway({
  namespace: 'monitoring',
  cors: { origin: '*' }
})
export class MonitoringGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly mcpService: MCPService) {}

  @SubscribeMessage('subscribe_mcp_connections')
  async handleSubscribeMcpConnections(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { serverId?: string }
  ) {
    const room = `mcp_connections_${data.serverId || 'default'}`;
    await client.join(room);
    
    // 立即发送当前连接状态
    const stats = await this.mcpService.getConnectionStats();
    client.emit('mcp_connections_data', {
      timestamp: new Date(),
      ...stats
    });
    
    return { status: 'subscribed', room, timestamp: new Date() };
  }

  // 监听连接变化事件
  @OnEvent('mcp.connections.updated')
  handleMcpConnectionsUpdated(stats: any) {
    this.server.to('mcp_connections_default').emit('mcp_connections_data', {
      timestamp: new Date(),
      ...stats
    });
  }
}
```

## 4. 部署和使用

### 4.1 启动流程

1. **启动 API 服务**：NestJS API 服务启动
2. **Spawn MCP 进程**：API 服务通过 spawn 启动 MCP 服务器子进程
3. **内部 API 启动**：MCP 子进程启动内部 HTTP API 服务器
4. **连接监控初始化**：API 服务检测到内部 API 端口后初始化连接监控
5. **开始轮询**：API 服务开始定期轮询连接状态

### 4.2 API 使用示例

```bash
# 获取连接统计
curl http://localhost:3001/api/mcp/connections

# 获取活跃连接数
curl http://localhost:3001/api/mcp/connections/count

# 获取特定连接信息
curl http://localhost:3001/api/mcp/connections/{sessionId}

# 健康检查
curl http://localhost:3001/api/mcp/health
```

### 4.3 WebSocket 使用示例

```javascript
// 前端连接 WebSocket
const socket = io('http://localhost:3001/monitoring');

// 订阅 MCP 连接统计
socket.emit('subscribe_mcp_connections', { serverId: 'default' });

// 监听连接数据更新
socket.on('mcp_connections_data', (data) => {
  console.log('Connection Stats:', data);
  // 更新 UI 显示
});
```

## 5. 优势和限制

### 5.1 优势

- ✅ **完全兼容 Spawn 架构**：无需修改现有的进程隔离设计
- ✅ **实时性好**：通过轮询实现准实时的连接状态更新
- ✅ **标准化接口**：使用 HTTP API，易于调试和扩展
- ✅ **容错性强**：API 进程和 MCP 进程独立运行，互不影响
- ✅ **易于测试**：内部 API 可以独立测试

### 5.2 限制

- ⚠️ **轻微延迟**：轮询机制导致的 2-5 秒延迟
- ⚠️ **额外端口**：需要管理内部 API 端口
- ⚠️ **网络开销**：HTTP 请求的轻微开销

### 5.3 性能优化建议

- 调整轮询间隔以平衡实时性和性能
- 使用连接池优化 HTTP 请求
- 实现智能轮询（连接数变化时增加频率）
- 添加缓存机制减少重复请求

## 6. 总结

通过 HTTP 内部 API 方案，可以在 Spawn 架构下完美实现 MCP 客户端连接监控功能。该方案在保持进程隔离的同时，提供了完整的连接统计、实时监控和 WebSocket 推送能力，是 Spawn 架构下的最佳解决方案。