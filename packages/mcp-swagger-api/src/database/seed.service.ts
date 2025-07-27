import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User, UserStatus } from './entities/user.entity';
import { Role, SYSTEM_ROLES, RoleType } from './entities/role.entity';
import { Permission, SYSTEM_PERMISSIONS } from './entities/permission.entity';

/**
 * 数据库种子服务
 * 负责系统启动时的数据初始化，包括角色、权限和超级用户的创建
 */
@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      this.logger.log('🌱 开始数据库种子数据初始化...');
      
      // 1. 初始化系统权限
      await this.initializePermissions();
      
      // 2. 初始化系统角色
      await this.initializeRoles();
      
      // 3. 检查并创建超级用户
      await this.initializeSuperAdmin();
      
      this.logger.log('✅ 数据库种子数据初始化完成');
    } catch (error) {
      this.logger.error('❌ 数据库种子数据初始化失败:', error);
      throw error;
    }
  }

  /**
   * 初始化系统权限
   */
  private async initializePermissions(): Promise<void> {
    this.logger.log('📋 初始化系统权限...');
    
    const permissions = Object.values(SYSTEM_PERMISSIONS);
    let createdCount = 0;
    
    for (const permissionData of permissions) {
      const existingPermission = await this.permissionRepository.findOne({
        where: { name: permissionData.name }
      });
      
      if (!existingPermission) {
        const permission = this.permissionRepository.create(permissionData);
        await this.permissionRepository.save(permission);
        createdCount++;
        this.logger.debug(`创建权限: ${permissionData.name}`);
      }
    }
    
    this.logger.log(`📋 权限初始化完成，创建了 ${createdCount} 个新权限`);
  }

  /**
   * 初始化系统角色
   */
  private async initializeRoles(): Promise<void> {
    this.logger.log('👥 初始化系统角色...');
    
    const roles = Object.values(SYSTEM_ROLES);
    let createdCount = 0;
    
    for (const roleData of roles) {
      const existingRole = await this.roleRepository.findOne({
        where: { name: roleData.name },
        relations: ['permissions']
      });
      
      if (!existingRole) {
        const role = this.roleRepository.create(roleData);
        
        // 为超级管理员角色分配所有权限
        if (roleData.name === 'super_admin') {
          const allPermissions = await this.permissionRepository.find();
          role.permissions = allPermissions;
        }
        // 为管理员角色分配用户管理权限
        else if (roleData.name === 'admin') {
          const adminPermissions = await this.permissionRepository.find({
            where: [
              { name: 'user:create' },
              { name: 'user:read' },
              { name: 'user:update' },
              { name: 'user:delete' },
              { name: 'server:read' },
              { name: 'system:view' }
            ]
          });
          role.permissions = adminPermissions;
        }
        // 为查看者角色分配基础查看权限
        else if (roleData.name === 'viewer') {
          const viewerPermissions = await this.permissionRepository.find({
            where: [
              { name: 'user:read' },
              { name: 'server:read' },
              { name: 'system:view' }
            ]
          });
          role.permissions = viewerPermissions;
        }
        
        await this.roleRepository.save(role);
        createdCount++;
        this.logger.debug(`创建角色: ${roleData.name}`);
      } else {
        // 更新现有角色的权限（如果是超级管理员）
        if (roleData.name === 'super_admin') {
          const allPermissions = await this.permissionRepository.find();
          existingRole.permissions = allPermissions;
          await this.roleRepository.save(existingRole);
          this.logger.debug(`更新超级管理员权限`);
        }
      }
    }
    
    this.logger.log(`👥 角色初始化完成，创建了 ${createdCount} 个新角色`);
  }

  /**
   * 初始化超级用户
   */
  private async initializeSuperAdmin(): Promise<void> {
    this.logger.log('👑 检查超级用户...');
    
    // 检查是否已存在超级管理员
    const superAdminRole = await this.roleRepository.findOne({
      where: { name: 'super_admin' },
      relations: ['users']
    });
    
    if (!superAdminRole) {
      this.logger.error('❌ 超级管理员角色不存在');
      throw new Error('Super admin role not found');
    }
    
    // 检查是否已有超级管理员用户
    const existingSuperAdmin = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role')
      .where('role.name = :roleName', { roleName: 'super_admin' })
      .getOne();
    
    if (existingSuperAdmin) {
      this.logger.log(`👑 超级用户已存在: ${existingSuperAdmin.username}`);
      return;
    }
    
    // 创建默认超级用户
    const superAdminData = {
      username: this.configService.get('SUPER_ADMIN_USERNAME', 'admin'),
      email: this.configService.get('SUPER_ADMIN_EMAIL', 'admin@example.com'),
      password: this.configService.get('SUPER_ADMIN_PASSWORD', 'Admin@123456'),
      firstName: this.configService.get('SUPER_ADMIN_FIRST_NAME', 'Super'),
      lastName: this.configService.get('SUPER_ADMIN_LAST_NAME', 'Admin'),
      status: UserStatus.ACTIVE,
      emailVerified: true,
      metadata: {
        isSystemUser: true,
        createdBySystem: true,
        department: 'System Administration',
        position: 'Super Administrator'
      }
    };
    
    try {
      const superAdmin = this.userRepository.create(superAdminData);
      superAdmin.roles = [superAdminRole];
      
      await this.userRepository.save(superAdmin);
      
      this.logger.log(`👑 超级用户创建成功:`);
      this.logger.log(`   用户名: ${superAdminData.username}`);
      this.logger.log(`   邮箱: ${superAdminData.email}`);
      this.logger.log(`   ⚠️  请在首次登录后立即修改默认密码！`);
      
    } catch (error) {
      this.logger.error('❌ 创建超级用户失败:', error);
      throw error;
    }
  }

  /**
   * 检查系统是否已初始化
   */
  async isSystemInitialized(): Promise<boolean> {
    const superAdminRole = await this.roleRepository.findOne({
      where: { name: 'super_admin' },
      relations: ['users']
    });
    
    return superAdminRole && superAdminRole.users && superAdminRole.users.length > 0;
  }

  /**
   * 获取系统初始化状态
   */
  async getInitializationStatus(): Promise<{
    isInitialized: boolean;
    permissionCount: number;
    roleCount: number;
    superAdminExists: boolean;
  }> {
    const [permissionCount, roleCount, isInitialized] = await Promise.all([
      this.permissionRepository.count(),
      this.roleRepository.count(),
      this.isSystemInitialized()
    ]);
    
    return {
      isInitialized,
      permissionCount,
      roleCount,
      superAdminExists: isInitialized
    };
  }
}