#!/usr/bin/env node

import { runSseServer, runStdioServer, runStreamableServer, createMcpServer } from './server';
import { parseArgs } from 'node:util';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { AuthConfig } from 'mcp-swagger-parser';

// 导出主要API和类型
export { createMcpServer, runSseServer, runStdioServer, runStreamableServer } from './server';

// 导出核心层
export * from './core';

// 导出类型
export * from './types';

// 导出适配器层
export * from './adapters/CLIAdapter';
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
  // Bearer Token 认证选项
  authType?: string;
  bearerToken?: string;
  bearerEnv?: string;
  config?: string; // 配置文件路径
  env?: string; // .env 文件路径
  // 自定义请求头选项
  customHeaders?: string[];        // --custom-header "Key=Value"
  customHeadersConfig?: string;    // --custom-headers-config headers.json
  customHeadersEnv?: string[];     // --custom-header-env "X-Client-ID=CLIENT_ID"
  debugHeaders?: boolean;          // --debug-headers
}

// 解析命令行参数
const { values, positionals } = parseArgs({
  options: {
    transport: {
      type: "string",
      short: "t",
    },
    port: {
      type: "string",
      short: "p",
    },
    endpoint: {
      type: "string",
      short: "e",
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
    },
    "retry-delay": {
      type: "string",
    },
    openapi: {
      type: "string",
      short: "o",
    },
    watch: {
      type: "boolean",
      short: "w",
      default: false,
    },
    // Bearer Token 认证参数
    "auth-type": {
      type: "string",
    },
    "bearer-token": {
      type: "string",
    },
    "bearer-env": {
      type: "string",
    },
    config: {
      type: "string",
      short: "c",
    },
    env: {
      type: "string",
    },
    // 自定义请求头选项
    "custom-header": {
      type: "string",
      multiple: true,
    },
    "custom-headers-config": {
      type: "string",
    },
    "custom-header-env": {
      type: "string",
      multiple: true,
    },
    "debug-headers": {
      type: "boolean",
      default: false,
    },
    help: {
      type: "boolean",
      short: "h",
      default: false,
    }
  },
}) as { values: ServerOptions & { help?: boolean; 'auth-type'?: string; 'bearer-token'?: string; 'bearer-env'?: string; 'auto-restart'?: boolean; 'max-retries'?: string; 'retry-delay'?: string; 'custom-header'?: string[]; 'custom-headers-config'?: string; 'custom-header-env'?: string[]; 'debug-headers'?: boolean }; positionals: string[] };

// 显示帮助信息 - 重新设计的专业版本
function showHelp() {
  CliDesign.showHeader('MCP SWAGGER SERVER');
  
  console.log(CliDesign.brand.muted('  Transform OpenAPI specifications into MCP format for AI assistants'));
  
  console.log(CliDesign.section(`${CliDesign.icons.rocket} 用法`));
  console.log(CliDesign.brand.info('  mcp-swagger-server') + CliDesign.brand.muted(' [选项]'));
  
  console.log(CliDesign.section(`${CliDesign.icons.gear} 配置选项`));
  console.log(CliDesign.option('-t, --transport <type>', '传输协议 (stdio|sse|streamable)', 'stdio'));
  console.log(CliDesign.option('-p, --port <port>', '服务器端口号', '3322'));
  console.log(CliDesign.option('-e, --endpoint <path>', '自定义端点路径'));
  console.log(CliDesign.option('-o, --openapi <source>', 'OpenAPI 数据源 (URL 或文件路径)'));
  console.log(CliDesign.option('-c, --config <file>', '配置文件路径 (JSON 格式)'));
  console.log(CliDesign.option('--env <file>', '环境变量文件路径 (.env 格式)'));
  
  console.log(CliDesign.section(`${CliDesign.icons.key} 认证选项`));
  console.log(CliDesign.option('--auth-type <type>', '认证类型 (none|bearer)', 'none'));
  console.log(CliDesign.option('--bearer-token <token>', 'Bearer Token 静态值'));
  console.log(CliDesign.option('--bearer-env <varname>', 'Bearer Token 环境变量名', 'API_TOKEN'));
  
  console.log(CliDesign.section(`${CliDesign.icons.gear} 自定义请求头选项`));
  console.log(CliDesign.option('--custom-header <header>', '自定义请求头 "Key=Value" (可重复)'));
  console.log(CliDesign.option('--custom-headers-config <file>', '自定义请求头配置文件 (JSON)'));
  console.log(CliDesign.option('--custom-header-env <header>', '环境变量请求头 "Key=VAR_NAME" (可重复)'));
  console.log(CliDesign.option('--debug-headers', '启用请求头调试模式', 'false'));
  
  console.log(CliDesign.section(`${CliDesign.icons.gear} 高级选项`));
  console.log(CliDesign.option('-w, --watch', '监控文件变化并自动重载', 'false'));
  console.log(CliDesign.option('-m, --managed', '启用托管模式 (进程管理)', 'false'));
  console.log(CliDesign.option('--auto-restart', '自动重启服务器', 'false'));
  console.log(CliDesign.option('--max-retries <num>', '最大重试次数', '5'));
  console.log(CliDesign.option('--retry-delay <ms>', '重试延迟 (毫秒)', '5000'));
  console.log(CliDesign.option('-h, --help', '显示此帮助信息'));

  console.log(CliDesign.section(`${CliDesign.icons.bulb} 使用示例`));
  console.log(CliDesign.example(
    'mcp-swagger-server -t stdio -o https://petstore.swagger.io/v2/swagger.json',
    'STDIO 模式 - 适合 AI 客户端集成'
  ));
  console.log();

  console.log(CliDesign.example(
    'mcp-swagger-server -t sse -p 3323 -o ./openapi.yaml -w',
    'SSE 模式 + 文件监控 - 适合开发环境'
  ));
  console.log();

  console.log(CliDesign.example(
    'mcp-swagger-server -o ./api.json --auth-type bearer --bearer-token "your-token"',
    'Bearer Token 静态认证'
  ));
  console.log();

  console.log(CliDesign.example(
    'mcp-swagger-server -o ./api.json --auth-type bearer --bearer-env API_TOKEN',
    'Bearer Token 环境变量认证'
  ));
  console.log();
  
  console.log(CliDesign.example(
    'mcp-swagger-server -c ./config.json',
    '使用配置文件 - 支持完整配置'
  ));

  console.log(CliDesign.example(
    'mcp-swagger-server -o ./api.json --custom-header "X-Client-ID=my-client" --custom-header-env "X-API-Key=API_KEY"',
    '自定义请求头 - 静态值与环境变量'
  ));
  console.log();

  console.log(CliDesign.example(
    'mcp-swagger-server -o ./api.json --custom-headers-config ./headers.json --debug-headers',
    '自定义请求头 - 配置文件与调试模式'
  ));

  console.log(CliDesign.section(`${CliDesign.icons.world} 环境变量`));
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
  console.log(CliDesign.tableRow([
    CliDesign.brand.secondary('API_TOKEN'),
    CliDesign.brand.white('Bearer Token'),
    CliDesign.brand.muted('用于 API 认证')
  ]));
  console.log(CliDesign.tableRow([
    CliDesign.brand.secondary('MCP_AUTH_TYPE'),
    CliDesign.brand.white('认证类型'),
    CliDesign.brand.muted('none|bearer')
  ]));

  console.log(CliDesign.section(`${CliDesign.icons.phone} 支持`));
  console.log('  ' + CliDesign.brand.muted('GitHub: ') + CliDesign.brand.info('https://github.com/zaizaizhao/mcp-swagger-server'));
  console.log('  ' + CliDesign.brand.muted('文档: ') + CliDesign.brand.info('https://github.com/zaizaizhao/mcp-swagger-server#readme'));
  
  console.log('\n' + CliDesign.separator('=', 60));
  console.log(CliDesign.brand.primary.bold('  感谢使用 MCP Swagger Server！'));
  console.log(CliDesign.separator('=', 60) + '\n');
}

function isUrl(str: string): boolean {
  const urlPattern = /^(http|https):\/\/[^ "]+$/;
  return urlPattern.test(str);
}

// 配置文件接口
interface ConfigFile {
  transport?: string;
  port?: number;
  endpoint?: string;
  openapi?: string;
  watch?: boolean;
  auth?: AuthConfig;
  managed?: boolean;
  autoRestart?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  // 新增：自定义请求头配置
  customHeaders?: {
    static?: Record<string, string>;
    env?: Record<string, string>;
    conditional?: Array<{
      condition: string;
      headers: Record<string, string>;
    }>;
  };
  // 新增：调试选项
  debugHeaders?: boolean;
}

// 加载配置文件
function loadConfigFile(configPath: string): ConfigFile {
  try {
    console.log(CliDesign.loading(`正在加载配置文件...`));
    console.log(CliDesign.brand.muted(`  ${CliDesign.icons.file} ${path.resolve(configPath)}`));
    
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    
    console.log(CliDesign.success('配置文件加载成功'));
    return config;
  } catch (error: any) {
    console.log(CliDesign.error(`加载配置文件失败: ${error.message}`));
    throw error;
  }
}

// 加载 .env 文件
function loadEnvFile(envPath: string): Record<string, string> {
  try {
    console.log(CliDesign.loading(`正在加载 .env 文件...`));
    console.log(CliDesign.brand.muted(`  ${CliDesign.icons.file} ${path.resolve(envPath)}`));
    
    const content = fs.readFileSync(envPath, 'utf-8');
    const envVars: Record<string, string> = {};
    
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        envVars[key.trim()] = value.replace(/^["']|["']$/g, ''); // 移除引号
      }
    });
    
    console.log(CliDesign.success(`.env 文件加载成功，加载了 ${Object.keys(envVars).length} 个环境变量`));
    return envVars;
  } catch (error: any) {
    console.log(CliDesign.error(`加载 .env 文件失败: ${error.message}`));
    throw error;
  }
}

// 解析认证配置
function parseAuthConfig(
  options: ServerOptions & { 'auth-type'?: string; 'bearer-token'?: string; 'bearer-env'?: string }, 
  config?: ConfigFile,
  envVars?: Record<string, string>
): AuthConfig {
  // 合并环境变量（.env 文件 + 系统环境变量）
  const mergedEnv = { ...envVars, ...process.env };
  
  // 优先级：命令行参数 > 配置文件 > .env 文件 > 系统环境变量 > 默认值
  const authType = options['auth-type'] || options.authType || config?.auth?.type || mergedEnv.MCP_AUTH_TYPE || 'none';
  
  if (authType === 'none') {
    return { type: 'none' };
  }
  
  if (authType === 'bearer') {
    let token = '';
    let source: 'static' | 'env' = 'static';
    let envName = '';
    
    if (options['bearer-token'] || options.bearerToken) {
      // 命令行直接指定token
      token = options['bearer-token'] || options.bearerToken || '';
      source = 'static';
    } else if (options['bearer-env'] || options.bearerEnv) {
      // 命令行指定环境变量
      envName = options['bearer-env'] || options.bearerEnv || '';
      source = 'env';
    } else if (config?.auth?.bearer) {
      // 配置文件
      const bearerConfig = config.auth.bearer;
      token = bearerConfig.token || '';
      source = bearerConfig.source === 'function' ? 'static' : bearerConfig.source || 'static';
      envName = bearerConfig.envName || '';
    } else {
      // 默认使用 API_TOKEN 环境变量
      envName = 'API_TOKEN';
      source = 'env';
    }
    
    return {
      type: 'bearer',
      bearer: {
        token,
        source,
        envName: envName || 'API_TOKEN'
      }
    };
  }
  
  throw new Error(`不支持的认证类型: ${authType}，支持的类型: none, bearer`);
}

// 验证认证配置
function validateAuthConfig(authConfig: AuthConfig, envVars?: Record<string, string>): void {
  if (authConfig.type === 'bearer' && authConfig.bearer) {
    const { source, token, envName } = authConfig.bearer;
    
    if (source === 'static') {
      if (!token) {
        throw new Error('Bearer Token 静态模式需要提供 token 值');
      }
    } else if (source === 'env') {
      const envVar = envName || 'API_TOKEN';
      // 合并环境变量：.env 文件 + 系统环境变量
      const mergedEnv = { ...envVars, ...process.env };
      const envValue = mergedEnv[envVar];
      if (!envValue) {
        console.log(CliDesign.warning(`环境变量 ${envVar} 未设置，Bearer Token 将在运行时无效`));
        // 不降级认证类型，只是给出警告
      }
    }
  }
}

// 设置 Windows CMD 编码支持
function setupWindowsConsole() {
  if (process.platform === 'win32') {
    try {
      // 尝试设置 UTF-8 编码
      process.stdout.write('\x1b[?25h'); // 显示光标
      
      // 检测是否支持颜色
      if (!process.env.FORCE_COLOR && !process.stdout.isTTY) {
        // 如果不是 TTY，禁用颜色
        chalk.level = 0;
      }
    } catch (error) {
      // 忽略编码设置错误
    }
  }
}

//  加载 OpenAPI 数据 - 增强的视觉反馈
async function loadOpenAPIData(source: string): Promise<any> {
  try {
    if (isUrl(source)) {
      // 从 URL 加载
      console.log(CliDesign.loading(`正在从远程 URL 加载 OpenAPI 规范...`));
      console.log(CliDesign.brand.muted(`  ${CliDesign.icons.signal} ${source}`));
      const response = await axios.get(source);
      console.log(CliDesign.success('远程 OpenAPI 规范加载成功'));
      return response.data;
    } else {
      // 从文件加载
      console.log(CliDesign.loading(`正在从本地文件加载 OpenAPI 规范...`));
      const filePath = path.resolve(source);
      console.log(CliDesign.brand.muted(`  ${CliDesign.icons.file} ${filePath}`));
      const content = fs.readFileSync(filePath, 'utf-8');
      
      let data;
      if (source.endsWith('.yaml') || source.endsWith('.yml')) {
        console.log(CliDesign.brand.muted(`  ${CliDesign.icons.process} 解析 YAML 格式...`));
        const yaml = await import('js-yaml');
        data = yaml.load(content);
      } else {
        console.log(CliDesign.brand.muted(`  ${CliDesign.icons.process} 解析 JSON 格式...`));
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
    console.log(CliDesign.brand.muted(`  ${CliDesign.icons.eye} 监控文件: ${resolvedPath}`));
    console.log(CliDesign.brand.muted(`  ${CliDesign.icons.process} 检查间隔: 1 秒`));
    
    fs.watchFile(resolvedPath, { interval: 1000 }, (curr, prev) => {
      if (curr.mtime > prev.mtime) {
        console.log('\n' + CliDesign.warning('检测到文件变化！'));
        console.log(CliDesign.brand.muted(`  ${CliDesign.icons.clock} ${new Date().toLocaleTimeString()}: ${path.basename(filePath)} 已更新`));
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

  // 图标兼容性处理
  static readonly icons = {
    // 检测是否为 Windows CMD 环境
    get isWindows() {
      return process.platform === 'win32' && !process.env.WT_SESSION;
    },

    // 根据环境选择合适的图标
    get arrow() { return this.isWindows ? '>' : '▶'; },
    get check() { return this.isWindows ? 'OK' : '✓'; },
    get cross() { return this.isWindows ? 'X' : '✗'; },
    get warning() { return this.isWindows ? '!' : '⚠'; },
    get info() { return this.isWindows ? 'i' : 'ℹ'; },
    get loading() { return this.isWindows ? 'o' : '◯'; },
    get rocket() { return this.isWindows ? '^' : '🚀'; },
    get config() { return this.isWindows ? '#' : '📋'; },
    get network() { return this.isWindows ? '@' : '📡'; },
    get file() { return this.isWindows ? 'F' : '📁'; },
    get eye() { return this.isWindows ? '*' : '👁️'; },
    get clock() { return this.isWindows ? 'T' : '🕒'; },
    get stop() { return this.isWindows ? 'X' : '🛑'; },
    get wave() { return this.isWindows ? '~' : '👋'; },
    get boom() { return this.isWindows ? '*' : '💥'; },
    get list() { return this.isWindows ? '-' : '📋'; },
    get bulb() { return this.isWindows ? '?' : '💡'; },
    get dollar() { return this.isWindows ? '$' : '$'; },
    get reload() { return this.isWindows ? 'R' : '🔄'; },
    get world() { return this.isWindows ? 'W' : '🌍'; },
    get phone() { return this.isWindows ? 'P' : '📞'; },
    get heart() { return this.isWindows ? '<3' : '❤️'; },
    get star() { return this.isWindows ? '*' : '⭐'; },
    get bug() { return this.isWindows ? 'B' : '🐛'; },
    get chat() { return this.isWindows ? 'C' : '💬'; },
    get api() { return this.isWindows ? 'A' : '🛣️'; },
    get title() { return this.isWindows ? 'T' : '📝'; },
    get version() { return this.isWindows ? 'V' : '🔖'; },
    get web() { return this.isWindows ? 'W' : '🌐'; },
    get link() { return this.isWindows ? 'L' : '🔗'; },
    get signal() { return this.isWindows ? 'S' : '📡'; },
    get bolt() { return this.isWindows ? '!' : '⚡'; },
    get gear() { return this.isWindows ? 'G' : '🔧'; },
    get process() { return this.isWindows ? 'P' : '🔄'; },
    get up() { return this.isWindows ? '^' : '🛑'; },
    get key() { return this.isWindows ? 'K' : '🔐'; },
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
    
    const line = this.brand.primary('='.repeat(width));
    const emptyLine = this.brand.primary('|') + ' '.repeat(width - 2) + this.brand.primary('|');
    const titleLine = this.brand.primary('|') + ' '.repeat(padding) + 
                     this.brand.bold.white(title) + 
                     ' '.repeat(width - titleLength - padding - 2) + this.brand.primary('|');

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
    return '\n' + this.brand.primary.bold(`${this.icons.arrow} ${title}`) + '\n' + this.brand.muted('-'.repeat(title.length + 2));
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
    return `  ${this.brand.success(this.icons.dollar)} ${this.brand.info(command)}\n  ${this.brand.muted('  ' + description)}`;
  }

  // 状态消息
  static success(message: string): string {
    return this.brand.success(this.icons.check) + ' ' + this.brand.white(message);
  }

  static error(message: string): string {
    return this.brand.error(this.icons.cross) + ' ' + this.brand.white(message);
  }

  static warning(message: string): string {
    return this.brand.warning(this.icons.warning) + ' ' + this.brand.white(message);
  }

  static info(message: string): string {
    return this.brand.info(this.icons.info) + ' ' + this.brand.white(message);
  }

  static loading(message: string): string {
    return this.brand.primary(this.icons.loading) + ' ' + this.brand.white(message);
  }

  // 进度指示器
  static progress(current: number, total: number, label: string = ''): string {
    const percentage = Math.round((current / total) * 100);
    const barLength = 20;
    const filledLength = Math.round((current / total) * barLength);
    
    const filled = this.brand.success('#'.repeat(filledLength));
    const empty = this.brand.muted('-'.repeat(barLength - filledLength));
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
  static separator(char: string = '-', length: number = 50): string {
    return this.brand.muted(char.repeat(length));
  }
}

/**
 * 解析自定义请求头配置
 */
function parseCustomHeaders(
  options: ServerOptions & { 'custom-header'?: string[], 'custom-headers-config'?: string, 'custom-header-env'?: string[] },
  config?: ConfigFile,
  envVars?: Record<string, string>
): any | undefined {
  const customHeaders: any = {};
  let hasConfig = false;

  // 1. 从配置文件读取
  if (config?.customHeaders) {
    Object.assign(customHeaders, config.customHeaders);
    hasConfig = true;
  }

  // 2. 从专用配置文件读取
  if (options['custom-headers-config']) {
    try {
      const configFile = JSON.parse(fs.readFileSync(options['custom-headers-config'], 'utf8'));
      Object.assign(customHeaders, configFile);
      hasConfig = true;
    } catch (error: any) {
      console.error(`Error loading custom headers config: ${error.message}`);
    }
  }

  // 3. 从命令行参数读取静态头
  if (options['custom-header']) {
    if (!customHeaders.static) customHeaders.static = {};
    
    for (const header of options['custom-header']) {
      const [key, value] = header.split('=', 2);
      if (key && value) {
        customHeaders.static[key] = value;
        hasConfig = true;
      }
    }
  }

  // 4. 从命令行参数读取环境变量头
  if (options['custom-header-env']) {
    if (!customHeaders.env) customHeaders.env = {};
    
    for (const header of options['custom-header-env']) {
      const [key, envName] = header.split('=', 2);
      if (key && envName) {
        customHeaders.env[key] = envName;
        hasConfig = true;
      }
    }
  }

  // 5. 从环境变量读取（MCP_CUSTOM_HEADERS_* 格式）
  const customHeadersFromEnv = extractCustomHeadersFromEnv(envVars);
  if (Object.keys(customHeadersFromEnv).length > 0) {
    if (!customHeaders.static) customHeaders.static = {};
    Object.assign(customHeaders.static, customHeadersFromEnv);
    hasConfig = true;
  }

  return hasConfig ? customHeaders : undefined;
}

/**
 * 从环境变量中提取自定义请求头
 * 格式：MCP_CUSTOM_HEADERS_<HEADER_NAME>=<VALUE>
 */
function extractCustomHeadersFromEnv(envVars: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {};
  const prefix = 'MCP_CUSTOM_HEADERS_';
  
  // 合并系统环境变量和 .env 文件变量
  const allEnvVars = { ...envVars, ...process.env };
  
  for (const [key, value] of Object.entries(allEnvVars)) {
    if (key.startsWith(prefix) && value) {
      const headerName = key.substring(prefix.length).replace(/_/g, '-');
      headers[headerName] = value;
    }
  }
  
  return headers;
}

// 主启动函数 - 专业的视觉体验
async function main() {
  // 设置 Windows 控制台兼容性
  setupWindowsConsole();
  
  const options = values;

  // 显示帮助
  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // 加载 .env 文件
  let envVars: Record<string, string> = {};
  if (options.env) {
    try {
      envVars = loadEnvFile(options.env);
    } catch (error) {
      console.log(CliDesign.error('环境变量文件加载失败，使用系统环境变量'));
    }
  }

  // 加载配置文件
  let config: ConfigFile | undefined;
  if (options.config) {
    try {
      config = loadConfigFile(options.config);
    } catch (error) {
      console.log(CliDesign.error('配置文件加载失败，使用命令行参数和环境变量'));
    }
  }

  // 从配置文件、命令行参数和环境变量获取配置
  // 合并环境变量：.env 文件 + 系统环境变量
  const mergedEnv = { ...envVars, ...process.env };
  
  // 优先级：命令行参数 > 配置文件 > .env 文件 > 系统环境变量 > 默认值
  const transport = options.transport || config?.transport || mergedEnv.MCP_TRANSPORT || 'stdio';
  const port = parseInt(options.port || config?.port?.toString() || mergedEnv.MCP_PORT || '3322');
  const openApiSource = options.openapi || config?.openapi || mergedEnv.MCP_OPENAPI_URL || '';
  const autoReload = options.watch || config?.watch || mergedEnv.MCP_AUTO_RELOAD === 'true';
  const autoRestart = options['auto-restart'] || config?.autoRestart || false;
  const maxRetries = parseInt(options['max-retries'] || config?.maxRetries?.toString() || '5');
  const retryDelay = parseInt(options['retry-delay'] || config?.retryDelay?.toString() || '5000');
  
  // 解析认证配置
  let authConfig: AuthConfig;
  try {
    authConfig = parseAuthConfig(options, config, envVars);
    validateAuthConfig(authConfig, envVars);
  } catch (error: any) {
    console.log(CliDesign.error(`认证配置错误: ${error.message}`));
    process.exit(1);
  }

  // 解析自定义请求头配置
  const customHeaders = parseCustomHeaders(options, config, envVars);
  const debugHeaders = options['debug-headers'] || config?.debugHeaders || false;

  // 显示启动横幅
  CliDesign.showHeader('MCP SWAGGER SERVER');
  console.log(CliDesign.brand.primary.bold(`  ${CliDesign.icons.rocket} 正在启动服务器...`));
  console.log();

  // 显示配置信息
  console.log(CliDesign.section(`${CliDesign.icons.config} 服务器配置`));
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
  
  // 显示认证配置
  console.log(CliDesign.tableRow([
    CliDesign.brand.secondary('认证类型:'),
    CliDesign.brand.white(authConfig.type.toUpperCase()),
    CliDesign.brand.muted(getAuthDescription(authConfig))
  ]));
  
  if (authConfig.type === 'bearer' && authConfig.bearer) {
    const { source, envName, token } = authConfig.bearer;
    if (source === 'env') {
      // 合并环境变量检查
      const mergedEnv = { ...envVars, ...process.env };
      console.log(CliDesign.tableRow([
        CliDesign.brand.secondary('Token 来源:'),
        CliDesign.brand.white(`环境变量 ${envName}`),
        CliDesign.brand.muted(mergedEnv[envName || 'API_TOKEN'] ? '✓ 已设置' : '✗ 未设置')
      ]));
    } else {
      console.log(CliDesign.tableRow([
        CliDesign.brand.secondary('Token 来源:'),
        CliDesign.brand.white('静态配置'),
        CliDesign.brand.muted(token ? '✓ 已配置' : '✗ 未配置')
      ]));
    }
  }
  
  console.log();

  // 获取传输协议描述
  function getTransportDescription(transport: string): string {
    switch (transport.toLowerCase()) {
      case 'stdio': return 'AI 客户端集成';
      case 'streamable': return 'Web 应用集成';
      case 'sse': return '实时 Web 应用';
      default: return '';
    }
  }

  // 获取认证类型描述
  function getAuthDescription(authConfig: AuthConfig): string {
    switch (authConfig.type) {
      case 'none': return '无认证';
      case 'bearer': 
        if (authConfig.bearer?.source === 'env') {
          return '环境变量 Token';
        } else {
          return '静态 Token';
        }
      default: return '';
    }
  }

  // 启动服务器的函数 - 增强的状态反馈
  async function startServer() {
    try {
      let openApiData = null;
      
      // 加载 OpenAPI 数据
      if (openApiSource) {
        console.log(CliDesign.section(`${CliDesign.icons.network} 加载 OpenAPI 规范`));
        openApiData = await loadOpenAPIData(openApiSource);
        
        // 显示 API 基本信息
        if (openApiData) {
          console.log();
          console.log(CliDesign.brand.muted('  API 信息:'));
          if (openApiData.info?.title) {
            console.log(CliDesign.brand.muted(`  ${CliDesign.icons.title} 标题: ${openApiData.info.title}`));
          }
          if (openApiData.info?.version) {
            console.log(CliDesign.brand.muted(`  ${CliDesign.icons.version} 版本: ${openApiData.info.version}`));
          }
          if (openApiData.paths) {
            const pathCount = Object.keys(openApiData.paths).length;
            console.log(CliDesign.brand.muted(`  ${CliDesign.icons.api} 路径: ${pathCount} 个端点`));
          }
        }
      } else {
        console.log(CliDesign.warning('未指定 OpenAPI 数据源，服务器将以基础模式运行'));
      }

      console.log(CliDesign.section(`${CliDesign.icons.rocket} 启动服务器`));

      // 根据传输协议启动服务器
      switch (transport.toLowerCase()) {
        case 'stdio':
          console.log(CliDesign.loading('正在启动 STDIO 服务器...'));
          console.log(CliDesign.brand.muted(`  ${CliDesign.icons.chat} 适用于 AI 客户端集成（如 Claude Desktop）`));
          await runStdioServer(openApiData, authConfig, customHeaders, debugHeaders);
          break;

        case 'streamable':
          console.log(CliDesign.loading(`正在启动 Streamable 服务器...`));
          const streamEndpoint = options.endpoint || '/mcp';
          const streamUrl = `http://localhost:${port}${streamEndpoint}`;
          console.log(CliDesign.brand.muted(`  ${CliDesign.icons.web} 服务器地址: ${streamUrl}`));
          console.log(CliDesign.brand.muted(`  ${CliDesign.icons.link} 适用于 Web 应用集成`));
          await runStreamableServer(streamEndpoint, port, openApiData, authConfig, customHeaders, debugHeaders);
          break;

        case 'sse':
          console.log(CliDesign.loading(`正在启动 SSE 服务器...`));
          const sseEndpoint = options.endpoint || '/sse';
          const sseUrl = `http://localhost:${port}${sseEndpoint}`;
          console.log(CliDesign.brand.muted(`  ${CliDesign.icons.signal} SSE 端点: ${sseUrl}`));
          console.log(CliDesign.brand.muted(`  ${CliDesign.icons.bolt} 适用于实时 Web 应用`));
          await runSseServer(sseEndpoint, port, openApiData, authConfig, customHeaders, debugHeaders);
          break;

        default:
          throw new Error(`不支持的传输协议: ${transport}，支持的协议: stdio, sse, streamable`);
      }

      // 服务器启动成功
      console.log();
      console.log(CliDesign.separator('=', 60));
      console.log(CliDesign.success('MCP Swagger Server 启动成功！'));
      
      if (transport !== 'stdio') {
        const serverUrl = `http://localhost:${port}${options.endpoint || (transport === 'sse' ? '/sse' : '/mcp')}`;
        console.log(CliDesign.brand.muted(`  ${CliDesign.icons.up} 服务器运行在: ${serverUrl}`));
      }
      
      console.log(CliDesign.brand.muted(`  ${CliDesign.icons.bulb} 按 Ctrl+C 停止服务器`));
      console.log(CliDesign.separator('=', 60));
      
      // 设置文件监控
      if (autoReload && openApiSource && !isUrl(openApiSource)) {
        console.log();
        watchOpenAPIFile(openApiSource, () => {
          console.log(CliDesign.brand.warning(`${CliDesign.icons.reload} 因文件变化而重启服务器...`));
          process.exit(0); // 简单重启
        });
      }

    } catch (error: any) {
      console.log();
      console.log(CliDesign.error(`服务器启动失败: ${error.message}`));
      
      if (autoRestart) {
        console.log(CliDesign.warning(`自动重启已启用，${retryDelay}ms 后重试...`));
        console.log(CliDesign.brand.muted(`  ${CliDesign.icons.process} 最大重试次数: ${maxRetries}`));
        setTimeout(startServer, retryDelay);
      } else {
        console.log(CliDesign.brand.muted(`  ${CliDesign.icons.bulb} 提示: 使用 --auto-restart 启用自动重启`));
        process.exit(1);
      }
    }
  }

  // 处理优雅关闭 - 专业的退出提示
  process.on('SIGTERM', () => {
    console.log('\n' + CliDesign.warning('收到 SIGTERM 信号，正在优雅关闭服务器...'));
    console.log(CliDesign.brand.muted(`  ${CliDesign.icons.stop} 清理资源并退出`));
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('\n' + CliDesign.warning('收到中断信号 (Ctrl+C)，正在关闭服务器...'));
    console.log(CliDesign.brand.muted(`  ${CliDesign.icons.wave} 感谢使用 MCP Swagger Server`));
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
    console.log(CliDesign.brand.muted(`  ${CliDesign.icons.boom} 服务器无法启动`));
    
    if (error.stack) {
      console.log(CliDesign.brand.muted(`  ${CliDesign.icons.list} 错误堆栈:`));
      console.log(CliDesign.brand.muted(error.stack.split('\n').slice(0, 5).join('\n')));
    }
    
    console.log();
    console.log(CliDesign.brand.muted(`  ${CliDesign.icons.bulb} 提示: 使用 --help 查看使用说明`));
    process.exit(1);
  });
}
