import { EventEmitter } from 'events';
import { SessionConfig, type InterfaceSelectionConfig } from '../types/index';
import { configManager } from './config-manager';
import chalk from 'chalk';
import { createMcpServer } from '../../server';
import { startStdioMcpServer, startSseMcpServer, startStreamableMcpServer } from '../../transportUtils';
import { AuthConfig, EndpointExtractor, type OpenAPISpec, type OperationFilter as ParserOperationFilter } from 'mcp-swagger-parser';
import { SelectionConverter } from '../components/selection-converter';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import { isUrl } from '../../utils/common';
import type { Server as HttpServer } from 'http';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface ServerStats {
  uptime: number;
  requests: number;
  errors: number;
  startTime: Date;
  lastRequest?: Date;
  lastError?: Date;
}

export interface ServerStatus {
  isRunning: boolean;
  isStopping?: boolean;
  config?: SessionConfig;
  stats?: ServerStats;
  serverPromise?: Promise<void>;
  httpServer?: HttpServer;
  mcpServer?: McpServer;
  close?: () => Promise<void>;
}

export class ServerManager extends EventEmitter {
  private runningServers: Map<string, ServerStatus> = new Map();
  private logBuffer: Map<string, string[]> = new Map();
  private maxLogLines: number = 1000;
  private debugMode: boolean = false;
  private chalk = chalk;

  constructor() {
    super();
    this.setupProcessHandlers();
    this.initDebugMode();
  }

  /**
   * 初始化调试模式
   */
  private async initDebugMode(): Promise<void> {
    this.debugMode = await configManager.get('debugMode') || false;
  }

  /**
   * 启动服务器
   */
  async startServer(config: SessionConfig): Promise<{ success: boolean; error?: string; serverId?: string }> {
    const serverId = this.generateServerId(config);
    
    // 检查是否已经在运行
    if (this.isServerRunning(serverId)) {
      return {
        success: false,
        error: '服务器已在运行中'
      };
    }

    try {
      await this.initDebugMode();
      const { serverPromise, close, httpServer, mcpServer } = await this.startServerProcess(config);
      const stats: ServerStats = {
        uptime: 0,
        requests: 0,
        errors: 0,
        startTime: new Date()
      };

      const serverStatus: ServerStatus = {
        isRunning: true,
        isStopping: false,
        config,
        stats,
        serverPromise,
        close,
        httpServer,
        mcpServer
      };

      this.runningServers.set(serverId, serverStatus);
      this.logBuffer.set(serverId, []);
      this.setupServerMonitoring(serverId, serverPromise);
      this.startStatsTracking(serverId);

      this.emit('serverStarted', { serverId, config });
      
      return {
        success: true,
        serverId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '启动服务器失败'
      };
    }
  }

  /**
   * 停止服务器
   */
  async stopServer(serverId: string): Promise<{ success: boolean; error?: string }> {
    const serverStatus = this.runningServers.get(serverId);
    
    if (!serverStatus || !serverStatus.isRunning) {
      return {
        success: false,
        error: '服务器未在运行'
      };
    }

    try {
      serverStatus.isStopping = true;
      // 等待服务器停止
      const stopPromise = serverStatus.close ? serverStatus.close() : Promise.resolve();
      try {
        await Promise.race([
          stopPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('服务器停止超时')), 5000)
          )
        ]);
      } catch (error) {
        console.warn('服务器停止时出现错误:', error instanceof Error ? error.message : error);
      }

      serverStatus.isRunning = false;
      this.runningServers.delete(serverId);
      this.logBuffer.delete(serverId);

      this.emit('serverStopped', { serverId, config: serverStatus.config });
      
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '停止服务器失败'
      };
    }
  }

  /**
   * 重启服务器
   */
  async restartServer(serverId: string): Promise<{ success: boolean; error?: string; newServerId?: string }> {
    const serverStatus = this.runningServers.get(serverId);
    
    if (!serverStatus || !serverStatus.config) {
      return {
        success: false,
        error: '服务器配置不存在'
      };
    }

    const config = serverStatus.config;
    
    // 停止现有服务器
    const stopResult = await this.stopServer(serverId);
    if (!stopResult.success) {
      return stopResult;
    }

    // 等待一小段时间确保端口释放
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 启动新服务器
    const startResult = await this.startServer(config);
    
    return {
      success: startResult.success,
      error: startResult.error,
      newServerId: startResult.serverId
    };
  }

  /**
   * 获取服务器状态
   */
  getServerStatus(serverId: string): ServerStatus | undefined {
    return this.runningServers.get(serverId);
  }

  /**
   * 获取所有运行中的服务器
   */
  getRunningServers(): Map<string, ServerStatus> {
    return new Map(this.runningServers);
  }

  /**
   * 检查服务器是否在运行
   */
  isServerRunning(serverId: string): boolean {
    const status = this.runningServers.get(serverId);
    return status?.isRunning || false;
  }

  /**
   * 获取服务器日志
   */
  getServerLogs(serverId: string, lines?: number): string[] {
    const logs = this.logBuffer.get(serverId) || [];
    return lines ? logs.slice(-lines) : logs;
  }

  /**
   * 清空服务器日志
   */
  clearServerLogs(serverId: string): void {
    this.logBuffer.set(serverId, []);
  }

  /**
   * 停止所有服务器
   */
  async stopAllServers(): Promise<void> {
    const stopPromises = Array.from(this.runningServers.keys()).map(serverId => 
      this.stopServer(serverId)
    );
    
    await Promise.all(stopPromises);
  }

  /**
   * 生成服务器 ID
   */
  private generateServerId(config: SessionConfig): string {
    return config.id;
  }

  /**
   * 启动服务器进程
   */
  private async startServerProcess(config: SessionConfig): Promise<{
    serverPromise: Promise<void>;
    close: () => Promise<void>;
    httpServer?: HttpServer;
    mcpServer: McpServer;
  }> {
    // 加载OpenAPI数据
    const openApiData = config.openApiUrl ? await this.loadOpenApiData(config.openApiUrl) : null;

    // 构建认证配置
    const authConfig = this.buildAuthConfig(config);

    // 处理自定义请求头（兼容旧结构）
    const customHeaders = this.normalizeCustomHeaders(config.customHeaders);

    // 构建操作过滤器 - 优先使用接口选择配置中的过滤器
    const operationFilter = this.buildOperationFilter(config.interfaceSelection, config.operationFilter, openApiData);
    const sourceOrigin = (!config.baseUrl && config.openApiUrl && isUrl(config.openApiUrl))
      ? new URL(config.openApiUrl).origin
      : undefined;

    // 调试输出：显示传递给服务器的operationFilter
    console.log(`\n[DEBUG] 服务器启动配置:`);
    console.log(`- 配置名称: ${config.name}`);
    console.log(`- 传输协议: ${config.transport}`);
    console.log(`- 是否有接口选择配置: ${config.interfaceSelection ? 'Yes' : 'No'}`);
    if (operationFilter) {
      console.log(`- operationFilter详情:`, JSON.stringify(operationFilter, null, 2));
    } else {
      console.log(`- 未设置operationFilter，将转换所有接口`);
    }

    const mcpServer = await createMcpServer(
      {
        openApiData,
        authConfig,
        customHeaders,
        debugHeaders: this.debugMode,
        operationFilter,
        baseUrl: config.baseUrl,
        sourceOrigin
      },
      { registerSignalHandlers: false }
    );

    let httpServer: HttpServer | undefined;
    let resolveLifecycle: () => void = () => {};
    let rejectLifecycle: (error: Error) => void = () => {};
    const serverPromise = new Promise<void>((resolve, reject) => {
      resolveLifecycle = resolve;
      rejectLifecycle = reject;
    });

    const close = async () => {
      if (httpServer) {
        await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
      }
      await mcpServer.close();
      resolveLifecycle();
    };

    // 启动对应的服务器
    switch (config.transport.toLowerCase()) {
      case 'stdio':
        throw new Error(
          '交互式会话模式不支持 STDIO 服务器，请使用 --openapi 直接启动模式。'
        );
      case 'sse':
        httpServer = await startSseMcpServer(
          mcpServer,
          '/sse',
          config.port || 3322,
          {
            host: config.host || 'localhost'
          }
        );
        break;
      case 'streamable':
        httpServer = await startStreamableMcpServer(
          mcpServer,
          '/mcp',
          config.port || 3322,
          {
            host: config.host || 'localhost'
          }
        );
        break;
      default:
        throw new Error(`不支持的传输协议: ${config.transport}`);
    }

    if (httpServer) {
      httpServer.once('close', () => resolveLifecycle());
      httpServer.once('error', (error: Error) => rejectLifecycle(error));
    }

    return { serverPromise, close, httpServer, mcpServer };
  }

  /**
   * 构建认证配置（仅支持 none/bearer）
   */
  private buildAuthConfig(config: SessionConfig): AuthConfig {
    const authType = config.auth?.type || 'none';
    if (authType === 'bearer' && config.auth?.token) {
      return {
        type: 'bearer',
        bearer: {
          source: 'static',
          token: config.auth.token
        }
      };
    }
    if (authType !== 'none') {
      console.warn(`未支持的认证类型: ${authType}，将按无认证处理`);
    }
    return { type: 'none' };
  }

  /**
   * 兼容旧结构的自定义请求头
   */
  private normalizeCustomHeaders(customHeaders?: any): any | undefined {
    if (!customHeaders) return undefined;
    const hasStructuredFields = typeof customHeaders === 'object' && (
      'static' in customHeaders ||
      'env' in customHeaders ||
      'dynamic' in customHeaders ||
      'conditional' in customHeaders
    );
    if (hasStructuredFields) {
      return customHeaders;
    }
    return { static: customHeaders };
  }

  /**
   * 构建操作过滤器（接口选择优先）
   */
  private buildOperationFilter(
    interfaceSelection?: InterfaceSelectionConfig,
    operationFilter?: ParserOperationFilter,
    openApiData?: any
  ): ParserOperationFilter | undefined {
    const selectionFilter = interfaceSelection
      ? this.buildFilterFromInterfaceSelection(interfaceSelection, openApiData)
      : undefined;
    const normalizedFallback =
      operationFilter && Object.keys(operationFilter).length > 0 ? operationFilter : undefined;
    return selectionFilter || normalizedFallback;
  }

  /**
   * 从接口选择配置构建过滤器
   */
  private buildFilterFromInterfaceSelection(
    selection: InterfaceSelectionConfig,
    openApiData?: any
  ): ParserOperationFilter | undefined {
    if (!openApiData || !openApiData.paths) {
      console.warn('接口选择配置存在，但未能加载 OpenAPI 数据，忽略接口选择过滤');
      return undefined;
    }

    try {
      const endpoints = EndpointExtractor.extractEndpoints(openApiData as OpenAPISpec);
      const converter = new SelectionConverter();

      switch (selection.mode) {
        case 'include':
          if (selection.selectedEndpoints && selection.selectedEndpoints.length > 0) {
            return converter.convertIncludeSelection(selection.selectedEndpoints, endpoints);
          }
          break;
        case 'exclude':
          if (selection.selectedEndpoints && selection.selectedEndpoints.length > 0) {
            return converter.convertExcludeSelection(selection.selectedEndpoints, endpoints);
          }
          break;
        case 'tags':
          if (selection.selectedTags && selection.selectedTags.length > 0) {
            return converter.convertTagsSelection(selection.selectedTags);
          }
          break;
        case 'patterns':
          if (selection.pathPatterns && selection.pathPatterns.length > 0) {
            return converter.convertPatternsSelection(selection.pathPatterns);
          }
          break;
      }
    } catch (error) {
      console.warn('构建接口选择过滤器失败，将回退到默认过滤器:', error);
    }

    return undefined;
  }

  /**
   * 加载 OpenAPI 数据（支持 JSON/YAML 与 URL/本地文件）
   */
  private async loadOpenApiData(source: string): Promise<any> {
    try {
      if (isUrl(source)) {
        const response = await axios.get(source, { timeout: 10000 });
        const data = response.data;
        if (typeof data === 'string') {
          return this.parseOpenApiContent(data, source);
        }
        return data;
      }

      const filePath = path.resolve(source);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return this.parseOpenApiContent(fileContent, source);
    } catch (error) {
      throw new Error(`加载OpenAPI数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private parseOpenApiContent(content: string, source: string): any {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error(`OpenAPI 内容为空: ${source}`);
    }

    // 优先尝试 JSON
    try {
      return JSON.parse(trimmed);
    } catch {
      // 回退到 YAML
      return yaml.load(trimmed);
    }
  }



  /**
   * 设置服务器监控
   */
  private setupServerMonitoring(serverId: string, serverPromise: Promise<void>): void {
    const serverStatus = this.runningServers.get(serverId);
    if (!serverStatus) return;

    // 监控服务器Promise状态
    serverPromise
      .then(() => {
        const message = `服务器 ${serverId} 正常结束`;
        this.addLog(serverId, `[SYS] ${message}`);
        
        if (serverStatus) {
          serverStatus.isRunning = false;
        }
        if (serverStatus && !serverStatus.isStopping) {
          this.runningServers.delete(serverId);
          this.logBuffer.delete(serverId);
          this.emit('serverStopped', { serverId, config: serverStatus.config });
        }
      })
      .catch((error: Error) => {
        if (serverStatus?.isStopping) {
          return;
        }
        const errorMessage = `服务器 ${serverId} 错误: ${error.message}`;
        this.addLog(serverId, `[ERR] ${this.chalk.red(errorMessage)}`);
        
        if (serverStatus) {
          serverStatus.isRunning = false;
          if (serverStatus.stats) {
            serverStatus.stats.errors++;
            serverStatus.stats.lastError = new Date();
          }
        }
        this.runningServers.delete(serverId);
        this.logBuffer.delete(serverId);
        this.emit('serverError', { serverId, config: serverStatus.config, error });
      });

    // 手动停止通过 stopServer/close 处理
  }

  /**
   * 开始统计跟踪
   */
  private startStatsTracking(serverId: string): void {
    const interval = setInterval(() => {
      const serverStatus = this.runningServers.get(serverId);
      
      if (!serverStatus || !serverStatus.isRunning || !serverStatus.stats) {
        clearInterval(interval);
        return;
      }

      // 更新运行时间
      const now = new Date();
      serverStatus.stats.uptime = Math.floor((now.getTime() - serverStatus.stats.startTime.getTime()) / 1000);
    }, 1000);
  }

  /**
   * 添加日志
   */
  private addLog(serverId: string, message: string): void {
    const logs = this.logBuffer.get(serverId) || [];
    const timestamp = new Date().toISOString();
    logs.push(`[${timestamp}] ${message}`);
    
    // 限制日志行数
    if (logs.length > this.maxLogLines) {
      logs.splice(0, logs.length - this.maxLogLines);
    }
    
    this.logBuffer.set(serverId, logs);
    this.emit('serverLog', { serverId, message });
  }

  /**
   * 设置进程处理器
   */
  private setupProcessHandlers(): void {
    // 优雅关闭
    const gracefulShutdown = async () => {
      console.log(this.chalk.yellow('\n正在关闭所有服务器...'));
      await this.stopAllServers();
      process.exit(0);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
    // 处理未捕获的异常
    process.on('uncaughtException', async (error) => {
      console.error(this.chalk.red('未捕获的异常:'), error);
      gracefulShutdown();
    });

    process.on('unhandledRejection', async (reason) => {
      console.error(this.chalk.red('未处理的 Promise 拒绝:'), reason);
      gracefulShutdown();
    });
  }
}

// 单例实例
export const serverManager = new ServerManager();
