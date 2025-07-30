// Import types from mcp-swagger-parser
export {
  ParseResult,
  ValidationResult,
  ApiEndpoint,
  ParsedApiSpec,
  ParseMetadata,
  ValidationError as ParserValidationError,
  ValidationWarning,
  OpenAPISpec,
  HttpMethod
} from 'mcp-swagger-parser';

// Re-export ParsedEndpoint as alias for ApiEndpoint for backward compatibility
export type ParsedEndpoint = import('mcp-swagger-parser').ApiEndpoint;

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  metadata?: {
    method?: string;
    path?: string;
    tags?: string[];
    deprecated?: boolean;
    [key: string]: any;
  };
}

// Configuration types
export interface OpenAPIParseOptions {
  baseUrl?: string;
  includeDeprecated?: boolean;
  requestTimeout?: number;
  pathPrefix?: string;
  tagFilter?: string[];
  operationIdPrefix?: string;
  enableAuth?: boolean;
  authHeaders?: Record<string, string>;
}

export interface InputSource {
  type: 'url' | 'file' | 'content';
  content: string;
}

// Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// ValidationResult is now imported from mcp-swagger-parser
// Keep local ValidationResult for backward compatibility if needed
export interface LocalValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface HealthStatus {
  status: 'ok' | 'error' | 'shutting_down';
  info?: Record<string, any>;
  error?: Record<string, any>;
  details?: Record<string, any>;
}

// MCP Server types
export interface MCPServerStatus {
  running: boolean;
  url: string;
  pid?: number;
  uptime?: number;
}

export interface MCPConfiguration {
  tools: MCPTool[];
  serverConfig?: {
    port?: number;
    host?: string;
    name?: string;
    version?: string;
  };
}

// Error types
export class OpenAPIParseError extends Error {
  constructor(
    message: string,
    public readonly source?: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'OpenAPIParseError';
  }
}

export class MCPServerError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'MCPServerError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: string[],
    public readonly warnings?: string[]
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
