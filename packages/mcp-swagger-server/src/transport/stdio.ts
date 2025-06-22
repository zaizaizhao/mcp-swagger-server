import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

/**
 * 启动 STDIO 传输层的 MCP 服务器
 * @param server MCP 服务器实例
 */
export async function startStdioMcpServer(server: McpServer): Promise<void> {
  console.log("🔗 Starting STDIO transport...");
  
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.log("✅ STDIO transport started successfully");
    console.log("📝 Server is now listening on STDIO for MCP protocol messages");
    
  } catch (error: any) {
    console.error("❌ Failed to start STDIO transport:", error);
    throw new Error(`STDIO transport failed: ${error?.message || 'Unknown error'}`);
  }
}
