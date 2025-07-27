import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SystemBootstrap } from './system.bootstrap';
import { SeedService } from '../../database/seed.service';
import { Public } from '../security/decorators/public.decorator';

/**
 * 系统管理控制器
 * 提供系统初始化状态和健康检查的API端点
 */
@ApiTags('System')
@Controller('api/system')
export class SystemController {
  constructor(
    private readonly systemBootstrap: SystemBootstrap,
    private readonly seedService: SeedService,
  ) {}

  /**
   * 获取系统健康状态
   */
  @Get('health')
  @Public()
  @ApiOperation({
    summary: '获取系统健康状态',
    description: '检查系统的整体健康状况，包括初始化状态和环境信息'
  })
  @ApiResponse({
    status: 200,
    description: '系统健康状态',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['healthy', 'unhealthy'],
          description: '系统状态'
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          description: '检查时间'
        },
        initialization: {
          type: 'object',
          properties: {
            isInitialized: { type: 'boolean', description: '是否已初始化' },
            permissionCount: { type: 'number', description: '权限数量' },
            roleCount: { type: 'number', description: '角色数量' },
            superAdminExists: { type: 'boolean', description: '超级用户是否存在' }
          }
        },
        environment: {
          type: 'object',
          properties: {
            nodeEnv: { type: 'string', description: '运行环境' },
            port: { type: 'number', description: 'API端口' },
            mcpPort: { type: 'number', description: 'MCP端口' }
          }
        }
      }
    }
  })
  async getSystemHealth() {
    return await this.systemBootstrap.getSystemHealth();
  }

  /**
   * 获取初始化状态
   */
  @Get('initialization')
  @Public()
  @ApiOperation({
    summary: '获取系统初始化状态',
    description: '获取详细的系统初始化状态信息'
  })
  @ApiResponse({
    status: 200,
    description: '初始化状态信息',
    schema: {
      type: 'object',
      properties: {
        isInitialized: {
          type: 'boolean',
          description: '系统是否已完全初始化'
        },
        permissionCount: {
          type: 'number',
          description: '已创建的权限数量'
        },
        roleCount: {
          type: 'number',
          description: '已创建的角色数量'
        },
        superAdminExists: {
          type: 'boolean',
          description: '超级管理员是否存在'
        }
      }
    }
  })
  async getInitializationStatus() {
    return await this.seedService.getInitializationStatus();
  }

  /**
   * 检查系统是否已初始化
   */
  @Get('initialized')
  @Public()
  @ApiOperation({
    summary: '检查系统是否已初始化',
    description: '简单检查系统是否已完成基本初始化'
  })
  @ApiResponse({
    status: 200,
    description: '初始化检查结果',
    schema: {
      type: 'object',
      properties: {
        initialized: {
          type: 'boolean',
          description: '是否已初始化'
        },
        message: {
          type: 'string',
          description: '状态消息'
        }
      }
    }
  })
  async checkInitialized() {
    const isInitialized = await this.seedService.isSystemInitialized();
    
    return {
      initialized: isInitialized,
      message: isInitialized 
        ? '系统已完成初始化，可以正常使用' 
        : '系统尚未初始化，请检查配置和数据库连接'
    };
  }
}