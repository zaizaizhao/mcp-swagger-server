import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum AssistantType {
  CLAUDE_DESKTOP = 'claude_desktop',
  OPENAI_ASSISTANT = 'openai_assistant',
  ANTHROPIC_API = 'anthropic_api',
  CUSTOM = 'custom',
}

export enum TemplateCategory {
  GENERAL = 'general',
  DEVELOPMENT = 'development',
  BUSINESS = 'business',
  RESEARCH = 'research',
  EDUCATION = 'education',
}

export enum TemplateStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DRAFT = 'draft',
}

@Entity('ai_assistant_templates')
@Index(['type', 'category'])
@Index(['status', 'isPublic'])
export class AiAssistantTemplateEntity {
  @ApiProperty({ description: '模板ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '模板名称' })
  @Column({ length: 100 })
  name: string;

  @ApiProperty({ description: '模板描述' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'AI助手类型', enum: AssistantType })
  @Column({
    type: 'enum',
    enum: AssistantType,
    default: AssistantType.CLAUDE_DESKTOP,
  })
  type: AssistantType;

  @ApiProperty({ description: '模板分类', enum: TemplateCategory })
  @Column({
    type: 'enum',
    enum: TemplateCategory,
    default: TemplateCategory.GENERAL,
  })
  category: TemplateCategory;

  @ApiProperty({ description: '模板状态', enum: TemplateStatus })
  @Column({
    type: 'enum',
    enum: TemplateStatus,
    default: TemplateStatus.ACTIVE,
  })
  status: TemplateStatus;

  @ApiProperty({ description: '配置模板内容' })
  @Column({ type: 'jsonb' })
  configTemplate: Record<string, any>;

  @ApiProperty({ description: '默认配置值' })
  @Column({ type: 'jsonb', nullable: true })
  defaultValues: Record<string, any>;

  @ApiProperty({ description: '配置字段验证规则' })
  @Column({ type: 'jsonb', nullable: true })
  validationRules: Record<string, any>;

  @ApiProperty({ description: '模板标签' })
  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @ApiProperty({ description: '是否公开模板' })
  @Column({ default: true })
  isPublic: boolean;

  @ApiProperty({ description: '模板版本' })
  @Column({ default: '1.0.0' })
  version: string;

  @ApiProperty({ description: '作者信息' })
  @Column({ length: 100, nullable: true })
  author: string;

  @ApiProperty({ description: '使用次数' })
  @Column({ default: 0 })
  usageCount: number;

  @ApiProperty({ description: '评分' })
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn()
  updatedAt: Date;
}