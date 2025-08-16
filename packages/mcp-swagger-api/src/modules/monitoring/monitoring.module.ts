import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MCPMonitoringService } from '../../services/monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [EventEmitterModule, SecurityModule],
  controllers: [MonitoringController],
  providers: [MCPMonitoringService],
  exports: [MCPMonitoringService],
})
export class MonitoringModule {}
