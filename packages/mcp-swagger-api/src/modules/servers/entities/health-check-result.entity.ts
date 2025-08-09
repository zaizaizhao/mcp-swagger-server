import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

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

  @Column({ name: 'memory_usage', type: 'jsonb', nullable: true })
  memoryUsage?: NodeJS.MemoryUsage;

  @Column({ name: 'cpu_usage', type: 'jsonb', nullable: true })
  cpuUsage?: NodeJS.CpuUsage;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;
}