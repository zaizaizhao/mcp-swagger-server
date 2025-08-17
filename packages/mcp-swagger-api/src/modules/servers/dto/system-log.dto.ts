import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsDateString, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { SystemLogEventType, SystemLogLevel } from '../../../database/entities/system-log.entity';

export class SystemLogQueryDto {
  @ApiPropertyOptional({ description: '服务器ID' })
  @IsOptional()
  @IsUUID()
  serverId?: string;

  @ApiPropertyOptional({ 
    description: '操作类型', 
    enum: SystemLogEventType,
    enumName: 'SystemLogEventType'
  })
  @IsOptional()
  @IsEnum(SystemLogEventType)
  eventType?: SystemLogEventType;

  @ApiPropertyOptional({ 
    description: '日志级别', 
    enum: SystemLogLevel,
    enumName: 'SystemLogLevel'
  })
  @IsOptional()
  @IsEnum(SystemLogLevel)
  level?: SystemLogLevel;

  @ApiPropertyOptional({ description: '开始时间 (ISO 8601格式)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束时间 (ISO 8601格式)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '页码', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: '排序字段', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: '排序方向', enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class SystemLogResponseDto {
  @ApiProperty({ description: '日志ID' })
  id: string;

  @ApiProperty({ description: '服务器ID' })
  serverId: string;

  @ApiProperty({ 
    description: '操作类型', 
    enum: SystemLogEventType,
    enumName: 'SystemLogEventType'
  })
  eventType: SystemLogEventType;

  @ApiProperty({ description: '描述信息' })
  description: string;

  @ApiProperty({ 
    description: '日志级别', 
    enum: SystemLogLevel,
    enumName: 'SystemLogLevel'
  })
  level: SystemLogLevel;

  @ApiPropertyOptional({ description: '详细信息', type: 'object' })
  details?: Record<string, any>;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class PaginatedSystemLogResponseDto {
  @ApiProperty({ type: [SystemLogResponseDto], description: '系统日志列表' })
  data: SystemLogResponseDto[];

  @ApiProperty({ description: '总数量' })
  total: number;

  @ApiProperty({ description: '当前页码' })
  page: number;

  @ApiProperty({ description: '每页数量' })
  limit: number;

  @ApiProperty({ description: '总页数' })
  totalPages: number;

  @ApiProperty({ description: '是否有下一页' })
  hasNext: boolean;

  @ApiProperty({ description: '是否有上一页' })
  hasPrev: boolean;
}