import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ProcessStatus } from '../interfaces/process.interface';

@Entity('process_info')
export class ProcessInfoEntity {
  @PrimaryColumn({ name: 'server_id' })
  serverId: string;

  @Column({ type: 'integer' })
  pid: number;

  @Column({ name: 'start_time', type: 'timestamp with time zone' })
  startTime: Date;

  @Column({
    type: 'varchar',
    length: 20,
    enum: ProcessStatus,
    default: ProcessStatus.STOPPED
  })
  status: ProcessStatus;

  @Column({ name: 'restart_count', type: 'integer', default: 0 })
  restartCount: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string;

  @Column({ name: 'memory_usage', type: 'jsonb', nullable: true })
  memoryUsage?: NodeJS.MemoryUsage;

  @Column({ name: 'cpu_usage', type: 'jsonb', nullable: true })
  cpuUsage?: NodeJS.CpuUsage;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}