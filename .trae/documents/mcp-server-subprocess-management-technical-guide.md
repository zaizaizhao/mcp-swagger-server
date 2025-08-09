# MCP Swagger 子进程管理技术文档

## 概述

本文档详细说明了 MCP Swagger 项目中如何通过子进程启动和停止 MCP 服务器，以及 API 项目中如何获取和管理子进程的 httpServer 和 mcpServer 实例。

## 1. 架构概览

### 1.1 核心组件

* **ServerManagerService**: 服务器管理的主要入口，负责协调各个组件

* **ServerLifecycleService**: 服务器生命周期管理，处理启动和停止逻辑

* **ProcessManagerService**: 进程管理服务，负责子进程的创建、监控和销毁

* **ServerInstance**: 服务器实例接口，存储服务器相关的所有信息

### 1.2 ServerInstance 结构

```typescript
export interface ServerInstance {
  id: string;                    // 服务器唯一标识
  entity: MCPServerEntity;       // 数据库实体
  mcpServer?: any;              // MCP服务器实例
  httpServer?: any;             // HTTP服务器实例
  startTime?: Date;             // 启动时间
  lastActivity?: Date;          // 最后活动时间
}
```

## 2. 子进程启动 MCP 服务器

### 2.1 启动流程概览

1. **接收启动请求** → ServerManagerService.startServer()
2. **检查服务器状态** → 防止重复启动
3. **更新数据库状态** → 设置为 STARTING
4. **调用生命周期服务** → ServerLifecycleService.startServer()
5. **根据传输类型选择启动方式**
6. **创建 ServerInstance** → 存储服务器实例信息
7. **更新状态为 RUNNING**

### 2.2 不同传输类型的启动方式

#### 2.2.1 STREAMABLE 传输类型

```typescript
private async startStreamableServer(config: any): Promise<{ mcpServer: any; httpServer: any }> {
  try {
    // 1. 创建MCP服务器实例
    const mcpServer = await createMcpServer({
      openApiData: config.tools,
      authConfig: config.authConfig,
      customHeaders: config.config?.customHeaders || {},
      debugHeaders: config.config?.debugHeaders || false,
    });

    // 2. 启动Streamable传输
    const endpoint = config.config?.endpoint || '/mcp';
    const httpServer = await startStreamableMcpServer(mcpServer, endpoint, config.port);

    return {
      mcpServer,
      httpServer,
    };
  } catch (error) {
    this.logger.error(`Failed to start streamable server: ${error.message}`);
    throw error;
  }
}
```

**关键点**:

* 使用 `createMcpServer` 创建 MCP 服务器实例

* 使用 `startStreamableMcpServer` 创建 HTTP 服务器并绑定 MCP 服务器

* 返回两个实例供后续管理使用

#### 2.2.2 SSE 传输类型

```typescript
private async startSSEServer(config: any): Promise<{ mcpServer: any; httpServer: any }> {
  try {
    // 创建MCP服务器实例
    const mcpServer = await createMcpServer({
      openApiData: config.tools,
      authConfig: config.authConfig,
      customHeaders: config.config?.customHeaders || {},
      debugHeaders: config.config?.debugHeaders || false,
    });

    // 启动SSE传输
    const endpoint = config.config?.endpoint || '/mcp';
    const httpServer = await startSseMcpServer(mcpServer, endpoint, config.port);

    return {
      mcpServer,
      httpServer,
    };
  } catch (error) {
    this.logger.error(`Failed to start SSE server: ${error.message}`);
    throw error;
  }
}
```

#### 2.2.3 CLI Spawn 模式

```typescript
// 使用进程管理器启动子进程
const processInfo = await this.processManager.startProcess(processConfig);

// ProcessConfig 配置
const processConfig: ProcessConfig = {
  command: 'node',
  args: this.buildCliArgs(serverEntity),
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'production',
    MCP_SERVER_PORT: serverEntity.port.toString(),
  },
  restartPolicy: {
    enabled: true,
    maxRetries: 3,
    retryDelay: 5000,
  },
};
```

**CLI 参数构建**:

```typescript
private buildCliArgs(serverEntity: MCPServerEntity): string[] {
  const args: string[] = [];
  
  // 添加传输类型
  args.push('--transport', serverEntity.transport.toLowerCase());
  
  // 添加端口
  args.push('--port', serverEntity.port.toString());
  
  // 添加 OpenAPI 数据
  if (serverEntity.openApiData) {
    const tempFile = this.createTempOpenApiFile(serverEntity.openApiData);
    args.push('--openapi', tempFile);
  }
  
  return args;
}
```

### 2.3 HTTP 服务器创建机制

#### startStreamableMcpServer 实现

```typescript
export async function startStreamableMcpServer(
  server: McpServer, 
  endpoint: string, 
  port: number,
  eventStore: EventStore = new InMemoryEventStore()
): Promise<Server> {
  const activeTransports: Record<string, {
    server: McpServer;
    transport: StreamableHTTPServerTransport;
  }> = {};

  const handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
    // 处理 POST 请求到端点
    if (req.method === "POST" && reqUrl.pathname === endpoint) {
      // 会话管理和传输处理逻辑
      // ...
    }
    
    // 处理 GET 请求（重连机制）
    if (req.method === "GET" && reqUrl.pathname === endpoint) {
      // 重连处理逻辑
      // ...
    }
  };

  // 创建 HTTP 服务器
  const httpServer = createBaseHttpServer(port, endpoint, {
    handleRequest,
    cleanup: () => {
      for (const { server, transport } of Object.values(activeTransports)) {
        transport.close();
        server.close();
      }
    },
    serverType: "HTTP Streamable Server",
  });
    
  return httpServer;
}
```

## 3. 停止 MCP 服务器

### 3.1 停止流程概览

1. **接收停止请求** → ServerManagerService.stopServer()
2. **检查服务器状态** → 防止重复停止
3. **更新数据库状态** → 设置为 STOPPING
4. **调用生命周期服务** → ServerLifecycleService.stopServer()
5. **根据传输类型选择停止策略**
6. **清理资源和更新状态**

### 3.2 停止策略实现

```typescript
async stopServer(instance: ServerInstance): Promise<void> {
  const transport = instance.entity.transport;
  this.logger.log(`Stopping server '${instance.entity.name}' (transport: ${transport})`);

  try {
    // 停止健康检查
    this.processHealth.stopHealthCheck(instance.id);

    // 根据传输类型采用不同的停止策略
    if (transport === TransportType.STREAMABLE || transport === TransportType.SSE) {
      // 对于HTTP传输类型，直接停止HTTP服务器和MCP服务器
      this.logger.log(`Stopping HTTP-based server '${instance.entity.name}' (${transport} mode)`);
      
      // 停止HTTP服务器
      if (instance.httpServer) {
        await this.stopHttpServer(instance.httpServer);
        this.logger.log(`HTTP server stopped for '${instance.entity.name}'`);
      }

      // 停止MCP服务器
      if (instance.mcpServer) {
        await this.stopMCPServer(instance.mcpServer);
        this.logger.log(`MCP server stopped for '${instance.entity.name}'`);
      }
    } else {
      // 对于CLI spawn模式或其他进程模式，使用进程管理器
      this.logger.log(`Stopping process-based server '${instance.entity.name}' (CLI spawn mode)`);
      await this.processManager.stopProcess(instance.id);
    }

    // 清除超时监控和发送停止事件
    // ...
  } catch (error) {
    // 错误处理
    // ...
  }
}
```

### 3.3 具体停止方法

#### HTTP 服务器停止

```typescript
private async stopHttpServer(httpServer: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('HTTP server stop timeout'));
    }, 10000); // 10秒超时

    httpServer.close((error: any) => {
      clearTimeout(timeout);
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
```

#### MCP 服务器停止

```typescript
private async stopMCPServer(mcpServer: any): Promise<void> {
  try {
    // 优先调用close方法
    if (typeof mcpServer.close === 'function') {
      await mcpServer.close();
    }
    
    // 如果有stop方法，也调用它
    if (typeof mcpServer.stop === 'function') {
      await mcpServer.stop();
    }
  } catch (error) {
    this.logger.warn('Error stopping MCP server:', error);
  }
}
```

#### 进程停止（CLI Spawn 模式）

```typescript
async stopProcess(processId: string): Promise<void> {
  const processInfo = this.processes.get(processId);
  if (!processInfo || !processInfo.process) {
    throw new Error(`Process ${processId} not found or already stopped`);
  }

  this.logger.log(`Stopping process ${processId} (PID: ${processInfo.process.pid})`);
  
  try {
    // 更新状态
    await this.updateProcessStatus(processId, ProcessStatus.STOPPING);
    
    // 优雅关闭：发送 SIGTERM
    processInfo.process.kill('SIGTERM');
    
    // 等待进程退出，如果超时则强制杀死
    const exitPromise = new Promise<void>((resolve) => {
      processInfo.process!.once('exit', () => resolve());
    });
    
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Process stop timeout')), 10000);
    });
    
    try {
      await Promise.race([exitPromise, timeoutPromise]);
    } catch (error) {
      // 强制杀死进程
      this.logger.warn(`Force killing process ${processId}`);
      processInfo.process.kill('SIGKILL');
      await exitPromise;
    }
    
    // 清理资源
    await this.cleanupProcess(processId);
    
  } catch (error) {
    this.logger.error(`Failed to stop process ${processId}:`, error);
    throw error;
  }
}
```

## 4. API 项目中获取子进程实例的机制

### 4.1 实例存储机制

```typescript
@Injectable()
export class ServerManagerService {
  private readonly serverInstances = new Map<string, ServerInstance>();
  
  // 启动服务器时存储实例
  async startServer(id: string): Promise<ServerResponseDto> {
    // ... 启动逻辑
    
    // 创建并存储 ServerInstance
    const instance: ServerInstance = {
      id: server.id,
      entity: server,
      mcpServer: result.mcpServer,    // 从启动结果获取
      httpServer: result.httpServer,  // 从启动结果获取
      startTime: new Date(),
    };
    
    this.serverInstances.set(server.id, instance);
    
    return ServerMapper.toResponseDto(server);
  }
  
  // 获取服务器实例
  getServerInstance(id: string): ServerInstance | undefined {
    return this.serverInstances.get(id);
  }
}
```

### 4.2 不同传输类型的实例获取

#### HTTP 传输类型（STREAMABLE/SSE）

对于 HTTP 传输类型，`mcpServer` 和 `httpServer` 实例是在同一进程中创建的：

```typescript
// 在 startStreamableServer 中
const mcpServer = await createMcpServer(options);           // MCP 服务器实例
const httpServer = await startStreamableMcpServer(...);     // HTTP 服务器实例

// 返回给调用者
return { mcpServer, httpServer };
```

**为什么能获取到实例**:

1. **同进程执行**: HTTP 传输类型在同一进程中运行，可以直接获取对象引用
2. **函数返回值**: 启动函数直接返回创建的实例
3. **内存共享**: 所有实例都在同一内存空间中

#### CLI Spawn 模式

对于 CLI Spawn 模式，子进程是独立的：

```typescript
// 只能获取进程信息，无法直接获取 mcpServer 和 httpServer 实例
const processInfo = await this.processManager.startProcess(processConfig);

// ServerInstance 中的 mcpServer 和 httpServer 为 undefined
const instance: ServerInstance = {
  id: server.id,
  entity: server,
  mcpServer: undefined,     // 子进程中的实例无法直接访问
  httpServer: undefined,    // 子进程中的实例无法直接访问
  startTime: new Date(),
};
```

**为什么无法获取实例**:

1. **进程隔离**: 子进程有独立的内存空间
2. **IPC 限制**: 进程间通信无法传递复杂对象
3. **安全考虑**: 进程隔离提供更好的稳定性和安全性

### 4.3 实例管理策略

```typescript
// 根据传输类型判断是否有直接实例访问
if (transport === TransportType.STREAMABLE || transport === TransportType.SSE) {
  // 可以直接操作 mcpServer 和 httpServer 实例
  if (instance.httpServer) {
    await this.stopHttpServer(instance.httpServer);
  }
  if (instance.mcpServer) {
    await this.stopMCPServer(instance.mcpServer);
  }
} else {
  // CLI spawn 模式，通过进程管理器操作
  await this.processManager.stopProcess(instance.id);
}
```

## 5. 进程管理和资源清理

### 5.1 进程生命周期管理

```typescript
// 进程事件监听
this.eventEmitter.on('process.started', async (event: ProcessEvent) => {
  await this.handleProcessStarted(event);
});

this.eventEmitter.on('process.stopped', async (event: ProcessEvent) => {
  await this.handleProcessStopped(event);
});

this.eventEmitter.on('process.error', async (event: ProcessErrorEvent) => {
  await this.handleProcessError(event);
});
```

### 5.2 资源清理机制

```typescript
private async cleanupProcess(processId: string): Promise<void> {
  const processInfo = this.processes.get(processId);
  if (!processInfo) return;

  try {
    // 1. 移除进程引用
    this.processes.delete(processId);
    
    // 2. 更新进程状态
    await this.updateProcessStatus(processId, ProcessStatus.STOPPED);
    
    // 3. 删除 PID 文件
    await this.deletePidFile(processId);
    
    // 4. 清理临时文件
    if (processInfo.tempFiles) {
      for (const file of processInfo.tempFiles) {
        await fs.unlink(file).catch(() => {});
      }
    }
    
    // 5. 发送清理完成事件
    this.eventEmitter.emit('process.cleanup_completed', {
      processId,
      timestamp: new Date()
    });
    
  } catch (error) {
    this.logger.error(`Failed to cleanup process ${processId}:`, error);
  }
}
```

### 5.3 内存泄漏防护

```typescript
// 定期清理无效实例
setInterval(() => {
  for (const [id, instance] of this.serverInstances.entries()) {
    if (instance.entity.status === ServerStatus.STOPPED) {
      // 清理已停止的服务器实例
      this.serverInstances.delete(id);
    }
  }
}, 60000); // 每分钟清理一次

// 应用关闭时清理所有资源
async onApplicationShutdown(): Promise<void> {
  this.logger.log('Shutting down ServerManagerService...');
  
  // 停止所有运行中的服务器
  const runningServers = Array.from(this.serverInstances.values())
    .filter(instance => instance.entity.status === ServerStatus.RUNNING);
    
  await Promise.all(
    runningServers.map(instance => 
      this.stopServer(instance.id).catch(error => 
        this.logger.error(`Failed to stop server ${instance.id}:`, error)
      )
    )
  );
  
  // 清理所有实例
  this.serverInstances.clear();
}
```

## 6. 总结

### 6.1 关键设计原则

1. **传输类型分离**: 不同传输类型采用不同的启动和停止策略
2. **进程隔离**: CLI spawn 模式提供进程级别的隔离
3. **资源管理**: 严格的资源创建和清理机制
4. **错误处理**: 完善的错误处理和恢复机制
5. **事件驱动**: 基于事件的异步处理模式

### 6.2 实例获取机制总结

| 传输类型       | mcpServer 实例 | httpServer 实例 | 获取方式        |
| ---------- | ------------ | ------------- | ----------- |
| STREAMABLE | ✅ 可获取        | ✅ 可获取         | 同进程直接引用     |
| SSE        | ✅ 可获取        | ✅ 可获取         | 同进程直接引用     |
| CLI Spawn  | ❌ 无法获取       | ❌ 无法获取        | 进程隔离，通过 IPC |

### 6.3 优势和权衡

**HTTP 传输类型优势**:

* 直接实例访问，操作简单

* 性能更好，无进程间通信开销

* 调试方便

**CLI Spawn 模式优势**:

* 进程隔离，稳定性更好

* 资源隔离，内存泄漏影响小

* 可独立重

