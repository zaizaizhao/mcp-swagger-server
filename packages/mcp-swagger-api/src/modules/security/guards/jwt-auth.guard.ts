import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PUBLIC_KEY } from '../decorators/permissions.decorator';
import { AuthService } from '../services/auth.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否为公共端点
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    
    try {
      // 调用父类的 canActivate 方法进行 JWT 验证
      const result = await super.canActivate(context);
      
      if (!result) {
        return false;
      }

      // 验证用户状态
      const user = request.user;
      if (!user) {
        throw new UnauthorizedException('用户信息无效');
      }

      // 记录API访问
      await this.logApiAccess(request);

      return true;
    } catch (error) {
      this.logger.warn(`JWT认证失败: ${error.message}`, {
        ip: this.getClientIp(request),
        userAgent: request.get('User-Agent'),
        path: request.path,
        method: request.method,
      });
      
      throw new UnauthorizedException('认证失败');
    }
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      const request = context.switchToHttp().getRequest<Request>();
      
      this.logger.warn('JWT认证处理失败', {
        error: err?.message,
        info: info?.message,
        ip: this.getClientIp(request),
        path: request.path,
      });
      
      throw err || new UnauthorizedException('认证令牌无效');
    }
    
    return user;
  }

  /**
   * 记录API访问
   */
  private async logApiAccess(request: Request): Promise<void> {
    try {
      const user = request.user as any;
      const ipAddress = this.getClientIp(request);
      const userAgent = request.get('User-Agent') || '';
      const path = request.path;
      const method = request.method;

      // 记录API访问日志
      await this.authService['auditService']?.logApiAccess(
        user?.id,
        method,
        path,
        200, // statusCode
        ipAddress,
        userAgent,
      );
    } catch (error) {
      // 记录日志失败不应该影响请求处理
      this.logger.error('记录API访问日志失败', error);
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