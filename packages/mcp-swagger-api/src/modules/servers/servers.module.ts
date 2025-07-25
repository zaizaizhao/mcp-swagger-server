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

import { MCPServerEntity } from '../../database/entities/mcp-server.entity';
import { AuthConfigEntity } from '../../database/entities/auth-config.entity';
import { LogEntryEntity } from '../../database/entities/log-entry.entity';

// 导入其他模块的服务
import { MCPModule } from '../mcp/mcp.module';
import { OpenAPIModule } from '../openapi/openapi.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MCPServerEntity,
      AuthConfigEntity,
      LogEntryEntity,
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
  ],
  controllers: [ServersController],
  providers: [
    ServerManagerService,
    ServerLifecycleService,
    ServerHealthService,
    ServerMetricsService,
  ],
  exports: [
    ServerManagerService,
    ServerLifecycleService,
    ServerHealthService,
    ServerMetricsService,
  ],
})
export class ServersModule {}