#!/usr/bin/env node

import { runSseServer, runStdioServer, runStreamableServer, createMcpServer } from './server';
import { parseArgs } from 'node:util';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// 导出主要API和类型
export { createMcpServer, runSseServer, runStdioServer, runStreamableServer } from './server';

// 导出核心层
export * from './core';

// 导出类型
export * from './types';

// 导出适配器层
export * from './adapters/CLIAdapter';
export * from './adapters/HTTPAdapter';
export * from './adapters/ProgrammaticAdapter';

// 导出兼容层
export * from './lib';

// 导出传输层
export * from './transportUtils';

interface ServerOptions {
  transport: string;
  port: string;
  endpoint?: string;
  managed?: boolean;
  autoRestart?: boolean;
  maxRetries?: string;
  retryDelay?: string;
  openapi?: string; // 新增：OpenAPI URL 或文件路径
  watch?: boolean;  // 新增：监控文件变化
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
    "retry-delay": {
      type: "string",
      default: "5000",
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
    help: {
      type: "boolean",
      short: "h",
      default: false,
    }
  },
}) as { values: ServerOptions & { help?: boolean } };

// 显示帮助信息
function showHelp() {
  console.log(`
🚀 MCP Swagger Server - 独立的 OpenAPI 到 MCP 工具转换服务器

用法:
  mcp-swagger-server [选项]

选项:
  -t, --transport <type>     传输协议 (stdio|http|sse|streamable) [默认: stdio]
  -p, --port <port>          服务器端口 [默认: 3322]
  -e, --endpoint <url>       自定义端点 URL
  -o, --openapi <source>     OpenAPI 规范源 (URL 或文件路径)
  -w, --watch               监控 OpenAPI 文件变化并自动重载
  -m, --managed             托管模式 (进程管理)
      --auto-restart        自动重启
      --max-retries <num>   最大重试次数 [默认: 5]
      --retry-delay <ms>    重试延迟 (毫秒) [默认: 5000]
  -h, --help                显示帮助信息

示例:
  # 从 URL 启动 HTTP 服务器
  mcp-swagger-server --transport http --port 3322 --openapi https://api.github.com/openapi.json

  # 从本地文件启动并监控变化
  mcp-swagger-server --transport streamable --openapi ./api.json --watch

  # STDIO 模式 (适合 AI 客户端)
  mcp-swagger-server --transport stdio --openapi https://petstore.swagger.io/v2/swagger.json

  # SSE 模式 (适合 Web 前端)
  mcp-swagger-server --transport sse --port 3323 --openapi ./openapi.yaml

环境变量:
  MCP_PORT          默认端口
  MCP_TRANSPORT     默认传输协议
  MCP_OPENAPI_URL   默认 OpenAPI URL
  MCP_AUTO_RELOAD   启用自动重载 (true/false)
`);
}

// 加载 OpenAPI 数据
async function loadOpenAPIData(source: string): Promise<any> {
  try {
    if (source.startsWith('http://') || source.startsWith('https://')) {
      // 从 URL 加载
      console.log(`📡 Loading OpenAPI from URL: ${source}`);
      const response = await axios.get(source);
      return response.data;
    } else {
      // 从文件加载
      console.log(`📄 Loading OpenAPI from file: ${source}`);
      const filePath = path.resolve(source);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      if (source.endsWith('.yaml') || source.endsWith('.yml')) {
        const yaml = await import('js-yaml');
        return yaml.load(content);
      } else {
        return JSON.parse(content);
      }
    }
  } catch (error:any) {
    console.error(`❌ Failed to load OpenAPI data from ${source}:`, error.message);
    throw error;
  }
}

// 文件监控
function watchOpenAPIFile(filePath: string, callback: () => void) {
  if (!filePath.startsWith('http')) {
    const resolvedPath = path.resolve(filePath);
    console.log(`👁️ Watching file: ${resolvedPath}`);
    
    fs.watchFile(resolvedPath, { interval: 1000 }, (curr, prev) => {
      if (curr.mtime > prev.mtime) {
        console.log(`🔄 File changed, reloading...`);
        callback();
      }
    });
  }
}

// 主启动函数
async function main() {
  const options = values;

  // 显示帮助
  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // 从环境变量获取默认值
  const transport = options.transport || process.env.MCP_TRANSPORT || 'stdio';
  const port = parseInt(options.port || process.env.MCP_PORT || '3322');
  const openApiSource = options.openapi || process.env.MCP_OPENAPI_URL;
  const autoReload = options.watch || process.env.MCP_AUTO_RELOAD === 'true';

  console.log(`🚀 Starting MCP Swagger Server`);
  console.log(`📋 Transport: ${transport}`);
  console.log(`🚪 Port: ${port}`);
  
  if (openApiSource) {
    console.log(`📖 OpenAPI Source: ${openApiSource}`);
  }

  // 启动服务器的函数
  async function startServer() {
    try {
      let openApiData = null;
      
      // 加载 OpenAPI 数据
      if (openApiSource) {
        openApiData = await loadOpenAPIData(openApiSource);
        console.log(`✅ OpenAPI loaded successfully`);
      }

      // 根据传输协议启动服务器
      switch (transport.toLowerCase()) {
        case 'stdio':
          console.log(`📝 Starting STDIO server...`);
          await runStdioServer(openApiData);
          break;

        case 'http':
        case 'streamable':
          console.log(`🌐 Starting HTTP server on port ${port}...`);
          const streamEndpoint = options.endpoint || '/mcp';
          await runStreamableServer(streamEndpoint, port, openApiData);
          break;

        case 'sse':
          console.log(`📡 Starting SSE server on port ${port}...`);
          const sseEndpoint = options.endpoint || '/sse';
          await runSseServer(sseEndpoint, port, openApiData);
          break;

        default:
          throw new Error(`Unsupported transport: ${transport}`);
      }

      console.log(`🎉 MCP Server started successfully!`);
      
      // 设置文件监控
      if (autoReload && openApiSource && !openApiSource.startsWith('http')) {
        watchOpenAPIFile(openApiSource, () => {
          console.log(`🔄 Restarting server due to file change...`);
          // 这里可以实现热重载逻辑
          process.exit(0); // 简单重启
        });
      }

    } catch (error:any) {
      console.error(`❌ Failed to start server:`, error.message);
      
      if (options.autoRestart) {
        const retryDelay = parseInt(options.retryDelay || '5000');
        const maxRetries = parseInt(options.maxRetries || '5');
        
        console.log(`🔄 Auto-restart enabled, retrying in ${retryDelay}ms...`);
        setTimeout(startServer, retryDelay);
      } else {
        process.exit(1);
      }
    }
  }

  // 处理优雅关闭
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    process.exit(0);
  });

  // 启动服务器
  await startServer();
}

// 如果直接运行此文件，则启动服务器
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}
