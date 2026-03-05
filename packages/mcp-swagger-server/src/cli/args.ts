import { parseArgs } from 'node:util';
import { CliDesign } from './design';
import { ParsedOptions } from './types';
import { CLI_DEFAULTS } from './defaults';

export const ARGS_CONFIG = {
  options: {
    transport: { type: 'string' as const, short: 't' },
    port: { type: 'string' as const, short: 'p' },
    host: { type: 'string' as const, short: 'H' },
    endpoint: { type: 'string' as const, short: 'e' },
    'auto-restart': { type: 'boolean' as const, default: false },
    'max-retries': { type: 'string' as const },
    'retry-delay': { type: 'string' as const },
    openapi: { type: 'string' as const, short: 'o' },
    watch: { type: 'boolean' as const, short: 'w', default: false },
    'auth-type': { type: 'string' as const },
    'bearer-token': { type: 'string' as const },
    'bearer-env': { type: 'string' as const },
    config: { type: 'string' as const, short: 'c' },
    env: { type: 'string' as const },
    'custom-header': { type: 'string' as const, multiple: true },
    header: { type: 'string' as const, multiple: true },
    'custom-headers-config': { type: 'string' as const },
    'custom-header-env': { type: 'string' as const, multiple: true },
    'debug-headers': { type: 'boolean' as const, default: false },
    managed: { type: 'boolean' as const, default: false },
    'operation-filter-methods': { type: 'string' as const, multiple: true },
    'operation-filter-paths': { type: 'string' as const, multiple: true },
    'operation-filter-operation-ids': { type: 'string' as const, multiple: true },
    'operation-filter-status-codes': { type: 'string' as const, multiple: true },
    'operation-filter-parameters': { type: 'string' as const, multiple: true },
    'allowed-host': { type: 'string' as const, multiple: true },
    'allowed-origin': { type: 'string' as const, multiple: true },
    'disable-dns-rebinding-protection': { type: 'boolean' as const, default: false },
    help: { type: 'boolean' as const, short: 'h', default: false },
  },
};

export function parseCLIArgs(): { values: ParsedOptions; positionals: string[] } {
  return parseArgs(ARGS_CONFIG) as { values: ParsedOptions; positionals: string[] };
}

export function showHelp() {
  CliDesign.showHeader('MCP SWAGGER SERVER');
  
  console.log(CliDesign.brand.muted('  Transform OpenAPI specifications into MCP format for AI assistants'));
  
  console.log(CliDesign.section(`${CliDesign.icons.rocket} 用法`));
  console.log(CliDesign.brand.info('  mcp-swagger-server') + CliDesign.brand.muted(' [选项]'));
  
  console.log(CliDesign.section(`${CliDesign.icons.gear} 配置选项`));
  console.log(CliDesign.option('-t, --transport <type>', '传输协议 (stdio|sse|streamable)', CLI_DEFAULTS.transport));
  console.log(CliDesign.option('-p, --port <port>', '服务器端口号', String(CLI_DEFAULTS.port)));
  console.log(CliDesign.option('-H, --host <host>', '服务器监听主机', CLI_DEFAULTS.host));
  console.log(CliDesign.option('-e, --endpoint <path>', '自定义端点路径'));
  console.log(CliDesign.option('-o, --openapi <source>', 'OpenAPI 数据源 (URL 或文件路径)'));
  console.log(CliDesign.option('-c, --config <file>', '配置文件路径 (JSON 格式)'));
  console.log(CliDesign.option('--env <file>', '环境变量文件路径 (.env 格式)'));
  
  console.log(CliDesign.section(`${CliDesign.icons.key} 认证选项`));
  console.log(CliDesign.option('--auth-type <type>', '认证类型 (none|bearer)', CLI_DEFAULTS.authType));
  console.log(CliDesign.option('--bearer-token <token>', 'Bearer Token 静态值'));
  console.log(CliDesign.option('--bearer-env <varname>', 'Bearer Token 环境变量名', CLI_DEFAULTS.bearerEnvName));
  
  console.log(CliDesign.section(`${CliDesign.icons.gear} 自定义请求头选项`));
  console.log(CliDesign.option('--custom-header <header>', '自定义请求头 "Key=Value" (可重复)'));
  console.log(CliDesign.option('--custom-headers-config <file>', '自定义请求头配置文件 (JSON)'));
  console.log(CliDesign.option('--custom-header-env <header>', '环境变量请求头 "Key=VAR_NAME" (可重复)'));
  console.log(CliDesign.option('--debug-headers', '启用请求头调试模式', 'false'));
  
  console.log(CliDesign.section(`${CliDesign.icons.gear} 操作过滤选项`));
  console.log(CliDesign.option('--operation-filter-methods <methods>', 'HTTP方法过滤 (可重复) [示例: GET,POST]'));
  console.log(CliDesign.option('--operation-filter-paths <paths>', '路径过滤 (支持通配符, 可重复) [示例: /api/*]'));
  console.log(CliDesign.option('--operation-filter-operation-ids <ids>', '操作ID过滤 (可重复) [示例: getUserById]'));
  console.log(CliDesign.option('--operation-filter-status-codes <codes>', '状态码过滤 (可重复) [示例: 200,201]'));
  console.log(CliDesign.option('--operation-filter-parameters <params>', '参数过滤 (可重复) [示例: userId,name]'));

  console.log(CliDesign.section(`${CliDesign.icons.gear} 高级选项`));
  console.log(CliDesign.option('-w, --watch', '监控文件变化并自动重载', 'false'));
  console.log(CliDesign.option('--auto-restart', '自动重启服务器', 'false'));
  console.log(CliDesign.option('--max-retries <num>', '最大重试次数', String(CLI_DEFAULTS.maxRetries)));
  console.log(CliDesign.option('--retry-delay <ms>', '重试延迟 (毫秒)', String(CLI_DEFAULTS.retryDelay)));
  console.log(CliDesign.option('--allowed-host <host>', '允许的 Host 头 (可重复)'));
  console.log(CliDesign.option('--allowed-origin <origin>', '允许的 Origin 头 (可重复)'));
  console.log(CliDesign.option('--disable-dns-rebinding-protection', '禁用 Host/Origin 校验保护', 'false'));
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
    CliDesign.brand.secondary('MCP_HOST'),
    CliDesign.brand.white('默认监听主机'),
    CliDesign.brand.muted(CLI_DEFAULTS.host)
  ]));
  console.log(CliDesign.tableRow([
    CliDesign.brand.secondary('MCP_AUTO_RELOAD'),
    CliDesign.brand.white('启用自动重载'),
    CliDesign.brand.muted('false')
  ]));
  console.log(CliDesign.tableRow([
    CliDesign.brand.secondary('MCP_ALLOWED_HOSTS'),
    CliDesign.brand.white('允许的 Host 列表'),
    CliDesign.brand.muted('逗号分隔')
  ]));
  console.log(CliDesign.tableRow([
    CliDesign.brand.secondary('MCP_ALLOWED_ORIGINS'),
    CliDesign.brand.white('允许的 Origin 列表'),
    CliDesign.brand.muted('逗号分隔')
  ]));
  console.log(CliDesign.tableRow([
    CliDesign.brand.secondary('MCP_DISABLE_DNS_REBINDING_PROTECTION'),
    CliDesign.brand.white('禁用 DNS Rebinding 防护'),
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
