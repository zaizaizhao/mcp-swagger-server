import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import { LogLevel } from '../interfaces/process.interface';

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
    type: 'varchar',
    length: 10,
    enum: LogLevel
  })
  level: LogLevel;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;
}