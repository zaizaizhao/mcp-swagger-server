import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CLIAdapter } from '../adapters/CLIAdapter';
import { ProgrammaticAdapter } from '../adapters/ProgrammaticAdapter';
import { Transformer } from '../core';
import type { CLIOptions, ProgrammaticConfig, TransformOptions } from '../types';

/**
 * 兼容层服务器创建器 - 向下兼容原有API
 */
export async function createMcpServer(options: {
  name?: string;
  version?: string;
  description?: string;
  swaggerFile?: string;
  transformOptions?: TransformOptions;
} = {}): Promise<McpServer> {
  const server = new McpServer(
    {
      name: options.name || "mcp-swagger-server",
      version: options.version || "1.0.0",
      description: options.description || "A Model Context Protocol server for Swagger documentation",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 如果提供了swagger文件，自动初始化工具
  if (options.swaggerFile) {
    const transformer = new Transformer();
    const tools = await transformer.transformFromFile(options.swaggerFile, options.transformOptions);
    
    for (const tool of tools) {
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

  return server;
}

/**
 * 启动STDIO服务器 - 向下兼容
 */
export async function runStdioServer(options: {
  name?: string;
  version?: string;
  description?: string;
  swaggerFile?: string;
  transformOptions?: TransformOptions;
} = {}): Promise<void> {
  const server = await createMcpServer(options);
  const adapter = new CLIAdapter(server);
  
  await adapter.parseAndRun(['--transport', 'stdio']);
}

/**
 * 启动SSE服务器 - 向下兼容
 */
export async function runSseServer(
  endpoint = "/sse",
  port = 3322,
  options: {
    name?: string;
    version?: string;
    description?: string;
    swaggerFile?: string;
    transformOptions?: TransformOptions;
  } = {}
): Promise<void> {
  const server = await createMcpServer(options);
  const adapter = new CLIAdapter(server);
  
  await adapter.parseAndRun([
    '--transport', 'sse',
    '--port', port.toString(),
    '--endpoint', endpoint
  ]);
}

/**
 * 启动Streamable服务器 - 向下兼容
 */
export async function runStreamableServer(
  endpoint = "/mcp",
  port = 3322,
  options: {
    name?: string;
    version?: string;
    description?: string;
    swaggerFile?: string;
    transformOptions?: TransformOptions;
  } = {}
): Promise<void> {
  const server = await createMcpServer(options);
  const adapter = new CLIAdapter(server);
  
  await adapter.parseAndRun([
    '--transport', 'streamable',
    '--port', port.toString(),
    '--endpoint', endpoint
  ]);
}

/**
 * 创建编程式适配器 - 新API
 */
export function createProgrammaticAdapter(config?: ProgrammaticConfig): ProgrammaticAdapter {
  return new ProgrammaticAdapter(config);
}

/**
 * 创建CLI适配器 - 新API
 */
export function createCLIAdapter(server: McpServer, config?: any): CLIAdapter {
  return new CLIAdapter(server, config);
}
