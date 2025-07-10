import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { transformOpenApiToMcpTools, MCPTool } from "../transform";
import { AuthConfig } from 'mcp-swagger-parser';

export async function initTools(
  server: McpServer, 
  openApiData?: any, 
  authConfig?: AuthConfig,
  customHeaders?: any,
  debugHeaders?: boolean
) {
    console.log("🔧 初始化 MCP 工具...");
    
    try {
        // 如果没有提供 openApiData，使用默认的 swagger.json
        if (!openApiData) {
            console.log("⚠️ 未提供 OpenAPI 数据，将使用默认的 swagger.json 文件");
        }
        
        // 从 OpenAPI 规范生成工具
        const tools = await transformOpenApiToMcpTools(
          undefined, 
          undefined, 
          openApiData, 
          authConfig, 
          customHeaders, 
          debugHeaders
        );
        
        console.log(`📦 成功生成 ${tools.length} 个工具`);
          // 打印工具摘要
        printToolsSummary(tools);
        
        // 批量注册工具到 MCP Server
        await registerTools(server, tools);
        
        console.log("✅ 工具初始化完成");
        
    } catch (error) {
        console.error("❌ 初始化工具失败:", error);
        
        // 如果是解析错误且没有提供 openApiData，尝试使用默认配置
        if ((error as any)?.code === 'VALIDATION_ERROR' && !openApiData) {
            console.log("🔄 尝试使用默认配置重新初始化...");
            try {
                const tools = await transformOpenApiToMcpTools();
                await registerTools(server, tools);
                console.log("✅ 使用默认配置初始化完成");
                return;
            } catch (fallbackError) {
                console.error("❌ 默认配置初始化也失败:", fallbackError);
            }
        }
        
        throw error;
    }
}

/**
 * 打印工具摘要
 */
function printToolsSummary(tools: any[]) {
    console.log("\n📊 工具摘要:");
    console.log("─".repeat(80));
    
    // 按标签分组
    const toolsByTag: Record<string, any[]> = {};
    
    for (const tool of tools) {
        const tags = tool.metadata?.tags || ['未分类'];
        for (const tag of tags) {
            if (!toolsByTag[tag]) {
                toolsByTag[tag] = [];
            }
            toolsByTag[tag].push(tool);
        }
    }
    
    for (const [tag, tagTools] of Object.entries(toolsByTag)) {
        console.log(`\n📂 ${tag} (${tagTools.length} 个工具):`);
        
        for (const tool of tagTools.slice(0, 5)) { // 只显示前5个
            const method = tool.metadata?.method || 'UNKNOWN';
            const path = tool.metadata?.path || '';
            console.log(`  • ${tool.name} - ${method} ${path}`);
            console.log(`    ${tool.description}`);
        }
        
        if (tagTools.length > 5) {
            console.log(`  ... 还有 ${tagTools.length - 5} 个工具`);
        }
    }
      console.log("─".repeat(80));
    console.log(`🎯 总计: ${tools.length} 个工具已生成`);
    
    // 显示工具示例
    if (tools.length > 0) {
        const exampleTool = tools[0];
        console.log(`\n💡 工具示例: ${exampleTool.name}`);
        console.log(`📝 描述: ${exampleTool.description}`);
        console.log(`📋 输入模式:`, JSON.stringify(exampleTool.inputSchema, null, 2));
    }
}

/**
 * 批量注册工具到 MCP Server
 * @param server MCP Server 实例
 * @param tools 从 OpenAPI 转换的工具列表
 */
async function registerTools(server: McpServer, tools: MCPTool[]): Promise<void> {
    console.log(`🔗 开始注册 ${tools.length} 个工具到 MCP Server...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const tool of tools) {
        try {            // 使用 MCP Server 的 registerTool API 注册工具
            server.registerTool(
                tool.name,
                {
                    description: tool.description,
                    inputSchema: convertInputSchemaToZod(tool.inputSchema),
                    // 如果需要 outputSchema，可以在这里添加
                    // outputSchema: tool.outputSchema ? convertToZodSchema(tool.outputSchema) : undefined,
                    annotations: tool.metadata ? {
                        title: `${tool.metadata.method} ${tool.metadata.path}`,
                        ...(tool.metadata.deprecated && { deprecated: true })
                    } : undefined
                },
                // 包装handler以适配MCP Server的签名
                async (extra: any) => {
                    const result = await tool.handler(extra);
                    return result as any; // 强制类型转换以解决类型不匹配问题
                }
            );
            
            successCount++;
            console.log(`✅ 已注册工具: ${tool.name} (${tool.metadata?.method} ${tool.metadata?.path})`);
            
        } catch (error) {
            errorCount++;
            console.error(`❌ 注册工具失败: ${tool.name}`, error);
        }
    }
    
    console.log(`\n📊 工具注册完成:`);
    console.log(`  ✅ 成功: ${successCount} 个`);
    console.log(`  ❌ 失败: ${errorCount} 个`);
    console.log(`  📦 总计: ${tools.length} 个工具`);
}

/**
 * 将 JSON Schema 形式的 inputSchema 转换为 Zod schema
 * @param inputSchema JSON Schema 格式的输入模式
 * @returns Zod schema 对象
 */
function convertInputSchemaToZod(inputSchema: MCPTool['inputSchema']): any {
    if (!inputSchema || !inputSchema.properties) {
        return {};
    }
    
    const zodSchema: Record<string, any> = {};
    
    for (const [propName, propDef] of Object.entries(inputSchema.properties)) {
        const isRequired = inputSchema.required?.includes(propName) ?? false;
        let zodType: any;
        
        // 根据属性类型创建对应的 Zod 类型
        switch (propDef.type) {
            case 'string':
                zodType = z.string();
                if (propDef.enum && Array.isArray(propDef.enum)) {
                    zodType = z.enum(propDef.enum as [string, ...string[]]);
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
                zodType = z.array(z.any()); // 简化处理，可以后续完善
                break;
            case 'object':
                zodType = z.object({}).passthrough(); // 简化处理
                break;
            default:
                zodType = z.any();
                break;
        }
        
        // 处理可选字段
        if (!isRequired) {
            zodType = zodType.optional();
        }
        
        // 添加描述
        if (propDef.description) {
            zodType = zodType.describe(propDef.description);
        }
        
        zodSchema[propName] = zodType;
    }
    
    return zodSchema;
}