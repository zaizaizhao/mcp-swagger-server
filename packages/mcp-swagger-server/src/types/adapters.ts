// 适配器相关类型定义
export interface CLIOptions {
  transport: 'stdio' | 'sse' | 'streamable';
  port: number;
  endpoint: string;
  swaggerFile?: string;
  baseUrl?: string;
  managed?: boolean;
  autoRestart?: boolean;
  maxRetries?: number;
  verbose?: boolean;
  help?: boolean;
}

export interface AdapterConfig {
  onError?: (error: Error, options?: CLIOptions) => Promise<void>;
  onRestart?: (attempt: number) => Promise<void>;
  beforeStart?: (options: CLIOptions) => Promise<void>;
  afterStart?: (options: CLIOptions) => Promise<void>;
}



export interface TransportConfig {
  type: 'stdio' | 'sse' | 'streamable';
  options?: {
    port?: number;
    endpoint?: string;
    cors?: boolean;
    maxConnections?: number;
    keepAliveTimeout?: number;
  };
}

export interface AuthConfig {
  type: 'jwt' | 'apikey' | 'custom';
  options?: {
    secret?: string;
    issuer?: string;
    audience?: string;
    keyHeader?: string;
    customValidator?: (token: string) => Promise<boolean>;
  };
}

export interface MetricsData {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  toolExecutions: Map<string, {
    count: number;
    totalTime: number;
    errorCount: number;
    lastExecuted: Date;
  }>;
  serverMetrics: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

// Programmatic adapter 相关类型
export interface ProgrammaticConfig {
  enableValidation?: boolean;
  enableMetrics?: boolean;
  enableCaching?: boolean;
  maxCacheSize?: number;
  defaultTimeout?: number;
  retryAttempts?: number;
  rateLimiting?: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
}

export interface SwaggerSpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, any>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
  security?: Array<Record<string, any>>;
}

export interface ToolManagerOptions {
  enableValidation?: boolean;
  enableMetrics?: boolean;
  enableCaching?: boolean;
  maxCacheSize?: number;
  defaultTimeout?: number;
  enableEvents?: boolean;
}

export interface RegistryOptions {
  enableValidation?: boolean;
  enableHealthCheck?: boolean;
  healthCheckInterval?: number;
  maxServers?: number;
  enableMetrics?: boolean;
}

// Express相关类型
export interface RequestHandler {
  (req: any, res: any, next: any): Promise<void>;
}

export interface MiddlewareOptions {
  skipRoutes?: string[];
  customHeaders?: Record<string, string>;
  enableLogging?: boolean;
}
