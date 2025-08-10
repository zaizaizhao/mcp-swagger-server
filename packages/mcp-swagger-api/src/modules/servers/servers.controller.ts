import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpStatus,
  HttpException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ServerManagerService } from './services/server-manager.service';
import { ServerHealthService } from './services/server-health.service';
import { ServerMetricsService } from './services/server-metrics.service';
import { ProcessManagerService } from './services/process-manager.service';
import { ProcessHealthService } from './services/process-health.service';
import { ProcessErrorHandlerService } from './services/process-error-handler.service';
import { ProcessResourceMonitorService } from './services/process-resource-monitor.service';
import { ProcessLogMonitorService } from './services/process-log-monitor.service';
import { LogLevel } from './interfaces/process.interface';
import {
  CreateServerDto,
  UpdateServerDto,
  ServerQueryDto,
  ServerActionDto,
  BatchServerActionDto,
  MetricsQueryDto,
  HealthCheckQueryDto,
  LogQueryDto,
  ServerResponseDto,
  PaginatedResponseDto,
  OperationResultDto,
} from './dto/server.dto';


@ApiTags('服务器管理')
@Controller('v1/servers')
// @UseGuards(AuthGuard) // TODO: 添加认证守卫
export class ServersController {
  private readonly logger = new Logger(ServersController.name);

  constructor(
    private readonly serverManager: ServerManagerService,
    private readonly serverHealth: ServerHealthService,
    private readonly serverMetrics: ServerMetricsService,
    private readonly processManager: ProcessManagerService,
    private readonly processHealth: ProcessHealthService,
    private readonly processErrorHandler: ProcessErrorHandlerService,
    private readonly processResourceMonitor: ProcessResourceMonitorService,
    private readonly processLogMonitor: ProcessLogMonitorService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 创建新的MCP服务器
   */
  @Post()
  @ApiOperation({ summary: '创建MCP服务器', description: '根据OpenAPI规范创建新的MCP服务器' })
  @ApiResponse({ status: 201, description: '服务器创建成功', type: ServerResponseDto })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 409, description: '服务器名称或端口冲突' })
  async createServer(@Body() createDto: CreateServerDto): Promise<ServerResponseDto> {
    try {
      this.logger.log(`Creating server: ${createDto.name}`);
      console.log("createDto", createDto);
      const server = await this.serverManager.createServer(createDto);
      
      return server;
    } catch (error) {
      this.logger.error(`Failed to create server: ${error.message}`, error.stack);
      
      if (error.message.includes('already exists') || error.message.includes('already in use')) {
        throw new HttpException(error.message, HttpStatus.CONFLICT);
      }
      
      throw new HttpException(
        `Failed to create server: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * 获取所有服务器列表
   */
  @Get()
  @ApiOperation({ summary: '获取服务器列表', description: '获取所有MCP服务器的分页列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量', example: 10 })
  @ApiQuery({ name: 'status', required: false, description: '状态过滤', enum: ['stopped', 'starting', 'running', 'stopping', 'error'] })
  @ApiQuery({ name: 'transport', required: false, description: '传输类型过滤', enum: ['streamable', 'sse', 'stdio', 'websocket'] })
  @ApiQuery({ name: 'search', required: false, description: '搜索关键词' })
  @ApiQuery({ name: 'tags', required: false, description: '标签过滤（逗号分隔）' })
  @ApiResponse({ status: 200, description: '获取成功', type: PaginatedResponseDto })
  async getAllServers(@Query() query: ServerQueryDto): Promise<PaginatedResponseDto<ServerResponseDto>> {
    try {
      const result = await this.serverManager.getAllServers(query);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to get servers: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to get servers: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 根据ID获取服务器详情
   */
  @Get(':id')
  @ApiOperation({ summary: '获取服务器详情', description: '根据ID获取特定MCP服务器的详细信息' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiResponse({ status: 200, description: '获取成功', type: ServerResponseDto })
  @ApiResponse({ status: 404, description: '服务器不存在' })
  async getServerById(@Param('id') id: string): Promise<ServerResponseDto> {
    try {
      const server = await this.serverManager.getServerById(id);
      return server;
    } catch (error) {
      this.logger.error(`Failed to get server ${id}: ${error.message}`, error.stack);
      
      if (error.message.includes('not found')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        `Failed to get server: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 更新服务器配置
   */
  @Put(':id')
  @ApiOperation({ summary: '更新服务器配置', description: '更新指定MCP服务器的配置信息' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiResponse({ status: 200, description: '更新成功', type: ServerResponseDto })
  @ApiResponse({ status: 404, description: '服务器不存在' })
  @ApiResponse({ status: 409, description: '配置冲突' })
  async updateServer(
    @Param('id') id: string,
    @Body() updateDto: UpdateServerDto
  ): Promise<ServerResponseDto> {
    try {
      this.logger.log(`Updating server ${id}`);
      
      const server = await this.serverManager.updateServer(id, updateDto);
      
      return server;
    } catch (error) {
      this.logger.error(`Failed to update server ${id}: ${error.message}`, error.stack);
      
      if (error.message.includes('not found')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      
      if (error.message.includes('conflict') || error.message.includes('already')) {
        throw new HttpException(error.message, HttpStatus.CONFLICT);
      }
      
      throw new HttpException(
        `Failed to update server: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * 删除服务器
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除服务器', description: '删除指定的MCP服务器' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiResponse({ status: 200, description: '删除成功', type: OperationResultDto })
  @ApiResponse({ status: 404, description: '服务器不存在' })
  async deleteServer(@Param('id') id: string): Promise<OperationResultDto> {
    try {
      this.logger.log(`Deleting server ${id}`);
      
      await this.serverManager.deleteServer(id);
      
      return {
        success: true,
        message: 'Server deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete server ${id}: ${error.message}`, error.stack);
      
      if (error.message.includes('not found')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        `Failed to delete server: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 服务器操作（启动/停止/重启）
   */
  @Post(':id/actions')
  @ApiOperation({ summary: '服务器操作', description: '对指定服务器执行启动、停止或重启操作' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiResponse({ status: 200, description: '操作成功', type: OperationResultDto })
  @ApiResponse({ status: 404, description: '服务器不存在' })
  @ApiResponse({ status: 409, description: '操作冲突' })
  async performServerAction(
    @Param('id') id: string,
    @Body() actionDto: ServerActionDto
  ): Promise<OperationResultDto> {
    try {
      this.logger.log(`🛑 [CONTROLLER DEBUG] performServerAction called - ID: ${id}, Action: ${actionDto.action}, Force: ${actionDto.force}`);
      this.logger.log(`🛑 [CONTROLLER DEBUG] Request body:`, JSON.stringify(actionDto));
      
      switch (actionDto.action) {
        case 'start':
          this.logger.log(`🛑 [CONTROLLER DEBUG] Calling serverManager.startServer(${id})`);
          await this.serverManager.startServer(id);
          break;
        case 'stop':
          this.logger.log(`🛑 [CONTROLLER DEBUG] Calling serverManager.stopServer(${id})`);
          await this.serverManager.stopServer(id);
          break;
        case 'restart':
          this.logger.log(`🛑 [CONTROLLER DEBUG] Calling serverManager.restartServer(${id})`);
          await this.serverManager.restartServer(id);
          break;
        default:
          throw new Error(`Unknown action: ${actionDto.action}`);
      }
      
      const result = {
        success: true,
        message: `Server ${actionDto.action} operation completed successfully`,
      };
      this.logger.log(`🛑 [CONTROLLER DEBUG] Operation completed successfully:`, result);
      return result;
    } catch (error) {
      this.logger.error(`🛑 [CONTROLLER DEBUG] Failed to ${actionDto.action} server ${id}: ${error.message}`, error.stack);
      
      if (error.message.includes('not found')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      
      if (error.message.includes('already')) {
        throw new HttpException(error.message, HttpStatus.CONFLICT);
      }
      
      throw new HttpException(
        `Failed to ${actionDto.action} server: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 批量服务器操作
   */
  @Post('batch/actions')
  @ApiOperation({ summary: '批量服务器操作', description: '对多个服务器执行批量操作' })
  @ApiResponse({ status: 200, description: '批量操作完成', type: OperationResultDto })
  async performBatchAction(@Body() batchDto: BatchServerActionDto): Promise<OperationResultDto> {
    try {
      this.logger.log(`Performing batch ${batchDto.action} on ${batchDto.serverIds.length} servers`);
      
      const results = [];
      const errors = [];
      
      for (const serverId of batchDto.serverIds) {
        try {
          switch (batchDto.action) {
            case 'start':
              await this.serverManager.startServer(serverId);
              break;
            case 'stop':
              await this.serverManager.stopServer(serverId);
              break;
            case 'restart':
              await this.serverManager.restartServer(serverId);
              break;
          }
          results.push({ serverId, success: true });
        } catch (error) {
          errors.push({ serverId, error: error.message });
          if (!batchDto.force) {
            break; // 如果不是强制模式，遇到错误就停止
          }
        }
      }
      
      return {
        success: errors.length === 0,
        message: `Batch ${batchDto.action} completed. Success: ${results.length}, Errors: ${errors.length}`,
        data: {
          results,
          errors,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to perform batch action: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to perform batch action: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 获取服务器健康状态
   */
  @Get(':id/health')
  @ApiOperation({ summary: '获取服务器健康状态', description: '获取指定服务器的健康状态和指标' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '服务器不存在' })
  async getServerHealth(@Param('id') id: string) {
    try {
      const health = await this.serverHealth.getServerHealth(id);
      return health;
    } catch (error) {
      this.logger.error(`Failed to get server health ${id}: ${error.message}`, error.stack);
      
      if (error.message.includes('not found')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        `Failed to get server health: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 获取所有服务器健康状态
   */
  @Get('health/overview')
  @ApiOperation({ summary: '获取所有服务器健康概览', description: '获取所有服务器的健康状态概览' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getAllServersHealth() {
    try {
      const healthMetrics = await this.serverHealth.getAllServersHealth();
      return healthMetrics;
    } catch (error) {
      this.logger.error(`Failed to get all servers health: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to get servers health: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 获取服务器健康检查历史
   */
  @Get(':id/health/history')
  @ApiOperation({ summary: '获取健康检查历史', description: '获取指定服务器的健康检查历史记录' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiQuery({ name: 'limit', required: false, description: '限制数量', example: 50 })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getHealthCheckHistory(
    @Param('id') id: string,
    @Query() query: HealthCheckQueryDto
  ) {
    try {
      const history = this.serverHealth.getHealthCheckHistory(id, query.limit);
      return history;
    } catch (error) {
      this.logger.error(`Failed to get health check history ${id}: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to get health check history: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 手动执行健康检查
   */
  @Post(':id/health/check')
  @ApiOperation({ summary: '手动健康检查', description: '手动触发指定服务器的健康检查' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiResponse({ status: 200, description: '健康检查完成' })
  async performHealthCheck(@Param('id') id: string) {
    try {
      const result = await this.serverHealth.performHealthCheck(id);
      return result;
    } catch (error) {
      this.logger.error(`Failed to perform health check ${id}: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to perform health check: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 调试端点：获取所有服务器状态
   */
  @Get('debug/states')
  @ApiOperation({ summary: '调试：获取所有服务器状态', description: '获取数据库和内存中的所有服务器状态信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async debugGetAllServerStates() {
    try {
      const debugInfo = await this.serverManager.debugGetAllServerStates();
      return debugInfo;
    } catch (error) {
      this.logger.error(`Failed to get debug server states: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to get debug server states: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 获取服务器指标
   */
  @Get(':id/metrics')
  @ApiOperation({ summary: '获取服务器指标', description: '获取指定服务器的性能指标' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiQuery({ name: 'startTime', required: false, description: '开始时间' })
  @ApiQuery({ name: 'endTime', required: false, description: '结束时间' })
  @ApiQuery({ name: 'interval', required: false, description: '时间间隔', enum: ['minute', 'hour', 'day'] })
  @ApiQuery({ name: 'limit', required: false, description: '限制数量', example: 100 })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getServerMetrics(
    @Param('id') id: string,
    @Query() query: MetricsQueryDto
  ) {
    try {
      const metrics = await this.serverMetrics.getServerMetrics(id, query);
      return metrics;
    } catch (error) {
      this.logger.error(`Failed to get server metrics ${id}: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to get server metrics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 获取服务器性能摘要
   */
  @Get(':id/metrics/summary')
  @ApiOperation({ summary: '获取服务器性能摘要', description: '获取指定服务器的性能摘要和趋势' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getServerPerformanceSummary(@Param('id') id: string) {
    try {
      const summary = await this.serverMetrics.getServerPerformanceSummary(id);
      return summary;
    } catch (error) {
      this.logger.error(`Failed to get server performance summary ${id}: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to get server performance summary: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 获取系统指标
   */
  @Get('metrics/system')
  @ApiOperation({ summary: '获取系统指标', description: '获取整个系统的性能指标' })
  @ApiQuery({ name: 'startTime', required: false, description: '开始时间' })
  @ApiQuery({ name: 'endTime', required: false, description: '结束时间' })
  @ApiQuery({ name: 'limit', required: false, description: '限制数量', example: 100 })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getSystemMetrics(@Query() query: MetricsQueryDto) {
    try {
      const metrics = this.serverMetrics.getSystemMetrics(query);
      return metrics;
    } catch (error) {
      this.logger.error(`Failed to get system metrics: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to get system metrics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ============================================================================
  // 进程管理相关API端点
  // ============================================================================

  /**
   * 获取服务器进程信息
   */
  @Get(':id/process')
  @ApiOperation({ summary: '获取进程信息', description: '获取指定服务器的进程详细信息' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '服务器不存在' })
  async getProcessInfo(@Param('id') id: string) {
    try {
      const processInfo = await this.processManager.getProcessInfo(id);
      return processInfo;
    } catch (error) {
      this.logger.error(`Failed to get process info ${id}: ${error.message}`, error.stack);
      
      if (error.message.includes('not found')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        `Failed to get process info: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 获取服务器进程日志
   */
  @Get(':id/process/logs')
  @ApiOperation({ summary: '获取进程日志', description: '获取指定服务器的进程日志' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiQuery({ name: 'level', required: false, description: '日志级别过滤', enum: ['error', 'warn', 'info', 'debug'] })
  @ApiQuery({ name: 'limit', required: false, description: '限制数量', example: 100 })
  @ApiQuery({ name: 'startTime', required: false, description: '开始时间' })
  @ApiQuery({ name: 'endTime', required: false, description: '结束时间' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getProcessLogs(
    @Param('id') id: string,
    @Query() query: LogQueryDto
  ) {
    try {
      const logs = await this.processErrorHandler.getProcessLogs(
        id,
        query.level as LogLevel,
        query.limit || 100
      );
      return logs;
    } catch (error) {
      this.logger.error(`Failed to get process logs ${id}: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to get process logs: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 获取进程健康检查历史
   */
  @Get(':id/process/health/history')
  @ApiOperation({ summary: '获取进程健康检查历史', description: '获取指定服务器的进程健康检查历史记录' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiQuery({ name: 'limit', required: false, description: '限制数量', example: 50 })
  @ApiQuery({ name: 'startTime', required: false, description: '开始时间' })
  @ApiQuery({ name: 'endTime', required: false, description: '结束时间' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getProcessHealthHistory(
    @Param('id') id: string,
    @Query() query: HealthCheckQueryDto
  ) {
    try {
      const history = await this.processHealth.getHealthCheckHistory(id, query.limit);
      return history;
    } catch (error) {
      this.logger.error(`Failed to get process health history ${id}: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to get process health history: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 获取进程健康统计
   */
  @Get(':id/process/health/stats')
  @ApiOperation({ summary: '获取进程健康统计', description: '获取指定服务器的进程健康统计信息' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiQuery({ name: 'period', required: false, description: '统计周期', enum: ['hour', 'day', 'week', 'month'] })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getProcessHealthStats(
    @Param('id') id: string,
    @Query('period') period?: string
  ) {
    try {
      const stats = await this.processHealth.getHealthStats(id, period ? parseInt(period) : 24);
      return stats;
    } catch (error) {
      this.logger.error(`Failed to get process health stats ${id}: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to get process health stats: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 获取进程错误统计
   */
  @Get(':id/process/errors/stats')
  @ApiOperation({ summary: '获取进程错误统计', description: '获取指定服务器的进程错误统计信息' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiQuery({ name: 'period', required: false, description: '统计周期', enum: ['hour', 'day', 'week', 'month'] })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getProcessErrorStats(
    @Param('id') id: string,
    @Query('period') period?: string
  ) {
    try {
      const stats = await this.processErrorHandler.getErrorStats(id, period ? parseInt(period) : 24);
      return stats;
    } catch (error) {
      this.logger.error(`Failed to get process error stats ${id}: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to get process error stats: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 重置进程重启计数器
   */
  @Post(':id/process/reset-restart-counter')
  @ApiOperation({ summary: '重置重启计数器', description: '重置指定服务器的进程重启计数器' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiResponse({ status: 200, description: '重置成功', type: OperationResultDto })
  async resetRestartCounter(@Param('id') id: string): Promise<OperationResultDto> {
    try {
      await this.processErrorHandler.resetRestartCounter(id);
      return {
        success: true,
        message: 'Restart counter reset successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to reset restart counter ${id}: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to reset restart counter: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 取消进程重启
   */
  @Post(':id/process/cancel-restart')
  @ApiOperation({ summary: '取消进程重启', description: '取消指定服务器的待重启进程' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiResponse({ status: 200, description: '取消成功', type: OperationResultDto })
  async cancelRestart(@Param('id') id: string): Promise<OperationResultDto> {
    try {
      await this.processErrorHandler.cancelRestart(id);
      return {
        success: true,
        message: 'Process restart cancelled successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to cancel restart ${id}: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to cancel restart: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ============================================================================
  // 进程资源监控相关API端点
  // ============================================================================

  /**
   * 获取进程资源使用情况
   */
  @Get(':id/process/resources')
  @ApiOperation({ summary: '获取进程资源使用情况', description: '获取指定服务器进程的CPU、内存等资源使用情况' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '服务器不存在' })
  async getProcessResources(@Param('id') id: string) {
    try {
      const processInfo = await this.processManager.getProcessInfo(id);
      if (!processInfo || !processInfo.pid) {
        throw new HttpException('Process not found or not running', HttpStatus.NOT_FOUND);
      }

      const resources = await this.processResourceMonitor.getProcessResourceMetrics(processInfo.pid);
      return resources;
    } catch (error) {
      this.logger.error(`Failed to get process resources ${id}: ${error.message}`, error.stack);
      
      if (error.message.includes('not found') || error.message.includes('not running')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        `Failed to get process resources: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 获取进程资源历史数据
   */
  @Get(':id/process/resources/history')
  @ApiOperation({ summary: '获取进程资源历史', description: '获取指定服务器进程的资源使用历史数据' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiQuery({ name: 'limit', required: false, description: '限制数量', example: 100 })
  @ApiQuery({ name: 'startTime', required: false, description: '开始时间' })
  @ApiQuery({ name: 'endTime', required: false, description: '结束时间' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getProcessResourceHistory(
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string
  ) {
    try {
      const processInfo = await this.processManager.getProcessInfo(id);
      if (!processInfo || !processInfo.pid) {
        throw new HttpException('Process not found or not running', HttpStatus.NOT_FOUND);
      }

      const history = await this.processResourceMonitor.getResourceHistory(
         id,
         limit || 100
       );
      return history;
    } catch (error) {
      this.logger.error(`Failed to get process resource history ${id}: ${error.message}`, error.stack);
      
      if (error.message.includes('not found') || error.message.includes('not running')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        `Failed to get process resource history: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 获取系统资源使用情况
   */
  @Get('system/resources')
  @ApiOperation({ summary: '获取系统资源使用情况', description: '获取整个系统的CPU、内存等资源使用情况' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getSystemResources() {
    try {
      const systemResources = await this.processResourceMonitor.getSystemResourceInfo();
      return systemResources;
    } catch (error) {
      this.logger.error(`Failed to get system resources: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to get system resources: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 启动进程资源监控
   */
  @Post(':id/process/resources/monitor/start')
  @ApiOperation({ summary: '启动进程资源监控', description: '启动指定服务器进程的资源监控' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiQuery({ name: 'interval', required: false, description: '监控间隔（毫秒）', example: 5000 })
  @ApiResponse({ status: 200, description: '启动成功', type: OperationResultDto })
  async startResourceMonitoring(
    @Param('id') id: string,
    @Query('interval') interval?: number
  ): Promise<OperationResultDto> {
    try {
      const processInfo = await this.processManager.getProcessInfo(id);
      if (!processInfo || !processInfo.pid) {
        throw new HttpException('Process not found or not running', HttpStatus.NOT_FOUND);
      }

      await this.processResourceMonitor.startMonitoring(id, processInfo.pid, interval || 5000);
      return {
        success: true,
        message: 'Resource monitoring started successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to start resource monitoring ${id}: ${error.message}`, error.stack);
      
      if (error.message.includes('not found') || error.message.includes('not running')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        `Failed to start resource monitoring: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 停止进程资源监控
   */
  @Post(':id/process/resources/monitor/stop')
  @ApiOperation({ summary: '停止进程资源监控', description: '停止指定服务器进程的资源监控' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiResponse({ status: 200, description: '停止成功', type: OperationResultDto })
  async stopResourceMonitoring(@Param('id') id: string): Promise<OperationResultDto> {
    try {
      const processInfo = await this.processManager.getProcessInfo(id);
      if (!processInfo || !processInfo.pid) {
        throw new HttpException('Process not found or not running', HttpStatus.NOT_FOUND);
      }

      await this.processResourceMonitor.stopMonitoring(id);
      return {
        success: true,
        message: 'Resource monitoring stopped successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to stop resource monitoring ${id}: ${error.message}`, error.stack);
      
      if (error.message.includes('not found') || error.message.includes('not running')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        `Failed to stop resource monitoring: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ============================================================================
  // 进程日志监控相关API端点
  // ============================================================================

  /**
   * 获取进程完整信息（包含资源和日志）
   */
  @Get(':id/process/full-info')
  @ApiOperation({ summary: '获取进程完整信息', description: '获取指定服务器进程的完整信息，包括基本信息、资源使用情况和最近日志' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '服务器不存在' })
  async getProcessFullInfo(@Param('id') id: string) {
    try {
      const fullInfo = await this.processManager.getProcessFullInfo(id);
      return fullInfo;
    } catch (error) {
      this.logger.error(`Failed to get process full info ${id}: ${error.message}`, error.stack);
      
      if (error.message.includes('not found')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        `Failed to get process full info: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 获取进程日志历史
   */
  @Get(':id/process/logs/history')
  @ApiOperation({ summary: '获取进程日志历史', description: '获取指定服务器进程的日志历史记录' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiQuery({ name: 'limit', required: false, description: '限制数量', example: 100 })
  @ApiQuery({ name: 'startTime', required: false, description: '开始时间' })
  @ApiQuery({ name: 'endTime', required: false, description: '结束时间' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getProcessLogHistory(
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string
  ) {
    try {
      const processInfo = await this.processManager.getProcessInfo(id);
      if (!processInfo || !processInfo.pid) {
        throw new HttpException('Process not found or not running', HttpStatus.NOT_FOUND);
      }

      const history = await this.processLogMonitor.getLogHistory(
         id,
         limit || 100
       );
      return history;
    } catch (error) {
      this.logger.error(`Failed to get process log history ${id}: ${error.message}`, error.stack);
      
      if (error.message.includes('not found') || error.message.includes('not running')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        `Failed to get process log history: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 搜索进程日志
   */
  @Get(':id/process/logs/search')
  @ApiOperation({ summary: '搜索进程日志', description: '在指定服务器进程的日志中搜索关键词' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiQuery({ name: 'keyword', required: true, description: '搜索关键词' })
  @ApiQuery({ name: 'limit', required: false, description: '限制数量', example: 50 })
  @ApiResponse({ status: 200, description: '搜索成功' })
  async searchProcessLogs(
    @Param('id') id: string,
    @Query('keyword') keyword: string,
    @Query('limit') limit?: number
  ) {
    try {
      const processInfo = await this.processManager.getProcessInfo(id);
      if (!processInfo || !processInfo.pid) {
        throw new HttpException('Process not found or not running', HttpStatus.NOT_FOUND);
      }

      const results = await this.processLogMonitor.searchLogs(
         id,
         {
           keyword,
           limit: limit || 50
         }
       );
      return results;
    } catch (error) {
      this.logger.error(`Failed to search process logs ${id}: ${error.message}`, error.stack);
      
      if (error.message.includes('not found') || error.message.includes('not running')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        `Failed to search process logs: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 启动进程日志监控
   */
  @Post(':id/process/logs/monitor/start')
  @ApiOperation({ summary: '启动进程日志监控', description: '启动指定服务器进程的日志监控' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiQuery({ name: 'logFile', required: false, description: '日志文件路径' })
  @ApiResponse({ status: 200, description: '启动成功', type: OperationResultDto })
  async startLogMonitoring(
    @Param('id') id: string,
    @Query('logFile') logFile?: string
  ): Promise<OperationResultDto> {
    try {
      const processInfo = await this.processManager.getProcessInfo(id);
      if (!processInfo || !processInfo.pid) {
        throw new HttpException('Process not found or not running', HttpStatus.NOT_FOUND);
      }

      await this.processLogMonitor.startLogMonitoring(id, processInfo.pid, logFile);
      return {
        success: true,
        message: 'Log monitoring started successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to start log monitoring ${id}: ${error.message}`, error.stack);
      
      if (error.message.includes('not found') || error.message.includes('not running')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        `Failed to start log monitoring: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 停止进程日志监控
   */
  @Post(':id/process/logs/monitor/stop')
  @ApiOperation({ summary: '停止进程日志监控', description: '停止指定服务器进程的日志监控' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiResponse({ status: 200, description: '停止成功', type: OperationResultDto })
  async stopLogMonitoring(@Param('id') id: string): Promise<OperationResultDto> {
    try {
      const processInfo = await this.processManager.getProcessInfo(id);
      if (!processInfo || !processInfo.pid) {
        throw new HttpException('Process not found or not running', HttpStatus.NOT_FOUND);
      }

      await this.processLogMonitor.stopLogMonitoring(id);
      return {
        success: true,
        message: 'Log monitoring stopped successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to stop log monitoring ${id}: ${error.message}`, error.stack);
      
      if (error.message.includes('not found') || error.message.includes('not running')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        `Failed to stop log monitoring: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 清空进程日志缓冲区
   */
  @Post(':id/process/logs/clear')
  @ApiOperation({ summary: '清空进程日志缓冲区', description: '清空指定服务器进程的日志缓冲区' })
  @ApiParam({ name: 'id', description: '服务器ID' })
  @ApiResponse({ status: 200, description: '清空成功', type: OperationResultDto })
  async clearProcessLogBuffer(@Param('id') id: string): Promise<OperationResultDto> {
    try {
      const processInfo = await this.processManager.getProcessInfo(id);
      if (!processInfo || !processInfo.pid) {
        throw new HttpException('Process not found or not running', HttpStatus.NOT_FOUND);
      }

      await this.processLogMonitor.clearLogBuffer(id);
      return {
        success: true,
        message: 'Log buffer cleared successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to clear log buffer ${id}: ${error.message}`, error.stack);
      
      if (error.message.includes('not found') || error.message.includes('not running')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        `Failed to clear log buffer: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

}