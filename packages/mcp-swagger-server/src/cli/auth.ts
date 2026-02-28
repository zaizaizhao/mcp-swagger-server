import { AuthConfig } from 'mcp-swagger-parser';
import { CliDesign } from './design';
import { ServerOptions, ConfigFile } from './types';
import { CLI_DEFAULTS } from './defaults';

export function parseAuthConfig(
  options: ServerOptions & { 'auth-type'?: string; 'bearer-token'?: string; 'bearer-env'?: string }, 
  config?: ConfigFile,
  envVars?: Record<string, string>
): AuthConfig {
  // Priority: .env file > system env (so .env values override system env)
  const mergedEnv = { ...process.env, ...envVars };
  
  const authType = options['auth-type'] || options.authType || config?.auth?.type || mergedEnv.MCP_AUTH_TYPE || CLI_DEFAULTS.authType;
  
  if (authType === 'none') {
    return { type: 'none' };
  }
  
  if (authType === 'bearer') {
    let token = '';
    let source: 'static' | 'env' = 'static';
    let envName = '';
    
    if (options['bearer-token'] || options.bearerToken) {
      token = options['bearer-token'] || options.bearerToken || '';
      source = 'static';
    } else if (options['bearer-env'] || options.bearerEnv) {
      envName = options['bearer-env'] || options.bearerEnv || '';
      source = 'env';
    } else if (config?.auth?.bearer) {
      const bearerConfig = config.auth.bearer;
      token = bearerConfig.token || '';
      source = bearerConfig.source === 'function' ? 'static' : bearerConfig.source || 'static';
      envName = bearerConfig.envName || '';
    } else {
      envName = CLI_DEFAULTS.bearerEnvName;
      source = 'env';
    }
    
    return {
      type: 'bearer',
      bearer: {
        token,
        source,
        envName: envName || CLI_DEFAULTS.bearerEnvName
      }
    };
  }
  
  throw new Error(`不支持的认证类型: ${authType}，支持的类型: none, bearer`);
}

export function validateAuthConfig(authConfig: AuthConfig, envVars?: Record<string, string>): void {
  if (authConfig.type === 'bearer' && authConfig.bearer) {
    const { source, token, envName } = authConfig.bearer;
    
    if (source === 'static') {
      if (!token) {
        throw new Error('Bearer Token 静态模式需要提供 token 值');
      }
    } else if (source === 'env') {
      const envVar = envName || CLI_DEFAULTS.bearerEnvName;
      // Priority: .env file > system env
      const mergedEnv = { ...process.env, ...envVars };
      const envValue = mergedEnv[envVar];
      if (!envValue) {
        console.log(CliDesign.warning(`环境变量 ${envVar} 未设置，Bearer Token 将在运行时无效`));
      }
    }
  }
}
