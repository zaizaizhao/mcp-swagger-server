import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { ApiKeyService } from '../services/api-key.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  ApiKeyQueryDto,
  ApiKeyResponseDto,
  PaginatedResponseDto,
  OperationResultDto,
} from '../dto/security.dto';
import { User } from '../../../database/entities/user.entity';

@ApiTags('API密钥管理')
@Controller('api-keys')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class ApiKeyController {
  private readonly logger = new Logger(ApiKeyController.name);

  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @RequirePermissions('api_key:create')
  @ApiOperation({ summary: '创建API密钥' })
  @ApiBody({ type: CreateApiKeyDto })
  @ApiResponse({
    status: 201,
    description: 'API密钥创建成功',
    type: ApiKeyResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'API密钥信息无效',
  })
  @ApiResponse({
    status: 403,
    description: '权限不足',
  })
  async createApiKey(
    @Body() createApiKeyDto: CreateApiKeyDto,
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<ApiKeyResponseDto> {
    const ipAddress = this.getClientIp(req);
    const result = await this.apiKeyService.createApiKey(
      currentUser.id,
      createApiKeyDto,
      currentUser.id,
      ipAddress,
    );
    return result.apiKey;
  }

  @Get()
  @RequirePermissions('api_key:read')
  @ApiOperation({ summary: '查询API密钥列表' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量' })
  @ApiQuery({ name: 'search', required: false, type: String, description: '搜索关键词' })
  @ApiQuery({ name: 'status', required: false, type: String, description: '密钥状态' })
  @ApiQuery({ name: 'type', required: false, type: String, description: '密钥类型' })
  @ApiQuery({ name: 'userId', required: false, type: String, description: '用户ID' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: '排序字段' })
  @ApiQuery({ name: 'sortOrder', required: false, type: String, description: '排序方向' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: PaginatedResponseDto,
  })
  async getApiKeys(
    @Query() query: ApiKeyQueryDto,
  ): Promise<PaginatedResponseDto<ApiKeyResponseDto>> {
    return this.apiKeyService.getApiKeys(query);
  }

  @Get('my')
  @RequirePermissions('api_key:read_own')
  @ApiOperation({ summary: '获取当前用户的API密钥列表' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量' })
  @ApiQuery({ name: 'status', required: false, type: String, description: '密钥状态' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: PaginatedResponseDto,
  })
  async getMyApiKeys(
    @CurrentUser() currentUser: User,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: string,
  ): Promise<PaginatedResponseDto<ApiKeyResponseDto>> {
    const apiKeys = await this.apiKeyService.getUserApiKeys(currentUser.id);
    return {
      data: apiKeys,
      total: apiKeys.length,
      page,
      limit,
      totalPages: Math.ceil(apiKeys.length / limit),
      hasNext: page * limit < apiKeys.length,
      hasPrev: page > 1,
    };
  }

  @Get(':id')
  @RequirePermissions('api_key:read')
  @ApiOperation({ summary: '获取API密钥详情' })
  @ApiParam({ name: 'id', description: 'API密钥ID' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: ApiKeyResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'API密钥不存在',
  })
  async getApiKeyById(
    @Param('id') id: string,
  ): Promise<ApiKeyResponseDto> {
    // TODO: 实现获取API密钥详情的逻辑
    throw new Error('Method not implemented');
  }

  @Put(':id')
  @RequirePermissions('api_key:update')
  @ApiOperation({ summary: '更新API密钥信息' })
  @ApiParam({ name: 'id', description: 'API密钥ID' })
  @ApiBody({ type: UpdateApiKeyDto })
  @ApiResponse({
    status: 200,
    description: '更新成功',
    type: ApiKeyResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'API密钥不存在',
  })
  async updateApiKey(
    @Param('id') id: string,
    @Body() updateApiKeyDto: UpdateApiKeyDto,
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<ApiKeyResponseDto> {
    const ipAddress = this.getClientIp(req);
    return this.apiKeyService.updateApiKey(
      id,
      updateApiKeyDto,
      currentUser.id,
      ipAddress,
    );
  }

  @Delete(':id')
  @RequirePermissions('api_key:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除API密钥' })
  @ApiParam({ name: 'id', description: 'API密钥ID' })
  @ApiResponse({
    status: 200,
    description: '删除成功',
  })
  @ApiResponse({
    status: 404,
    description: 'API密钥不存在',
  })
  async deleteApiKey(
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<OperationResultDto> {
    const ipAddress = this.getClientIp(req);
    await this.apiKeyService.deleteApiKey(id, currentUser.id, ipAddress);
    return {
      success: true,
      message: 'API密钥删除成功',
    };
  }

  @Post(':id/revoke')
  @RequirePermissions('api_key:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '撤销API密钥' })
  @ApiParam({ name: 'id', description: 'API密钥ID' })
  @ApiResponse({
    status: 200,
    description: '撤销成功',
  })
  async revokeApiKey(
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<OperationResultDto> {
    const ipAddress = this.getClientIp(req);
    await this.apiKeyService.revokeApiKey(id, currentUser.id, ipAddress);
    return {
      success: true,
      message: 'API密钥已撤销',
    };
  }

  @Post(':id/regenerate')
  @RequirePermissions('api_key:update')
  @ApiOperation({ summary: '重新生成API密钥' })
  @ApiParam({ name: 'id', description: 'API密钥ID' })
  @ApiResponse({
    status: 200,
    description: '重新生成成功',
    type: ApiKeyResponseDto,
  })
  async regenerateApiKey(
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<ApiKeyResponseDto> {
    const ipAddress = this.getClientIp(req);
    const result = await this.apiKeyService.regenerateApiKey(id, currentUser.id, ipAddress);
    return result.apiKey;
  }

  @Post(':id/verify')
  @RequirePermissions('api_key:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '验证API密钥' })
  @ApiParam({ name: 'id', description: 'API密钥ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'API密钥',
        },
        ipAddress: {
          type: 'string',
          description: 'IP地址',
        },
        method: {
          type: 'string',
          description: 'HTTP方法',
        },
        path: {
          type: 'string',
          description: '请求路径',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '验证结果',
  })
  async verifyApiKey(
    @Param('id') id: string,
    @Body('key') key: string,
    @Body('ipAddress') ipAddress?: string,
    @Body('method') method?: string,
    @Body('path') path?: string,
  ): Promise<{ valid: boolean; reason?: string }> {
    // TODO: 实现验证API密钥的逻辑
    const result = { valid: false, reason: 'Method not implemented' };
    return {
      valid: result.valid,
      reason: result.reason,
    };
  }

  @Get(':id/usage')
  @RequirePermissions('api_key:read')
  @ApiOperation({ summary: '获取API密钥使用统计' })
  @ApiParam({ name: 'id', description: 'API密钥ID' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: '结束日期' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getApiKeyUsage(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const days = startDate && endDate ? 
      Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) : 30;
    return this.apiKeyService.getApiKeyStats(id, days);
  }

  @Get('user/:userId')
  @RequirePermissions('api_key:read')
  @ApiOperation({ summary: '获取指定用户的API密钥列表' })
  @ApiParam({ name: 'userId', description: '用户ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量' })
  @ApiQuery({ name: 'status', required: false, type: String, description: '密钥状态' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: PaginatedResponseDto,
  })
  async getUserApiKeys(
    @Param('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: string,
  ): Promise<PaginatedResponseDto<ApiKeyResponseDto>> {
    const apiKeys = await this.apiKeyService.getUserApiKeys(userId);
    return {
      data: apiKeys,
      total: apiKeys.length,
      page,
      limit,
      totalPages: Math.ceil(apiKeys.length / limit),
      hasNext: page * limit < apiKeys.length,
      hasPrev: page > 1,
    };
  }

  @Delete('user/:userId/revoke-all')
  @RequirePermissions('api_key:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '撤销用户所有API密钥' })
  @ApiParam({ name: 'userId', description: '用户ID' })
  @ApiResponse({
    status: 200,
    description: '撤销成功',
  })
  async revokeUserApiKeys(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<OperationResultDto> {
    const ipAddress = this.getClientIp(req);
    // TODO: 实现批量撤销用户API密钥的逻辑
    const count = 0;
    return {
      success: true,
      message: `已撤销 ${count} 个API密钥`,
    };
  }

  @Get('cleanup/expired')
  @RequirePermissions('system:manage')
  @ApiOperation({ summary: '清理过期的API密钥' })
  @ApiResponse({
    status: 200,
    description: '清理完成',
  })
  async cleanupExpiredApiKeys(
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<OperationResultDto> {
    const ipAddress = this.getClientIp(req);
    const count = await this.apiKeyService.cleanupExpiredApiKeys();
    return {
      success: true,
      message: `已清理 ${count} 个过期的API密钥`,
    };
  }

  @Get('stats/overview')
  @RequirePermissions('api_key:read', 'system:monitor')
  @ApiOperation({ summary: '获取API密钥统计概览' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getApiKeyStatsOverview() {
    return this.apiKeyService.getApiKeyStatsOverview();
  }

  @Get(':id/stats')
  @RequirePermissions('api_key:read')
  @ApiOperation({ summary: '获取指定API密钥使用统计' })
  @ApiParam({ name: 'id', description: 'API密钥ID' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getSpecificApiKeyStats(@Param('id') id: string) {
    return this.apiKeyService.getApiKeyStats(id);
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