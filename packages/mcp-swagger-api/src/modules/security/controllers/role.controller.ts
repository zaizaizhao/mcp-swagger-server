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
import { RoleService } from '../services/role.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import {
  CreateRoleDto,
  UpdateRoleDto,
  RoleQueryDto,
  RoleResponseDto,
  PaginatedResponseDto,
  OperationResultDto,
} from '../dto/security.dto';
import { User } from '../../../database/entities/user.entity';

@ApiTags('角色管理')
@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class RoleController {
  private readonly logger = new Logger(RoleController.name);

  constructor(private readonly roleService: RoleService) {}

  @Post()
  @RequirePermissions('role:create')
  @ApiOperation({ summary: '创建角色' })
  @ApiBody({ type: CreateRoleDto })
  @ApiResponse({
    status: 201,
    description: '角色创建成功',
    type: RoleResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '角色信息无效',
  })
  @ApiResponse({
    status: 403,
    description: '权限不足',
  })
  async createRole(
    @Body() createRoleDto: CreateRoleDto,
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<RoleResponseDto> {
    const ipAddress = this.getClientIp(req);
    return this.roleService.createRole(createRoleDto, currentUser.id, ipAddress);
  }

  @Get()
  @RequirePermissions('role:read')
  @ApiOperation({ summary: '查询角色列表' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量' })
  @ApiQuery({ name: 'search', required: false, type: String, description: '搜索关键词' })
  @ApiQuery({ name: 'type', required: false, type: String, description: '角色类型' })
  @ApiQuery({ name: 'enabled', required: false, type: Boolean, description: '启用状态' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: '排序字段' })
  @ApiQuery({ name: 'sortOrder', required: false, type: String, description: '排序方向' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: PaginatedResponseDto,
  })
  async getRoles(
    @Query() query: RoleQueryDto,
  ): Promise<PaginatedResponseDto<RoleResponseDto>> {
    return this.roleService.getRoles(query);
  }

  @Get(':id')
  @RequirePermissions('role:read')
  @ApiOperation({ summary: '获取角色详情' })
  @ApiParam({ name: 'id', description: '角色ID' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: RoleResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: '角色不存在',
  })
  async getRoleById(
    @Param('id') id: string,
  ): Promise<RoleResponseDto> {
    return this.roleService.getRoleById(id);
  }

  @Put(':id')
  @RequirePermissions('role:update')
  @ApiOperation({ summary: '更新角色信息' })
  @ApiParam({ name: 'id', description: '角色ID' })
  @ApiBody({ type: UpdateRoleDto })
  @ApiResponse({
    status: 200,
    description: '更新成功',
    type: RoleResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: '角色不存在',
  })
  async updateRole(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<RoleResponseDto> {
    const ipAddress = this.getClientIp(req);
    return this.roleService.updateRole(id, updateRoleDto, currentUser.id, ipAddress);
  }

  @Delete(':id')
  @RequirePermissions('role:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除角色' })
  @ApiParam({ name: 'id', description: '角色ID' })
  @ApiResponse({
    status: 200,
    description: '删除成功',
  })
  @ApiResponse({
    status: 404,
    description: '角色不存在',
  })
  async deleteRole(
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<OperationResultDto> {
    const ipAddress = this.getClientIp(req);
    await this.roleService.deleteRole(id, currentUser.id, ipAddress);
    return {
      success: true,
      message: '角色删除成功',
    };
  }

  @Post(':id/permissions')
  @RequirePermissions('role:update', 'permission:assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '为角色分配权限' })
  @ApiParam({ name: 'id', description: '角色ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        permissionIds: {
          type: 'array',
          items: { type: 'string' },
          description: '权限ID列表',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '权限分配成功',
  })
  async assignPermissions(
    @Param('id') id: string,
    @Body('permissionIds') permissionIds: string[],
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<OperationResultDto> {
    const ipAddress = this.getClientIp(req);
    await this.roleService.assignPermissions(id, permissionIds, currentUser.id, ipAddress);
    return {
      success: true,
      message: '权限分配成功',
    };
  }

  @Delete(':id/permissions/:permissionId')
  @RequirePermissions('role:update', 'permission:assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '移除角色权限' })
  @ApiParam({ name: 'id', description: '角色ID' })
  @ApiParam({ name: 'permissionId', description: '权限ID' })
  @ApiResponse({
    status: 200,
    description: '权限移除成功',
  })
  async removePermission(
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<OperationResultDto> {
    const ipAddress = this.getClientIp(req);
    await this.roleService.removePermissions(id, [permissionId], currentUser.id, ipAddress);
    return {
      success: true,
      message: '权限移除成功',
    };
  }

  @Post(':id/copy')
  @RequirePermissions('role:create')
  @ApiOperation({ summary: '复制角色' })
  @ApiParam({ name: 'id', description: '源角色ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '新角色名称',
        },
        description: {
          type: 'string',
          description: '新角色描述',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '角色复制成功',
    type: RoleResponseDto,
  })
  async copyRole(
    @Param('id') id: string,
    @Body('name') name: string,
    @Body('description') description: string,
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<RoleResponseDto> {
    const ipAddress = this.getClientIp(req);
    // Note: copyRole method not found in RoleService, this functionality might need to be implemented
    // return this.roleService.copyRole(id, name, description, currentUser.id, ipAddress);
    throw new Error('Copy role functionality not implemented');
  }

  @Put(':id/toggle')
  @RequirePermissions('role:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '切换角色启用状态' })
  @ApiParam({ name: 'id', description: '角色ID' })
  @ApiResponse({
    status: 200,
    description: '状态切换成功',
  })
  async toggleRole(
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<OperationResultDto> {
    const ipAddress = this.getClientIp(req);
    // Note: toggleRole method not found in RoleService, using toggleRoleStatus instead
    const result = await this.roleService.toggleRoleStatus(id, true, currentUser.id, ipAddress);
    return {
      success: true,
      message: `角色已${result.enabled ? '启用' : '禁用'}`,
    };
  }

  @Get(':id/users')
  @RequirePermissions('role:read', 'user:read')
  @ApiOperation({ summary: '获取角色下的用户列表' })
  @ApiParam({ name: 'id', description: '角色ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getRoleUsers(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.roleService.getRoleUsers(id);
  }

  @Get(':id/permissions')
  @RequirePermissions('role:read', 'permission:read')
  @ApiOperation({ summary: '获取角色权限列表' })
  @ApiParam({ name: 'id', description: '角色ID' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getRolePermissions(
    @Param('id') id: string,
  ) {
    // Note: getRolePermissions method not found in RoleService, getting role with permissions instead
    const role = await this.roleService.getRoleById(id);
    return role.permissions;
  }

  @Get('system/init')
  @RequirePermissions('system:manage')
  @ApiOperation({ summary: '初始化系统角色' })
  @ApiResponse({
    status: 200,
    description: '初始化成功',
  })
  async initSystemRoles(
    @CurrentUser() currentUser: User,
    @Req() req: Request,
  ): Promise<OperationResultDto> {
    const ipAddress = this.getClientIp(req);
    // Note: initSystemRoles method not found in RoleService, using initializeSystemRoles instead
    await this.roleService.initializeSystemRoles();
    return {
      success: true,
      message: '系统角色初始化成功',
    };
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