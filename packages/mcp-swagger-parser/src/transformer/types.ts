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
}
