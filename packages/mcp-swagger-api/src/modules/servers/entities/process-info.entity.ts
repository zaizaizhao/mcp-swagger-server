import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ProcessStatus } from '../interfaces/process.interface';
import {
  getEnumColumnOptions,
  getJsonColumnOptions,
  getTimestampTzColumnOptions,
} from '../../../database/db-compat';

@Entity('process_info')
export class ProcessInfoEntity {
  @PrimaryColumn({ name: 'server_id' })
  serverId: string;

  @Column({ type: 'integer' })
  pid: number;

  @Column({ name: 'start_time', ...getTimestampTzColumnOptions(process.env.DB_TYPE) })
  startTime: Date;

  @Column({
    ...getEnumColumnOptions(process.env.DB_TYPE, ProcessStatus, {
      length: 20,
    }),
    default: ProcessStatus.STOPPED
  })
  status: ProcessStatus;

  @Column({ name: 'restart_count', type: 'integer', default: 0 })
  restartCount: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string;

  @Column({ name: 'memory_usage', ...getJsonColumnOptions(process.env.DB_TYPE, { nullable: true }) })
  memoryUsage?: NodeJS.MemoryUsage;

  @Column({ name: 'cpu_usage', ...getJsonColumnOptions(process.env.DB_TYPE, { nullable: true }) })
  cpuUsage?: NodeJS.CpuUsage;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
