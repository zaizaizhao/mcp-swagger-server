import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiInfoDto {
  @ApiProperty({
    description: 'API标题',
    example: 'Petstore API',
  })
  title: string;

  @ApiProperty({
    description: 'API版本',
    example: '1.0.0',
  })
  version: string;

  @ApiPropertyOptional({
    description: 'API描述',
    example: 'This is a sample server Petstore server.',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'API服务条款URL',
    example: 'https://example.com/terms',
  })
  termsOfService?: string;

  @ApiPropertyOptional({
    description: '联系信息',
    type: 'object',
    example: { name: 'API Support', email: 'support@example.com' },
  })
  contact?: Record<string, any>;

  @ApiPropertyOptional({
    description: '许可证信息',
    type: 'object',
    example: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
  })
  license?: Record<string, any>;
}

export class ApiEndpointDto {
  @ApiProperty({
    description: 'HTTP方法',
    example: 'GET',
  })
  method: string;

  @ApiProperty({
    description: 'API路径',
    example: '/pets/{petId}',
  })
  path: string;

  @ApiProperty({
    description: '操作ID',
    example: 'getPetById',
  })
  operationId: string;

  @ApiPropertyOptional({
    description: '操作摘要',
    example: 'Find pet by ID',
  })
  summary?: string;

  @ApiPropertyOptional({
    description: '操作描述',
    example: 'Returns a single pet',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'API标签',
    type: [String],
    example: ['pets'],
  })
  tags?: string[];

  @ApiPropertyOptional({
    description: '是否已废弃',
    default: false,
  })
  deprecated?: boolean;

  @ApiPropertyOptional({
    description: '参数列表',
    type: 'array',
    items: { type: 'object' },
  })
  parameters?: any[];

  @ApiPropertyOptional({
    description: '请求体定义',
    type: 'object',
  })
  requestBody?: any;

  @ApiPropertyOptional({
    description: '响应定义',
    type: 'object',
  })
  responses?: Record<string, any>;
}

export class MCPToolInfoDto {
  @ApiProperty({
    description: '工具名称',
    example: 'getPetById',
  })
  name: string;

  @ApiProperty({
    description: '工具描述',
    example: 'Get a pet by its ID',
  })
  description: string;

  @ApiPropertyOptional({
    description: '输入Schema',
    type: 'object',
  })
  inputSchema?: any;

  @ApiPropertyOptional({
    description: '工具元数据',
    type: 'object',
  })
  metadata?: any;
}

export class ConfigureResultDto {
  @ApiProperty({
    description: 'API信息',
    type: ApiInfoDto,
  })
  apiInfo: ApiInfoDto;

  @ApiProperty({
    description: '端点列表',
    type: [ApiEndpointDto],
  })
  endpoints: ApiEndpointDto[];

  @ApiProperty({
    description: '生成的MCP工具列表',
    type: [MCPToolInfoDto],
  })
  tools: MCPToolInfoDto[];

  @ApiProperty({
    description: '工具数量',
    example: 5,
  })
  toolsCount: number;

  @ApiProperty({
    description: 'MCP服务器URL',
    example: 'http://localhost:3322',
  })
  mcpServerUrl: string;

  @ApiProperty({
    description: '配置时间',
    example: '2023-12-01T10:00:00Z',
  })
  configuredAt: string;

  @ApiPropertyOptional({
    description: '配置ID（用于追踪）',
    example: 'config_123456789',
  })
  configId?: string;
}

export class ConfigStatusDto {
  @ApiProperty({
    description: '是否已配置',
    example: true,
  })
  isConfigured: boolean;

  @ApiPropertyOptional({
    description: '当前配置的API信息',
    type: ApiInfoDto,
  })
  currentApi?: ApiInfoDto;

  @ApiPropertyOptional({
    description: '工具数量',
    example: 5,
  })
  toolsCount?: number;

  @ApiPropertyOptional({
    description: 'MCP服务器状态',
    example: 'running',
  })
  mcpServerStatus?: string;

  @ApiPropertyOptional({
    description: '最后配置时间',
    example: '2023-12-01T10:00:00Z',
  })
  lastConfiguredAt?: string;

  @ApiPropertyOptional({
    description: '配置ID',
    example: 'config_123456789',
  })
  configId?: string;
}

export class ToolListDto {
  @ApiProperty({
    description: 'MCP工具列表',
    type: [MCPToolInfoDto],
  })
  tools: MCPToolInfoDto[];

  @ApiProperty({
    description: '工具总数',
    example: 5,
  })
  total: number;

  @ApiPropertyOptional({
    description: '当前API信息',
    type: ApiInfoDto,
  })
  apiInfo?: ApiInfoDto;
}

// Main response DTO for OpenAPI parsing
export class OpenAPIResponseDto {
  @ApiProperty({
    description: 'API信息',
    type: ApiInfoDto,
  })
  info: ApiInfoDto;

  @ApiProperty({
    description: 'OpenAPI paths对象（符合OpenAPI规范）',
    type: 'object',
  })
  paths: Record<string, any>;

  @ApiProperty({
    description: '解析的API端点列表（用于前端显示）',
    type: [ApiEndpointDto],
  })
  endpoints: ApiEndpointDto[];

  @ApiProperty({
    description: '生成的MCP工具列表',
    type: [MCPToolInfoDto],
  })
  tools: MCPToolInfoDto[];

  @ApiProperty({
    description: '服务器信息',
    type: 'array',
    items: { type: 'object' },
  })
  servers: any[];

  @ApiProperty({
    description: 'OpenAPI版本',
    example: '3.0.0',
  })
  openapi: string;

  @ApiProperty({
    description: '组件定义',
    type: 'object',
  })
  components: any;

  @ApiProperty({
    description: '解析时间戳',
    example: '2023-12-01T10:00:00Z',
  })
  parsedAt: string;

  @ApiPropertyOptional({
    description: '解析ID',
    example: 'parse_123456789',
  })
  parseId?: string;
}
