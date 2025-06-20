import axios from 'axios'
import type { InputSource, ConvertConfig, ApiResponse } from '@/types'
import { demoApiInfo, demoEndpoints, demoConvertResult } from './demo-data'
import { 
  validateOpenAPISpec, 
  previewOpenAPISpec, 
  convertToMCP,
  ParserError 
} from './parser'

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
    
    // 使用新的解析器验证
    const validation = await validateOpenAPISpec(source)
    
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
      error: error instanceof ParserError ? error.message : '验证失败'
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
    
    // 使用新的解析器预览
    const preview = await previewOpenAPISpec(source)
    
    return {
      success: true,
      data: preview,
      message: '预览成功'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof ParserError ? error.message : '预览失败'
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
    
    // 使用新的解析器转换
    const convertResult = await convertToMCP(params.source, params.config)
    
    return {
      success: true,
      data: convertResult,
      message: '转换成功'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof ParserError ? error.message : '转换失败'
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
