import { OpenAPIV3 } from 'openapi-types';
import type { CustomHeaders } from 'mcp-swagger-parser';

/**
 * 传输协议类型
 */
export type TransportType = 'stdio' | 'sse' | 'streamable';

/**
 * 认证配置
 */
export interface AuthConfig {
  type: 'bearer' | 'basic' | 'apikey' | 'none';
  token?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  headerName?: string;
}

/**
 * 操作过滤器 - 用于过滤 OpenAPI 操作
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
  tags?: {
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
  customFilter?: (operation: OpenAPIV3.OperationObject, method: string, path: string) => boolean;
}

/**
 * 接口选择模式
 */
export type InterfaceSelectionMode = 'include' | 'exclude' | 'tags' | 'patterns';

/**
 * 接口选择配置
 */
export interface InterfaceSelectionConfig {
  mode: InterfaceSelectionMode;
  selectedEndpoints?: string[];
  selectedTags?: string[];
  pathPatterns?: string[];
}

/**
 * 会话配置
 */
export interface SessionConfig {
  id: string;
  name: string;
  description?: string;
  openApiUrl: string;
  baseUrl?: string;
  transport: TransportType;
  port?: number;
  host?: string;
  auth?: AuthConfig;
  customHeaders?: CustomHeaders | Record<string, string>;
  operationFilter?: OperationFilter;
  interfaceSelection?: InterfaceSelectionConfig;
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
  theme: 'default' | 'dark-red-cyber' | 'compact' | 'fancy';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  serverTimeout: number;
  recentConfigs: string[];
  maxRecentConfigs: number;
  showWelcome?: boolean;
  autoSave?: boolean;
  debugMode?: boolean;
  confirmOnExit?: boolean;
  watchFiles?: boolean;
  hotReload?: boolean;
  maxRetries?: number;
  retryDelay?: number;
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
  themeStyle?: 'default' | 'accent' | 'success' | 'error' | 'warning';
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
 * 向导步骤状态
 */
export interface WizardStepState {
  completed: boolean;
  data?: unknown;
  error?: string;
}

/**
 * 向导状态
 */
export interface WizardState {
  currentStep: number;
  totalSteps: number;
  stepStates: Record<string, WizardStepState>;
  canGoBack: boolean;
  canGoForward: boolean;
}

/**
 * 向导数据 - 向导过程中收集的配置数据
 */
export interface WizardData {
  name?: string;
  description?: string;
  openApiUrl?: string;
  baseUrl?: string;
  transport?: TransportType;
  port?: number;
  host?: string;
  auth?: AuthConfig;
  customHeaders?: CustomHeaders | Record<string, string>;
  operationFilter?: OperationFilter;
  interfaceSelection?: InterfaceSelectionConfig;
}

/**
 * 向导上下文
 */
export interface WizardContext {
  sessionConfig: Partial<SessionConfig>;
  wizardState: WizardState;
  data: WizardData;
  currentStep?: number;
  steps?: WizardStep[];
  isEditing?: boolean;
  originalConfig?: SessionConfig;
}

/**
 * 服务器事件
 */
export interface ServerEvent {
  type: 'start' | 'stop' | 'error' | 'crash' | 'restart';
  serverId: string;
  timestamp: Date;
  data?: unknown;
  error?: Error;
}

/**
 * 配置变更事件
 */
export interface ConfigChangeEvent {
  key: string;
  oldValue: unknown;
  newValue: unknown;
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
  data?: unknown;
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
  transport?: TransportType;
  verbose?: boolean;
  quiet?: boolean;
  debug?: boolean;
  help?: boolean;
  
  // OpenAPI 相关选项
  openapi?: string;
  'base-url'?: string;
  watch?: boolean;
  endpoint?: string;
  
  // 认证选项
  'auth-type'?: string;
  'bearer-token'?: string;
  'bearer-env'?: string;
  
  // 自定义请求头选项
  'custom-header'?: string[];
  'custom-headers-config'?: string;
  'custom-header-env'?: string[];
  'debug-headers'?: boolean;
  
  // 操作过滤选项
  'operation-filter-methods'?: string[];
  'operation-filter-paths'?: string[];
  'operation-filter-operation-ids'?: string[];
  'operation-filter-status-codes'?: string[];
  'operation-filter-parameters'?: string[];
  
  // 高级选项
  'auto-restart'?: boolean;
  'max-retries'?: string;
  'retry-delay'?: string;
  'allowed-host'?: string[];
  'allowed-origin'?: string[];
  'disable-dns-rebinding-protection'?: boolean;
  env?: string;
}

/**
 * 服务器统计信息
 */
export interface ServerStats {
  uptime: number;
  requests: number;
  errors: number;
  startTime: Date;
  lastRequest?: Date;
  lastError?: Date;
}

/**
 * 表格列配置
 */
export interface TableColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  formatter?: (value: unknown) => string;
}

/**
 * 进度选项
 */
export interface ProgressOptions {
  text: string;
  color?: 'cyan' | 'green' | 'yellow' | 'red' | 'blue' | 'magenta';
}
