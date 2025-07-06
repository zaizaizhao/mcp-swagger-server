import { 
  AuthManager, 
  AuthConfig, 
  BearerConfig, 
  AuthContext, 
  AuthError, 
  AuthErrorType 
} from './types';

/**
 * Bearer Token 认证管理器
 * 负责处理Bearer Token认证的所有逻辑
 */
export class BearerAuthManager implements AuthManager {
  private config: AuthConfig;
  private bearerConfig: BearerConfig;

  constructor(config: AuthConfig) {
    this.config = config;
    
    if (!config.bearer) {
      throw new AuthError(
        AuthErrorType.CONFIG_INVALID,
        'Bearer configuration is required for Bearer authentication'
      );
    }
    
    this.bearerConfig = config.bearer;
    this.validateConfig();
  }

  /**
   * 获取认证头
   */
  async getAuthHeaders(context?: AuthContext): Promise<Record<string, string>> {
    try {
      const token = await this.getToken();
      
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`
      };

      // 调试模式下记录认证信息（不记录完整token）
      if (this.config.debug) {
        console.debug(`[BearerAuth] Added Authorization header for ${context?.method || 'unknown'} ${context?.path || 'unknown'}`);
        console.debug(`[BearerAuth] Token source: ${this.bearerConfig.source}`);
        console.debug(`[BearerAuth] Token preview: ${token.substring(0, 10)}...`);
      }

      return headers;
    } catch (error) {
      throw new AuthError(
        AuthErrorType.TOKEN_INVALID,
        `Failed to get Bearer token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { context },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 获取Token
   */
  async getToken(): Promise<string> {
    switch (this.bearerConfig.source) {
      case 'static':
        return this.getStaticToken();
      
      case 'env':
        return this.getEnvToken();
      
      case 'function':
        return this.getFunctionToken();
      
      default:
        throw new AuthError(
          AuthErrorType.CONFIG_INVALID,
          `Unsupported Bearer token source: ${this.bearerConfig.source}`
        );
    }
  }

  /**
   * 验证配置
   */
  validateConfig(): boolean {
    const { bearer } = this.config;
    
    if (!bearer) {
      throw new AuthError(
        AuthErrorType.CONFIG_INVALID,
        'Bearer configuration is required'
      );
    }

    switch (bearer.source) {
      case 'static':
        if (!bearer.token || bearer.token.trim() === '') {
          throw new AuthError(
            AuthErrorType.TOKEN_MISSING,
            'Bearer token is required for static source'
          );
        }
        break;
      
      case 'env':
        if (!bearer.envName || bearer.envName.trim() === '') {
          throw new AuthError(
            AuthErrorType.CONFIG_INVALID,
            'Environment variable name is required for env source'
          );
        }
        break;
      
      case 'function':
        if (!bearer.provider || typeof bearer.provider !== 'function') {
          throw new AuthError(
            AuthErrorType.CONFIG_INVALID,
            'Provider function is required for function source'
          );
        }
        break;
      
      default:
        throw new AuthError(
          AuthErrorType.CONFIG_INVALID,
          `Unsupported Bearer token source: ${bearer.source}`
        );
    }

    return true;
  }

  /**
   * 处理认证错误
   */
  async handleAuthError(error: AuthError): Promise<void> {
    if (this.config.debug) {
      console.error('[BearerAuth] Authentication error:', {
        type: error.type,
        message: error.message,
        details: error.details
      });
    }

    // 可以在这里添加重试逻辑、刷新token等处理
    switch (error.type) {
      case AuthErrorType.TOKEN_EXPIRED:
        // 未来可以添加token刷新逻辑
        break;
      
      case AuthErrorType.TOKEN_INVALID:
        // 未来可以添加token重新获取逻辑
        break;
      
      default:
        // 其他错误直接抛出
        break;
    }
  }

  /**
   * 获取静态Token
   */
  private getStaticToken(): string {
    const token = this.bearerConfig.token;
    
    if (!token || token.trim() === '') {
      throw new AuthError(
        AuthErrorType.TOKEN_MISSING,
        'Static Bearer token is empty'
      );
    }

    return token.trim();
  }

  /**
   * 从环境变量获取Token
   */
  private getEnvToken(): string {
    const envName = this.bearerConfig.envName || 'API_TOKEN';
    const token = process.env[envName];
    
    if (!token || token.trim() === '') {
      throw new AuthError(
        AuthErrorType.ENV_VAR_MISSING,
        `Environment variable '${envName}' is not set or empty`,
        { envName }
      );
    }

    return token.trim();
  }

  /**
   * 通过函数获取Token
   */
  private async getFunctionToken(): Promise<string> {
    if (!this.bearerConfig.provider) {
      throw new AuthError(
        AuthErrorType.CONFIG_INVALID,
        'Token provider function is not configured'
      );
    }

    try {
      const token = await this.bearerConfig.provider();
      
      if (!token || token.trim() === '') {
        throw new AuthError(
          AuthErrorType.TOKEN_MISSING,
          'Provider function returned empty token'
        );
      }

      return token.trim();
    } catch (error) {
      throw new AuthError(
        AuthErrorType.TOKEN_INVALID,
        `Failed to get token from provider: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }
}
