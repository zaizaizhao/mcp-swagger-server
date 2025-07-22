import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createDataSource } from './data-source';
import { MCPServerEntity } from './entities/mcp-server.entity';
import { AuthConfigEntity } from './entities/auth-config.entity';
import { TestCaseEntity } from './entities/test-case.entity';
import { LogEntryEntity } from './entities/log-entry.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'password'),
        database: configService.get('DB_DATABASE', 'mcp_swagger_api'),
        entities: [
          MCPServerEntity,
          AuthConfigEntity,
          TestCaseEntity,
          LogEntryEntity,
        ],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('DB_LOGGING', false),
        ssl: configService.get('NODE_ENV') === 'production' 
          ? { rejectUnauthorized: false } 
          : false,
        retryAttempts: 3,
        retryDelay: 3000,
        autoLoadEntities: true,
        keepConnectionAlive: true,
      }),
      inject: [ConfigService],
    }),
    
    // 导出实体模块供其他模块使用
    TypeOrmModule.forFeature([
      MCPServerEntity,
      AuthConfigEntity,
      TestCaseEntity,
      LogEntryEntity,
    ]),
  ],
  exports: [
    TypeOrmModule,
  ],
})
export class DatabaseModule {}