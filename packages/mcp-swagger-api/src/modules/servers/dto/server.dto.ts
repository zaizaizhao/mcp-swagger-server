import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum, IsArray, IsObject, ValidateNested, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ServerStatus, TransportType } from '../../../database/entities/mcp-server.entity';
import { AuthType } from '../../../database/entities/auth-config.entity';

/**
 * 创建服务器DTO
 */
export class CreateServerDto {
  @ApiProperty({ description: '服务器名称', example: 'my-api-server' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '服务器版本', example: '1.0.0' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ description: '服务器描述', example: 'My API server description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '服务器端口', example: 3322, minimum: 1024, maximum: 65535 })
  @IsOptional()
  @IsNumber()
  @Min(1024)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ 
    description: '传输类型', 
    enum: TransportType, 
    example: TransportType.STREAMABLE 
  })
  @IsOptional()
  @IsEnum(TransportType)
  transport?: TransportType;

  @ApiProperty({ description: 'OpenAPI规范数据', type: 'object' })
  @IsObject()
  openApiData: any;

  @ApiPropertyOptional({ description: '服务器配置', type: 'object' })
  @IsOptional()
  @IsObject()
  config?: any;

  @ApiPropertyOptional({ description: '认证配置ID' })
  @IsOptional()
  @IsString()
  authConfig?: string;

  @ApiPropertyOptional({ description: '是否自动启动', example: false })
  @IsOptional()
  @IsBoolean()
  autoStart?: boolean;

  @ApiPropertyOptional({ description: '服务器标签', type: [String], example: ['api', 'production'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

/**
 * 更新服务器DTO
 */
export class UpdateServerDto {
  @ApiPropertyOptional({ description: '服务器名称', example: 'my-api-server' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '服务器版本', example: '1.0.0' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ description: '服务器描述', example: 'My API server description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '服务器端口', example: 3322, minimum: 1024, maximum: 65535 })
  @IsOptional()
  @IsNumber()
  @Min(1024)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ 
    description: '传输类型', 
    enum: TransportType, 
    example: TransportType.STREAMABLE 
  })
  @IsOptional()
  @IsEnum(TransportType)
  transport?: TransportType;

  @ApiPropertyOptional({ description: 'OpenAPI规范数据', type: 'object' })
  @IsOptional()
  @IsObject()
  openApiData?: any;

  @ApiPropertyOptional({ description: '服务器配置', type: 'object' })
  @IsOptional()
  @IsObject()
  config?: any;

  @ApiPropertyOptional({ description: '认证配置ID' })
  @IsOptional()
  @IsString()
  authConfig?: string;

  @ApiPropertyOptional({ description: '是否自动启动', example: false })
  @IsOptional()
  @IsBoolean()
  autoStart?: boolean;

  @ApiPropertyOptional({ description: '服务器标签', type: [String], example: ['api', 'production'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

/**
 * 服务器查询DTO
 */
export class ServerQueryDto {
  @ApiPropertyOptional({ description: '页码', example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', example: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ 
    description: '服务器状态过滤', 
    enum: ServerStatus, 
    example: ServerStatus.RUNNING 
  })
  @IsOptional()
  @IsEnum(ServerStatus)
  status?: ServerStatus;

  @ApiPropertyOptional({ 
    description: '传输类型过滤', 
    enum: TransportType, 
    example: TransportType.STREAMABLE 
  })
  @IsOptional()
  @IsEnum(TransportType)
  transport?: TransportType;

  @ApiPropertyOptional({ description: '搜索关键词（名称或描述）', example: 'api' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '标签过滤', type: [String], example: ['api', 'production'] })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map(tag => tag.trim());
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

/**
 * 服务器操作DTO
 */
export class ServerActionDto {
  @ApiProperty({ description: '操作类型', enum: ['start', 'stop', 'restart'], example: 'start' })
  @IsEnum(['start', 'stop', 'restart'])
  action: 'start' | 'stop' | 'restart';

  @ApiPropertyOptional({ description: '强制执行', example: false })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

/**
 * 批量服务器操作DTO
 */
export class BatchServerActionDto {
  @ApiProperty({ description: '服务器ID列表', type: [String], example: ['uuid1', 'uuid2'] })
  @IsArray()
  @IsString({ each: true })
  serverIds: string[];

  @ApiProperty({ description: '操作类型', enum: ['start', 'stop', 'restart'], example: 'start' })
  @IsEnum(['start', 'stop', 'restart'])
  action: 'start' | 'stop' | 'restart';

  @ApiPropertyOptional({ description: '强制执行', example: false })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

/**
 * 创建认证配置DTO
 */
export class CreateAuthConfigDto {
  @ApiProperty({ description: '认证配置名称', example: 'my-api-auth' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '认证配置描述', example: 'API authentication config' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ 
    description: '认证类型', 
    enum: AuthType, 
    example: AuthType.BEARER 
  })
  @IsEnum(AuthType)
  type: AuthType;

  @ApiProperty({ description: '认证配置详情', type: 'object' })
  @IsObject()
  config: any;

  @ApiPropertyOptional({ description: '是否启用', example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: '过期时间' })
  @IsOptional()
  expiresAt?: Date;
}

/**
 * 更新认证配置DTO
 */
export class UpdateAuthConfigDto {
  @ApiPropertyOptional({ description: '认证配置名称', example: 'my-api-auth' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '认证配置描述', example: 'API authentication config' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ 
    description: '认证类型', 
    enum: AuthType, 
    example: AuthType.BEARER 
  })
  @IsOptional()
  @IsEnum(AuthType)
  type?: AuthType;

  @ApiPropertyOptional({ description: '认证配置详情', type: 'object' })
  @IsOptional()
  @IsObject()
  config?: any;

  @ApiPropertyOptional({ description: '是否启用', example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: '过期时间' })
  @IsOptional()
  expiresAt?: Date;
}

/**
 * 指标查询DTO
 */
export class MetricsQueryDto {
  @ApiPropertyOptional({ description: '服务器ID' })
  @IsOptional()
  @IsString()
  serverId?: string;

  @ApiPropertyOptional({ description: '开始时间' })
  @IsOptional()
  @Type(() => Date)
  startTime?: Date;

  @ApiPropertyOptional({ description: '结束时间' })
  @IsOptional()
  @Type(() => Date)
  endTime?: Date;

  @ApiPropertyOptional({ 
    description: '时间间隔', 
    enum: ['minute', 'hour', 'day'], 
    example: 'hour' 
  })
  @IsOptional()
  @IsEnum(['minute', 'hour', 'day'])
  interval?: 'minute' | 'hour' | 'day';

  @ApiPropertyOptional({ description: '限制数量', example: 100, minimum: 1, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;
}

/**
 * 健康检查查询DTO
 */
export class HealthCheckQueryDto {
  @ApiPropertyOptional({ description: '服务器ID' })
  @IsOptional()
  @IsString()
  serverId?: string;

  @ApiPropertyOptional({ description: '限制数量', example: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}

/**
 * 日志查询DTO
 */
export class LogQueryDto {
  @ApiPropertyOptional({ description: '服务器ID' })
  @IsOptional()
  @IsString()
  serverId?: string;

  @ApiPropertyOptional({ description: '日志级别', enum: ['DEBUG', 'INFO', 'WARN', 'ERROR'], example: 'INFO' })
  @IsOptional()
  @IsEnum(['DEBUG', 'INFO', 'WARN', 'ERROR'])
  level?: string;

  @ApiPropertyOptional({ description: '日志来源', enum: ['SYSTEM', 'USER', 'API', 'HEALTH_CHECK'], example: 'SYSTEM' })
  @IsOptional()
  @IsEnum(['SYSTEM', 'USER', 'API', 'HEALTH_CHECK'])
  source?: string;

  @ApiPropertyOptional({ description: '组件名称', example: 'ServerManagerService' })
  @IsOptional()
  @IsString()
  component?: string;

  @ApiPropertyOptional({ description: '操作名称', example: 'startServer' })
  @IsOptional()
  @IsString()
  operation?: string;

  @ApiPropertyOptional({ description: '搜索关键词', example: 'error' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '开始时间' })
  @IsOptional()
  @Type(() => Date)
  startTime?: Date;

  @ApiPropertyOptional({ description: '结束时间' })
  @IsOptional()
  @Type(() => Date)
  endTime?: Date;

  @ApiPropertyOptional({ description: '页码', example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', example: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}

/**
 * 服务器响应DTO
 */
export class ServerResponseDto {
  @ApiProperty({ description: '服务器ID' })
  id: string;

  @ApiProperty({ description: '服务器名称' })
  name: string;

  @ApiProperty({ description: '服务器版本' })
  version: string;

  @ApiProperty({ description: '服务器描述' })
  description?: string;

  @ApiProperty({ description: '服务器端口' })
  port: number;

  @ApiProperty({ description: '传输类型', enum: TransportType })
  transport: TransportType;

  @ApiProperty({ description: '服务器状态', enum: ServerStatus })
  status: ServerStatus;

  @ApiProperty({ description: '是否健康' })
  healthy: boolean;

  @ApiProperty({ description: '服务器端点' })
  endpoint?: string;

  @ApiProperty({ description: '工具数量' })
  toolCount: number;

  @ApiProperty({ description: '是否自动启动' })
  autoStart: boolean;

  @ApiProperty({ description: '服务器标签', type: [String] })
  tags: string[];

  @ApiProperty({ description: '错误信息' })
  errorMessage?: string;

  @ApiProperty({ description: '最后健康检查时间' })
  lastHealthCheck?: Date;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

/**
 * 分页响应DTO
 */
export class PaginatedResponseDto<T> {
  @ApiProperty({ description: '数据列表' })
  data: T[];

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

/**
 * 操作结果DTO
 */
export class OperationResultDto {
  @ApiProperty({ description: '操作是否成功' })
  success: boolean;

  @ApiProperty({ description: '操作消息' })
  message: string;

  @ApiProperty({ description: '操作数据', required: false })
  data?: any;

  @ApiProperty({ description: '错误信息', required: false })
  error?: string;
}