import { 
  Controller, 
  Post, 
  Get, 
  Delete,
  Body, 
  HttpStatus, 
  Logger,
  HttpException
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBody,
  ApiProperty 
} from '@nestjs/swagger';
import { 
  IsNotEmpty, 
  IsOptional, 
  IsString, 
  IsNumber, 
  IsIn, 
  ValidateNested,
  IsObject
} from 'class-validator';
import { Type } from 'class-transformer';
import { MCPService } from './services/mcp.service';

export class MCPServerConfigDto {
  @ApiProperty({ description: 'MCP服务器名称', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'MCP服务器版本', required: false })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiProperty({ description: 'MCP服务器描述', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'MCP服务器端口', required: false })
  @IsOptional()
  @IsNumber()
  port?: number;

  @ApiProperty({ 
    description: 'MCP传输方式', 
    required: false,
    enum: ['streamable', 'sse', 'stdio']
  })
  @IsOptional()
  @IsIn(['streamable', 'sse', 'stdio'])
  transport?: 'streamable' | 'sse' | 'stdio';
}

export class CreateMCPServerDto {
  @ApiProperty({ 
    description: 'OpenAPI规范数据，可以是JSON字符串或对象',
    example: { openapi: '3.0.0', info: { title: 'API', version: '1.0.0' } }
  })
  @IsNotEmpty()
  openApiData: string | object;

  @ApiProperty({ 
    description: 'MCP服务器配置', 
    required: false,
    type: MCPServerConfigDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MCPServerConfigDto)
  config?: MCPServerConfigDto;
}

export class ReloadToolsDto {
  @ApiProperty({ 
    description: 'OpenAPI规范数据，可以是JSON字符串或对象',
    example: { openapi: '3.0.0', info: { title: 'API', version: '1.0.0' } }
  })
  @IsNotEmpty()
  openApiData: string | object;
}

@ApiTags('MCP Server Management')
@Controller('api/v1/mcp')
export class MCPController {
  private readonly logger = new Logger(MCPController.name);

  constructor(
    private readonly mcpService: MCPService
  ) {}

  @Post('create')
  @ApiOperation({ 
    summary: '从 OpenAPI 规范创建 MCP 服务器',
    description: '解析 OpenAPI 规范并创建对应的 MCP 服务器，复用 mcp-swagger-server 的核心能力'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'MCP 服务器创建成功',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            endpoint: { type: 'string' },
            toolsCount: { type: 'number' },
            tools: { type: 'array' }
          }
        }
      }
    }
  })
  @ApiBody({ type: CreateMCPServerDto })
  async createMCPServer(@Body() createDto: CreateMCPServerDto) {
    this.logger.log('Creating MCP server from OpenAPI specification');
    
    try {
      const result = await this.mcpService.createFromOpenAPI(
        createDto.openApiData,
        createDto.config
      );

      if (result.success) {
        return {
          status: 'success',
          message: 'MCP server created successfully',
          data: {
            endpoint: result.endpoint,
            toolsCount: result.toolsCount,
            tools: result.tools?.map(tool => ({
              name: tool.name,
              description: tool.description
            })) || []
          }
        };
      } else {
        throw new HttpException(
          {
            status: 'error',
            message: 'Failed to create MCP server',
            error: result.error
          },
          HttpStatus.BAD_REQUEST
        );
      }
    } catch (error) {
      this.logger.error('Error creating MCP server:', error);
      throw new HttpException(
        {
          status: 'error',
          message: 'Internal server error',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('status')
  @ApiOperation({ 
    summary: '获取 MCP 服务器状态',
    description: '获取当前 MCP 服务器的运行状态、工具数量和端点信息'
  })
  @ApiResponse({ 
    status: 200, 
    description: '服务器状态信息',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: {
          type: 'object',
          properties: {
            isRunning: { type: 'boolean',description: '服务器是否正在运行' },
            toolsCount: { type: 'number' },
            endpoint: { type: 'string' },
            transport: { type: 'string' },
            tools: { type: 'array' }
          }
        }
      }
    }
  })
  async getStatus() {
    try {
      const status = this.mcpService.getServerStatus();
      
      return {
        status: 'success',
        data: {
          isRunning: status.isRunning,
          toolsCount: status.toolsCount,
          endpoint: status.endpoint,
          transport: status.config.transport,
          tools: status.tools
        }
      };
    } catch (error) {
      this.logger.error('Error getting server status:', error);
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to get server status',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('health')
  @ApiOperation({ 
    summary: '健康检查',
    description: '检查 MCP 服务器的健康状态'
  })
  @ApiResponse({ status: 200, description: '健康状态信息' })
  async healthCheck() {
    try {
      const health = await this.mcpService.healthCheck();
      
      return {
        status: 'success',
        data: {
          healthy: health.healthy,
          toolsCount: health.toolsCount,
          lastCheck: health.lastCheck,
          serverRunning: health.serverRunning,
          endpoint: health.endpoint
        }
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'error',
        message: 'Health check failed',
        error: error.message,
        data: {
          healthy: false,
          lastCheck: new Date()
        }
      };
    }
  }

  @Get('tools')
  @ApiOperation({ 
    summary: '获取工具列表',
    description: '获取当前 MCP 服务器中可用的所有工具'
  })
  @ApiResponse({ 
    status: 200, 
    description: '工具列表',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: {
          type: 'object',
          properties: {
            toolsCount: { type: 'number' },
            tools: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  inputSchema: { type: 'object' }
                }
              }
            }
          }
        }
      }
    }
  })
  async getTools() {
    try {
      const tools = this.mcpService.getTools();
      
      return {
        status: 'success',
        data: {
          toolsCount: tools.length,
          tools: tools
        }
      };
    } catch (error) {
      this.logger.error('Error getting tools:', error);
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to get tools',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('reload')
  @ApiOperation({ 
    summary: '重新加载工具',
    description: '从新的 OpenAPI 规范重新加载工具，保持服务器运行'
  })
  @ApiResponse({ status: 200, description: '工具重新加载成功' })
  @ApiBody({ type: ReloadToolsDto })
  async reloadTools(@Body() reloadDto: ReloadToolsDto) {
    this.logger.log('Reloading MCP tools from new OpenAPI specification');
    
    try {
      const success = await this.mcpService.reloadTools(reloadDto.openApiData);
      
      if (success) {
        const status = this.mcpService.getServerStatus();
        return {
          status: 'success',
          message: 'Tools reloaded successfully',
          data: {
            toolsCount: status.toolsCount,
            isRunning: status.isRunning
          }
        };
      } else {
        throw new HttpException(
          {
            status: 'error',
            message: 'Failed to reload tools'
          },
          HttpStatus.BAD_REQUEST
        );
      }
    } catch (error) {
      this.logger.error('Error reloading tools:', error);
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to reload tools',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete('stop')
  @ApiOperation({ 
    summary: '停止 MCP 服务器',
    description: '优雅地停止当前运行的 MCP 服务器'
  })
  @ApiResponse({ status: 200, description: 'MCP 服务器已停止' })
  async stopServer() {
    this.logger.log('Stopping MCP server');
    
    try {
      await this.mcpService.stopServer();
      
      return {
        status: 'success',
        message: 'MCP server stopped successfully',
        data: {
          isRunning: false,
          stoppedAt: new Date()
        }
      };
    } catch (error) {
      this.logger.error('Error stopping server:', error);
      throw new HttpException(
        {
          status: 'error', 
          message: 'Failed to stop server',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
