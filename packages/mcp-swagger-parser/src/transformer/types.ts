/**
 * Transformer type definitions
 */

/**
 * MCP Tool Response Format - 严格符合 MCP SDK 标准
 */
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
