import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  Index,
} from 'typeorm';
import { Role } from './role.entity';

export enum PermissionCategory {
  SYSTEM = 'system',
  USER_MANAGEMENT = 'user_management',
  SERVER_MANAGEMENT = 'server_management',
  API_MANAGEMENT = 'api_management',
  MONITORING = 'monitoring',
  CONFIGURATION = 'configuration',
  SECURITY = 'security',
  AUDIT = 'audit',
}

export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  EXECUTE = 'execute',
  MANAGE = 'manage',
  VIEW = 'view',
  EXPORT = 'export',
  IMPORT = 'import',
}

@Entity('permissions')
@Index(['name'], { unique: true })
@Index(['category', 'action'])
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: PermissionCategory,
  })
  category: PermissionCategory;

  @Column({
    type: 'enum',
    enum: PermissionAction,
  })
  action: PermissionAction;

  @Column({ type: 'varchar', length: 100, nullable: true })
  resource?: string; // 资源名称，如 'servers', 'users', 'configs'

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'boolean', default: false })
  isSystem: boolean; // 系统权限，不可删除

  @Column({ type: 'jsonb', nullable: true })
  conditions?: {
    // 权限条件，如IP限制、时间限制等
    ipWhitelist?: string[];
    timeRestriction?: {
      startTime?: string;
      endTime?: string;
      weekdays?: number[];
    };
    [key: string]: any;
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    icon?: string;
    color?: string;
    group?: string;
    [key: string]: any;
  };

  @ManyToMany(() => Role, role => role.permissions)
  roles: Role[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 获取权限的完整标识符
  get identifier(): string {
    return `${this.category}:${this.action}${this.resource ? ':' + this.resource : ''}`;
  }

  // 检查是否为系统权限
  get isSystemPermission(): boolean {
    return this.isSystem;
  }
}

// 预定义的系统权限
export const SYSTEM_PERMISSIONS = {
  // 系统管理权限
  SYSTEM_MANAGE: {
    name: 'system:manage',
    description: '系统管理权限',
    category: PermissionCategory.SYSTEM,
    action: PermissionAction.MANAGE,
    isSystem: true,
  },
  SYSTEM_VIEW: {
    name: 'system:view',
    description: '系统查看权限',
    category: PermissionCategory.SYSTEM,
    action: PermissionAction.VIEW,
    isSystem: true,
  },

  // 用户管理权限
  USER_CREATE: {
    name: 'user:create',
    description: '创建用户',
    category: PermissionCategory.USER_MANAGEMENT,
    action: PermissionAction.CREATE,
    resource: 'users',
    isSystem: true,
  },
  USER_READ: {
    name: 'user:read',
    description: '查看用户',
    category: PermissionCategory.USER_MANAGEMENT,
    action: PermissionAction.READ,
    resource: 'users',
    isSystem: true,
  },
  USER_UPDATE: {
    name: 'user:update',
    description: '更新用户',
    category: PermissionCategory.USER_MANAGEMENT,
    action: PermissionAction.UPDATE,
    resource: 'users',
    isSystem: true,
  },
  USER_DELETE: {
    name: 'user:delete',
    description: '删除用户',
    category: PermissionCategory.USER_MANAGEMENT,
    action: PermissionAction.DELETE,
    resource: 'users',
    isSystem: true,
  },
  USER_MANAGE: {
    name: 'user:manage',
    description: '管理用户（包含所有用户操作）',
    category: PermissionCategory.USER_MANAGEMENT,
    action: PermissionAction.MANAGE,
    resource: 'users',
    isSystem: true,
  },

  // 服务器管理权限
  SERVER_CREATE: {
    name: 'server:create',
    description: '创建服务器',
    category: PermissionCategory.SERVER_MANAGEMENT,
    action: PermissionAction.CREATE,
    resource: 'servers',
    isSystem: true,
  },
  SERVER_READ: {
    name: 'server:read',
    description: '查看服务器',
    category: PermissionCategory.SERVER_MANAGEMENT,
    action: PermissionAction.READ,
    resource: 'servers',
    isSystem: true,
  },
  SERVER_UPDATE: {
    name: 'server:update',
    description: '更新服务器',
    category: PermissionCategory.SERVER_MANAGEMENT,
    action: PermissionAction.UPDATE,
    resource: 'servers',
    isSystem: true,
  },
  SERVER_DELETE: {
    name: 'server:delete',
    description: '删除服务器',
    category: PermissionCategory.SERVER_MANAGEMENT,
    action: PermissionAction.DELETE,
    resource: 'servers',
    isSystem: true,
  },
  SERVER_EXECUTE: {
    name: 'server:execute',
    description: '执行服务器操作',
    category: PermissionCategory.SERVER_MANAGEMENT,
    action: PermissionAction.EXECUTE,
    resource: 'servers',
    isSystem: true,
  },
  SERVER_MANAGE: {
    name: 'server:manage',
    description: '管理服务器（包含所有服务器操作）',
    category: PermissionCategory.SERVER_MANAGEMENT,
    action: PermissionAction.MANAGE,
    resource: 'servers',
    isSystem: true,
  },

  // API管理权限
  API_READ: {
    name: 'api:read',
    description: '查看API',
    category: PermissionCategory.API_MANAGEMENT,
    action: PermissionAction.READ,
    resource: 'apis',
    isSystem: true,
  },
  API_EXECUTE: {
    name: 'api:execute',
    description: '执行API',
    category: PermissionCategory.API_MANAGEMENT,
    action: PermissionAction.EXECUTE,
    resource: 'apis',
    isSystem: true,
  },
  API_MANAGE: {
    name: 'api:manage',
    description: '管理API',
    category: PermissionCategory.API_MANAGEMENT,
    action: PermissionAction.MANAGE,
    resource: 'apis',
    isSystem: true,
  },

  // 监控权限
  MONITORING_VIEW: {
    name: 'monitoring:view',
    description: '查看监控数据',
    category: PermissionCategory.MONITORING,
    action: PermissionAction.VIEW,
    resource: 'monitoring',
    isSystem: true,
  },
  MONITORING_MANAGE: {
    name: 'monitoring:manage',
    description: '管理监控',
    category: PermissionCategory.MONITORING,
    action: PermissionAction.MANAGE,
    resource: 'monitoring',
    isSystem: true,
  },

  // 配置管理权限
  CONFIG_READ: {
    name: 'config:read',
    description: '查看配置',
    category: PermissionCategory.CONFIGURATION,
    action: PermissionAction.READ,
    resource: 'configs',
    isSystem: true,
  },
  CONFIG_UPDATE: {
    name: 'config:update',
    description: '更新配置',
    category: PermissionCategory.CONFIGURATION,
    action: PermissionAction.UPDATE,
    resource: 'configs',
    isSystem: true,
  },
  CONFIG_EXPORT: {
    name: 'config:export',
    description: '导出配置',
    category: PermissionCategory.CONFIGURATION,
    action: PermissionAction.EXPORT,
    resource: 'configs',
    isSystem: true,
  },
  CONFIG_IMPORT: {
    name: 'config:import',
    description: '导入配置',
    category: PermissionCategory.CONFIGURATION,
    action: PermissionAction.IMPORT,
    resource: 'configs',
    isSystem: true,
  },
  CONFIG_MANAGE: {
    name: 'config:manage',
    description: '管理配置',
    category: PermissionCategory.CONFIGURATION,
    action: PermissionAction.MANAGE,
    resource: 'configs',
    isSystem: true,
  },

  // 安全管理权限
  SECURITY_VIEW: {
    name: 'security:view',
    description: '查看安全信息',
    category: PermissionCategory.SECURITY,
    action: PermissionAction.VIEW,
    resource: 'security',
    isSystem: true,
  },
  SECURITY_MANAGE: {
    name: 'security:manage',
    description: '管理安全设置',
    category: PermissionCategory.SECURITY,
    action: PermissionAction.MANAGE,
    resource: 'security',
    isSystem: true,
  },

  // 审计权限
  AUDIT_VIEW: {
    name: 'audit:view',
    description: '查看审计日志',
    category: PermissionCategory.AUDIT,
    action: PermissionAction.VIEW,
    resource: 'audit',
    isSystem: true,
  },
  AUDIT_EXPORT: {
    name: 'audit:export',
    description: '导出审计日志',
    category: PermissionCategory.AUDIT,
    action: PermissionAction.EXPORT,
    resource: 'audit',
    isSystem: true,
  },
};