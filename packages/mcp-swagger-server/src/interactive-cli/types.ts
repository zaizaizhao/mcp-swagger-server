/**
 * 传输协议类型
 */
export type TransportType = 'stdio' | 'sse' | 'ws';

/**
 * 认证配置
 */
export interface AuthConfig {
  type: 'bearer' | 'basic' | 'apikey';
  token?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  headerName?: string;
}

/**
 * 操作过滤器配置
 */
export interface OperationFilter {
  methods?: {
    include?: string[];
    exclude?: string[];
  };
  paths?: {
    include?: string[];
    exclude?: string[];
  };
  operationIds?: {
    include?: string[];
    exclude?: string[];
  };
  statusCodes?: {
    include?: number[];
    exclude?: number[];
  };
  parameters?: {
    required?: string[];
    forbidden?: string[];
  };
  customFilter?: (operation: any, method: string, path: string) => boolean;
}

/**
 * 会话配置
 */
export interface SessionConfig {
  id: string;
  name: string;
  description?: string;
  openApiUrl: string;
  transport: TransportType;
  port?: number;
  host?: string;
  auth?: AuthConfig;
  customHeaders?: Record<string, string>;
  operationFilter?: OperationFilter;
  createdAt: string;
  lastUsed: string;
}

/**
 * 服务器状态
 */
export interface ServerStatus {
  isRunning: boolean;
  serverId?: string;
  config?: SessionConfig;
  startTime?: Date;
  uptime?: number;
  port?: number;
  host?: string;
  transport?: TransportType;
  logs?: string[];
}

/**
 * 会话统计信息
 */
export interface SessionStats {
  total: number;
  byTransport: Record<string, number>;
  recentlyUsed: number;
}

/**
 * 全局配置
 */
export interface GlobalConfig {
  defaultTransport: TransportType;
  defaultPort: number;
  defaultHost: string;
  theme: 'default' | 'dark' | 'light';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  serverTimeout: number;
  recentConfigs: string[];
  maxRecentConfigs: number;
}

/**
 * UI 消息类型
 */
export type MessageType = 'success' | 'error' | 'warning' | 'info' | 'debug';

/**
 * 进度指示器选项
 */
export interface SpinnerOptions {
  text: string;
  color?: 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white';
}

/**
 * 消息框选项
 */
export interface BoxOptions {
  title?: string;
  borderColor?: 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white';
  padding?: number;
  margin?: number;
  content?: string;
}

/**
 * 表格数据
 */
export interface TableData {
  headers: string[];
  rows: string[][];
}

/**
 * 统计信息显示数据
 */
export interface StatsData {
  totalSessions: number;
  transportStats: Record<string, number>;
  recentSessions: number;
  serverStatus: 'running' | 'stopped';
  uptime: number;
}

/**
 * OpenAPI 文档验证结果
 */
export interface OpenAPIValidationResult {
  valid: boolean;
  title?: string;
  version?: string;
  description?: string;
  operationCount?: number;
  errors?: string[];
  warnings?: string[];
}

/**
 * 预设 OpenAPI URL
 */
export interface PresetOpenAPIUrl {
  name: string;
  url: string;
  description?: string;
  category?: string;
}

/**
 * 向导步骤
 */
export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  required: boolean;
  completed: boolean;
}

/**
 * 向导上下文
 */
export interface WizardContext {
  currentStep: number;
  steps: WizardStep[];
  data: Partial<SessionConfig>;
  isEditing: boolean;
  originalConfig?: SessionConfig;
}

/**
 * 服务器事件
 */
export interface ServerEvent {
  type: 'start' | 'stop' | 'error' | 'crash' | 'restart';
  serverId: string;
  timestamp: Date;
  data?: any;
  error?: Error;
}

/**
 * 配置变更事件
 */
export interface ConfigChangeEvent {
  key: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}

/**
 * 日志条目
 */
export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  serverId?: string;
  data?: any;
}

/**
 * 文件监听选项
 */
export interface WatchOptions {
  ignored?: string | RegExp | (string | RegExp)[];
  persistent?: boolean;
  ignoreInitial?: boolean;
  followSymlinks?: boolean;
  cwd?: string;
  disableGlobbing?: boolean;
}

/**
 * 导入/导出选项
 */
export interface ImportExportOptions {
  format: 'json' | 'yaml';
  includeSecrets?: boolean;
  compress?: boolean;
}

/**
 * CLI 命令选项
 */
export interface CLIOptions {
  config?: string;
  port?: number;
  host?: string;
  transport?: 'stdio' | 'sse' | 'ws';
  verbose?: boolean;
  quiet?: boolean;
  debug?: boolean;
}