import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsObject, IsUrl, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum InputSourceType {
  URL = 'url',
  FILE = 'file',
  CONTENT = 'content',
}

export class InputSourceDto {
  @ApiProperty({
    description: '输入源类型',
    enum: InputSourceType,
    example: InputSourceType.URL,
  })
  @IsEnum(InputSourceType)
  type: InputSourceType;

  @ApiProperty({
    description: '输入内容（URL、文件路径或JSON字符串）',
    example: 'https://petstore.swagger.io/v2/swagger.json',
  })
  @IsString()
  content: string;
}

export class ConfigurationOptionsDto {
  @ApiPropertyOptional({
    description: '基础URL，用于API请求',
    example: 'https://api.example.com',
  })
  @IsOptional()
  @IsUrl()
  baseUrl?: string;

  @ApiPropertyOptional({
    description: '是否包含已废弃的API',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeDeprecated?: boolean;

  @ApiPropertyOptional({
    description: '请求超时时间（毫秒）',
    default: 30000,
  })
  @IsOptional()
  requestTimeout?: number;

  @ApiPropertyOptional({
    description: 'API路径前缀',
    example: '/api/v1',
  })
  @IsOptional()
  @IsString()
  pathPrefix?: string;

  @ApiPropertyOptional({
    description: '标签过滤器（只处理指定标签的API）',
    type: [String],
    example: ['pets', 'users'],
  })
  @IsOptional()
  tagFilter?: string[];

  @ApiPropertyOptional({
    description: '操作ID前缀',
    example: 'petstore_',
  })
  @IsOptional()
  @IsString()
  operationIdPrefix?: string;

  @ApiPropertyOptional({
    description: '是否启用认证',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  enableAuth?: boolean;

  @ApiPropertyOptional({
    description: '认证头信息',
    type: 'object',
    example: { 'Authorization': 'Bearer token' },
  })
  @IsOptional()
  @IsObject()
  authHeaders?: Record<string, string>;
}

export class ConfigureOpenAPIDto {
  @ApiProperty({
    description: '输入源配置',
    type: InputSourceDto,
  })
  @ValidateNested()
  @Type(() => InputSourceDto)
  source: InputSourceDto;

  @ApiPropertyOptional({
    description: '配置选项',
    type: ConfigurationOptionsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConfigurationOptionsDto)
  options?: ConfigurationOptionsDto;
}
