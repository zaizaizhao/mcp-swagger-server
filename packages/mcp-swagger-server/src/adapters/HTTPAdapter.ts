import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createBaseHttpServer, RequestHandlers } from '../tools/httpServer';
import { startSseMcpServer, startStreamableMcpServer } from '../transportUtils';
import type { HTTPAdapterConfig, MetricsData, TransportConfig } from '../types';
import { IncomingMessage, ServerResponse } from 'http';

/**
 * HTTP适配器 - 支持多种HTTP传输方式和中间件
 */
export class HTTPAdapter {
  private servers: Map<string, McpServer> = new Map();
  private config: HTTPAdapterConfig;
  private metrics: MetricsData;
  private startTime: Date;

  constructor(config: HTTPAdapterConfig = {}) {
    this.config = {
      defaultTimeout: 30000,
      maxConcurrentServers: 10,
      enableMetrics: true,
      enableHealthCheck: true,
      ...config,
    };
    
    this.startTime = new Date();
    this.metrics = this.initializeMetrics();
  }

  /**
   * 启动HTTP服务器
   */
  async startServer(
    server: McpServer,
    transport: TransportConfig,
    serverId?: string
  ): Promise<string> {
    const id = serverId || this.generateServerId();
    
    if (this.servers.size >= (this.config.maxConcurrentServers || 10)) {
      throw new Error('Maximum number of concurrent servers reached');
    }

    this.servers.set(id, server);

    try {
      switch (transport.type) {
        case 'sse':
          await startSseMcpServer(
            server,
            transport.options?.endpoint || '/sse',
            transport.options?.port || 3322
          );
          break;
        case 'streamable':
          await startStreamableMcpServer(
            server,
            transport.options?.endpoint || '/mcp',
            transport.options?.port || 3322
          );
          break;
        default:
          throw new Error(`Unsupported transport type: ${transport.type}`);
      }

      console.log(`Server ${id} started with ${transport.type} transport`);
      return id;
    } catch (error) {
      this.servers.delete(id);
      throw error;
    }
  }

  /**
   * 停止服务器
   */
  async stopServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    try {
      await server.close();
      this.servers.delete(serverId);
      console.log(`Server ${serverId} stopped`);
    } catch (error) {
      console.error(`Error stopping server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * 停止所有服务器
   */
  async stopAllServers(): Promise<void> {
    const stopPromises = Array.from(this.servers.keys()).map(id => 
      this.stopServer(id).catch(error => 
        console.error(`Error stopping server ${id}:`, error)
      )
    );
    
    await Promise.all(stopPromises);
  }

  /**
   * 获取服务器列表
   */
  getServers(): string[] {
    return Array.from(this.servers.keys());
  }

  /**
   * 获取指定服务器
   */
  getServer(serverId: string): McpServer | undefined {
    return this.servers.get(serverId);
  }

  /**
   * 创建健康检查端点
   */
  createHealthCheckHandler(): RequestHandlers["handleRequest"] {
    return async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method === 'GET' && req.url === '/health') {
        const health = {
          status: 'healthy',
          uptime: Date.now() - this.startTime.getTime(),
          activeServers: this.servers.size,
          maxServers: this.config.maxConcurrentServers,
          metrics: this.config.enableMetrics ? this.getMetrics() : undefined,
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(health, null, 2));
      } else {
        res.writeHead(404).end('Not found');
      }
    };
  }

  /**
   * 获取指标数据
   */
  getMetrics(): MetricsData {
    // 更新服务器指标
    this.metrics.serverMetrics = {
      uptime: Date.now() - this.startTime.getTime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };

    return { ...this.metrics };
  }

  /**
   * 记录请求指标
   */
  recordRequest(toolName?: string, responseTime?: number, error?: boolean): void {
    if (!this.config.enableMetrics) return;

    this.metrics.requestCount++;
    if (error) {
      this.metrics.errorCount++;
    }

    if (responseTime) {
      const currentAvg = this.metrics.averageResponseTime;
      const count = this.metrics.requestCount;
      this.metrics.averageResponseTime = 
        (currentAvg * (count - 1) + responseTime) / count;
    }

    if (toolName) {
      const toolMetrics = this.metrics.toolExecutions.get(toolName) || {
        count: 0,
        totalTime: 0,
        errorCount: 0,
        lastExecuted: new Date(),
      };

      toolMetrics.count++;
      toolMetrics.lastExecuted = new Date();
      if (responseTime) {
        toolMetrics.totalTime += responseTime;
      }
      if (error) {
        toolMetrics.errorCount++;
      }

      this.metrics.toolExecutions.set(toolName, toolMetrics);
    }
  }

  /**
   * 重置指标
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }

  /**
   * 初始化指标数据
   */
  private initializeMetrics(): MetricsData {
    return {
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      toolExecutions: new Map(),
      serverMetrics: {
        uptime: 0,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
    };
  }

  /**
   * 生成服务器ID
   */
  private generateServerId(): string {
    return `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
