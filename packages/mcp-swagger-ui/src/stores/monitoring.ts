import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SystemMetrics, LogEntry, LogFilter, ResourceUsage } from '@/types'
import { monitoringAPI, logsAPI } from '@/services/api'
import { useAppStore } from './app'

export const useMonitoringStore = defineStore('monitoring', () => {
  const appStore = useAppStore()

  // 状态
  const systemMetrics = ref<SystemMetrics | null>(null)
  const serverMetrics = ref<Map<string, SystemMetrics>>(new Map())
  const logs = ref<LogEntry[]>([])
  const logFilter = ref<LogFilter>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  const realTimeEnabled = ref(true)
  const lastUpdate = ref<Date | null>(null)

  // 历史数据（用于图表显示）
  const metricsHistory = ref<Array<SystemMetrics & { timestamp: Date }>>([])
  const maxHistoryLength = 100

  // 计算属性
  const filteredLogs = computed(() => {
    let filtered = logs.value

    if (logFilter.value.level && logFilter.value.level.length > 0) {
      filtered = filtered.filter(log => logFilter.value.level!.includes(log.level))
    }

    if (logFilter.value.serverId) {
      filtered = filtered.filter(log => log.serverId === logFilter.value.serverId)
    }

    if (logFilter.value.searchTerm) {
      const searchTerm = logFilter.value.searchTerm.toLowerCase()
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchTerm) ||
        (log.metadata && JSON.stringify(log.metadata).toLowerCase().includes(searchTerm))
      )
    }

    if (logFilter.value.timeRange) {
      filtered = filtered.filter(log => 
        log.timestamp >= logFilter.value.timeRange!.start &&
        log.timestamp <= logFilter.value.timeRange!.end
      )
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  })

  const errorLogs = computed(() => 
    logs.value.filter(log => log.level === 'error')
  )

  const warningLogs = computed(() => 
    logs.value.filter(log => log.level === 'warn')
  )

  const logStats = computed(() => ({
    total: logs.value.length,
    error: errorLogs.value.length,
    warning: warningLogs.value.length,
    info: logs.value.filter(log => log.level === 'info').length,
    debug: logs.value.filter(log => log.level === 'debug').length
  }))

  const systemHealth = computed(() => {
    if (!systemMetrics.value) return null
    
    const { errorRate, averageResponseTime, resourceUsage } = systemMetrics.value
    
    // 计算健康分数
    let healthScore = 100
    
    // 错误率影响
    if (errorRate > 0.1) healthScore -= 30 // 10%以上错误率
    else if (errorRate > 0.05) healthScore -= 15 // 5%以上错误率
    
    // 响应时间影响
    if (averageResponseTime > 5000) healthScore -= 25 // 5秒以上
    else if (averageResponseTime > 2000) healthScore -= 10 // 2秒以上
    
    // 资源使用影响
    if (resourceUsage.cpu > 90) healthScore -= 20
    else if (resourceUsage.cpu > 70) healthScore -= 10
    
    if (resourceUsage.memory > 90) healthScore -= 20
    else if (resourceUsage.memory > 70) healthScore -= 10
    
    return {
      score: Math.max(0, healthScore),
      status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical'
    }
  })

  // Actions
  const setLoading = (value: boolean) => {
    loading.value = value
  }

  const setError = (errorMessage: string | null) => {
    error.value = errorMessage
    if (errorMessage) {
      appStore.addNotification({
        type: 'error',
        title: '监控数据错误',
        message: errorMessage,
        duration: 5000
      })
    }
  }

  const clearError = () => {
    error.value = null
  }

  // 获取系统指标
  const fetchSystemMetrics = async () => {
    try {
      const response = await monitoringAPI.getMetrics()
      if (response.success && response.data) {
        systemMetrics.value = response.data
        lastUpdate.value = new Date()
        
        // 添加到历史数据
        metricsHistory.value.push({
          ...response.data,
          timestamp: new Date()
        })
        
        // 限制历史数据长度
        if (metricsHistory.value.length > maxHistoryLength) {
          metricsHistory.value = metricsHistory.value.slice(-maxHistoryLength)
        }
        
        clearError()
      } else {
        throw new Error(response.error || '获取系统指标失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取系统指标失败'
      setError(errorMessage)
      console.error('Failed to fetch system metrics:', err)
    }
  }

  // 获取服务器指标
  const fetchServerMetrics = async (serverId: string) => {
    try {
      const response = await monitoringAPI.getServerMetrics(serverId)
      if (response.success && response.data) {
        serverMetrics.value.set(serverId, response.data)
        clearError()
      } else {
        throw new Error(response.error || '获取服务器指标失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取服务器指标失败'
      setError(errorMessage)
      console.error('Failed to fetch server metrics:', err)
    }
  }

  // 获取日志
  const fetchLogs = async (filter?: LogFilter) => {
    setLoading(true)
    try {
      const response = await logsAPI.getLogs(filter)
      if (response.success && response.data) {
        logs.value = response.data
        clearError()
      } else {
        throw new Error(response.error || '获取日志失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取日志失败'
      setError(errorMessage)
      console.error('Failed to fetch logs:', err)
    } finally {
      setLoading(false)
    }
  }

  // 设置日志过滤器
  const setLogFilter = (filter: LogFilter) => {
    logFilter.value = { ...filter }
  }

  // 清除日志过滤器
  const clearLogFilter = () => {
    logFilter.value = {}
  }

  // 添加日志条目（用于WebSocket实时更新）
  const addLogEntry = (entry: LogEntry) => {
    logs.value.unshift(entry)
    
    // 限制日志数量
    const maxLogs = appStore.globalSettings.maxLogEntries
    if (logs.value.length > maxLogs) {
      logs.value = logs.value.slice(0, maxLogs)
    }
    
    // 如果是错误日志，发送通知
    if (entry.level === 'error' && appStore.globalSettings.enableNotifications) {
      appStore.addNotification({
        type: 'error',
        title: '系统错误',
        message: entry.message,
        duration: 5000
      })
    }
  }

  // 批量添加日志条目
  const addLogEntries = (entries: LogEntry[]) => {
    entries.forEach(entry => addLogEntry(entry))
  }

  // 更新系统指标（用于WebSocket实时更新）
  const updateSystemMetrics = (metrics: SystemMetrics) => {
    systemMetrics.value = metrics
    lastUpdate.value = new Date()
    
    // 添加到历史数据
    metricsHistory.value.push({
      ...metrics,
      timestamp: new Date()
    })
    
    // 限制历史数据长度
    if (metricsHistory.value.length > maxHistoryLength) {
      metricsHistory.value = metricsHistory.value.slice(-maxHistoryLength)
    }
  }

  // 更新服务器指标（用于WebSocket实时更新）
  const updateServerMetrics = (serverId: string, metrics: SystemMetrics) => {
    serverMetrics.value.set(serverId, metrics)
  }

  // 导出日志
  const exportLogs = async (filter?: LogFilter): Promise<boolean> => {
    try {
      const response = await logsAPI.exportLogs(filter)
      if (response.success && response.data) {
        // 创建下载链接
        const blob = response.data as Blob
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `logs-${new Date().toISOString().split('T')[0]}.txt`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        
        appStore.addNotification({
          type: 'success',
          title: '日志导出成功',
          message: '日志文件已下载',
          duration: 3000
        })
        
        return true
      } else {
        throw new Error('导出日志失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '导出日志失败'
      setError(errorMessage)
      console.error('Failed to export logs:', err)
      return false
    }
  }

  // 清除日志
  const clearLogs = () => {
    logs.value = []
    appStore.addNotification({
      type: 'info',
      title: '日志已清除',
      message: '所有日志记录已清除',
      duration: 2000
    })
  }

  // 切换实时监控
  const toggleRealTime = (enabled: boolean) => {
    realTimeEnabled.value = enabled
    if (enabled) {
      appStore.addNotification({
        type: 'info',
        title: '实时监控已启用',
        message: '系统将实时更新监控数据',
        duration: 2000
      })
    }
  }

  // 刷新所有监控数据
  const refreshAll = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchSystemMetrics(),
        fetchLogs(logFilter.value)
      ])
      
      appStore.addNotification({
        type: 'success',
        title: '监控数据已刷新',
        message: '所有监控数据已更新',
        duration: 2000
      })
    } catch (err) {
      console.error('Failed to refresh monitoring data:', err)
    } finally {
      setLoading(false)
    }
  }

  // 初始化
  const initialize = async () => {
    await refreshAll()
  }

  return {
    // 状态
    systemMetrics,
    serverMetrics,
    logs,
    logFilter,
    loading,
    error,
    realTimeEnabled,
    lastUpdate,
    metricsHistory,
    
    // 计算属性
    filteredLogs,
    errorLogs,
    warningLogs,
    logStats,
    systemHealth,
    
    // Actions
    setLoading,
    setError,
    clearError,
    fetchSystemMetrics,
    fetchServerMetrics,
    fetchLogs,
    setLogFilter,
    clearLogFilter,
    addLogEntry,
    addLogEntries,
    updateSystemMetrics,
    updateServerMetrics,
    exportLogs,
    clearLogs,
    toggleRealTime,
    refreshAll,
    initialize
  }
})