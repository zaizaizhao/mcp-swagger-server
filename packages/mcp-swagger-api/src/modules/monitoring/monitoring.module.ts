import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MCPMonitoringService } from '../../services/monitoring.service';
import { MonitoringController } from '../../controllers/monitoring.controller';

@Module({
  imports: [EventEmitterModule],
  controllers: [MonitoringController],
  providers: [MCPMonitoringService],
  exports: [MCPMonitoringService],
})
export class MonitoringModule {}
