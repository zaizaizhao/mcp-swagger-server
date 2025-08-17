import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AuthConfig } from 'mcp-swagger-parser';

import { initTools } from "./tools/initTools";
import { startStdioMcpServer, startSseMcpServer, startStreamableMcpServer } from "./transportUtils";

export interface ServerOptions {
  openApiData?: any;
  authConfig?: AuthConfig;
  customHeaders?: any;
  debugHeaders?: boolean;
  operationFilter?: any;
}

export async function createMcpServer(options: ServerOptions = {}) {
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
  await initTools(server, options.openApiData, options.authConfig, options.customHeaders, options.debugHeaders, options.operationFilter);

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  return server;
}

export async function runStdioServer(
  openApiData?: any, 
  authConfig?: AuthConfig,
  customHeaders?: any,
  debugHeaders?: boolean,
  operationFilter?: any
): Promise<void> {
  const server = await createMcpServer({ openApiData, authConfig, customHeaders, debugHeaders, operationFilter });
  await startStdioMcpServer(server);
}

export async function runSseServer(
  endpoint = "/sse",
  port = 3322,
  openApiData?: any,
  authConfig?: AuthConfig,
  customHeaders?: any,
  debugHeaders?: boolean,
  operationFilter?: any
): Promise<void> {
  const server = await createMcpServer({ openApiData, authConfig, customHeaders, debugHeaders, operationFilter });
  await startSseMcpServer(server, endpoint, port);
}

export async function runStreamableServer(
  endpoint = "/mcp",
  port = 3322,
  openApiData?: any,
  authConfig?: AuthConfig,
  customHeaders?: any,
  debugHeaders?: boolean,
  operationFilter?: any
): Promise<void> {
  const server = await createMcpServer({ openApiData, authConfig, customHeaders, debugHeaders, operationFilter });
  await startStreamableMcpServer(server, endpoint, port);
}
