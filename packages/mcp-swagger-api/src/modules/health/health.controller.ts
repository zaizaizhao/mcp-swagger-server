import { Controller, Get, Logger } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppConfigService } from '../../config/app-config.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly health: HealthCheckService,
    private readonly http: HttpHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly configService: AppConfigService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Application health check',
    description: 'Check the overall health of the application and its dependencies',
  })
  @ApiResponse({
    status: 200,
    description: 'Health check successful',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'error', 'shutting_down'] },
        info: { type: 'object' },
        error: { type: 'object' },
        details: { type: 'object' },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Health check failed',
  })
  async check() {
    try {
      this.logger.log('Performing health check');

      return await this.health.check([
        // Memory check
        () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024), // 300MB
        () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024), // 300MB

        // Disk check
        () => this.disk.checkStorage('disk', { 
          thresholdPercent: 0.9, // 90% disk usage threshold
          path: '/' 
        }),

        // MCP Server health check
        async () => {
          try {
            const mcpUrl = this.configService.mcpServerUrl;
            return await this.http.pingCheck('mcp_server', `${mcpUrl}/health`);
          } catch (error) {
            this.logger.warn(`MCP server health check failed: ${error.message}`);
            return {
              mcp_server: {
                status: 'down',
                message: error.message,
              },
            };
          }
        },
      ]);
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness check',
    description: 'Check if the application is ready to serve requests',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is ready',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ready', 'not_ready'] },
        timestamp: { type: 'string' },
        uptime: { type: 'number' },
      },
    },
  })
  async ready() {
    try {
      this.logger.debug('Performing readiness check');

      const uptime = process.uptime();
      const status = uptime > 5 ? 'ready' : 'not_ready'; // Ready after 5 seconds

      return {
        status,
        timestamp: new Date().toISOString(),
        uptime,
      };
    } catch (error) {
      this.logger.error(`Readiness check failed: ${error.message}`, error.stack);
      return {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  @Get('live')
  @ApiOperation({
    summary: 'Liveness check',
    description: 'Check if the application is alive',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is alive',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['alive'] },
        timestamp: { type: 'string' },
        pid: { type: 'number' },
      },
    },
  })
  async live() {
    try {
      this.logger.debug('Performing liveness check');

      return {
        status: 'alive',
        timestamp: new Date().toISOString(),
        pid: process.pid,
      };
    } catch (error) {
      this.logger.error(`Liveness check failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('info')
  @ApiOperation({
    summary: 'Application information',
    description: 'Get basic information about the application',
  })
  @ApiResponse({
    status: 200,
    description: 'Application information',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        version: { type: 'string' },
        environment: { type: 'string' },
        uptime: { type: 'number' },
        memory: { type: 'object' },
        timestamp: { type: 'string' },
      },
    },
  })
  async info() {
    try {
      this.logger.debug('Getting application info');

      const memoryUsage = process.memoryUsage();

      return {
        name: 'MCP Swagger API',
        version: '1.0.0',
        environment: this.configService.nodeEnv,
        uptime: process.uptime(),
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to get application info: ${error.message}`, error.stack);
      throw error;
    }
  }
}
