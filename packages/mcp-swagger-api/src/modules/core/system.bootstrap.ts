import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SeedService } from '../../database/seed.service';
import { ConfigService } from '@nestjs/config';

/**
 * 系统启动器
 * 负责协调系统启动时的各项初始化任务
 */
@Injectable()
export class SystemBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(SystemBootstrap.name);

  constructor(
    private readonly seedService: SeedService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    try {
      this.logger.log('🚀 系统启动初始化开始...');
      
      // 等待数据库种子数据初始化完成
      // SeedService 已经在 OnModuleInit 中执行了初始化
      // 这里我们只需要检查初始化状态
      await this.checkInitializationStatus();
      
      // 输出系统信息
      await this.logSystemInfo();
      
      this.logger.log('✅ 系统启动初始化完成');
    } catch (error) {
      this.logger.error('❌ 系统启动初始化失败:', error);
      throw error;
    }
  }

  /**
   * 检查初始化状态
   */
  private async checkInitializationStatus(): Promise<void> {
    try {
      const status = await this.seedService.getInitializationStatus();
      
      this.logger.log('📊 系统初始化状态:');
      this.logger.log(`   ✓ 系统已初始化: ${status.isInitialized ? '是' : '否'}`);
      this.logger.log(`   ✓ 权限数量: ${status.permissionCount}`);
      this.logger.log(`   ✓ 角色数量: ${status.roleCount}`);
      this.logger.log(`   ✓ 超级用户存在: ${status.superAdminExists ? '是' : '否'}`);
      
      if (!status.isInitialized) {
        this.logger.warn('⚠️ 系统尚未完全初始化，请检查数据库连接和配置');
      }
    } catch (error) {
      this.logger.error('❌ 检查初始化状态失败:', error);
      throw error;
    }
  }

  /**
   * 输出系统信息
   */
  private async logSystemInfo(): Promise<void> {
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    const port = this.configService.get('PORT', 3001);
    const mcpPort = this.configService.get('MCP_PORT', 3002);
    const dbHost = this.configService.get('DB_HOST', 'localhost');
    const dbPort = this.configService.get('DB_PORT', 5432);
    const dbName = this.configService.get('DB_DATABASE', 'mcp_swagger_api');
    
    this.logger.log('🎯 系统配置信息:');
    this.logger.log(`   环境: ${nodeEnv}`);
    this.logger.log(`   API 端口: ${port}`);
    this.logger.log(`   MCP 端口: ${mcpPort}`);
    this.logger.log(`   数据库: ${dbHost}:${dbPort}/${dbName}`);
    
    // 安全提醒
    if (nodeEnv === 'production') {
      this.logger.warn('🔒 生产环境安全提醒:');
      this.logger.warn('   ⚠️ 请确保已修改默认超级用户密码');
      this.logger.warn('   ⚠️ 请确保数据库连接使用了安全配置');
      this.logger.warn('   ⚠️ 请确保启用了 HTTPS');
    } else {
      this.logger.log('🔧 开发环境提醒:');
      this.logger.log('   ℹ️ 默认超级用户已创建，请查看日志获取登录信息');
      this.logger.log('   ℹ️ 数据库同步已启用，结构变更将自动应用');
    }
  }

  /**
   * 获取系统健康状态
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    timestamp: Date;
    initialization: {
      isInitialized: boolean;
      permissionCount: number;
      roleCount: number;
      superAdminExists: boolean;
    };
    environment: {
      nodeEnv: string;
      port: number;
      mcpPort: number;
    };
  }> {
    try {
      const initialization = await this.seedService.getInitializationStatus();
      
      return {
        status: initialization.isInitialized ? 'healthy' : 'unhealthy',
        timestamp: new Date(),
        initialization,
        environment: {
          nodeEnv: this.configService.get('NODE_ENV', 'development'),
          port: this.configService.get('PORT', 3001),
          mcpPort: this.configService.get('MCP_PORT', 3002),
        }
      };
    } catch (error) {
      this.logger.error('获取系统健康状态失败:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        initialization: {
          isInitialized: false,
          permissionCount: 0,
          roleCount: 0,
          superAdminExists: false,
        },
        environment: {
          nodeEnv: this.configService.get('NODE_ENV', 'development'),
          port: this.configService.get('PORT', 3001),
          mcpPort: this.configService.get('MCP_PORT', 3002),
        }
      };
    }
  }
}