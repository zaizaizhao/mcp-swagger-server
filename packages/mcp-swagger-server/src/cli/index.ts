#!/usr/bin/env node

import { runSseServer, runStdioServer, runStreamableServer } from '../server';
import { AuthConfig } from 'mcp-swagger-parser';
import { isUrl } from '../utils/common';
import { CLI_DEFAULTS } from './defaults';

// Re-export all modules
export { CliDesign, CLI_ICONS } from './design';
export { ServerOptions, ConfigFile, ParsedOptions } from './types';
export { loadConfigFile, loadEnvFile } from './config';
export { parseAuthConfig, validateAuthConfig } from './auth';
export { parseCustomHeaders, extractCustomHeadersFromEnv } from './headers';
export { parseOperationFilter } from './filters';
export { loadOpenAPIData, watchOpenAPIFile } from './openapi';
export { setupWindowsConsole } from './utils';
export { ARGS_CONFIG, parseCLIArgs, showHelp } from './args';
export { CLI_DEFAULTS } from './defaults';

// Import for internal use
import { CliDesign } from './design';
import { ConfigFile, ParsedOptions } from './types';
import { loadConfigFile, loadEnvFile } from './config';
import { parseAuthConfig, validateAuthConfig } from './auth';
import { parseCustomHeaders } from './headers';
import { parseOperationFilter } from './filters';
import { loadOpenAPIData, watchOpenAPIFile } from './openapi';
import { setupWindowsConsole, routeConsoleToStderrForStdio } from './utils';
import { parseCLIArgs, showHelp } from './args';

// Helper functions
function getTransportDescription(transport: string): string {
  switch (transport.toLowerCase()) {
    case 'stdio': return 'AI 客户端集成';
    case 'streamable': return 'Web 应用集成';
    case 'sse': return '实时 Web 应用';
    default: return '';
  }
}

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

// Main startup function
export async function main() {
  // Setup Windows console compatibility
  setupWindowsConsole();
  
  const { values: options } = parseCLIArgs();

  // Show help
  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Load .env file
  let envVars: Record<string, string> = {};
  if (options.env) {
    try {
      envVars = loadEnvFile(options.env);
    } catch (error) {
      console.error(CliDesign.error('环境变量文件加载失败，使用系统环境变量'));
    }
  }

  // Load config file
  let config: ConfigFile | undefined;
  if (options.config) {
    try {
      config = loadConfigFile(options.config);
    } catch (error) {
      console.error(CliDesign.error('配置文件加载失败，使用命令行参数和环境变量'));
    }
  }

  // Merge environment variables: .env file overrides system env
  const mergedEnv = { ...process.env, ...envVars };
  
  // Config priority: CLI args > config file > .env file > system env > defaults
  const transport = options.transport || config?.transport || mergedEnv.MCP_TRANSPORT || CLI_DEFAULTS.transport;
  const port = Number(options.port ?? config?.port ?? mergedEnv.MCP_PORT ?? CLI_DEFAULTS.port);
  const host = options.host || config?.host || mergedEnv.MCP_HOST || CLI_DEFAULTS.host;
  const openApiSource = options.openapi || config?.openapi || mergedEnv.MCP_OPENAPI_URL || '';
  const baseUrl = options['base-url'] || config?.baseUrl || mergedEnv.MCP_BASE_URL || undefined;
  const sourceOrigin = (!baseUrl && openApiSource && isUrl(openApiSource))
    ? new URL(openApiSource).origin
    : undefined;
  const endpoint = options.endpoint || config?.endpoint || mergedEnv.MCP_ENDPOINT || (transport === 'sse' ? '/sse' : '/mcp');
  const autoReload = options.watch || config?.watch || mergedEnv.MCP_AUTO_RELOAD === 'true';
  const autoRestart = options['auto-restart'] || config?.autoRestart || false;

  if (String(transport).toLowerCase() === 'stdio') {
    routeConsoleToStderrForStdio();
  }

  const parseNumber = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const maxRetries = Math.max(0, parseNumber(options['max-retries'] ?? config?.maxRetries ?? CLI_DEFAULTS.maxRetries, CLI_DEFAULTS.maxRetries));
  const retryDelay = Math.max(0, parseNumber(options['retry-delay'] ?? config?.retryDelay ?? CLI_DEFAULTS.retryDelay, CLI_DEFAULTS.retryDelay));

  const parseList = (value: unknown): string[] | undefined => {
    if (!value) return undefined;

    const values = Array.isArray(value) ? value : [value];
    const normalized = values
      .flatMap(item => String(item).split(','))
      .map(item => item.trim())
      .filter(Boolean);

    return normalized.length > 0 ? normalized : undefined;
  };

  const allowedHosts =
    parseList(options['allowed-host']) ||
    parseList(config?.allowedHosts) ||
    parseList(mergedEnv.MCP_ALLOWED_HOSTS);

  const allowedOrigins =
    parseList(options['allowed-origin']) ||
    parseList(config?.allowedOrigins) ||
    parseList(mergedEnv.MCP_ALLOWED_ORIGINS);

  const disableDnsRebindingProtection = Boolean(
    options['disable-dns-rebinding-protection'] ||
      config?.disableDnsRebindingProtection ||
      mergedEnv.MCP_DISABLE_DNS_REBINDING_PROTECTION === 'true'
  );
  const enableDnsRebindingProtection = !disableDnsRebindingProtection;
  
  // Parse auth config
  let authConfig: AuthConfig;
  try {
    authConfig = parseAuthConfig(options, config, envVars);
    validateAuthConfig(authConfig, envVars);
  } catch (error: any) {
    console.log(CliDesign.error(`认证配置错误: ${error.message}`));
    process.exit(1);
  }

  // Parse custom headers config
  const customHeaders = parseCustomHeaders(options, config, envVars);
  const debugHeaders = options['debug-headers'] || config?.debugHeaders || false;

  // Parse operation filter config
  const operationFilter = parseOperationFilter(options, config);

  // Show startup banner
  CliDesign.showHeader('MCP SWAGGER SERVER');
  console.log(CliDesign.brand.primary.bold(`  ${CliDesign.icons.rocket} 正在启动服务器...`));
  console.log();

  // Show configuration info
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
    CliDesign.brand.secondary('主机地址:'),
    CliDesign.brand.white(host),
    CliDesign.brand.muted(transport === 'stdio' ? '(STDIO 模式不使用主机)' : '')
  ]));
  console.log(CliDesign.tableRow([
    CliDesign.brand.secondary('数据源:'),
    CliDesign.brand.white(openApiSource || '未指定'),
    CliDesign.brand.muted(openApiSource ? (isUrl(openApiSource) ? '远程 URL' : '本地文件') : '')
  ]));
  if (baseUrl) {
    console.log(CliDesign.tableRow([
      CliDesign.brand.secondary('基础URL:'),
      CliDesign.brand.white(baseUrl),
      CliDesign.brand.muted('用户指定覆盖')
    ]));
  }
  console.log(CliDesign.tableRow([
    CliDesign.brand.secondary('文件监控:'),
    CliDesign.brand.white(autoReload ? '启用' : '禁用'),
    CliDesign.brand.muted(autoReload && openApiSource && !isUrl(openApiSource) ? '将监控文件变化' : '')
  ]));
  
  // Show auth config
  console.log(CliDesign.tableRow([
    CliDesign.brand.secondary('认证类型:'),
    CliDesign.brand.white(authConfig.type.toUpperCase()),
    CliDesign.brand.muted(getAuthDescription(authConfig))
  ]));
  console.log(CliDesign.tableRow([
    CliDesign.brand.secondary('DNS 防护:'),
    CliDesign.brand.white(enableDnsRebindingProtection ? '启用' : '禁用'),
    CliDesign.brand.muted(enableDnsRebindingProtection ? '校验 Host/Origin' : '')
  ]));

  if (allowedHosts && allowedHosts.length > 0) {
    console.log(CliDesign.tableRow([
      CliDesign.brand.secondary('允许 Host:'),
      CliDesign.brand.white(allowedHosts.join(', ')),
      CliDesign.brand.muted(`共 ${allowedHosts.length} 项`)
    ]));
  }

  if (allowedOrigins && allowedOrigins.length > 0) {
    console.log(CliDesign.tableRow([
      CliDesign.brand.secondary('允许 Origin:'),
      CliDesign.brand.white(allowedOrigins.join(', ')),
      CliDesign.brand.muted(`共 ${allowedOrigins.length} 项`)
    ]));
  }
  
  if (authConfig.type === 'bearer' && authConfig.bearer) {
    const { source, envName, token } = authConfig.bearer;
    if (source === 'env') {
      const mergedEnvCheck = { ...process.env, ...envVars };
      console.log(CliDesign.tableRow([
        CliDesign.brand.secondary('Token 来源:'),
        CliDesign.brand.white(`环境变量 ${envName}`),
        CliDesign.brand.muted(mergedEnvCheck[envName || 'API_TOKEN'] ? '✓ 已设置' : '✗ 未设置')
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

  let retryCount = 0;

  async function startServer() {
    try {
      let openApiData = null;
      
      // Load OpenAPI data
      if (openApiSource) {
        console.log(CliDesign.section(`${CliDesign.icons.network} 加载 OpenAPI 规范`));
        openApiData = await loadOpenAPIData(openApiSource);
        
        // Show API basic info
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

      // Start server based on transport protocol
      switch (transport.toLowerCase()) {
        case 'stdio':
          console.log(CliDesign.loading('正在启动 STDIO 服务器...'));
          console.log(CliDesign.brand.muted(`  ${CliDesign.icons.chat} 适用于 AI 客户端集成（如 Claude Desktop）`));
          await runStdioServer(openApiData, authConfig, customHeaders, debugHeaders, operationFilter, baseUrl, sourceOrigin);
          break;

        case 'streamable':
          console.log(CliDesign.loading(`正在启动 Streamable 服务器...`));
          const streamEndpoint = endpoint;
          const streamUrl = `http://${host}:${port}${streamEndpoint}`;
          console.log(CliDesign.brand.muted(`  ${CliDesign.icons.web} 服务器地址: ${streamUrl}`));
          console.log(CliDesign.brand.muted(`  ${CliDesign.icons.link} 适用于 Web 应用集成`));
          await runStreamableServer(
            streamEndpoint,
            port,
            openApiData,
            authConfig,
            customHeaders,
            debugHeaders,
            operationFilter,
            host,
            {
              allowedHosts,
              allowedOrigins,
              enableDnsRebindingProtection
            },
            baseUrl,
            sourceOrigin
          );
          break;

        case 'sse':
          console.log(CliDesign.loading(`正在启动 SSE 服务器...`));
          const sseEndpoint = endpoint;
          const sseUrl = `http://${host}:${port}${sseEndpoint}`;
          console.log(CliDesign.brand.muted(`  ${CliDesign.icons.signal} SSE 端点: ${sseUrl}`));
          console.log(CliDesign.brand.muted(`  ${CliDesign.icons.bolt} 适用于实时 Web 应用`));
          await runSseServer(
            sseEndpoint,
            port,
            openApiData,
            authConfig,
            customHeaders,
            debugHeaders,
            operationFilter,
            host,
            {
              allowedHosts,
              allowedOrigins,
              enableDnsRebindingProtection
            },
            baseUrl,
            sourceOrigin
          );
          break;

        default:
          throw new Error(`不支持的传输协议: ${transport}，支持的协议: stdio, sse, streamable`);
      }

      // Server started successfully
      console.log();
      console.log(CliDesign.separator('=', 60));
      console.log(CliDesign.success('MCP Swagger Server 启动成功！'));
      
      if (transport !== 'stdio') {
        const serverUrl = `http://${host}:${port}${endpoint}`;
        console.log(CliDesign.brand.muted(`  ${CliDesign.icons.up} 服务器运行在: ${serverUrl}`));
      }
      
      console.log(CliDesign.brand.muted(`  ${CliDesign.icons.bulb} 按 Ctrl+C 停止服务器`));
      console.log(CliDesign.separator('=', 60));
      
      // Setup file watch
      if (autoReload && openApiSource && !isUrl(openApiSource)) {
        console.log();
        watchOpenAPIFile(openApiSource, () => {
          console.log(CliDesign.brand.warning(`${CliDesign.icons.reload} 因文件变化而重启服务器...`));
          process.exit(0); // Simple restart
        });
      }

    } catch (error: any) {
      console.log();
      console.log(CliDesign.error(`服务器启动失败: ${error.message}`));
      
      if (autoRestart) {
        retryCount++;
        if (retryCount > maxRetries) {
          console.log(CliDesign.error(`已达到最大重试次数 (${maxRetries})，停止重试`));
          console.log(CliDesign.brand.muted(`  ${CliDesign.icons.boom} 请检查配置后手动重新启动`));
          process.exit(1);
        }
        console.log(CliDesign.warning(`自动重启已启用，${retryDelay}ms 后重试 (${retryCount}/${maxRetries})...`));
        setTimeout(startServer, retryDelay);
      } else {
        console.log(CliDesign.brand.muted(`  ${CliDesign.icons.bulb} 提示: 使用 --auto-restart 启用自动重启`));
        process.exit(1);
      }
    }
  }

  // Start server
  await startServer();
}

// If this file is run directly, start the server
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
