import { join } from 'path';
import { parseFromFile, parseFromUrl, transformToMCPTools } from 'mcp-swagger-parser';
import type { MCPTool as ParserMCPTool, TransformerOptions } from 'mcp-swagger-parser';
import type { OpenAPISpec, ValidationError as ParserValidationError } from 'mcp-swagger-parser';
import type { MCPTool, ValidationResult, TransformOptions, ITransformer, ValidationError, ValidationWarning } from '../types/core';

export class Transformer implements ITransformer {
  private defaultOptions: TransformOptions = {
    baseUrl: undefined,
    includeDeprecated: false,
    requestTimeout: 30000,
    pathPrefix: '',
    tagFilter: [],
    operationIdPrefix: '',
    enableAuth: false,
    authHeaders: {}
  };

  async transformFromFile(filePath?: string, options: TransformOptions = {}): Promise<MCPTool[]> {
    const resolvedPath = filePath || join(process.cwd(), 'src', 'swagger_json_file', 'swagger.json');
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    console.log(`📖 Loading OpenAPI specification from: ${resolvedPath}`);

    try {
      // 使用mcp-swagger-parser解析文件
      const parseResult = await parseFromFile(resolvedPath, {
        strictMode: false,
        resolveReferences: true,
        validateSchema: true
      });

      // 检查解析结果
      if (!parseResult.validation.valid) {
        console.warn('⚠️ OpenAPI spec validation warnings:');
        parseResult.validation.errors.forEach((error: ParserValidationError) => {
          console.warn(`  - ${error.path}: ${error.message} (${error.code})`);
        });
      }

      console.log(`✅ Loaded OpenAPI spec: ${parseResult.spec.info.title} v${parseResult.spec.info.version}`);

      // 转换为MCP工具  
      return await this.transformFromOpenAPI(parseResult.spec, mergedOptions);

    } catch (error: any) {
      console.error(`❌ Failed to load OpenAPI spec from file: ${resolvedPath}`, error);
      throw new Error(`File transformation failed: ${error?.message || 'Unknown error'}`);
    }
  }

  async transformFromUrl(url: string, options: TransformOptions = {}): Promise<MCPTool[]> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    console.log(`🌐 Loading OpenAPI specification from URL: ${url}`);

    try {
      // 使用mcp-swagger-parser解析URL
      const parseResult = await parseFromUrl(url, {
        strictMode: false,
        resolveReferences: true,
        validateSchema: true
      });

      // 检查解析结果
      if (!parseResult.validation.valid) {
        console.warn('⚠️ OpenAPI spec validation warnings:');
        parseResult.validation.errors.forEach((error: ParserValidationError) => {
          console.warn(`  - ${error.path}: ${error.message} (${error.code})`);
        });
      }

      console.log(`✅ Loaded OpenAPI spec from URL: ${parseResult.spec.info.title} v${parseResult.spec.info.version}`);

      // 转换为MCP工具
      return await this.transformFromOpenAPI(parseResult.spec, mergedOptions);

    } catch (error: any) {
      console.error(`❌ Failed to load OpenAPI spec from URL: ${url}`, error);
      throw new Error(`URL transformation failed: ${error?.message || 'Unknown error'}`);
    }
  }

  private async transformFromOpenAPI(spec: OpenAPISpec, options: TransformOptions): Promise<MCPTool[]> {
    console.log(`🔄 Transforming OpenAPI spec: ${spec.info.title} v${spec.info.version}`);
    console.log(`📊 Found ${Object.keys(spec.paths).length} API paths`);

    try {
      // 使用mcp-swagger-parser进行转换
      const transformerOptions: TransformerOptions = {
        baseUrl: options.baseUrl,
        includeDeprecated: options.includeDeprecated,
        requestTimeout: options.requestTimeout,
        pathPrefix: options.pathPrefix
      };

      const parserTools = transformToMCPTools(spec, transformerOptions);

      // 转换为我们的MCPTool格式
      let tools = this.convertParserToolsToOurFormat(parserTools);

      // 应用过滤器
      let filteredTools = tools;

      // 标签过滤
      if (options.tagFilter && options.tagFilter.length > 0) {
        filteredTools = filteredTools.filter(tool => 
          tool.metadata?.tags?.some(tag => options.tagFilter!.includes(tag))
        );
      }

      // 操作ID前缀
      if (options.operationIdPrefix) {
        filteredTools = filteredTools.map(tool => ({
          ...tool,
          id: `${options.operationIdPrefix}${tool.id}`,
          name: `${options.operationIdPrefix}${tool.name}`
        }));
      }

      // 添加认证支持
      if (options.enableAuth && options.authHeaders) {
        filteredTools = this.addAuthToTools(filteredTools, options.authHeaders);
      }

      // 规范化工具
      const normalizedTools = this.normalizeTools(filteredTools);

      // 验证工具
      const validation = this.validateTools(normalizedTools);
      if (!validation.valid) {
        console.warn('⚠️ Some tools have validation issues:');
        validation.errors.forEach(error => {
          console.warn(`  - ${error.field}: ${error.message}`);
        });
      }

      if (validation.warnings.length > 0) {
        console.warn('⚠️ Tool validation warnings:');
        validation.warnings.forEach(warning => {
          console.warn(`  - ${warning.field}: ${warning.message}`);
        });
      }

      console.log(`🎉 Generated ${normalizedTools.length} MCP tools`);
      return normalizedTools;

    } catch (error: any) {
      console.error('❌ Failed to transform OpenAPI spec:', error);
      throw new Error(`OpenAPI transformation failed: ${error?.message || 'Unknown error'}`);
    }
  }

  // 将parser的工具格式转换为我们的格式
  private convertParserToolsToOurFormat(parserTools: ParserMCPTool[]): MCPTool[] {
    return parserTools.map((parserTool, index) => ({
      id: parserTool.metadata?.operationId || `tool_${index}`,
      name: parserTool.name,
      description: parserTool.description,
      inputSchema: parserTool.inputSchema,
      handler: async (args: any) => {
        const result = await parserTool.handler(args);
        // 如果结果已经是字符串，直接返回，否则转换为字符串
        return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      },
      metadata: {
        tags: parserTool.metadata?.tags || ['api'],
        deprecated: parserTool.metadata?.deprecated || false,
        version: '1.0.0',
        httpMethod: parserTool.metadata?.method,
        endpoint: parserTool.metadata?.path
      }
    }));
  }

  private addAuthToTools(tools: MCPTool[], authHeaders: Record<string, string>): MCPTool[] {
    return tools.map(tool => {
      const originalHandler = tool.handler;
      
      return {
        ...tool,
        handler: async (args: any) => {
          // 添加认证头到请求中
          if (args && typeof args === 'object') {
            args.headers = { ...args.headers, ...authHeaders };
          }
          return originalHandler(args);
        }
      };
    });
  }

  validateTools(tools: MCPTool[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      const toolIndex = `tools[${i}]`;

      // ID唯一性检查
      const duplicateIds = tools.filter(t => t.id === tool.id);
      if (duplicateIds.length > 1) {
        errors.push({
          field: `${toolIndex}.id`,
          message: `Duplicate tool ID: ${tool.id}`,
          code: 'DUPLICATE_ID'
        });
      }

      // 名称唯一性检查
      const duplicateNames = tools.filter(t => t.name === tool.name);
      if (duplicateNames.length > 1) {
        warnings.push({
          field: `${toolIndex}.name`,
          message: `Duplicate tool name: ${tool.name}`,
          code: 'DUPLICATE_NAME'
        });
      }

      // 基础字段验证
      if (!tool.id || typeof tool.id !== 'string') {
        errors.push({
          field: `${toolIndex}.id`,
          message: 'Tool ID is required and must be a string',
          code: 'INVALID_ID'
        });
      }

      if (!tool.name || typeof tool.name !== 'string') {
        errors.push({
          field: `${toolIndex}.name`,
          message: 'Tool name is required and must be a string',
          code: 'INVALID_NAME'
        });
      }

      if (!tool.description || typeof tool.description !== 'string') {
        errors.push({
          field: `${toolIndex}.description`,
          message: 'Tool description is required and must be a string',
          code: 'INVALID_DESCRIPTION'
        });
      }

      if (!tool.handler || typeof tool.handler !== 'function') {
        errors.push({
          field: `${toolIndex}.handler`,
          message: 'Tool handler is required and must be a function',
          code: 'INVALID_HANDLER'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  normalizeTools(tools: MCPTool[]): MCPTool[] {
    return tools.map(tool => ({
      ...tool,
      // 规范化ID
      id: tool.id.replace(/[^a-zA-Z0-9_-]/g, '_'),
      
      // 规范化名称
      name: tool.name.trim(),
      
      // 规范化描述
      description: tool.description.trim(),
      
      // 确保元数据存在
      metadata: {
        tags: ['api'],
        deprecated: false,
        version: '1.0.0',
        ...tool.metadata
      }
    }));
  }

  // 工具统计
  analyzeTools(tools: MCPTool[]) {
    const tagStats = new Map<string, number>();
    let deprecatedCount = 0;

    for (const tool of tools) {
      // 统计标签
      const tags = tool.metadata?.tags || ['uncategorized'];
      for (const tag of tags) {
        tagStats.set(tag, (tagStats.get(tag) || 0) + 1);
      }

      // 统计废弃工具
      if (tool.metadata?.deprecated) {
        deprecatedCount++;
      }
    }

    return {
      totalTools: tools.length,
      deprecatedCount,
      tagDistribution: Object.fromEntries(tagStats),
      uniqueTags: tagStats.size
    };
  }
}
