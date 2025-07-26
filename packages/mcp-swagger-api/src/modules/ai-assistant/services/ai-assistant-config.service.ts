import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as yaml from 'js-yaml';
import {
  AiAssistantConfigEntity,
  ConfigStatus,
  ExportFormat,
} from '../entities/ai-assistant-config.entity';
import { AiAssistantTemplateEntity, AssistantType } from '../entities/ai-assistant-template.entity';
import {
  GenerateConfigDto,
  ExportConfigDto,
  ConfigQueryDto,
  ConfigResponseDto,
  PaginatedConfigResponseDto,
  ExportResponseDto,
  BatchOperationDto,
  BatchOperationResponseDto,
} from '../dto/ai-assistant.dto';
import { AiAssistantTemplateService } from './ai-assistant-template.service';

@Injectable()
export class AiAssistantConfigService {
  constructor(
    @InjectRepository(AiAssistantConfigEntity)
    private readonly configRepository: Repository<AiAssistantConfigEntity>,
    @InjectRepository(AiAssistantTemplateEntity)
    private readonly templateRepository: Repository<AiAssistantTemplateEntity>,
    private readonly templateService: AiAssistantTemplateService,
  ) {}

  /**
   * 生成AI助手配置
   */
  async generateConfig(generateDto: GenerateConfigDto): Promise<ConfigResponseDto> {
    // 获取模板
    const template = await this.templateRepository.findOne({
      where: { id: generateDto.templateId },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID '${generateDto.templateId}' not found`);
    }

    // 验证自定义参数
    if (generateDto.customParameters) {
      this.validateCustomParameters(generateDto.customParameters, template);
    }

    // 生成配置
    const generatedConfig = this.mergeConfigWithParameters(
      template.configTemplate,
      template.defaultValues || {},
      generateDto.customParameters || {},
    );

    // 创建配置记录
    const config = this.configRepository.create({
      ...generateDto,
      generatedConfig,
      status: ConfigStatus.GENERATED,
    });

    const savedConfig = await this.configRepository.save(config);

    // 增加模板使用次数
    await this.templateService.incrementUsageCount(generateDto.templateId);

    return this.mapToResponseDto(await this.getConfigWithTemplate(savedConfig.id));
  }

  /**
   * 获取所有配置（分页）
   */
  async getAllConfigs(queryDto: ConfigQueryDto): Promise<PaginatedConfigResponseDto> {
    const { page, limit, search, templateId, status, favoritesOnly, tags, sortBy, sortOrder } = queryDto;

    const queryBuilder = this.configRepository
      .createQueryBuilder('config')
      .leftJoinAndSelect('config.template', 'template');

    // 搜索条件
    if (search) {
      queryBuilder.andWhere(
        '(config.name ILIKE :search OR config.description ILIKE :search OR config.createdBy ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (templateId) {
      queryBuilder.andWhere('config.templateId = :templateId', { templateId });
    }

    if (status) {
      queryBuilder.andWhere('config.status = :status', { status });
    }

    if (favoritesOnly) {
      queryBuilder.andWhere('config.isFavorite = :isFavorite', { isFavorite: true });
    }

    if (tags && tags.length > 0) {
      queryBuilder.andWhere('config.tags && :tags', { tags });
    }

    // 排序
    queryBuilder.orderBy(`config.${sortBy}`, sortOrder);

    // 分页
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [configs, total] = await queryBuilder.getManyAndCount();

    return {
      data: configs.map(config => this.mapToResponseDto(config)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 根据ID获取配置
   */
  async getConfigById(id: string): Promise<ConfigResponseDto> {
    const config = await this.getConfigWithTemplate(id);
    if (!config) {
      throw new NotFoundException(`Config with ID '${id}' not found`);
    }
    return this.mapToResponseDto(config);
  }

  /**
   * 更新配置
   */
  async updateConfig(id: string, updateData: Partial<AiAssistantConfigEntity>): Promise<ConfigResponseDto> {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(`Config with ID '${id}' not found`);
    }

    Object.assign(config, updateData);
    const updatedConfig = await this.configRepository.save(config);
    return this.mapToResponseDto(await this.getConfigWithTemplate(updatedConfig.id));
  }

  /**
   * 删除配置
   */
  async deleteConfig(id: string): Promise<void> {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(`Config with ID '${id}' not found`);
    }

    await this.configRepository.remove(config);
  }

  /**
   * 导出配置
   */
  async exportConfig(id: string, exportDto: ExportConfigDto): Promise<ExportResponseDto> {
    const config = await this.getConfigWithTemplate(id);
    if (!config) {
      throw new NotFoundException(`Config with ID '${id}' not found`);
    }

    let exportContent: string;
    let contentType: string;
    let fileExtension: string;

    // 准备导出数据
    const exportData = this.prepareExportData(config, exportDto.includeSensitive);

    switch (exportDto.format) {
      case ExportFormat.JSON:
        exportContent = JSON.stringify(exportData, null, 2);
        contentType = 'application/json';
        fileExtension = 'json';
        break;

      case ExportFormat.YAML:
        exportContent = yaml.dump(exportData, { indent: 2 });
        contentType = 'application/x-yaml';
        fileExtension = 'yaml';
        break;

      case ExportFormat.ENV:
        exportContent = this.generateEnvFormat(exportData);
        contentType = 'text/plain';
        fileExtension = 'env';
        break;

      case ExportFormat.SHELL_SCRIPT:
        exportContent = this.generateShellScript(exportData, config.template.type);
        contentType = 'text/x-shellscript';
        fileExtension = 'sh';
        break;

      default:
        throw new BadRequestException(`Unsupported export format: ${exportDto.format}`);
    }

    // 更新配置状态和导出信息
    await this.configRepository.update(id, {
      status: ConfigStatus.EXPORTED,
      exportFormat: exportDto.format,
      exportedContent: exportContent,
    });

    // 增加使用次数
    await this.configRepository.increment({ id }, 'usageCount', 1);
    await this.configRepository.update(id, { lastUsedAt: new Date() });

    const filename = `${config.name.replace(/[^a-zA-Z0-9]/g, '_')}_config.${fileExtension}`;

    return {
      format: exportDto.format,
      content: exportContent,
      filename,
      contentType,
    };
  }

  /**
   * 预览配置
   */
  async previewConfig(id: string, format: ExportFormat = ExportFormat.JSON): Promise<string> {
    const config = await this.getConfigWithTemplate(id);
    if (!config) {
      throw new NotFoundException(`Config with ID '${id}' not found`);
    }

    const exportData = this.prepareExportData(config, false);

    switch (format) {
      case ExportFormat.JSON:
        return JSON.stringify(exportData, null, 2);
      case ExportFormat.YAML:
        return yaml.dump(exportData, { indent: 2 });
      case ExportFormat.ENV:
        return this.generateEnvFormat(exportData);
      case ExportFormat.SHELL_SCRIPT:
        return this.generateShellScript(exportData, config.template.type);
      default:
        return JSON.stringify(exportData, null, 2);
    }
  }

  /**
   * 批量操作
   */
  async batchOperation(batchDto: BatchOperationDto): Promise<BatchOperationResponseDto> {
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const id of batchDto.ids) {
      try {
        switch (batchDto.operation) {
          case 'delete':
            await this.deleteConfig(id);
            break;
          case 'archive':
            await this.updateConfig(id, { status: ConfigStatus.ARCHIVED });
            break;
          case 'activate':
            await this.updateConfig(id, { status: ConfigStatus.GENERATED });
            break;
          case 'export':
            // 批量导出需要特殊处理
            const exportFormat = batchDto.parameters?.format || ExportFormat.JSON;
            await this.exportConfig(id, { format: exportFormat });
            break;
        }
        results.push({ id, success: true });
        successCount++;
      } catch (error) {
        results.push({ id, success: false, message: error.message });
        failureCount++;
      }
    }

    return {
      successCount,
      failureCount,
      results,
    };
  }

  /**
   * 切换收藏状态
   */
  async toggleFavorite(id: string): Promise<ConfigResponseDto> {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(`Config with ID '${id}' not found`);
    }

    config.isFavorite = !config.isFavorite;
    const updatedConfig = await this.configRepository.save(config);
    return this.mapToResponseDto(await this.getConfigWithTemplate(updatedConfig.id));
  }

  /**
   * 获取配置统计信息
   */
  async getConfigStats(): Promise<Record<string, any>> {
    const totalCount = await this.configRepository.count();
    const favoriteCount = await this.configRepository.count({ where: { isFavorite: true } });
    
    const statusStats = await this.configRepository
      .createQueryBuilder('config')
      .select('config.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('config.status')
      .getRawMany();

    const templateStats = await this.configRepository
      .createQueryBuilder('config')
      .leftJoin('config.template', 'template')
      .select('template.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('template.type')
      .getRawMany();

    return {
      total: totalCount,
      favorites: favoriteCount,
      byStatus: statusStats.reduce((acc, item) => {
        acc[item.status] = parseInt(item.count);
        return acc;
      }, {}),
      byTemplateType: templateStats.reduce((acc, item) => {
        acc[item.type] = parseInt(item.count);
        return acc;
      }, {}),
    };
  }

  /**
   * 获取配置及其模板信息
   */
  private async getConfigWithTemplate(id: string): Promise<AiAssistantConfigEntity | null> {
    return this.configRepository.findOne({
      where: { id },
      relations: ['template'],
    });
  }

  /**
   * 验证自定义参数
   */
  private validateCustomParameters(
    customParameters: Record<string, any>,
    template: AiAssistantTemplateEntity,
  ): void {
    if (!template.validationRules) {
      return;
    }

    for (const [key, value] of Object.entries(customParameters)) {
      const rule = template.validationRules[key];
      if (rule) {
        this.validateParameterValue(key, value, rule);
      }
    }
  }

  /**
   * 验证参数值
   */
  private validateParameterValue(key: string, value: any, rule: any): void {
    if (rule.required && (value === undefined || value === null || value === '')) {
      throw new BadRequestException(`Parameter '${key}' is required`);
    }

    if (rule.type && typeof value !== rule.type) {
      throw new BadRequestException(`Parameter '${key}' must be of type '${rule.type}'`);
    }

    if (rule.pattern && typeof value === 'string' && !new RegExp(rule.pattern).test(value)) {
      throw new BadRequestException(`Parameter '${key}' does not match required pattern`);
    }

    if (rule.enum && !rule.enum.includes(value)) {
      throw new BadRequestException(`Parameter '${key}' must be one of: ${rule.enum.join(', ')}`);
    }
  }

  /**
   * 合并配置模板和参数
   */
  private mergeConfigWithParameters(
    template: Record<string, any>,
    defaultValues: Record<string, any>,
    customParameters: Record<string, any>,
  ): Record<string, any> {
    const merged = JSON.parse(JSON.stringify(template));
    
    // 应用默认值
    this.applyValues(merged, defaultValues);
    
    // 应用自定义参数
    this.applyValues(merged, customParameters);
    
    return merged;
  }

  /**
   * 递归应用值到配置对象
   */
  private applyValues(target: any, values: Record<string, any>): void {
    for (const [key, value] of Object.entries(values)) {
      if (typeof target === 'object' && target !== null) {
        if (key.includes('.')) {
          // 支持嵌套路径，如 "server.port"
          const keys = key.split('.');
          let current = target;
          for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
              current[keys[i]] = {};
            }
            current = current[keys[i]];
          }
          current[keys[keys.length - 1]] = value;
        } else {
          target[key] = value;
        }
      }
    }
  }

  /**
   * 准备导出数据
   */
  private prepareExportData(config: AiAssistantConfigEntity, includeSensitive: boolean): Record<string, any> {
    const data = JSON.parse(JSON.stringify(config.generatedConfig));
    
    if (!includeSensitive) {
      // 移除敏感信息
      this.removeSensitiveData(data);
    }
    
    return data;
  }

  /**
   * 移除敏感数据
   */
  private removeSensitiveData(data: any): void {
    const sensitiveKeys = ['apiKey', 'token', 'password', 'secret', 'key', 'auth'];
    
    if (typeof data === 'object' && data !== null) {
      for (const key of Object.keys(data)) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          data[key] = '***REDACTED***';
        } else if (typeof data[key] === 'object') {
          this.removeSensitiveData(data[key]);
        }
      }
    }
  }

  /**
   * 生成环境变量格式
   */
  private generateEnvFormat(data: Record<string, any>): string {
    const envVars = [];
    this.flattenObject(data, '', envVars);
    return envVars.join('\n');
  }

  /**
   * 扁平化对象为环境变量
   */
  private flattenObject(obj: any, prefix: string, result: string[]): void {
    for (const [key, value] of Object.entries(obj)) {
      const envKey = prefix ? `${prefix}_${key.toUpperCase()}` : key.toUpperCase();
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this.flattenObject(value, envKey, result);
      } else {
        const envValue = Array.isArray(value) ? value.join(',') : String(value);
        result.push(`${envKey}=${envValue}`);
      }
    }
  }

  /**
   * 生成Shell脚本
   */
  private generateShellScript(data: Record<string, any>, assistantType: AssistantType): string {
    let script = '#!/bin/bash\n\n';
    script += '# AI Assistant Configuration Script\n';
    script += `# Generated for: ${assistantType}\n\n`;
    
    switch (assistantType) {
      case AssistantType.CLAUDE_DESKTOP:
        script += this.generateClaudeDesktopScript(data);
        break;
      case AssistantType.OPENAI_ASSISTANT:
        script += this.generateOpenAIScript(data);
        break;
      case AssistantType.ANTHROPIC_API:
        script += this.generateAnthropicScript(data);
        break;
      default:
        script += this.generateGenericScript(data);
        break;
    }
    
    return script;
  }

  /**
   * 生成Claude Desktop脚本
   */
  private generateClaudeDesktopScript(data: Record<string, any>): string {
    let script = '# Claude Desktop Configuration\n';
    script += 'CONFIG_DIR="$HOME/.config/claude"\n';
    script += 'CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"\n\n';
    script += 'mkdir -p "$CONFIG_DIR"\n\n';
    script += 'cat > "$CONFIG_FILE" << EOF\n';
    script += JSON.stringify(data, null, 2);
    script += '\nEOF\n\n';
    script += 'echo "Claude Desktop configuration updated successfully!"\n';
    return script;
  }

  /**
   * 生成OpenAI脚本
   */
  private generateOpenAIScript(data: Record<string, any>): string {
    let script = '# OpenAI Assistant Configuration\n';
    script += `export OPENAI_API_KEY="${data.apiKey || 'YOUR_API_KEY'}"\n`;
    script += `export OPENAI_ASSISTANT_ID="${data.assistantId || 'YOUR_ASSISTANT_ID'}"\n\n`;
    script += 'echo "OpenAI environment variables set successfully!"\n';
    return script;
  }

  /**
   * 生成Anthropic脚本
   */
  private generateAnthropicScript(data: Record<string, any>): string {
    let script = '# Anthropic API Configuration\n';
    script += `export ANTHROPIC_API_KEY="${data.apiKey || 'YOUR_API_KEY'}"\n`;
    script += `export ANTHROPIC_MODEL="${data.model || 'claude-3-sonnet-20240229'}"\n\n`;
    script += 'echo "Anthropic environment variables set successfully!"\n';
    return script;
  }

  /**
   * 生成通用脚本
   */
  private generateGenericScript(data: Record<string, any>): string {
    let script = '# Generic Configuration\n';
    const envVars = [];
    this.flattenObject(data, '', envVars);
    
    for (const envVar of envVars) {
      script += `export ${envVar}\n`;
    }
    
    script += '\necho "Configuration environment variables set successfully!"\n';
    return script;
  }

  /**
   * 将实体映射为响应DTO
   */
  private mapToResponseDto(config: AiAssistantConfigEntity): ConfigResponseDto {
    return {
      id: config.id,
      name: config.name,
      description: config.description,
      template: {
        id: config.template.id,
        name: config.template.name,
        description: config.template.description,
        type: config.template.type,
        category: config.template.category,
        status: config.template.status,
        configTemplate: config.template.configTemplate,
        defaultValues: config.template.defaultValues,
        validationRules: config.template.validationRules,
        tags: config.template.tags || [],
        isPublic: config.template.isPublic,
        version: config.template.version,
        author: config.template.author,
        usageCount: config.template.usageCount,
        rating: parseFloat(config.template.rating.toString()),
        createdAt: config.template.createdAt,
        updatedAt: config.template.updatedAt,
      },
      generatedConfig: config.generatedConfig,
      customParameters: config.customParameters,
      status: config.status,
      exportFormat: config.exportFormat,
      tags: config.tags || [],
      isFavorite: config.isFavorite,
      usageCount: config.usageCount,
      lastUsedAt: config.lastUsedAt,
      createdBy: config.createdBy,
      notes: config.notes,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}