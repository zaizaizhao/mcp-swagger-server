import axios from 'axios'
import type { InputSource, ConvertConfig, ApiResponse } from '@/types'
import { demoApiInfo, demoEndpoints, demoConvertResult } from './demo-data'
import { mcpApiService } from '@/services/mcpApi'

// 创建 axios 实例
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 检查是否启用演示模式
const isDemoMode = import.meta.env.VITE_FORCE_MOCK_MODE === 'true'

// 响应拦截器
api.interceptors.response.use(
  (response: any) => response.data,
  (error: any) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

/**
 * 延迟函数，用于演示
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 获取 OpenAPI 内容
 */
async function getOpenApiContent(source: InputSource): Promise<string> {
  if (source.type === 'url') {
    const headers: Record<string, string> = {}
    
    // 添加认证头
    if (source.auth?.type === 'bearer' && source.auth.token) {
      headers.Authorization = `Bearer ${source.auth.token}`
    } else if (source.auth?.type === 'apikey' && source.auth.token) {
      headers['X-API-Key'] = source.auth.token
    }
    
    const response = await axios.get(source.content, { headers })
    return typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
  }
  
  return source.content
}

/**
 * 验证 OpenAPI 规范
 */
export async function validateApi(source: InputSource): Promise<ApiResponse> {
  try {
    if (isDemoMode) {
      await delay(1000) // 模拟网络延迟
      return {
        success: true,
        data: { valid: true },
        message: '验证成功'
      }
    }
    
    // 构建源配置
    const sourceConfig = {
      type: source.type === 'url' ? 'url' : 'content',
      content: source.type === 'url' ? source.content : await getOpenApiContent(source)
    }
    
    // 使用 MCP API 验证
    const validation = await mcpApiService.validateOpenApi(sourceConfig)
    
    return {
      success: validation.valid,
      data: {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings
      },
      message: validation.valid ? '验证成功' : '验证失败'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '验证失败'
    }
  }
}

/**
 * 预览 API 信息
 */
export async function previewApi(source: InputSource): Promise<ApiResponse> {
  try {
    if (isDemoMode) {
      await delay(1500) // 模拟网络延迟
      return {
        success: true,
        data: {
          apiInfo: demoApiInfo,
          endpoints: demoEndpoints
        },
        message: '预览成功'
      }
    }
    
    // 构建源配置
    const sourceConfig = {
      type: source.type === 'url' ? 'url' : 'content',
      content: source.type === 'url' ? source.content : await getOpenApiContent(source)
    }
    
    // 使用 MCP API 解析
    const parseResult = await mcpApiService.parseOpenApi(sourceConfig)
    
    // 转换为前端期望的格式
    const apiInfo = {
      title: parseResult.info?.title || 'Unknown API',
      version: parseResult.info?.version || '1.0.0',
      description: parseResult.info?.description || '',
      serverUrl: parseResult.servers?.[0]?.url || '',
      totalEndpoints: parseResult.paths?.length || 0
    }
    
    // 转换端点数据
    const endpoints = parseResult.paths?.map((path: any) => ({
      method: path.method,
      path: path.path,
      summary: path.summary || '',
      description: path.description || '',
      tags: path.tags || [],
      deprecated: path.deprecated || false
    })) || []
    
    return {
      success: true,
      data: { apiInfo, endpoints },
      message: '预览成功'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '预览失败'
    }
  }
}

/**
 * 转换为 MCP 格式
 */
export async function convertApi(params: {
  source: InputSource
  config: ConvertConfig
}): Promise<ApiResponse> {
  try {
    if (isDemoMode) {
      await delay(2000) // 模拟网络延迟
      return {
        success: true,
        data: demoConvertResult,
        message: '转换成功'
      }
    }
    
    // 获取 OpenAPI 内容
    const openApiContent = await getOpenApiContent(params.source)
    
    // 尝试解析为 JSON 对象，如果失败则使用字符串
    let openApiData: string | object
    try {
      openApiData = JSON.parse(openApiContent)
    } catch {
      openApiData = openApiContent
    }
    
    // 创建 MCP 服务器
    const createRequest = {
      openApiData,
      config: {
        name: params.config.name || 'Generated MCP Server',
        version: params.config.version || '1.0.0',
        description: params.config.description || 'MCP server generated from OpenAPI specification',
        port: params.config.port,
        transport: params.config.transport as 'streamable' | 'sse' | 'stdio' || 'stdio'
      }
    }
    
    const createResult = await mcpApiService.createServer(createRequest)
    
    if (createResult.success) {
      // 获取工具列表来构建转换结果
      const tools = await mcpApiService.getTools()
      
      // 构建 MCP 配置格式的结果
      const convertResult = {
        mcpVersion: "1.0.0",
        name: "mcp-swagger-server",
        version: "1.0.0",
        description: `Generated MCP server with ${tools.length} tools`,
        schema: {
          tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }))
        },
        metadata: {
          toolsCount: tools.length,
          endpoint: createResult.endpoint,
          createdAt: new Date().toISOString()
        }
      }
      
      return {
        success: true,
        data: convertResult,
        message: '转换成功'
      }
    } else {
      return {
        success: false,
        error: createResult.message || '转换失败'
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '转换失败'
    }
  }
}

/**
 * 下载文件
 */
export function downloadFile(content: string, filename: string, type = 'application/json') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 复制到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.error('复制失败:', error)
    return false
  }
}
