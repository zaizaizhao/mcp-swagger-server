import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PUBLIC_KEY } from '../decorators/permissions.decorator';
import { AuthService } from '../services/auth.service';
import { User } from '../../../database/entities/user.entity';
import { AuditAction, AuditLevel, AuditStatus } from '../../../database/entities/audit-log.entity';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否为公共端点
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // 获取所需权限
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 如果没有设置权限要求，则允许访问
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as User;

    if (!user) {
      throw new ForbiddenException('用户信息无效');
    }

    try {
      // 检查用户是否具有所需权限
      const hasPermission = await this.checkUserPermissions(
        user,
        requiredPermissions,
      );

      if (!hasPermission) {
        // 记录权限检查失败
        await this.logPermissionDenied(
          request,
          user.id,
          requiredPermissions,
        );

        throw new ForbiddenException(
          `权限不足，需要以下权限之一: ${requiredPermissions.join(', ')}`,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error('权限检查过程中发生错误', {
        userId: user.id,
        requiredPermissions,
        error: error.message,
      });

      throw new ForbiddenException('权限检查失败');
    }
  }

  /**
   * 检查用户权限
   */
  private async checkUserPermissions(
    user: User,
    requiredPermissions: string[],
  ): Promise<boolean> {
    // 超级管理员拥有所有权限
    if (user.hasRole('SUPER_ADMIN')) {
      return true;
    }

    // 检查用户是否具有任一所需权限
    for (const permission of requiredPermissions) {
      const hasPermission = await this.authService.checkPermission(
        user.id,
        permission,
      );
      
      if (hasPermission) {
        return true;
      }
    }

    return false;
  }

  /**
   * 记录权限拒绝日志
   */
  private async logPermissionDenied(
    request: Request,
    userId: string,
    requiredPermissions: string[],
  ): Promise<void> {
    try {
      const ipAddress = this.getClientIp(request);
      const userAgent = request.get('User-Agent') || '';
      const path = request.path;
      const method = request.method;

      // 记录权限拒绝日志
      await this.authService['auditService']?.log({
        action: AuditAction.PERMISSION_REVOKED,
        level: AuditLevel.WARNING,
        status: AuditStatus.FAILED,
        userId,
        resource: 'security',
        ipAddress,
        userAgent,
        details: {
          path,
          method,
          requiredPermissions,
          reason: '权限不足',
        },
      });
    } catch (error) {
      this.logger.error('记录权限拒绝日志失败', error);
    }
  }

  /**
   * 获取客户端IP地址
   */
  private getClientIp(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (request.headers['x-real-ip'] as string) ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      ''
    );
  }
}