import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStatus } from '../../../database/entities/openapi-document.entity';

export class DocumentInfoDto {
  @ApiPropertyOptional({ description: 'API标题' })
  title?: string;

  @ApiPropertyOptional({ description: 'API版本' })
  version?: string;

  @ApiPropertyOptional({ description: 'API描述' })
  description?: string;
}

export class DocumentResponseDto {
  @ApiProperty({ description: '文档ID' })
  id: string;

  @ApiProperty({ description: '文档名称' })
  name: string;

  @ApiPropertyOptional({ description: '文档描述' })
  description?: string;

  @ApiProperty({ description: '文档状态', enum: DocumentStatus })
  status: DocumentStatus;

  @ApiProperty({ description: '文档版本' })
  version: string;

  @ApiPropertyOptional({ description: '文档标签', type: [String] })
  tags?: string[];

  @ApiPropertyOptional({ description: '文档元数据', type: 'object' })
  metadata?: {
    originalUrl?: string;
    importSource?: 'file' | 'url' | 'manual';
    fileSize?: number;
    lastValidated?: Date;
    validationErrors?: string[];
    [key: string]: any;
  };

  @ApiProperty({ description: '所属用户ID' })
  userId: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'OpenAPI文档信息', type: DocumentInfoDto })
  info?: DocumentInfoDto;

  @ApiPropertyOptional({ description: 'API端点数量' })
  endpointCount?: number;
}

export class DocumentDetailResponseDto extends DocumentResponseDto {
  @ApiProperty({ description: 'OpenAPI规范内容（JSON字符串）' })
  content: string;
}

export class DocumentListResponseDto {
  @ApiProperty({ description: '文档列表', type: [DocumentResponseDto] })
  documents: DocumentResponseDto[];

  @ApiProperty({ description: '总数量' })
  total: number;

  @ApiProperty({ description: '当前页码' })
  page: number;

  @ApiProperty({ description: '每页数量' })
  limit: number;

  @ApiProperty({ description: '总页数' })
  totalPages: number;
}