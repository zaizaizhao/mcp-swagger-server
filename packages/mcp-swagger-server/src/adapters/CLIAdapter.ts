import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseArgs } from 'node:util';
import { startStdioMcpServer, startSseMcpServer, startStreamableMcpServer } from '../transportUtils';
import type { CLIOptions, AdapterConfig } from '../types';

type SessionServerFactory = () => McpServer | Promise<McpServer>;

/**
 * CLI??? - ???????
 */
export class CLIAdapter {
  private serverOrFactory: McpServer | SessionServerFactory;
  private config: AdapterConfig;

  constructor(serverOrFactory: McpServer | SessionServerFactory, config: AdapterConfig = {}) {
    this.serverOrFactory = serverOrFactory;
    this.config = config;
  }

  private isServerFactory(
    serverOrFactory: McpServer | SessionServerFactory,
  ): serverOrFactory is SessionServerFactory {
    return typeof serverOrFactory === 'function';
  }

  private async createSessionServer(): Promise<McpServer> {
    if (this.isServerFactory(this.serverOrFactory)) {
      return await this.serverOrFactory();
    }

    return this.serverOrFactory;
  }

  /**
   * ????????????????
   */
  async parseAndRun(argv?: string[]): Promise<void> {
    const args = this.parseArgs(argv);
    await this.runServer(args);
  }

  /**
   * ???????
   */
  private parseArgs(argv?: string[]): CLIOptions {
    const { values } = parseArgs({
      args: argv,
      options: {
        transport: {
          type: 'string',
          short: 't',
          default: 'stdio',
        },
        port: {
          type: 'string',
          short: 'p',
          default: '3322',
        },
        endpoint: {
          type: 'string',
          short: 'e',
          default: '',
        },
        'auto-restart': {
          type: 'boolean',
          default: false,
        },
        'max-retries': {
          type: 'string',
          default: '5',
        },
        help: {
          type: 'boolean',
          short: 'h',
          default: false,
        },
      },
    });

    return {
      transport: values.transport as 'stdio' | 'sse' | 'streamable',
      port: parseInt(values.port || '3322', 10),
      endpoint: values.endpoint || this.getDefaultEndpoint(values.transport as string),
      autoRestart: values['auto-restart'] || false,
      maxRetries: parseInt(values['max-retries'] || '5', 10),
      help: values.help || false,
    };
  }

  /**
   * ??????
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
   * ?????????
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
          await startStdioMcpServer(await this.createSessionServer());
          break;
        case 'sse':
          console.log(`SSE Server starting on port ${options.port} with endpoint ${options.endpoint}`);
          await startSseMcpServer(() => this.createSessionServer(), options.endpoint, options.port);
          break;
        case 'streamable':
          console.log(`Streamable Server starting on port ${options.port} with endpoint ${options.endpoint}`);
          await startStreamableMcpServer(() => this.createSessionServer(), options.endpoint, options.port);
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
   * ??????
   */
  private showHelp(): void {
    console.log(`
MCP Swagger Server

Usage: mcp-swagger-server [options]

Options:
  -t, --transport <type>     Transport type (stdio, sse, streamable) [default: stdio]
  -p, --port <port>         Port number for HTTP transports [default: 3322]
  -e, --endpoint <path>     Endpoint path for HTTP transports [default: /sse or /mcp]
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
