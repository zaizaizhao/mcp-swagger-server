import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CLIAdapter } from '../adapters/CLIAdapter';
import { ProgrammaticAdapter } from '../adapters/ProgrammaticAdapter';
import { ToolManager, Transformer, MCPRegistry } from '../core';
import type {
  ProgrammaticConfig,
  AdapterConfig,
  TransformOptions
} from '../types';

/**
 * ?????? - ?????????
 */

/**
 * ????? MCP Swagger ?????
 */
export async function createSwaggerMCPServer(config: {
  server: {
    name: string;
    version: string;
    description?: string;
  };
  swagger?: {
    file?: string;
    url?: string;
    spec?: any;
    transformOptions?: TransformOptions;
  };
  transport?: {
    type: 'stdio' | 'sse' | 'streamable';
    options?: {
      port?: number;
      endpoint?: string;
    };
  };
}): Promise<{
  server: McpServer;
  adapter: CLIAdapter;
  start: () => Promise<void>;
}> {
  const buildServer = async (): Promise<McpServer> => {
    const server = new McpServer(
      {
        name: config.server.name,
        version: config.server.version,
        description: config.server.description || `MCP Server for ${config.server.name}`,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    if (config.swagger) {
      const transformer = new Transformer();
      let tools;

      if (config.swagger.file) {
        tools = await transformer.transformFromFile(config.swagger.file, config.swagger.transformOptions);
      } else if (config.swagger.url) {
        tools = await transformer.transformFromUrl(config.swagger.url, config.swagger.transformOptions);
      } else {
        tools = await transformer.transformFromFile(undefined, config.swagger.transformOptions);
      }

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
  };

  const server = await buildServer();
  const adapter = new CLIAdapter(buildServer);

  return {
    server,
    adapter,
    start: async () => {
      const transport = config.transport || { type: 'stdio' };
      const args = ['--transport', transport.type];

      if (transport.options?.port) {
        args.push('--port', transport.options.port.toString());
      }

      if (transport.options?.endpoint) {
        args.push('--endpoint', transport.options.endpoint);
      }

      await adapter.parseAndRun(args);
    }
  };
}

/**
 * ????? API ???
 */
export function createProgrammaticAPI(config?: ProgrammaticConfig): ProgrammaticAdapter {
  return new ProgrammaticAdapter(config);
}

/**
 * ???????
 */
export function createToolManager(): ToolManager {
  return new ToolManager();
}

/**
 * ?????
 */
export function createTransformer(): Transformer {
  return new Transformer();
}

/**
 * ?? MCP ???
 */
export function createMCPRegistry(): MCPRegistry {
  return new MCPRegistry();
}

/**
 * ?????? - ????????
 */
export async function quickStart(options: {
  name: string;
  version?: string;
  swaggerFile?: string;
  transport?: 'stdio' | 'sse' | 'streamable';
  port?: number;
  endpoint?: string;
} = { name: 'quick-mcp-server' }): Promise<void> {
  const serverFactory = await createSwaggerMCPServer({
    server: {
      name: options.name,
      version: options.version || '1.0.0',
      description: `Quick MCP Server for ${options.name}`,
    },
    swagger: options.swaggerFile ? {
      file: options.swaggerFile,
    } : undefined,
    transport: {
      type: options.transport || 'stdio',
      options: {
        port: options.port,
        endpoint: options.endpoint,
      },
    },
  });

  console.log(`Starting ${options.name} with ${options.transport || 'stdio'} transport...`);
  await serverFactory.start();
}
