import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export enum EndpointSourceType {
  IMPORTED = 'imported',
  MANUAL = 'manual',
}

export enum EndpointLifecycleStatus {
  DRAFT = 'draft',
  VERIFIED = 'verified',
  PUBLISHED = 'published',
  DEGRADED = 'degraded',
  OFFLINE = 'offline',
  RETIRED = 'retired',
}

export class UpdateApiManagementProfileDto {
  @ApiPropertyOptional({ enum: EndpointSourceType, description: 'Endpoint 接入来源' })
  @IsOptional()
  @IsEnum(EndpointSourceType)
  sourceType?: EndpointSourceType;

  @ApiPropertyOptional({ description: '来源标识，例如 URL、系统名或人工录入来源' })
  @IsOptional()
  @IsString()
  sourceRef?: string;

  @ApiPropertyOptional({ description: '业务分类，例如 pet/order/user' })
  @IsOptional()
  @IsString()
  businessDomain?: string;

  @ApiPropertyOptional({ description: '风险等级，例如 low/medium/high' })
  @IsOptional()
  @IsString()
  riskLevel?: string;

  @ApiPropertyOptional({ enum: EndpointLifecycleStatus, description: '生命周期状态' })
  @IsOptional()
  @IsEnum(EndpointLifecycleStatus)
  lifecycleStatus?: EndpointLifecycleStatus;

  @ApiPropertyOptional({ description: '是否允许进入发布候选' })
  @IsOptional()
  @IsBoolean()
  publishEnabled?: boolean;

  @ApiPropertyOptional({ description: '主动探测地址（可覆盖默认推断 URL）' })
  @IsOptional()
  @IsString()
  probeUrl?: string;
}

export class ApiCenterQueryDto {
  @ApiPropertyOptional({ enum: EndpointLifecycleStatus, description: '按生命周期过滤' })
  @IsOptional()
  @IsEnum(EndpointLifecycleStatus)
  lifecycleStatus?: EndpointLifecycleStatus;

  @ApiPropertyOptional({ enum: EndpointSourceType, description: '按来源过滤' })
  @IsOptional()
  @IsEnum(EndpointSourceType)
  sourceType?: EndpointSourceType;

  @ApiPropertyOptional({ description: '按业务域过滤' })
  @IsOptional()
  @IsString()
  businessDomain?: string;
}

export class PublishReadinessDto {
  @ApiProperty()
  serverId: string;

  @ApiProperty()
  ready: boolean;

  @ApiProperty({ type: [String] })
  reasons: string[];
}

export class RegisterManualEndpointDto {
  @ApiProperty({ description: '唯一服务名', example: 'manual-pet-query' })
  @IsString()
  name: string;

  @ApiProperty({ description: '上游 API baseUrl', example: 'https://api.example.com' })
  @IsString()
  baseUrl: string;

  @ApiProperty({ description: 'HTTP method', example: 'GET' })
  @IsString()
  method: string;

  @ApiProperty({ description: '路径', example: '/pets/{id}' })
  @IsString()
  path: string;

  @ApiPropertyOptional({ description: '接口描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '业务域' })
  @IsOptional()
  @IsString()
  businessDomain?: string;

  @ApiPropertyOptional({ description: '风险等级', example: 'medium' })
  @IsOptional()
  @IsString()
  riskLevel?: string;
}

export class ChangeEndpointStateDto {
  @ApiProperty({ enum: ['publish', 'offline'], description: '状态动作' })
  @IsEnum(['publish', 'offline'])
  action: 'publish' | 'offline';

  @ApiPropertyOptional({ description: '状态变更原因（下线时可选）' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ProbeEndpointDto {
  @ApiPropertyOptional({ description: '指定探测的 endpoint path，例如 /pet' })
  @IsOptional()
  @IsString()
  path?: string;
}
