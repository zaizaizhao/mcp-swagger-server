import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import { getJsonColumnOptions } from '../../../database/db-compat';

@Entity('health_check_results')
@Index(['serverId'])
@Index(['timestamp'])
@Index(['isHealthy'])
export class HealthCheckResultEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'server_id' })
  serverId: string;

  @Column({ name: 'is_healthy', type: 'boolean' })
  isHealthy: boolean;

  @Column({ name: 'response_time', type: 'integer' })
  responseTime: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  error?: string;

  @Column({ name: 'memory_usage', ...getJsonColumnOptions(process.env.DB_TYPE, { nullable: true }) })
  memoryUsage?: NodeJS.MemoryUsage;

  @Column({ name: 'cpu_usage', ...getJsonColumnOptions(process.env.DB_TYPE, { nullable: true }) })
  cpuUsage?: NodeJS.CpuUsage;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;
}
