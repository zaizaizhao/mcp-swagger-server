import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { 
  DetailedSystemMetrics, 
  PerformanceAlert, 
  MonitoringConfig, 
  ChartSeries
} from '@/types'

// 日志相关类型定义
interface LogEntry {
  id: string
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  source?: string
  data?: any
}

interface LogFilter {
  level?: string
  source?: string
  search?: string
  startTime?: Date
  endTime?: Date
}

interface LogStats {
  total: number
  info: number
  warn: number
  error: number
  debug: number
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  uptime: number
  lastCheck: Date
  issues: string[]
}

export const useMonitoringStore = defineStore('monitoring', () => {
  // 状态
  const metrics = ref<DetailedSystemMetrics[]>([])
  const currentMetrics = ref<DetailedSystemMetrics | null>(null)
  const alerts = ref<PerformanceAlert[]>([])
  const config = ref<MonitoringConfig>({
    refreshInterval: 5000, // 5秒
    alerts: {
      cpu: { warning: 70, critical: 90 },
      memory: { warning: 80, critical: 95 },
      disk: { warning: 85, critical: 95 },
      network: { warning: 1000000, critical: 10000000 } // bytes/sec
    },
    enableAlerts: true,
    enableSound: false
  })
  const isConnected = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  
  // 新增状态
  const systemMetrics = ref<DetailedSystemMetrics | null>(null)
  const serverMetrics = ref<any>(null)
  const systemHealth = ref<SystemHealth>({
    status: 'unknown',
    uptime: 0,
    lastCheck: new Date(),
    issues: []
  })
  const metricsHistory = ref<DetailedSystemMetrics[]>([])
  const logs = ref<LogEntry[]>([])
  const logFilter = ref<LogFilter>({})
  const realTimeEnabled = ref(true)
  const lastUpdate = ref<Date>(new Date())
  const loading = ref(false)
  const isMonitoring = ref(false)

  // 计算属性
  const cpuSeries = computed<ChartSeries>(() => ({
    name: 'CPU使用率',
    data: metrics.value.slice(-50).map(m => ({
      timestamp: m.timestamp,
      value: m.cpu.usage
    })),
    color: '#409EFF'
  }))

  const memorySeries = computed<ChartSeries>(() => ({
    name: '内存使用率',
    data: metrics.value.slice(-50).map(m => ({
      timestamp: m.timestamp,
      value: m.memory.usage
    })),
    color: '#67C23A'
  }))

  const networkInSeries = computed<ChartSeries>(() => ({
    name: '网络入流量',
    data: metrics.value.slice(-50).map(m => ({
      timestamp: m.timestamp,
      value: m.network.bytesIn
    })),
    color: '#E6A23C'
  }))

  const networkOutSeries = computed<ChartSeries>(() => ({
    name: '网络出流量',
    data: metrics.value.slice(-50).map(m => ({
      timestamp: m.timestamp,
      value: m.network.bytesOut
    })),
    color: '#F56C6C'
  }))

  const diskSeries = computed<ChartSeries>(() => ({
    name: '磁盘使用率',
    data: metrics.value.slice(-50).map(m => ({
      timestamp: m.timestamp,
      value: m.disk.usage
    })),
    color: '#909399'
  }))

  const activeAlerts = computed(() => 
    alerts.value.filter(alert => !alert.acknowledged)
  )

  const criticalAlerts = computed(() => 
    activeAlerts.value.filter(alert => alert.level === 'critical')
  )

  const warningAlerts = computed(() => 
    activeAlerts.value.filter(alert => alert.level === 'warning')
  )

  const systemStatus = computed(() => {
    if (!currentMetrics.value) return 'unknown'
    
    const cpu = currentMetrics.value.cpu.usage
    const memory = currentMetrics.value.memory.usage
    const disk = currentMetrics.value.disk.usage
    
    if (cpu >= config.value.alerts.cpu.critical ||
        memory >= config.value.alerts.memory.critical ||
        disk >= config.value.alerts.disk.critical) {
      return 'critical'
    }
    
    if (cpu >= config.value.alerts.cpu.warning ||
        memory >= config.value.alerts.memory.warning ||
        disk >= config.value.alerts.disk.warning) {
      return 'warning'
    }
    
    return 'healthy'
  })

  // 新增计算属性
  const filteredLogs = computed(() => {
    let filtered = logs.value
    
    if (logFilter.value.level) {
      filtered = filtered.filter(log => log.level === logFilter.value.level)
    }
    
    if (logFilter.value.source) {
      filtered = filtered.filter(log => log.source === logFilter.value.source)
    }
    
    if (logFilter.value.search) {
      const search = logFilter.value.search.toLowerCase()
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(search)
      )
    }
    
    if (logFilter.value.startTime) {
      filtered = filtered.filter(log => log.timestamp >= logFilter.value.startTime!)
    }
    
    if (logFilter.value.endTime) {
      filtered = filtered.filter(log => log.timestamp <= logFilter.value.endTime!)
    }
    
    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  })

  const logStats = computed<LogStats>(() => {
    const stats = {
      total: logs.value.length,
      info: 0,
      warn: 0,
      error: 0,
      debug: 0
    }
    
    logs.value.forEach(log => {
      stats[log.level]++
    })
    
    return stats
  })

  // WebSocket连接
  let ws: WebSocket | null = null
  let reconnectTimer: NodeJS.Timeout | null = null

  // 方法
  const connectWebSocket = () => {
    try {
      // 假设WebSocket端点，实际项目中应该从配置获取
      ws = new WebSocket('ws://localhost:3001/ws/monitoring')
      
      ws.onopen = () => {
        isConnected.value = true
        error.value = null
        console.log('Monitoring WebSocket connected')
      }
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'metrics') {
            updateMetrics(data.payload)
          } else if (data.type === 'alert') {
            addAlert(data.payload)
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }
      
      ws.onclose = () => {
        isConnected.value = false
        console.log('Monitoring WebSocket disconnected')
        // 尝试重连
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null
            connectWebSocket()
          }, 5000)
        }
      }
      
      ws.onerror = (err) => {
        error.value = 'WebSocket连接错误'
        console.error('Monitoring WebSocket error:', err)
      }
    } catch (err) {
      error.value = 'WebSocket连接失败'
      console.error('Failed to connect WebSocket:', err)
    }
  }

  const disconnectWebSocket = () => {
    if (ws) {
      ws.close()
      ws = null
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    isConnected.value = false
  }

  const updateMetrics = (newMetrics: DetailedSystemMetrics) => {
    currentMetrics.value = newMetrics
    metrics.value.push(newMetrics)
    
    // 保持最近1000个数据点
    if (metrics.value.length > 1000) {
      metrics.value = metrics.value.slice(-1000)
    }
    
    // 检查告警
    checkAlerts(newMetrics)
  }

  const checkAlerts = (metrics: DetailedSystemMetrics) => {
    if (!config.value.enableAlerts) return
    
    const now = new Date()
    
    // CPU告警
    if (metrics.cpu.usage >= config.value.alerts.cpu.critical) {
      addAlert({
        id: `cpu-critical-${now.getTime()}`,
        type: 'cpu',
        level: 'critical',
        message: `CPU使用率过高: ${metrics.cpu.usage.toFixed(1)}%`,
        value: metrics.cpu.usage,
        threshold: config.value.alerts.cpu.critical,
        timestamp: now,
        acknowledged: false
      })
    } else if (metrics.cpu.usage >= config.value.alerts.cpu.warning) {
      addAlert({
        id: `cpu-warning-${now.getTime()}`,
        type: 'cpu',
        level: 'warning',
        message: `CPU使用率较高: ${metrics.cpu.usage.toFixed(1)}%`,
        value: metrics.cpu.usage,
        threshold: config.value.alerts.cpu.warning,
        timestamp: now,
        acknowledged: false
      })
    }
    
    // 内存告警
    if (metrics.memory.usage >= config.value.alerts.memory.critical) {
      addAlert({
        id: `memory-critical-${now.getTime()}`,
        type: 'memory',
        level: 'critical',
        message: `内存使用率过高: ${metrics.memory.usage.toFixed(1)}%`,
        value: metrics.memory.usage,
        threshold: config.value.alerts.memory.critical,
        timestamp: now,
        acknowledged: false
      })
    } else if (metrics.memory.usage >= config.value.alerts.memory.warning) {
      addAlert({
        id: `memory-warning-${now.getTime()}`,
        type: 'memory',
        level: 'warning',
        message: `内存使用率较高: ${metrics.memory.usage.toFixed(1)}%`,
        value: metrics.memory.usage,
        threshold: config.value.alerts.memory.warning,
        timestamp: now,
        acknowledged: false
      })
    }
    
    // 磁盘告警
    if (metrics.disk.usage >= config.value.alerts.disk.critical) {
      addAlert({
        id: `disk-critical-${now.getTime()}`,
        type: 'disk',
        level: 'critical',
        message: `磁盘使用率过高: ${metrics.disk.usage.toFixed(1)}%`,
        value: metrics.disk.usage,
        threshold: config.value.alerts.disk.critical,
        timestamp: now,
        acknowledged: false
      })
    } else if (metrics.disk.usage >= config.value.alerts.disk.warning) {
      addAlert({
        id: `disk-warning-${now.getTime()}`,
        type: 'disk',
        level: 'warning',
        message: `磁盘使用率较高: ${metrics.disk.usage.toFixed(1)}%`,
        value: metrics.disk.usage,
        threshold: config.value.alerts.disk.warning,
        timestamp: now,
        acknowledged: false
      })
    }
  }

  const addAlert = (alert: PerformanceAlert) => {
    alerts.value.unshift(alert)
    
    // 保持最近100个告警
    if (alerts.value.length > 100) {
      alerts.value = alerts.value.slice(0, 100)
    }
  }

  const acknowledgeAlert = (alertId: string) => {
    const alert = alerts.value.find(a => a.id === alertId)
    if (alert) {
      alert.acknowledged = true
    }
  }

  const clearAcknowledgedAlerts = () => {
    alerts.value = alerts.value.filter(alert => !alert.acknowledged)
  }

  const dismissAlert = (alertId: string) => {
    const index = alerts.value.findIndex(a => a.id === alertId)
    if (index !== -1) {
      alerts.value.splice(index, 1)
    }
  }

  const refreshMetrics = async () => {
    isLoading.value = true
    try {
      // 模拟刷新数据
      const mockMetrics = generateMockMetrics()
      mockMetrics.memory.free = mockMetrics.memory.total - mockMetrics.memory.used
      mockMetrics.memory.usage = (mockMetrics.memory.used / mockMetrics.memory.total) * 100
      mockMetrics.disk.free = mockMetrics.disk.total - mockMetrics.disk.used
      mockMetrics.disk.usage = (mockMetrics.disk.used / mockMetrics.disk.total) * 100
      
      updateMetrics(mockMetrics)
    } finally {
      isLoading.value = false
    }
  }

  const startMonitoring = (interval?: number) => {
    if (interval) {
      config.value.refreshInterval = interval
    }
    isConnected.value = true
    return startMockData()
  }

  const stopMonitoring = () => {
    isConnected.value = false
    // 实际应用中这里会清除定时器
  }

  const updateConfig = (newConfig: Partial<MonitoringConfig>) => {
    config.value = { ...config.value, ...newConfig }
  }

  // 新增方法
  const fetchSystemMetrics = async () => {
    loading.value = true
    try {
      // 模拟获取系统指标
      const mockMetrics = generateMockMetrics()
      mockMetrics.memory.free = mockMetrics.memory.total - mockMetrics.memory.used
      mockMetrics.memory.usage = (mockMetrics.memory.used / mockMetrics.memory.total) * 100
      mockMetrics.disk.free = mockMetrics.disk.total - mockMetrics.disk.used
      mockMetrics.disk.usage = (mockMetrics.disk.used / mockMetrics.disk.total) * 100
      
      systemMetrics.value = mockMetrics
      metricsHistory.value.push(mockMetrics)
      
      // 保持最近1000个数据点
      if (metricsHistory.value.length > 1000) {
        metricsHistory.value = metricsHistory.value.slice(-1000)
      }
      
      lastUpdate.value = new Date()
      
      // 更新系统健康状态
      systemHealth.value = {
        status: systemStatus.value as any,
        uptime: Math.floor(Date.now() / 1000) - 86400,
        lastCheck: new Date(),
        issues: criticalAlerts.value.map(alert => alert.message)
      }
    } finally {
      loading.value = false
    }
  }

  const fetchServerMetrics = async () => {
    loading.value = true
    try {
      // 模拟获取服务器指标
      serverMetrics.value = {
        requests: Math.floor(Math.random() * 1000),
        responses: Math.floor(Math.random() * 1000),
        errors: Math.floor(Math.random() * 10),
        avgResponseTime: Math.random() * 100,
        activeConnections: Math.floor(Math.random() * 50)
      }
      lastUpdate.value = new Date()
    } finally {
      loading.value = false
    }
  }

  const fetchLogs = async (options?: { limit?: number; level?: string }) => {
    loading.value = true
    try {
      // 模拟获取日志
      const mockLogs: LogEntry[] = []
      const levels: LogEntry['level'][] = ['info', 'warn', 'error', 'debug']
      const sources = ['system', 'api', 'database', 'auth']
      
      for (let i = 0; i < (options?.limit || 50); i++) {
        const level = options?.level as LogEntry['level'] || levels[Math.floor(Math.random() * levels.length)]
        mockLogs.push({
          id: `log-${Date.now()}-${i}`,
          timestamp: new Date(Date.now() - Math.random() * 86400000),
          level,
          message: `Sample ${level} message ${i + 1}`,
          source: sources[Math.floor(Math.random() * sources.length)],
          data: level === 'error' ? { stack: 'Error stack trace...' } : undefined
        })
      }
      
      logs.value = [...mockLogs, ...logs.value].slice(0, 1000)
      lastUpdate.value = new Date()
    } finally {
      loading.value = false
    }
  }

  const setLogFilter = (filter: Partial<LogFilter>) => {
    logFilter.value = { ...logFilter.value, ...filter }
  }

  const clearLogFilter = () => {
    logFilter.value = {}
  }

  const exportLogs = async (format: 'json' | 'csv' = 'json') => {
    const logsToExport = filteredLogs.value
    
    if (format === 'json') {
      const dataStr = JSON.stringify(logsToExport, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `logs-${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(url)
    } else {
      const csvHeader = 'Timestamp,Level,Source,Message\n'
      const csvContent = logsToExport.map(log => 
        `${log.timestamp.toISOString()},${log.level},${log.source || ''},"${log.message.replace(/"/g, '""')}"`
      ).join('\n')
      
      const dataBlob = new Blob([csvHeader + csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `logs-${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      URL.revokeObjectURL(url)
    }
  }

  const clearLogs = () => {
    logs.value = []
  }

  const toggleRealTime = () => {
    realTimeEnabled.value = !realTimeEnabled.value
  }

  const refreshAll = async () => {
    await Promise.all([
      fetchSystemMetrics(),
      fetchServerMetrics(),
      fetchLogs({ limit: 20 })
    ])
  }

  const updateServerMetrics = (serverId: string, metrics: any) => {
    // Update server-specific metrics
    if (serverMetrics.value[serverId]) {
      serverMetrics.value[serverId] = { ...serverMetrics.value[serverId], ...metrics }
    } else {
      serverMetrics.value[serverId] = metrics
    }
    lastUpdate.value = new Date()
  }

  const addLogEntry = (entry: LogEntry) => {
    logs.value.unshift(entry)
    // Keep only the latest 1000 logs
    if (logs.value.length > 1000) {
      logs.value = logs.value.slice(0, 1000)
    }
  }

  const addLogEntries = (entries: LogEntry[]) => {
      logs.value.unshift(...entries)
      // Keep only the latest 1000 logs
      if (logs.value.length > 1000) {
        logs.value = logs.value.slice(0, 1000)
      }
    }

    const updateSystemMetrics = (metrics: any) => {
      systemMetrics.value = { ...systemMetrics.value, ...metrics }
      lastUpdate.value = new Date()
    }

  // 模拟数据生成器（用于演示）
  const generateMockMetrics = (): DetailedSystemMetrics => {
    const now = new Date()
    const baseLoad = 0.3 + Math.sin(now.getTime() / 60000) * 0.2
    
    return {
      timestamp: now,
      cpu: {
        usage: Math.max(0, Math.min(100, baseLoad * 100 + (Math.random() - 0.5) * 30)),
        cores: 8,
        temperature: 45 + Math.random() * 20,
        frequency: 2400 + Math.random() * 800 // 2.4-3.2 GHz
      },
      memory: {
        total: 16 * 1024 * 1024 * 1024, // 16GB
        used: baseLoad * 16 * 1024 * 1024 * 1024 + Math.random() * 2 * 1024 * 1024 * 1024,
        free: 0,
        usage: 0
      },
      network: {
        bytesIn: Math.random() * 1000000,
        bytesOut: Math.random() * 1000000,
        packetsIn: Math.random() * 1000,
        packetsOut: Math.random() * 1000,
        connections: Math.floor(Math.random() * 100)
      },
      disk: {
        total: 500 * 1024 * 1024 * 1024, // 500GB
        used: baseLoad * 400 * 1024 * 1024 * 1024,
        free: 0,
        usage: 0,
        readOps: Math.random() * 100,
        writeOps: Math.random() * 50
      },
      process: {
        pid: 1234,
        uptime: Math.floor(Date.now() / 1000) - 86400, // 1天前启动
        memory: baseLoad * 1024 * 1024 * 1024,
        cpu: baseLoad * 100
      }
    }
  }

  const startMockData = () => {
    const interval = setInterval(() => {
      const mockMetrics = generateMockMetrics()
      
      // 计算派生值
      mockMetrics.memory.free = mockMetrics.memory.total - mockMetrics.memory.used
      mockMetrics.memory.usage = (mockMetrics.memory.used / mockMetrics.memory.total) * 100
      mockMetrics.disk.free = mockMetrics.disk.total - mockMetrics.disk.used
      mockMetrics.disk.usage = (mockMetrics.disk.used / mockMetrics.disk.total) * 100
      
      updateMetrics(mockMetrics)
    }, config.value.refreshInterval)
    
    return () => clearInterval(interval)
  }

  return {
    // 状态
    metrics,
    currentMetrics,
    alerts,
    config,
    isConnected,
    isLoading,
    error,
    systemMetrics,
    serverMetrics,
    systemHealth,
    metricsHistory,
    logs,
    logFilter,
    realTimeEnabled,
      lastUpdate,
      loading,
      isMonitoring,
    
    // 计算属性
    cpuSeries,
    memorySeries,
    networkInSeries,
    networkOutSeries,
    diskSeries,
    activeAlerts,
    criticalAlerts,
    warningAlerts,
    systemStatus,
    filteredLogs,
    logStats,
    
    // 方法
    connectWebSocket,
    disconnectWebSocket,
    updateMetrics,
    addAlert,
    acknowledgeAlert,
    clearAcknowledgedAlerts,
    dismissAlert,
    refreshMetrics,
    startMonitoring,
    stopMonitoring,
    updateConfig,
    startMockData,
    fetchSystemMetrics,
    fetchServerMetrics,
    fetchLogs,
    setLogFilter,
    clearLogFilter,
    exportLogs,
    clearLogs,
    toggleRealTime,
    refreshAll,
      updateServerMetrics,
      updateSystemMetrics,
      addLogEntry,
      addLogEntries
    }
})
