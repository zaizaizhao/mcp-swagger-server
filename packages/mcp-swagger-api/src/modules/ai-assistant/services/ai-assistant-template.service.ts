import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Like, In } from 'typeorm';
import {
  AiAssistantTemplateEntity,
  AssistantType,
  TemplateCategory,
  TemplateStatus,
} from '../entities/ai-assistant-template.entity';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateQueryDto,
  TemplateResponseDto,
  PaginatedTemplateResponseDto,
} from '../dto/ai-assistant.dto';

@Injectable()
export class AiAssistantTemplateService {
  constructor(
    @InjectRepository(AiAssistantTemplateEntity)
    private readonly templateRepository: Repository<AiAssistantTemplateEntity>,
  ) {}

  /**
   * 创建AI助手配置模板
   */
  async createTemplate(createDto: CreateTemplateDto): Promise<TemplateResponseDto> {
    // 检查模板名称是否已存在
    const existingTemplate = await this.templateRepository.findOne({
      where: { name: createDto.name, type: createDto.type },
    });

    if (existingTemplate) {
      throw new BadRequestException(
        `Template with name '${createDto.name}' already exists for type '${createDto.type}'`,
      );
    }

    // 验证配置模板格式
    this.validateConfigTemplate(createDto.configTemplate, createDto.type);

    const template = this.templateRepository.create({
      ...createDto,
      status: TemplateStatus.ACTIVE,
    });

    const savedTemplate = await this.templateRepository.save(template);
    return this.mapToResponseDto(savedTemplate);
  }

  /**
   * 获取所有模板（分页）
   */
  async getAllTemplates(queryDto: TemplateQueryDto): Promise<PaginatedTemplateResponseDto> {
    const { page, limit, search, type, category, status, publicOnly, tags, sortBy, sortOrder } = queryDto;

    const queryBuilder = this.templateRepository.createQueryBuilder('template');

    // 搜索条件
    if (search) {
      queryBuilder.andWhere(
        '(template.name ILIKE :search OR template.description ILIKE :search OR template.author ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (type) {
      queryBuilder.andWhere('template.type = :type', { type });
    }

    if (category) {
      queryBuilder.andWhere('template.category = :category', { category });
    }

    if (status) {
      queryBuilder.andWhere('template.status = :status', { status });
    }

    if (publicOnly) {
      queryBuilder.andWhere('template.isPublic = :isPublic', { isPublic: true });
    }

    if (tags && tags.length > 0) {
      queryBuilder.andWhere('template.tags && :tags', { tags });
    }

    // 排序
    queryBuilder.orderBy(`template.${sortBy}`, sortOrder);

    // 分页
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [templates, total] = await queryBuilder.getManyAndCount();

    return {
      data: templates.map(template => this.mapToResponseDto(template)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 根据ID获取模板
   */
  async getTemplateById(id: string): Promise<TemplateResponseDto> {
    const template = await this.templateRepository.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Template with ID '${id}' not found`);
    }
    return this.mapToResponseDto(template);
  }

  /**
   * 更新模板
   */
  async updateTemplate(id: string, updateDto: UpdateTemplateDto): Promise<TemplateResponseDto> {
    const template = await this.templateRepository.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Template with ID '${id}' not found`);
    }

    // 如果更新了配置模板，需要验证格式
    if (updateDto.configTemplate) {
      this.validateConfigTemplate(updateDto.configTemplate, template.type);
    }

    // 如果更新了名称，检查是否重复
    if (updateDto.name && updateDto.name !== template.name) {
      const existingTemplate = await this.templateRepository.findOne({
        where: { name: updateDto.name, type: template.type },
      });
      if (existingTemplate && existingTemplate.id !== id) {
        throw new BadRequestException(
          `Template with name '${updateDto.name}' already exists for type '${template.type}'`,
        );
      }
    }

    Object.assign(template, updateDto);
    const updatedTemplate = await this.templateRepository.save(template);
    return this.mapToResponseDto(updatedTemplate);
  }

  /**
   * 删除模板
   */
  async deleteTemplate(id: string): Promise<void> {
    const template = await this.templateRepository.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Template with ID '${id}' not found`);
    }

    await this.templateRepository.remove(template);
  }

  /**
   * 获取模板分类统计
   */
  async getTemplateStats(): Promise<Record<string, any>> {
    const totalCount = await this.templateRepository.count();
    const activeCount = await this.templateRepository.count({ where: { status: TemplateStatus.ACTIVE } });
    
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
      total: totalCount,
      active: activeCount,
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

  /**
   * 增加模板使用次数
   */
  async incrementUsageCount(id: string): Promise<void> {
    await this.templateRepository.increment({ id }, 'usageCount', 1);
  }

  /**
   * 更新模板评分
   */
  async updateRating(id: string, rating: number): Promise<TemplateResponseDto> {
    if (rating < 0 || rating > 5) {
      throw new BadRequestException('Rating must be between 0 and 5');
    }

    const template = await this.templateRepository.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Template with ID '${id}' not found`);
    }

    template.rating = rating;
    const updatedTemplate = await this.templateRepository.save(template);
    return this.mapToResponseDto(updatedTemplate);
  }

  /**
   * 获取热门模板
   */
  async getPopularTemplates(limit: number = 10): Promise<TemplateResponseDto[]> {
    const templates = await this.templateRepository.find({
      where: { status: TemplateStatus.ACTIVE, isPublic: true },
      order: { usageCount: 'DESC', rating: 'DESC' },
      take: limit,
    });

    return templates.map(template => this.mapToResponseDto(template));
  }

  /**
   * 根据类型获取默认模板
   */
  async getDefaultTemplatesByType(type: AssistantType): Promise<TemplateResponseDto[]> {
    const templates = await this.templateRepository.find({
      where: {
        type,
        status: TemplateStatus.ACTIVE,
        isPublic: true,
      },
      order: { usageCount: 'DESC' },
      take: 5,
    });

    return templates.map(template => this.mapToResponseDto(template));
  }

  /**
   * 获取所有默认模板
   */
  async getDefaultTemplates(): Promise<TemplateResponseDto[]> {
    const templates = await this.templateRepository.find({
      where: {
        status: TemplateStatus.ACTIVE,
        isPublic: true,
      },
      order: { usageCount: 'DESC', rating: 'DESC' },
      take: 20,
    });

    return templates.map(template => this.mapToResponseDto(template));
  }

  /**
   * 验证配置模板格式
   */
  private validateConfigTemplate(configTemplate: Record<string, any>, type: AssistantType): void {
    const requiredFields = this.getRequiredFieldsByType(type);
    
    for (const field of requiredFields) {
      if (!configTemplate.hasOwnProperty(field)) {
        throw new BadRequestException(`Missing required field '${field}' for assistant type '${type}'`);
      }
    }

    // 验证特定类型的配置格式
    switch (type) {
      case AssistantType.CLAUDE_DESKTOP:
        this.validateClaudeDesktopConfig(configTemplate);
        break;
      case AssistantType.OPENAI_ASSISTANT:
        this.validateOpenAIConfig(configTemplate);
        break;
      case AssistantType.ANTHROPIC_API:
        this.validateAnthropicConfig(configTemplate);
        break;
      default:
        // 自定义类型不做特殊验证
        break;
    }
  }

  /**
   * 获取不同类型助手的必需字段
   */
  private getRequiredFieldsByType(type: AssistantType): string[] {
    switch (type) {
      case AssistantType.CLAUDE_DESKTOP:
        return ['mcpServers', 'serverName', 'command'];
      case AssistantType.OPENAI_ASSISTANT:
        return ['apiKey', 'assistantId', 'instructions'];
      case AssistantType.ANTHROPIC_API:
        return ['apiKey', 'model', 'maxTokens'];
      default:
        return [];
    }
  }

  /**
   * 验证Claude Desktop配置
   */
  private validateClaudeDesktopConfig(config: Record<string, any>): void {
    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      throw new BadRequestException('mcpServers must be an object');
    }

    if (!config.serverName || typeof config.serverName !== 'string') {
      throw new BadRequestException('serverName must be a string');
    }

    if (!config.command || !Array.isArray(config.command)) {
      throw new BadRequestException('command must be an array');
    }
  }

  /**
   * 验证OpenAI配置
   */
  private validateOpenAIConfig(config: Record<string, any>): void {
    if (!config.apiKey || typeof config.apiKey !== 'string') {
      throw new BadRequestException('apiKey must be a string');
    }

    if (!config.assistantId || typeof config.assistantId !== 'string') {
      throw new BadRequestException('assistantId must be a string');
    }
  }

  /**
   * 验证Anthropic配置
   */
  private validateAnthropicConfig(config: Record<string, any>): void {
    if (!config.apiKey || typeof config.apiKey !== 'string') {
      throw new BadRequestException('apiKey must be a string');
    }

    if (!config.model || typeof config.model !== 'string') {
      throw new BadRequestException('model must be a string');
    }

    if (!config.maxTokens || typeof config.maxTokens !== 'number') {
      throw new BadRequestException('maxTokens must be a number');
    }
  }

  /**
   * 将实体映射为响应DTO
   */
  private mapToResponseDto(template: AiAssistantTemplateEntity): TemplateResponseDto {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      type: template.type,
      category: template.category,
      status: template.status,
      configTemplate: template.configTemplate,
      defaultValues: template.defaultValues,
      validationRules: template.validationRules,
      tags: template.tags || [],
      isPublic: template.isPublic,
      version: template.version,
      author: template.author,
      usageCount: template.usageCount,
      rating: parseFloat(template.rating.toString()),
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}