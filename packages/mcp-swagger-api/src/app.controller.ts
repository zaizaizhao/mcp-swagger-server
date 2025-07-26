import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppConfigService } from './config/app-config.service';

@ApiTags('Application')
@Controller()
export class AppController {
  constructor(private readonly configService: AppConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Application welcome',
    description: 'Get basic application information and available endpoints',
  })
  @ApiResponse({
    status: 200,
    description: 'Application information',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        version: { type: 'string' },
        description: { type: 'string' },
        environment: { type: 'string' },
        endpoints: {
          type: 'object',
          properties: {
            api: { type: 'string' },
            docs: { type: 'string' },
            health: { type: 'string' },
          },
        },
        timestamp: { type: 'string' },
      },
    },
  })
  getWelcome() {
    const port = this.configService.port;
    const baseUrl = `http://localhost:${port}`;

    return {
      name: 'MCP Swagger API Server',
      version: '1.0.0',
      description: 'API服务器用于管理OpenAPI规范到MCP工具的转换和动态服务器管理',
      environment: this.configService.nodeEnv,
      endpoints: {
        api: `${baseUrl}/api`,
        docs: `${baseUrl}/api/docs`,
        health: `${baseUrl}/health`,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('favicon.ico')
  @ApiOperation({
    summary: 'Favicon',
    description: 'Return favicon for the application',
  })
  getFavicon() {
    // 返回一个简单的响应，避免 favicon 请求导致的 404
    return '';
  }
}