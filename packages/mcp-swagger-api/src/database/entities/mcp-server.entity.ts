import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ServerStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  ERROR = 'error',
}

export enum TransportType {
  STREAMABLE = 'streamable',
  SSE = 'sse',
  STDIO = 'stdio',
  WEBSOCKET = 'websocket',
}

@Entity('mcp_servers')
@Index(['name'], { unique: true })
@Index(['status'])
export class MCPServerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 100, default: '1.0.0' })
  version: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'int', default: 3322 })
  port: number;

  @Column({
    type: 'enum',
    enum: TransportType,
    default: TransportType.STREAMABLE,
  })
  transport: TransportType;

  @Column({
    type: 'enum',
    enum: ServerStatus,
    default: ServerStatus.STOPPED,
  })
  status: ServerStatus;

  @Column({ type: 'text', nullable: true })
  endpoint?: string;

  @Column({ type: 'jsonb' })
  openApiData: any;

  @Column({ type: 'jsonb', nullable: true })
  tools?: any[];

  @Column({ type: 'int', default: 0 })
  toolsCount: number;

  @Column({ type: 'jsonb', nullable: true })
  config?: {
    maxRequestSize?: number;
    timeout?: number;
    retries?: number;
    healthCheckInterval?: number;
    [key: string]: any;
  };

  @Column({ type: 'jsonb', nullable: true })
  authConfig?: {
    type: 'none' | 'bearer' | 'apikey' | 'basic' | 'oauth2';
    config: any;
  };

  @Column({ type: 'timestamp', nullable: true })
  lastHealthCheck?: Date;

  @Column({ type: 'boolean', default: true })
  healthy: boolean;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'jsonb', nullable: true })
  metrics?: {
    requestCount?: number;
    errorCount?: number;
    avgResponseTime?: number;
    lastRequestTime?: Date;
    uptime?: number;
    startedAt?: Date;
  };

  @Column({ type: 'boolean', default: true })
  autoStart: boolean;

  @Column({ type: 'jsonb', nullable: true })
  tags?: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 虚拟属性：是否正在运行
  get isRunning(): boolean {
    return this.status === ServerStatus.RUNNING;
  }

  // 虚拟属性：是否可以启动
  get canStart(): boolean {
    return this.status === ServerStatus.STOPPED || this.status === ServerStatus.ERROR;
  }

  // 虚拟属性：是否可以停止
  get canStop(): boolean {
    return this.status === ServerStatus.RUNNING || this.status === ServerStatus.STARTING;
  }

  // 虚拟属性：运行时间
  get uptimeSeconds(): number {
    return this.metrics?.uptime || 0;
  }
}