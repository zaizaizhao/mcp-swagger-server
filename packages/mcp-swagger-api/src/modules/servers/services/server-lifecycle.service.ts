import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as http from 'http';
import * as https from 'https';
import { firstValueFrom } from 'rxjs';

import { MCPServerEntity, TransportType } from '../../../database/entities/mcp-server.entity';
import { ServerInstance } from './server-manager.service';

// 导入MCP相关模块
import { ParserService } from '../../openapi/services/parser.service';
import { ValidatorService } from '../../openapi/services/validator.service';

// 导入mcp-swagger-server包中的transport实现
import { createMcpServer } from 'mcp-swagger-server/dist/server.js';
import { startStreamableMcpServer } from 'mcp-swagger-server/dist/transportUtils/stream.js';
import { startSseMcpServer } from 'mcp-swagger-server/dist/transportUtils/sse.js';
import { startStdioMcpServer } from 'mcp-swagger-server/dist/transportUtils/stdio.js';

export interface ServerStartResult {
  mcpServer: any;
  httpServer?: any;
  endpoint: string;
}

@Injectable()
export class ServerLifecycleService {
  private readonly logger = new Logger(ServerLifecycleService.name);
  private readonly serverTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    // private readonly mcpService: MCPService, // TODO: 实现 MCP 服务
    private readonly parserService: ParserService,
    private readonly validatorService: ValidatorService,
  ) {}

  /**
   * 验证OpenAPI数据
   */
  async validateOpenApiData(openApiData: any): Promise<void> {
    try {
      // 使用验证服务验证OpenAPI规范
      const validationResult = await this.validatorService.validateSpecification(openApiData);
      
      if (!validationResult.valid) {
        throw new Error(`OpenAPI validation failed: ${validationResult.errors.join(', ')}`);
      }

      // 使用解析服务检查是否能正确解析
      await this.parserService.parseSpecification(openApiData);
    } catch (error) {
      this.logger.error('OpenAPI validation failed:', error);
      throw error;
    }
  }

  /**
   * 启动MCP服务器
   */
  async startServer(serverEntity: MCPServerEntity): Promise<ServerStartResult> {
    this.logger.log(`Starting server '${serverEntity.name}' on port ${serverEntity.port}`);

    try {
      // 验证OpenAPI数据
      await this.validateOpenApiData(serverEntity.openApiData);

      // 解析OpenAPI为MCP工具
      const tools = await this.parserService.parseSpecification(serverEntity.openApiData);
      
      // 准备MCP服务器配置
      const mcpConfig = {
        name: serverEntity.name,
        version: serverEntity.version,
        description: serverEntity.description,
        tools,
        transport: serverEntity.transport,
        port: serverEntity.port,
        config: serverEntity.config,
        authConfig: serverEntity.authConfig,
      };

      // 根据传输类型启动不同的服务器
      let mcpServer: any;
      let httpServer: any;
      let endpoint: string;

      switch (serverEntity.transport) {
        case TransportType.STREAMABLE:
          const streamableResult = await this.startStreamableServer(mcpConfig);
          mcpServer = streamableResult.mcpServer;
          httpServer = streamableResult.httpServer;
          endpoint = `http://localhost:${serverEntity.port}`;
          break;

        case TransportType.SSE:
          const sseResult = await this.startSSEServer(mcpConfig);
          mcpServer = sseResult.mcpServer;
          httpServer = sseResult.httpServer;
          endpoint = `http://localhost:${serverEntity.port}`;
          break;

        case TransportType.STDIO:
          mcpServer = await this.startStdioServer(mcpConfig);
          endpoint = `stdio://${serverEntity.name}`;
          break;

        case TransportType.WEBSOCKET:
          const wsResult = await this.startWebSocketServer(mcpConfig);
          mcpServer = wsResult.mcpServer;
          httpServer = wsResult.httpServer;
          endpoint = `ws://localhost:${serverEntity.port}`;
          break;

        default:
          throw new Error(`Unsupported transport type: ${serverEntity.transport}`);
      }

      // 设置服务器超时监控
      this.setupServerTimeout(serverEntity.id, mcpServer, httpServer);

      // 发送启动事件
      this.eventEmitter.emit('server.lifecycle.started', {
        serverId: serverEntity.id,
        serverName: serverEntity.name,
        transport: serverEntity.transport,
        endpoint,
      });

      this.logger.log(`Server '${serverEntity.name}' started successfully at ${endpoint}`);

      return {
        mcpServer,
        httpServer,
        endpoint,
      };
    } catch (error) {
      this.logger.error(`Failed to start server '${serverEntity.name}':`, error);
      
      this.eventEmitter.emit('server.lifecycle.start_failed', {
        serverId: serverEntity.id,
        serverName: serverEntity.name,
        error: error.message,
      });
      
      throw error;
    }
  }

  /**
   * 停止MCP服务器
   */
  async stopServer(instance: ServerInstance): Promise<void> {
    this.logger.log(`Stopping server '${instance.entity.name}'`);

    try {
      // 清除超时监控
      const timeout = this.serverTimeouts.get(instance.id);
      if (timeout) {
        clearTimeout(timeout);
        this.serverTimeouts.delete(instance.id);
      }

      // 停止HTTP服务器（如果存在）
      if (instance.httpServer) {
        await this.stopHttpServer(instance.httpServer);
      }

      // 停止MCP服务器
      if (instance.mcpServer) {
        await this.stopMCPServer(instance.mcpServer);
      }

      // 发送停止事件
      this.eventEmitter.emit('server.lifecycle.stopped', {
        serverId: instance.id,
        serverName: instance.entity.name,
      });

      this.logger.log(`Server '${instance.entity.name}' stopped successfully`);
    } catch (error) {
      this.logger.error(`Failed to stop server '${instance.entity.name}':`, error);
      
      this.eventEmitter.emit('server.lifecycle.stop_failed', {
        serverId: instance.id,
        serverName: instance.entity.name,
        error: error.message,
      });
      
      throw error;
    }
  }

  /**
   * 启动Streamable传输的MCP服务器
   */
  private async startStreamableServer(config: any): Promise<{ mcpServer: any; httpServer: any }> {
    try {
      // 创建MCP服务器实例
      const mcpServer = await createMcpServer({
        openApiData: config.tools,
        authConfig: config.authConfig,
        customHeaders: config.config?.customHeaders || {},
        debugHeaders: config.config?.debugHeaders || false,
      });

      // 启动Streamable传输
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

  /**
   * 启动SSE传输的MCP服务器
   */
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

  /**
   * 启动Stdio传输的MCP服务器
   */
  private async startStdioServer(config: any): Promise<any> {
    try {
      // 创建MCP服务器实例
      const mcpServer = await createMcpServer({
        openApiData: config.tools,
        authConfig: config.authConfig,
        customHeaders: config.config?.customHeaders || {},
        debugHeaders: config.config?.debugHeaders || false,
      });

      // 启动Stdio传输
      await startStdioMcpServer(mcpServer);

      return mcpServer;
    } catch (error) {
      this.logger.error(`Failed to start stdio server: ${error.message}`);
      throw error;
    }
  }

  /**
   * 启动WebSocket传输的MCP服务器
   */
  private async startWebSocketServer(config: any): Promise<{ mcpServer: any; httpServer: any }> {
    // WebSocket传输暂未实现
    throw new Error('WebSocket transport not yet implemented');
  }

  /**
   * 停止HTTP服务器
   */
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

  /**
   * 停止MCP服务器
   */
  private async stopMCPServer(mcpServer: any): Promise<void> {
    try {
      // 如果MCP服务器有close方法，调用它
      if (typeof mcpServer.close === 'function') {
        await mcpServer.close();
      }
      
      // 如果MCP服务器有stop方法，调用它
      if (typeof mcpServer.stop === 'function') {
        await mcpServer.stop();
      }
    } catch (error) {
      this.logger.warn('Error stopping MCP server:', error);
    }
  }

  /**
   * 设置服务器超时监控
   */
  private setupServerTimeout(serverId: string, mcpServer: any, httpServer?: any): void {
    const timeoutMs = this.configService.get<number>('MCP_SERVER_TIMEOUT', 300000); // 5分钟默认超时
    
    if (timeoutMs > 0) {
      const timeout = setTimeout(() => {
        this.logger.warn(`Server ${serverId} timeout, attempting graceful shutdown`);
        
        this.eventEmitter.emit('server.lifecycle.timeout', {
          serverId,
          timeoutMs,
        });
        
        // 尝试优雅关闭
        this.gracefulShutdown(serverId, mcpServer, httpServer);
      }, timeoutMs);
      
      this.serverTimeouts.set(serverId, timeout);
    }
  }

  /**
   * 优雅关闭服务器
   */
  private async gracefulShutdown(serverId: string, mcpServer: any, httpServer?: any): Promise<void> {
    try {
      if (httpServer) {
        await this.stopHttpServer(httpServer);
      }
      
      if (mcpServer) {
        await this.stopMCPServer(mcpServer);
      }
      
      this.serverTimeouts.delete(serverId);
      
      this.eventEmitter.emit('server.lifecycle.graceful_shutdown', {
        serverId,
      });
    } catch (error) {
      this.logger.error(`Failed to gracefully shutdown server ${serverId}:`, error);
      
      this.eventEmitter.emit('server.lifecycle.force_shutdown', {
        serverId,
        error: error.message,
      });
    }
  }

  /**
   * 检查端口是否可用
   */
  async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = http.createServer();
      
      server.listen(port, () => {
        server.close(() => {
          resolve(true);
        });
      });
      
      server.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * 健康检查
   */
  async healthCheck(instance: ServerInstance): Promise<boolean> {
    try {
      if (!instance.mcpServer || !instance.entity.endpoint) {
        return false;
      }

      // 根据传输类型进行不同的健康检查
      switch (instance.entity.transport) {
        case TransportType.STREAMABLE:
        case TransportType.SSE:
          return await this.httpHealthCheck(instance.entity.endpoint);
        
        case TransportType.WEBSOCKET:
          return await this.websocketHealthCheck(instance.entity.endpoint);
        
        case TransportType.STDIO:
          return await this.stdioHealthCheck(instance.mcpServer);
        
        default:
          return false;
      }
    } catch (error) {
      this.logger.error(`Health check failed for server ${instance.entity.name}:`, error);
      return false;
    }
  }

  /**
   * HTTP健康检查
   */
  private async httpHealthCheck(endpoint: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${endpoint}/health`, {
          timeout: 5000,
        })
      );
      
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * WebSocket健康检查
   */
  private async websocketHealthCheck(endpoint: string): Promise<boolean> {
    // TODO: 实现WebSocket健康检查
    return true;
  }

  /**
   * Stdio健康检查
   */
  private async stdioHealthCheck(mcpServer: any): Promise<boolean> {
    // TODO: 实现Stdio健康检查
    return true;
  }
}