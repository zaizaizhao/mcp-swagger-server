import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  // Generic configuration getter
  get<T = any>(key: string, defaultValue?: T): T {
    return this.configService.get<T>(key, defaultValue);
  }

  // 应用配置
  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  get port(): number {
    return this.configService.get<number>('PORT', 3001);
  }

  get mcpPort(): number {
    return this.configService.get<number>('MCP_PORT', 3322);
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  // CORS配置
  get corsOrigins(): string[] {
    return this.configService.get<string>('CORS_ORIGINS', 'http://localhost:5173').split(',');
  }

  // 安全配置
  get jwtSecret(): string | undefined {
    return this.configService.get<string>('JWT_SECRET');
  }

  // 日志配置
  get logLevel(): string {
    return this.configService.get<string>('LOG_LEVEL', 'info');
  }

  get logFormat(): string {
    return this.configService.get<string>('LOG_FORMAT', 'pretty');
  }

  // 性能配置
  get requestTimeout(): number {
    return this.configService.get<number>('REQUEST_TIMEOUT', 30000);
  }

  get cacheTtl(): number {
    return this.configService.get<number>('CACHE_TTL', 300);
  }

  get maxPayloadSize(): string {
    return this.configService.get<string>('MAX_PAYLOAD_SIZE', '10mb');
  }

  // MCP Server配置
  get mcpServerHost(): string {
    return this.configService.get<string>('MCP_SERVER_HOST', 'localhost');
  }

  get mcpServerPort(): number {
    return this.configService.get<number>('MCP_SERVER_PORT', 3322);
  }

  get mcpServerUrl(): string {
    return `http://${this.mcpServerHost}:${this.mcpServerPort}`;
  }

  get mcpServerHealthCheckInterval(): number {
    return this.configService.get<number>('MCP_SERVER_HEALTH_CHECK_INTERVAL', 30000);
  }

  // OpenAPI配置
  get defaultOpenAPIBaseUrl(): string | undefined {
    return this.configService.get<string>('DEFAULT_OPENAPI_BASE_URL');
  }

  get maxOpenAPIFileSize(): string {
    return this.configService.get<string>('MAX_OPENAPI_FILE_SIZE', '5mb');
  }

  get openAPIcacheTtl(): number {
    return this.configService.get<number>('OPENAPI_CACHE_TTL', 600);
  }

  // 监控配置
  get metricsEnabled(): boolean {
    return this.configService.get<boolean>('METRICS_ENABLED', true);
  }

  get healthCheckEnabled(): boolean {
    return this.configService.get<boolean>('HEALTH_CHECK_ENABLED', true);
  }

  get healthCheckTimeout(): number {
    return this.configService.get<number>('HEALTH_CHECK_TIMEOUT', 5000);
  }

  // 开发配置
  get hotReload(): boolean {
    return this.configService.get<boolean>('HOT_RELOAD', false);
  }

  get watchFiles(): boolean {
    return this.configService.get<boolean>('WATCH_FILES', false);
  }

  get debugMode(): boolean {
    return this.configService.get<boolean>('DEBUG_MODE', false);
  }

  // 获取完整配置对象（用于调试）
  getAllConfig(): Record<string, any> {
    return {
      app: {
        nodeEnv: this.nodeEnv,
        port: this.port,
        mcpPort: this.mcpPort,
      },
      cors: {
        origins: this.corsOrigins,
      },
      security: {
        // JWT认证配置
        jwtEnabled: !!this.jwtSecret,
      },
      logging: {
        level: this.logLevel,
        format: this.logFormat,
      },
      performance: {
        requestTimeout: this.requestTimeout,
        cacheTtl: this.cacheTtl,
        maxPayloadSize: this.maxPayloadSize,
      },
      mcp: {
        serverUrl: this.mcpServerUrl,
        healthCheckInterval: this.mcpServerHealthCheckInterval,
      },
      openapi: {
        defaultBaseUrl: this.defaultOpenAPIBaseUrl,
        maxFileSize: this.maxOpenAPIFileSize,
        cacheTtl: this.openAPIcacheTtl,
      },
      monitoring: {
        metricsEnabled: this.metricsEnabled,
        healthCheckEnabled: this.healthCheckEnabled,
        healthCheckTimeout: this.healthCheckTimeout,
      },
      development: {
        hotReload: this.hotReload,
        watchFiles: this.watchFiles,
        debugMode: this.debugMode,
      },
    };
  }
}
