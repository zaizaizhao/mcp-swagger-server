import { runSseServer, runStdioServer, runStreamableServer, createMcpServer } from './server';
import { parseArgs } from 'node:util';

// 导出主要API和类型
export { createMcpServer, runSseServer, runStdioServer, runStreamableServer } from './server';

// 导出核心层
export * from './core';

// 导出类型
export * from './types';

// 导出转换函数
export { transformOpenApiToMcpTools } from './transform/transformOpenApiToMcpTools';

// 导出适配器层
export * from './adapters/CLIAdapter';
export * from './adapters/ProgrammaticAdapter';

// 导出兼容层
export * from './lib';

// 导出传输层
export * from './transportUtils';


// 定义端口 - 使用一个不太常用的端口，并添加环境变量支持
const DEFAULT_PORT = 8765; // 使用不太常见的端口号
const PORT = process.env.MCP_EXPRESS_PORT ? parseInt(process.env.MCP_EXPRESS_PORT, 10) : DEFAULT_PORT;

// 判断是否是Inspector模式
const isInspectorMode = process.argv.some(arg => arg.includes('@modelcontextprotocol/inspector'));
console.log("是否为Inspector模式:", isInspectorMode);
const { values } = parseArgs({
  options:{
    transport: {
      type: "string",
      short: "t",
      default: "stdio",
    },
    port: {
      type: "string",
      short: "p",
      default: "1122",
    },
    endpoint: {
      type: "string",
      short: "e",
      default: "", // We'll handle defaults per transport type
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
    },
  }
})

console.log("解析的命令行选项:", values);

if (values.help) {
  console.log(`
MCP Server Chart CLI

Options:
  --transport, -t      Specify the transport protocol: "stdio", "sse", or "streamable" (default: "stdio")
  --port, -p           Specify the port for SSE or streamable transport (default: 3322)
  --endpoint, -e       Specify the endpoint for the transport:
                       - For SSE: default is "/sse"
                       - For streamable: default is "/mcp"
  --managed, -m        Enable managed mode with automatic restart capabilities
  --auto-restart       Enable automatic restart on failure (requires --managed)
  --max-retries        Maximum number of restart attempts (default: 5)
  --help, -h           Show this help message

Managed Mode Examples:
  # Start with basic auto-restart
  node dist/index.js --managed --auto-restart

  # Start with custom retry limit
  node dist/index.js --managed --auto-restart --max-retries 10

  # Use the dedicated manager tool for more control
  npx ts-node src/tools/mcp-manager.ts start --transport sse --port 3322
  `);
  process.exit(0);
}

const transport = values.transport || "stdio";
console.log("使用传输协议:", transport);

// 启动MCP服务器
async function startServers() {
  try {
    // 检查是否启用管理模式
    if (values.managed || values['auto-restart']) {
      console.log("🔧 启用管理模式，具备自动重启能力");
      
      // 动态导入管理器
      const { MCPServerManager } = await import('./tools/MCPServerManager');
      
      const config = {
        maxRetries: parseInt(values['max-retries'] as string) || 5,
        retryDelay: 2000,
        backoffMultiplier: 1.5,
        maxRetryDelay: 30000,
        healthCheckInterval: 30000,
        healthCheckTimeout: 5000,
        autoRestart: !!values['auto-restart'],
        restartOnError: true,
        restartOnExit: !!values['auto-restart'],
        restartOnMemoryLimit: 512,
        logLevel: 'info' as const,
        logToFile: true
      };

      // 创建一个临时脚本来启动服务器
      const childArgs = [
        '--transport', transport,
        '--port', values.port as string,
        '--endpoint', values.endpoint || (transport === 'sse' ? '/sse' : '/mcp')
      ];

      // 修复文件路径问题 - 使用编译后的 dist 路径
      const scriptPath = __filename.replace(/\.ts$/, '.js').replace(/[\\/]src[\\/]/, '/dist/');
      
      const manager = new MCPServerManager(scriptPath, childArgs, config);

      // 设置事件监听
      manager.on('started', (stats) => {
        console.log(`✅ MCP 服务器已启动 (PID: ${stats.processId})`);
        console.log(`📡 传输协议: ${transport}`);
        console.log(`🔄 自动重启: ${config.autoRestart ? '启用' : '禁用'}`);
      });

      manager.on('restarted', ({ reason, restartCount }) => {
        console.log(`🔄 服务器已重启 (第${restartCount}次) - 原因: ${reason}`);
      });

      manager.on('error', (error) => {
        console.error(`❌ 服务器错误: ${error}`);
      });

      manager.on('maxRetriesReached', () => {
        console.error(`⚠️ 达到最大重试次数，停止自动重启`);
        process.exit(1);
      });

      await manager.start();
      return;
    }

    // 常规启动模式
    console.log(`准备启动 ${transport} 传输协议的MCP服务器...`);
    if (transport === "stdio") {
      await runStdioServer();
      console.log("Stdio MCP服务器已启动");
    } else if (transport === "sse") {
      console.log("SSE MCP服务器启动中...");
      const port = Number.parseInt(values.port as string, 10);
      const endpoint = values.endpoint || "/sse";
      await runSseServer(endpoint, port);
      console.log(`SSE MCP服务器已启动 (端点: ${endpoint}, 端口: ${port})`);
    } else if (transport === "streamable") {
      console.log("Streamable MCP服务器启动中...");
      const port = Number.parseInt(values.port as string, 10);
      const endpoint = values.endpoint || "/mcp";
      await runStreamableServer(endpoint,port);
      console.log(`Streamable MCP服务器已启动 (端点: ${endpoint}, 端口: ${port})`);
    }
    
    console.log("所有服务器启动完成");
  } catch (error) {
    console.error('启动服务器失败:', error);
    
    // 如果启用了自动重启，记录错误但不退出
    if (values['auto-restart']) {
      console.log("⏰ 将在2秒后尝试重启...");
      setTimeout(() => startServers(), 2000);
    } else {
      process.exit(1);
    }
  }
}

// 当作为CLI工具直接执行时，启动所有服务器
if (require.main === module) {
  console.log("以CLI模式执行，准备启动服务器...");
  startServers().catch(error => {
    console.error("启动服务器时发生错误:", error);
  });
}