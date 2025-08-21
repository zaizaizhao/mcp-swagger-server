import { homedir } from 'os';
import { join } from 'path';

export interface GlobalConfig {
  // 全局设置
  defaultTransport: 'stdio' | 'sse' | 'streamable';
  defaultPort: number;
  autoSave: boolean;
  debugMode: boolean;
  
  // UI 设置
  theme: 'default' | 'dark-red-cyber' | 'compact' | 'fancy';
  showWelcome: boolean;
  confirmOnExit: boolean;
  
  // 服务器设置
  serverTimeout: number;
  maxRetries: number;
  retryDelay: number;
  
  // 开发设置
  watchFiles: boolean;
  hotReload: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  
  // 最近使用
  recentConfigs: string[]; // 配置 ID 列表
  maxRecentConfigs: number;
}

export const DEFAULT_CONFIG: GlobalConfig = {
  // 全局设置
  defaultTransport: 'streamable',
  defaultPort: 3000,
  autoSave: true,
  debugMode: false,
  
  // UI 设置
  theme: 'dark-red-cyber',
  showWelcome: true,
  confirmOnExit: true,
  
  // 服务器设置
  serverTimeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  
  // 开发设置
  watchFiles: false,
  hotReload: false,
  logLevel: 'info',
  
  // 最近使用
  recentConfigs: [],
  maxRecentConfigs: 10
};

export class ConfigManager {
  private config: any;
  private configPath: string;
  private initialized: boolean = false;

  constructor() {
    this.configPath = join(homedir(), '.mcp-swagger-server');
  }

  private async initConfig() {
    if (this.initialized) return;
    
    const { default: Conf } = await import('conf' as any);
    this.config = new Conf({
      configName: 'config',
      cwd: this.configPath,
      defaults: DEFAULT_CONFIG,
      schema: {
        defaultTransport: {
          type: 'string',
          enum: ['stdio', 'sse', 'streamable'],
          default: 'stdio'
        },
        defaultPort: {
          type: 'number',
          minimum: 1024,
          maximum: 65535,
          default: 3000
        },
        autoSave: {
          type: 'boolean',
          default: true
        },
        debugMode: {
          type: 'boolean',
          default: false
        },
        theme: {
          type: 'string',
          enum: ['default', 'dark-red-cyber', 'compact', 'fancy'],
          default: 'dark-red-cyber'
        },
        showWelcome: {
          type: 'boolean',
          default: true
        },
        confirmOnExit: {
          type: 'boolean',
          default: true
        },
        serverTimeout: {
          type: 'number',
          minimum: 5000,
          maximum: 300000,
          default: 30000
        },
        maxRetries: {
          type: 'number',
          minimum: 0,
          maximum: 10,
          default: 3
        },
        retryDelay: {
          type: 'number',
          minimum: 100,
          maximum: 10000,
          default: 1000
        },
        watchFiles: {
          type: 'boolean',
          default: false
        },
        hotReload: {
          type: 'boolean',
          default: false
        },
        logLevel: {
          type: 'string',
          enum: ['error', 'warn', 'info', 'debug'],
          default: 'info'
        },
        recentConfigs: {
          type: 'array',
          items: {
            type: 'string'
          },
          default: []
        },
        maxRecentConfigs: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10
        }
      }
    });
    this.initialized = true;
  }

  /**
   * 获取完整配置
   */
  async getConfig(): Promise<GlobalConfig> {
    await this.initConfig();
    return this.config.store;
  }

  /**
   * 获取单个配置项
   */
  async get<K extends keyof GlobalConfig>(key: K): Promise<GlobalConfig[K]> {
    await this.initConfig();
    return this.config.get(key);
  }

  /**
   * 设置单个配置项
   */
  async set<K extends keyof GlobalConfig>(key: K, value: GlobalConfig[K]): Promise<void> {
    await this.initConfig();
    this.config.set(key, value);
  }

  /**
   * 设置完整配置
   */
  async setConfig(config: Partial<GlobalConfig>): Promise<void> {
    await this.setMultiple(config);
  }

  /**
   * 重置配置为默认值
   */
  async resetConfig(): Promise<void> {
    await this.initConfig();
    this.config.clear();
    await this.setMultiple(DEFAULT_CONFIG);
  }

  /**
   * 批量设置配置
   */
  async setMultiple(updates: Partial<GlobalConfig>): Promise<void> {
    await this.initConfig();
    for (const [key, value] of Object.entries(updates)) {
      this.config.set(key as keyof GlobalConfig, value);
    }
  }

  /**
   * 重置配置为默认值
   */
  async reset(): Promise<void> {
    await this.initConfig();
    this.config.clear();
  }

  /**
   * 重置单个配置项为默认值
   */
  async resetKey<K extends keyof GlobalConfig>(key: K): Promise<void> {
    await this.initConfig();
    this.config.delete(key);
  }

  /**
   * 检查配置项是否存在
   */
  async has<K extends keyof GlobalConfig>(key: K): Promise<boolean> {
    await this.initConfig();
    return this.config.has(key);
  }

  /**
   * 获取配置文件路径
   */
  async getConfigPath(): Promise<string> {
    await this.initConfig();
    return this.config.path;
  }

  /**
   * 获取配置目录路径
   */
  getConfigDir(): string {
    return this.configPath;
  }

  /**
   * 添加最近使用的配置
   */
  async addRecentConfig(configId: string): Promise<void> {
    // 验证输入参数
    if (typeof configId !== 'string' || !configId.trim()) {
      throw new Error('配置ID必须是非空字符串');
    }
    
    let recentConfigs = await this.get('recentConfigs');
    const maxRecentConfigs = await this.get('maxRecentConfigs');
    
    // 确保recentConfigs是数组，并过滤掉非字符串元素
    if (!Array.isArray(recentConfigs)) {
      recentConfigs = [];
    } else {
      recentConfigs = recentConfigs.filter(id => typeof id === 'string' && id.trim());
    }
    
    // 移除已存在的相同配置
    const filteredConfigs = recentConfigs.filter(id => id !== configId);
    
    // 添加到开头
    filteredConfigs.unshift(configId);
    
    // 限制数量
    const limitedConfigs = filteredConfigs.slice(0, maxRecentConfigs);
    
    await this.set('recentConfigs', limitedConfigs);
  }

  /**
   * 获取最近使用的配置
   */
  async getRecentConfigs(): Promise<string[]> {
    let recentConfigs = await this.get('recentConfigs');
    
    // 确保返回的是字符串数组，过滤掉非字符串元素
    if (!Array.isArray(recentConfigs)) {
      recentConfigs = [];
      await this.set('recentConfigs', recentConfigs);
    } else {
      const cleanedConfigs = recentConfigs.filter(id => typeof id === 'string' && id.trim());
      if (cleanedConfigs.length !== recentConfigs.length) {
        await this.set('recentConfigs', cleanedConfigs);
        recentConfigs = cleanedConfigs;
      }
    }
    
    return recentConfigs;
  }

  /**
   * 清空最近使用的配置
   */
  async clearRecentConfigs(): Promise<void> {
    await this.set('recentConfigs', []);
  }

  /**
   * 从最近使用中移除配置
   */
  async removeRecentConfig(configId: string): Promise<void> {
    const recentConfigs = await this.get('recentConfigs');
    const filteredConfigs = recentConfigs.filter(id => id !== configId);
    await this.set('recentConfigs', filteredConfigs);
  }

  /**
   * 验证配置
   */
  validateConfig(config: Partial<GlobalConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证传输协议
    if (config.defaultTransport && !['stdio', 'sse', 'streamable'].includes(config.defaultTransport)) {
      errors.push('无效的默认传输协议');
    }

    // 验证端口
    if (config.defaultPort && (config.defaultPort < 1024 || config.defaultPort > 65535)) {
      errors.push('端口必须在 1024-65535 范围内');
    }

    // 验证主题
    if (config.theme && !['default', 'dark-red-cyber', 'compact', 'fancy'].includes(config.theme)) {
      errors.push('无效的主题设置');
    }

    // 验证超时时间
    if (config.serverTimeout && (config.serverTimeout < 5000 || config.serverTimeout > 300000)) {
      errors.push('服务器超时时间必须在 5-300 秒范围内');
    }

    // 验证重试次数
    if (config.maxRetries && (config.maxRetries < 0 || config.maxRetries > 10)) {
      errors.push('最大重试次数必须在 0-10 范围内');
    }

    // 验证重试延迟
    if (config.retryDelay && (config.retryDelay < 100 || config.retryDelay > 10000)) {
      errors.push('重试延迟必须在 100-10000 毫秒范围内');
    }

    // 验证日志级别
    if (config.logLevel && !['error', 'warn', 'info', 'debug'].includes(config.logLevel)) {
      errors.push('无效的日志级别');
    }

    // 验证最大最近配置数
    if (config.maxRecentConfigs && (config.maxRecentConfigs < 1 || config.maxRecentConfigs > 50)) {
      errors.push('最大最近配置数必须在 1-50 范围内');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 导出配置
   */
  async exportConfig(): Promise<GlobalConfig> {
    return { ...await this.getConfig() };
  }

  /**
   * 导入配置
   */
  async importConfig(config: Partial<GlobalConfig>): Promise<{ success: boolean; errors: string[] }> {
    const validation = this.validateConfig(config);
    
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    try {
      await this.setMultiple(config);
      return {
        success: true,
        errors: []
      };
    } catch (error) {
      return {
        success: false,
        errors: [`导入配置失败: ${error instanceof Error ? error.message : '未知错误'}`]
      };
    }
  }

  /**
   * 获取配置统计信息
   */
  async getStats(): Promise<{
    configPath: string;
    configSize: number;
    lastModified: Date;
    recentConfigsCount: number;
  }> {
    await this.initConfig();
    const fs = await import('fs');
    const stats = fs.statSync(this.config.path);
    
    return {
      configPath: this.config.path,
      configSize: stats.size,
      lastModified: stats.mtime,
      recentConfigsCount: (await this.get('recentConfigs')).length
    };
  }

  /**
   * 监听配置变化
   */
  async onConfigChange(callback: (newConfig: GlobalConfig, oldConfig: GlobalConfig) => void): Promise<() => void> {
    await this.initConfig();
    let oldConfig = { ...await this.getConfig() };
    
    const chokidar = await import('chokidar');
    const watcher = chokidar.watch(this.config.path);
    
    watcher.on('change', async () => {
      const newConfig = { ...await this.getConfig() };
      callback(newConfig, oldConfig);
      oldConfig = newConfig;
    });

    return () => watcher.close();
  }
}

// 单例实例
export const configManager = new ConfigManager();