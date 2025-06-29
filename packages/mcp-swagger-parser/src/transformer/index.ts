import { OpenAPISpec, OperationObject, ParameterObject, RequestBodyObject, SchemaObject, ReferenceObject } from '../types/index';
import { MCPTool, MCPToolResponse, TransformerOptions, TextContent, ImageContent, AudioContent, ResourceLink, EmbeddedResource, ContentBlock } from './types';
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
      stripBasePath: options.stripBasePath ?? false
    };
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
      return this.spec.servers[0].url;
    }
    return 'http://localhost';
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
      return this.formatHttpResponse(response, method, url);
      
    } catch (error) {
      // 6. 错误处理
      return this.handleRequestError(error, method, path);
    }
  }

  /**
   * 构建带参数的完整 URL
   */
  private buildUrlWithParams(path: string, args: any, operation: OperationObject): { url: string, queryParams: Record<string, any> } {
    let url = this.options.baseUrl + this.options.pathPrefix + path;
    const queryParams: Record<string, any> = {};
    
    // 处理路径参数
    url = url.replace(/{([^}]+)}/g, (match, paramName) => {
      const value = args[paramName];
      if (value !== undefined) {
        return encodeURIComponent(String(value));
      }
      return match;
    });

    // 处理查询参数
    if (operation.parameters) {
      for (const param of operation.parameters) {
        if (!this.isReferenceObject(param) && param.in === 'query') {
          const value = args[param.name];
          if (value !== undefined) {
            queryParams[param.name] = value;
          }
        }
      }
    }

    return { url, queryParams };
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
  private formatHttpResponse(response: AxiosResponse, method: string, url: string): MCPToolResponse {
    const statusCode = response.status;
    const isSuccess = statusCode >= 200 && statusCode < 300;
    
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
        responseText = `${method.toUpperCase()} ${url} completed with status ${statusCode}`;
      }
    } catch (error) {
      responseText = `Response received but could not be parsed: ${error}`;
    }

    // 构建完整的响应文本
    const fullResponseText = [
      `HTTP ${statusCode} ${response.statusText}`,
      `${method.toUpperCase()} ${url}`,
      '',
      'Response:',
      responseText
    ].join('\n');    const mcpResponse: MCPToolResponse = {
      content: [createTextContent(fullResponseText, { 
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
