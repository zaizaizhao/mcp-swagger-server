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
import { User } from './user.entity';
import {
  getIpColumnOptions,
  getTimestampColumnOptions,
  getUuidColumnOptions,
} from '../db-compat';

@Entity('refresh_tokens')
@Index(['token'], { unique: true })
@Index(['userId'])
@Index(['expiresAt'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 500, unique: true })
  token: string;

  @Column(getUuidColumnOptions(process.env.DB_TYPE))
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column(getTimestampColumnOptions(process.env.DB_TYPE))
  expiresAt: Date;

  @Column({ type: 'boolean', default: false })
  isRevoked: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceInfo?: string;

  @Column(getIpColumnOptions(process.env.DB_TYPE, { nullable: true }))
  ipAddress?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent?: string;

  @Column(getTimestampColumnOptions(process.env.DB_TYPE, { nullable: true }))
  lastUsedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 检查令牌是否过期
  get isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  // 检查令牌是否有效
  get isValid(): boolean {
    return !this.isRevoked && !this.isExpired;
  }

  // 撤销令牌
  revoke(): void {
    this.isRevoked = true;
  }

  // 更新最后使用时间
  updateLastUsed(): void {
    this.lastUsedAt = new Date();
  }
}
