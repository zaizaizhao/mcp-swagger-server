import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantTemplateService } from './services/ai-assistant-template.service';
import { AiAssistantConfigService } from './services/ai-assistant-config.service';
import { AiAssistantSeedService } from './services/ai-assistant-seed.service';
import { AiAssistantTemplateEntity } from './entities/ai-assistant-template.entity';
import { AiAssistantConfigEntity } from './entities/ai-assistant-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiAssistantTemplateEntity,
      AiAssistantConfigEntity,
    ]),
  ],
  controllers: [AiAssistantController],
  providers: [
    AiAssistantTemplateService,
    AiAssistantConfigService,
    AiAssistantSeedService,
  ],
  exports: [
    AiAssistantTemplateService,
    AiAssistantConfigService,
    AiAssistantSeedService,
  ],
})
export class AiAssistantModule implements OnModuleInit {
  constructor(private readonly seedService: AiAssistantSeedService) {}

  async onModuleInit() {
    // 在模块初始化时自动加载默认模板
    try {
      await this.seedService.seedDefaultTemplates();
    } catch (error) {
      console.error('Failed to seed default AI assistant templates:', error);
    }
  }
}