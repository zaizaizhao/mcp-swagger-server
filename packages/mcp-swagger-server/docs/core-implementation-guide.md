# MCP Swagger Server 核心实现方案

## 核心模块详细实现

### 1. 类型定义

```typescript
// src/types/core.ts
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
}

export interface TransformOptions {
  baseUrl?: string;
  includeDeprecated?: boolean;
  requestTimeout?: number;
  pathPrefix?: string;
  tagFilter?: string[];
  operationIdPrefix?: string;
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
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

export interface ServerStatus {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  uptime: number;
  toolCount: number;
  lastError?: string;
  createdAt: Date;
}

export interface ToolManagerEvent {
  type: 'toolRegistered' | 'toolUnregistered' | 'toolError';
  tool: MCPTool;
  timestamp: Date;
  metadata?: any;
}
```

```typescript
// src/types/adapters.ts
export interface CLIOptions {
  transport: 'stdio' | 'sse' | 'streamable';
  port?: number;
  endpoint?: string;
  swaggerFile?: string;
  baseUrl?: string;
  managed?: boolean;
  autoRestart?: boolean;
  maxRetries?: number;
}

export interface HTTPAdapterConfig {
  defaultTimeout?: number;
  maxConcurrentServers?: number;
  enableMetrics?: boolean;
  enableHealthCheck?: boolean;
}

export interface TransportConfig {
  type: 'stdio' | 'sse' | 'streamable';
  options?: {
    port?: number;
    endpoint?: string;
    cors?: boolean;
    maxConnections?: number;
  };
}
```

### 2. 核心工具管理器

```typescript
// src/core/ToolManager.ts
import EventEmitter from 'events';
import { MCPTool, ValidationResult, ToolManagerEvent } from '../types/core';

export interface IToolManager {
  registerTool(tool: MCPTool): Promise<void>;
  registerTools(tools: MCPTool[]): Promise<void>;
  unregisterTool(toolId: string): Promise<void>;
  unregisterTools(toolIds: string[]): Promise<void>;
  getTool(toolId: string): MCPTool | undefined;
  getTools(): MCPTool[];
  getToolsByTag(tag: string): MCPTool[];
  validateTool(tool: MCPTool): ValidationResult;
  dispose(): Promise<void>;
}

export class ToolManager extends EventEmitter implements IToolManager {
  private tools = new Map<string, MCPTool>();
  private toolsByTag = new Map<string, Set<string>>();
  private disposed = false;

  async registerTool(tool: MCPTool): Promise<void> {
    if (this.disposed) {
      throw new Error('ToolManager has been disposed');
    }

    // 验证工具
    const validation = this.validateTool(tool);
    if (!validation.valid) {
      const error = new Error(`Invalid tool: ${validation.errors.map(e => e.message).join(', ')}`);
      this.emit('toolError', { type: 'toolError', tool, timestamp: new Date(), metadata: { validation } });
      throw error;
    }

    // 检查重复ID
    if (this.tools.has(tool.id)) {
      console.warn(`⚠️ Tool ${tool.id} already exists, replacing...`);
      await this.unregisterTool(tool.id);
    }

    // 注册工具
    this.tools.set(tool.id, tool);

    // 更新标签索引
    const tags = tool.metadata?.tags || ['uncategorized'];
    for (const tag of tags) {
      if (!this.toolsByTag.has(tag)) {
        this.toolsByTag.set(tag, new Set());
      }
      this.toolsByTag.get(tag)!.add(tool.id);
    }

    // 触发事件
    const event: ToolManagerEvent = {
      type: 'toolRegistered',
      tool,
      timestamp: new Date()
    };
    this.emit('toolRegistered', event);

    console.log(`✅ Tool registered: ${tool.id} (${tool.name})`);
  }

  async registerTools(tools: MCPTool[]): Promise<void> {
    const results = await Promise.allSettled(
      tools.map(tool => this.registerTool(tool))
    );

    const errors = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map(result => result.reason);

    if (errors.length > 0) {
      console.warn(`⚠️ ${errors.length} tools failed to register`);
      errors.forEach(error => console.warn(`  - ${error.message}`));
    }

    const successCount = results.filter(result => result.status === 'fulfilled').length;
    console.log(`📦 Successfully registered ${successCount}/${tools.length} tools`);
  }

  async unregisterTool(toolId: string): Promise<void> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      console.warn(`⚠️ Tool ${toolId} not found for unregistration`);
      return;
    }

    // 从主索引移除
    this.tools.delete(toolId);

    // 从标签索引移除
    const tags = tool.metadata?.tags || ['uncategorized'];
    for (const tag of tags) {
      const tagSet = this.toolsByTag.get(tag);
      if (tagSet) {
        tagSet.delete(toolId);
        if (tagSet.size === 0) {
          this.toolsByTag.delete(tag);
        }
      }
    }

    // 触发事件
    const event: ToolManagerEvent = {
      type: 'toolUnregistered',
      tool,
      timestamp: new Date()
    };
    this.emit('toolUnregistered', event);

    console.log(`🗑️ Tool unregistered: ${toolId}`);
  }

  async unregisterTools(toolIds: string[]): Promise<void> {
    await Promise.all(toolIds.map(id => this.unregisterTool(id)));
  }

  getTool(toolId: string): MCPTool | undefined {
    return this.tools.get(toolId);
  }

  getTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  getToolsByTag(tag: string): MCPTool[] {
    const toolIds = this.toolsByTag.get(tag);
    if (!toolIds) return [];

    return Array.from(toolIds)
      .map(id => this.tools.get(id))
      .filter((tool): tool is MCPTool => tool !== undefined);
  }

  validateTool(tool: MCPTool): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 必需字段验证
    if (!tool.id || typeof tool.id !== 'string') {
      errors.push({
        field: 'id',
        message: 'Tool ID is required and must be a string',
        code: 'INVALID_ID'
      });
    }

    if (!tool.name || typeof tool.name !== 'string') {
      errors.push({
        field: 'name',
        message: 'Tool name is required and must be a string',
        code: 'INVALID_NAME'
      });
    }

    if (!tool.description || typeof tool.description !== 'string') {
      errors.push({
        field: 'description',
        message: 'Tool description is required and must be a string',
        code: 'INVALID_DESCRIPTION'
      });
    }

    if (!tool.handler || typeof tool.handler !== 'function') {
      errors.push({
        field: 'handler',
        message: 'Tool handler is required and must be a function',
        code: 'INVALID_HANDLER'
      });
    }

    // 格式验证
    if (tool.id && !/^[a-zA-Z0-9_-]+$/.test(tool.id)) {
      warnings.push({
        field: 'id',
        message: 'Tool ID should only contain alphanumeric characters, underscores, and hyphens',
        code: 'ID_FORMAT'
      });
    }

    // 废弃工具警告
    if (tool.metadata?.deprecated) {
      warnings.push({
        field: 'metadata.deprecated',
        message: 'Tool is marked as deprecated',
        code: 'DEPRECATED'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;

    this.disposed = true;
    this.tools.clear();
    this.toolsByTag.clear();
    this.removeAllListeners();

    console.log('🔄 ToolManager disposed');
  }

  // 统计信息
  getStats() {
    return {
      totalTools: this.tools.size,
      tagCount: this.toolsByTag.size,
      toolsByTag: Object.fromEntries(
        Array.from(this.toolsByTag.entries()).map(([tag, toolIds]) => [tag, toolIds.size])
      )
    };
  }
}
```

### 3. MCP注册中心

```typescript
// src/core/MCPRegistry.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { v4 as uuidv4 } from 'uuid';
import { McpServerConfig, ServerStatus, MCPTool } from '../types/core';

export interface IMCPRegistry {
  createServer(config: McpServerConfig): Promise<McpServer>;
  getServer(serverId: string): McpServer | undefined;
  destroyServer(serverId: string): Promise<void>;
  bindToolsToServer(serverId: string, tools: MCPTool[]): Promise<void>;
  unbindToolsFromServer(serverId: string, toolIds: string[]): Promise<void>;
  getServerStatus(serverId: string): ServerStatus | undefined;
  getAllServersStatus(): Map<string, ServerStatus>;
}

export class MCPRegistry implements IMCPRegistry {
  private servers = new Map<string, McpServer>();
  private serverConfigs = new Map<string, McpServerConfig>();
  private serverStats = new Map<string, {
    createdAt: Date;
    lastError?: string;
    toolBindings: Set<string>;
  }>();

  async createServer(config: McpServerConfig): Promise<McpServer> {
    const serverId = config.id || uuidv4();
    
    if (this.servers.has(serverId)) {
      throw new Error(`Server with ID ${serverId} already exists`);
    }

    const server = new McpServer(
      {
        name: config.name,
        version: config.version,
        description: config.description || `MCP Server: ${config.name}`,
      },
      {
        capabilities: config.capabilities || {
          tools: {},
        },
      }
    );

    // 添加服务器管理
    this.servers.set(serverId, server);
    this.serverConfigs.set(serverId, { ...config, id: serverId });
    this.serverStats.set(serverId, {
      createdAt: new Date(),
      toolBindings: new Set()
    });

    // 添加错误处理
    server.onerror = (error) => {
      console.error(`❌ Server ${serverId} error:`, error);
      const stats = this.serverStats.get(serverId);
      if (stats) {
        stats.lastError = error.message;
      }
    };

    // 添加关闭处理
    const originalClose = server.close.bind(server);
    server.close = async () => {
      await this.destroyServer(serverId);
      return originalClose();
    };

    console.log(`🚀 MCP Server created: ${serverId} (${config.name})`);
    return server;
  }

  getServer(serverId: string): McpServer | undefined {
    return this.servers.get(serverId);
  }

  async destroyServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      console.warn(`⚠️ Server ${serverId} not found for destruction`);
      return;
    }

    try {
      // 清理资源
      await server.close();
    } catch (error) {
      console.error(`❌ Error closing server ${serverId}:`, error);
    }

    // 从注册表移除
    this.servers.delete(serverId);
    this.serverConfigs.delete(serverId);
    this.serverStats.delete(serverId);

    console.log(`🗑️ Server destroyed: ${serverId}`);
  }

  async bindToolsToServer(serverId: string, tools: MCPTool[]): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    const stats = this.serverStats.get(serverId);
    if (!stats) {
      throw new Error(`Server stats for ${serverId} not found`);
    }

    // 批量注册工具到MCP服务器
    for (const tool of tools) {
      try {
        // 将工具注册到MCP服务器
        server.setRequestHandler(
          {
            method: "tools/call",
            schema: {
              type: "object",
              properties: {
                name: { type: "string", const: tool.name },
                arguments: tool.inputSchema || {}
              },
              required: ["name"]
            }
          },
          async (request) => {
            if (request.params.name === tool.name) {
              try {
                const result = await tool.handler(request.params.arguments);
                return {
                  content: [
                    {
                      type: "text",
                      text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                    }
                  ]
                };
              } catch (error) {
                throw new Error(`Tool execution failed: ${error.message}`);
              }
            }
            throw new Error(`Tool ${request.params.name} not found`);
          }
        );

        // 注册工具列表处理器
        server.setRequestHandler(
          { method: "tools/list" },
          async () => {
            return {
              tools: tools.map(t => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema || {}
              }))
            };
          }
        );

        stats.toolBindings.add(tool.id);
        console.log(`🔗 Tool bound to server ${serverId}: ${tool.id}`);

      } catch (error) {
        console.error(`❌ Failed to bind tool ${tool.id} to server ${serverId}:`, error);
        throw error;
      }
    }

    console.log(`📦 ${tools.length} tools bound to server ${serverId}`);
  }

  async unbindToolsFromServer(serverId: string, toolIds: string[]): Promise<void> {
    const stats = this.serverStats.get(serverId);
    if (!stats) {
      throw new Error(`Server stats for ${serverId} not found`);
    }

    // 从绑定记录中移除
    for (const toolId of toolIds) {
      stats.toolBindings.delete(toolId);
    }

    // 注意：实际的MCP SDK可能不支持动态移除工具
    // 这里我们只是从我们的跟踪记录中移除
    console.log(`🔄 ${toolIds.length} tools unbound from server ${serverId}`);
  }

  getServerStatus(serverId: string): ServerStatus | undefined {
    const server = this.servers.get(serverId);
    const config = this.serverConfigs.get(serverId);
    const stats = this.serverStats.get(serverId);

    if (!server || !config || !stats) {
      return undefined;
    }

    return {
      id: serverId,
      name: config.name,
      status: server ? 'running' : 'stopped',
      uptime: Date.now() - stats.createdAt.getTime(),
      toolCount: stats.toolBindings.size,
      lastError: stats.lastError,
      createdAt: stats.createdAt
    };
  }

  getAllServersStatus(): Map<string, ServerStatus> {
    const statusMap = new Map<string, ServerStatus>();

    for (const serverId of this.servers.keys()) {
      const status = this.getServerStatus(serverId);
      if (status) {
        statusMap.set(serverId, status);
      }
    }

    return statusMap;
  }

  // 健康检查
  async performHealthCheck(): Promise<{
    healthy: boolean;
    servers: Array<{
      id: string;
      name: string;
      healthy: boolean;
      error?: string;
    }>;
  }> {
    const serverHealths = [];
    let overallHealthy = true;

    for (const [serverId, server] of this.servers) {
      const config = this.serverConfigs.get(serverId);
      const stats = this.serverStats.get(serverId);

      try {
        // 简单的健康检查 - 检查服务器是否还存在且配置正确
        const healthy = !!(server && config && stats);
        
        serverHealths.push({
          id: serverId,
          name: config?.name || 'Unknown',
          healthy,
          error: stats?.lastError
        });

        if (!healthy) {
          overallHealthy = false;
        }
      } catch (error) {
        serverHealths.push({
          id: serverId,
          name: config?.name || 'Unknown',
          healthy: false,
          error: error.message
        });
        overallHealthy = false;
      }
    }

    return {
      healthy: overallHealthy,
      servers: serverHealths
    };
  }

  // 统计信息
  getStats() {
    return {
      totalServers: this.servers.size,
      totalToolBindings: Array.from(this.serverStats.values())
        .reduce((sum, stats) => sum + stats.toolBindings.size, 0),
      serverDetails: Array.from(this.servers.keys()).map(serverId => {
        const config = this.serverConfigs.get(serverId);
        const stats = this.serverStats.get(serverId);
        return {
          id: serverId,
          name: config?.name,
          toolCount: stats?.toolBindings.size || 0,
          uptime: stats ? Date.now() - stats.createdAt.getTime() : 0
        };
      })
    };
  }
}
```

### 4. 转换器

```typescript
// src/core/Transformer.ts
import { join } from 'path';
import { parseFromFile, parseFromUrl, transformToMCPTools } from 'mcp-swagger-parser';
import type { MCPTool, ValidationResult, TransformOptions } from '../types/core';
import type { OpenAPISpec, ValidationError } from 'mcp-swagger-parser';

export interface ITransformer {
  transformFromOpenAPI(spec: OpenAPISpec, options?: TransformOptions): Promise<MCPTool[]>;
  transformFromFile(filePath: string, options?: TransformOptions): Promise<MCPTool[]>;
  transformFromUrl(url: string, options?: TransformOptions): Promise<MCPTool[]>;
  validateTools(tools: MCPTool[]): ValidationResult;
  normalizeTools(tools: MCPTool[]): MCPTool[];
}

export class Transformer implements ITransformer {
  private defaultOptions: TransformOptions = {
    baseUrl: undefined,
    includeDeprecated: false,
    requestTimeout: 30000,
    pathPrefix: '',
    tagFilter: [],
    operationIdPrefix: ''
  };

  async transformFromOpenAPI(spec: OpenAPISpec, options: TransformOptions = {}): Promise<MCPTool[]> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    console.log(`🔄 Transforming OpenAPI spec: ${spec.info.title} v${spec.info.version}`);
    console.log(`📊 Found ${Object.keys(spec.paths).length} API paths`);

    try {
      // 使用mcp-swagger-parser进行转换
      const tools = transformToMCPTools(spec, {
        baseUrl: mergedOptions.baseUrl,
        includeDeprecated: mergedOptions.includeDeprecated,
        requestTimeout: mergedOptions.requestTimeout,
        pathPrefix: mergedOptions.pathPrefix
      });

      // 应用过滤器
      let filteredTools = tools;

      // 标签过滤
      if (mergedOptions.tagFilter && mergedOptions.tagFilter.length > 0) {
        filteredTools = filteredTools.filter(tool => 
          tool.metadata?.tags?.some(tag => mergedOptions.tagFilter!.includes(tag))
        );
      }

      // 操作ID前缀
      if (mergedOptions.operationIdPrefix) {
        filteredTools = filteredTools.map(tool => ({
          ...tool,
          id: `${mergedOptions.operationIdPrefix}${tool.id}`,
          name: `${mergedOptions.operationIdPrefix}${tool.name}`
        }));
      }

      // 规范化工具
      const normalizedTools = this.normalizeTools(filteredTools);

      // 验证工具
      const validation = this.validateTools(normalizedTools);
      if (!validation.valid) {
        console.warn('⚠️ Some tools have validation issues:');
        validation.errors.forEach(error => {
          console.warn(`  - ${error.field}: ${error.message}`);
        });
      }

      if (validation.warnings.length > 0) {
        console.warn('⚠️ Tool validation warnings:');
        validation.warnings.forEach(warning => {
          console.warn(`  - ${warning.field}: ${warning.message}`);
        });
      }

      console.log(`🎉 Generated ${normalizedTools.length} MCP tools`);
      return normalizedTools;

    } catch (error) {
      console.error('❌ Failed to transform OpenAPI spec:', error);
      throw new Error(`OpenAPI transformation failed: ${error.message}`);
    }
  }

  async transformFromFile(filePath: string, options: TransformOptions = {}): Promise<MCPTool[]> {
    const resolvedPath = filePath || join(process.cwd(), 'swagger.json');
    
    console.log(`📖 Loading OpenAPI specification from: ${resolvedPath}`);

    try {
      // 使用mcp-swagger-parser解析文件
      const parseResult = await parseFromFile(resolvedPath, {
        strictMode: false,
        resolveReferences: true,
        validateSchema: true
      });

      // 检查解析结果
      if (!parseResult.validation.valid) {
        console.warn('⚠️ OpenAPI spec validation warnings:');
        parseResult.validation.errors.forEach((error: ValidationError) => {
          console.warn(`  - ${error.path}: ${error.message} (${error.code})`);
        });
      }

      console.log(`✅ Loaded OpenAPI spec: ${parseResult.spec.info.title} v${parseResult.spec.info.version}`);

      // 转换为MCP工具
      return this.transformFromOpenAPI(parseResult.spec, options);

    } catch (error) {
      console.error(`❌ Failed to load OpenAPI spec from file: ${resolvedPath}`, error);
      throw new Error(`File transformation failed: ${error.message}`);
    }
  }

  async transformFromUrl(url: string, options: TransformOptions = {}): Promise<MCPTool[]> {
    console.log(`🌐 Loading OpenAPI specification from URL: ${url}`);

    try {
      // 使用mcp-swagger-parser解析URL
      const parseResult = await parseFromUrl(url, {
        strictMode: false,
        resolveReferences: true,
        validateSchema: true,
        timeout: options.requestTimeout || this.defaultOptions.requestTimeout
      });

      // 检查解析结果
      if (!parseResult.validation.valid) {
        console.warn('⚠️ OpenAPI spec validation warnings:');
        parseResult.validation.errors.forEach((error: ValidationError) => {
          console.warn(`  - ${error.path}: ${error.message} (${error.code})`);
        });
      }

      console.log(`✅ Loaded OpenAPI spec from URL: ${parseResult.spec.info.title} v${parseResult.spec.info.version}`);

      // 转换为MCP工具
      return this.transformFromOpenAPI(parseResult.spec, options);

    } catch (error) {
      console.error(`❌ Failed to load OpenAPI spec from URL: ${url}`, error);
      throw new Error(`URL transformation failed: ${error.message}`);
    }
  }

  validateTools(tools: MCPTool[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      const toolIndex = `tools[${i}]`;

      // ID唯一性检查
      const duplicateIds = tools.filter(t => t.id === tool.id);
      if (duplicateIds.length > 1) {
        errors.push({
          field: `${toolIndex}.id`,
          message: `Duplicate tool ID: ${tool.id}`,
          code: 'DUPLICATE_ID'
        });
      }

      // 名称唯一性检查
      const duplicateNames = tools.filter(t => t.name === tool.name);
      if (duplicateNames.length > 1) {
        warnings.push({
          field: `${toolIndex}.name`,
          message: `Duplicate tool name: ${tool.name}`,
          code: 'DUPLICATE_NAME'
        });
      }

      // 基础字段验证
      if (!tool.id || typeof tool.id !== 'string') {
        errors.push({
          field: `${toolIndex}.id`,
          message: 'Tool ID is required and must be a string',
          code: 'INVALID_ID'
        });
      }

      if (!tool.name || typeof tool.name !== 'string') {
        errors.push({
          field: `${toolIndex}.name`,
          message: 'Tool name is required and must be a string',
          code: 'INVALID_NAME'
        });
      }

      if (!tool.description || typeof tool.description !== 'string') {
        errors.push({
          field: `${toolIndex}.description`,
          message: 'Tool description is required and must be a string',
          code: 'INVALID_DESCRIPTION'
        });
      }

      if (!tool.handler || typeof tool.handler !== 'function') {
        errors.push({
          field: `${toolIndex}.handler`,
          message: 'Tool handler is required and must be a function',
          code: 'INVALID_HANDLER'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  normalizeTools(tools: MCPTool[]): MCPTool[] {
    return tools.map(tool => ({
      ...tool,
      // 规范化ID
      id: tool.id.replace(/[^a-zA-Z0-9_-]/g, '_'),
      
      // 规范化名称
      name: tool.name.trim(),
      
      // 规范化描述
      description: tool.description.trim(),
      
      // 确保元数据存在
      metadata: {
        tags: ['api'],
        deprecated: false,
        version: '1.0.0',
        ...tool.metadata
      }
    }));
  }

  // 工具统计
  analyzeTools(tools: MCPTool[]) {
    const tagStats = new Map<string, number>();
    let deprecatedCount = 0;

    for (const tool of tools) {
      // 统计标签
      const tags = tool.metadata?.tags || ['uncategorized'];
      for (const tag of tags) {
        tagStats.set(tag, (tagStats.get(tag) || 0) + 1);
      }

      // 统计废弃工具
      if (tool.metadata?.deprecated) {
        deprecatedCount++;
      }
    }

    return {
      totalTools: tools.length,
      deprecatedCount,
      tagDistribution: Object.fromEntries(tagStats),
      uniqueTags: tagStats.size
    };
  }
}
```

这个实现方案提供了：

1. **完整的类型系统**：严格的TypeScript类型定义
2. **核心工具管理**：支持动态注册、验证、事件通知
3. **MCP服务器管理**：多服务器支持、健康检查、统计
4. **强大的转换器**：支持文件、URL、过滤、验证
5. **生产级质量**：错误处理、日志、监控、性能优化

下一步我可以为您实现适配器层和兼容层，确保完整的向下兼容性和新功能的无缝集成。
