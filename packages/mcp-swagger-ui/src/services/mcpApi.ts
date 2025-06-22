import axios, { AxiosInstance } from 'axios'

export interface McpServerStatus {
  healthy: boolean
  toolsCount: number
  lastCheck: string
  serverRunning: boolean
}

export interface CreateMcpServerRequest {
  openApiData: string | object
  config?: {
    name?: string
    version?: string
    description?: string
    port?: number
    transport?: 'streamable' | 'sse' | 'stdio'
  }
}

export interface CreateMcpServerResponse {
  success: boolean
  message: string
  toolsCount?: number
  endpoint?: string
}

export interface McpTool {
  name: string
  description: string
  inputSchema: any
}

export interface ApiValidationResult {
  valid: boolean
  errors?: string[]
  warnings?: string[]
}

export interface ApiParseResult {
  info: {
    title: string
    version: string
    description?: string
  }
  paths: Array<{
    method: string
    path: string
    summary?: string
    description?: string
    tags?: string[]
    deprecated?: boolean
  }>
  servers?: Array<{
    url: string
    description?: string
  }>
  tools?: Array<{
    name: string
    description: string
    inputSchema: any
  }>
}

class McpApiService {
  private api: AxiosInstance

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // 响应拦截器
    this.api.interceptors.response.use(
      (response) => response.data,
      (error) => {
        console.error('MCP API Error:', error)
        throw error
      }
    )
  }

  /**
   * 获取 MCP 服务器健康状态
   */
  async getHealthStatus(): Promise<McpServerStatus> {
    const response = await this.api.get('/api/v1/mcp/health')
    return response.data
  }

  /**
   * 获取 MCP 服务器状态
   */
  async getServerStatus(): Promise<any> {
    const response = await this.api.get('/api/v1/mcp/status')
    return response.data
  }

  /**
   * 创建 MCP 服务器
   */
  async createServer(request: CreateMcpServerRequest): Promise<CreateMcpServerResponse> {
    const response = await this.api.post('/api/v1/mcp/create', request)
    return response.data
  }

  /**
   * 重新加载 MCP 服务器工具
   */
  async reloadTools(openApiData: string | object): Promise<any> {
    const response = await this.api.post('/api/v1/mcp/reload', {
      openApiData
    })
    return response.data
  }

  /**
   * 获取 MCP 工具列表
   */
  async getTools(): Promise<McpTool[]> {
    const response = await this.api.get('/api/v1/mcp/tools')
    return response.data
  }

  /**
   * 停止 MCP 服务器
   */
  async stopServer(): Promise<any> {
    const response = await this.api.delete('/api/v1/mcp/stop')
    return response.data
  }

  /**
   * 验证 OpenAPI 规范
   */
  async validateOpenApi(source: { type: string, content: string }): Promise<ApiValidationResult> {
    const response = await this.api.post('/api/v1/openapi/validate', {
      source
    })
    return response.data
  }

  /**
   * 解析 OpenAPI 规范
   */
  async parseOpenApi(source: { type: string, content: string }): Promise<ApiParseResult> {
    const response = await this.api.post('/api/v1/openapi/parse', {
      source
    })
    return response.data
  }

  /**
   * 规范化 OpenAPI 规范
   */
  async normalizeOpenApi(source: { type: string, content: string }): Promise<any> {
    const response = await this.api.post('/api/v1/openapi/normalize', {
      source
    })
    return response.data
  }
}

export const mcpApiService = new McpApiService()
