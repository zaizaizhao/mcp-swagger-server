#!/usr/bin/env node

import { runSseServer, runStdioServer, runStreamableServer, createMcpServer } from './server';
import { parseArgs } from 'node:util';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

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

// 显示帮助信息 - 重新设计的专业版本
function showHelp() {
  CliDesign.showHeader('MCP SWAGGER SERVER');
  
  console.log(CliDesign.brand.muted('  Transform OpenAPI specifications into MCP format for AI assistants'));
  
  console.log(CliDesign.section('🚀 用法'));
  console.log(CliDesign.brand.info('  mcp-swagger-server') + CliDesign.brand.muted(' [选项]'));
  
  console.log(CliDesign.section('⚙️  配置选项'));
  console.log(CliDesign.option('-t, --transport <type>', '传输协议 (stdio|http|sse|streamable)', 'stdio'));
  console.log(CliDesign.option('-p, --port <port>', '服务器端口号', '3322'));
  console.log(CliDesign.option('-e, --endpoint <path>', '自定义端点路径'));
  console.log(CliDesign.option('-o, --openapi <source>', 'OpenAPI 数据源 (URL 或文件路径)'));
  
  console.log(CliDesign.section('🔧 高级选项'));
  console.log(CliDesign.option('-w, --watch', '监控文件变化并自动重载', 'false'));
  console.log(CliDesign.option('-m, --managed', '启用托管模式 (进程管理)', 'false'));
  console.log(CliDesign.option('--auto-restart', '自动重启服务器', 'false'));
  console.log(CliDesign.option('--max-retries <num>', '最大重试次数', '5'));
  console.log(CliDesign.option('--retry-delay <ms>', '重试延迟 (毫秒)', '5000'));
  console.log(CliDesign.option('-h, --help', '显示此帮助信息'));

  console.log(CliDesign.section('💡 使用示例'));
  console.log(CliDesign.example(
    'mcp-swagger-server -t stdio -o https://petstore.swagger.io/v2/swagger.json',
    'STDIO 模式 - 适合 AI 客户端集成'
  ));
  console.log();
  console.log(CliDesign.example(
    'mcp-swagger-server -t http -p 3322 -o https://api.github.com/openapi.json',
    'HTTP 服务器模式 - 适合 Web 应用'
  ));
  console.log();
  console.log(CliDesign.example(
    'mcp-swagger-server -t sse -p 3323 -o ./openapi.yaml -w',
    'SSE 模式 + 文件监控 - 适合开发环境'
  ));
  console.log();
  console.log(CliDesign.example(
    'mcp-swagger-server -t streamable -o ./api.json --auto-restart',
    'Streamable 模式 + 自动重启 - 生产环境'
  ));

  console.log(CliDesign.section('🌍 环境变量'));
  console.log(CliDesign.tableRow([
    CliDesign.brand.secondary('MCP_PORT'),
    CliDesign.brand.white('默认端口号'),
    CliDesign.brand.muted('3322')
  ]));
  console.log(CliDesign.tableRow([
    CliDesign.brand.secondary('MCP_TRANSPORT'),
    CliDesign.brand.white('默认传输协议'),
    CliDesign.brand.muted('stdio')
  ]));
  console.log(CliDesign.tableRow([
    CliDesign.brand.secondary('MCP_OPENAPI_URL'),
    CliDesign.brand.white('默认 OpenAPI URL'),
    CliDesign.brand.muted('-')
  ]));
  console.log(CliDesign.tableRow([
    CliDesign.brand.secondary('MCP_AUTO_RELOAD'),
    CliDesign.brand.white('启用自动重载'),
    CliDesign.brand.muted('false')
  ]));

  console.log(CliDesign.section('📞 支持'));
  console.log('  ' + CliDesign.brand.muted('GitHub: ') + CliDesign.brand.info('https://github.com/zaizaizhao/mcp-swagger-server'));
  console.log('  ' + CliDesign.brand.muted('文档: ') + CliDesign.brand.info('https://github.com/zaizaizhao/mcp-swagger-server'));
  
  console.log('\n' + CliDesign.separator('═', 60));
  console.log(CliDesign.brand.primary.bold('  感谢使用 MCP Swagger Server！'));
  console.log(CliDesign.separator('═', 60) + '\n');
}

function isUrl(str: string): boolean {
  const urlPattern = /^(http|https):\/\/[^ "]+$/;
  return urlPattern.test(str);
}

// 加载 OpenAPI 数据 - 增强的视觉反馈
async function loadOpenAPIData(source: string): Promise<any> {
  try {
    if (isUrl(source)) {
      // 从 URL 加载
      console.log(CliDesign.loading(`正在从远程 URL 加载 OpenAPI 规范...`));
      console.log(CliDesign.brand.muted(`  📡 ${source}`));
      const response = await axios.get(source);
      console.log(CliDesign.success('远程 OpenAPI 规范加载成功'));
      return response.data;
    } else {
      // 从文件加载
      console.log(CliDesign.loading(`正在从本地文件加载 OpenAPI 规范...`));
      const filePath = path.resolve(source);
      console.log(CliDesign.brand.muted(`  📁 ${filePath}`));
      const content = fs.readFileSync(filePath, 'utf-8');
      
      let data;
      if (source.endsWith('.yaml') || source.endsWith('.yml')) {
        console.log(CliDesign.brand.muted('  🔄 解析 YAML 格式...'));
        const yaml = await import('js-yaml');
        data = yaml.load(content);
      } else {
        console.log(CliDesign.brand.muted('  🔄 解析 JSON 格式...'));
        data = JSON.parse(content);
      }
      
      console.log(CliDesign.success('本地 OpenAPI 规范加载成功'));
      return data;
    }
  } catch (error: any) {
    console.log(CliDesign.error(`加载 OpenAPI 规范失败: ${error.message}`));
    console.log(CliDesign.brand.muted(`  源: ${source}`));
    throw error;
  }
}

// 文件监控 - 优雅的状态提示
function watchOpenAPIFile(filePath: string, callback: () => void) {
  if (!isUrl(filePath)) {
    const resolvedPath = path.resolve(filePath);
    console.log(CliDesign.info('文件监控已启用'));
    console.log(CliDesign.brand.muted(`  👁️  监控文件: ${resolvedPath}`));
    console.log(CliDesign.brand.muted(`  🔄 检查间隔: 1 秒`));
    
    fs.watchFile(resolvedPath, { interval: 1000 }, (curr, prev) => {
      if (curr.mtime > prev.mtime) {
        console.log('\n' + CliDesign.warning('检测到文件变化！'));
        console.log(CliDesign.brand.muted(`  � ${new Date().toLocaleTimeString()}: ${path.basename(filePath)} 已更新`));
        console.log(CliDesign.loading('正在重启服务器...'));
        callback();
      }
    });
  }
}

// 🎨 CLI Design System - 专业的视觉设计工具
class CliDesign {
  // 品牌颜色方案
  static readonly brand = {
    primary: chalk.hex('#00D4FF'),      // 明亮的青色 - 科技感
    secondary: chalk.hex('#FF6B6B'),    // 温暖的红色 - 活力
    success: chalk.hex('#4ECDC4'),      // 薄荷绿 - 成功
    warning: chalk.hex('#FFE66D'),      // 金黄色 - 警告
    error: chalk.hex('#FF6B6B'),        // 红色 - 错误
    info: chalk.hex('#A8E6CF'),         // 淡绿色 - 信息
    muted: chalk.hex('#95A5A6'),        // 灰色 - 次要信息
    white: chalk.white,
    bold: chalk.bold,
  };

  // 渐变色效果 (手动实现)
  static gradient(text: string, colors: string[] = ['#00D4FF', '#4ECDC4']): string {
    const chars = text.split('');
    const step = (colors.length - 1) / (chars.length - 1);
    
    return chars.map((char, i) => {
      const colorIndex = Math.floor(i * step);
      const nextColorIndex = Math.min(colorIndex + 1, colors.length - 1);
      return chalk.hex(colors[colorIndex])(char);
    }).join('');
  }

  // 创建标题横幅
  static banner(title: string): string {
    const width = 60;
    const titleLength = title.length;
    const padding = Math.max(0, Math.floor((width - titleLength - 4) / 2));
    
    const line = this.brand.primary('═'.repeat(width));
    const emptyLine = this.brand.primary('║') + ' '.repeat(width - 2) + this.brand.primary('║');
    const titleLine = this.brand.primary('║') + ' '.repeat(padding) + 
                     this.brand.bold.white(title) + 
                     ' '.repeat(width - titleLength - padding - 2) + this.brand.primary('║');

    return [
      line,
      emptyLine,
      titleLine,
      emptyLine,
      line
    ].join('\n');
  }

  // 创建分组标题
  static section(title: string): string {
    return '\n' + this.brand.primary.bold(`▶ ${title}`) + '\n' + this.brand.muted('─'.repeat(title.length + 2));
  }

  // 创建选项显示
  static option(flag: string, description: string, defaultValue?: string): string {
    const flagFormatted = this.brand.secondary.bold(flag.padEnd(20));
    const desc = this.brand.white(description);
    const def = defaultValue ? this.brand.muted(` [默认: ${defaultValue}]`) : '';
    return `  ${flagFormatted} ${desc}${def}`;
  }

  // 创建示例显示
  static example(command: string, description: string): string {
    return `  ${this.brand.success('$')} ${this.brand.info(command)}\n  ${this.brand.muted('  ' + description)}`;
  }

  // 状态消息
  static success(message: string): string {
    return this.brand.success('✓') + ' ' + this.brand.white(message);
  }

  static error(message: string): string {
    return this.brand.error('✗') + ' ' + this.brand.white(message);
  }

  static warning(message: string): string {
    return this.brand.warning('⚠') + ' ' + this.brand.white(message);
  }

  static info(message: string): string {
    return this.brand.info('ℹ') + ' ' + this.brand.white(message);
  }

  static loading(message: string): string {
    return this.brand.primary('◯') + ' ' + this.brand.white(message);
  }

  // 进度指示器
  static progress(current: number, total: number, label: string = ''): string {
    const percentage = Math.round((current / total) * 100);
    const barLength = 20;
    const filledLength = Math.round((current / total) * barLength);
    
    const filled = this.brand.success('█'.repeat(filledLength));
    const empty = this.brand.muted('░'.repeat(barLength - filledLength));
    const percent = this.brand.bold.white(`${percentage}%`);
    const labelText = label ? this.brand.muted(` ${label}`) : '';
    
    return `${filled}${empty} ${percent}${labelText}`;
  }

  // 创建表格行
  static tableRow(items: string[], colors: ((text: string) => string)[] = []): string {
    return items.map((item, i) => {
      const color = colors[i] || this.brand.white;
      return color(item.padEnd(20));
    }).join(' ');
  }

  // 清屏并显示标题
  static showHeader(title: string): void {
    console.clear();
    console.log(this.banner(title));
  }

  // 创建分隔线
  static separator(char: string = '─', length: number = 50): string {
    return this.brand.muted(char.repeat(length));
  }
}

// 主启动函数 - 专业的视觉体验
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

  // 显示启动横幅
  CliDesign.showHeader('MCP SWAGGER SERVER');
  console.log(CliDesign.brand.primary.bold('  🚀 正在启动服务器...'));
  console.log();

  // 显示配置信息
  console.log(CliDesign.section('📋 服务器配置'));
  console.log(CliDesign.tableRow([
    CliDesign.brand.secondary('传输协议:'),
    CliDesign.brand.white(transport.toUpperCase()),
    CliDesign.brand.muted(getTransportDescription(transport))
  ]));
  console.log(CliDesign.tableRow([
    CliDesign.brand.secondary('端口号:'),
    CliDesign.brand.white(port.toString()),
    CliDesign.brand.muted(transport === 'stdio' ? '(STDIO 模式不使用端口)' : '')
  ]));
  console.log(CliDesign.tableRow([
    CliDesign.brand.secondary('数据源:'),
    CliDesign.brand.white(openApiSource || '未指定'),
    CliDesign.brand.muted(openApiSource ? (isUrl(openApiSource) ? '远程 URL' : '本地文件') : '')
  ]));
  console.log(CliDesign.tableRow([
    CliDesign.brand.secondary('文件监控:'),
    CliDesign.brand.white(autoReload ? '启用' : '禁用'),
    CliDesign.brand.muted(autoReload && openApiSource && !isUrl(openApiSource) ? '将监控文件变化' : '')
  ]));
  
  console.log();

  // 获取传输协议描述
  function getTransportDescription(transport: string): string {
    switch (transport.toLowerCase()) {
      case 'stdio': return 'AI 客户端集成';
      case 'http':
      case 'streamable': return 'Web 应用集成';
      case 'sse': return '实时 Web 应用';
      default: return '';
    }
  }

  // 启动服务器的函数 - 增强的状态反馈
  async function startServer() {
    try {
      let openApiData = null;
      
      // 加载 OpenAPI 数据
      if (openApiSource) {
        console.log(CliDesign.section('📡 加载 OpenAPI 规范'));
        openApiData = await loadOpenAPIData(openApiSource);
        
        // 显示 API 基本信息
        if (openApiData) {
          console.log();
          console.log(CliDesign.brand.muted('  API 信息:'));
          if (openApiData.info?.title) {
            console.log(CliDesign.brand.muted(`  📝 标题: ${openApiData.info.title}`));
          }
          if (openApiData.info?.version) {
            console.log(CliDesign.brand.muted(`  🔖 版本: ${openApiData.info.version}`));
          }
          if (openApiData.paths) {
            const pathCount = Object.keys(openApiData.paths).length;
            console.log(CliDesign.brand.muted(`  🛣️  路径: ${pathCount} 个端点`));
          }
        }
      } else {
        console.log(CliDesign.warning('未指定 OpenAPI 数据源，服务器将以基础模式运行'));
      }

      console.log(CliDesign.section('🚀 启动服务器'));

      // 根据传输协议启动服务器
      switch (transport.toLowerCase()) {
        case 'stdio':
          console.log(CliDesign.loading('正在启动 STDIO 服务器...'));
          console.log(CliDesign.brand.muted('  💬 适用于 AI 客户端集成（如 Claude Desktop）'));
          await runStdioServer(openApiData);
          break;

        case 'http':
        case 'streamable':
          console.log(CliDesign.loading(`正在启动 HTTP 服务器...`));
          const streamEndpoint = options.endpoint || '/mcp';
          const httpUrl = `http://localhost:${port}${streamEndpoint}`;
          console.log(CliDesign.brand.muted(`  🌐 服务器地址: ${httpUrl}`));
          console.log(CliDesign.brand.muted('  🔗 适用于 Web 应用集成'));
          await runStreamableServer(streamEndpoint, port, openApiData);
          break;

        case 'sse':
          console.log(CliDesign.loading(`正在启动 SSE 服务器...`));
          const sseEndpoint = options.endpoint || '/sse';
          const sseUrl = `http://localhost:${port}${sseEndpoint}`;
          console.log(CliDesign.brand.muted(`  📡 SSE 端点: ${sseUrl}`));
          console.log(CliDesign.brand.muted('  ⚡ 适用于实时 Web 应用'));
          await runSseServer(sseEndpoint, port, openApiData);
          break;

        default:
          throw new Error(`不支持的传输协议: ${transport}`);
      }

      // 服务器启动成功
      console.log();
      console.log(CliDesign.separator('═', 60));
      console.log(CliDesign.success('MCP Swagger Server 启动成功！'));
      
      if (transport !== 'stdio') {
        const serverUrl = `http://localhost:${port}${options.endpoint || (transport === 'sse' ? '/sse' : '/mcp')}`;
        console.log(CliDesign.brand.muted(`  � 服务器运行在: ${serverUrl}`));
      }
      
      console.log(CliDesign.brand.muted('  💡 按 Ctrl+C 停止服务器'));
      console.log(CliDesign.separator('═', 60));
      
      // 设置文件监控
      if (autoReload && openApiSource && !isUrl(openApiSource)) {
        console.log();
        watchOpenAPIFile(openApiSource, () => {
          console.log(CliDesign.brand.warning('🔄 因文件变化而重启服务器...'));
          process.exit(0); // 简单重启
        });
      }

    } catch (error: any) {
      console.log();
      console.log(CliDesign.error(`服务器启动失败: ${error.message}`));
      
      if (options.autoRestart) {
        const retryDelay = parseInt(options.retryDelay || '5000');
        const maxRetries = parseInt(options.maxRetries || '5');
        
        console.log(CliDesign.warning(`自动重启已启用，${retryDelay}ms 后重试...`));
        console.log(CliDesign.brand.muted(`  🔄 最大重试次数: ${maxRetries}`));
        setTimeout(startServer, retryDelay);
      } else {
        console.log(CliDesign.brand.muted('  💡 提示: 使用 --auto-restart 启用自动重启'));
        process.exit(1);
      }
    }
  }

  // 处理优雅关闭 - 专业的退出提示
  process.on('SIGTERM', () => {
    console.log('\n' + CliDesign.warning('收到 SIGTERM 信号，正在优雅关闭服务器...'));
    console.log(CliDesign.brand.muted('  🛑 清理资源并退出'));
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('\n' + CliDesign.warning('收到中断信号 (Ctrl+C)，正在关闭服务器...'));
    console.log(CliDesign.brand.muted('  👋 感谢使用 MCP Swagger Server'));
    process.exit(0);
  });

  // 启动服务器
  await startServer();
}

// 如果直接运行此文件，则启动服务器
if (require.main === module) {
  main().catch(error => {
    console.log();
    console.log(CliDesign.error(`严重错误: ${error.message}`));
    console.log(CliDesign.brand.muted('  💥 服务器无法启动'));
    
    if (error.stack) {
      console.log(CliDesign.brand.muted('  📋 错误堆栈:'));
      console.log(CliDesign.brand.muted(error.stack.split('\n').slice(0, 5).join('\n')));
    }
    
    console.log();
    console.log(CliDesign.brand.muted('  💡 提示: 使用 --help 查看使用说明'));
    process.exit(1);
  });
}
