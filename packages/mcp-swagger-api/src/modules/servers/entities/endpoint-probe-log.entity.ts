import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import { getEnumColumnOptions, getTimestampColumnOptions } from '../../../database/db-compat';

export enum EndpointProbeStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

@Entity('endpoint_probe_logs')
@Index(['serverId', 'checkedAt'])
@Index(['status'])
export class EndpointProbeLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'server_id', type: 'varchar', length: 36 })
  serverId: string;

  @Column({ name: 'probe_url', type: 'text' })
  probeUrl: string;

  @Column({
    name: 'status',
    ...getEnumColumnOptions(process.env.DB_TYPE, EndpointProbeStatus),
    default: EndpointProbeStatus.UNKNOWN,
  })
  status: EndpointProbeStatus;

  @Column({ name: 'http_status', type: 'int', nullable: true })
  httpStatus?: number;

  @Column({ name: 'response_time_ms', type: 'int', nullable: true })
  responseTimeMs?: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn(getTimestampColumnOptions(process.env.DB_TYPE, { name: 'checked_at' }))
  checkedAt: Date;
}
