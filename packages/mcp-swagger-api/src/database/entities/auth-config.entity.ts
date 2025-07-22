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

export enum AuthType {
  NONE = 'none',
  BEARER = 'bearer',
  API_KEY = 'apikey',
  BASIC = 'basic',
  OAUTH2 = 'oauth2',
}

@Entity('auth_configs')
@Index(['serverId', 'name'], { unique: true })
export class AuthConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: AuthType,
    default: AuthType.NONE,
  })
  type: AuthType;

  @Column({ type: 'jsonb' })
  config: {
    // Bearer Token
    token?: string;
    
    // API Key
    apiKey?: string;
    apiKeyHeader?: string;
    apiKeyQuery?: string;
    
    // Basic Auth
    username?: string;
    password?: string;
    
    // OAuth2
    clientId?: string;
    clientSecret?: string;
    tokenUrl?: string;
    scope?: string;
    
    // 通用配置
    headers?: Record<string, string>;
    queryParams?: Record<string, string>;
    [key: string]: any;
  };

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastUsed?: Date;

  @Column({ type: 'uuid' })
  serverId: string;

  @ManyToOne(() => MCPServerEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'serverId' })
  server: MCPServerEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 虚拟属性：是否已过期
  get isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }

  // 虚拟属性：是否有效
  get isValid(): boolean {
    return this.enabled && !this.isExpired;
  }
}