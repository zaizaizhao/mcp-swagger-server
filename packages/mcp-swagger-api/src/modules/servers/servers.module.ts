import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { ServersController } from './servers.controller';
import { ServerManagerService } from './services/server-manager.service';
import { ServerLifecycleService } from './services/server-lifecycle.service';
import { ServerHealthService } from './services/server-health.service';
import { ServerMetricsService } from './services/server-metrics.service';
import { ProcessManagerService } from './services/process-manager.service';
import { ProcessHealthService } from './services/process-health.service';
import { ProcessErrorHandlerService } from './services/process-error-handler.service';

import { MCPServerEntity } from '../../database/entities/mcp-server.entity';
import { AuthConfigEntity } from '../../database/entities/auth-config.entity';
import { LogEntryEntity } from '../../database/entities/log-entry.entity';
import { ProcessInfoEntity } from './entities/process-info.entity';
import { HealthCheckResultEntity } from './entities/health-check-result.entity';
import { ProcessLogEntity } from './entities/process-log.entity';

// 导入其他模块的服务
import { MCPModule } from '../mcp/mcp.module';
import { OpenAPIModule } from '../openapi/openapi.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MCPServerEntity,
      AuthConfigEntity,
      LogEntryEntity,
      ProcessInfoEntity,
      HealthCheckResultEntity,
      ProcessLogEntity,
    ]),
    EventEmitterModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    ConfigModule,
    ScheduleModule.forRoot(),
    MCPModule,
    OpenAPIModule,
    DocumentsModule,
  ],
  controllers: [ServersController],
  providers: [
    ServerManagerService,
    ServerLifecycleService,
    ServerHealthService,
    ServerMetricsService,
    ProcessManagerService,
    ProcessHealthService,
    ProcessErrorHandlerService,
  ],
  exports: [
    ServerManagerService,
    ServerLifecycleService,
    ServerHealthService,
    ServerMetricsService,
    ProcessManagerService,
    ProcessHealthService,
    ProcessErrorHandlerService,
  ],
})
export class ServersModule {}