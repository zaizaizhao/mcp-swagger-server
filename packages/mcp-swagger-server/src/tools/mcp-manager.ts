#!/usr/bin/env node

import { MCPServerManager, RestartConfig } from './MCPServerManager';
import { parseArgs } from 'node:util';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

// 解析命令行参数
const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    config: {
      type: 'string',
      short: 'c',
      default: 'mcp-config.json'
    },
    port: {
      type: 'string',
      short: 'p',
      default: '3322'
    },
    transport: {
      type: 'string',
      short: 't',
      default: 'sse'
    },
    endpoint: {
      type: 'string',
      short: 'e',
      default: '/sse'
    },
    'max-retries': {
      type: 'string',
      default: '5'
    },
    'retry-delay': {
      type: 'string',
      default: '1000'
    },
    'health-check': {
      type: 'string',
      default: '30000'
    },
    'memory-limit': {
      type: 'string',
      default: '512'
    },
    'log-level': {
      type: 'string',
      default: 'info'
    },
    daemon: {
      type: 'boolean',
      short: 'd',
      default: false
    },
    help: {
      type: 'boolean',
      short: 'h',
      default: false
    }
  },
  allowPositionals: true
});

const command = positionals[0] || 'start';

if (values.help) {
  console.log(`
MCP Server Manager - 可重启的 MCP 服务器管理工具

用法: mcp-manager [command] [options]

命令:
  start     启动 MCP 服务器 (默认)
  stop      停止 MCP 服务器
  restart   重启 MCP 服务器
  status    显示服务器状态
  logs      显示服务器日志

选项:
  -c, --config <file>        配置文件路径 (默认: mcp-config.json)
  -p, --port <port>          服务器端口 (默认: 3322)
  -t, --transport <type>     传输协议: stdio, sse, streamable (默认: sse)
  -e, --endpoint <path>      端点路径 (默认: /sse)
  --max-retries <num>        最大重试次数 (默认: 5)
  --retry-delay <ms>         重试延迟毫秒 (默认: 1000)
  --health-check <ms>        健康检查间隔毫秒 (默认: 30000)
  --memory-limit <mb>        内存限制MB (默认: 512)
  --log-level <level>        日志级别: debug, info, warn, error (默认: info)
  -d, --daemon               后台运行模式
  -h, --help                 显示帮助信息

示例:
  # 启动基本的 MCP 服务器
  mcp-manager start

  # 使用自定义配置启动
  mcp-manager start -p 8080 -t streamable --memory-limit 1024

  # 后台运行
  mcp-manager start --daemon

  # 重启服务器
  mcp-manager restart

  # 查看状态
  mcp-manager status
  `);
  process.exit(0);
}

// 加载配置文件
function loadConfig(): Partial<RestartConfig> {
  const configPath = values.config!;
  if (existsSync(configPath)) {
    try {
      const configData = readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.warn(`警告: 无法加载配置文件 ${configPath}: ${error}`);
    }
  }
  return {};
}

// 创建配置
function createConfig(): RestartConfig {
  const fileConfig = loadConfig();
  
  return {
    maxRetries: parseInt(values['max-retries']! as string),
    retryDelay: parseInt(values['retry-delay']! as string),
    backoffMultiplier: 1.5,
    maxRetryDelay: 30000,
    healthCheckInterval: parseInt(values['health-check']! as string),
    healthCheckTimeout: 5000,
    autoRestart: true,
    restartOnError: true,
    restartOnExit: true,
    restartOnMemoryLimit: parseInt(values['memory-limit']! as string),
    logLevel: values['log-level'] as any || 'info',
    logToFile: true,
    logFilePath: join(process.cwd(), 'mcp-server.log'),
    ...fileConfig
  };
}

// 获取 PID 文件路径
function getPidFilePath(): string {
  return join(process.cwd(), 'mcp-server.pid');
}

// 检查服务器是否运行
function isServerRunning(): { running: boolean; pid?: number } {
  const pidFile = getPidFilePath();
  if (!existsSync(pidFile)) {
    return { running: false };
  }

  try {
    const pid = parseInt(readFileSync(pidFile, 'utf8').trim());
    // 检查进程是否还存在
    process.kill(pid, 0);
    return { running: true, pid };
  } catch (error) {
    // 进程不存在，删除过期的 PID 文件
    try {
      require('fs').unlinkSync(pidFile);
    } catch (e) {
      // 忽略删除错误
    }
    return { running: false };
  }
}

// 主要执行逻辑
async function main() {
  const config = createConfig();
  // 修复文件路径 - 确保使用编译后的文件
  const serverScript = join(__dirname, '../../dist/index.js');
  const serverArgs = [
    '--transport', values.transport!,
    '--port', values.port!,
    '--endpoint', values.endpoint!
  ];

  console.log(`MCP Server Manager - 执行命令: ${command}`);

  switch (command) {
    case 'start': {
      const status = isServerRunning();
      if (status.running) {
        console.log(`服务器已在运行中 (PID: ${status.pid})`);
        process.exit(1);
      }

      const manager = new MCPServerManager(serverScript, serverArgs, config);
      
      // 设置事件监听
      manager.on('started', (stats) => {
        console.log(`✅ MCP 服务器已启动 (PID: ${stats.processId})`);
        console.log(`📡 传输协议: ${values.transport}`);
        console.log(`🔗 端口: ${values.port}`);
        console.log(`📝 日志文件: ${config.logFilePath}`);
      });

      manager.on('restarted', ({ reason, restartCount }) => {
        console.log(`🔄 服务器已重启 (第${restartCount}次) - 原因: ${reason}`);
      });

      manager.on('error', (error) => {
        console.error(`❌ 服务器错误: ${error}`);
      });

      manager.on('maxRetriesReached', () => {
        console.error(`⚠️ 达到最大重试次数 (${config.maxRetries})，停止自动重启`);
        process.exit(1);
      });

      try {
        await manager.start();
        
        if (values.daemon) {
          console.log('🚀 服务器已在后台启动');
          process.exit(0);
        } else {
          console.log('🚀 服务器已启动，按 Ctrl+C 停止');
          // 保持进程运行
          process.stdin.resume();
        }
      } catch (error) {
        console.error(`❌ 启动失败: ${error}`);
        process.exit(1);
      }
      break;
    }

    case 'stop': {
      const status = isServerRunning();
      if (!status.running) {
        console.log('服务器未运行');
        process.exit(0);
      }

      try {
        process.kill(status.pid!, 'SIGTERM');
        console.log(`✅ 已发送停止信号到进程 ${status.pid}`);
        
        // 等待进程退出
        let attempts = 0;
        const maxAttempts = 10;
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const newStatus = isServerRunning();
          if (!newStatus.running) {
            console.log('✅ 服务器已停止');
            process.exit(0);
          }
          attempts++;
        }
        
        // 强制终止
        console.log('⚠️ 强制终止服务器进程');
        process.kill(status.pid!, 'SIGKILL');
        console.log('✅ 服务器已强制停止');
        
      } catch (error) {
        console.error(`❌ 停止失败: ${error}`);
        process.exit(1);
      }
      break;
    }

    case 'restart': {
      const status = isServerRunning();
      if (status.running) {
        console.log(`🔄 重启服务器 (PID: ${status.pid})`);
        try {
          process.kill(status.pid!, 'SIGTERM');
          // 等待停止
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.warn(`警告: 停止进程时出错: ${error}`);
        }
      }

      // 启动新服务器
      const manager = new MCPServerManager(serverScript, serverArgs, config);
      
      manager.on('started', (stats) => {
        console.log(`✅ 服务器已重启 (PID: ${stats.processId})`);
        if (!values.daemon) {
          console.log('🚀 服务器已启动，按 Ctrl+C 停止');
        }
      });

      try {
        await manager.start();
        if (values.daemon) {
          process.exit(0);
        } else {
          process.stdin.resume();
        }
      } catch (error) {
        console.error(`❌ 重启失败: ${error}`);
        process.exit(1);
      }
      break;
    }

    case 'status': {
      const status = isServerRunning();
      
      console.log('📊 MCP 服务器状态:');
      console.log(`状态: ${status.running ? '🟢 运行中' : '🔴 已停止'}`);
      
      if (status.running) {
        console.log(`PID: ${status.pid}`);
        
        // 尝试读取统计信息
        const statsFile = join(process.cwd(), 'mcp-server-stats.json');
        if (existsSync(statsFile)) {
          try {
            const statsData = readFileSync(statsFile, 'utf8');
            const stats = JSON.parse(statsData);
            console.log(`启动时间: ${new Date(stats.startTime).toLocaleString()}`);
            console.log(`重启次数: ${stats.restartCount}`);
            if (stats.lastRestartTime) {
              console.log(`最后重启: ${new Date(stats.lastRestartTime).toLocaleString()}`);
              console.log(`重启原因: ${stats.lastRestartReason || '未知'}`);
            }
            if (stats.memoryUsage) {
              const memMB = (stats.memoryUsage.rss / 1024 / 1024).toFixed(2);
              console.log(`内存使用: ${memMB} MB`);
            }
          } catch (error) {
            console.warn('无法读取统计信息');
          }
        }
      }
      
      console.log(`配置文件: ${values.config}`);
      console.log(`传输协议: ${values.transport}`);
      console.log(`端口: ${values.port}`);
      console.log(`端点: ${values.endpoint}`);
      console.log(`最大重试: ${values['max-retries']}`);
      console.log(`内存限制: ${values['memory-limit']} MB`);
      break;
    }

    case 'logs': {
      const logFile = join(process.cwd(), 'mcp-server.log');
      if (existsSync(logFile)) {
        try {
          const logs = readFileSync(logFile, 'utf8');
          const lines = logs.split('\n').slice(-50); // 显示最后50行
          console.log('📝 服务器日志 (最后50行):');
          console.log('─'.repeat(80));
          console.log(lines.join('\n'));
        } catch (error) {
          console.error(`❌ 读取日志失败: ${error}`);
        }
      } else {
        console.log('📝 日志文件不存在');
      }
      break;
    }

    default:
      console.error(`❌ 未知命令: ${command}`);
      console.log('使用 --help 查看可用命令');
      process.exit(1);
  }
}

// 运行主程序
if (require.main === module) {
  main().catch(error => {
    console.error(`❌ 执行失败: ${error}`);
    process.exit(1);
  });
}

export { MCPServerManager };
