import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export enum AuditAction {
  // 用户操作
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  USER_LOGIN_FAILED = 'user_login_failed',
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  USER_PASSWORD_CHANGED = 'user_password_changed',
  USER_ROLE_ASSIGNED = 'user_role_assigned',
  USER_ROLE_REMOVED = 'user_role_removed',
  USER_LOCKED = 'user_locked',
  USER_UNLOCKED = 'user_unlocked',

  // 服务器操作
  SERVER_CREATED = 'server_created',
  SERVER_UPDATED = 'server_updated',
  SERVER_DELETED = 'server_deleted',
  SERVER_STARTED = 'server_started',
  SERVER_STOPPED = 'server_stopped',
  SERVER_RESTARTED = 'server_restarted',

  // API操作
  API_CALLED = 'api_called',
  API_CONFIGURED = 'api_configured',
  API_TESTED = 'api_tested',

  // 配置操作
  CONFIG_UPDATED = 'config_updated',
  CONFIG_EXPORTED = 'config_exported',
  CONFIG_IMPORTED = 'config_imported',
  CONFIG_RESET = 'config_reset',

  // 安全操作
  PERMISSION_GRANTED = 'permission_granted',
  PERMISSION_REVOKED = 'permission_revoked',
  ROLE_CREATED = 'role_created',
  ROLE_UPDATED = 'role_updated',
  ROLE_DELETED = 'role_deleted',
  API_KEY_CREATED = 'api_key_created',
  API_KEY_DELETED = 'api_key_deleted',
  API_KEY_USED = 'api_key_used',

  // 系统操作
  SYSTEM_BACKUP = 'system_backup',
  SYSTEM_RESTORE = 'system_restore',
  SYSTEM_MAINTENANCE = 'system_maintenance',
}

export enum AuditLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum AuditStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PENDING = 'pending',
}

@Entity('audit_logs')
@Index(['userId'])
@Index(['action'])
@Index(['level'])
@Index(['status'])
@Index(['createdAt'])
@Index(['ipAddress'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: AuditLevel,
    default: AuditLevel.INFO,
  })
  level: AuditLevel;

  @Column({
    type: 'enum',
    enum: AuditStatus,
    default: AuditStatus.SUCCESS,
  })
  status: AuditStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  resource?: string; // 操作的资源类型，如 'user', 'server', 'config'

  @Column({ type: 'varchar', length: 255, nullable: true })
  resourceId?: string; // 操作的资源ID

  @Column({ type: 'inet', nullable: true })
  ipAddress?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sessionId?: string;

  @Column({ type: 'jsonb', nullable: true })
  details?: {
    // 操作前的数据
    before?: any;
    // 操作后的数据
    after?: any;
    // 额外的上下文信息
    context?: {
      method?: string;
      url?: string;
      headers?: Record<string, string>;
      query?: Record<string, any>;
      body?: any;
      [key: string]: any;
    };
    // 错误信息
    error?: {
      message?: string;
      stack?: string;
      code?: string;
    };
    [key: string]: any;
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    duration?: number; // 操作耗时（毫秒）
    size?: number; // 数据大小
    count?: number; // 影响的记录数
    tags?: string[]; // 标签
    [key: string]: any;
  };

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @ManyToOne(() => User, user => user.auditLogs, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @CreateDateColumn()
  createdAt: Date;

  // 获取操作者信息
  get actor(): string {
    return this.user ? this.user.username : 'System';
  }

  // 获取操作摘要
  get summary(): string {
    const actor = this.actor;
    const resource = this.resource ? ` ${this.resource}` : '';
    const resourceId = this.resourceId ? ` (${this.resourceId})` : '';
    return `${actor} ${this.action}${resource}${resourceId}`;
  }

  // 检查是否为安全相关操作
  get isSecurityRelated(): boolean {
    const securityActions = [
      AuditAction.USER_LOGIN,
      AuditAction.USER_LOGIN_FAILED,
      AuditAction.USER_LOCKED,
      AuditAction.USER_UNLOCKED,
      AuditAction.PERMISSION_GRANTED,
      AuditAction.PERMISSION_REVOKED,
      AuditAction.API_KEY_CREATED,
      AuditAction.API_KEY_DELETED,
      AuditAction.API_KEY_USED,
    ];
    return securityActions.includes(this.action);
  }

  // 检查是否为失败操作
  get isFailed(): boolean {
    return this.status === AuditStatus.FAILED;
  }

  // 检查是否为高风险操作
  get isHighRisk(): boolean {
    const highRiskActions = [
      AuditAction.USER_DELETED,
      AuditAction.SERVER_DELETED,
      AuditAction.CONFIG_RESET,
      AuditAction.SYSTEM_RESTORE,
      AuditAction.ROLE_DELETED,
    ];
    return highRiskActions.includes(this.action) || this.level === AuditLevel.CRITICAL;
  }
}