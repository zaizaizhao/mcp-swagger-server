import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MCPServerEntity } from './entities/mcp-server.entity';
import { AuthConfigEntity } from './entities/auth-config.entity';
import { TestCaseEntity } from './entities/test-case.entity';
import { LogEntryEntity } from './entities/log-entry.entity';
console.log(process.env.DB_HOST)
// 开发环境的数据源配置
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'mcp_swagger_api',
  entities: [
    MCPServerEntity,
    AuthConfigEntity,
    TestCaseEntity,
    LogEntryEntity,
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
});

// 用于NestJS的数据源工厂
export const createDataSource = (configService: ConfigService): DataSource => {
  return new DataSource({
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
    migrations: ['dist/database/migrations/*.js'],
    synchronize: configService.get('NODE_ENV') === 'development',
    logging: configService.get('NODE_ENV') === 'development',
    ssl: configService.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
  });
};