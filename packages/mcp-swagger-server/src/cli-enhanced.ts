#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runSseServer, runStdioServer, runStreamableServer } from './server';
import axios from 'axios';
import * as yaml from 'js-yaml';

interface CLIConfig {
  transport: 'stdio' | 'sse' | 'streamable' | 'http' | 'websocket';
  port: number;
  endpoint: string;
  openapi: string;
  watch: boolean;
  verbose: boolean;
  config?: string;
}

// 解析命令行参数
const { values } = parseArgs({
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
    openapi: {
      type: "string",
      short: "o",
      default: "",
    },
    watch: {
      type: "boolean",
      short: "w",
      default: false,
    },
    verbose: {
      type: "boolean",
      short: "v",
      default: false,
    },
    config: {
      type: "string",
      short: "c",
      default: "",
    },
    help: {
      type: "boolean",
      short: "h",
    },
  }
});

// 显示帮助信息
if (values.help) {
  console.log(`
🚀 MCP Swagger Server CLI

Usage: mcp-swagger-server [options]

Options:
  -t, --transport <type>    Transport protocol: stdio, sse, streamable, http, websocket (default: stdio)
  -p, --port <port>         Port number for HTTP-based transports (default: 3322)
  -e, --endpoint <path>     Endpoint path for HTTP-based transports
  -o, --openapi <source>    OpenAPI source: URL, file path, or '-' for stdin
  -w, --watch               Watch for changes and reload (file sources only)
  -v, --verbose             Enable verbose logging
  -c, --config <file>       Load configuration from file
  -h, --help                Show this help message

Examples:
  # Start with local OpenAPI file
  mcp-swagger-server -t streamable -p 3322 -o ./openapi.json

  # Start with remote OpenAPI
  mcp-swagger-server -t http -p 3323 -o https://api.github.com/openapi.json

  # Start with stdio (for Claude Desktop)
  mcp-swagger-server -t stdio -o https://petstore.swagger.io/v2/swagger.json

  # Watch file for changes
  mcp-swagger-server -t sse -p 3324 -o ./api.yaml -w

  # Load from config file
  mcp-swagger-server -c ./mcp-config.json

Config File Format (JSON):
{
  "transport": "streamable",
  "port": 3322,
  "openapi": "https://api.example.com/openapi.json",
  "watch": true,
  "verbose": true
}
  `);
  process.exit(0);
}

class MCPServerCLI {
  private config: CLIConfig;
  private openApiData: any = null;
  private watchInterval?: NodeJS.Timeout;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): CLIConfig {
    let config: Partial<CLIConfig> = {};

    // 加载配置文件
    if (values.config) {
      const configPath = resolve(values.config as string);
      if (existsSync(configPath)) {
        try {
          const configContent = readFileSync(configPath, 'utf-8');
          config = JSON.parse(configContent);
          this.log(`✅ 已加载配置文件: ${configPath}`);
        } catch (error) {
          console.error(`❌ 无法解析配置文件: ${error}`);
          process.exit(1);
        }
      } else {
        console.error(`❌ 配置文件不存在: ${configPath}`);
        process.exit(1);
      }
    }

    // 命令行参数覆盖配置文件
    return {
      transport: (values.transport as any) || config.transport || 'stdio',
      port: parseInt((values.port as string) || config.port?.toString() || '3322'),
      endpoint: (values.endpoint as string) || config.endpoint || '',
      openapi: (values.openapi as string) || config.openapi || '',
      watch: values.watch || config.watch || false,
      verbose: values.verbose || config.verbose || false,
      config: values.config as string,
    };
  }

  private log(message: string) {
    if (this.config.verbose) {
      console.log(`[${new Date().toISOString()}] ${message}`);
    }
  }

  private async loadOpenAPI(): Promise<any> {
    if (!this.config.openapi) {
      console.error('❌ 必须指定 OpenAPI 源 (--openapi)');
      process.exit(1);
    }

    try {
      if (this.config.openapi === '-') {
        // 从 stdin 读取
        this.log('📥 从标准输入读取 OpenAPI 数据...');
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        const content = Buffer.concat(chunks).toString();
        return this.parseOpenAPI(content);
      } else if (this.config.openapi.startsWith('http')) {
        // 从 URL 加载
        this.log(`🌐 从 URL 加载 OpenAPI: ${this.config.openapi}`);
        const response = await axios.get(this.config.openapi);
        return response.data;
      } else {
        // 从文件加载
        const filePath = resolve(this.config.openapi);
        if (!existsSync(filePath)) {
          throw new Error(`文件不存在: ${filePath}`);
        }
        this.log(`📁 从文件加载 OpenAPI: ${filePath}`);
        const content = readFileSync(filePath, 'utf-8');
        return this.parseOpenAPI(content);
      }
    } catch (error) {
      console.error(`❌ 加载 OpenAPI 失败: ${error}`);
      process.exit(1);
    }
  }

  private parseOpenAPI(content: string): any {
    try {
      // 尝试解析为 JSON
      return JSON.parse(content);
    } catch {
      try {
        // 尝试解析为 YAML
        return yaml.load(content);
      } catch (error) {
        throw new Error(`无法解析 OpenAPI 内容: ${error}`);
      }
    }
  }

  private setupWatcher() {
    if (!this.config.watch || this.config.openapi.startsWith('http') || this.config.openapi === '-') {
      return;
    }

    const filePath = resolve(this.config.openapi);
    this.log(`👀 监听文件变化: ${filePath}`);

    this.watchInterval = setInterval(async () => {
      try {
        const newData = await this.loadOpenAPI();
        if (JSON.stringify(newData) !== JSON.stringify(this.openApiData)) {
          this.log('🔄 检测到文件变化，重新加载...');
          this.openApiData = newData;
          // 这里可以实现热重载逻辑
          console.log('✅ OpenAPI 数据已更新');
        }
      } catch (error) {
        console.error(`❌ 重新加载失败: ${error}`);
      }
    }, 2000);
  }

  async start() {
    console.log('🚀 MCP Swagger Server CLI 启动中...');
    console.log(`📡 传输协议: ${this.config.transport}`);
    console.log(`🔧 端口: ${this.config.port}`);
    console.log(`📋 OpenAPI 源: ${this.config.openapi}`);

    // 加载 OpenAPI 数据
    this.openApiData = await this.loadOpenAPI();
    console.log('✅ OpenAPI 数据加载成功');

    // 设置文件监听
    this.setupWatcher();

    // 设置信号处理
    process.on('SIGINT', () => {
      console.log('\n🛑 收到停止信号，正在关闭服务器...');
      this.stop();
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 收到终止信号，正在关闭服务器...');
      this.stop();
    });

    // 启动服务器
    try {
      switch (this.config.transport) {
        case 'stdio':
          console.log('📡 启动 STDIO 服务器...');
          await runStdioServer();
          break;
        case 'sse':
          const sseEndpoint = this.config.endpoint || '/sse';
          console.log(`📡 启动 SSE 服务器: http://localhost:${this.config.port}${sseEndpoint}`);
          await runSseServer(sseEndpoint, this.config.port);
          break;
        case 'streamable':
        case 'http':
        case 'websocket':
          const streamEndpoint = this.config.endpoint || '/mcp';
          console.log(`📡 启动 Streamable 服务器: http://localhost:${this.config.port}${streamEndpoint}`);
          await runStreamableServer(streamEndpoint, this.config.port);
          break;
        default:
          throw new Error(`不支持的传输协议: ${this.config.transport}`);
      }
    } catch (error) {
      console.error(`❌ 启动服务器失败: ${error}`);
      process.exit(1);
    }
  }

  stop() {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
    }
    console.log('👋 服务器已停止');
    process.exit(0);
  }
}

// 启动 CLI
const cli = new MCPServerCLI();
cli.start().catch(error => {
  console.error('❌ CLI 启动失败:', error);
  process.exit(1);
});
