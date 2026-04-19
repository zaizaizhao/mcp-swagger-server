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
 * 工厂函数集合 - 提供便捷的创建方法
 */

/**
 * 创建完整的MCP Swagger服务器实例
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
  // 创建服务器工厂函数
  const createServerInstance = async () => {
    const serverInstance = new McpServer(
      {
        name: config.server.name,
        version: config.server.version,
        description: config.server.description || "A Model Context Protocol server for Swagger documentation",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // 如果提供了Swagger配置，初始化工具
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
        serverInstance.registerTool(
          tool.name,
          {
            description: tool.description,
            inputSchema: tool.inputSchema,
          },
          tool.handler
        );
      }
    }

    return serverInstance;
  };

  // 创建适配器（传入工厂函数）
  const adapter = new CLIAdapter(createServerInstance);

  // 为了向后兼容，创建一个初始服务器实例
  const server = await createServerInstance();

  // 返回服务器实例和启动函数
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
 * 创建编程式API管理器
 */
export function createProgrammaticAPI(config?: ProgrammaticConfig): ProgrammaticAdapter {
  return new ProgrammaticAdapter(config);
}

/**
 * 创建工具管理器
 */
export function createToolManager(): ToolManager {
  return new ToolManager();
}

/**
 * 创建转换器
 */
export function createTransformer(): Transformer {
  return new Transformer();
}

/**
 * 创建MCP注册表
 */
export function createMCPRegistry(): MCPRegistry {
  return new MCPRegistry();
}

/**
 * 快速启动函数 - 最简单的使用方式
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

  console.log(`🚀 Starting ${options.name} with ${options.transport || 'stdio'} transport...`);
  await serverFactory.start();
}
