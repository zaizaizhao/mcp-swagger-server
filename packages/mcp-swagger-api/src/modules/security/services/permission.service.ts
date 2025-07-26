import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Permission,
  PermissionCategory,
  PermissionAction,
  SYSTEM_PERMISSIONS,
} from '../../../database/entities/permission.entity';
import { Role } from '../../../database/entities/role.entity';
import { AuditAction, AuditLevel, AuditStatus } from '../../../database/entities/audit-log.entity';
import {
  CreatePermissionDto,
  UpdatePermissionDto,
  PermissionQueryDto,
  PaginatedResponseDto,
} from '../dto/security.dto';
import { AuditService } from './audit.service';

export interface PermissionResponseDto {
  id: string;
  name: string;
  description?: string;
  category: PermissionCategory;
  action: PermissionAction;
  resource?: string;
  enabled: boolean;
  isSystem: boolean;
  conditions?: any;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);

  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * 创建权限
   */
  async createPermission(
    createPermissionDto: CreatePermissionDto,
    operatorId?: string,
    ipAddress?: string,
  ): Promise<PermissionResponseDto> {
    const { name } = createPermissionDto;

    // 检查权限名称是否已存在
    const existingPermission = await this.permissionRepository.findOne({
      where: { name },
    });

    if (existingPermission) {
      throw new ConflictException('权限名称已存在');
    }

    // 创建权限
    const permission = this.permissionRepository.create({
      ...createPermissionDto,
      enabled: createPermissionDto.enabled !== false,
      isSystem: false, // 用户创建的权限不是系统权限
    });

    const savedPermission = await this.permissionRepository.save(permission);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.PERMISSION_GRANTED,
      level: AuditLevel.INFO,
      status: AuditStatus.SUCCESS,
      userId: operatorId,
      resource: 'permissions',
      resourceId: savedPermission.id,
      ipAddress,
      details: {
        name: savedPermission.name,
        category: savedPermission.category,
        action: savedPermission.action,
        resource: savedPermission.resource,
      },
    });

    this.logger.log(`权限创建成功: ${savedPermission.name} (${savedPermission.id})`);

    return this.toResponseDto(savedPermission);
  }

  /**
   * 更新权限
   */
  async updatePermission(
    id: string,
    updatePermissionDto: UpdatePermissionDto,
    operatorId?: string,
    ipAddress?: string,
  ): Promise<PermissionResponseDto> {
    const permission = await this.findPermissionById(id);

    // 检查是否为系统权限
    if (permission.isSystem) {
      throw new BadRequestException('不能修改系统权限');
    }

    // 检查权限名称冲突
    if (updatePermissionDto.name && updatePermissionDto.name !== permission.name) {
      const existingPermission = await this.permissionRepository.findOne({
        where: { name: updatePermissionDto.name },
      });
      if (existingPermission) {
        throw new ConflictException('权限名称已存在');
      }
    }

    // 更新权限数据
    Object.assign(permission, updatePermissionDto);
    const updatedPermission = await this.permissionRepository.save(permission);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.PERMISSION_GRANTED,
      level: AuditLevel.INFO,
      status: AuditStatus.SUCCESS,
      userId: operatorId,
      resource: 'permissions',
      resourceId: updatedPermission.id,
      ipAddress,
      details: {
        changes: updatePermissionDto,
      },
    });

    this.logger.log(`权限更新成功: ${updatedPermission.name} (${updatedPermission.id})`);

    return this.toResponseDto(updatedPermission);
  }

  /**
   * 删除权限
   */
  async deletePermission(
    id: string,
    operatorId?: string,
    ipAddress?: string,
  ): Promise<void> {
    const permission = await this.findPermissionById(id);

    // 检查是否为系统权限
    if (permission.isSystem) {
      throw new BadRequestException('不能删除系统权限');
    }

    // 检查是否有角色使用此权限
    const roleCount = await this.roleRepository
      .createQueryBuilder('role')
      .innerJoin('role.permissions', 'permission')
      .where('permission.id = :permissionId', { permissionId: id })
      .getCount();

    if (roleCount > 0) {
      throw new BadRequestException(`无法删除权限，还有 ${roleCount} 个角色正在使用此权限`);
    }

    await this.permissionRepository.remove(permission);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.PERMISSION_REVOKED,
      level: AuditLevel.WARNING,
      status: AuditStatus.SUCCESS,
      userId: operatorId,
      resource: 'permissions',
      resourceId: id,
      ipAddress,
      details: {
        name: permission.name,
        category: permission.category,
        action: permission.action,
      },
    });

    this.logger.warn(`权限删除成功: ${permission.name} (${id})`);
  }

  /**
   * 获取权限详情
   */
  async getPermissionById(id: string): Promise<PermissionResponseDto> {
    const permission = await this.findPermissionById(id);
    return this.toResponseDto(permission);
  }

  /**
   * 查询权限列表
   */
  async getPermissions(
    query: PermissionQueryDto,
  ): Promise<PaginatedResponseDto<PermissionResponseDto>> {
    const {
      search,
      category,
      action,
      resource,
      enabled,
      page = 1,
      limit = 20,
    } = query;

    const queryBuilder = this.permissionRepository.createQueryBuilder('permission');

    // 搜索条件
    if (search) {
      queryBuilder.andWhere(
        '(permission.name LIKE :search OR permission.description LIKE :search OR permission.resource LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (category) {
      queryBuilder.andWhere('permission.category = :category', { category });
    }

    if (action) {
      queryBuilder.andWhere('permission.action = :action', { action });
    }

    if (resource) {
      queryBuilder.andWhere('permission.resource = :resource', { resource });
    }

    if (enabled !== undefined) {
      queryBuilder.andWhere('permission.enabled = :enabled', { enabled });
    }

    // 排序
    queryBuilder
      .orderBy('permission.category', 'ASC')
      .addOrderBy('permission.action', 'ASC')
      .addOrderBy('permission.name', 'ASC');

    // 分页
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [permissions, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data: permissions.map(permission => this.toResponseDto(permission)),
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * 获取权限分类列表
   */
  async getPermissionCategories(): Promise<Array<{ category: PermissionCategory; count: number }>> {
    const result = await this.permissionRepository
      .createQueryBuilder('permission')
      .select('permission.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('permission.enabled = :enabled', { enabled: true })
      .groupBy('permission.category')
      .getRawMany();

    return result.map(item => ({
      category: item.category,
      count: parseInt(item.count, 10),
    }));
  }

  /**
   * 获取权限操作列表
   */
  async getPermissionActions(): Promise<Array<{ action: PermissionAction; count: number }>> {
    const result = await this.permissionRepository
      .createQueryBuilder('permission')
      .select('permission.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where('permission.enabled = :enabled', { enabled: true })
      .groupBy('permission.action')
      .getRawMany();

    return result.map(item => ({
      action: item.action,
      count: parseInt(item.count, 10),
    }));
  }

  /**
   * 获取资源列表
   */
  async getResources(): Promise<Array<{ resource: string; count: number }>> {
    const result = await this.permissionRepository
      .createQueryBuilder('permission')
      .select('permission.resource', 'resource')
      .addSelect('COUNT(*)', 'count')
      .where('permission.enabled = :enabled', { enabled: true })
      .andWhere('permission.resource IS NOT NULL')
      .groupBy('permission.resource')
      .getRawMany();

    return result.map(item => ({
      resource: item.resource,
      count: parseInt(item.count, 10),
    }));
  }

  /**
   * 启用/禁用权限
   */
  async togglePermissionStatus(
    id: string,
    enabled: boolean,
    operatorId?: string,
    ipAddress?: string,
  ): Promise<PermissionResponseDto> {
    const permission = await this.findPermissionById(id);

    // 检查是否为系统权限
    if (permission.isSystem) {
      throw new BadRequestException('不能禁用系统权限');
    }

    permission.enabled = enabled;
    const updatedPermission = await this.permissionRepository.save(permission);

    // 记录审计日志
    await this.auditService.log({
      action: enabled ? AuditAction.PERMISSION_GRANTED : AuditAction.PERMISSION_REVOKED,
      level: AuditLevel.INFO,
      status: AuditStatus.SUCCESS,
      userId: operatorId,
      resource: 'permissions',
      resourceId: id,
      ipAddress,
      details: {
        permissionName: permission.name,
        enabled,
      },
    });

    this.logger.log(`权限${enabled ? '启用' : '禁用'}成功: ${permission.name}`);

    return this.toResponseDto(updatedPermission);
  }

  /**
   * 批量创建权限
   */
  async createPermissionsBatch(
    permissions: CreatePermissionDto[],
    operatorId?: string,
    ipAddress?: string,
  ): Promise<PermissionResponseDto[]> {
    const createdPermissions: Permission[] = [];

    for (const permissionDto of permissions) {
      // 检查权限名称是否已存在
      const existingPermission = await this.permissionRepository.findOne({
        where: { name: permissionDto.name },
      });

      if (!existingPermission) {
        const permission = this.permissionRepository.create({
          ...permissionDto,
          enabled: permissionDto.enabled !== false,
          isSystem: false,
        });
        createdPermissions.push(permission);
      }
    }

    if (createdPermissions.length > 0) {
      const savedPermissions = await this.permissionRepository.save(createdPermissions);

      // 记录审计日志
      await this.auditService.log({
        action: AuditAction.PERMISSION_GRANTED,
        level: AuditLevel.INFO,
        status: AuditStatus.SUCCESS,
        userId: operatorId,
        resource: 'permissions',
        ipAddress,
        details: {
          count: savedPermissions.length,
          permissions: savedPermissions.map(p => p.name),
        },
      });

      this.logger.log(`批量创建权限成功: ${savedPermissions.length} 个权限`);

      return savedPermissions.map(permission => this.toResponseDto(permission));
    }

    return [];
  }

  /**
   * 检查权限是否存在
   */
  async checkPermissionExists(name: string): Promise<boolean> {
    const permission = await this.permissionRepository.findOne({
      where: { name, enabled: true },
    });
    return !!permission;
  }

  /**
   * 根据名称获取权限
   */
  async getPermissionByName(name: string): Promise<Permission | null> {
    return this.permissionRepository.findOne({
      where: { name, enabled: true },
    });
  }

  /**
   * 获取用户权限列表
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const result = await this.permissionRepository
      .createQueryBuilder('permission')
      .innerJoin('permission.roles', 'role')
      .innerJoin('role.users', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('permission.enabled = :enabled', { enabled: true })
      .andWhere('role.enabled = :roleEnabled', { roleEnabled: true })
      .select('permission.name')
      .distinct(true)
      .getRawMany();

    return result.map(item => item.permission_name);
  }

  /**
   * 初始化系统权限
   */
  async initializeSystemPermissions(): Promise<void> {
    for (const permissionData of Object.values(SYSTEM_PERMISSIONS)) {
      const existingPermission = await this.permissionRepository.findOne({
        where: { name: permissionData.name },
      });

      if (!existingPermission) {
        const permission = this.permissionRepository.create({
          ...permissionData,
          enabled: true,
          isSystem: true,
        });
        await this.permissionRepository.save(permission);
        this.logger.log(`系统权限初始化: ${permissionData.name}`);
      }
    }
  }

  /**
   * 为角色分配系统权限
   */
  async assignSystemPermissionsToRole(roleName: string): Promise<void> {
    const role = await this.roleRepository.findOne({
      where: { name: roleName },
      relations: ['permissions'],
    });

    if (!role) {
      this.logger.warn(`角色不存在: ${roleName}`);
      return;
    }

    let permissionNames: string[] = [];

    // 根据角色分配不同的权限
    switch (roleName) {
      case 'SUPER_ADMIN':
        // 超级管理员拥有所有权限
        const allPermissions = await this.permissionRepository.find({
          where: { enabled: true },
        });
        role.permissions = allPermissions;
        break;

      case 'ADMIN':
        permissionNames = [
          'user:create', 'user:read', 'user:update', 'user:delete',
          'role:create', 'role:read', 'role:update', 'role:delete',
          'permission:read',
          'server:create', 'server:read', 'server:update', 'server:delete',
          'api:create', 'api:read', 'api:update', 'api:delete',
          'monitoring:read',
          'config:read', 'config:update',
          'audit:read',
        ];
        break;

      case 'OPERATOR':
        permissionNames = [
          'user:read',
          'role:read',
          'server:create', 'server:read', 'server:update',
          'api:read', 'api:update',
          'monitoring:read',
          'config:read',
        ];
        break;

      case 'VIEWER':
        permissionNames = [
          'user:read',
          'role:read',
          'server:read',
          'api:read',
          'monitoring:read',
          'config:read',
        ];
        break;

      case 'GUEST':
        permissionNames = [
          'server:read',
          'api:read',
        ];
        break;
    }

    if (permissionNames.length > 0) {
      const permissions = await this.permissionRepository.find({
        where: permissionNames.map(name => ({ name })),
      });
      role.permissions = permissions;
    }

    await this.roleRepository.save(role);
    this.logger.log(`为角色 ${roleName} 分配了 ${role.permissions.length} 个权限`);
  }

  /**
   * 根据ID查找权限
   */
  private async findPermissionById(id: string): Promise<Permission> {
    const permission = await this.permissionRepository.findOne({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundException('权限不存在');
    }

    return permission;
  }

  /**
   * 转换为响应DTO
   */
  private toResponseDto(permission: Permission): PermissionResponseDto {
    return {
      id: permission.id,
      name: permission.name,
      description: permission.description,
      category: permission.category,
      action: permission.action,
      resource: permission.resource,
      enabled: permission.enabled,
      isSystem: permission.isSystem,
      conditions: permission.conditions,
      metadata: permission.metadata,
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt,
    };
  }
}