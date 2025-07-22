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
import { MCPServerEntity } from '../../database/entities/mcp-server.entity';

@ApiTags('服务器管理')
@Controller('api/v1/servers')
// @UseGuards(AuthGuard) // TODO: 添加认证守卫
export class ServersController {
  private readonly logger = new Logger(ServersController.name);

  constructor(
    private readonly serverManager: ServerManagerService,
    private readonly serverHealth: ServerHealthService,
    private readonly serverMetrics: ServerMetricsService,
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
      
      const server = await this.serverManager.createServer(createDto);
      
      return this.transformServerResponse(server);
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
      
      const transformedServers = result.servers.map(server => this.transformServerResponse(server));
      
      return {
        data: transformedServers,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
        hasNext: result.page * result.limit < result.total,
        hasPrev: result.page > 1,
      };
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
      return this.transformServerResponse(server);
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
      
      return this.transformServerResponse(server);
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
      this.logger.log(`Performing ${actionDto.action} on server ${id}`);
      
      switch (actionDto.action) {
        case 'start':
          await this.serverManager.startServer(id);
          break;
        case 'stop':
          await this.serverManager.stopServer(id);
          break;
        case 'restart':
          await this.serverManager.restartServer(id);
          break;
        default:
          throw new Error(`Unknown action: ${actionDto.action}`);
      }
      
      return {
        success: true,
        message: `Server ${actionDto.action} operation completed successfully`,
      };
    } catch (error) {
      this.logger.error(`Failed to ${actionDto.action} server ${id}: ${error.message}`, error.stack);
      
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

  /**
   * 转换服务器实体为响应DTO
   */
  private transformServerResponse(server: MCPServerEntity): ServerResponseDto {
    return {
      id: server.id,
      name: server.name,
      version: server.version,
      description: server.description,
      port: server.port,
      transport: server.transport,
      status: server.status,
      healthy: server.healthy,
      endpoint: server.endpoint,
      toolCount: server.tools ? server.tools.length : 0,
      autoStart: server.autoStart,
      tags: server.tags || [],
      errorMessage: server.errorMessage,
      lastHealthCheck: server.lastHealthCheck,
      createdAt: server.createdAt,
      updatedAt: server.updatedAt,
    };
  }
}