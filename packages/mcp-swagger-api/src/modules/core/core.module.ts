import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { SystemBootstrap } from './system.bootstrap';
import { SystemController } from './system.controller';

/**
 * 核心模块
 * 包含系统启动和初始化相关的服务
 */
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
  ],
  controllers: [
    SystemController,
  ],
  providers: [
    SystemBootstrap,
  ],
  exports: [
    SystemBootstrap,
  ],
})
export class CoreModule {}