import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenAPIController } from './openapi.controller';
import { OpenAPIService } from './services/openapi.service';
import { ParserService } from './services/parser.service';
import { ValidatorService } from './services/validator.service';
import { AppConfigService } from '../../config/app-config.service';

@Module({
  imports: [
    ConfigModule,
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
