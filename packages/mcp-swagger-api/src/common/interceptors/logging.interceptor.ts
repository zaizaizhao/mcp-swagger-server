import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  constructor(private readonly configService: AppConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.configService.debugMode && this.configService.isProduction) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, headers, body, query } = request;
    const userAgent = headers['user-agent'] || 'Unknown';
    const ip = request.ip || request.connection.remoteAddress || 'Unknown';
    
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    // 记录请求日志
    this.logger.log({
      type: 'request',
      requestId,
      method,
      url,
      userAgent,
      ip,
      contentType: headers['content-type'],
      contentLength: headers['content-length'],
      query: Object.keys(query).length > 0 ? query : undefined,
      hasBody: !!body && Object.keys(body).length > 0,
      timestamp: new Date().toISOString(),
    });

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          this.logger.log({
            type: 'response',
            requestId,
            method,
            url,
            statusCode: response.statusCode,
            duration: `${duration}ms`,
            responseSize: data ? JSON.stringify(data).length : 0,
            timestamp: new Date().toISOString(),
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error({
            type: 'error',
            requestId,
            method,
            url,
            statusCode: response.statusCode || 500,
            duration: `${duration}ms`,
            error: {
              name: error.name,
              message: error.message,
              stack: this.configService.debugMode ? error.stack : undefined,
            },
            timestamp: new Date().toISOString(),
          });
        },
      }),
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
