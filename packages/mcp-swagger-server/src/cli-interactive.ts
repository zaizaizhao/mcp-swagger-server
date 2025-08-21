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

      // OpenAPI 相关选项
      case '--openapi':
        if (nextArg && !nextArg.startsWith('-')) {
          options.openapi = nextArg;
          i++;
        }
        break;

      case '--watch':
        options.watch = true;
        break;

      case '--endpoint':
        if (nextArg && !nextArg.startsWith('-')) {
          options.endpoint = nextArg;
          i++;
        }
        break;

      case '--managed':
        options.managed = true;
        break;

      // 认证选项
      case '--auth-type':
        if (nextArg && !nextArg.startsWith('-')) {
          options['auth-type'] = nextArg;
          i++;
        }
        break;

      case '--bearer-token':
        if (nextArg && !nextArg.startsWith('-')) {
          options['bearer-token'] = nextArg;
          i++;
        }
        break;

      case '--bearer-env':
        if (nextArg && !nextArg.startsWith('-')) {
          options['bearer-env'] = nextArg;
          i++;
        }
        break;

      // 自定义请求头选项
      case '--custom-header':
        if (nextArg && !nextArg.startsWith('-')) {
          if (!options['custom-header']) {
            options['custom-header'] = [];
          }
          options['custom-header'].push(nextArg);
          i++;
        }
        break;

      case '--custom-headers-config':
        if (nextArg && !nextArg.startsWith('-')) {
          options['custom-headers-config'] = nextArg;
          i++;
        }
        break;

      case '--custom-header-env':
        if (nextArg && !nextArg.startsWith('-')) {
          if (!options['custom-header-env']) {
            options['custom-header-env'] = [];
          }
          options['custom-header-env'].push(nextArg);
          i++;
        }
        break;

      case '--debug-headers':
        options['debug-headers'] = true;
        break;

      // 操作过滤选项
      case '--operation-filter-methods':
        if (nextArg && !nextArg.startsWith('-')) {
          if (!options['operation-filter-methods']) {
            options['operation-filter-methods'] = [];
          }
          options['operation-filter-methods'].push(...nextArg.split(','));
          i++;
        }
        break;

      case '--operation-filter-paths':
        if (nextArg && !nextArg.startsWith('-')) {
          if (!options['operation-filter-paths']) {
            options['operation-filter-paths'] = [];
          }
          options['operation-filter-paths'].push(...nextArg.split(','));
          i++;
        }
        break;

      case '--operation-filter-operation-ids':
        if (nextArg && !nextArg.startsWith('-')) {
          if (!options['operation-filter-operation-ids']) {
            options['operation-filter-operation-ids'] = [];
          }
          options['operation-filter-operation-ids'].push(...nextArg.split(','));
          i++;
        }
        break;

      case '--operation-filter-status-codes':
        if (nextArg && !nextArg.startsWith('-')) {
          if (!options['operation-filter-status-codes']) {
            options['operation-filter-status-codes'] = [];
          }
          options['operation-filter-status-codes'].push(...nextArg.split(','));
          i++;
        }
        break;

      case '--operation-filter-parameters':
        if (nextArg && !nextArg.startsWith('-')) {
          if (!options['operation-filter-parameters']) {
            options['operation-filter-parameters'] = [];
          }
          options['operation-filter-parameters'].push(...nextArg.split(','));
          i++;
        }
        break;

      // 高级选项
      case '--auto-restart':
        options['auto-restart'] = true;
        break;

      case '--max-retries':
        if (nextArg && !nextArg.startsWith('-')) {
          options['max-retries'] = nextArg;
          i++;
        }
        break;

      case '--retry-delay':
        if (nextArg && !nextArg.startsWith('-')) {
          options['retry-delay'] = nextArg;
          i++;
        }
        break;

      case '--env':
        if (nextArg && !nextArg.startsWith('-')) {
          options.env = nextArg;
          i++;
        }
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