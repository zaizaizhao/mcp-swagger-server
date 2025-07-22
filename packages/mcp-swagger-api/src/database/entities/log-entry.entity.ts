import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MCPServerEntity } from './mcp-server.entity';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

export enum LogSource {
  SYSTEM = 'system',
  MCP_SERVER = 'mcp_server',
  API = 'api',
  TOOL_EXECUTION = 'tool_execution',
  AUTH = 'auth',
  DATABASE = 'database',
  HEALTH_CHECK = 'health_check',
}

@Entity('log_entries')
@Index(['level'])
@Index(['source'])
@Index(['serverId'])
@Index(['timestamp'])
@Index(['level', 'timestamp'])
export class LogEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: LogLevel,
    default: LogLevel.INFO,
  })
  level: LogLevel;

  @Column({
    type: 'enum',
    enum: LogSource,
    default: LogSource.SYSTEM,
  })
  source: LogSource;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  context?: {
    userId?: string;
    requestId?: string;
    toolName?: string;
    endpoint?: string;
    method?: string;
    statusCode?: number;
    duration?: number;
    error?: {
      name: string;
      message: string;
      stack?: string;
    };
    [key: string]: any;
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    userAgent?: string;
    ip?: string;
    correlationId?: string;
    sessionId?: string;
    [key: string]: any;
  };

  @Column({ type: 'uuid', nullable: true })
  serverId?: string;

  @ManyToOne(() => MCPServerEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'serverId' })
  server?: MCPServerEntity;

  @Column({ type: 'varchar', length: 100, nullable: true })
  component?: string; // 组件名称，如 'MCPService', 'OpenAPIController' 等

  @Column({ type: 'varchar', length: 100, nullable: true })
  operation?: string; // 操作名称，如 'createServer', 'executeTools' 等

  @Column({ type: 'text', nullable: true })
  stackTrace?: string;

  @Column({ type: 'jsonb', nullable: true })
  tags?: string[];

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;

  // 虚拟属性：是否为错误日志
  get isError(): boolean {
    return this.level === LogLevel.ERROR || this.level === LogLevel.FATAL;
  }

  // 虚拟属性：是否为警告或更严重
  get isWarningOrAbove(): boolean {
    return [LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL].includes(this.level);
  }

  // 虚拟属性：格式化的时间戳
  get formattedTimestamp(): string {
    return this.timestamp.toISOString();
  }

  // 虚拟属性：简短消息（用于列表显示）
  get shortMessage(): string {
    return this.message.length > 100 
      ? this.message.substring(0, 100) + '...' 
      : this.message;
  }
}