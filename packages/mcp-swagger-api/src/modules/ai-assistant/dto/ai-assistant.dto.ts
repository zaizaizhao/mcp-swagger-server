import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
  IsArray,
  IsUUID,
  IsNumber,
  Min,
  Max,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AssistantType,
  TemplateCategory,
  TemplateStatus,
} from '../entities/ai-assistant-template.entity';
import {
  ConfigStatus,
  ExportFormat,
} from '../entities/ai-assistant-config.entity';

// 创建模板DTO
export class CreateTemplateDto {
  @ApiProperty({ description: '模板名称', maxLength: 100 })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional({ description: '模板描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'AI助手类型', enum: AssistantType })
  @IsEnum(AssistantType)
  type: AssistantType;

  @ApiProperty({ description: '模板分类', enum: TemplateCategory })
  @IsEnum(TemplateCategory)
  category: TemplateCategory;

  @ApiProperty({ description: '配置模板内容' })
  @IsObject()
  configTemplate: Record<string, any>;

  @ApiPropertyOptional({ description: '默认配置值' })
  @IsOptional()
  @IsObject()
  defaultValues?: Record<string, any>;

  @ApiPropertyOptional({ description: '配置字段验证规则' })
  @IsOptional()
  @IsObject()
  validationRules?: Record<string, any>;

  @ApiPropertyOptional({ description: '模板标签' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: '是否公开模板', default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: '模板版本', default: '1.0.0' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ description: '作者信息' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  author?: string;
}

// 更新模板DTO
export class UpdateTemplateDto {
  @ApiPropertyOptional({ description: '模板名称', maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({ description: '模板描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '模板分类', enum: TemplateCategory })
  @IsOptional()
  @IsEnum(TemplateCategory)
  category?: TemplateCategory;

  @ApiPropertyOptional({ description: '模板状态', enum: TemplateStatus })
  @IsOptional()
  @IsEnum(TemplateStatus)
  status?: TemplateStatus;

  @ApiPropertyOptional({ description: '配置模板内容' })
  @IsOptional()
  @IsObject()
  configTemplate?: Record<string, any>;

  @ApiPropertyOptional({ description: '默认配置值' })
  @IsOptional()
  @IsObject()
  defaultValues?: Record<string, any>;

  @ApiPropertyOptional({ description: '配置字段验证规则' })
  @IsOptional()
  @IsObject()
  validationRules?: Record<string, any>;

  @ApiPropertyOptional({ description: '模板标签' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: '是否公开模板' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: '模板版本' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ description: '作者信息' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  author?: string;
}

// 模板查询DTO
export class TemplateQueryDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: '搜索关键词' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'AI助手类型', enum: AssistantType })
  @IsOptional()
  @IsEnum(AssistantType)
  type?: AssistantType;

  @ApiPropertyOptional({ description: '模板分类', enum: TemplateCategory })
  @IsOptional()
  @IsEnum(TemplateCategory)
  category?: TemplateCategory;

  @ApiPropertyOptional({ description: '模板状态', enum: TemplateStatus })
  @IsOptional()
  @IsEnum(TemplateStatus)
  status?: TemplateStatus;

  @ApiPropertyOptional({ description: '是否只显示公开模板' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  publicOnly?: boolean;

  @ApiPropertyOptional({ description: '标签过滤' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: '排序字段', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: '排序方向', default: 'DESC' })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

// 生成配置DTO
export class GenerateConfigDto {
  @ApiProperty({ description: '模板ID' })
  @IsUUID()
  templateId: string;

  @ApiProperty({ description: '配置名称', maxLength: 100 })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional({ description: '配置描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '自定义参数' })
  @IsOptional()
  @IsObject()
  customParameters?: Record<string, any>;

  @ApiPropertyOptional({ description: '配置标签' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: '创建者信息' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  createdBy?: string;

  @ApiPropertyOptional({ description: '备注信息' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// 导出配置DTO
export class ExportConfigDto {
  @ApiProperty({ description: '导出格式', enum: ExportFormat })
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @ApiPropertyOptional({ description: '是否包含敏感信息', default: false })
  @IsOptional()
  @IsBoolean()
  includeSensitive?: boolean = false;

  @ApiPropertyOptional({ description: '自定义导出选项' })
  @IsOptional()
  @IsObject()
  exportOptions?: Record<string, any>;
}

// 配置查询DTO
export class ConfigQueryDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: '搜索关键词' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '模板ID' })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({ description: '配置状态', enum: ConfigStatus })
  @IsOptional()
  @IsEnum(ConfigStatus)
  status?: ConfigStatus;

  @ApiPropertyOptional({ description: '是否只显示收藏' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  favoritesOnly?: boolean;

  @ApiPropertyOptional({ description: '标签过滤' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: '排序字段', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: '排序方向', default: 'DESC' })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

// 批量操作DTO
export class BatchOperationDto {
  @ApiProperty({ description: '操作的ID列表' })
  @IsArray()
  @IsUUID(undefined, { each: true })
  ids: string[];

  @ApiProperty({ description: '操作类型' })
  @IsEnum(['delete', 'archive', 'activate', 'export'])
  operation: 'delete' | 'archive' | 'activate' | 'export';

  @ApiPropertyOptional({ description: '操作参数' })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;
}

// 响应DTO
export class TemplateResponseDto {
  @ApiProperty({ description: '模板ID' })
  id: string;

  @ApiProperty({ description: '模板名称' })
  name: string;

  @ApiProperty({ description: '模板描述' })
  description: string;

  @ApiProperty({ description: 'AI助手类型', enum: AssistantType })
  type: AssistantType;

  @ApiProperty({ description: '模板分类', enum: TemplateCategory })
  category: TemplateCategory;

  @ApiProperty({ description: '模板状态', enum: TemplateStatus })
  status: TemplateStatus;

  @ApiProperty({ description: '配置模板内容' })
  configTemplate: Record<string, any>;

  @ApiProperty({ description: '默认配置值' })
  defaultValues: Record<string, any>;

  @ApiProperty({ description: '配置字段验证规则' })
  validationRules: Record<string, any>;

  @ApiProperty({ description: '模板标签' })
  tags: string[];

  @ApiProperty({ description: '是否公开模板' })
  isPublic: boolean;

  @ApiProperty({ description: '模板版本' })
  version: string;

  @ApiProperty({ description: '作者信息' })
  author: string;

  @ApiProperty({ description: '使用次数' })
  usageCount: number;

  @ApiProperty({ description: '评分' })
  rating: number;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class ConfigResponseDto {
  @ApiProperty({ description: '配置ID' })
  id: string;

  @ApiProperty({ description: '配置名称' })
  name: string;

  @ApiProperty({ description: '配置描述' })
  description: string;

  @ApiProperty({ description: '模板信息', type: TemplateResponseDto })
  template: TemplateResponseDto;

  @ApiProperty({ description: '生成的配置内容' })
  generatedConfig: Record<string, any>;

  @ApiProperty({ description: '用户自定义参数' })
  customParameters: Record<string, any>;

  @ApiProperty({ description: '配置状态', enum: ConfigStatus })
  status: ConfigStatus;

  @ApiProperty({ description: '导出格式', enum: ExportFormat })
  exportFormat: ExportFormat;

  @ApiProperty({ description: '配置标签' })
  tags: string[];

  @ApiProperty({ description: '是否收藏' })
  isFavorite: boolean;

  @ApiProperty({ description: '使用次数' })
  usageCount: number;

  @ApiProperty({ description: '最后使用时间' })
  lastUsedAt: Date;

  @ApiProperty({ description: '创建者信息' })
  createdBy: string;

  @ApiProperty({ description: '备注信息' })
  notes: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class PaginatedTemplateResponseDto {
  @ApiProperty({ description: '模板列表', type: [TemplateResponseDto] })
  data: TemplateResponseDto[];

  @ApiProperty({ description: '总数量' })
  total: number;

  @ApiProperty({ description: '当前页码' })
  page: number;

  @ApiProperty({ description: '每页数量' })
  limit: number;

  @ApiProperty({ description: '总页数' })
  totalPages: number;
}

export class PaginatedConfigResponseDto {
  @ApiProperty({ description: '配置列表', type: [ConfigResponseDto] })
  data: ConfigResponseDto[];

  @ApiProperty({ description: '总数量' })
  total: number;

  @ApiProperty({ description: '当前页码' })
  page: number;

  @ApiProperty({ description: '每页数量' })
  limit: number;

  @ApiProperty({ description: '总页数' })
  totalPages: number;
}

export class ExportResponseDto {
  @ApiProperty({ description: '导出格式', enum: ExportFormat })
  format: ExportFormat;

  @ApiProperty({ description: '导出内容' })
  content: string;

  @ApiProperty({ description: '文件名建议' })
  filename: string;

  @ApiProperty({ description: '内容类型' })
  contentType: string;
}

export class BatchOperationResponseDto {
  @ApiProperty({ description: '成功处理的数量' })
  successCount: number;

  @ApiProperty({ description: '失败处理的数量' })
  failureCount: number;

  @ApiProperty({ description: '处理结果详情' })
  results: Array<{
    id: string;
    success: boolean;
    message?: string;
  }>;
}