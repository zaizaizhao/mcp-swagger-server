import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MCPServerEntity } from './mcp-server.entity';
import { User } from './user.entity';

export enum SystemLogEventType {
  // MCP服务器生命周期事件
  SERVER_STARTED = 'server_started',
  SERVER_STOPPED = 'server_stopped',
  SERVER_RESTARTED = 'server_restarted',
  SERVER_CRASHED = 'server_crashed',
  SERVER_TIMEOUT = 'server_timeout',
  
  // MCP服务器配置事件
  SERVER_CREATED = 'server_created',
  SERVER_UPDATED = 'server_updated',
  SERVER_DELETED = 'server_deleted',
  SERVER_CONFIG_CHANGED = 'server_config_changed',
  
  // MCP连接事件
  CONNECTION_ESTABLISHED = 'connection_established',
  CONNECTION_LOST = 'connection_lost',
  CONNECTION_RETRY = 'connection_retry',
  CONNECTION_FAILED = 'connection_failed',
  
  // 健康检查事件
  HEALTH_CHECK_PASSED = 'health_check_passed',
  HEALTH_CHECK_FAILED = 'health_check_failed',
  
  // 系统事件
  SYSTEM_STARTUP = 'system_startup',
  SYSTEM_SHUTDOWN = 'system_shutdown',
  SYSTEM_ERROR = 'system_error',
}

export enum SystemLogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum SystemLogStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  IN_PROGRESS = 'in_progress',
  CANCELLED = 'cancelled',
}

@Entity('system_logs')
@Index(['serverId'])
@Index(['eventType'])
@Index(['level'])
@Index(['status'])
@Index(['createdAt'])
@Index(['userId'])
export class SystemLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: SystemLogEventType,
  })
  eventType: SystemLogEventType;

  @Column({ type: 'varchar', length: 500, nullable: true })
  message?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: SystemLogLevel,
    default: SystemLogLevel.INFO,
  })
  level: SystemLogLevel;

  @Column({
    type: 'enum',
    enum: SystemLogStatus,
    default: SystemLogStatus.SUCCESS,
  })
  status: SystemLogStatus;

  @Column({ type: 'uuid', nullable: true })
  serverId?: string;

  @ManyToOne(() => MCPServerEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'serverId' })
  server?: MCPServerEntity;

  @Column({ type: 'varchar', length: 255, nullable: true })
  serverName?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  serverVersion?: string;

  @Column({ type: 'int', nullable: true })
  serverPort?: number;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'varchar', length: 255, nullable: true })
  source?: string; // 事件来源，如 'process_manager', 'health_checker', 'user_action'

  @Column({ type: 'jsonb', nullable: true })
  context?: {
    // 进程信息
    processId?: number;
    processStatus?: string;
    
    // 连接信息
    connectionId?: string;
    endpoint?: string;
    transport?: string;
    
    // 性能指标
    metrics?: {
      cpuUsage?: number;
      memoryUsage?: number;
      responseTime?: number;
      requestCount?: number;
      errorCount?: number;
    };
    
    // 错误信息
    error?: {
      code?: string;
      message?: string;
      stack?: string;
    };
    
    // 配置变更
    configChanges?: {
      before?: any;
      after?: any;
      fields?: string[];
    };
    
    // 额外的上下文信息
    [key: string]: any;
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    duration?: number; // 事件持续时间（毫秒）
    retryCount?: number; // 重试次数
    severity?: number; // 严重程度 (1-10)
    tags?: string[]; // 标签
    correlationId?: string; // 关联ID，用于追踪相关事件
    sessionId?: string; // 会话ID
    requestId?: string; // 请求ID
    [key: string]: any;
  };

  @CreateDateColumn()
  createdAt: Date;

  // 虚拟属性：获取操作者信息
  get actor(): string {
    if (this.user) {
      return this.user.username;
    }
    return this.source || 'System';
  }

  // 虚拟属性：获取事件摘要
  get summary(): string {
    const actor = this.actor;
    const serverInfo = this.serverName ? ` [${this.serverName}]` : '';
    const message = this.message || this.eventType;
    return `${actor}${serverInfo}: ${message}`;
  }

  // 虚拟属性：检查是否为错误事件
  get isError(): boolean {
    return this.level === SystemLogLevel.ERROR || 
           this.level === SystemLogLevel.CRITICAL ||
           this.status === SystemLogStatus.FAILED;
  }

  // 虚拟属性：检查是否为服务器生命周期事件
  get isLifecycleEvent(): boolean {
    const lifecycleEvents = [
      SystemLogEventType.SERVER_STARTED,
      SystemLogEventType.SERVER_STOPPED,
      SystemLogEventType.SERVER_RESTARTED,
      SystemLogEventType.SERVER_CRASHED,
    ];
    return lifecycleEvents.includes(this.eventType);
  }

  // 虚拟属性：检查是否为连接事件
  get isConnectionEvent(): boolean {
    const connectionEvents = [
      SystemLogEventType.CONNECTION_ESTABLISHED,
      SystemLogEventType.CONNECTION_LOST,
      SystemLogEventType.CONNECTION_RETRY,
      SystemLogEventType.CONNECTION_FAILED,
    ];
    return connectionEvents.includes(this.eventType);
  }

  // 虚拟属性：获取严重程度
  get severityLevel(): number {
    if (this.metadata?.severity) {
      return this.metadata.severity;
    }
    
    // 根据level和status自动计算严重程度
    switch (this.level) {
      case SystemLogLevel.CRITICAL:
        return 10;
      case SystemLogLevel.ERROR:
        return this.status === SystemLogStatus.FAILED ? 8 : 7;
      case SystemLogLevel.WARNING:
        return 5;
      case SystemLogLevel.INFO:
        return 3;
      case SystemLogLevel.DEBUG:
        return 1;
      default:
        return 3;
    }
  }
}