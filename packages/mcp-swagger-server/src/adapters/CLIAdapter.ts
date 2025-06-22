import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseArgs } from 'node:util';
import { startStdioMcpServer, startSseMcpServer, startStreamableMcpServer } from '../transportUtils';
import type { CLIOptions, AdapterConfig } from '../types';

/**
 * CLI适配器 - 处理命令行启动
 */
export class CLIAdapter {
  private server: McpServer;
  private config: AdapterConfig;

  constructor(server: McpServer, config: AdapterConfig = {}) {
    this.server = server;
    this.config = config;
  }

  /**
   * 解析命令行参数并启动对应的服务器
   */
  async parseAndRun(argv?: string[]): Promise<void> {
    const args = this.parseArgs(argv);
    await this.runServer(args);
  }

  /**
   * 解析命令行参数
   */
  private parseArgs(argv?: string[]): CLIOptions {
    const { values } = parseArgs({
      args: argv,
      options: {
        transport: {
          type: "string",
          short: "t",
          default: "stdio",
        },
        port: {
          type: "string",
          short: "p",
          default: "3322",
        },
        endpoint: {
          type: "string",
          short: "e",
          default: "",
        },
        managed: {
          type: "boolean",
          short: "m",
          default: false,
        },
        "auto-restart": {
          type: "boolean",
          default: false,
        },
        "max-retries": {
          type: "string",
          default: "5",
        },
        help: {
          type: "boolean",
          short: "h",
          default: false,
        },
      },
    });

    return {
      transport: values.transport as 'stdio' | 'sse' | 'streamable',
      port: parseInt(values.port || '3322', 10),
      endpoint: values.endpoint || this.getDefaultEndpoint(values.transport as string),
      managed: values.managed || false,
      autoRestart: values['auto-restart'] || false,
      maxRetries: parseInt(values['max-retries'] || '5', 10),
      help: values.help || false,
    };
  }

  /**
   * 获取默认端点
   */
  private getDefaultEndpoint(transport: string): string {
    switch (transport) {
      case 'sse':
        return '/sse';
      case 'streamable':
        return '/mcp';
      default:
        return '';
    }
  }

  /**
   * 根据参数运行服务器
   */
  private async runServer(options: CLIOptions): Promise<void> {
    if (options.help) {
      this.showHelp();
      return;
    }

    console.log(`Starting MCP Swagger Server with ${options.transport} transport...`);

    try {
      switch (options.transport) {
        case 'stdio':
          await startStdioMcpServer(this.server);
          break;
        case 'sse':
          console.log(`SSE Server starting on port ${options.port} with endpoint ${options.endpoint}`);
          await startSseMcpServer(this.server, options.endpoint, options.port);
          break;
        case 'streamable':
          console.log(`Streamable Server starting on port ${options.port} with endpoint ${options.endpoint}`);
          await startStreamableMcpServer(this.server, options.endpoint, options.port);
          break;
        default:
          throw new Error(`Unsupported transport: ${options.transport}`);
      }
    } catch (error) {
      console.error('Failed to start server:', error);
      if (options.autoRestart && this.config.onError) {
        await this.config.onError(error as Error, options);
      } else {
        process.exit(1);
      }
    }
  }

  /**
   * 显示帮助信息
   */
  private showHelp(): void {
    console.log(`
MCP Swagger Server

Usage: mcp-swagger-server [options]

Options:
  -t, --transport <type>     Transport type (stdio, sse, streamable) [default: stdio]
  -p, --port <port>         Port number for HTTP transports [default: 3322]
  -e, --endpoint <path>     Endpoint path for HTTP transports [default: /sse or /mcp]
  -m, --managed             Run in managed mode
  --auto-restart            Auto restart on error
  --max-retries <num>       Maximum retry attempts [default: 5]
  -h, --help                Show this help message

Examples:
  mcp-swagger-server                           # STDIO transport
  mcp-swagger-server -t sse -p 3000 -e /api   # SSE transport on port 3000
  mcp-swagger-server -t streamable             # HTTP Streamable transport
`);
  }
}
