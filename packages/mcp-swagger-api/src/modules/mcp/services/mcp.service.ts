import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
// 通过 workspace 包导入 mcp-swagger-server 的功能
import { 
  createMcpServer, 
  runStreamableServer, 
  runSseServer,
  transformOpenApiToMcpTools,
  startStreamableMcpServer,
  startSseMcpServer
} from 'mcp-swagger-server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Server } from 'http';

export interface MCPServerConfig {
  name?: string;
  version?: string;
  description?: string;
  port?: number;
  transport?: 'streamable' | 'sse' | 'stdio';
}

export interface MCPServerStatus {
  isRunning: boolean;
  toolsCount: number;
  endpoint?: string;
  tools: Array<{
    name: string;
    description: string;
    inputSchema?: any;
  }>;
  config: MCPServerConfig;
}

export interface CreateServerResult {
  success: boolean;
  endpoint?: string;
  tools?: any[];
  toolsCount?: number;
  error?: string;
}

/**
 * MCP 服务管理器 - 直接复用 mcp-swagger-server 的核心能力
 * 
 * 这个服务不是通过子进程方式，而是直接在同一进程中使用 mcp-swagger-server 的核心功能
 * 这样可以获得更好的性能和更简单的架构
 */
@Injectable()
export class MCPService implements OnModuleDestroy {
  private readonly logger = new Logger(MCPService.name);
  private currentServer: McpServer | null = null;
  private httpServer: Server | null = null;  // 添加 HTTP 服务器实例管理
  private currentTools: any[] = [];
  private currentOpenApiData: any = null;
  private isServerRunning = false;
  private serverEndpoint: string | undefined;
  private serverConfig: MCPServerConfig = {
    name: 'mcp-swagger-api-server',
    version: '1.0.0',
    description: 'MCP server from API integration',
    port: 3322,
    transport: 'streamable'
  };

  constructor(private eventEmitter: EventEmitter2) {}

  /**
   * 从 OpenAPI 数据创建并启动 MCP 服务器
   * 直接使用 mcp-swagger-server 的 createMcpServer 和 transformOpenApiToMcpTools
   */
  async createFromOpenAPI(
    openApiData: string | object,
    config?: Partial<MCPServerConfig>
  ): Promise<CreateServerResult> {
    try {
      this.logger.log('Creating MCP server from OpenAPI specification using mcp-swagger-server core...');
      
      // 停止现有服务器
      if (this.isServerRunning) {
        await this.stopServer();
      }

      // 更新配置
      this.serverConfig = { ...this.serverConfig, ...config };
      
      // 预先验证 OpenAPI 数据以提供更好的错误信息
      this.logger.log('Validating OpenAPI specification...');
      const tools = await transformOpenApiToMcpTools(undefined, undefined, openApiData);
      
      if (tools.length === 0) {
        throw new Error('No valid tools found in OpenAPI specification');
      }

      this.currentTools = tools;
      this.logger.log(`Generated ${tools.length} tools from OpenAPI spec using mcp-swagger-server`);

      // 存储 openApiData 供启动服务器时使用
      this.currentOpenApiData = openApiData;
      
      // 创建服务器实例，使用我们验证的 openApiData
      this.currentServer = await createMcpServer(openApiData);
      
      // 启动服务器
      this.serverEndpoint = await this.startServer();
      this.isServerRunning = true;
      
      // 发出事件
      this.eventEmitter.emit('mcp.server.created', {
        toolsCount: tools.length,
        endpoint: this.serverEndpoint,
        transport: this.serverConfig.transport
      });

      return {
        success: true,
        endpoint: this.serverEndpoint,
        tools: this.currentTools,
        toolsCount: tools.length
      };

    } catch (error) {
      this.logger.error('Failed to create MCP server:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 启动服务器 - 使用 mcp-swagger-server 的启动函数
   */
  private async startServer(): Promise<string> {
    if (!this.currentServer) {
      throw new Error('No MCP server instance available');
    }

    const { port, transport } = this.serverConfig;

    try {
      this.logger.log(`Starting MCP server with transport: ${transport}, port: ${port}`);
      
      switch (transport) {
        case 'streamable':
          // 使用 startStreamableMcpServer 直接启动现有服务器实例并保存 HTTP 服务器引用
          this.logger.log('Starting streamable server using mcp-swagger-server...');
          this.httpServer = await startStreamableMcpServer(this.currentServer!, '/mcp', port);
          return `http://localhost:${port}/mcp`;
          
        case 'sse':
          // 使用 startSseMcpServer 直接启动现有服务器实例
          this.logger.log('Starting SSE server using mcp-swagger-server...');
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

  /**
   * 停止服务器
   */
  async stopServer(): Promise<void> {
    if (this.currentServer && this.isServerRunning) {
      try {
        this.logger.log('Stopping MCP server...');
        
        // 首先关闭 HTTP 服务器，添加超时机制
        if (this.httpServer) {
          this.logger.log('Closing HTTP server...');
          const closeHttpServer = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              this.logger.warn('HTTP server close timeout, forcing close...');
              resolve(); // 即使超时也继续，不阻塞流程
            }, 3000); // 3秒超时
            
            this.httpServer!.close((err) => {
              clearTimeout(timeout);
              if (err) {
                this.logger.error('Error closing HTTP server:', err);
                resolve(); // 即使出错也继续，不阻塞流程
              } else {
                this.logger.log('HTTP server closed successfully');
                resolve();
              }
            });
          });
          
          await closeHttpServer;
          this.httpServer = null;
        }
        
        // 然后关闭 MCP 服务器，也添加超时机制
        this.logger.log('Closing MCP server...');
        const closeMcpServer = Promise.race([
          this.currentServer.close(),
          new Promise<void>((resolve) => {
            setTimeout(() => {
              this.logger.warn('MCP server close timeout, forcing close...');
              resolve();
            }, 2000); // 2秒超时
          })
        ]);
        
        await closeMcpServer;
        
        this.currentServer = null;
        this.isServerRunning = false;
        this.serverEndpoint = undefined;
        this.currentTools = [];
        
        this.logger.log('MCP server stopped successfully');
        this.eventEmitter.emit('mcp.server.stopped');
      } catch (error) {
        this.logger.error('Error stopping MCP server:', error);
        // 即使出错，也要重置状态，避免卡死
        this.currentServer = null;
        this.httpServer = null;
        this.isServerRunning = false;
        this.serverEndpoint = undefined;
        this.currentTools = [];
        throw error;
      }
    }
  }

  /**
   * 重新加载工具
   */
  async reloadTools(openApiData: string | object): Promise<boolean> {
    try {
      this.logger.log('Reloading MCP tools using mcp-swagger-server transformer...');
      
      // 重新生成工具 - 使用 mcp-swagger-server 的核心函数
      const tools = await transformOpenApiToMcpTools(undefined, undefined, openApiData);
      
      if (tools.length === 0) {
        this.logger.warn('No tools found in new OpenAPI specification');
        return false;
      }

      // 如果服务器正在运行，重启它
      if (this.isServerRunning) {
        await this.stopServer();
        const result = await this.createFromOpenAPI(openApiData, this.serverConfig);
        return result.success;
      } else {
        // 只更新工具列表
        this.currentTools = tools;
        this.eventEmitter.emit('mcp.tools.reloaded', { toolsCount: tools.length });
        return true;
      }
    } catch (error) {
      this.logger.error('Failed to reload tools:', error);
      return false;
    }
  }

  /**
   * 获取服务器状态
   */
  getServerStatus(): MCPServerStatus {
    return {
      isRunning: this.isServerRunning,
      toolsCount: this.currentTools.length,
      endpoint: this.serverEndpoint,
      tools: this.currentTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      })),
      config: this.serverConfig
    };
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    toolsCount: number;
    lastCheck: Date;
    serverRunning: boolean;
    endpoint?: string;
  }> {
    const lastCheck = new Date();
    
    return {
      healthy: this.isServerRunning && this.currentServer !== null,
      serverRunning: this.isServerRunning,
      toolsCount: this.currentTools.length,
      endpoint: this.serverEndpoint,
      lastCheck
    };
  }

  /**
   * 获取工具详情
   */
  getTools(): Array<{
    name: string;
    description: string;
    inputSchema?: any;
    metadata?: any;
  }> {
    return this.currentTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      metadata: tool.metadata
    }));
  }

  /**
   * 模块销毁时清理
   */
  async onModuleDestroy() {
    await this.stopServer();
  }
}
