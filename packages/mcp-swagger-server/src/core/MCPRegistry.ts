import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { McpServerConfig, ServerStatus, MCPTool, IMCPRegistry } from '../types/core';

export class MCPRegistry implements IMCPRegistry {
  private servers = new Map<string, McpServer>();
  private serverConfigs = new Map<string, McpServerConfig>();
  private serverStats = new Map<string, {
    createdAt: Date;
    lastError?: string;
    toolBindings: Set<string>;
    toolHandlers: Map<string, MCPTool>;
  }>();

  async createServer(config: McpServerConfig): Promise<string> {
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
      toolBindings: new Set(),
      toolHandlers: new Map()
    });

    // 添加SIGINT处理
    process.on("SIGINT", async () => {
      try {
        await server.close();
      } catch (error: any) {
        console.error(`❌ Error closing server ${serverId}:`, error);
      }
    });

    console.log(`🚀 MCP Server created: ${serverId} (${config.name})`);
    return serverId;
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
    } catch (error: any) {
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

    let successCount = 0;
    let errorCount = 0;

    // 批量注册工具到MCP服务器
    for (const tool of tools) {
      try {
        // 存储工具处理器
        stats.toolHandlers.set(tool.id, tool);
        stats.toolBindings.add(tool.id);

        // 使用 MCP Server 的 registerTool API 注册工具
        server.registerTool(
          tool.name,
          {
            description: tool.description,
            inputSchema: this.convertInputSchemaToZod(tool.inputSchema),
            annotations: tool.metadata ? {
              title: `${tool.metadata.httpMethod || 'API'} ${tool.metadata.endpoint || ''}`,
              ...(tool.metadata.deprecated && { deprecated: true })
            } : undefined
          },
          // 包装handler以适配MCP Server的签名
          async (args: any) => {
            try {
              console.log(`🔧 Executing tool: ${tool.name} (${tool.id})`);
              console.log(`📥 Arguments:`, args);
              
              const startTime = Date.now();
              const result = await tool.handler(args);
              const executionTime = Date.now() - startTime;
              
              console.log(`✅ Tool executed successfully: ${tool.name} (${executionTime}ms)`);
              
              return result;
            } catch (error: any) {
              console.error(`❌ Tool execution failed: ${tool.name}`, error);
              throw new Error(`Tool execution failed: ${error?.message || 'Unknown error'}`);
            }
          }
        );

        successCount++;
        console.log(`✅ Tool bound to server ${serverId}: ${tool.id} (${tool.name})`);

      } catch (error: any) {
        errorCount++;
        console.error(`❌ Failed to bind tool ${tool.id} to server ${serverId}:`, error);
      }
    }

    console.log(`📦 Tool binding completed for server ${serverId}:`);
    console.log(`  ✅ Success: ${successCount} tools`);
    console.log(`  ❌ Failed: ${errorCount} tools`);
    console.log(`  📊 Total: ${tools.length} tools`);
  }

  async unbindToolsFromServer(serverId: string, toolIds: string[]): Promise<void> {
    const stats = this.serverStats.get(serverId);
    if (!stats) {
      throw new Error(`Server stats for ${serverId} not found`);
    }

    // 从绑定记录中移除
    for (const toolId of toolIds) {
      stats.toolBindings.delete(toolId);
      stats.toolHandlers.delete(toolId);
    }

    // 注意：MCP SDK 可能不支持动态移除工具
    // 这里我们只是从我们的跟踪记录中移除
    console.log(`🔄 ${toolIds.length} tools unbound from server ${serverId}`);
  }

  // 将 JSON Schema 形式的 inputSchema 转换为 Zod schema
  private convertInputSchemaToZod(inputSchema: MCPTool['inputSchema']): any {
    if (!inputSchema || !inputSchema.properties) {
      return {};
    }
    
    const zodSchema: Record<string, any> = {};
    
    for (const [propName, propDef] of Object.entries(inputSchema.properties)) {
      const isRequired = inputSchema.required?.includes(propName) ?? false;
      let zodType: any;
      
      // 确保 propDef 是对象类型
      const prop = propDef as any;
      
      // 根据属性类型创建对应的 Zod 类型
      switch (prop.type) {
        case 'string':
          zodType = z.string();
          if (prop.enum && Array.isArray(prop.enum)) {
            zodType = z.enum(prop.enum as [string, ...string[]]);
          }
          break;
        case 'number':
          zodType = z.number();
          break;
        case 'integer':
          zodType = z.number().int();
          break;
        case 'boolean':
          zodType = z.boolean();
          break;
        case 'array':
          zodType = z.array(z.any());
          break;
        case 'object':
          zodType = z.object({}).passthrough();
          break;
        default:
          zodType = z.any();
      }
      
      // 设置描述
      if (prop.description) {
        zodType = zodType.describe(prop.description);
      }
      
      // 设置为可选或必需
      if (!isRequired) {
        zodType = zodType.optional();
      }
      
      zodSchema[propName] = zodType;
    }
    
    return zodSchema;
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
      createdAt: stats.createdAt,
      memoryUsage: process.memoryUsage()
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
      } catch (error: any) {
        serverHealths.push({
          id: serverId,
          name: config?.name || 'Unknown',
          healthy: false,
          error: error?.message || 'Unknown error'
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
