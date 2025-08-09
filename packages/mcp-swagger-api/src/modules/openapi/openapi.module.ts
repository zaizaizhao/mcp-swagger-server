import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OpenAPIController } from './openapi.controller';
import { OpenAPIService } from './services/openapi.service';
import { ParserService } from './services/parser.service';
import { ValidatorService } from './services/validator.service';
import { AppConfigService } from '../../config/app-config.service';
import { SecurityModule } from '../security/security.module';
import { MCPServerEntity } from '../../database/entities/mcp-server.entity';

@Module({
  imports: [
    ConfigModule,
    SecurityModule,
    TypeOrmModule.forFeature([MCPServerEntity]),
  ],
  controllers: [OpenAPIController],
  providers: [
    OpenAPIService,
    ParserService,
    ValidatorService,
    AppConfigService,
  ],
  exports: [
    OpenAPIService,
    ParserService,
    ValidatorService,
  ],
})
export class OpenAPIModule {}
