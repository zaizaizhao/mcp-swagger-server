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
import { PermissionService } from '../services/permission.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import {
  CreatePermissionDto,
  UpdatePermissionDto,
  QueryPermissionsDto,
  PermissionResponseDto,
  PaginatedResponseDto,
  OperationResultDto,
} from '../dto/security.dto';
import { Permission } from '../../../database/entities/permission.entity';
import { User } from '../../../database/entities/user.entity';

@ApiTags('权限管理')
@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class PermissionController {
  private readonly logger = new Logger(PermissionController.name);

  constructor(private readonly permissionService: PermissionService) {}

  @Post()
  @RequirePermissions('permission:create')
  @ApiOperation({ summary: '创建权限' })
  @ApiBody({ type: CreatePermissionDto })
  @ApiResponse({
    status: 201,
    description: '权限创建成功',
    type: PermissionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '权限信息无效',
  })
  @ApiResponse({
    status: 403,
    description: '权限不足',
  })
  async createPermission(
    @Body() createPermissionDto: CreatePermissionDto,
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<PermissionResponseDto> {
    const ipAddress = this.getClientIp(req);
    return this.permissionService.createPermission(
      createPermissionDto,
      currentUser.id,
      ipAddress,
    );
  }

  @Post('batch')
  @RequirePermissions('permission:create')
  @ApiOperation({ summary: '批量创建权限' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        permissions: {
          type: 'array',
          items: { $ref: '#/components/schemas/CreatePermissionDto' },
          description: '权限列表',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '权限批量创建成功',
  })
  async createPermissions(
    @Body('permissions') permissions: CreatePermissionDto[],
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<OperationResultDto> {
    const ipAddress = this.getClientIp(req);
    const results = [];
    for (const permission of permissions) {
      const result = await this.permissionService.createPermission(
        permission,
        currentUser.id,
        ipAddress,
      );
      results.push(result);
    }
    return {
      success: true,
      message: `成功创建 ${results.length} 个权限`,
      data: results,
    };
  }

  @Get()
  @RequirePermissions('permission:read')
  @ApiOperation({ summary: '查询权限列表' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量' })
  @ApiQuery({ name: 'search', required: false, type: String, description: '搜索关键词' })
  @ApiQuery({ name: 'category', required: false, type: String, description: '权限类别' })
  @ApiQuery({ name: 'action', required: false, type: String, description: '操作类型' })
  @ApiQuery({ name: 'enabled', required: false, type: Boolean, description: '启用状态' })
  @ApiQuery({ name: 'isSystem', required: false, type: Boolean, description: '是否系统权限' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: '排序字段' })
  @ApiQuery({ name: 'sortOrder', required: false, type: String, description: '排序方向' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: PaginatedResponseDto,
  })
  async getPermissions(
    @Query() query: QueryPermissionsDto,
  ): Promise<PaginatedResponseDto<PermissionResponseDto>> {
    return this.permissionService.getPermissions(query);
  }

  @Get('categories')
  @RequirePermissions('permission:read')
  @ApiOperation({ summary: '获取权限类别列表' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getPermissionCategories() {
    return this.permissionService.getPermissionCategories();
  }

  @Get('actions')
  @RequirePermissions('permission:read')
  @ApiOperation({ summary: '获取操作类型列表' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getPermissionActions() {
    return this.permissionService.getPermissionActions();
  }

  @Get(':id')
  @RequirePermissions('permission:read')
  @ApiOperation({ summary: '获取权限详情' })
  @ApiParam({ name: 'id', description: '权限ID' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: PermissionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: '权限不存在',
  })
  async getPermissionById(
    @Param('id') id: string,
  ): Promise<PermissionResponseDto> {
    return this.permissionService.getPermissionById(id);
  }

  @Put(':id')
  @RequirePermissions('permission:update')
  @ApiOperation({ summary: '更新权限信息' })
  @ApiParam({ name: 'id', description: '权限ID' })
  @ApiBody({ type: UpdatePermissionDto })
  @ApiResponse({
    status: 200,
    description: '更新成功',
    type: PermissionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: '权限不存在',
  })
  async updatePermission(
    @Param('id') id: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<PermissionResponseDto> {
    const ipAddress = this.getClientIp(req);
    return this.permissionService.updatePermission(
      id,
      updatePermissionDto,
      currentUser.id,
      ipAddress,
    );
  }

  @Delete(':id')
  @RequirePermissions('permission:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除权限' })
  @ApiParam({ name: 'id', description: '权限ID' })
  @ApiResponse({
    status: 200,
    description: '删除成功',
  })
  @ApiResponse({
    status: 404,
    description: '权限不存在',
  })
  async deletePermission(
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<OperationResultDto> {
    const ipAddress = this.getClientIp(req);
    await this.permissionService.deletePermission(id, currentUser.id, ipAddress);
    return {
      success: true,
      message: '权限删除成功',
    };
  }

  @Put(':id/toggle')
  @RequirePermissions('permission:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '切换权限启用状态' })
  @ApiParam({ name: 'id', description: '权限ID' })
  @ApiResponse({
    status: 200,
    description: '状态切换成功',
  })
  async togglePermission(
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<OperationResultDto> {
    const ipAddress = this.getClientIp(req);
    const permission = await this.permissionService.getPermissionById(id);
    const result = await this.permissionService.togglePermissionStatus(
      id,
      !permission.enabled,
      currentUser.id,
      ipAddress,
    );
    return {
      success: true,
      message: `权限已${result.enabled ? '启用' : '禁用'}`,
    };
  }

  @Get(':id/roles')
  @RequirePermissions('permission:read', 'role:read')
  @ApiOperation({ summary: '获取拥有该权限的角色列表' })
  @ApiParam({ name: 'id', description: '权限ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getPermissionRoles(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    // TODO: 实现获取权限关联角色的逻辑
    throw new Error('Method not implemented');
  }

  @Get('system/init')
  @RequirePermissions('system:manage')
  @ApiOperation({ summary: '初始化系统权限' })
  @ApiResponse({
    status: 200,
    description: '初始化成功',
  })
  async initSystemPermissions(
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<OperationResultDto> {
    const ipAddress = this.getClientIp(req);
    await this.permissionService.initializeSystemPermissions();
    return {
      success: true,
      message: '系统权限初始化成功',
    };
  }

  @Get('tree/structure')
  @RequirePermissions('permission:read')
  @ApiOperation({ summary: '获取权限树形结构' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getPermissionTree() {
    // TODO: 实现获取权限树的逻辑
    throw new Error('Method not implemented');
  }

  // @Get('check/conflicts')
  // @RequirePermissions('permission:read')
  // @ApiOperation({ summary: '检查权限冲突' })
  // @ApiQuery({ name: 'permissionIds', required: true, type: String, description: '权限ID列表（逗号分隔）' })
  // @ApiResponse({
  //   status: 200,
  //   description: '检查完成',
  // })
  // async checkPermissionConflicts(
  //   @Query('permissionIds') permissionIds: string,
  // ) {
  //   const ids = permissionIds.split(',').filter(id => id.trim());
  //   // TODO: 实现权限冲突检查逻辑
  //   throw new Error('Method not implemented');
  // }

  // @Post('validate/conditions')
  // @RequirePermissions('permission:read')
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: '验证权限条件' })
  // @ApiBody({
  //   schema: {
  //     type: 'object',
  //     properties: {
  //       conditions: {
  //         type: 'object',
  //         description: '权限条件',
  //       },
  //       context: {
  //         type: 'object',
  //         description: '验证上下文',
  //       },
  //     },
  //   },
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: '验证完成',
  // })
  // async validatePermissionConditions(
  //   @Body('conditions') conditions: any,
  //   @Body('context') context: any,
  // ) {
  //   // TODO: 实现权限条件验证逻辑
  //   throw new Error('Method not implemented');
  // }

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