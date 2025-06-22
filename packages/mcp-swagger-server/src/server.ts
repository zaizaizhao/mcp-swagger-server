import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { initTools } from "./tools/initTools";
import { startStdioMcpServer, startSseMcpServer, startStreamableMcpServer } from "./transportUtils";


export async function createMcpServer(openApiData?: any) {
  const server = new McpServer(
    {
      name: "mcp-swagger-server",
      version: "1.0.0",
      description: "A Model Context Protocol server for Swagger documentation to transform OpenAPI specs into MCP format.",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 先初始化工具，确保在连接传输层前完成
  await initTools(server, openApiData);

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  return server;
}

export async function runStdioServer(openApiData?: any): Promise<void> {
  const server = await createMcpServer(openApiData);
  await startStdioMcpServer(server);
}

export async function runSseServer(
  endpoint = "/sse",
  port = 3322,
  openApiData?: any
): Promise<void> {
  const server = await createMcpServer(openApiData);
  await startSseMcpServer(server, endpoint, port);
}

export async function runStreamableServer(
  endpoint = "/mcp",
  port = 3322,
  openApiData?: any
): Promise<void> {
  const server = await createMcpServer(openApiData);
  await startStreamableMcpServer(server, endpoint, port);
}
