// 核心类型定义
import { AuthConfig } from 'mcp-swagger-parser';

export interface MCPTool {
  id: string;
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any) => Promise<any>;
  metadata?: {
    tags?: string[];
    deprecated?: boolean;
    version?: string;
    author?: string;
    httpMethod?: string;
    endpoint?: string;
  };
}

export interface McpServerConfig {
  id?: string;
  name: string;
  version: string;
  description?: string;
  capabilities?: {
    tools?: any;
    resources?: any;
    prompts?: any;
  };
  /**
   * 认证配置
   */
  auth?: AuthConfig;
}

export interface TransformOptions {
  baseUrl?: string;
  includeDeprecated?: boolean;
  requestTimeout?: number;
  pathPrefix?: string;
  tagFilter?: string[];
  operationIdPrefix?: string;
  enableAuth?: boolean;
  authHeaders?: Record<string, string>;
  /**
   * 认证配置
   */
  authConfig?: AuthConfig;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  path?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  path?: string;
}

export interface ServerStatus {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  uptime: number;
  toolCount: number;
  lastError?: string;
  createdAt: Date;
  memoryUsage?: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
}

export interface ToolManagerEvent {
  type: 'toolRegistered' | 'toolUnregistered' | 'toolExecuted' | 'toolError';
  tool: MCPTool;
  timestamp: Date;
  metadata?: {
    executionTime?: number;
    success?: boolean;
    error?: string;
    args?: any;
    result?: any;
  };
}

export interface ToolManagerStats {
  totalTools: number;
  tagCount: number;
  toolsByTag: Record<string, number>;
  executionStats?: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
  };
}

// 接口定义
export interface IToolManager {
  registerTool(tool: MCPTool): Promise<void>;
  registerTools(tools: MCPTool[]): Promise<void>;
  unregisterTool(toolId: string): Promise<void>;
  unregisterTools(toolIds: string[]): Promise<void>;
  getTool(toolId: string): MCPTool | undefined;
  getTools(): MCPTool[];
  getToolsByTag(tag: string): MCPTool[];
  validateTool(tool: MCPTool): ValidationResult;
  getStats(): ToolManagerStats;
  dispose(): Promise<void>;
}

export interface IMCPRegistry {
  createServer(config: McpServerConfig): Promise<string>;
  getServer(serverId: string): any | undefined;
  destroyServer(serverId: string): Promise<void>;
  bindToolsToServer(serverId: string, tools: MCPTool[]): Promise<void>;
  unbindToolsFromServer(serverId: string, toolIds: string[]): Promise<void>;
  getServerStatus(serverId: string): ServerStatus | undefined;
  getAllServersStatus(): Map<string, ServerStatus>;
  performHealthCheck(): Promise<{
    healthy: boolean;
    servers: Array<{
      id: string;
      name: string;
      healthy: boolean;
      error?: string;
    }>;
  }>;
}

export interface ITransformer {
  transformFromFile(filePath?: string, options?: TransformOptions): Promise<MCPTool[]>;
  transformFromUrl(url: string, options?: TransformOptions): Promise<MCPTool[]>;
  validateTools(tools: MCPTool[]): ValidationResult;
  normalizeTools(tools: MCPTool[]): MCPTool[];
  analyzeTools(tools: MCPTool[]): {
    totalTools: number;
    deprecatedCount: number;
    tagDistribution: Record<string, number>;
    uniqueTags: number;
  };
}
