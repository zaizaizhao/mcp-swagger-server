/**
 * Transformer type definitions
 */

/**
 * MCP Annotations - 用于提供内容的元数据和展示提示
 */
export interface Annotations {
  /**
   * 指定内容的目标受众
   */
  audience?: ("user" | "assistant")[];
  /**
   * 内容的优先级 (0-1，1 为最高优先级)
   */
  priority?: number;
  /**
   * 内容的最后修改时间 (ISO 8601 格式)
   */
  lastModified?: string;
}

/**
 * 文本资源内容
 */
export interface TextResourceContents {
  uri: string;
  text: string;
  mimeType?: string;
  _meta?: { [key: string]: unknown };
}

/**
 * 二进制资源内容
 */
export interface BlobResourceContents {
  uri: string;
  blob: string; // base64-encoded
  mimeType?: string;
  _meta?: { [key: string]: unknown };
}

/**
 * 文本内容块
 */
export interface TextContent {
  type: "text";
  text: string;
  annotations?: Annotations;
  _meta?: { [key: string]: unknown };
}

/**
 * 图像内容块
 */
export interface ImageContent {
  type: "image";
  data: string; // base64-encoded image data
  mimeType: string;
  annotations?: Annotations;
  _meta?: { [key: string]: unknown };
}

/**
 * 音频内容块
 */
export interface AudioContent {
  type: "audio";
  data: string; // base64-encoded audio data
  mimeType: string;
  annotations?: Annotations;
  _meta?: { [key: string]: unknown };
}

/**
 * 资源链接
 */
export interface ResourceLink {
  type: "resource_link";
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
  annotations?: Annotations;
  _meta?: { [key: string]: unknown };
}

/**
 * 嵌入资源
 */
export interface EmbeddedResource {
  type: "resource";
  resource: TextResourceContents | BlobResourceContents;
  annotations?: Annotations;
  _meta?: { [key: string]: unknown };
}

/**
 * 内容块类型联合
 */
export type ContentBlock = 
  | TextContent 
  | ImageContent 
  | AudioContent 
  | ResourceLink 
  | EmbeddedResource;

/**
 * MCP Tool Response Format - 完全符合 MCP 官方标准
 * 基于 MCP 规范 schema.ts 中的 CallToolResult 接口
 */
export interface MCPToolResponse {
  /**
   * 工具调用结果的内容列表
   */
  content: ContentBlock[];
  
  /**
   * 可选的结构化结果对象
   */
  structuredContent?: { [key: string]: unknown };
  
  /**
   * 工具调用是否以错误结束
   */
  isError?: boolean;
  
  /**
   * 响应级别的元数据
   */
  _meta?: { [key: string]: unknown };
  
  /**
   * 响应架构注释信息（用于帮助 AI 理解字段含义）
   */
  schemaAnnotations?: ResponseSchemaAnnotation;
}

/**
 * MCP Tool Definition
 */
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

/**
 * Transformer Options
 */
export interface TransformerOptions {
  baseUrl?: string;
  includeDeprecated?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  requestTimeout?: number;
  defaultHeaders?: Record<string, string>;
  customHandlers?: Record<string, (extra: any) => Promise<MCPToolResponse>>;
  pathPrefix?: string;
  stripBasePath?: boolean;
  
  /**
   * 是否在响应中包含字段注释（默认: true）
   */
  includeFieldAnnotations?: boolean;
  
  /**
   * 字段注释显示选项
   */
  annotationOptions?: {
    /**
     * 是否显示字段类型（默认: true）
     */
    showFieldTypes?: boolean;
    
    /**
     * 是否显示是否必需标记（默认: true）
     */
    showRequiredMarkers?: boolean;
    
    /**
     * 是否显示当前值（默认: true）
     */
    showCurrentValues?: boolean;
    
    /**
     * 是否显示示例值（默认: true）
     */
    showExampleValues?: boolean;
    
    /**
     * 是否显示枚举说明（默认: true）
     */
    showEnumDescriptions?: boolean;
    
    /**
     * 最大显示字段数量（防止输出过长，默认: 50）
     */
    maxFieldsToShow?: number;
    
    /**
     * 字段路径的最大深度（默认: 5）
     */
    maxDepth?: number;
  };
}

/**
 * 字段注释信息
 */
export interface FieldAnnotation {
  /**
   * 字段名称
   */
  fieldName: string;
  /**
   * 字段描述（通常为中文注释）
   */
  description?: string;
  /**
   * 字段类型
   */
  type?: string;
  /**
   * 示例值
   */
  example?: any;
  /**
   * 是否必需
   */
  required?: boolean;
  /**
   * 枚举值及其描述
   */
  enum?: Array<{
    value: any;
    description?: string;
  }>;
}

/**
 * 响应架构注释
 */
export interface ResponseSchemaAnnotation {
  /**
   * 字段注释映射 (字段路径 -> 注释信息)
   */
  fieldAnnotations: Record<string, FieldAnnotation>;
  /**
   * 响应模型名称
   */
  modelName?: string;
  /**
   * 响应描述
   */
  description?: string;
  /**
   * 原始 Swagger 响应 Schema
   */
  originalSchema?: any;
}
