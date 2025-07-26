import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import * as cors from 'cors';
import * as helmet from 'helmet';
import * as compression from 'compression';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    const configService = app.get(ConfigService);

    // 安全中间件
    app.use(helmet.default({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));
    
    app.use(compression());

    // CORS配置
    const corsOrigins = configService.get<string>('CORS_ORIGINS', 'http://localhost:5173').split(',');
    app.use(cors({
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'x-api-key', 
        'mcp-session-id',
        'accept',
        'origin',
        'x-requested-with'
      ],
    }));

    // 全局前缀
    app.setGlobalPrefix('api', {
      exclude: ['/', '/health', '/metrics', '/favicon.ico']
    });

    // 全局验证管道
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        errorHttpStatusCode: 422,
      })
    );

    // Swagger文档配置
    if (configService.get<string>('NODE_ENV') !== 'production') {
      const config = new DocumentBuilder()
        .setTitle('MCP Swagger API')
        .setDescription(`
          API服务器用于管理OpenAPI规范到MCP工具的转换和动态服务器管理。
          
          ## 主要功能
          - OpenAPI规范解析和验证
          - 动态MCP工具生成
          - MCP服务器管理
          - 实时协议处理
          
          ## 认证方式
          使用API Key认证，请在请求头中添加 x-api-key
        `)
        .setVersion('1.0')
        .addServer(`http://localhost:${configService.get<number>('PORT', 3001)}`, 'Development')
        .addApiKey(
          { 
            type: 'apiKey', 
            name: 'x-api-key', 
            in: 'header',
            description: 'API密钥认证'
          }, 
          'apiKey'
        )
        .addTag('OpenAPI', 'OpenAPI规范管理')
        .addTag('MCP', 'MCP协议处理')
        .addTag('Health', '健康检查')
        .addTag('Config', '配置管理')
        .build();

      const document = SwaggerModule.createDocument(app, config);

      // 强制所有接口都加上 security 字段，确保Swagger UI调试时自动携带 x-api-key
      Object.values(document.paths).forEach((pathItem: any) => {
        ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].forEach(method => {
          if (pathItem[method]) {
            if (!pathItem[method].security) {
              pathItem[method].security = [{ apiKey: [] }];
            }
          }
        });
      });

      SwaggerModule.setup('api/docs', app, document, {
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          filter: true,
          tryItOutEnabled: true,
        },
        customSiteTitle: 'MCP Swagger API Documentation',
        customfavIcon: '/favicon.ico',
        customCssUrl: '/swagger-ui-custom.css',
      });

      logger.log(`📚 Swagger documentation available at: http://localhost:${configService.get<number>('PORT', 3001)}/api/docs`);
    }

    // 启动应用
    const port = configService.get<number>('PORT', 3001);
    await app.listen(port, '0.0.0.0');

    logger.log(`🚀 Application is running on: http://localhost:${port}`);
    logger.log(`🏥 Health check available at: http://localhost:${port}/health`);
    logger.log(`🎛️ MCP Server running on port: ${configService.get<number>('MCP_PORT', 3322)}`);
    
    // 优雅关闭处理
    process.on('SIGTERM', async () => {
      logger.log('🛑 SIGTERM received, shutting down gracefully');
      await app.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.log('🛑 SIGINT received, shutting down gracefully');
      await app.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

bootstrap();
