import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as http from 'http';
import * as https from 'https';
import { firstValueFrom } from 'rxjs';

import { MCPServerEntity, TransportType } from '../../../database/entities/mcp-server.entity';
import { ServerInstance } from './server-manager.service';
import { ProcessManagerService } from './process-manager.service';
import { ProcessHealthService } from './process-health.service';
import {
  ProcessConfig,
  ProcessStatus,
  RestartPolicy,
  DEFAULT_PROCESS_CONFIG
} from '../interfaces/process.interface';

// 导入MCP相关模块
import { ParserService } from '../../openapi/services/parser.service';
import { ValidatorService } from '../../openapi/services/validator.service';

// 导入mcp-swagger-server包中的transport实现
import { createMcpServer } from 'mcp-swagger-server/dist/server.js';
import { startStreamableMcpServer } from 'mcp-swagger-server/dist/transportUtils/stream.js';
import { startSseMcpServer } from 'mcp-swagger-server/dist/transportUtils/sse.js';

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
    private readonly processManager: ProcessManagerService,
    private readonly processHealth: ProcessHealthService,
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
   * 启动MCP服务器（使用CLI spawn方式实现进程隔离）
   */
  async startServer(serverEntity: MCPServerEntity): Promise<ServerStartResult> {
    this.logger.log(`Starting server '${serverEntity.name}' on port ${serverEntity.port} using CLI spawn`);

    try {
      // 验证OpenAPI数据
      await this.validateOpenApiData(serverEntity.openApiData);

      // 构建CLI参数
      const cliArgs = this.buildCliArgs(serverEntity);
      
      // 准备进程配置
      const processConfig: ProcessConfig = {
        ...DEFAULT_PROCESS_CONFIG,
        id: serverEntity.id,
        name: serverEntity.name,
        scriptPath: 'mcp-swagger-server', // 使用CLI可执行文件
        args: cliArgs,
        env: {
          ...process.env,
          NODE_ENV: this.configService.get('NODE_ENV', 'development'),
        },
        restartPolicy: serverEntity.config?.restartPolicy || {
          maxRetries: DEFAULT_PROCESS_CONFIG.defaultMaxRetries,
          retryDelay: DEFAULT_PROCESS_CONFIG.defaultRestartDelay,
          backoffMultiplier: DEFAULT_PROCESS_CONFIG.defaultBackoffMultiplier,
          maxRetryDelay: DEFAULT_PROCESS_CONFIG.defaultMaxRetryDelay
        },
        maxRestartAttempts: serverEntity.config?.maxRestartAttempts || DEFAULT_PROCESS_CONFIG.maxRestartAttempts,
        healthCheck: {
          enabled: serverEntity.config?.healthCheckEnabled !== false,
          interval: serverEntity.config?.healthCheckInterval || DEFAULT_PROCESS_CONFIG.healthCheckInterval,
          timeout: serverEntity.config?.healthCheckTimeout || 5000,
          retries: 3,
          endpoint: this.getHealthCheckEndpoint(serverEntity),
        },
        processTimeout: serverEntity.config?.processTimeout || DEFAULT_PROCESS_CONFIG.processTimeout,
        memoryLimit: serverEntity.config?.memoryLimit || DEFAULT_PROCESS_CONFIG.memoryLimit,
        cpuLimit: serverEntity.config?.cpuLimit || DEFAULT_PROCESS_CONFIG.cpuLimit,
        // MCP特定配置
        mcpConfig: {
          transport: serverEntity.transport.toLowerCase() as 'sse' | 'streamable',
          port: serverEntity.port,
          endpoint: serverEntity.config?.endpoint || '/mcp',
          openApiSource: 'env', // 从环境变量读取
          authConfig: serverEntity.authConfig ? {
            type: serverEntity.authConfig.type as 'none' | 'bearer',
            bearerToken: serverEntity.authConfig.config?.bearerToken,
            bearerEnv: serverEntity.authConfig.config?.bearerEnv,
          } : { type: 'none' },
          customHeaders: serverEntity.config?.customHeaders || {},
          watch: serverEntity.config?.watch || false,
          managed: true, // 启用托管模式
          autoRestart: serverEntity.config?.autoRestart !== false,
          maxRetries: serverEntity.config?.maxRetries || 3,
          retryDelay: serverEntity.config?.retryDelay || 1000,
        },
      };

      // 启动进程管理器进程
      const processInfo = await this.processManager.startProcess(processConfig);

      // 确定端点URL
      const endpoint = this.getServerEndpoint(serverEntity);

      // 启动健康检查
      if (processConfig.healthCheck?.enabled) {
        await this.processHealth.startHealthCheck(serverEntity.id);
      }

      // 发送启动事件
      this.eventEmitter.emit('server.lifecycle.started', {
        serverId: serverEntity.id,
        serverName: serverEntity.name,
        transport: serverEntity.transport,
        endpoint,
        pid: processInfo.pid,
      });

      this.logger.log(`Server '${serverEntity.name}' started successfully at ${endpoint} (PID: ${processInfo.pid})`);

      return {
        mcpServer: null, // CLI模式下不返回服务器实例
        httpServer: null,
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
   * 构建CLI参数
   */
  private buildCliArgs(serverEntity: MCPServerEntity): string[] {
    const args: string[] = [];

    // 传输协议
    args.push('--transport', serverEntity.transport.toLowerCase());

    // 端口
    args.push('--port', serverEntity.port.toString());

    // 端点路径
    if (serverEntity.config?.endpoint) {
      args.push('--endpoint', serverEntity.config.endpoint);
    }

    // OpenAPI数据源（使用API URL）
    const apiBaseUrl = this.configService.get('API_BASE_URL', 'http://localhost:3001');
    const openApiUrl = `${apiBaseUrl}/api/openapi/by-server/${serverEntity.id}`;
    args.push('--openapi', openApiUrl);

    // 认证配置
    if (serverEntity.authConfig) {
      args.push('--auth-type', serverEntity.authConfig.type);
      if (serverEntity.authConfig.config?.bearerToken) {
        args.push('--bearer-token', serverEntity.authConfig.config.bearerToken);
      }
      if (serverEntity.authConfig.config?.bearerEnv) {
        args.push('--bearer-env', serverEntity.authConfig.config.bearerEnv);
      }
    }

    // 自定义头部
    if (serverEntity.config?.customHeaders) {
      for (const [key, value] of Object.entries(serverEntity.config.customHeaders)) {
        args.push('--header', `${key}:${value}`);
      }
    }

    // 托管模式
    args.push('--managed');

    // 自动重启
    if (serverEntity.config?.autoRestart !== false) {
      args.push('--auto-restart');
    }

    // 监控文件变化
    if (serverEntity.config?.watch) {
      args.push('--watch');
    }

    return args;
  }

  /**
   * 获取健康检查端点
   */
  private getHealthCheckEndpoint(serverEntity: MCPServerEntity): string | undefined {
    return `http://localhost:${serverEntity.port}/health`;
  }

  /**
   * 获取服务器端点URL
   */
  private getServerEndpoint(serverEntity: MCPServerEntity): string {
    switch (serverEntity.transport) {
      case TransportType.STREAMABLE:
      case TransportType.SSE:
        const endpoint = serverEntity.config?.endpoint || '/mcp';
        return `http://localhost:${serverEntity.port}${endpoint}`;
      
      case TransportType.WEBSOCKET:
        return `ws://localhost:${serverEntity.port}`;
      
      default:
        throw new Error(`Unsupported transport type: ${serverEntity.transport}`);
    }
  }

  /**
   * 停止MCP服务器（统一使用进程管理器）
   */
  async stopServer(instance: ServerInstance): Promise<void> {
    const transport = instance.entity.transport;
    this.logger.log(`Stopping server '${instance.entity.name}' (transport: ${transport}) using process manager`);

    try {
      // 停止健康检查
      this.processHealth.stopHealthCheck(instance.id);

      // 统一使用进程管理器停止服务器（适用于所有传输类型）
      this.logger.log(`Stopping process-based server '${instance.entity.name}' via process manager`);
      await this.processManager.stopProcess(instance.id);

      // 清除超时监控
      const timeout = this.serverTimeouts.get(instance.id);
      if (timeout) {
        clearTimeout(timeout);
        this.serverTimeouts.delete(instance.id);
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
   * 手动清理资源（当进程管理器失败时的备用方案）
   */
  private async manualCleanup(instance: ServerInstance): Promise<void> {
    try {
      // 清除超时监控
      const timeout = this.serverTimeouts.get(instance.id);
      if (timeout) {
        clearTimeout(timeout);
        this.serverTimeouts.delete(instance.id);
      }

      // 停止健康检查
      this.processHealth.stopHealthCheck(instance.id);

      this.logger.log(`Manual cleanup completed for server '${instance.entity.name}'`);
    } catch (error) {
      this.logger.error(`Manual cleanup failed for server '${instance.entity.name}':`, error);
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
   * 注意：已禁用超时机制，MCP服务器将持续运行不会自动关闭
   */
  private setupServerTimeout(serverId: string, mcpServer: any, httpServer?: any): void {
    // 超时机制已被禁用，服务器将持续运行
    this.logger.log(`Server ${serverId} timeout monitoring disabled - server will run indefinitely`);
    
    // 原超时逻辑已注释，不再设置任何超时
    /*
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
    */
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
   * 健康检查（CLI spawn模式）
   */
  async healthCheck(instance: ServerInstance): Promise<boolean> {
    try {
      // 使用进程健康检查服务
      const healthResult = await this.processHealth.performHealthCheck(instance.id);
      return healthResult.healthy;
    } catch (error) {
      this.logger.error(`Health check failed for server ${instance.entity.name}:`, error);
      return false;
    }
  }

  /**
   * 获取健康检查历史
   */
  async getHealthCheckHistory(serverId: string, limit = 100) {
    return this.processHealth.getHealthCheckHistory(serverId, limit);
  }

  /**
   * 获取最新健康检查结果
   */
  async getLatestHealthCheck(serverId: string) {
    return this.processHealth.getLatestHealthCheck(serverId);
  }

  /**
   * 获取健康统计
   */
  async getHealthStats(serverId: string, hours = 24) {
    return this.processHealth.getHealthStats(serverId, hours);
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
}