import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
  ValidationPipe,
  UsePipes,
  Header,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AiAssistantTemplateService } from './services/ai-assistant-template.service';
import { AiAssistantConfigService } from './services/ai-assistant-config.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateQueryDto,
  GenerateConfigDto,
  ExportConfigDto,
  ConfigQueryDto,
  BatchOperationDto,
  TemplateResponseDto,
  ConfigResponseDto,
  PaginatedTemplateResponseDto,
  PaginatedConfigResponseDto,
  ExportResponseDto,
  BatchOperationResponseDto,
} from './dto/ai-assistant.dto';
import { ExportFormat } from './entities/ai-assistant-config.entity';

@ApiTags('AI Assistant')
@Controller('ai-assistant')
@UsePipes(new ValidationPipe({ transform: true }))
export class AiAssistantController {
  constructor(
    private readonly templateService: AiAssistantTemplateService,
    private readonly configService: AiAssistantConfigService,
  ) {}

  // ==================== 模板管理 API ====================

  @Post('templates')
  @ApiOperation({ summary: '创建AI助手模板' })
  @ApiResponse({ status: 201, description: '模板创建成功', type: TemplateResponseDto })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  async createTemplate(@Body() createTemplateDto: CreateTemplateDto): Promise<TemplateResponseDto> {
    return this.templateService.createTemplate(createTemplateDto);
  }

  @Get('templates')
  @ApiOperation({ summary: '获取AI助手模板列表' })
  @ApiResponse({ status: 200, description: '获取成功', type: PaginatedTemplateResponseDto })
  async getTemplates(@Query() queryDto: TemplateQueryDto): Promise<PaginatedTemplateResponseDto> {
    return this.templateService.getAllTemplates(queryDto);
  }

  @Get('templates/:id')
  @ApiOperation({ summary: '根据ID获取AI助手模板' })
  @ApiParam({ name: 'id', description: '模板ID' })
  @ApiResponse({ status: 200, description: '获取成功', type: TemplateResponseDto })
  @ApiResponse({ status: 404, description: '模板不存在' })
  async getTemplateById(@Param('id', ParseUUIDPipe) id: string): Promise<TemplateResponseDto> {
    return this.templateService.getTemplateById(id);
  }

  @Put('templates/:id')
  @ApiOperation({ summary: '更新AI助手模板' })
  @ApiParam({ name: 'id', description: '模板ID' })
  @ApiResponse({ status: 200, description: '更新成功', type: TemplateResponseDto })
  @ApiResponse({ status: 404, description: '模板不存在' })
  async updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
  ): Promise<TemplateResponseDto> {
    return this.templateService.updateTemplate(id, updateTemplateDto);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: '删除AI助手模板' })
  @ApiParam({ name: 'id', description: '模板ID' })
  @ApiResponse({ status: 204, description: '删除成功' })
  @ApiResponse({ status: 404, description: '模板不存在' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.templateService.deleteTemplate(id);
  }

  @Patch('templates/:id/rating')
  @ApiOperation({ summary: '为模板评分' })
  @ApiParam({ name: 'id', description: '模板ID' })
  @ApiResponse({ status: 200, description: '评分成功', type: TemplateResponseDto })
  async rateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() ratingDto: { rating: number },
  ): Promise<TemplateResponseDto> {
    return this.templateService.updateRating(id, ratingDto.rating);
  }

  @Get('templates/popular/list')
  @ApiOperation({ summary: '获取热门模板' })
  @ApiQuery({ name: 'limit', required: false, description: '返回数量限制' })
  @ApiResponse({ status: 200, description: '获取成功', type: [TemplateResponseDto] })
  async getPopularTemplates(@Query('limit') limit?: number): Promise<TemplateResponseDto[]> {
    return this.templateService.getPopularTemplates(limit);
  }

  @Get('templates/defaults/list')
  @ApiOperation({ summary: '获取默认模板' })
  @ApiResponse({ status: 200, description: '获取成功', type: [TemplateResponseDto] })
  async getDefaultTemplates(): Promise<TemplateResponseDto[]> {
    return this.templateService.getDefaultTemplates();
  }

  @Get('templates/stats/overview')
  @ApiOperation({ summary: '获取模板统计信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getTemplateStats(): Promise<Record<string, any>> {
    return this.templateService.getTemplateStats();
  }

  // ==================== 配置管理 API ====================

  @Post('configs')
  @ApiOperation({ summary: '生成AI助手配置' })
  @ApiResponse({ status: 201, description: '配置生成成功', type: ConfigResponseDto })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 404, description: '模板不存在' })
  async generateConfig(@Body() generateConfigDto: GenerateConfigDto): Promise<ConfigResponseDto> {
    return this.configService.generateConfig(generateConfigDto);
  }

  @Get('configs')
  @ApiOperation({ summary: '获取AI助手配置列表' })
  @ApiResponse({ status: 200, description: '获取成功', type: PaginatedConfigResponseDto })
  async getConfigs(@Query() queryDto: ConfigQueryDto): Promise<PaginatedConfigResponseDto> {
    return this.configService.getAllConfigs(queryDto);
  }

  @Get('configs/:id')
  @ApiOperation({ summary: '根据ID获取AI助手配置' })
  @ApiParam({ name: 'id', description: '配置ID' })
  @ApiResponse({ status: 200, description: '获取成功', type: ConfigResponseDto })
  @ApiResponse({ status: 404, description: '配置不存在' })
  async getConfigById(@Param('id', ParseUUIDPipe) id: string): Promise<ConfigResponseDto> {
    return this.configService.getConfigById(id);
  }

  @Put('configs/:id')
  @ApiOperation({ summary: '更新AI助手配置' })
  @ApiParam({ name: 'id', description: '配置ID' })
  @ApiResponse({ status: 200, description: '更新成功', type: ConfigResponseDto })
  @ApiResponse({ status: 404, description: '配置不存在' })
  async updateConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateData: { name?: string; description?: string; notes?: string; tags?: string[] },
  ): Promise<ConfigResponseDto> {
    return this.configService.updateConfig(id, updateData);
  }

  @Delete('configs/:id')
  @ApiOperation({ summary: '删除AI助手配置' })
  @ApiParam({ name: 'id', description: '配置ID' })
  @ApiResponse({ status: 204, description: '删除成功' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConfig(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.configService.deleteConfig(id);
  }

  @Post('configs/:id/export')
  @ApiOperation({ summary: '导出AI助手配置' })
  @ApiParam({ name: 'id', description: '配置ID' })
  @ApiResponse({ status: 200, description: '导出成功' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  async exportConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() exportDto: ExportConfigDto,
    @Res() res: Response,
  ): Promise<void> {
    const exportResult = await this.configService.exportConfig(id, exportDto);
    
    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
    res.send(exportResult.content);
  }

  @Get('configs/:id/preview')
  @ApiOperation({ summary: '预览AI助手配置' })
  @ApiParam({ name: 'id', description: '配置ID' })
  @ApiQuery({ name: 'format', required: false, enum: ExportFormat, description: '预览格式' })
  @ApiResponse({ status: 200, description: '预览成功' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  @Header('Content-Type', 'text/plain')
  async previewConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') format?: ExportFormat,
  ): Promise<string> {
    return this.configService.previewConfig(id, format);
  }

  @Patch('configs/:id/favorite')
  @ApiOperation({ summary: '切换配置收藏状态' })
  @ApiParam({ name: 'id', description: '配置ID' })
  @ApiResponse({ status: 200, description: '操作成功', type: ConfigResponseDto })
  @ApiResponse({ status: 404, description: '配置不存在' })
  async toggleFavorite(@Param('id', ParseUUIDPipe) id: string): Promise<ConfigResponseDto> {
    return this.configService.toggleFavorite(id);
  }

  @Post('configs/batch')
  @ApiOperation({ summary: '批量操作配置' })
  @ApiResponse({ status: 200, description: '批量操作完成', type: BatchOperationResponseDto })
  async batchOperation(@Body() batchDto: BatchOperationDto): Promise<BatchOperationResponseDto> {
    return this.configService.batchOperation(batchDto);
  }

  @Get('configs/stats/overview')
  @ApiOperation({ summary: '获取配置统计信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getConfigStats(): Promise<Record<string, any>> {
    return this.configService.getConfigStats();
  }

  // ==================== 通用 API ====================

  @Get('health')
  @ApiOperation({ summary: 'AI助手服务健康检查' })
  @ApiResponse({ status: 200, description: '服务正常' })
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('info')
  @ApiOperation({ summary: '获取AI助手服务信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getServiceInfo(): Promise<Record<string, any>> {
    const templateStats = await this.templateService.getTemplateStats();
    const configStats = await this.configService.getConfigStats();
    
    return {
      service: 'AI Assistant API',
      version: '1.0.0',
      description: 'AI助手配置管理服务',
      features: [
        '模板管理',
        '配置生成',
        '配置导出',
        '批量操作',
        '统计分析',
      ],
      supportedFormats: Object.values(ExportFormat),
      statistics: {
        templates: templateStats,
        configs: configStats,
      },
      timestamp: new Date().toISOString(),
    };
  }
}