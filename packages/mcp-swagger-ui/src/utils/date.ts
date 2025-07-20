/**
 * 格式化日期 - 简化版本
 */
export const formatDate = (date: string | Date, pattern: string = 'yyyy-MM-dd HH:mm'): string => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    
    // 简单格式化，不依赖date-fns
    const year = dateObj.getFullYear()
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const day = String(dateObj.getDate()).padStart(2, '0')
    const hours = String(dateObj.getHours()).padStart(2, '0')
    const minutes = String(dateObj.getMinutes()).padStart(2, '0')
    
    if (pattern === 'yyyy-MM-dd HH:mm') {
      return `${year}-${month}-${day} ${hours}:${minutes}`
    }
    
    return `${year}-${month}-${day}`
  } catch (error) {
    console.warn('Date formatting error:', error)
    return typeof date === 'string' ? date : String(date)
  }
}

/**
 * 格式化相对时间
 */
export const formatRelativeTime = (date: string | Date): string => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    const now = new Date()
    const diffInMs = now.getTime() - dateObj.getTime()
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInMinutes < 1) return '刚刚'
    if (diffInMinutes < 60) return `${diffInMinutes}分钟前`
    if (diffInHours < 24) return `${diffInHours}小时前`
    if (diffInDays < 7) return `${diffInDays}天前`
    
    return formatDate(dateObj, 'MM-dd HH:mm')
  } catch (error) {
    console.warn('Relative time formatting error:', error)
    return formatDate(date)
  }
}

/**
 * 格式化文件大小
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * 格式化持续时间
 */
export const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return `${hours}h ${minutes}m`
}
