import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiAssistantTemplateEntity } from '../entities/ai-assistant-template.entity';
import { defaultTemplates } from '../seeds/default-templates';

@Injectable()
export class AiAssistantSeedService {
  private readonly logger = new Logger(AiAssistantSeedService.name);

  constructor(
    @InjectRepository(AiAssistantTemplateEntity)
    private readonly templateRepository: Repository<AiAssistantTemplateEntity>,
  ) {}

  /**
   * 初始化默认模板数据
   */
  async seedDefaultTemplates(): Promise<void> {
    try {
      this.logger.log('开始初始化AI助手默认模板数据...');

      // 检查是否已有模板数据
      const existingCount = await this.templateRepository.count();
      if (existingCount > 0) {
        this.logger.log(`已存在 ${existingCount} 个模板，跳过初始化`);
        return;
      }

      // 创建默认模板
      const templates = defaultTemplates.map(templateData => {
        const template = this.templateRepository.create({
          ...templateData,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return template;
      });

      // 批量保存
      await this.templateRepository.save(templates);

      this.logger.log(`成功初始化 ${templates.length} 个默认AI助手模板`);
    } catch (error) {
      this.logger.error('初始化默认模板失败:', error);
      throw error;
    }
  }

  /**
   * 重置模板数据（仅开发环境使用）
   */
  async resetTemplates(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('不能在生产环境中重置模板数据');
    }

    try {
      this.logger.log('开始重置AI助手模板数据...');

      // 删除所有现有模板
      await this.templateRepository.clear();

      // 重新初始化
      await this.seedDefaultTemplates();

      this.logger.log('模板数据重置完成');
    } catch (error) {
      this.logger.error('重置模板数据失败:', error);
      throw error;
    }
  }

  /**
   * 更新模板数据（保留用户自定义模板）
   */
  async updateDefaultTemplates(): Promise<void> {
    try {
      this.logger.log('开始更新默认AI助手模板数据...');

      for (const templateData of defaultTemplates) {
        // 检查是否已存在同名的默认模板
        const existingTemplate = await this.templateRepository.findOne({
          where: {
            name: templateData.name,
            author: 'MCP Swagger Team',
          },
        });

        if (existingTemplate) {
          // 更新现有模板（保留使用统计）
          Object.assign(existingTemplate, {
            ...templateData,
            usageCount: existingTemplate.usageCount, // 保留使用次数
            rating: existingTemplate.rating, // 保留评分
            updatedAt: new Date(),
          });
          await this.templateRepository.save(existingTemplate);
          this.logger.log(`更新模板: ${templateData.name}`);
        } else {
          // 创建新模板
          const newTemplate = this.templateRepository.create({
            ...templateData,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          await this.templateRepository.save(newTemplate);
          this.logger.log(`创建新模板: ${templateData.name}`);
        }
      }

      this.logger.log('默认模板数据更新完成');
    } catch (error) {
      this.logger.error('更新默认模板失败:', error);
      throw error;
    }
  }

  /**
   * 获取模板统计信息
   */
  async getTemplateStats(): Promise<{
    total: number;
    defaultTemplates: number;
    userTemplates: number;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
  }> {
    const total = await this.templateRepository.count();
    const defaultTemplates = await this.templateRepository.count({
      where: { author: 'MCP Swagger Team' },
    });
    const userTemplates = total - defaultTemplates;

    const typeStats = await this.templateRepository
      .createQueryBuilder('template')
      .select('template.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('template.type')
      .getRawMany();

    const categoryStats = await this.templateRepository
      .createQueryBuilder('template')
      .select('template.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy('template.category')
      .getRawMany();

    return {
      total,
      defaultTemplates,
      userTemplates,
      byType: typeStats.reduce((acc, item) => {
        acc[item.type] = parseInt(item.count);
        return acc;
      }, {}),
      byCategory: categoryStats.reduce((acc, item) => {
        acc[item.category] = parseInt(item.count);
        return acc;
      }, {}),
    };
  }
}