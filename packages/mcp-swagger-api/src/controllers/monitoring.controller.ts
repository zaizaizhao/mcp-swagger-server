import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MCPMonitoringService } from '../services/monitoring.service';
import { JwtAuthGuard } from '../modules/security/guards/jwt-auth.guard';

@ApiTags('Monitoring')
@Controller('api/v1/monitoring')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MonitoringController {
  constructor(private readonly monitoringService: MCPMonitoringService) {}

  @Get('metrics')
  @ApiOperation({ summary: '获取系统指标' })
  @ApiResponse({ status: 200, description: '系统指标数据' })
  getMetrics() {
    return {
      status: 'success',
      data: this.monitoringService.getMetrics(),
    };
  }

  @Get('health')
  @ApiOperation({ summary: '获取系统健康状态' })
  @ApiResponse({ status: 200, description: '系统健康状态' })
  getHealth() {
    return {
      status: 'success',
      data: this.monitoringService.getHealthStatus(),
    };
  }

  @Get('events')
  @ApiOperation({ summary: '获取最近事件' })
  @ApiResponse({ status: 200, description: '最近事件列表' })
  getEvents() {
    return {
      status: 'success',
      data: this.monitoringService.getRecentEvents(),
    };
  }

  @Get('events/errors')
  @ApiOperation({ summary: '获取错误事件' })
  @ApiResponse({ status: 200, description: '错误事件列表' })
  getErrorEvents() {
    return {
      status: 'success',
      data: this.monitoringService.getEventsByType('error'),
    };
  }
}
