/**
 * 认证配置接口
 * 设计为可扩展架构，便于后续添加其他认证方式
 */
export interface AuthConfig {
  type: 'bearer' | 'apikey' | 'basic' | 'oauth2' | 'custom' | 'none';
  
  // Bearer Token 认证配置
  bearer?: BearerConfig;
  
  // 预留其他认证方式的扩展点
  apikey?: ApiKeyConfig;
  basic?: BasicConfig;
  oauth2?: OAuth2Config;
  custom?: CustomConfig;
  
  // 通用配置
  debug?: boolean;
  timeout?: number;
}

/**
 * Bearer Token 认证配置
 */
export interface BearerConfig {
  token: string;
  source: 'static' | 'env' | 'function';
  envName?: string;
  provider?: () => Promise<string>;
}

/**
 * API Key 认证配置（预留扩展）
 */
export interface ApiKeyConfig {
  key: string;
  header?: string; // 默认为 'X-API-Key'
  source: 'static' | 'env';
  envName?: string;
}

/**
 * Basic 认证配置（预留扩展）
 */
export interface BasicConfig {
  username: string;
  password: string;
  source: 'static' | 'env';
}

/**
 * OAuth2 认证配置（预留扩展）
 */
export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  scope?: string;
  grantType: 'client_credentials' | 'authorization_code';
}

/**
 * 自定义认证配置（预留扩展）
 */
export interface CustomConfig {
  headers: Record<string, string>;
  provider?: (context: AuthContext) => Promise<Record<string, string>>;
}

/**
 * 认证上下文
 */
export interface AuthContext {
  method: string;
  path: string;
  operation?: string;
  args?: any;
}

/**
 * 认证管理器接口
 * 所有认证方式都需要实现此接口
 */
export interface AuthManager {
  /**
   * 获取认证头
   */
  getAuthHeaders(context?: AuthContext): Promise<Record<string, string>>;
  
  /**
   * 获取Token（如果适用）
   */
  getToken?(): Promise<string>;
  
  /**
   * 验证配置
   */
  validateConfig(): boolean;
  
  /**
   * 处理认证错误（可选）
   */
  handleAuthError?(error: AuthError): Promise<void>;
}

/**
 * 认证错误类型
 */
export enum AuthErrorType {
  TOKEN_MISSING = 'TOKEN_MISSING',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  CONFIG_INVALID = 'CONFIG_INVALID',
  ENV_VAR_MISSING = 'ENV_VAR_MISSING',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * 认证错误类
 */
export class AuthError extends Error {
  constructor(
    public type: AuthErrorType,
    message: string,
    public details?: any,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * 认证策略工厂接口（为扩展预留）
 */
export interface AuthStrategyFactory {
  create(config: AuthConfig): AuthManager;
  supports(type: string): boolean;
}
