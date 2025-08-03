import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsArray, IsObject, MaxLength, MinLength } from 'class-validator';
import { DocumentStatus } from '../../../database/entities/openapi-document.entity';

export class CreateDocumentDto {
  @ApiProperty({
    description: '文档名称',
    example: 'Petstore API',
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: '文档描述',
    example: 'This is a sample Petstore server API documentation',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'OpenAPI规范内容（JSON字符串）',
    example: '{"openapi": "3.0.0", "info": {"title": "API", "version": "1.0.0"}}',
  })
  @IsString()
  content: string;

  @ApiPropertyOptional({
    description: '文档状态',
    enum: DocumentStatus,
    default: DocumentStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @ApiPropertyOptional({
    description: '文档版本',
    example: '1.0.0',
    default: '1.0.0',
  })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({
    description: '文档标签',
    type: [String],
    example: ['api', 'rest', 'openapi'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: '文档元数据',
    type: 'object',
    example: {
      originalUrl: 'https://petstore.swagger.io/v2/swagger.json',
      importSource: 'url',
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