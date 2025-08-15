# MCP 客户端连接监控技术方案

## 1. 问题分析

### 1.1 当前架构
基于代码分析，当前 `mcp-swagger-server` 项目的架构如下：
- **mcp-swagger-api**: NestJS API 服务，运行在端口 3001
- **mcp-swagger-server**: MCP 服务器核心，通过 API 服务直接调用（同进程）
- **activeTransports**: 在 `stream.ts` 中管理的活跃连接对象

### 1.2 核心需求
用户希望在 API 进程中访问 MCP 服务器进程的连接数，具体需要：
- 获取当前活跃的 MCP 客户端连接数
- 获取客户端连接信息（IP、User-Agent、连接时间等）
- 实时监控连接状态变化

### 1.3 技术挑战
- `activeTransports` 对象封装在 `startStreamableMcpServer` 函数内部
- 需要将连接信息暴露给外部访问
- 需要支持实时更新和 WebSocket 推送

## 2. 技术方案

### 2.1 方案一：扩展 Stream.ts 暴露连接信息（推荐）

#### 2.1.1 核心思路
修改 `stream.ts` 文件，将 `activeTransports` 信息通过回调函数或事件机制暴露给外部。

#### 2.1.2 实现步骤

**步骤1: 扩展 startStreamableMcpServer 函数**
```typescript
// 在 stream.ts 中添加连接监控接口
export interface ConnectionInfo {
  sessionId: string;
  clientIP: string;
  userAgent: string;
  connectedAt: Date;
  lastActivity: Date;
}

export interface ConnectionMonitor {
  onConnectionChange?: (connections: ConnectionInfo[]) => void;
  onConnectionEstablished?: (connection: ConnectionInfo) => void;
  onConnectionClosed?: (sessionId: string) => void;
}

// 修改函数签名
export async function startStreamableMcpServer(
  server: McpServer, 
  endpoint: string, 
  port: number,
  eventStore: EventStore = new InMemoryEventStore(),
  connectionMonitor?: ConnectionMonitor
): Promise<Server> {
  // 现有代码...
  
  // 添加连接信息跟踪
  const connectionInfoMap = new Map<string, ConnectionInfo>();
  
  // 在 onsessioninitialized 回调中添加监控
  onsessioninitialized: (_sessionId: string) => {
    const connectionInfo: ConnectionInfo = {
      sessionId: _sessionId,
      clientIP: req.socket.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      connectedAt: new Date(),
      lastActivity: new Date()
    };
    
    connectionInfoMap.set(_sessionId, connectionInfo);
    activeTransports[_sessionId] = { server, transport };
    
    // 通知外部监听器
    connectionMonitor?.onConnectionEstablished?.(connectionInfo);
    connectionMonitor?.onConnectionChange?.(Array.from(connectionInfoMap.values()));
  },
  
  // 在 onclose 回调中添加监控
  transport.onclose = async () => {
    const sid = transport.sessionId;
    if (sid && activeTransports[sid]) {
      // 现有清理代码...
      
      // 清理连接信息
      connectionInfoMap.delete(sid);
      
      // 通知外部监听器
      connectionMonitor?.onConnectionClosed?.(sid);
      connectionMonitor?.onConnectionChange?.(Array.from(connectionInfoMap.values()));
    }
  };
  
  // 添加获取连接统计的方法
  (httpServer as any).getConnectionStats = () => {
    return {
      activeConnections: connectionInfoMap.size,
      connections: Array.from(connectionInfoMap.values())
    };
  };
}
```

**步骤2: 修改 MCP Service 集成连接监控**
```typescript
// 在 mcp.service.ts 中
import { ConnectionMonitor, ConnectionInfo } from 'mcp-swagger-server';

@Injectable()
export class MCPService implements OnModuleDestroy {
  private connectionStats = {
    activeConnections: 0,
    connections: [] as ConnectionInfo[]
  };
  
  private createConnectionMonitor(): ConnectionMonitor {
    return {
      onConnectionChange: (connections) => {
        this.connectionStats = {
          activeConnections: connections.length,
          connections
        };
        
        // 更新监控服务
        this.eventEmitter.emit('mcp.connections.updated', {
          count: connections.length,
          connections
        });
        
        // 通过 WebSocket 推送给前端
        this.eventEmitter.emit('websocket.push', {
          event: 'mcp_connections_updated',
          data: this.connectionStats
        });
      },
      
      onConnectionEstablished: (connection) => {
        this.logger.log(`New MCP client connected: ${connection.sessionId} from ${connection.clientIP}`);
        this.eventEmitter.emit('mcp.connection.established', connection);
      },
      
      onConnectionClosed: (sessionId) => {
        this.logger.log(`MCP client disconnected: ${sessionId}`);
        this.eventEmitter.emit('mcp.connection.closed', { sessionId });
      }
    };
  }
  
  private async startServer(): Promise<string> {
    // 现有代码...
    
    switch (transport) {
      case 'streamable':
        // 传入连接监控器
        this.httpServer = await startStreamableMcpServer(
          this.currentServer!, 
          '/mcp', 
          port,
          undefined, // eventStore
          this.createConnectionMonitor() // 新增的连接监控器
        );
        return `http://localhost:${port}/mcp`;
    }
  }
  
  // 添加获取连接统计的方法
  getConnectionStats() {
    return this.connectionStats;
  }
  
  // 添加获取实时连接信息的方法
  getRealTimeConnectionStats() {
    if (this.httpServer && (this.httpServer as any).getConnectionStats) {
      return (this.httpServer as any).getConnectionStats();
    }
    return this.connectionStats;
  }
}
```

**步骤3: 添加 API 端点**
```typescript
// 在 mcp.controller.ts 中添加
@Get('connections')
@ApiOperation({ summary: '获取 MCP 客户端连接统计' })
async getConnections() {
  return this.mcpService.getRealTimeConnectionStats();
}

@Get('connections/realtime')
@ApiOperation({ summary: '获取实时连接信息' })
async getRealtimeConnections() {
  return {
    timestamp: new Date(),
    ...this.mcpService.getRealTimeConnectionStats()
  };
}
```

**步骤4: WebSocket 集成**
```typescript
// 在 websocket.gateway.ts 中添加
@SubscribeMessage('subscribe_mcp_connections')
async handleSubscribeMcpConnections(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { serverId?: string }
) {
  const room = `mcp_connections_${data.serverId || 'default'}`;
  await client.join(room);
  
  // 立即发送当前连接状态
  const stats = this.mcpService.getRealTimeConnectionStats();
  client.emit('mcp_connections_data', stats);
  
  return { status: 'subscribed', room };
}

// 监听连接变化事件
@OnEvent('mcp.connections.updated')
handleMcpConnectionsUpdated(data: any) {
  this.server.to('mcp_connections_default').emit('mcp_connections_data', data);
}
```

### 2.2 方案二：共享内存/文件系统方案

#### 2.2.1 核心思路
通过共享文件或内存映射的方式，让 MCP 服务器进程定期写入连接信息，API 进程读取。

#### 2.2.2 实现方案
```typescript
// 连接信息持久化
class ConnectionPersistence {
  private filePath = path.join(process.cwd(), 'mcp-connections.json');
  
  async saveConnections(connections: ConnectionInfo[]) {
    const data = {
      timestamp: new Date().toISOString(),
      activeConnections: connections.length,
      connections
    };
    
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2));
  }
  
  async loadConnections(): Promise<ConnectionInfo[]> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.connections || [];
    } catch {
      return [];
    }
  }
}
```

### 2.3 方案三：HTTP API 内部通信

#### 2.3.1 核心思路
在 MCP 服务器中暴露内部 HTTP API，供 API 进程调用获取连接信息。

#### 2.3.2 实现方案
```typescript
// 在 stream.ts 中添加内部 API
if (req.method === 'GET' && reqUrl.pathname === '/internal/connections') {
  const stats = {
    activeConnections: Object.keys(activeTransports).length,
    connections: Object.keys(activeTransports).map(sessionId => ({
      sessionId,
      // 其他连接信息
    }))
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(200);
  res.end(JSON.stringify(stats));
  return;
}
```

## 3. 方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| 方案一：扩展 Stream.ts | • 实时性最好<br>• 性能最优<br>• 集成度高 | • 需要修改核心代码<br>• 耦合度较高 | ⭐⭐⭐⭐⭐ |
| 方案二：共享文件系统 | • 解耦性好<br>• 实现简单 | • 实时性差<br>• 文件 I/O 开销 | ⭐⭐⭐ |
| 方案三：HTTP API | • 标准化接口<br>• 易于测试 | • 网络开销<br>• 复杂度中等 | ⭐⭐⭐⭐ |

## 4. 实施建议

### 4.1 推荐实施路径
1. **第一阶段**: 实施方案一的基础版本，支持基本的连接统计
2. **第二阶段**: 完善连接信息收集，添加客户端详细信息
3. **第三阶段**: 集成 WebSocket 实时推送
4. **第四阶段**: 添加连接历史和分析功能

### 4.2 关键实施点
- **向后兼容**: 确保修改不影响现有 MCP 协议功能
- **性能优化**: 连接信息收集不应影响 MCP 服务器性能
- **错误处理**: 连接监控失败不应影响 MCP 服务器正常运行
- **内存管理**: 避免连接信息累积导致内存泄漏

### 4.3 测试策略
- **单元测试**: 测试连接信息收集和暴露功能
- **集成测试**: 测试 API 端点和 WebSocket 推送
- **压力测试**: 测试大量连接情况下的性能表现
- **兼容性测试**: 确保现有 MCP 客户端正常工作

## 5. 预期效果

实施完成后，将实现：
- ✅ 实时获取 MCP 客户端连接数
- ✅ 详细的客户端连接信息（IP、User-Agent、连接时间等）
- ✅ WebSocket 实时推送连接状态变化
- ✅ RESTful API 接口支持
- ✅ 与现有监控系统集成
- ✅ 连接历史和统计分析

通过这个方案，用户可以在 API 进程中完全访问和监控 MCP 服务器的客户端连接情况，满足实时监控和管理的需求。