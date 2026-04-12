import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { resolve } from 'path';
import { getDatabaseType, verifySqliteDatabasePath } from './database/db-compat';

// 配置
import { AppConfigService } from './config/app-config.service';
import { validationSchema } from './config/validation.schema';

// 模块
import { DatabaseModule } from './database/database.module';
import { CoreModule } from './modules/core/core.module';
import { SecurityModule } from './modules/security/security.module';
import { OpenAPIModule } from './modules/openapi/openapi.module';
import { MCPModule } from './modules/mcp/mcp.module';
import { ServersModule } from './modules/servers/servers.module';
import { HealthModule } from './modules/health/health.module';
import { ConfigModule as AppConfigModule } from './modules/config/config.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { AiAssistantModule } from './modules/ai-assistant/ai-assistant.module';
import { DocumentsModule } from './modules/documents/documents.module';

// 通用组件
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { MCPExceptionFilter } from './common/filters/mcp-exception.filter';

// 控制器
import { AppController } from './app.controller';


const packageRoot = resolve(__dirname, '..', '..');
const workspaceRoot = resolve(packageRoot, '..', '..');
const envFiles = [
  '.env.local',
  '.env.development',
  '.env.production',
  '.env',
];
const envFilePath = [
  ...envFiles.map(file => resolve(packageRoot, file)),
  ...envFiles.map(file => resolve(process.cwd(), file)),
  ...envFiles.map(file => resolve(workspaceRoot, file)),
];


@Module({
  imports: [
    // 全局配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
      expandVariables: true,
    }),

    // 调度任务模块
    ScheduleModule.forRoot(),

    // 事件发射器模块
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),

    // API限流模块
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('THROTTLE_TTL', 60) * 1000, // 时间窗口(毫秒)
          limit: configService.get<number>('THROTTLE_LIMIT', 10), // 请求限制
        },
      ],
      inject: [ConfigService],
    }),

    // 健康检查模块
    TerminusModule,

    // 数据库模块
    DatabaseModule,

    // 核心模块（包含系统初始化）
    CoreModule,

    // 功能模块
    SecurityModule,
    OpenAPIModule,
    MCPModule,
    ServersModule,
    HealthModule,
    AppConfigModule,
    WebSocketModule,
    AiAssistantModule,
    DocumentsModule,
  ],
  controllers: [AppController],
  providers: [
    // 全局配置服务
    AppConfigService,

    // 全局守卫
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // 全局拦截器
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },

    // 全局异常过滤器
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: MCPExceptionFilter,
    },
  ],
  exports: [AppConfigService],
})
export class AppModule {
  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const logger = new (require('@nestjs/common').Logger)('AppModule');
    const dbType = getDatabaseType(this.configService.get<string>('DB_TYPE'));

    logger.log('Application modules initialized');
    logger.log(`Environment: ${this.configService.get('NODE_ENV')}`);
    logger.log(`API Port: ${this.configService.get('PORT')}`);
    logger.log(`MCP Port: ${this.configService.get('MCP_PORT')}`);
    logger.log(`Database mode: ${dbType}`);

    if (dbType === 'sqlite') {
      const sqlitePath = verifySqliteDatabasePath(this.configService);
      logger.log(`SQLite database path: ${sqlitePath}`);
    } else {
      logger.log(
        `PostgreSQL database: ${this.configService.get('DB_HOST')}:${this.configService.get('DB_PORT')}/${this.configService.get('DB_DATABASE')}`,
      );
    }

    if (this.configService.get('METRICS_ENABLED')) {
      logger.log('Metrics collection enabled');
    }

    logger.log('JWT authentication enabled');
  }
}
