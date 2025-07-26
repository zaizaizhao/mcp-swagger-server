import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role, RoleType } from '../../../database/entities/role.entity';
import { Permission } from '../../../database/entities/permission.entity';
import { User } from '../../../database/entities/user.entity';
import { AuditAction, AuditLevel, AuditStatus } from '../../../database/entities/audit-log.entity';
import {
  CreateRoleDto,
  UpdateRoleDto,
  RoleQueryDto,
  RoleResponseDto,
  PaginatedResponseDto,
} from '../dto/security.dto';
import { AuditService } from './audit.service';

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * 创建角色
   */
  async createRole(
    createRoleDto: CreateRoleDto,
    operatorId?: string,
    ipAddress?: string,
  ): Promise<RoleResponseDto> {
    const { name, permissionIds, ...roleData } = createRoleDto;

    // 检查角色名称是否已存在
    const existingRole = await this.roleRepository.findOne({
      where: { name },
    });

    if (existingRole) {
      throw new ConflictException('角色名称已存在');
    }

    // 获取权限
    let permissions: Permission[] = [];
    if (permissionIds && permissionIds.length > 0) {
      permissions = await this.permissionRepository.findBy({
        id: In(permissionIds),
      });
      if (permissions.length !== permissionIds.length) {
        throw new BadRequestException('部分权限不存在');
      }
    }

    // 创建角色
    const role = this.roleRepository.create({
      name,
      permissions,
      type: roleData.type || RoleType.CUSTOM,
      enabled: roleData.enabled !== false,
      priority: roleData.priority || 500,
      ...roleData,
    });

    const savedRole = await this.roleRepository.save(role);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.ROLE_CREATED,
      level: AuditLevel.INFO,
      status: AuditStatus.SUCCESS,
      userId: operatorId,
      resource: 'roles',
      resourceId: savedRole.id,
      ipAddress,
      details: {
        name: savedRole.name,
        type: savedRole.type,
        permissions: permissions.map(p => p.name),
      },
    });

    this.logger.log(`角色创建成功: ${savedRole.name} (${savedRole.id})`);

    return this.toResponseDto(savedRole);
  }

  /**
   * 更新角色
   */
  async updateRole(
    id: string,
    updateRoleDto: UpdateRoleDto,
    operatorId?: string,
    ipAddress?: string,
  ): Promise<RoleResponseDto> {
    const role = await this.findRoleById(id);
    const { permissionIds, ...updateData } = updateRoleDto;

    // 检查是否为系统角色
    if (role.type === RoleType.SYSTEM) {
      throw new BadRequestException('不能修改系统角色');
    }

    // 检查角色名称冲突
    if (updateData.name && updateData.name !== role.name) {
      const existingRole = await this.roleRepository.findOne({
        where: { name: updateData.name },
      });
      if (existingRole) {
        throw new ConflictException('角色名称已存在');
      }
    }

    // 更新权限
    if (permissionIds) {
      const permissions = await this.permissionRepository.findBy({
        id: In(permissionIds),
      });
      if (permissions.length !== permissionIds.length) {
        throw new BadRequestException('部分权限不存在');
      }
      role.permissions = permissions;
    }

    // 更新角色数据
    Object.assign(role, updateData);
    const updatedRole = await this.roleRepository.save(role);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.ROLE_UPDATED,
      level: AuditLevel.INFO,
      status: AuditStatus.SUCCESS,
      userId: operatorId,
      resource: 'roles',
      resourceId: updatedRole.id,
      ipAddress,
      details: {
        changes: updateData,
        permissions: permissionIds ? role.permissions.map(p => p.name) : undefined,
      },
    });

    this.logger.log(`角色更新成功: ${updatedRole.name} (${updatedRole.id})`);

    return this.toResponseDto(updatedRole);
  }

  /**
   * 删除角色
   */
  async deleteRole(
    id: string,
    operatorId?: string,
    ipAddress?: string,
  ): Promise<void> {
    const role = await this.findRoleById(id);

    // 检查是否为系统角色
    if (role.type === RoleType.SYSTEM) {
      throw new BadRequestException('不能删除系统角色');
    }

    // 检查是否有用户使用此角色
    const userCount = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role')
      .where('role.id = :roleId', { roleId: id })
      .getCount();

    if (userCount > 0) {
      throw new BadRequestException(`无法删除角色，还有 ${userCount} 个用户正在使用此角色`);
    }

    await this.roleRepository.remove(role);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.ROLE_DELETED,
      level: AuditLevel.WARNING,
      status: AuditStatus.SUCCESS,
      userId: operatorId,
      resource: 'roles',
      resourceId: id,
      ipAddress,
      details: {
        name: role.name,
        type: role.type,
      },
    });

    this.logger.warn(`角色删除成功: ${role.name} (${id})`);
  }

  /**
   * 获取角色详情
   */
  async getRoleById(id: string): Promise<RoleResponseDto> {
    const role = await this.findRoleById(id);
    return this.toResponseDto(role);
  }

  /**
   * 查询角色列表
   */
  async getRoles(query: RoleQueryDto): Promise<PaginatedResponseDto<RoleResponseDto>> {
    const {
      search,
      type,
      enabled,
      page = 1,
      limit = 20,
    } = query;

    const queryBuilder = this.roleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.permissions', 'permission');

    // 搜索条件
    if (search) {
      queryBuilder.andWhere(
        '(role.name LIKE :search OR role.description LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (type) {
      queryBuilder.andWhere('role.type = :type', { type });
    }

    if (enabled !== undefined) {
      queryBuilder.andWhere('role.enabled = :enabled', { enabled });
    }

    // 排序
    queryBuilder.orderBy('role.priority', 'ASC').addOrderBy('role.name', 'ASC');

    // 分页
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [roles, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data: roles.map(role => this.toResponseDto(role)),
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * 获取所有可用角色（用于下拉选择）
   */
  async getAvailableRoles(): Promise<Array<{ id: string; name: string; description?: string }>> {
    const roles = await this.roleRepository.find({
      where: { enabled: true },
      order: { priority: 'ASC', name: 'ASC' },
      select: ['id', 'name', 'description'],
    });

    return roles;
  }

  /**
   * 为角色分配权限
   */
  async assignPermissions(
    roleId: string,
    permissionIds: string[],
    operatorId?: string,
    ipAddress?: string,
  ): Promise<RoleResponseDto> {
    const role = await this.findRoleById(roleId);

    // 检查是否为系统角色
    if (role.type === RoleType.SYSTEM) {
      throw new BadRequestException('不能修改系统角色的权限');
    }

    // 获取权限
    const permissions = await this.permissionRepository.findBy({
      id: In(permissionIds),
    });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('部分权限不存在');
    }

    role.permissions = permissions;
    const updatedRole = await this.roleRepository.save(role);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.PERMISSION_GRANTED,
      level: AuditLevel.INFO,
      status: AuditStatus.SUCCESS,
      userId: operatorId,
      resource: 'roles',
      resourceId: roleId,
      ipAddress,
      details: {
        roleName: role.name,
        permissions: permissions.map(p => p.name),
      },
    });

    this.logger.log(`角色权限分配成功: ${role.name} - ${permissions.length} 个权限`);

    return this.toResponseDto(updatedRole);
  }

  /**
   * 移除角色权限
   */
  async removePermissions(
    roleId: string,
    permissionIds: string[],
    operatorId?: string,
    ipAddress?: string,
  ): Promise<RoleResponseDto> {
    const role = await this.findRoleById(roleId);

    // 检查是否为系统角色
    if (role.type === RoleType.SYSTEM) {
      throw new BadRequestException('不能修改系统角色的权限');
    }

    // 移除指定权限
    role.permissions = role.permissions.filter(
      permission => !permissionIds.includes(permission.id),
    );

    const updatedRole = await this.roleRepository.save(role);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.PERMISSION_REVOKED,
      level: AuditLevel.INFO,
      status: AuditStatus.SUCCESS,
      userId: operatorId,
      resource: 'roles',
      resourceId: roleId,
      ipAddress,
      details: {
        roleName: role.name,
        removedPermissions: permissionIds,
      },
    });

    this.logger.log(`角色权限移除成功: ${role.name} - ${permissionIds.length} 个权限`);

    return this.toResponseDto(updatedRole);
  }

  /**
   * 复制角色
   */
  async cloneRole(
    sourceRoleId: string,
    newRoleName: string,
    operatorId?: string,
    ipAddress?: string,
  ): Promise<RoleResponseDto> {
    const sourceRole = await this.findRoleById(sourceRoleId);

    // 检查新角色名称是否已存在
    const existingRole = await this.roleRepository.findOne({
      where: { name: newRoleName },
    });

    if (existingRole) {
      throw new ConflictException('角色名称已存在');
    }

    // 创建新角色
    const newRole = this.roleRepository.create({
      name: newRoleName,
      description: `复制自 ${sourceRole.name}`,
      type: RoleType.CUSTOM,
      enabled: true,
      priority: sourceRole.priority,
      permissions: sourceRole.permissions,
      metadata: sourceRole.metadata,
    });

    const savedRole = await this.roleRepository.save(newRole);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.ROLE_CREATED,
      level: AuditLevel.INFO,
      status: AuditStatus.SUCCESS,
      userId: operatorId,
      resource: 'roles',
      resourceId: savedRole.id,
      ipAddress,
      details: {
        sourceRoleName: sourceRole.name,
        newRoleName: savedRole.name,
        permissions: sourceRole.permissions.map(p => p.name),
      },
    });

    this.logger.log(`角色复制成功: ${sourceRole.name} -> ${savedRole.name}`);

    return this.toResponseDto(savedRole);
  }

  /**
   * 获取角色的用户列表
   */
  async getRoleUsers(roleId: string): Promise<Array<{ id: string; username: string; email: string }>> {
    const role = await this.findRoleById(roleId);

    const users = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role')
      .where('role.id = :roleId', { roleId })
      .select(['user.id', 'user.username', 'user.email'])
      .getMany();

    return users;
  }

  /**
   * 启用/禁用角色
   */
  async toggleRoleStatus(
    id: string,
    enabled: boolean,
    operatorId?: string,
    ipAddress?: string,
  ): Promise<RoleResponseDto> {
    const role = await this.findRoleById(id);

    // 检查是否为系统角色
    if (role.type === RoleType.SYSTEM) {
      throw new BadRequestException('不能禁用系统角色');
    }

    role.enabled = enabled;
    const updatedRole = await this.roleRepository.save(role);

    // 记录审计日志
    await this.auditService.log({
      action: enabled ? AuditAction.ROLE_UPDATED : AuditAction.ROLE_UPDATED,
      level: AuditLevel.INFO,
      status: AuditStatus.SUCCESS,
      userId: operatorId,
      resource: 'roles',
      resourceId: id,
      ipAddress,
      details: {
        roleName: role.name,
        enabled,
      },
    });

    this.logger.log(`角色${enabled ? '启用' : '禁用'}成功: ${role.name}`);

    return this.toResponseDto(updatedRole);
  }

  /**
   * 初始化系统角色
   */
  async initializeSystemRoles(): Promise<void> {
    const systemRoles = [
      {
        name: 'SUPER_ADMIN',
        description: '超级管理员，拥有所有权限',
        type: RoleType.SYSTEM,
        priority: 1000,
      },
      {
        name: 'ADMIN',
        description: '管理员，拥有大部分管理权限',
        type: RoleType.SYSTEM,
        priority: 900,
      },
      {
        name: 'OPERATOR',
        description: '操作员，拥有基本操作权限',
        type: RoleType.SYSTEM,
        priority: 500,
      },
      {
        name: 'VIEWER',
        description: '查看者，只有查看权限',
        type: RoleType.SYSTEM,
        priority: 200,
      },
      {
        name: 'GUEST',
        description: '访客，最基本的权限',
        type: RoleType.SYSTEM,
        priority: 100,
        isDefault: true,
      },
    ];

    for (const roleData of systemRoles) {
      const existingRole = await this.roleRepository.findOne({
        where: { name: roleData.name },
      });

      if (!existingRole) {
        const role = this.roleRepository.create({
          ...roleData,
          enabled: true,
        });
        await this.roleRepository.save(role);
        this.logger.log(`系统角色初始化: ${roleData.name}`);
      }
    }
  }

  /**
   * 根据ID查找角色
   */
  private async findRoleById(id: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException('角色不存在');
    }

    return role;
  }

  /**
   * 转换为响应DTO
   */
  private toResponseDto(role: Role): RoleResponseDto {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      type: role.type,
      enabled: role.enabled,
      permissions: role.permissions?.map(permission => ({
        id: permission.id,
        name: permission.name,
        description: permission.description,
        category: permission.category,
        action: permission.action,
        resource: permission.resource,
      })) || [],
      createdAt: role.createdAt,
    };
  }
}