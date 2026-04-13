import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import { LogLevel } from '../interfaces/process.interface';
import {
  getEnumColumnOptions,
  getJsonColumnOptions,
} from '../../../database/db-compat';

@Entity('process_logs')
@Index(['serverId'])
@Index(['timestamp'])
@Index(['level'])
export class ProcessLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'server_id' })
  serverId: string;

  @Column({
    ...getEnumColumnOptions(process.env.DB_TYPE, LogLevel, {
      length: 10,
    }),
  })
  level: LogLevel;

  @Column({ type: 'text' })
  message: string;

  @Column(getJsonColumnOptions(process.env.DB_TYPE, { nullable: true }))
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;
}
