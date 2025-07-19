import type { ServerStatus, LogLevel } from '@/types'

// ============================================================================
// 格式化工具函数
// ============================================================================

// 格式化字节大小
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化持续时间
export const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`
}

// 格式化日期时间
export const formatDateTime = (date: Date | string): string => {
  const d = new Date(date)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 格式化相对时间
export const formatRelativeTime = (date: Date | string): string => {
  const now = new Date()
  const target = new Date(date)
  const diff = now.getTime() - target.getTime()
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days}天前`
  if (hours > 0) return `${hours}小时前`
  if (minutes > 0) return `${minutes}分钟前`
  return `${seconds}秒前`
}

// ============================================================================
// 状态和样式工具函数
// ============================================================================

// 获取服务器状态颜色
export const getServerStatusColor = (status: ServerStatus): string => {
  const colors = {
    running: 'success',
    stopped: 'info',
    error: 'danger',
    starting: 'warning',
    stopping: 'warning'
  }
  return colors[status] || 'info'
}

// 获取服务器状态文本
export const getServerStatusText = (status: ServerStatus): string => {
  const texts = {
    running: '运行中',
    stopped: '已停止',
    error: '错误',
    starting: '启动中',
    stopping: '停止中'
  }
  return texts[status] || '未知'
}

// 获取日志级别颜色
export const getLogLevelColor = (level: LogLevel): string => {
  const colors = {
    debug: 'info',
    info: 'primary',
    warn: 'warning',
    error: 'danger'
  }
  return colors[level] || 'info'
}

// ============================================================================
// 性能优化工具函数
// ============================================================================

// 防抖函数
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// 节流函数
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// ============================================================================
// 数据验证工具函数
// ============================================================================

// 验证URL格式
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// 验证JSON格式
export const isValidJson = (str: string): boolean => {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

// 验证服务器名称
export const isValidServerName = (name: string): boolean => {
  return /^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/.test(name) && name.length >= 2 && name.length <= 50
}

// 验证端口号
export const isValidPort = (port: number): boolean => {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

// ============================================================================
// 数据处理工具函数
// ============================================================================

// 深拷贝对象
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T
  if (typeof obj === 'object') {
    const clonedObj = {} as T
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key])
      }
    }
    return clonedObj
  }
  return obj
}

// 生成唯一ID
export const generateId = (prefix = ''): string => {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 7)
  return `${prefix}${prefix ? '-' : ''}${timestamp}-${random}`
}

// 安全地获取嵌套对象属性
export const safeGet = (obj: any, path: string, defaultValue: any = undefined): any => {
  const keys = path.split('.')
  let result = obj
  
  for (const key of keys) {
    if (result === null || result === undefined || typeof result !== 'object') {
      return defaultValue
    }
    result = result[key]
  }
  
  return result !== undefined ? result : defaultValue
}

// 过滤对象中的空值
export const filterEmptyValues = (obj: Record<string, any>): Record<string, any> => {
  const filtered: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined && value !== '') {
      filtered[key] = value
    }
  }
  
  return filtered
}

// ============================================================================
// 文件处理工具函数
// ============================================================================

// 下载文件
export const downloadFile = (content: string, filename: string, contentType = 'text/plain'): void => {
  const blob = new Blob([content], { type: contentType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// 读取文件内容
export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = (e) => reject(e)
    reader.readAsText(file)
  })
}

// 获取文件扩展名
export const getFileExtension = (filename: string): string => {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2)
}

// 复制到剪贴板
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.error('复制失败:', error)
    return false
  }
}

// ============================================================================
// 错误处理工具函数
// ============================================================================

// 提取错误消息
export const extractErrorMessage = (error: any): string => {
  if (typeof error === 'string') return error
  if (error?.message) return error.message
  if (error?.response?.data?.message) return error.response.data.message
  if (error?.response?.data?.error) return error.response.data.error
  return '未知错误'
}

// 格式化错误堆栈
export const formatErrorStack = (error: Error): string => {
  if (!error.stack) return error.message
  
  const lines = error.stack.split('\n')
  return lines.slice(0, 5).join('\n') // 只显示前5行
}

// ============================================================================
// 导出验证和转换工具函数
// ============================================================================

// 导出验证工具函数
export * from './validation'

// 导出转换工具函数
export * from './transformation'

// 导出模式验证工具函数
export * from './schema'