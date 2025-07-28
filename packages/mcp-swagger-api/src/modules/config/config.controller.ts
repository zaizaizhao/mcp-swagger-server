import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard';
import { AppConfigService } from '../../config/app-config.service';

@ApiTags('Configuration')
@Controller('api/v1/config')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConfigController {
  private readonly logger = new Logger(ConfigController.name);

  constructor(private readonly configService: AppConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Get application configuration',
    description: 'Get the current application configuration (safe values only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Application configuration',
    schema: {
      type: 'object',
      properties: {
        app: { type: 'object' },
        cors: { type: 'object' },
        security: { type: 'object' },
        logging: { type: 'object' },
        performance: { type: 'object' },
        mcp: { type: 'object' },
        openapi: { type: 'object' },
        monitoring: { type: 'object' },
        development: { type: 'object' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing API key',
  })
  async getConfig() {
    try {
      this.logger.log('Getting application configuration');

      const config = this.configService.getAllConfig();

      this.logger.log('Successfully retrieved application configuration');

      return config;
    } catch (error) {
      this.logger.error(`Failed to get configuration: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('environment')
  @ApiOperation({
    summary: 'Get environment information',
    description: 'Get basic environment information',
  })
  @ApiResponse({
    status: 200,
    description: 'Environment information',
    schema: {
      type: 'object',
      properties: {
        nodeEnv: { type: 'string' },
        port: { type: 'number' },
        mcpPort: { type: 'number' },
        isDevelopment: { type: 'boolean' },
        isProduction: { type: 'boolean' },
        isTest: { type: 'boolean' },
        timestamp: { type: 'string' },
      },
    },
  })
  async getEnvironment() {
    try {
      this.logger.debug('Getting environment information');

      return {
        nodeEnv: this.configService.nodeEnv,
        port: this.configService.port,
        mcpPort: this.configService.mcpPort,
        isDevelopment: this.configService.isDevelopment,
        isProduction: this.configService.isProduction,
        isTest: this.configService.isTest,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to get environment info: ${error.message}`, error.stack);
      throw error;
    }
  }
}
