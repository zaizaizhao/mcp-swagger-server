import { CustomHeaders, RequestContext } from '../transformer/types';
import { getPredefinedGenerator } from './generators';

/**
 * 自定义请求头管理器
 */
export class CustomHeadersManager {
  private config: CustomHeaders;
  private protectedHeaders: Set<string>;
  private debugMode: boolean;

  constructor(config: CustomHeaders = {}, options: { 
    protectedHeaders?: string[], 
    debugMode?: boolean 
  } = {}) {
    this.config = config;
    this.protectedHeaders = new Set([
      'content-type',
      'content-length',
      'host',
      'connection',
      'transfer-encoding',
      'upgrade',
      ...(options.protectedHeaders || [])
    ]);
    this.debugMode = options.debugMode || false;
  }

  /**
   * 获取所有自定义请求头
   */
  async getHeaders(context: RequestContext): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    try {
      // 1. 添加静态头
      if (this.config.static) {
        Object.assign(headers, this.config.static);
        if (this.debugMode) {
          console.log('Added static headers:', this.config.static);
        }
      }

      // 2. 添加环境变量头
      if (this.config.env) {
        const envHeaders = await this.resolveEnvHeaders(this.config.env);
        Object.assign(headers, envHeaders);
        if (this.debugMode) {
          console.log('Added env headers:', envHeaders);
        }
      }

      // 3. 添加动态头
      if (this.config.dynamic) {
        const dynamicHeaders = await this.resolveDynamicHeaders(this.config.dynamic);
        Object.assign(headers, dynamicHeaders);
        if (this.debugMode) {
          console.log('Added dynamic headers:', dynamicHeaders);
        }
      }

      // 4. 添加条件头
      if (this.config.conditional) {
        const conditionalHeaders = await this.resolveConditionalHeaders(this.config.conditional, context);
        Object.assign(headers, conditionalHeaders);
        if (this.debugMode) {
          console.log('Added conditional headers:', conditionalHeaders);
        }
      }

      // 5. 过滤受保护的头
      const filteredHeaders = this.filterProtectedHeaders(headers);

      if (this.debugMode) {
        console.log('Final custom headers:', filteredHeaders);
      }

      return filteredHeaders;
    } catch (error) {
      console.error('Error resolving custom headers:', error);
      return {};
    }
  }

  private async resolveEnvHeaders(envConfig: Record<string, string>): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    
    for (const [headerName, envName] of Object.entries(envConfig)) {
      const value = process.env[envName];
      if (value) {
        headers[headerName] = value;
      } else if (this.debugMode) {
        console.warn(`Environment variable ${envName} not found for header ${headerName}`);
      }
    }
    
    return headers;
  }

  private async resolveDynamicHeaders(dynamicConfig: Record<string, (() => string | Promise<string>) | string>): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    
    for (const [headerName, generator] of Object.entries(dynamicConfig)) {
      try {
        let value: string;
        
        if (typeof generator === 'string') {
          // 字符串形式，查找预定义函数
          const predefinedFn = getPredefinedGenerator(generator);
          if (predefinedFn) {
            value = await predefinedFn();
          } else {
            console.warn(`Unknown predefined generator: ${generator}`);
            continue;
          }
        } else if (typeof generator === 'function') {
          // 函数形式，直接调用
          value = await generator();
        } else {
          console.warn(`Invalid generator type for header ${headerName}`);
          continue;
        }
        
        if (value) {
          headers[headerName] = value;
        }
      } catch (error) {
        console.warn(`Failed to generate dynamic header ${headerName}:`, error);
      }
    }
    
    return headers;
  }

  private async resolveConditionalHeaders(
    conditionalConfig: Array<{ condition: (context: RequestContext) => boolean; headers: Record<string, string> }>,
    context: RequestContext
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    
    for (const rule of conditionalConfig) {
      try {
        if (rule.condition(context)) {
          Object.assign(headers, rule.headers);
        }
      } catch (error) {
        console.warn('Error evaluating conditional header rule:', error);
      }
    }
    
    return headers;
  }

  private filterProtectedHeaders(headers: Record<string, string>): Record<string, string> {
    const filtered: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      const normalizedKey = key.toLowerCase();
      if (!this.protectedHeaders.has(normalizedKey)) {
        filtered[key] = value;
      } else if (this.debugMode) {
        console.warn(`Protected header ignored: ${key}`);
      }
    }
    
    return filtered;
  }
}
