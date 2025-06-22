// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// OpenAPI 规范基本信息
export interface OpenApiInfo {
  title: string;
  version: string;
  description?: string;
  serverUrl?: string;
  totalEndpoints?: number;
}

// API 端点信息
export interface ApiEndpoint {
  method: string;
  path: string;
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  deprecated?: boolean;
}

// 转换配置
export interface ConvertConfig {
  filters: {
    methods: string[];
    tags: string[];
    includeDeprecated: boolean;
  };
  transport: 'stdio' | 'sse' | 'streamable';
  optimization: {
    generateValidation: boolean;
    includeExamples: boolean;
    optimizeNames: boolean;
  };
  // MCP 服务器配置
  name?: string;
  version?: string;
  description?: string;
  port?: number;
}

// 输入源类型
export interface InputSource {
  type: 'url' | 'file' | 'text';
  content: string;
  auth?: {
    type: 'bearer' | 'apikey' | 'basic';
    token: string;
  };
}

// MCP 工具配置
export interface McpToolConfig {
  name: string;
  description: string;
  inputSchema: any;
}

// 转换结果
export interface ConvertResult {
  mcpConfig: {
    mcpServers: any;
    tools: McpToolConfig[];
  };
  metadata: {
    apiInfo: OpenApiInfo;
    stats: {
      totalEndpoints: number;
      convertedTools: number;
      skippedEndpoints: number;
    };
  };
  processingTime: number;
}

// 应用状态
export interface AppState {
  inputSource: InputSource;
  config: ConvertConfig;
  apiInfo: OpenApiInfo | null;
  endpoints: ApiEndpoint[];
  convertResult: ConvertResult | null;
  loading: boolean;
  error: string | null;
}
