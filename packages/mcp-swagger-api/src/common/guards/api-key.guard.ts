import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ApiKeyService } from '../../modules/security/services/api-key.service';
import { AuditService } from '../../modules/security/services/audit.service';
import { AuditAction, AuditLevel, AuditStatus } from '../../database/entities/audit-log.entity';

export const PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(PUBLIC_KEY, true);

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyService: ApiKeyService,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否为公开端点
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      await this.logFailedAttempt(request, 'API密钥缺失');
      throw new UnauthorizedException('API密钥缺失');
    }

    try {
      const validation = await this.apiKeyService.validateApiKey(
        apiKey,
        this.getClientIp(request),
        request.get('User-Agent'),
        request.method,
        request.path,
      );

      if (!validation.valid) {
        await this.logFailedAttempt(request, validation.reason || 'API密钥验证失败');
        throw new UnauthorizedException(validation.reason || 'API密钥验证失败');
      }

      // 将API密钥信息添加到请求对象中
      (request as any).apiKey = validation.apiKey;
      (request as any).user = validation.apiKey?.user;

      // 记录API访问日志
      await this.logApiAccess(request, validation.apiKey?.id);

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error('API密钥验证过程中发生错误', error);
      await this.logFailedAttempt(request, 'API密钥验证过程中发生错误');
      throw new UnauthorizedException('API密钥验证失败');
    }
  }

  /**
   * 从请求中提取API密钥
   */
  private extractApiKey(request: Request): string | null {
    // 从Authorization头中提取（Bearer token格式）
    const authHeader = request.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // 从X-API-Key头中提取
    const apiKeyHeader = request.get('X-API-Key');
    if (apiKeyHeader) {
      return apiKeyHeader;
    }

    // 从查询参数中提取
    const apiKeyQuery = request.query.api_key as string;
    if (apiKeyQuery) {
      return apiKeyQuery;
    }

    return null;
  }

  /**
   * 获取客户端IP地址
   */
  private getClientIp(request: Request): string {
    return (
      (request.get('X-Forwarded-For') || '')
        .split(',')
        .pop()
        ?.trim() ||
      request.get('X-Real-IP') ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * 记录API密钥验证失败日志
   */
  private async logFailedAttempt(request: Request, reason: string): Promise<void> {
    try {
      await this.auditService.log({
        action: AuditAction.API_KEY_USED,
        level: AuditLevel.WARNING,
        status: AuditStatus.FAILED,
        resource: 'api-keys',
        ipAddress: this.getClientIp(request),
        userAgent: request.get('User-Agent'),
        details: {
          reason,
          method: request.method,
          path: request.path,
          query: request.query,
        },
      });
    } catch (error) {
      this.logger.error('记录API密钥验证失败日志时发生错误', error);
    }
  }

  /**
   * 记录API访问日志
   */
  private async logApiAccess(request: Request, apiKeyId?: string): Promise<void> {
    try {
      await this.auditService.log({
        action: AuditAction.API_CALLED,
        level: AuditLevel.INFO,
        status: AuditStatus.SUCCESS,
        resource: 'api',
        resourceId: apiKeyId,
        ipAddress: this.getClientIp(request),
        userAgent: request.get('User-Agent'),
        details: {
          method: request.method,
          path: request.path,
          query: request.query,
        },
      });
    } catch (error) {
      this.logger.error('记录API访问日志时发生错误', error);
    }
  }
}
