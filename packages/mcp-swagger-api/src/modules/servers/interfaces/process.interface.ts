// 进程配置接口
export interface ProcessConfig {
  id: string; // 改名为id以保持一致性
  name: string; // 改名为name以保持一致性
  scriptPath: string; // CLI可执行文件路径
  args: string[]; // CLI参数数组
  env?: Record<string, string>;
  cwd?: string;
  timeout?: number;
  processTimeout?: number;
  maxRetries?: number;
  maxRestartAttempts?: number;
  restartDelay?: number;
  restartPolicy?: RestartPolicy;
  healthCheck?: {
    enabled: boolean;
    interval: number;
    timeout: number;
    retries: number;
    endpoint?: string; // HTTP传输协议的健康检查端点
  };
  memoryLimit?: number;
  cpuLimit?: number;
  logFilePath?: string; // 日志文件路径
  // 新增：MCP特定配置
  mcpConfig?: {
    transport: 'stdio' | 'sse' | 'streamable';
    port?: number;
    endpoint?: string;
    openApiSource?: string;
    authConfig?: {
      type: 'none' | 'bearer';
      bearerToken?: string;
      bearerEnv?: string;
    };
    customHeaders?: Record<string, string>;
    watch?: boolean;
    managed?: boolean;
    autoRestart?: boolean;
    maxRetries?: number;
    retryDelay?: number;
  };
}

// 进程信息接口
export interface ProcessInfo {
  id: string; // 改名为id以保持一致性
  name: string; // 进程名称
  pid: number;
  startTime: Date;
  status: ProcessStatus;
  restartCount: number;
  lastError?: string;
  memoryUsage?: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
  updatedAt: Date;
  config?: ProcessConfig;
  process?: any; // 子进程实例
  exitCode?: number;
  exitSignal?: string;
}

// 进程状态枚举
export enum ProcessStatus {
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error'
}

// 健康检查结果接口
export interface HealthCheckResult {
  healthy: boolean;
  responseTime?: number;
  error?: string;
  status?: number;
  data?: any;
  lastCheck?: Date;
  memoryUsage?: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
}

// 重启策略类型枚举
export enum RestartPolicyType {
  ALWAYS = 'always',
  ON_FAILURE = 'on_failure',
  NEVER = 'never'
}

// 重启策略接口
export interface RestartPolicy {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  maxRetryDelay: number;
}

// 进程日志接口
export interface ProcessLog {
  id: string;
  processId: string; // 改名为processId
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

// 日志级别枚举
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

// 服务器启动结果接口（更新）
export interface ServerStartResult {
  success: boolean;
  endpoint?: string;
  processInfo?: ProcessInfo;
  status: string;
  error?: string;
  data?: {
    mcpServer?: any;
    httpServer?: any;
    endpoint?: string;
  };
}

// 进程事件接口
export interface ProcessEvent {
  processId: string; // 改名为processId
  eventType: 'started' | 'stopped' | 'error' | 'health_check' | 'info_updated' | 'logs_updated';
  timestamp: Date;
  data?: any;
}

// 错误类型定义
export enum ProcessErrorType {
  STARTUP_FAILED = 'startup_failed',
  RESTART_FAILED = 'restart_failed',
  PROCESS_CRASHED = 'process_crashed',
  PROCESS_EXIT = 'process_exit',
  HEALTH_CHECK_FAILED = 'health_check_failed',
  RESOURCE_LIMIT_EXCEEDED = 'resource_limit_exceeded',
  MAX_RESTARTS_REACHED = 'max_restarts_reached',
  COMMUNICATION_ERROR = 'communication_error',
  PROCESS_ERROR = 'process_error'
}

// 错误事件接口
export interface ProcessErrorEvent {
  processId: string; // 改名为processId
  errorType: ProcessErrorType;
  error: Error;
  timestamp: Date;
  context?: Record<string, any>;
}

// 监控指标接口
export interface ProcessMetrics {
  processId: string; // 改名为processId
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  requestCount: number;
  errorCount: number;
  lastHealthCheck: Date;
  averageResponseTime: number;
}

// 进程管理配置
export interface ProcessManagerConfig {
  // 进程超时设置
  processTimeout: number; // 默认 30000ms
  
  // 重启策略
  defaultMaxRetries: number; // 默认 3
  maxRestartAttempts: number; // 默认 3
  defaultRestartDelay: number; // 默认 2000ms
  restartDelay: number; // 重启延迟
  defaultBackoffMultiplier: number; // 默认 1.5
  defaultMaxRetryDelay: number; // 默认 30000ms
  
  // 健康检查设置
  healthCheckInterval: number; // 默认 30000ms
  healthCheckTimeout: number; // 默认 5000ms
  
  // 资源限制
  memoryLimit: number; // 默认 512MB
  cpuLimit: number; // 默认 80%
  
  // 文件路径
  pidDirectory: string; // 默认 './pids'
  logDirectory: string; // 默认 './logs'
  
  // 日志设置
  logLevel: LogLevel; // 默认 'info'
  logToFile: boolean; // 默认 true
  logRotation: boolean; // 默认 true
  maxLogFiles: number; // 默认 10
  maxLogSize: string; // 默认 '10MB'
}

// 默认配置
export const DEFAULT_PROCESS_CONFIG: ProcessManagerConfig = {
  processTimeout: 30000,
  defaultMaxRetries: 3,
  maxRestartAttempts: 3,
  defaultRestartDelay: 2000,
  restartDelay: 2000,
  defaultBackoffMultiplier: 1.5,
  defaultMaxRetryDelay: 30000,
  healthCheckInterval: 30000,
  healthCheckTimeout: 5000,
  memoryLimit: 512,
  cpuLimit: 80,
  pidDirectory: './pids',
  logDirectory: './logs',
  logLevel: LogLevel.INFO,
  logToFile: true,
  logRotation: true,
  maxLogFiles: 10,
  maxLogSize: '10MB'
}