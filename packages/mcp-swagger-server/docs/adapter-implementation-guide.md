# 适配器层实现指南

## 适配器架构设计

适配器层负责将核心功能适配到不同的使用场景：
- **CLIAdapter**: 独立命令行服务器
- **HTTPAdapter**: 集成到Web框架(如NestJS)
- **LibraryAdapter**: 纯库形式集成

## 1. CLI适配器实现

```typescript
// src/adapters/CLIAdapter.ts
import { ToolManager } from '../core/ToolManager';
import { MCPRegistry } from '../core/MCPRegistry';
import { Transformer } from '../core/Transformer';
import { startStdioMcpServer, startSseMcpServer, startStreamableMcpServer } from '../transport';
import { CLIOptions, TransportConfig } from '../types/adapters';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export class CLIAdapter {
  private toolManager: ToolManager;
  private mcpRegistry: MCPRegistry;
  private transformer: Transformer;
  private currentServer?: McpServer;
  private currentServerId?: string;

  constructor() {
    this.toolManager = new ToolManager();
    this.mcpRegistry = new MCPRegistry();
    this.transformer = new Transformer();

    // 设置事件监听
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // 监听工具变化，自动重新绑定到服务器
    this.toolManager.on('toolRegistered', async (event) => {
      if (this.currentServerId) {
        await this.mcpRegistry.bindToolsToServer(this.currentServerId, [event.tool]);
      }
    });

    this.toolManager.on('toolUnregistered', async (event) => {
      if (this.currentServerId) {
        await this.mcpRegistry.unbindToolsFromServer(this.currentServerId, [event.tool.id]);
      }
    });

    // 优雅关闭处理
    process.on('SIGINT', async () => {
      await this.dispose();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.dispose();
      process.exit(0);
    });
  }

  async runStandalone(options: CLIOptions = { transport: 'stdio' }): Promise<void> {
    console.log('🚀 Starting MCP Swagger Server in standalone mode...');
    
    try {
      // 创建MCP服务器
      const server = await this.mcpRegistry.createServer({
        name: 'mcp-swagger-server',
        version: '2.0.0',
        description: 'A Model Context Protocol server for Swagger documentation'
      });

      this.currentServer = server;
      this.currentServerId = 'standalone';

      // 加载和转换OpenAPI规范
      await this.loadInitialTools(options);

      // 启动传输层
      await this.startTransport(server, {
        type: options.transport,
        options: {
          port: options.port,
          endpoint: options.endpoint
        }
      });

      console.log('✅ MCP Swagger Server started successfully!');

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      throw error;
    }
  }

  private async loadInitialTools(options: CLIOptions) {
    try {
      console.log('📖 Loading initial tools from OpenAPI specification...');

      // 从文件或默认位置加载OpenAPI规范
      const tools = await this.transformer.transformFromFile(
        options.swaggerFile,
        {
          baseUrl: options.baseUrl,
          includeDeprecated: false,
          requestTimeout: 30000
        }
      );

      // 注册工具
      await this.toolManager.registerTools(tools);

      // 绑定到服务器
      if (this.currentServerId) {
        await this.mcpRegistry.bindToolsToServer(this.currentServerId, tools);
      }

      console.log(`🎉 Successfully loaded ${tools.length} tools`);

    } catch (error) {
      console.warn('⚠️ Failed to load initial tools:', error.message);
      console.log('📝 Server will start without initial tools. You can add them later.');
    }
  }

  private async startTransport(server: McpServer, config: TransportConfig) {
    switch (config.type) {
      case 'stdio':
        console.log('🔗 Starting STDIO transport...');
        await startStdioMcpServer(server);
        break;

      case 'sse':
        const ssePort = config.options?.port || 3322;
        const sseEndpoint = config.options?.endpoint || '/sse';
        console.log(`🔗 Starting SSE transport on port ${ssePort}${sseEndpoint}`);
        await startSseMcpServer(server, sseEndpoint, ssePort);
        break;

      case 'streamable':
        const streamPort = config.options?.port || 3322;
        const streamEndpoint = config.options?.endpoint || '/mcp';
        console.log(`🔗 Starting HTTP Stream transport on port ${streamPort}${streamEndpoint}`);
        await startStreamableMcpServer(server, streamEndpoint, streamPort);
        break;

      default:
        throw new Error(`Unsupported transport type: ${config.type}`);
    }
  }

  // 运行时工具管理API
  async addToolsFromFile(filePath: string, options?: { baseUrl?: string }): Promise<void> {
    const tools = await this.transformer.transformFromFile(filePath, options);
    await this.toolManager.registerTools(tools);
    console.log(`➕ Added ${tools.length} tools from ${filePath}`);
  }

  async addToolsFromUrl(url: string, options?: { baseUrl?: string }): Promise<void> {
    const tools = await this.transformer.transformFromUrl(url, options);
    await this.toolManager.registerTools(tools);
    console.log(`➕ Added ${tools.length} tools from ${url}`);
  }

  async removeToolsByTag(tag: string): Promise<void> {
    const tools = this.toolManager.getToolsByTag(tag);
    const toolIds = tools.map(t => t.id);
    await this.toolManager.unregisterTools(toolIds);
    console.log(`➖ Removed ${toolIds.length} tools with tag: ${tag}`);
  }

  // 状态查询
  getServerStatus() {
    return this.currentServerId ? 
      this.mcpRegistry.getServerStatus(this.currentServerId) : 
      undefined;
  }

  getToolStats() {
    return this.toolManager.getStats();
  }

  // 资源清理
  async dispose(): Promise<void> {
    console.log('🔄 Disposing CLI Adapter...');

    if (this.currentServerId) {
      await this.mcpRegistry.destroyServer(this.currentServerId);
    }

    await this.toolManager.dispose();
    
    console.log('✅ CLI Adapter disposed');
  }
}
```

## 2. HTTP适配器实现

```typescript
// src/adapters/HTTPAdapter.ts
import { Request, Response, NextFunction } from 'express';
import { ToolManager } from '../core/ToolManager';
import { MCPRegistry } from '../core/MCPRegistry';
import { Transformer } from '../core/Transformer';
import { HTTPAdapterConfig, McpServerConfig } from '../types/adapters';
import { MCPTool } from '../types/core';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface RequestHandler {
  (req: Request, res: Response, next: NextFunction): Promise<void>;
}

export class HTTPAdapter {
  private toolManager: ToolManager;
  private mcpRegistry: MCPRegistry;
  private transformer: Transformer;
  private config: HTTPAdapterConfig;
  private metrics = {
    requestCount: 0,
    errorCount: 0,
    toolExecutions: new Map<string, number>()
  };

  constructor(config: HTTPAdapterConfig = {}) {
    this.toolManager = new ToolManager();
    this.mcpRegistry = new MCPRegistry();
    this.transformer = new Transformer();
    this.config = {
      defaultTimeout: 30000,
      maxConcurrentServers: 10,
      enableMetrics: true,
      enableHealthCheck: true,
      ...config
    };

    this.setupEventListeners();
  }

  private setupEventListeners() {
    // 监听工具执行统计
    if (this.config.enableMetrics) {
      this.toolManager.on('toolRegistered', (event) => {
        this.metrics.toolExecutions.set(event.tool.id, 0);
      });

      this.toolManager.on('toolUnregistered', (event) => {
        this.metrics.toolExecutions.delete(event.tool.id);
      });
    }
  }

  // 服务器管理API
  async createManagedServer(config: McpServerConfig): Promise<string> {
    // 检查并发限制
    const currentServerCount = this.mcpRegistry.getAllServersStatus().size;
    if (currentServerCount >= this.config.maxConcurrentServers!) {
      throw new Error(`Maximum concurrent servers limit reached: ${this.config.maxConcurrentServers}`);
    }

    const server = await this.mcpRegistry.createServer(config);
    
    // 返回服务器ID供后续操作
    return config.id || server.constructor.name;
  }

  async destroyManagedServer(serverId: string): Promise<void> {
    await this.mcpRegistry.destroyServer(serverId);
  }

  // 工具管理API
  async registerToolsToServer(serverId: string, tools: MCPTool[]): Promise<void> {
    // 注册到工具管理器
    await this.toolManager.registerTools(tools);
    
    // 绑定到指定服务器
    await this.mcpRegistry.bindToolsToServer(serverId, tools);
  }

  async registerToolsFromOpenAPI(serverId: string, filePath: string, options?: any): Promise<void> {
    const tools = await this.transformer.transformFromFile(filePath, options);
    await this.registerToolsToServer(serverId, tools);
  }

  async registerToolsFromUrl(serverId: string, url: string, options?: any): Promise<void> {
    const tools = await this.transformer.transformFromUrl(url, options);
    await this.registerToolsToServer(serverId, tools);
  }

  async unregisterToolsFromServer(serverId: string, toolIds: string[]): Promise<void> {
    await this.mcpRegistry.unbindToolsFromServer(serverId, toolIds);
    await this.toolManager.unregisterTools(toolIds);
  }

  // HTTP请求处理器生成
  getServerHandler(serverId: string): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      const server = this.mcpRegistry.getServer(serverId);
      if (!server) {
        res.status(404).json({ error: `Server ${serverId} not found` });
        return;
      }

      try {
        this.metrics.requestCount++;

        // 处理MCP协议请求
        const result = await this.handleMcpRequest(server, req.body);
        res.json(result);

      } catch (error) {
        this.metrics.errorCount++;
        console.error(`❌ MCP request error for server ${serverId}:`, error);
        
        res.status(500).json({
          error: 'Internal server error',
          message: error.message
        });
      }
    };
  }

  private async handleMcpRequest(server: McpServer, requestBody: any): Promise<any> {
    // 这里应该实现完整的MCP协议处理
    // 简化实现，实际需要根据MCP协议规范来处理
    const { method, params } = requestBody;

    switch (method) {
      case 'tools/list':
        return await this.handleToolsList(server);
        
      case 'tools/call':
        return await this.handleToolCall(server, params);
        
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }

  private async handleToolsList(server: McpServer): Promise<any> {
    // 获取服务器绑定的工具列表
    const tools = this.toolManager.getTools();
    
    return {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema || {}
      }))
    };
  }

  private async handleToolCall(server: McpServer, params: any): Promise<any> {
    const { name, arguments: args } = params;
    
    // 查找工具
    const tools = this.toolManager.getTools();
    const tool = tools.find(t => t.name === name);
    
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    try {
      // 执行工具
      const result = await tool.handler(args);
      
      // 更新统计
      if (this.config.enableMetrics) {
        const count = this.metrics.toolExecutions.get(tool.id) || 0;
        this.metrics.toolExecutions.set(tool.id, count + 1);
      }

      return {
        content: [
          {
            type: "text",
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          }
        ]
      };

    } catch (error) {
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }

  // 中间件生成器
  createAuthMiddleware(authValidator: (token: string) => Promise<boolean>): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
        return;
      }

      const token = authHeader.substring(7);
      
      try {
        const isValid = await authValidator(token);
        if (!isValid) {
          res.status(403).json({ error: 'Invalid authentication token' });
          return;
        }
        
        next();
      } catch (error) {
        res.status(500).json({ error: 'Authentication error' });
      }
    };
  }

  createRateLimitMiddleware(maxRequests: number, windowMs: number): RequestHandler {
    const requestCounts = new Map<string, { count: number; resetTime: number }>();

    return async (req: Request, res: Response, next: NextFunction) => {
      const clientId = req.ip || 'unknown';
      const now = Date.now();
      
      const clientData = requestCounts.get(clientId);
      
      if (!clientData || now > clientData.resetTime) {
        requestCounts.set(clientId, {
          count: 1,
          resetTime: now + windowMs
        });
        next();
        return;
      }

      if (clientData.count >= maxRequests) {
        res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
        });
        return;
      }

      clientData.count++;
      next();
    };
  }

  // 健康检查端点
  getHealthCheckHandler(): RequestHandler {
    return async (req: Request, res: Response) => {
      try {
        const healthCheck = await this.mcpRegistry.performHealthCheck();
        const toolStats = this.toolManager.getStats();

        const status = {
          status: healthCheck.healthy ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          servers: healthCheck.servers,
          tools: {
            total: toolStats.totalTools,
            byTag: toolStats.toolsByTag
          },
          metrics: this.config.enableMetrics ? {
            requests: this.metrics.requestCount,
            errors: this.metrics.errorCount,
            errorRate: this.metrics.requestCount > 0 ? 
              this.metrics.errorCount / this.metrics.requestCount : 0
          } : undefined
        };

        res.status(healthCheck.healthy ? 200 : 503).json(status);

      } catch (error) {
        res.status(500).json({
          status: 'error',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  // 指标端点
  getMetricsHandler(): RequestHandler {
    return async (req: Request, res: Response) => {
      if (!this.config.enableMetrics) {
        res.status(404).json({ error: 'Metrics not enabled' });
        return;
      }

      const serverStats = this.mcpRegistry.getStats();
      const toolStats = this.toolManager.getStats();

      const metrics = {
        servers: {
          total: serverStats.totalServers,
          details: serverStats.serverDetails
        },
        tools: {
          total: toolStats.totalTools,
          byTag: toolStats.toolsByTag,
          executions: Object.fromEntries(this.metrics.toolExecutions)
        },
        requests: {
          total: this.metrics.requestCount,
          errors: this.metrics.errorCount,
          errorRate: this.metrics.requestCount > 0 ? 
            this.metrics.errorCount / this.metrics.requestCount : 0
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version
        }
      };

      res.json(metrics);
    };
  }

  // 资源清理
  async dispose(): Promise<void> {
    console.log('🔄 Disposing HTTP Adapter...');

    // 销毁所有服务器
    const servers = this.mcpRegistry.getAllServersStatus();
    for (const [serverId] of servers) {
      await this.mcpRegistry.destroyServer(serverId);
    }

    await this.toolManager.dispose();
    
    console.log('✅ HTTP Adapter disposed');
  }
}
```

## 3. 库适配器实现

```typescript
// src/adapters/LibraryAdapter.ts
import { ToolManager } from '../core/ToolManager';
import { MCPRegistry } from '../core/MCPRegistry';
import { Transformer } from '../core/Transformer';
import { MCPTool, McpServerConfig } from '../types/core';

/**
 * 纯库形式的适配器，用于集成到其他应用中
 */
export class LibraryAdapter {
  private toolManager: ToolManager;
  private mcpRegistry: MCPRegistry;
  private transformer: Transformer;

  constructor() {
    this.toolManager = new ToolManager();
    this.mcpRegistry = new MCPRegistry();
    this.transformer = new Transformer();
  }

  // 工具管理
  async loadToolsFromFile(filePath: string, options?: any): Promise<MCPTool[]> {
    return await this.transformer.transformFromFile(filePath, options);
  }

  async loadToolsFromUrl(url: string, options?: any): Promise<MCPTool[]> {
    return await this.transformer.transformFromUrl(url, options);
  }

  async registerTools(tools: MCPTool[]): Promise<void> {
    await this.toolManager.registerTools(tools);
  }

  async unregisterTools(toolIds: string[]): Promise<void> {
    await this.toolManager.unregisterTools(toolIds);
  }

  getTools(): MCPTool[] {
    return this.toolManager.getTools();
  }

  getTool(toolId: string): MCPTool | undefined {
    return this.toolManager.getTool(toolId);
  }

  getToolsByTag(tag: string): MCPTool[] {
    return this.toolManager.getToolsByTag(tag);
  }

  // 服务器管理
  async createServer(config: McpServerConfig) {
    return await this.mcpRegistry.createServer(config);
  }

  async bindToolsToServer(serverId: string, tools: MCPTool[]): Promise<void> {
    await this.mcpRegistry.bindToolsToServer(serverId, tools);
  }

  // 工具执行
  async executeTool(toolId: string, args: any): Promise<any> {
    const tool = this.toolManager.getTool(toolId);
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`);
    }

    return await tool.handler(args);
  }

  // 事件监听
  onToolRegistered(handler: (tool: MCPTool) => void): void {
    this.toolManager.on('toolRegistered', handler);
  }

  onToolUnregistered(handler: (tool: MCPTool) => void): void {
    this.toolManager.on('toolUnregistered', handler);
  }

  // 统计信息
  getStats() {
    return {
      tools: this.toolManager.getStats(),
      servers: this.mcpRegistry.getStats()
    };
  }

  // 资源清理
  async dispose(): Promise<void> {
    await this.toolManager.dispose();
  }
}
```

## 4. 适配器工厂

```typescript
// src/adapters/AdapterFactory.ts
import { CLIAdapter } from './CLIAdapter';
import { HTTPAdapter } from './HTTPAdapter';
import { LibraryAdapter } from './LibraryAdapter';
import { CLIOptions, HTTPAdapterConfig } from '../types/adapters';

export type AdapterType = 'cli' | 'http' | 'library';

export interface AdapterConfig {
  type: AdapterType;
  options?: CLIOptions | HTTPAdapterConfig;
}

export class AdapterFactory {
  static create(config: AdapterConfig) {
    switch (config.type) {
      case 'cli':
        return new CLIAdapter();
        
      case 'http':
        return new HTTPAdapter(config.options as HTTPAdapterConfig);
        
      case 'library':
        return new LibraryAdapter();
        
      default:
        throw new Error(`Unsupported adapter type: ${config.type}`);
    }
  }

  static createCLI(options?: CLIOptions): CLIAdapter {
    return new CLIAdapter();
  }

  static createHTTP(config?: HTTPAdapterConfig): HTTPAdapter {
    return new HTTPAdapter(config);
  }

  static createLibrary(): LibraryAdapter {
    return new LibraryAdapter();
  }
}
```

## 5. 适配器使用示例

### NestJS集成示例

```typescript
// examples/nestjs-integration.ts
import { Injectable, Module, Controller, Post, Get, Body, Param } from '@nestjs/common';
import { HTTPAdapter } from '../src/adapters/HTTPAdapter';

@Injectable()
export class McpService {
  private httpAdapter = new HTTPAdapter({
    enableMetrics: true,
    enableHealthCheck: true
  });

  async onModuleInit() {
    // 创建默认服务器
    await this.httpAdapter.createManagedServer({
      name: 'nestjs-mcp-server',
      version: '1.0.0'
    });
  }

  async registerOpenAPITools(serverId: string, filePath: string) {
    await this.httpAdapter.registerToolsFromOpenAPI(serverId, filePath);
  }

  getServerHandler(serverId: string) {
    return this.httpAdapter.getServerHandler(serverId);
  }

  getHealthCheck() {
    return this.httpAdapter.getHealthCheckHandler();
  }

  getMetrics() {
    return this.httpAdapter.getMetricsHandler();
  }
}

@Controller('mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Post(':serverId/tools/register')
  async registerTools(
    @Param('serverId') serverId: string,
    @Body() body: { filePath: string }
  ) {
    await this.mcpService.registerOpenAPITools(serverId, body.filePath);
    return { success: true };
  }

  @Get('health')
  async healthCheck() {
    const handler = this.mcpService.getHealthCheck();
    // 需要适配Express处理器到NestJS
    // 实际使用中需要实现适配层
  }
}

@Module({
  providers: [McpService],
  controllers: [McpController],
  exports: [McpService]
})
export class McpModule {}
```

这个适配器层实现提供了：

1. **CLI适配器**：完整的命令行服务器功能，向下兼容
2. **HTTP适配器**：Web框架集成，支持认证、限流、监控
3. **库适配器**：纯库形式，最大灵活性
4. **工厂模式**：统一的创建接口
5. **生产级特性**：错误处理、监控、资源管理、优雅关闭

这样的设计确保了既能保持现有功能，又能灵活适配到各种使用场景。
