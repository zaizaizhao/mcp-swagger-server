import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// OpenAPI 数据结构定义
export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    parameters?: Record<string, ParameterObject>;
    responses?: Record<string, ResponseObject>;
    securitySchemes?: Record<string, SecuritySchemeObject>;
  };
  servers?: ServerObject[];
}

export interface PathItem {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  delete?: OperationObject;
  patch?: OperationObject;
  head?: OperationObject;
  options?: OperationObject;
  trace?: OperationObject;
  parameters?: ParameterObject[];
}

export interface OperationObject {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
  security?: SecurityRequirementObject[];
  deprecated?: boolean;
}

export interface ParameterObject {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: SchemaObject;
  example?: any;
  examples?: Record<string, ExampleObject>;
  $ref?: string; // 添加 $ref 支持
}

export interface RequestBodyObject {
  description?: string;
  content: Record<string, MediaTypeObject>;
  required?: boolean;
}

export interface ResponseObject {
  description: string;
  headers?: Record<string, HeaderObject>;
  content?: Record<string, MediaTypeObject>;
}

export interface MediaTypeObject {
  schema?: SchemaObject;
  example?: any;
  examples?: Record<string, ExampleObject>;
}

export interface SchemaObject {
  type?: string;
  format?: string;
  title?: string;
  description?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  enum?: any[];
  example?: any;
  $ref?: string;
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  additionalProperties?: boolean | SchemaObject;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface ServerObject {
  url: string;
  description?: string;
  variables?: Record<string, ServerVariableObject>;
}

export interface ServerVariableObject {
  enum?: string[];
  default: string;
  description?: string;
}

export interface SecuritySchemeObject {
  type: string;
  description?: string;
  name?: string;
  in?: string;
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlowsObject;
  openIdConnectUrl?: string;
}

export interface OAuthFlowsObject {
  implicit?: OAuthFlowObject;
  password?: OAuthFlowObject;
  clientCredentials?: OAuthFlowObject;
  authorizationCode?: OAuthFlowObject;
}

export interface OAuthFlowObject {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface ExampleObject {
  summary?: string;
  description?: string;
  value?: any;
  externalValue?: string;
}

export interface HeaderObject {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: SchemaObject;
}

export interface SecurityRequirementObject {
  [name: string]: string[];
}

// MCP Tool 响应格式 - 严格符合 MCP SDK 标准
export interface MCPToolResponse {
  content: Array<
    | { [x: string]: unknown; type: "text"; text: string; }
    | { [x: string]: unknown; type: "image"; data: string; mimeType: string; }
    | { [x: string]: unknown; type: "audio"; data: string; mimeType: string; }
    | { [x: string]: unknown; type: "resource"; resource: { uri: string; text: string; mimeType?: string; } | { uri: string; blob: string; mimeType?: string; }; }
  >;
  _meta?: {
    progressToken?: string | number;
  };
  structuredContent?: {
    type: string;
    data: any;
  };
  isError?: boolean;
}

// MCP Tool 定义
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
  handler: (extra: any) => Promise<MCPToolResponse>;
  metadata?: {
    method: string;
    path: string;
    tags?: string[];
    operationId?: string;
    deprecated?: boolean;
  };
}

export class OpenAPIToMCPTransformer {
  private openApiSpec: OpenAPISpec;
  private baseUrl: string;

  constructor(openApiSpec: OpenAPISpec, baseUrl?: string) {
    this.openApiSpec = openApiSpec;
    this.baseUrl = baseUrl || (openApiSpec.servers?.[0]?.url || 'http://localhost:44321');
  }

  /**
   * 将 OpenAPI 规范转换为 MCP Tools
   */
  public transformToMCPTools(): MCPTool[] {
    const tools: MCPTool[] = [];

    for (const [path, pathItem] of Object.entries(this.openApiSpec.paths)) {
      // 处理每个 HTTP 方法
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const;
      
      for (const method of methods) {
        const operation = pathItem[method];
        if (operation) {
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
   * 从 OpenAPI Operation 创建 MCP Tool
   */
  private createMCPToolFromOperation(
    method: string,
    path: string,
    operation: OperationObject
  ): MCPTool | null {
    try {
      const toolName = this.generateToolName(method, path, operation);
      const description = this.generateToolDescription(method, path, operation);
      const inputSchema = this.generateInputSchema(operation, path);
      const handler = this.createToolHandler(method, path, operation);

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
   * 生成工具名称
   */
  private generateToolName(method: string, path: string, operation: OperationObject): string {
    // 优先使用 operationId
    if (operation.operationId) {
      return operation.operationId.replace(/[^a-zA-Z0-9_]/g, '_');
    }

    // 从路径和方法生成名称
    const pathSegments = path.split('/').filter(segment => segment && !segment.startsWith('{'));
    const cleanPath = pathSegments.join('_').replace(/[^a-zA-Z0-9_]/g, '_');
    
    return `${method}_${cleanPath}`.toLowerCase();
  }

  /**
   * 生成工具描述
   */
  private generateToolDescription(method: string, path: string, operation: OperationObject): string {
    if (operation.summary && operation.description) {
      return `${operation.summary}: ${operation.description}`;
    }
    
    if (operation.summary) {
      return operation.summary;
    }
    
    if (operation.description) {
      return operation.description;
    }

    // 生成默认描述
    const action = this.getActionFromMethod(method);
    const resource = this.getResourceFromPath(path);
    return `${action} ${resource} via ${method.toUpperCase()} ${path}`;
  }

  /**
   * 生成输入模式
   */
  private generateInputSchema(operation: OperationObject, path: string): MCPTool['inputSchema'] {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // 处理路径参数
    const pathParams = this.extractPathParameters(path);
    for (const param of pathParams) {
      properties[param] = {
        type: 'string',
        description: `Path parameter: ${param}`
      };
      required.push(param);
    }

    // 处理查询参数和头参数
    if (operation.parameters) {
      for (const param of operation.parameters) {
        if (param.$ref) {
          // TODO: 解析 $ref 引用
          continue;
        }

        const paramSchema = this.convertSchemaToJsonSchema(param.schema);
        properties[param.name] = {
          ...paramSchema,
          description: param.description || `${param.in} parameter: ${param.name}`
        };

        if (param.required) {
          required.push(param.name);
        }
      }
    }

    // 处理请求体
    if (operation.requestBody) {
      const requestBodySchema = this.extractRequestBodySchema(operation.requestBody);
      if (requestBodySchema) {
        properties.requestBody = requestBodySchema;
        if (operation.requestBody.required) {
          required.push('requestBody');
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
   * 创建工具处理器
   */
  private createToolHandler(
    method: string,
    path: string,
    operation: OperationObject
  ): MCPTool['handler'] {
    return async (extra: any) => {
      try {
        // 从 extra 对象中提取参数
        const args = extra?.arguments || {};
        
        const { default: axios } = await import('axios');
        
        // 构建 URL
        let url = this.baseUrl + path;
        const pathParams = this.extractPathParameters(path);
        
        // 替换路径参数
        for (const param of pathParams) {
          if (args[param] !== undefined) {
            url = url.replace(`{${param}}`, encodeURIComponent(args[param]));
          }
        }

        // 构建查询参数
        const queryParams: Record<string, any> = {};
        if (operation.parameters) {
          for (const param of operation.parameters) {
            if (param.in === 'query' && args[param.name] !== undefined) {
              queryParams[param.name] = args[param.name];
            }
          }
        }

        // 构建请求头
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        
        if (operation.parameters) {
          for (const param of operation.parameters) {
            if (param.in === 'header' && args[param.name] !== undefined) {
              headers[param.name] = args[param.name];
            }
          }
        }

        // 构建请求配置
        const requestConfig: any = {
          method: method.toUpperCase(),
          url,
          headers,
          params: queryParams
        };

        // 添加请求体
        if (args.requestBody && ['post', 'put', 'patch'].includes(method.toLowerCase())) {
          requestConfig.data = args.requestBody;
        }        // 发送请求
        const response = await axios(requestConfig);
        console.log("调用结果", response.status, response.data);
        
        // 格式化响应数据
        const responseData = {
          success: true,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data
        };
          // 返回符合 MCP 规范的成功响应格式
        return {
          content: [
            {
              type: "text" as const,
              text: `✅ 请求成功 (${response.status} ${response.statusText})\n\n📋 响应数据:\n${JSON.stringify(response.data, null, 2)}`
            }
          ],
          isError: false
        } as MCPToolResponse;

      } catch (error: any) {
        console.error(`Error executing ${method.toUpperCase()} ${path}:`, error);
        
        // 格式化错误信息
        const errorMessage = error.response?.data 
          ? `❌ 请求失败 (${error.response.status} ${error.response.statusText})\n\n🚨 错误详情:\n${JSON.stringify(error.response.data, null, 2)}`
          : `❌ 请求失败: ${error.message}`;
          // 返回符合 MCP 规范的错误响应格式
        return {
          content: [
            {
              type: "text" as const,
              text: errorMessage
            }
          ],
          isError: true
        } as MCPToolResponse;
      }
    };
  }

  /**
   * 提取路径参数
   */
  private extractPathParameters(path: string): string[] {
    const matches = path.match(/\{([^}]+)\}/g);
    return matches ? matches.map(match => match.slice(1, -1)) : [];
  }

  /**
   * 提取请求体模式
   */
  private extractRequestBodySchema(requestBody: RequestBodyObject): any {
    // 优先使用 application/json
    const jsonContent = requestBody.content['application/json'];
    if (jsonContent?.schema) {
      return this.convertSchemaToJsonSchema(jsonContent.schema);
    }

    // 其他内容类型
    for (const [contentType, content] of Object.entries(requestBody.content)) {
      if (content.schema) {
        return {
          ...this.convertSchemaToJsonSchema(content.schema),
          contentType
        };
      }
    }

    return {
      type: 'object',
      description: requestBody.description || 'Request body'
    };
  }

  /**
   * 将 OpenAPI Schema 转换为 JSON Schema
   */
  private convertSchemaToJsonSchema(schema?: SchemaObject): any {
    if (!schema) {
      return { type: 'string' };
    }

    // 处理 $ref 引用
    if (schema.$ref) {
      // 简化处理，实际应该解析引用
      return {
        type: 'object',
        description: `Reference to ${schema.$ref}`
      };
    }

    const result: any = {};

    if (schema.type) {
      result.type = schema.type;
    }

    if (schema.description) {
      result.description = schema.description;
    }

    if (schema.format) {
      result.format = schema.format;
    }

    if (schema.enum) {
      result.enum = schema.enum;
    }

    if (schema.example !== undefined) {
      result.example = schema.example;
    }

    if (schema.minimum !== undefined) {
      result.minimum = schema.minimum;
    }

    if (schema.maximum !== undefined) {
      result.maximum = schema.maximum;
    }

    if (schema.minLength !== undefined) {
      result.minLength = schema.minLength;
    }

    if (schema.maxLength !== undefined) {
      result.maxLength = schema.maxLength;
    }

    if (schema.pattern) {
      result.pattern = schema.pattern;
    }

    if (schema.nullable) {
      result.nullable = schema.nullable;
    }

    // 处理对象类型
    if (schema.type === 'object' && schema.properties) {
      result.properties = {};
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        result.properties[propName] = this.convertSchemaToJsonSchema(propSchema);
      }
      
      if (schema.required) {
        result.required = schema.required;
      }
      
      if (schema.additionalProperties !== undefined) {
        result.additionalProperties = schema.additionalProperties;
      }
    }

    // 处理数组类型
    if (schema.type === 'array' && schema.items) {
      result.items = this.convertSchemaToJsonSchema(schema.items);
    }

    return result;
  }

  /**
   * 从 HTTP 方法获取动作描述
   */
  private getActionFromMethod(method: string): string {
    const actions: Record<string, string> = {
      get: 'Retrieve',
      post: 'Create',
      put: 'Update',
      patch: 'Partially update',
      delete: 'Delete',
      head: 'Get headers for',
      options: 'Get options for'
    };
    return actions[method.toLowerCase()] || 'Execute';
  }

  /**
   * 从路径获取资源描述
   */
  private getResourceFromPath(path: string): string {
    const segments = path.split('/').filter(segment => 
      segment && !segment.startsWith('{') && segment !== 'api'
    );
    return segments.length > 0 ? segments.join(' ') : 'resource';
  }
}

/**
 * 从文件加载 OpenAPI 规范
 */
export function loadOpenAPISpec(filePath: string): OpenAPISpec {
  if (!existsSync(filePath)) {
    throw new Error(`OpenAPI specification file not found: ${filePath}`);
  }

  try {
    const content = readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse OpenAPI specification: ${error}`);
  }
}

/**
 * 主转换函数
 */
export async function transformOpenApiToMcpTools(
  swaggerFilePath?: string,
  baseUrl?: string
): Promise<MCPTool[]> {
  try {
    // 默认路径
    const defaultPath = join(__dirname, '../swagger_json_file/swagger.json');
    const filePath = swaggerFilePath || defaultPath;
    
    console.log(`Loading OpenAPI specification from: ${filePath}`);
    
    // 加载 OpenAPI 规范
    const openApiSpec = loadOpenAPISpec(filePath);
    
    console.log(`Loaded OpenAPI spec: ${openApiSpec.info.title} v${openApiSpec.info.version}`);
    console.log(`Found ${Object.keys(openApiSpec.paths).length} API paths`);
    
    // 创建转换器
    const transformer = new OpenAPIToMCPTransformer(openApiSpec, baseUrl);
    
    // 执行转换
    const tools = transformer.transformToMCPTools();
    
    console.log(`Generated ${tools.length} MCP tools`);
    
    return tools;
    
  } catch (error) {
    console.error('Failed to transform OpenAPI to MCP tools:', error);
    throw error;
  }
}
