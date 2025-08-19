#!/usr/bin/env node

import { InteractiveCLI } from './interactive-cli';
import { CLIOptions } from './interactive-cli/types';

/**
 * 交互式 CLI 入口点
 * 负责启动和管理交互式命令行界面
 */
async function main() {
  // 设置环境变量
  if (process.env.NODE_ENV !== 'production') {
    process.env.DEBUG = process.env.DEBUG || 'mcp-swagger:*';
  }

  // 设置日志级别
  process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'info';

  try {
    // 解析命令行参数
    const options: CLIOptions = parseCommandLineArgs();

    // 创建并启动交互式 CLI
    const cli = new InteractiveCLI(options);
    await cli.start();
  } catch (error) {
    console.error('❌ 启动交互式 CLI 时出错:', error);
    process.exit(1);
  }
}

/**
 * 解析命令行参数
 */
function parseCommandLineArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--config':
      case '-c':
        if (nextArg && !nextArg.startsWith('-')) {
          options.config = nextArg;
          i++;
        }
        break;

      case '--port':
      case '-p':
        if (nextArg && !nextArg.startsWith('-')) {
          const port = parseInt(nextArg, 10);
          if (!isNaN(port) && port > 0 && port <= 65535) {
            options.port = port;
          }
          i++;
        }
        break;

      case '--host':
      case '-h':
        if (nextArg && !nextArg.startsWith('-')) {
          options.host = nextArg;
          i++;
        }
        break;

      case '--transport':
      case '-t':
        if (nextArg && ['stdio', 'sse', 'streamable'].includes(nextArg)) {
          options.transport = nextArg as 'stdio' | 'sse' | 'streamable';
          i++;
        }
        break;

      case '--verbose':
      case '-v':
        options.verbose = true;
        break;

      case '--quiet':
      case '-q':
        options.quiet = true;
        break;

      case '--debug':
      case '-d':
        options.debug = true;
        process.env.DEBUG = 'mcp-swagger:*';
        process.env.LOG_LEVEL = 'debug';
        break;

      case '--help':
        showHelp();
        process.exit(0);
        break;

      case '--version':
        showVersion();
        process.exit(0);
        break;
    }
  }

  return options;
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
🚀 MCP Swagger Server - 交互式 CLI

用法:
  mcp-swagger-interactive [选项]

选项:
  -c, --config <path>     指定配置文件路径
  -p, --port <number>     指定服务器端口 (1-65535)
  -h, --host <address>    指定服务器主机地址
  -t, --transport <type>  指定传输协议 (stdio|sse|streamable)
  -v, --verbose           启用详细输出
  -q, --quiet             启用静默模式
  -d, --debug             启用调试模式
  --help                  显示此帮助信息
  --version               显示版本信息

示例:
  mcp-swagger-interactive
  mcp-swagger-interactive --port 3000 --transport sse
  mcp-swagger-interactive --config ./my-config.json --debug

更多信息请访问: https://github.com/your-repo/mcp-swagger-server
`);
}

/**
 * 显示版本信息
 */
function showVersion() {
  try {
    const packageJson = require('../package.json');
    console.log(`MCP Swagger Server v${packageJson.version}`);
  } catch {
    console.log('MCP Swagger Server (版本信息不可用)');
  }
}

/**
 * 处理未捕获的异常
 */
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  process.exit(1);
});

/**
 * 处理未处理的 Promise 拒绝
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的 Promise 拒绝:', reason);
  console.error('Promise:', promise);
  process.exit(1);
});

/**
 * 处理进程信号
 */
process.on('SIGINT', async () => {
  console.log('\n👋 收到中断信号，正在优雅关闭...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n👋 收到终止信号，正在优雅关闭...');
  process.exit(0);
});

// 启动应用
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 应用启动失败:', error);
    process.exit(1);
  });
}

export { main };