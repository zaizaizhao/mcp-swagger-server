import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MCPServerEntity } from './mcp-server.entity';
import {
  getEnumColumnOptions,
  getJsonColumnOptions,
  getTimestampColumnOptions,
  getUuidColumnOptions,
} from '../db-compat';

export enum TestStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

@Entity('test_cases')
@Index(['serverId', 'name'], { unique: true })
@Index(['status'])
@Index(['tags'])
export class TestCaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  serverName: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 255 })
  toolName: string;

  @Column(getJsonColumnOptions(process.env.DB_TYPE))
  input: any;

  @Column(getJsonColumnOptions(process.env.DB_TYPE, { nullable: true }))
  expectedOutput?: any;

  @Column(getJsonColumnOptions(process.env.DB_TYPE, { nullable: true }))
  actualOutput?: any;

  @Column({
    ...getEnumColumnOptions(process.env.DB_TYPE, TestStatus),
    default: TestStatus.PENDING,
  })
  status: TestStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'int', nullable: true })
  executionTime?: number; // 执行时间（毫秒）

  @Column(getTimestampColumnOptions(process.env.DB_TYPE, { nullable: true }))
  lastRun?: Date;

  @Column({ type: 'int', default: 0 })
  runCount: number;

  @Column({ type: 'int', default: 0 })
  passCount: number;

  @Column({ type: 'int', default: 0 })
  failCount: number;

  @Column(getJsonColumnOptions(process.env.DB_TYPE, { nullable: true }))
  tags?: string[];

  @Column({ type: 'int', default: 0 })
  priority: number; // 优先级，数字越大优先级越高

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column(getJsonColumnOptions(process.env.DB_TYPE, { nullable: true }))
  config?: {
    timeout?: number;
    retries?: number;
    skipOnFailure?: boolean;
    [key: string]: any;
  };

  @Column(getJsonColumnOptions(process.env.DB_TYPE, { nullable: true }))
  assertions?: {
    type: 'equals' | 'contains' | 'regex' | 'custom';
    field?: string;
    value?: any;
    message?: string;
  }[];

  @Column(getUuidColumnOptions(process.env.DB_TYPE))
  serverId: string;

  @ManyToOne(() => MCPServerEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'serverId' })
  server: MCPServerEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 虚拟属性：成功率
  get successRate(): number {
    if (this.runCount === 0) return 0;
    return (this.passCount / this.runCount) * 100;
  }

  // 虚拟属性：是否可以运行
  get canRun(): boolean {
    return this.enabled && this.status !== TestStatus.RUNNING;
  }

  // 虚拟属性：最后运行状态
  get lastRunStatus(): string {
    if (!this.lastRun) return 'never';
    return this.status;
  }
}
