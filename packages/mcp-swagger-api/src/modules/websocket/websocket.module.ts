import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

import { DocumentsModule } from '../documents/documents.module';

import { MonitoringGateway } from './websocket.gateway';
import { AlertService } from './services/alert.service';
import { NotificationService } from './services/notification.service';
import { WebSocketMetricsService } from './services/websocket-metrics.service';

import { MCPServerEntity } from '../../database/entities/mcp-server.entity';
import { LogEntryEntity } from '../../database/entities/log-entry.entity';

import { ServerMetricsService } from '../servers/services/server-metrics.service';
import { ServerHealthService } from '../servers/services/server-health.service';
import { ServerManagerService } from '../servers/services/server-manager.service';
import { ServerLifecycleService } from '../servers/services/server-lifecycle.service';
import { ParserService } from '../openapi/services/parser.service';
import { ValidatorService } from '../openapi/services/validator.service';
import { AppConfigService } from '../../config/app-config.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MCPServerEntity, LogEntryEntity]),
    EventEmitterModule,
    ConfigModule,
    HttpModule,
    DocumentsModule,
  ],
  providers: [
    MonitoringGateway,
    AlertService,
    NotificationService,
    WebSocketMetricsService,
    ServerMetricsService,
    ServerHealthService,
    ServerManagerService,
    ServerLifecycleService,
    ParserService,
    ValidatorService,
    AppConfigService,
  ],
  exports: [
    MonitoringGateway,
    AlertService,
    NotificationService,
    WebSocketMetricsService,
  ],
})
export class WebSocketModule {}