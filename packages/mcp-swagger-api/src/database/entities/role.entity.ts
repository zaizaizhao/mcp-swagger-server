import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Permission } from './permission.entity';

export enum RoleType {
  SYSTEM = 'system',
  ADMIN = 'admin',
  USER = 'user',
  CUSTOM = 'custom',
}

@Entity('roles')
@Index(['name'], { unique: true })
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: RoleType,
    default: RoleType.CUSTOM,
  })
  type: RoleType;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'int', default: 0 })
  priority: number; // 角色优先级，数字越大优先级越高

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    color?: string;
    icon?: string;
    category?: string;
    [key: string]: any;
  };

  @ManyToMany(() => User, user => user.roles)
  users: User[];

  @ManyToMany(() => Permission, permission => permission.roles, { eager: true })
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'roleId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permissionId', referencedColumnName: 'id' },
  })
  permissions: Permission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 获取角色的所有权限名称
  get permissionNames(): string[] {
    return this.permissions?.map(permission => permission.name) || [];
  }

  // 检查角色是否有特定权限
  hasPermission(permissionName: string): boolean {
    return this.permissionNames.includes(permissionName);
  }

  // 检查是否为系统角色（不可删除）
  get isSystemRole(): boolean {
    return this.type === RoleType.SYSTEM;
  }

  // 获取用户数量
  get userCount(): number {
    return this.users?.length || 0;
  }
}

// 预定义的系统角色
export const SYSTEM_ROLES = {
  SUPER_ADMIN: {
    name: 'super_admin',
    description: '超级管理员，拥有所有权限',
    type: RoleType.SYSTEM,
    priority: 1000,
  },
  ADMIN: {
    name: 'admin',
    description: '管理员，拥有大部分管理权限',
    type: RoleType.ADMIN,
    priority: 800,
  },
  OPERATOR: {
    name: 'operator',
    description: '操作员，拥有基本操作权限',
    type: RoleType.USER,
    priority: 600,
  },
  VIEWER: {
    name: 'viewer',
    description: '查看者，只有查看权限',
    type: RoleType.USER,
    priority: 400,
    isDefault: true,
  },
  GUEST: {
    name: 'guest',
    description: '访客，最基本的权限',
    type: RoleType.USER,
    priority: 200,
  },
};