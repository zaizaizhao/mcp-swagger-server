import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

import { DocumentsModule } from '../documents/documents.module';
import { ServersModule } from '../servers/servers.module';

import { MonitoringGateway } from './websocket.gateway';
import { AlertService } from './services/alert.service';
import { NotificationService } from './services/notification.service';
import { WebSocketMetricsService } from './services/websocket-metrics.service';

import { MCPServerEntity } from '../../database/entities/mcp-server.entity';
import { LogEntryEntity } from '../../database/entities/log-entry.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MCPServerEntity, LogEntryEntity]),
    EventEmitterModule,
    ConfigModule,
    HttpModule,
    DocumentsModule,
    ServersModule,
  ],
  providers: [
    MonitoringGateway,
    AlertService,
    NotificationService,
    WebSocketMetricsService,
  ],
  exports: [
    MonitoringGateway,
    AlertService,
    NotificationService,
    WebSocketMetricsService,
  ],
})
export class WebSocketModule {}