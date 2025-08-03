import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsArray, IsObject, MaxLength, MinLength } from 'class-validator';
import { DocumentStatus } from '../../../database/entities/openapi-document.entity';

export class UpdateDocumentDto {
  @ApiPropertyOptional({
    description: '文档名称',
    example: 'Updated Petstore API',
    minLength: 1,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: '文档描述',
    example: 'Updated description for the Petstore API',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'OpenAPI规范内容（JSON字符串）',
    example: '{"openapi": "3.0.0", "info": {"title": "Updated API", "version": "1.1.0"}}',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: '文档状态',
    enum: DocumentStatus,
  })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @ApiPropertyOptional({
    description: '文档版本',
    example: '1.1.0',
  })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({
    description: '文档标签',
    type: [String],
    example: ['api', 'rest', 'openapi', 'updated'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: '文档元数据',
    type: 'object',
    example: {
      lastValidated: new Date(),
      validationErrors: [],
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: {
    originalUrl?: string;
    importSource?: 'file' | 'url' | 'manual';
    fileSize?: number;
    lastValidated?: Date;
    validationErrors?: string[];
    [key: string]: any;
  };
}