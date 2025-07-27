// ============================================================================
// API 相关类型
// ============================================================================

export interface InputSource {
  type: 'url' | 'file' | 'text'
  content: string
  auth?: {
    type: 'bearer' | 'apikey'
    token: string
  }
}

export interface ConvertConfig {
  name?: string
  version?: string
  description?: string
  port?: number
  transport?: 'streamable' | 'sse' | 'stdio'
  includeDeprecated: boolean
  includeExamples: boolean
  generateTypes: boolean
  outputFormat: 'json' | 'yaml'
}

// ============================================================================
// 基础类型定义
// ============================================================================

export type ServerStatus = 'running' | 'stopped' | 'error' | 'starting' | 'stopping'
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// 服务状态类型
export interface ServiceStatus {
  name: string
  status: 'online' | 'offline' | 'degraded' | 'connecting'
  icon: any
}

// ============================================================================
// API 响应类型
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp?: string
}

// ============================================================================
// 服务器相关类型
// ============================================================================

export interface ServerConfig {
  name: string
  endpoint: string
  openApiSpec?: string | File
  authentication?: AuthConfig
  customHeaders?: Record<string, string>
  description?: string
  tags?: string[]
}

export interface ServerMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  errorRate: number
  activeConnections: number
  uptime: number
  lastRequestTime?: Date
  resourceUsage?: ResourceUsage
}

export interface ResourceUsage {
  cpu: number
  memory: number
  network: {
    bytesIn: number
    bytesOut: number
  }
}

export interface MCPServer {
  id: string
  name: string
  endpoint: string
  status: ServerStatus
  config: ServerConfig
  tools: MCPTool[]
  metrics: ServerMetrics
  lastError?: string
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// OpenAPI 相关类型
// ============================================================================
// API 端点类型
// ============================================================================

export interface ApiEndpoint {
  method: string
  path: string
  summary: string
  description: string
  operationId: string
  tags?: string[]
  deprecated?: boolean
}

export interface ValidationError {
  path: string
  message: string
  severity: 'error' | 'warning' | 'info'
  code: string
}

export interface ValidationResult {
  valid: boolean
  errors?: ValidationError[]
  warnings?: ValidationError[]
}

// ============================================================================
// OpenAPI 规范类型
// ============================================================================

export interface OpenAPISpec {
  id: string
  name: string
  version: string
  description?: string
  content: string
  pathCount: number
  toolCount: number
  createdAt: string
  lastModified: string
  validationStatus: 'valid' | 'invalid' | 'warning'
  validationErrors?: ValidationError[]
}

// ============================================================================
// MCP 工具相关类型
// ============================================================================

export interface MCPTool {
  id: string
  name: string
  description: string
  parameters: ParameterSchema
  serverId: string
  endpoint?: string
  method: string
  path?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
  description?: string
  required: boolean
  default?: any
  enum?: any[]
}

export interface ParameterSchema {
  type: 'object'
  properties?: Record<string, PropertySchema>
  required?: string[]
  additionalProperties?: boolean
}

export interface PropertySchema {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
  description?: string
  format?: string
  enum?: any[]
  default?: any
  items?: PropertySchema
  properties?: Record<string, PropertySchema>
  required?: string[]
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
}

export interface ToolResult {
  success: boolean
  data?: any
  error?: string
  executionTime: number
  timestamp: Date
}

// ============================================================================
// 测试相关类型
// ============================================================================

export interface TestCase {
  id: string
  name: string
  toolId: string
  parameters: Record<string, any>
  expectedResult?: any
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// 用户认证相关类型
// ============================================================================

export interface User {
  id: string
  username: string
  email: string
  status: 'active' | 'pending' | 'locked'
  emailVerified: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
  failedLoginAttempts?: number
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface RegisterData {
  username: string
  email: string
  password: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: User
}

export interface RegisterResponse {
  user: User
  message: string
}

// ============================================================================
// 认证相关类型
// ============================================================================

export interface AuthConfig {
  type: 'bearer' | 'apikey' | 'basic' | 'oauth2'
  credentials: {
    token?: string
    apiKey?: string
    username?: string
    password?: string
    clientId?: string
    clientSecret?: string
  }
  envVars?: string[]
  encrypted: boolean
  expiresAt?: string | Date
  autoRenewal?: boolean
  renewalInterval?: number
}

export interface AuthTestResult {
  success: boolean
  message: string
  details?: any
  timestamp: Date
}

// ============================================================================
// 监控相关类型
// ============================================================================

export interface SystemMetrics {
  totalRequests: number
  averageResponseTime: number
  errorRate: number
  activeConnections: number
  resourceUsage: ResourceUsage
  timestamp: Date
}

export interface LogEntry {
  id: string
  timestamp: Date
  level: LogLevel
  message: string
  serverId?: string
  metadata?: Record<string, any>
  source?: string
}

export interface LogFilter {
  level?: LogLevel[]
  serverId?: string
  searchTerm?: string
  timeRange?: TimeRange
}

export interface TimeRange {
  start: Date
  end: Date
}

// ============================================================================
// 配置管理相关类型
// ============================================================================

export interface ConfigFile {
  version: string
  servers: MCPServer[]
  globalSettings: GlobalSettings
  exportedAt: Date
  encrypted?: boolean
}

export interface ExportOptions {
  includeServers: boolean
  includeSensitiveData: boolean
  encryptSensitiveData: boolean
}

export interface ImportResult {
  success: boolean
  conflicts?: ConfigConflict[]
  migrationRequired?: boolean
  importedServers?: number
  errors?: string[]
}

export interface ConfigConflict {
  type: 'server' | 'setting'
  id: string
  field: string
  currentValue: any
  newValue: any
  existingValue?: any
  resolution?: 'keep' | 'replace' | 'merge'
}

// ============================================================================
// AI 助手相关类型
// ============================================================================

export interface AIAssistantType {
  id: string
  name: string
  configTemplate: string
  supportedFeatures: string[]
  description?: string
}

export interface ConfigTemplate {
  id: string
  name: string
  description: string
  template: string
  variables: ConfigVariable[]
  createdAt: Date
}

export interface ConfigVariable {
  name: string
  type: 'string' | 'number' | 'boolean'
  description: string
  required: boolean
  default?: any
}

export interface ConfigOptions {
  variables: Record<string, any>
  format: 'json' | 'yaml'
}

// ============================================================================
// 全局设置类型
// ============================================================================

export interface GlobalSettings {
  theme: 'light' | 'dark' | 'auto'
  language: 'zh' | 'en'
  autoRefresh: boolean
  refreshInterval: number
  logLevel: LogLevel
  maxLogEntries: number
  enableNotifications: boolean
  enableWebSocket: boolean
  enableSounds: boolean
}

// ============================================================================
// 系统监控相关类型
// ============================================================================

export interface DetailedSystemMetrics {
  timestamp: Date
  cpu: {
    usage: number // 百分比
    cores: number
    temperature?: number
  }
  memory: {
    total: number // bytes
    used: number // bytes
    free: number // bytes
    usage: number // 百分比
  }
  network: {
    bytesIn: number
    bytesOut: number
    packetsIn: number
    packetsOut: number
    connections: number
  }
  disk: {
    total: number // bytes
    used: number // bytes
    free: number // bytes
    usage: number // 百分比
    readOps: number
    writeOps: number
  }
  process: {
    pid: number
    uptime: number // seconds
    memory: number // bytes
    cpu: number // 百分比
  }
}

export interface PerformanceAlert {
  id: string
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'error'
  level: 'info' | 'warning' | 'critical'
  message: string
  value: number
  threshold: number
  timestamp: Date
  acknowledged: boolean
}

export interface MonitoringConfig {
  refreshInterval: number // milliseconds
  alerts: {
    cpu: { warning: number; critical: number }
    memory: { warning: number; critical: number }
    disk: { warning: number; critical: number }
    network: { warning: number; critical: number }
  }
  enableAlerts: boolean
  enableSound: boolean
}

export interface ChartDataPoint {
  timestamp: Date
  value: number
  label?: string
}

export interface ChartSeries {
  name: string
  data: ChartDataPoint[]
  color?: string
}

// ============================================================================
// 系统健康状态类型
// ============================================================================

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'error'
  services: {
    api: 'online' | 'offline' | 'degraded'
    websocket: 'connected' | 'disconnected' | 'reconnecting'
    database: 'online' | 'offline' | 'degraded'
  }
  errorCount: number
  lastCheck: Date
  uptime: number
  version: string
}

// ============================================================================
// 通知相关类型
// ============================================================================

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  duration?: number
  timestamp: Date
  read?: boolean
  actions?: NotificationAction[]
}

export interface NotificationAction {
  label: string
  action: () => void
  type?: 'primary' | 'default'
}

// ============================================================================
// WebSocket 相关类型
// ============================================================================

export interface WebSocketMessage {
  type: string
  data: any
  timestamp: Date
}

export interface WebSocketSubscription {
  type: string
  filter?: any
}

// ============================================================================
// 表单相关类型
// ============================================================================

export interface FormField {
  name: string
  label: string
  type: 'text' | 'number' | 'select' | 'textarea' | 'switch' | 'file'
  required?: boolean
  placeholder?: string
  options?: Array<{ label: string; value: any }>
  validation?: FormValidation
}

export interface FormValidation {
  required?: boolean
  min?: number
  max?: number
  pattern?: RegExp
  custom?: (value: any) => string | null
}

// ============================================================================
// 路由相关类型
// ============================================================================

export interface RouteInfo {
  path: string
  name: string
  title: string
  icon?: string
  children?: RouteInfo[]
}