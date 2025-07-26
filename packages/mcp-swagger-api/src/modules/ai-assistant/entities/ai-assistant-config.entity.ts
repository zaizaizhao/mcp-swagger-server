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
import { AiAssistantTemplateEntity } from './ai-assistant-template.entity';

export enum ConfigStatus {
  GENERATED = 'generated',
  EXPORTED = 'exported',
  APPLIED = 'applied',
  ARCHIVED = 'archived',
}

export enum ExportFormat {
  JSON = 'json',
  YAML = 'yaml',
  ENV = 'env',
  SHELL_SCRIPT = 'shell_script',
}

@Entity('ai_assistant_configs')
@Index(['templateId', 'status'])
@Index(['createdAt'])
export class AiAssistantConfigEntity {
  @ApiProperty({ description: '配置ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '配置名称' })
  @Column({ length: 100 })
  name: string;

  @ApiProperty({ description: '配置描述' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: '模板ID' })
  @Column('uuid')
  templateId: string;

  @ApiProperty({ description: '关联的模板', type: () => AiAssistantTemplateEntity })
  @ManyToOne(() => AiAssistantTemplateEntity, { eager: true })
  @JoinColumn({ name: 'templateId' })
  template: AiAssistantTemplateEntity;

  @ApiProperty({ description: '生成的配置内容' })
  @Column({ type: 'jsonb' })
  generatedConfig: Record<string, any>;

  @ApiProperty({ description: '用户自定义参数' })
  @Column({ type: 'jsonb', nullable: true })
  customParameters: Record<string, any>;

  @ApiProperty({ description: '配置状态', enum: ConfigStatus })
  @Column({
    type: 'enum',
    enum: ConfigStatus,
    default: ConfigStatus.GENERATED,
  })
  status: ConfigStatus;

  @ApiProperty({ description: '导出格式', enum: ExportFormat })
  @Column({
    type: 'enum',
    enum: ExportFormat,
    nullable: true,
  })
  exportFormat: ExportFormat;

  @ApiProperty({ description: '导出的配置文件内容' })
  @Column({ type: 'text', nullable: true })
  exportedContent: string;

  @ApiProperty({ description: '配置标签' })
  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @ApiProperty({ description: '是否收藏' })
  @Column({ default: false })
  isFavorite: boolean;

  @ApiProperty({ description: '使用次数' })
  @Column({ default: 0 })
  usageCount: number;

  @ApiProperty({ description: '最后使用时间' })
  @Column({ nullable: true })
  lastUsedAt: Date;

  @ApiProperty({ description: '创建者信息' })
  @Column({ length: 100, nullable: true })
  createdBy: string;

  @ApiProperty({ description: '备注信息' })
  @Column({ type: 'text', nullable: true })
  notes: string;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn()
  updatedAt: Date;
}