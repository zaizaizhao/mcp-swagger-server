import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { AppConfigService } from '../../config/app-config.service';

@Module({
  imports: [
    TerminusModule,
    ConfigModule,
  ],
  controllers: [HealthController],
  providers: [AppConfigService],
})
export class HealthModule {}
