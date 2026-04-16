import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Transformer } from '../core';
import type { TransformOptions } from '../types';

/**
 * 初始化工具 - 兼容原有API
 */
export async function initTools(
  server: McpServer,
  swaggerFile?: string,
  options: TransformOptions = {}
): Promise<void> {
  console.log("🔧 Initializing MCP tools from OpenAPI specification...");
  
  const transformer = new Transformer();
  
  try {
    const tools = await transformer.transformFromFile(swaggerFile, options);
    
    console.log(`📦 Generated ${tools.length} tools from OpenAPI specification`);
    
    for (const tool of tools) {
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.inputSchema,
        },
        tool.handler
      );
      
      console.log(`✅ Registered tool: ${tool.name}`);
    }
    
    console.log("🎉 Tool initialization completed successfully");
  } catch (error) {
    console.error("❌ Failed to initialize tools:", error);
    throw error;
  }
}

/**
 * 从URL初始化工具
 */
export async function initToolsFromUrl(
  server: McpServer,
  url: string,
  options: TransformOptions = {}
): Promise<void> {
  console.log(`🔧 Initializing MCP tools from OpenAPI URL: ${url}`);
  
  const transformer = new Transformer();
  
  try {
    const tools = await transformer.transformFromUrl(url, options);
    
    console.log(`📦 Generated ${tools.length} tools from OpenAPI URL`);
    
    for (const tool of tools) {
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.inputSchema,
        },
        tool.handler
      );
      
      console.log(`✅ Registered tool: ${tool.name}`);
    }
    
    console.log("🎉 Tool initialization from URL completed successfully");
  } catch (error) {
    console.error("❌ Failed to initialize tools from URL:", error);
    throw error;
  }
}

/**
 * 从规范对象初始化工具
 */
export async function initToolsFromSpec(
  server: McpServer,
  spec: any,
  options: TransformOptions = {}
): Promise<void> {
  console.log("🔧 Initializing MCP tools from OpenAPI specification object...");
  
  const transformer = new Transformer();
  
  try {
    // 注意：这里需要实现transformFromSpec方法，目前先用文件方式
    const tools = await transformer.transformFromSpec(spec, options);
    
    console.log(`📦 Generated ${tools.length} tools from OpenAPI specification`);
    
    for (const tool of tools) {
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.inputSchema,
        },
        tool.handler
      );
      
      console.log(`✅ Registered tool: ${tool.name}`);
    }
    
    console.log("🎉 Tool initialization from spec completed successfully");
  } catch (error) {
    console.error("❌ Failed to initialize tools from spec:", error);
    throw error;
  }
}
