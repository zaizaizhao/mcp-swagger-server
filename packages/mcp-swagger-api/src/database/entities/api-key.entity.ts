import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import * as crypto from 'crypto';
import { User } from './user.entity';

export enum ApiKeyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

export enum ApiKeyType {
  PERSONAL = 'personal',
  SERVICE = 'service',
  TEMPORARY = 'temporary',
  WEBHOOK = 'webhook',
}

@Entity('api_keys')
@Index(['keyHash'], { unique: true })
@Index(['userId'])
@Index(['status'])
@Index(['expiresAt'])
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  keyHash: string; // 存储密钥的哈希值，不存储原始密钥

  @Column({ type: 'varchar', length: 16 })
  keyPrefix: string; // 密钥前缀，用于识别

  @Column({
    type: 'enum',
    enum: ApiKeyType,
    default: ApiKeyType.PERSONAL,
  })
  type: ApiKeyType;

  @Column({
    type: 'enum',
    enum: ApiKeyStatus,
    default: ApiKeyStatus.ACTIVE,
  })
  status: ApiKeyStatus;

  @Column({ type: 'jsonb', nullable: true })
  permissions?: string[]; // 特定权限列表，如果为空则继承用户权限

  @Column({ type: 'jsonb', nullable: true })
  restrictions?: {
    // IP白名单
    ipWhitelist?: string[];
    // 允许的HTTP方法
    allowedMethods?: string[];
    // 允许的路径模式
    allowedPaths?: string[];
    // 速率限制
    rateLimit?: {
      requests: number;
      window: number; // 时间窗口（秒）
    };
    // 时间限制
    timeRestriction?: {
      startTime?: string; // HH:mm
      endTime?: string; // HH:mm
      weekdays?: number[]; // 0-6, 0为周日
      timezone?: string;
    };
    [key: string]: any;
  };

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt?: Date;

  @Column({ type: 'inet', nullable: true })
  lastUsedIp?: string;

  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @Column({ type: 'int', nullable: true })
  maxUsage?: number; // 最大使用次数限制

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    createdBy?: string; // 创建者
    purpose?: string; // 用途
    environment?: string; // 环境（dev, staging, prod）
    tags?: string[];
    [key: string]: any;
  };

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, user => user.apiKeys, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateKeyPrefix() {
    if (!this.keyPrefix) {
      // 生成类似 "mcp_" 的前缀
      this.keyPrefix = 'mcp_' + crypto.randomBytes(6).toString('hex');
    }
  }

  // 生成API密钥
  static generateApiKey(): { key: string; hash: string; prefix: string } {
    const key = 'mcp_' + crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const prefix = key.substring(0, 16);
    return { key, hash, prefix };
  }

  // 验证API密钥
  static validateApiKey(key: string, hash: string): boolean {
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    return keyHash === hash;
  }

  // 检查密钥是否有效
  get isValid(): boolean {
    if (this.status !== ApiKeyStatus.ACTIVE) {
      return false;
    }

    if (this.expiresAt && new Date() > this.expiresAt) {
      return false;
    }

    if (this.maxUsage && this.usageCount >= this.maxUsage) {
      return false;
    }

    return true;
  }

  // 检查密钥是否过期
  get isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }

  // 检查是否达到使用限制
  get isUsageLimitReached(): boolean {
    return this.maxUsage ? this.usageCount >= this.maxUsage : false;
  }

  // 检查IP是否被允许
  isIpAllowed(ip: string): boolean {
    if (!this.restrictions?.ipWhitelist) {
      return true;
    }
    return this.restrictions.ipWhitelist.includes(ip);
  }

  // 检查HTTP方法是否被允许
  isMethodAllowed(method: string): boolean {
    if (!this.restrictions?.allowedMethods) {
      return true;
    }
    return this.restrictions.allowedMethods.includes(method.toUpperCase());
  }

  // 检查路径是否被允许
  isPathAllowed(path: string): boolean {
    if (!this.restrictions?.allowedPaths) {
      return true;
    }
    return this.restrictions.allowedPaths.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(path);
    });
  }

  // 检查时间限制
  isTimeAllowed(): boolean {
    if (!this.restrictions?.timeRestriction) {
      return true;
    }

    const now = new Date();
    const restriction = this.restrictions.timeRestriction;

    // 检查星期限制
    if (restriction.weekdays && restriction.weekdays.length > 0) {
      const weekday = now.getDay();
      if (!restriction.weekdays.includes(weekday)) {
        return false;
      }
    }

    // 检查时间范围限制
    if (restriction.startTime && restriction.endTime) {
      const currentTime = now.toTimeString().substring(0, 5); // HH:mm
      if (currentTime < restriction.startTime || currentTime > restriction.endTime) {
        return false;
      }
    }

    return true;
  }

  // 记录使用
  recordUsage(ip?: string): void {
    this.usageCount += 1;
    this.lastUsedAt = new Date();
    if (ip) {
      this.lastUsedIp = ip;
    }
  }

  // 撤销密钥
  revoke(): void {
    this.status = ApiKeyStatus.REVOKED;
  }

  // 获取掩码后的密钥（用于显示）
  get maskedKey(): string {
    return this.keyPrefix + '...' + '*'.repeat(32);
  }

  // 获取剩余使用次数
  get remainingUsage(): number | null {
    return this.maxUsage ? Math.max(0, this.maxUsage - this.usageCount) : null;
  }

  // 获取有效期剩余天数
  get daysUntilExpiry(): number | null {
    if (!this.expiresAt) {
      return null;
    }
    const now = new Date();
    const diffTime = this.expiresAt.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}