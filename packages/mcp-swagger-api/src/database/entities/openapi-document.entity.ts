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
import { ApiProperty } from '@nestjs/swagger';
import { User } from './user.entity';

export enum DocumentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  VALID = 'valid',
  INVALID = 'invalid',
  PENDING = 'pending',
}

@Entity('openapi_documents')
@Index(['userId'])
@Index(['status'])
@Index(['createdAt'])
export class OpenAPIDocument {
  @ApiProperty({ description: '文档ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '文档名称' })
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ApiProperty({ description: '文档描述' })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiProperty({ description: 'OpenAPI规范内容（JSON字符串）' })
  @Column({ type: 'text' })
  content: string;

  @ApiProperty({ description: '文档状态' })
  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.DRAFT,
  })
  status: DocumentStatus;

  @ApiProperty({ description: '文档版本' })
  @Column({ type: 'varchar', length: 50, default: '1.0.0' })
  version: string;

  @ApiProperty({ description: '文档标签' })
  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @ApiProperty({ description: '文档元数据' })
  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    originalUrl?: string;
    importSource?: 'file' | 'url' | 'manual';
    fileSize?: number;
    lastValidated?: Date;
    validationErrors?: string[];
    [key: string]: any;
  };

  @ApiProperty({ description: '所属用户ID' })
  @Column({ name: 'user_id' })
  userId: string;

  @ApiProperty({ description: '所属用户', type: () => User })
  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn()
  updatedAt: Date;

  // 获取解析后的OpenAPI规范对象
  getParsedContent(): any {
    try {
      return JSON.parse(this.content);
    } catch (error) {
      return null;
    }
  }

  // 设置OpenAPI规范内容
  setParsedContent(spec: any): void {
    this.content = JSON.stringify(spec, null, 2);
  }

  // 验证内容是否为有效的JSON
  isValidContent(): boolean {
    try {
      JSON.parse(this.content);
      return true;
    } catch {
      return false;
    }
  }

  // 获取文档信息摘要
  getInfo(): { title?: string; version?: string; description?: string } {
    const parsed = this.getParsedContent();
    if (!parsed || !parsed.info) {
      return {};
    }
    return {
      title: parsed.info.title,
      version: parsed.info.version,
      description: parsed.info.description,
    };
  }

  // 获取API端点数量
  getEndpointCount(): number {
    const parsed = this.getParsedContent();
    if (!parsed || !parsed.paths) {
      return 0;
    }
    return Object.keys(parsed.paths).length;
  }
}