import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../../config/app-config.service';

// 假设mcp-swagger-parser的类型定义
interface ParseResult {
  spec: any;
  validation: {
    valid: boolean;
    errors: any[];
    warnings: any[];
  };
}

interface ParserOptions {
  strictMode?: boolean;
  resolveReferences?: boolean;
  validateSchema?: boolean;
  baseUrl?: string;
}

@Injectable()
export class ParserService {
  private readonly logger = new Logger(ParserService.name);

  constructor(private readonly configService: AppConfigService) {}

  /**
   * 从URL解析OpenAPI规范
   */
  async parseFromUrl(url: string, options: ParserOptions = {}): Promise<ParseResult> {
    try {
      this.logger.log(`Parsing OpenAPI spec from URL: ${url}`);
      
      // TODO: 使用mcp-swagger-parser
      // const { parseFromUrl } = await import('@mcp-swagger/parser');
      // return await parseFromUrl(url, options);
      
      // 临时模拟实现
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch OpenAPI spec: ${response.statusText}`);
      }
      
      const spec = await response.json();
      
      return {
        spec,
        validation: {
          valid: true,
          errors: [],
          warnings: [],
        },
      };
      
    } catch (error) {
      this.logger.error(`Failed to parse OpenAPI spec from URL: ${url}`, error);
      throw new Error(`Parse failed: ${error.message}`);
    }
  }

  /**
   * 从文件解析OpenAPI规范
   */
  async parseFromFile(filePath: string, options: ParserOptions = {}): Promise<ParseResult> {
    try {
      this.logger.log(`Parsing OpenAPI spec from file: ${filePath}`);
      
      // TODO: 使用mcp-swagger-parser
      // const { parseFromFile } = await import('@mcp-swagger/parser');
      // return await parseFromFile(filePath, options);
      
      // 临时模拟实现
      const fs = await import('fs');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const spec = JSON.parse(fileContent);
      
      return {
        spec,
        validation: {
          valid: true,
          errors: [],
          warnings: [],
        },
      };
      
    } catch (error) {
      this.logger.error(`Failed to parse OpenAPI spec from file: ${filePath}`, error);
      throw new Error(`Parse failed: ${error.message}`);
    }
  }

  /**
   * 从字符串内容解析OpenAPI规范
   */
  async parseFromString(content: string, options: ParserOptions = {}): Promise<ParseResult> {
    try {
      this.logger.log('Parsing OpenAPI spec from string content');
      
      // TODO: 使用mcp-swagger-parser
      // const { parseFromString } = await import('@mcp-swagger/parser');
      // return await parseFromString(content, options);
      
      // 临时模拟实现
      const spec = JSON.parse(content);
      
      return {
        spec,
        validation: {
          valid: true,
          errors: [],
          warnings: [],
        },
      };
      
    } catch (error) {
      this.logger.error('Failed to parse OpenAPI spec from string', error);
      throw new Error(`Parse failed: ${error.message}`);
    }
  }

  /**
   * 验证OpenAPI规范
   */
  async validateSpec(spec: any): Promise<{ valid: boolean; errors: any[]; warnings: any[] }> {
    try {
      this.logger.log('Validating OpenAPI specification');
      
      // TODO: 使用mcp-swagger-parser的验证功能
      // const { validateSpec } = await import('@mcp-swagger/parser');
      // return await validateSpec(spec);
      
      // 临时简单验证
      const errors = [];
      const warnings = [];
      
      if (!spec.openapi && !spec.swagger) {
        errors.push({ path: 'root', message: 'Missing openapi or swagger version' });
      }
      
      if (!spec.info) {
        errors.push({ path: 'info', message: 'Missing info object' });
      }
      
      if (!spec.paths) {
        errors.push({ path: 'paths', message: 'Missing paths object' });
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
      
    } catch (error) {
      this.logger.error('Failed to validate OpenAPI spec', error);
      throw new Error(`Validation failed: ${error.message}`);
    }
  }

  /**
   * 提取API基本信息
   */
  extractApiInfo(spec: any): any {
    return {
      title: spec.info?.title || 'Unknown API',
      version: spec.info?.version || '1.0.0',
      description: spec.info?.description,
      termsOfService: spec.info?.termsOfService,
      contact: spec.info?.contact,
      license: spec.info?.license,
      servers: spec.servers,
      externalDocs: spec.externalDocs,
    };
  }

  /**
   * 提取API端点信息
   */
  extractEndpoints(spec: any): any[] {
    const endpoints = [];
    
    if (!spec.paths) {
      return endpoints;
    }
    
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (typeof pathItem !== 'object' || pathItem === null) continue;
      
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'].includes(method)) {
          continue;
        }
        
        if (typeof operation !== 'object' || operation === null) continue;
        
        endpoints.push({
          method: method.toUpperCase(),
          path,
          operationId: operation.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
          summary: operation.summary,
          description: operation.description,
          tags: operation.tags,
          deprecated: operation.deprecated || false,
          parameters: operation.parameters,
          requestBody: operation.requestBody,
          responses: operation.responses,
        });
      }
    }
    
    return endpoints;
  }

  /**
   * 解析完整的OpenAPI规范
   */
  async parseSpecification(spec: any, options?: any): Promise<any> {
    try {
      this.logger.log('Parsing OpenAPI specification');
      
      // 标准化规范
      const normalized = await this.normalizeSpecification(spec);
      
      // 提取基本信息
      const info = this.extractApiInfo(normalized);
      
      // 提取端点
      const paths = this.extractEndpoints(normalized);
      
      return {
        ...normalized,
        info,
        paths,
        servers: normalized.servers || [],
        components: normalized.components || {},
        openapi: normalized.openapi || normalized.swagger || '3.0.0',
      };
    } catch (error) {
      this.logger.error(`Failed to parse specification: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 生成MCP工具
   */
  async generateMCPTools(parsedSpec: any, options?: any): Promise<any[]> {
    try {
      this.logger.log('Generating MCP tools from parsed specification');
      
      const tools = [];
      
      if (!parsedSpec.paths || !Array.isArray(parsedSpec.paths)) {
        this.logger.warn('No paths found in parsed specification');
        return tools;
      }
      
      for (const endpoint of parsedSpec.paths) {
        const tool = {
          name: endpoint.operationId || `${endpoint.method.toLowerCase()}_${endpoint.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
          description: endpoint.summary || endpoint.description || `${endpoint.method} ${endpoint.path}`,
          inputSchema: this.generateInputSchema(endpoint),
          metadata: {
            method: endpoint.method,
            path: endpoint.path,
            tags: endpoint.tags || [],
            deprecated: endpoint.deprecated || false,
          },
        };
        
        tools.push(tool);
      }
      
      this.logger.log(`Generated ${tools.length} MCP tools`);
      return tools;
    } catch (error) {
      this.logger.error(`Failed to generate MCP tools: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 标准化OpenAPI规范
   */
  async normalizeSpecification(spec: any): Promise<any> {
    try {
      this.logger.log('Normalizing OpenAPI specification');
      
      if (!spec || typeof spec !== 'object') {
        throw new Error('Invalid specification: must be an object');
      }
      
      // 创建标准化的规范副本
      const normalized = JSON.parse(JSON.stringify(spec));
      
      // 确保基本字段存在
      if (!normalized.info) {
        normalized.info = {
          title: 'Untitled API',
          version: '1.0.0',
        };
      }
      
      if (!normalized.paths) {
        normalized.paths = {};
      }
      
      // 标准化版本字段
      if (normalized.swagger && !normalized.openapi) {
        // Swagger 2.0 转换为 OpenAPI 3.0
        normalized.openapi = '3.0.0';
        delete normalized.swagger;
        
        // 转换其他字段
        if (normalized.host || normalized.basePath) {
          normalized.servers = [{
            url: `${normalized.schemes?.[0] || 'https'}://${normalized.host || 'localhost'}${normalized.basePath || ''}`,
          }];
          delete normalized.host;
          delete normalized.basePath;
          delete normalized.schemes;
        }
        
        if (normalized.definitions) {
          normalized.components = normalized.components || {};
          normalized.components.schemas = normalized.definitions;
          delete normalized.definitions;
        }
      }
      
      this.logger.log('Successfully normalized OpenAPI specification');
      return normalized;
    } catch (error) {
      this.logger.error(`Failed to normalize specification: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 为端点生成输入Schema
   */
  private generateInputSchema(endpoint: any): any {
    const properties: any = {};
    const required: string[] = [];
    
    // 处理路径参数
    if (endpoint.parameters) {
      for (const param of endpoint.parameters) {
        if (param.in === 'path') {
          properties[param.name] = {
            type: param.schema?.type || 'string',
            description: param.description,
          };
          if (param.required) {
            required.push(param.name);
          }
        } else if (param.in === 'query') {
          properties[param.name] = {
            type: param.schema?.type || 'string',
            description: param.description,
          };
          if (param.required) {
            required.push(param.name);
          }
        }
      }
    }
    
    // 处理请求体
    if (endpoint.requestBody) {
      properties.body = {
        type: 'object',
        description: endpoint.requestBody.description || 'Request body',
      };
      
      if (endpoint.requestBody.required) {
        required.push('body');
      }
    }
    
    return {
      type: 'object',
      properties,
      required,
    };
  }
}
