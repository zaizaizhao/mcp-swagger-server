import { OpenAPISpec, OperationObject, ParameterObject, RequestBodyObject, SchemaObject, ReferenceObject } from '../types/index';
import { MCPTool, MCPToolResponse, TransformerOptions, TextContent, ImageContent, AudioContent, ResourceLink, EmbeddedResource, ContentBlock, ResponseSchemaAnnotation, FieldAnnotation } from './types';
import { SchemaAnnotationExtractor } from '../extractors/schema-annotation-extractor';
import axios, { AxiosResponse, AxiosError } from 'axios';

// Re-export types
export type { MCPTool, MCPToolResponse, TransformerOptions, ContentBlock, TextContent, ImageContent, AudioContent, ResourceLink, EmbeddedResource } from './types';

/**
 * 辅助函数：创建文本内容块
 */
function createTextContent(text: string, meta?: { [key: string]: unknown }): TextContent {
  const content: TextContent = {
    type: 'text',
    text
  };
  if (meta) {
    content._meta = meta;
  }
  return content;
}

/**
 * 辅助函数：创建图像内容块
 */
function createImageContent(data: string, mimeType: string, meta?: { [key: string]: unknown }): ImageContent {
  const content: ImageContent = {
    type: 'image',
    data,
    mimeType
  };
  if (meta) {
    content._meta = meta;
  }
  return content;
}

/**
 * 辅助函数：创建音频内容块
 */
function createAudioContent(data: string, mimeType: string, meta?: { [key: string]: unknown }): AudioContent {
  const content: AudioContent = {
    type: 'audio',
    data,
    mimeType
  };
  if (meta) {
    content._meta = meta;
  }
  return content;
}

/**
 * 辅助函数：创建资源链接内容块
 */
function createResourceLink(uri: string, name?: string, description?: string, mimeType?: string, meta?: { [key: string]: unknown }): ResourceLink {
  const content: ResourceLink = {
    type: 'resource_link',
    uri
  };
  if (name) content.name = name;
  if (description) content.description = description;
  if (mimeType) content.mimeType = mimeType;
  if (meta) content._meta = meta;
  return content;
}

/**
 * OpenAPI to MCP Tools Transformer
 */
export class OpenAPIToMCPTransformer {
  private spec: OpenAPISpec;
  private options: Required<TransformerOptions>;
  private annotationExtractor: SchemaAnnotationExtractor;

  constructor(spec: OpenAPISpec, options: TransformerOptions = {}) {
    this.spec = spec;
    this.options = {
      baseUrl: options.baseUrl || this.getDefaultBaseUrl(),
      includeDeprecated: options.includeDeprecated ?? false,
      includeTags: options.includeTags ?? [],
      excludeTags: options.excludeTags ?? [],
      requestTimeout: options.requestTimeout ?? 30000,
      defaultHeaders: options.defaultHeaders ?? { 'Content-Type': 'application/json' },
      customHandlers: options.customHandlers ?? {},
      pathPrefix: options.pathPrefix ?? '',
      stripBasePath: options.stripBasePath ?? false,
      includeFieldAnnotations: options.includeFieldAnnotations ?? true,
      annotationOptions: {
        showFieldTypes: options.annotationOptions?.showFieldTypes ?? true,
        showRequiredMarkers: options.annotationOptions?.showRequiredMarkers ?? true,
        showCurrentValues: options.annotationOptions?.showCurrentValues ?? true,
        showExampleValues: options.annotationOptions?.showExampleValues ?? true,
        showEnumDescriptions: options.annotationOptions?.showEnumDescriptions ?? true,
        maxFieldsToShow: options.annotationOptions?.maxFieldsToShow ?? 50,
        maxDepth: options.annotationOptions?.maxDepth ?? 5,
        ...options.annotationOptions
      }
    };
    
    // 初始化注释提取器
    this.annotationExtractor = new SchemaAnnotationExtractor(spec);
  }

  /**
   * Transform OpenAPI specification to MCP Tools
   */
  public transformToMCPTools(): MCPTool[] {
    const tools: MCPTool[] = [];

    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'] as const;
      
      for (const method of methods) {
        const operation = pathItem[method];
        if (operation && this.shouldIncludeOperation(operation)) {
          const tool = this.createMCPToolFromOperation(method, path, operation);
          if (tool) {
            tools.push(tool);
          }
        }
      }
    }

    return tools;
  }

  /**
   * Get default base URL from spec
   */
  private getDefaultBaseUrl(): string {
    if (this.spec.servers && this.spec.servers.length > 0) {
      const serverUrl = this.spec.servers[0].url;
      console.log(`Using default base URL from OpenAPI spec: ${serverUrl}`);
      
      // 处理相对路径和格式化 URL
      return this.normalizeBaseUrl(serverUrl);
    }
    console.log('No servers found in OpenAPI spec, using default: http://localhost');
    return 'http://localhost';
  }

  /**
   * 标准化 Base URL
   */
  private normalizeBaseUrl(url: string): string {
    if (!url) {
      return 'http://localhost';
    }

    // 去除末尾的斜杠
    url = url.replace(/\/+$/, '');
    
    // 如果是相对路径，添加默认协议
    if (url.startsWith('/')) {
      return `http://localhost${url}`;
    }
    
    // 如果没有协议，添加 http://
    if (!url.match(/^https?:\/\//)) {
      // 检查是否可能是域名格式
      if (url.includes('.') || url.includes('localhost') || url.includes('127.0.0.1')) {
        return `http://${url}`;
      }
      // 否则当作路径处理
      return `http://localhost/${url.replace(/^\/+/, '')}`;
    }
    
    return url;
  }

  /**
   * Check if operation should be included based on options
   */
  private shouldIncludeOperation(operation: OperationObject): boolean {
    // Skip deprecated operations if not included
    if (operation.deprecated && !this.options.includeDeprecated) {
      return false;
    }

    // Include/exclude by tags
    if (operation.tags) {
      // If includeTags is specified, only include operations with those tags
      if (this.options.includeTags.length > 0) {
        const hasIncludedTag = operation.tags.some(tag => this.options.includeTags.includes(tag));
        if (!hasIncludedTag) {
          return false;
        }
      }

      // Exclude operations with excluded tags
      if (this.options.excludeTags.length > 0) {
        const hasExcludedTag = operation.tags.some(tag => this.options.excludeTags.includes(tag));
        if (hasExcludedTag) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Create MCP Tool from OpenAPI Operation
   */
  private createMCPToolFromOperation(method: string, path: string, operation: OperationObject): MCPTool | null {
    try {
      const toolName = this.generateToolName(method, path, operation);
      const description = this.generateDescription(method, path, operation);
      const inputSchema = this.generateInputSchema(operation);
      const handler = this.createHandler(method, path, operation);

      return {
        name: toolName,
        description,
        inputSchema,
        handler,
        metadata: {
          method: method.toUpperCase(),
          path,
          tags: operation.tags,
          operationId: operation.operationId,
          deprecated: operation.deprecated
        }
      };
    } catch (error) {
      console.warn(`Failed to create tool for ${method.toUpperCase()} ${path}:`, error);
      return null;
    }
  }

  /**
   * Generate tool name from operation
   */
  private generateToolName(method: string, path: string, operation: OperationObject): string {
    // Use operationId if available
    if (operation.operationId) {
      return operation.operationId;
    }

    // Generate from method and path
    const cleanPath = path
      .replace(/[{}]/g, '') // Remove parameter braces
      .replace(/[^a-zA-Z0-9]/g, '_') // Replace non-alphanumeric with underscore
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores

    return `${method}_${cleanPath}`;
  }

  /**
   * Generate description from operation
   */
  private generateDescription(method: string, path: string, operation: OperationObject): string {
    if (operation.description) {
      return operation.description;
    }

    if (operation.summary) {
      return operation.summary;
    }

    // Generate default description
    const methodUpper = method.toUpperCase();
    return `${methodUpper} request to ${path}`;
  }

  /**
   * Generate input schema from operation parameters and request body
   */
  private generateInputSchema(operation: OperationObject): MCPTool['inputSchema'] {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Add parameters
    if (operation.parameters) {
      for (const param of operation.parameters) {
        if (!this.isReferenceObject(param)) {
          const paramSchema = this.convertSchemaToJsonSchema(param.schema || { type: 'string' });
          properties[param.name] = {
            ...paramSchema,
            description: param.description || `${param.in} parameter`
          };

          if (param.required) {
            required.push(param.name);
          }
        }
      }
    }

    // Add request body
    if (operation.requestBody && !this.isReferenceObject(operation.requestBody)) {
      const requestBody = operation.requestBody;
      if (requestBody.content) {
        // Prefer application/json
        const jsonContent = requestBody.content['application/json'];
        if (jsonContent && jsonContent.schema) {
          const bodySchema = this.convertSchemaToJsonSchema(jsonContent.schema);
          if (bodySchema.type === 'object' && bodySchema.properties) {
            // Merge request body properties
            Object.assign(properties, bodySchema.properties);
            if (bodySchema.required) {
              required.push(...bodySchema.required);
            }
          } else {
            properties.body = bodySchema;
            if (requestBody.required) {
              required.push('body');
            }
          }
        }
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
      additionalProperties: false
    };
  }

  /**
   * Create handler function for the operation
   */
  private createHandler(method: string, path: string, operation: OperationObject) {
    return async (args: any): Promise<MCPToolResponse> => {
      try {
        // Check for custom handler
        const customHandler = this.options.customHandlers[operation.operationId || `${method}_${path}`];
        if (customHandler) {
          return await customHandler(args);
        }

        // Default HTTP request handler
        return await this.executeHttpRequest(method, path, args, operation);
      } catch (error) {        console.error(`Error executing ${method.toUpperCase()} ${path}:`, error);
        return {
          content: [createTextContent(
            `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            {
              errorType: 'execution_error',
              method: method.toUpperCase(),
              path,
              timestamp: new Date().toISOString()
            }
          )],
          isError: true
        };
      }
    };
  }

  /**
   * Execute HTTP request
   */
  private async executeHttpRequest(
    method: string, 
    path: string, 
    args: any, 
    operation: OperationObject
  ): Promise<MCPToolResponse> {
    try {
      // 1. 构建请求 URL
      const { url, queryParams } = this.buildUrlWithParams(path, args, operation);
      
      // 2. 准备请求头
      const headers = { ...this.options.defaultHeaders };
      
      // 3. 准备请求体
      const requestBody = this.buildRequestBody(args, operation);
      
      // 4. 执行 HTTP 请求
      const response = await axios({
        method: method.toLowerCase() as any,
        url,
        params: queryParams,
        data: requestBody,
        headers,
        timeout: this.options.requestTimeout,
        validateStatus: () => true, // 不要自动抛出错误，我们手动处理
        maxRedirects: 5,
        responseType: 'json'
      });

      // 5. 处理响应
      return this.formatHttpResponse(response, method, path, operation);
      
    } catch (error) {
      // 6. 错误处理
      return this.handleRequestError(error, method, path);
    }
  }

  /**
   * 构建带参数的完整 URL
   */
  private buildUrlWithParams(path: string, args: any, operation: OperationObject): { url: string, queryParams: Record<string, any> } {
    // 构建基础 URL
    let url = this.buildBaseUrl(path);
    const queryParams: Record<string, any> = {};
    
    console.log(`Building URL - Base: ${this.options.baseUrl}, Prefix: ${this.options.pathPrefix}, Path: ${path}`);
    console.log(`Initial URL: ${url}`);
    
    // 处理路径参数
    url = url.replace(/{([^}]+)}/g, (match, paramName) => {
      const value = args[paramName];
      if (value !== undefined) {
        const encodedValue = encodeURIComponent(String(value));
        console.log(`Replacing path parameter {${paramName}} with: ${encodedValue}`);
        return encodedValue;
      }
      console.warn(`Path parameter {${paramName}} not found in args:`, Object.keys(args));
      return match;
    });

    // 处理查询参数
    if (operation.parameters) {
      for (const param of operation.parameters) {
        if (!this.isReferenceObject(param) && param.in === 'query') {
          const value = args[param.name];
          if (value !== undefined) {
            queryParams[param.name] = value;
            console.log(`Added query parameter: ${param.name} = ${value}`);
          }
        }
      }
    }

    console.log(`Final URL: ${url}, Query params:`, queryParams);
    return { url, queryParams };
  }

  /**
   * 构建基础 URL（处理 baseUrl + pathPrefix + path 的拼接）
   */
  private buildBaseUrl(path: string): string {
    const baseUrl = this.options.baseUrl;
    const pathPrefix = this.options.pathPrefix;
    
    // 标准化各个部分
    const normalizedBase = baseUrl.replace(/\/+$/, ''); // 移除末尾斜杠
    const normalizedPrefix = pathPrefix ? `/${pathPrefix.replace(/^\/+|\/+$/g, '')}` : ''; // 标准化前缀
    const normalizedPath = `/${path.replace(/^\/+/, '')}`; // 确保路径以斜杠开头
    
    const fullUrl = normalizedBase + normalizedPrefix + normalizedPath;
    
    // 最后清理多余的斜杠（但保留协议后的 //）
    return fullUrl.replace(/([^:]\/)\/+/g, '$1');
  }

  /**
   * 构建请求体
   */
  private buildRequestBody(args: any, operation: OperationObject): any {
    if (!operation.requestBody || this.isReferenceObject(operation.requestBody)) {
      return undefined;
    }

    const requestBody = operation.requestBody;
    
    // 如果有 body 参数，直接使用
    if (args.body !== undefined) {
      return args.body;
    }

    // 否则，构建请求体对象
    const bodyData: any = {};
    let hasBodyData = false;

    // 收集所有非路径、非查询参数的数据作为请求体
    if (operation.parameters) {
      const pathParams = new Set();
      const queryParams = new Set();
      
      for (const param of operation.parameters) {
        if (!this.isReferenceObject(param)) {
          if (param.in === 'path') pathParams.add(param.name);
          if (param.in === 'query') queryParams.add(param.name);
        }
      }

      for (const [key, value] of Object.entries(args)) {
        if (!pathParams.has(key) && !queryParams.has(key) && value !== undefined) {
          bodyData[key] = value;
          hasBodyData = true;
        }
      }
    } else {
      // 如果没有参数定义，使用所有 args 作为请求体
      Object.assign(bodyData, args);
      hasBodyData = Object.keys(bodyData).length > 0;
    }

    return hasBodyData ? bodyData : undefined;
  }

  /**
   * 格式化 HTTP 响应为 MCP 格式
   */
  private formatHttpResponse(response: AxiosResponse, method: string, path: string, operation: OperationObject): MCPToolResponse {
    const statusCode = response.status;
    const isSuccess = statusCode >= 200 && statusCode < 300;
    const url = response.config?.url || `${this.options.baseUrl}${path}`;
    
    // 构建基本响应信息
    const responseInfo = {
      status: statusCode,
      statusText: response.statusText,
      headers: response.headers,
      method: method.toUpperCase(),
      url: url
    };

    // 格式化响应数据
    let responseText: string;
    let structuredContent: any;

    try {
      if (response.data) {
        if (typeof response.data === 'string') {
          responseText = response.data;
        } else {
          responseText = JSON.stringify(response.data, null, 2);
          structuredContent = {
            type: 'json',
            data: response.data
          };
        }
      } else {
        responseText = `${method.toUpperCase()} ${path} completed with status ${statusCode}`;
      }
    } catch (error) {
      responseText = `Response received but could not be parsed: ${error}`;
    }

    // 提取响应注释（关键新增功能）
    let schemaAnnotations;
    if (isSuccess && operation.responses && this.options.includeFieldAnnotations) {
      const operationId = operation.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
      schemaAnnotations = this.annotationExtractor.extractResponseAnnotations(
        operationId,
        method,
        path,
        operation.responses
      );
    }

    // 构建包含字段解释的响应文本
    const enhancedResponseText = this.buildEnhancedResponseText(
      method,
      path,
      statusCode,
      response.statusText,
      responseText,
      response.data,
      schemaAnnotations
    );

    const mcpResponse: MCPToolResponse = {
      content: [createTextContent(enhancedResponseText, { 
        httpStatus: statusCode,
        method: method.toUpperCase(),
        url,
        timestamp: new Date().toISOString()
      })],
      isError: !isSuccess
    };

    // 添加结构化内容
    if (structuredContent) {
      mcpResponse.structuredContent = structuredContent;
    }

    // 添加架构注释
    if (schemaAnnotations) {
      mcpResponse.schemaAnnotations = schemaAnnotations;
    }

    return mcpResponse;
  }

  /**
   * 处理请求错误
   */
  private handleRequestError(error: any, method: string, path: string): MCPToolResponse {
    let errorMessage: string;
    let statusCode: number | undefined;

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      if (axiosError.response) {
        // 服务器响应了错误状态码
        statusCode = axiosError.response.status;
        const responseData = axiosError.response.data;
        
        errorMessage = [
          `HTTP ${statusCode} ${axiosError.response.statusText}`,
          `${method.toUpperCase()} ${path}`,
          '',
          'Error Response:',
          typeof responseData === 'string' ? responseData : JSON.stringify(responseData, null, 2)
        ].join('\n');
      } else if (axiosError.request) {
        // 请求发出但没有收到响应
        errorMessage = [
          `Network Error: No response received`,
          `${method.toUpperCase()} ${path}`,
          '',
          'Details:',
          axiosError.code || 'Unknown network error',
          axiosError.message
        ].join('\n');
      } else {
        // 请求配置错误
        errorMessage = [
          `Request Configuration Error`,
          `${method.toUpperCase()} ${path}`,
          '',
          'Details:',
          axiosError.message
        ].join('\n');
      }
    } else if (error instanceof Error) {
      errorMessage = [
        `Unexpected Error`,
        `${method.toUpperCase()} ${path}`,
        '',
        'Details:',
        error.message,
        error.stack || ''
      ].join('\n');
    } else {
      errorMessage = [
        `Unknown Error`,
        `${method.toUpperCase()} ${path}`,
        '',
        'Details:',
        String(error)
      ].join('\n');
    }    return {
      content: [createTextContent(errorMessage, {
        errorType: 'request_error',
        method: method.toUpperCase(),
        path,
        timestamp: new Date().toISOString()
      })],
      isError: true
    };
  }

  /**
   * Build URL with path parameters
   */
  private buildUrl(path: string, args: any): string {
    let url = this.options.baseUrl + this.options.pathPrefix + path;
    
    // Replace path parameters
    url = url.replace(/{([^}]+)}/g, (match, paramName) => {
      return args[paramName] || match;
    });

    return url;
  }

  /**
   * Check if object is a reference
   */
  private isReferenceObject(obj: any): obj is ReferenceObject {
    return obj && typeof obj === 'object' && '$ref' in obj;
  }

  /**
   * Convert OpenAPI schema to JSON schema
   */
  private convertSchemaToJsonSchema(schema: SchemaObject | ReferenceObject): any {
    if (this.isReferenceObject(schema)) {
      // For simplicity, return a generic object for references
      // In a real implementation, you would resolve the reference
      return { type: 'object' };
    }

    // Basic schema conversion
    const jsonSchema: any = {};
    
    if (schema.type) {
      jsonSchema.type = schema.type;
    }
    
    if (schema.properties) {
      jsonSchema.properties = {};
      for (const [key, prop] of Object.entries(schema.properties)) {
        jsonSchema.properties[key] = this.convertSchemaToJsonSchema(prop);
      }
    }
    
    if (schema.items) {
      jsonSchema.items = this.convertSchemaToJsonSchema(schema.items);
    }
    
    if (schema.required) {
      jsonSchema.required = schema.required;
    }
    
    if (schema.description) {
      jsonSchema.description = schema.description;
    }
    
    if (schema.example !== undefined) {
      jsonSchema.examples = [schema.example];
    }

    return jsonSchema;
  }

  /**
   * 构建增强的响应文本，包含字段注释
   */
  private buildEnhancedResponseText(
    method: string,
    path: string,
    statusCode: number,
    statusText: string,
    responseText: string,
    responseData: any,
    schemaAnnotations?: ResponseSchemaAnnotation
  ): string {
    const sections: string[] = [];
    
    // 基本信息
    sections.push(`HTTP ${statusCode} ${statusText}`);
    sections.push(`${method.toUpperCase()} ${path}`);
    sections.push('');
    
    // 添加字段注释（如果有）
    if (schemaAnnotations && Object.keys(schemaAnnotations.fieldAnnotations).length > 0) {
      sections.push('📋 字段说明 (Field Descriptions):');
      sections.push('');
      
      const annotatedFields = this.formatFieldAnnotations(schemaAnnotations.fieldAnnotations, responseData);
      if (annotatedFields.length > 0) {
        sections.push(...annotatedFields);
        sections.push('');
      }
    }
    
    // 响应数据
    sections.push('📄 响应数据 (Response Data):');
    sections.push(responseText);
    
    return sections.join('\n');
  }

  /**
   * 格式化字段注释为易读的文本
   */
  private formatFieldAnnotations(
    fieldAnnotations: Record<string, FieldAnnotation>,
    responseData: any
  ): string[] {
    const lines: string[] = [];
    
    // 对字段进行排序，优先显示顶级字段
    const sortedFields = Object.entries(fieldAnnotations).sort(([a], [b]) => {
      const aDepth = a.split('.').length;
      const bDepth = b.split('.').length;
      if (aDepth !== bDepth) {
        return aDepth - bDepth;
      }
      return a.localeCompare(b);
    });
    
    for (const [fieldPath, annotation] of sortedFields) {
      // 获取字段的实际值
      const fieldValue = this.getFieldValue(responseData, fieldPath);
      const hasValue = fieldValue !== undefined;
      
      // 构建字段说明行
      const parts: string[] = [];
      
      // 字段名和类型
      if (annotation.type) {
        parts.push(`${fieldPath} (${annotation.type})`);
      } else {
        parts.push(fieldPath);
      }
      
      // 是否必需
      if (annotation.required) {
        parts.push('[必需]');
      }
      
      // 描述
      if (annotation.description) {
        parts.push(`- ${annotation.description}`);
      }
      
      // 当前值（如果存在）
      if (hasValue) {
        const valueStr = this.formatFieldValue(fieldValue);
        parts.push(`= ${valueStr}`);
      }
      
      lines.push(`  • ${parts.join(' ')}`);
      
      // 枚举值说明
      if (annotation.enum && annotation.enum.length > 0) {
        const enumLines = annotation.enum.map((enumItem: { value: any; description?: string }) => {
          let enumText = `    - ${enumItem.value}`;
          if (enumItem.description) {
            enumText += `: ${enumItem.description}`;
          }
          return enumText;
        });
        lines.push(...enumLines);
      }
      
      // 示例值
      if (!hasValue && annotation.example !== undefined) {
        const exampleStr = this.formatFieldValue(annotation.example);
        lines.push(`    示例: ${exampleStr}`);
      }
    }
    
    return lines;
  }

  /**
   * 从响应数据中获取字段值
   */
  private getFieldValue(data: any, fieldPath: string): any {
    if (!data || typeof data !== 'object') {
      return undefined;
    }
    
    const parts = fieldPath.split('.');
    let current = data;
    
    for (const part of parts) {
      if (part.endsWith('[]')) {
        // 处理数组字段
        const arrayFieldName = part.slice(0, -2);
        current = current[arrayFieldName];
        if (Array.isArray(current)) {
          // 返回数组的第一个元素作为示例
          current = current.length > 0 ? current[0] : undefined;
        } else {
          return undefined;
        }
      } else {
        current = current[part];
      }
      
      if (current === undefined) {
        break;
      }
    }
    
    return current;
  }

  /**
   * 格式化字段值为可读的字符串
   */
  private formatFieldValue(value: any): string {
    if (value === null) {
      return 'null';
    }
    if (value === undefined) {
      return 'undefined';
    }
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return `[${value.length} items]`;
      }
      return JSON.stringify(value);
    }
    return String(value);
  }
}

/**
 * Convenience function to transform OpenAPI spec to MCP tools
 */
export function transformToMCPTools(
  spec: OpenAPISpec, 
  options: TransformerOptions = {}
): MCPTool[] {
  const transformer = new OpenAPIToMCPTransformer(spec, options);
  return transformer.transformToMCPTools();
}
