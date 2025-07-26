import {
  Controller,
  Get,
  Delete,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AuditService } from '../services/audit.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import {
  QueryAuditLogsDto,
  // AuditLogResponseDto, // TODO: 需要定义AuditLogResponseDto
  PaginatedResponseDto,
  OperationResultDto,
} from '../dto/security.dto';
import { User } from '../../../database/entities/user.entity';

@ApiTags('审计日志')
@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class AuditController {
  private readonly logger = new Logger(AuditController.name);

  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: '查询审计日志' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量' })
  @ApiQuery({ name: 'action', required: false, type: String, description: '操作类型' })
  @ApiQuery({ name: 'level', required: false, type: String, description: '日志级别' })
  @ApiQuery({ name: 'status', required: false, type: String, description: '操作状态' })
  @ApiQuery({ name: 'userId', required: false, type: String, description: '用户ID' })
  @ApiQuery({ name: 'resource', required: false, type: String, description: '资源类型' })
  @ApiQuery({ name: 'ipAddress', required: false, type: String, description: 'IP地址' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: '结束日期' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: '排序字段' })
  @ApiQuery({ name: 'sortOrder', required: false, type: String, description: '排序方向' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: PaginatedResponseDto,
  })
  async getAuditLogs(
    @Query() query: QueryAuditLogsDto,
  ): Promise<PaginatedResponseDto<any>> {
    return this.auditService.findLogs(query);
  }

  @Get('logs/:id')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: '获取审计日志详情' })
  @ApiParam({ name: 'id', description: '日志ID' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: Object,
  })
  @ApiResponse({
    status: 404,
    description: '日志不存在',
  })
  async getAuditLogById(
    @Param('id') id: string,
  ): Promise<any> {
    return this.auditService.findLogById(id);
  }

  @Get('user/:userId/activity')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: '获取用户活动统计' })
  @ApiParam({ name: 'userId', description: '用户ID' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: '结束日期' })
  @ApiQuery({ name: 'groupBy', required: false, type: String, description: '分组方式（day/hour）' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getUserActivity(
    @Param('userId') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy: 'day' | 'hour' = 'day',
  ) {
    return this.auditService.getUserActivityStats(userId);
  }

  @Get('security/events')
  @RequirePermissions('audit:read', 'security:monitor')
  @ApiOperation({ summary: '获取安全事件' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量' })
  @ApiQuery({ name: 'eventType', required: false, type: String, description: '事件类型' })
  @ApiQuery({ name: 'severity', required: false, type: String, description: '严重程度' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: '结束日期' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getSecurityEvents(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('eventType') eventType?: string,
    @Query('severity') severity?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.getSecurityEvents(7);
  }

  @Get('security/suspicious-logins')
  @RequirePermissions('audit:read', 'security:monitor')
  @ApiOperation({ summary: '获取可疑登录记录' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: '结束日期' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getSuspiciousLogins(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.getSuspiciousLogins({
      page,
      limit,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('security/failed-logins')
  @RequirePermissions('audit:read', 'security:monitor')
  @ApiOperation({ summary: '获取失败登录记录' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: '结束日期' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getFailedLogins(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.getFailedLogins({
      page,
      limit,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('security/privilege-escalations')
  @RequirePermissions('audit:read', 'security:monitor')
  @ApiOperation({ summary: '获取权限提升记录' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: '结束日期' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getPrivilegeEscalations(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.getPrivilegeEscalations({
      page,
      limit,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('security/sensitive-data-access')
  @RequirePermissions('audit:read', 'security:monitor')
  @ApiOperation({ summary: '获取敏感数据访问记录' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: '结束日期' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getSensitiveDataAccess(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.getSensitiveDataAccess({
      page,
      limit,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('stats/overview')
  @RequirePermissions('audit:read', 'system:monitor')
  @ApiOperation({ summary: '获取审计统计概览' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: '结束日期' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getAuditStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.getAuditStats({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('export')
  @RequirePermissions('audit:export')
  @ApiOperation({ summary: '导出审计日志' })
  @ApiQuery({ name: 'format', required: false, type: String, description: '导出格式（json/csv）' })
  @ApiQuery({ name: 'action', required: false, type: String, description: '操作类型' })
  @ApiQuery({ name: 'level', required: false, type: String, description: '日志级别' })
  @ApiQuery({ name: 'status', required: false, type: String, description: '操作状态' })
  @ApiQuery({ name: 'userId', required: false, type: String, description: '用户ID' })
  @ApiQuery({ name: 'resource', required: false, type: String, description: '资源类型' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: '结束日期' })
  @ApiResponse({
    status: 200,
    description: '导出成功',
  })
  async exportAuditLogs(
    @Query() query: QueryAuditLogsDto & { format?: 'json' | 'csv' },
    @Res() res: Response,
  ) {
    const { format = 'json', ...filters } = query;
    
    const result = await this.auditService.exportLogs(filters, format);
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `audit-logs-${timestamp}.${format}`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
    } else {
      res.setHeader('Content-Type', 'application/json');
    }
    
    res.send(result);
  }

  @Delete('cleanup')
  @RequirePermissions('audit:delete', 'system:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '清理过期审计日志' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: '保留天数（默认90天）' })
  @ApiResponse({
    status: 200,
    description: '清理完成',
  })
  async cleanupAuditLogs(
    @Query('days') days: number = 90,
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<OperationResultDto> {
    const ipAddress = this.getClientIp(req);
    const count = await this.auditService.cleanupExpiredLogs(
      days,
      currentUser.id,
      ipAddress,
    );
    return {
      success: true,
      message: `已清理 ${count} 条过期审计日志`,
    };
  }

  @Get('search')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: '搜索审计日志' })
  @ApiQuery({ name: 'q', required: true, type: String, description: '搜索关键词' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: '结束日期' })
  @ApiResponse({
    status: 200,
    description: '搜索成功',
  })
  async searchAuditLogs(
    @Query('q') query: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.searchLogs(query, {
      page,
      limit,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('timeline/:userId')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: '获取用户操作时间线' })
  @ApiParam({ name: 'userId', description: '用户ID' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: '结束日期' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '限制数量' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getUserTimeline(
    @Param('userId') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit: number = 100,
  ) {
    return this.auditService.getUserTimeline(userId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
    });
  }

  /**
   * 获取客户端IP地址
   */
  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      ''
    );
  }
}