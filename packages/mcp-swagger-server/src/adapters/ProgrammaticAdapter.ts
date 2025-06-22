import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolManager, Transformer, MCPRegistry } from '../core';
import type { 
  ProgrammaticConfig, 
  SwaggerSpec, 
  MCPTool, 
  TransformOptions
} from '../types';

/**
 * 编程接口适配器 - 提供完整的编程式API
 */
export class ProgrammaticAdapter {
  private toolManager: ToolManager;
  private transformer: Transformer;
  private registry: MCPRegistry;
  private config: ProgrammaticConfig;

  constructor(config: ProgrammaticConfig = {}) {
    this.config = {
      enableValidation: true,
      enableMetrics: true,
      enableCaching: true,
      maxCacheSize: 1000,
      defaultTimeout: 30000,
      ...config,
    };

    // 初始化核心组件
    this.toolManager = new ToolManager();
    this.transformer = new Transformer();
    this.registry = new MCPRegistry();
  }

  /**
   * 从OpenAPI规范创建MCP工具
   */
  async createToolsFromSpec(
    spec: SwaggerSpec,
    options: Partial<TransformOptions> = {}
  ): Promise<MCPTool[]> {
    // 将SwaggerSpec转换为文件路径，实际应用中需要更智能的处理
    // 这里简化处理，假设已有文件路径
    return await this.transformer.transformFromFile(undefined, options);
  }

  /**
   * 批量注册工具到MCP服务器（直接使用MCP SDK）
   */
  async registerTools(
    server: McpServer,
    tools: MCPTool[] | SwaggerSpec,
    options: Partial<TransformOptions> = {}
  ): Promise<void> {
    let mcpTools: MCPTool[];

    if (Array.isArray(tools)) {
      mcpTools = tools;
    } else {
      mcpTools = await this.createToolsFromSpec(tools, options);
    }

    for (const tool of mcpTools) {
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.inputSchema,
        },
        tool.handler
      );
    }
  }

  /**
   * 动态添加工具
   */
  async addTool(tool: MCPTool): Promise<void> {
    await this.toolManager.registerTool(tool);
  }

  /**
   * 动态移除工具
   */
  async removeTool(toolName: string): Promise<boolean> {
    try {
      await this.toolManager.unregisterTool(toolName);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取所有工具
   */
  getAllTools(): MCPTool[] {
    return this.toolManager.getTools();
  }

  /**
   * 获取指定工具
   */
  getTool(name: string): MCPTool | undefined {
    return this.toolManager.getTool(name);
  }

  /**
   * 搜索工具（简单实现）
   */
  searchTools(query: string): MCPTool[] {
    const tools = this.toolManager.getTools();
    return tools.filter(tool => 
      tool.name.toLowerCase().includes(query.toLowerCase()) ||
      tool.description.toLowerCase().includes(query.toLowerCase())
    );
  }

  /**
   * 按标签过滤工具（需要添加tags支持）
   */
  getToolsByTag(tag: string): MCPTool[] {
    const tools = this.toolManager.getTools();
    return tools.filter(tool => 
      tool.metadata?.tags?.includes(tag)
    );
  }

  /**
   * 执行工具
   */
  async executeTool(
    name: string, 
    args: Record<string, any>
  ): Promise<any> {
    const tool = this.toolManager.getTool(name);
    if (!tool || !tool.handler) {
      throw new Error(`Tool ${name} not found or has no handler`);
    }

    const startTime = Date.now();
    
    try {
      const result = await tool.handler(args);
      
      if (this.config.enableMetrics) {
        this.toolManager.recordExecution(name, Date.now() - startTime, true);
      }
      
      return result;
    } catch (error) {
      if (this.config.enableMetrics) {
        this.toolManager.recordExecution(name, Date.now() - startTime, false, (error as Error).message);
      }
      throw error;
    }
  }

  /**
   * 验证工具参数
   */
  validateToolArgs(toolName: string, args: Record<string, any>): boolean {
    if (!this.config.enableValidation) return true;
    
    const tool = this.toolManager.getTool(toolName);
    if (!tool) return false;

    const result = this.toolManager.validateTool(tool);
    return result.valid;
  }

  /**
   * 获取工具统计信息
   */
  getToolStats(toolName?: string): any {
    const stats = this.toolManager.getStats();
    
    if (toolName) {
      // 对于特定工具，返回基本信息
      const tool = this.toolManager.getTool(toolName);
      if (!tool) return null;
      
      return {
        name: tool.name,
        description: tool.description,
        metadata: tool.metadata,
        executionStats: stats.executionStats || null
      };
    }
    
    return stats;
  }

  /**
   * 监听工具事件
   */
  onToolEvent(
    event: 'registered' | 'unregistered' | 'executed' | 'error',
    handler: (data: any) => void
  ): void {
    this.toolManager.on(event, handler);
  }

  /**
   * 创建完整的MCP服务器
   */
  async createMCPServer(
    spec: SwaggerSpec,
    serverOptions: {
      name: string;
      version: string;
      description?: string;
    },
    transformOptions: Partial<TransformOptions> = {}
  ): Promise<McpServer> {
    const server = new McpServer(
      {
        name: serverOptions.name,
        version: serverOptions.version,
        description: serverOptions.description || `MCP Server for ${serverOptions.name}`,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    await this.registerTools(server, spec, transformOptions);
    return server;
  }

  /**
   * 导出工具配置
   */
  exportToolsConfig(): any {
    return {
      tools: this.getAllTools().map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        metadata: tool.metadata,
      })),
      stats: this.getToolStats(),
      config: this.config,
    };
  }

  /**
   * 导入工具配置
   */
  async importToolsConfig(config: any): Promise<void> {
    if (config.tools && Array.isArray(config.tools)) {
      for (const toolConfig of config.tools) {
        const tool: MCPTool = {
          id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: toolConfig.name,
          description: toolConfig.description,
          inputSchema: toolConfig.inputSchema,
          metadata: toolConfig.metadata,
          handler: () => {
            throw new Error(`Handler not implemented for tool: ${toolConfig.name}`);
          },
        };
        
        await this.addTool(tool);
      }
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: any;
  }> {
    try {
      const stats = this.getToolStats();
      const toolCount = this.getAllTools().length;
      
      return {
        status: 'healthy',
        details: {
          toolCount,
          stats,
          config: this.config,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}
