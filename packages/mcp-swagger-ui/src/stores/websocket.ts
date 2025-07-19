import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { websocketService, type WebSocketEvents } from '@/services/websocket'
import { useAppStore } from './app'
import { useServerStore } from './server'
import { useMonitoringStore } from './monitoring'

export const useWebSocketStore = defineStore('websocket', () => {
  const appStore = useAppStore()

  // 状态
  const connected = ref(false)
  const connecting = ref(false)
  const reconnectAttempts = ref(0)
  const lastError = ref<string | null>(null)
  const subscriptions = ref<Set<string>>(new Set())

  // 计算属性
  const connectionStatus = computed(() => {
    if (connecting.value) return 'connecting'
    if (connected.value) return 'connected'
    return 'disconnected'
  })

  const connectionInfo = computed(() => ({
    status: connectionStatus.value,
    connected: connected.value,
    reconnectAttempts: reconnectAttempts.value,
    lastError: lastError.value,
    subscriptions: Array.from(subscriptions.value)
  }))

  // Actions
  const setConnected = (value: boolean) => {
    connected.value = value
  }

  const setConnecting = (value: boolean) => {
    connecting.value = value
  }

  const setReconnectAttempts = (value: number) => {
    reconnectAttempts.value = value
  }

  const setLastError = (error: string | null) => {
    lastError.value = error
  }

  // 连接WebSocket
  const connect = async (): Promise<boolean> => {
    if (connected.value || connecting.value) {
      return connected.value
    }

    setConnecting(true)
    setLastError(null)

    try {
      await websocketService.connect()
      setConnected(true)
      setConnecting(false)
      
      appStore.addNotification({
        type: 'success',
        title: 'WebSocket连接成功',
        message: '实时数据更新已启用',
        duration: 3000
      })

      // 设置默认订阅
      await setupDefaultSubscriptions()
      
      return true
    } catch (error) {
      setConnecting(false)
      const errorMessage = error instanceof Error ? error.message : 'WebSocket连接失败'
      setLastError(errorMessage)
      
      appStore.addNotification({
        type: 'error',
        title: 'WebSocket连接失败',
        message: errorMessage,
        duration: 5000
      })
      
      return false
    }
  }

  // 断开连接
  const disconnect = () => {
    websocketService.disconnect()
    setConnected(false)
    setConnecting(false)
    subscriptions.value.clear()
    
    appStore.addNotification({
      type: 'info',
      title: 'WebSocket已断开',
      message: '实时数据更新已停用',
      duration: 3000
    })
  }

  // 设置默认订阅
  const setupDefaultSubscriptions = async () => {
    // 订阅系统指标
    subscribeToMetrics()
    
    // 订阅日志
    subscribeToLogs()
    
    // 如果有选中的服务器，订阅其更新
    const serverStore = useServerStore()
    if (serverStore.selectedServerId) {
      subscribeToServer(serverStore.selectedServerId)
    }
  }

  // 订阅系统指标
  const subscribeToMetrics = () => {
    if (!connected.value) return
    
    websocketService.subscribeToMetrics()
    subscriptions.value.add('metrics')
  }

  // 取消订阅系统指标
  const unsubscribeFromMetrics = () => {
    if (!connected.value) return
    
    websocketService.unsubscribeFromMetrics()
    subscriptions.value.delete('metrics')
  }

  // 订阅服务器更新
  const subscribeToServer = (serverId: string) => {
    if (!connected.value) return
    
    websocketService.subscribeToServer(serverId)
    subscriptions.value.add(`server:${serverId}`)
  }

  // 取消订阅服务器更新
  const unsubscribeFromServer = (serverId: string) => {
    if (!connected.value) return
    
    websocketService.unsubscribeFromServer(serverId)
    subscriptions.value.delete(`server:${serverId}`)
  }

  // 订阅日志
  const subscribeToLogs = (filter?: { level?: string[]; serverId?: string }) => {
    if (!connected.value) return
    
    websocketService.subscribeToLogs(filter)
    subscriptions.value.add('logs')
  }

  // 取消订阅日志
  const unsubscribeFromLogs = () => {
    if (!connected.value) return
    
    websocketService.unsubscribeFromLogs()
    subscriptions.value.delete('logs')
  }

  // 设置事件监听器
  const setupEventListeners = () => {
    const serverStore = useServerStore()
    const monitoringStore = useMonitoringStore()

    // 连接状态事件
    websocketService.on('connect', () => {
      setConnected(true)
      setConnecting(false)
      setReconnectAttempts(0)
      setLastError(null)
    })

    websocketService.on('disconnect', () => {
      setConnected(false)
      setConnecting(false)
    })

    websocketService.on('reconnect', () => {
      setConnected(true)
      setConnecting(false)
      setReconnectAttempts(0)
      
      appStore.addNotification({
        type: 'success',
        title: 'WebSocket重连成功',
        message: '实时数据更新已恢复',
        duration: 3000
      })
      
      // 重新设置订阅
      setupDefaultSubscriptions()
    })

    websocketService.on('connect_error', (error) => {
      setConnecting(false)
      const errorMessage = error.message || 'WebSocket连接错误'
      setLastError(errorMessage)
      
      const info = websocketService.getConnectionInfo()
      setReconnectAttempts(info.reconnectAttempts)
    })

    // 系统指标事件
    websocketService.on('metrics:system', (metrics) => {
      monitoringStore.updateSystemMetrics(metrics)
    })

    websocketService.on('metrics:server', (data) => {
      monitoringStore.updateServerMetrics(data.serverId, data.metrics)
      serverStore.updateServerMetrics(data.serverId, {
        totalRequests: data.metrics.totalRequests,
        averageResponseTime: data.metrics.averageResponseTime
      })
    })

    // 服务器状态事件
    websocketService.on('server:status', (data) => {
      serverStore.updateServerStatus(data.serverId, data.status, data.error)
      
      if (data.status === 'error' && data.error) {
        appStore.addNotification({
          type: 'error',
          title: '服务器错误',
          message: `服务器 ${data.serverId} 发生错误: ${data.error}`,
          duration: 5000
        })
      }
    })

    websocketService.on('server:created', (server) => {
      // 刷新服务器列表
      serverStore.fetchServers()
      
      appStore.addNotification({
        type: 'success',
        title: '服务器已创建',
        message: `服务器 "${server.name}" 已创建`,
        duration: 3000
      })
    })

    websocketService.on('server:updated', (server) => {
      // 更新本地服务器数据
      const index = serverStore.servers.findIndex(s => s.id === server.id)
      if (index > -1) {
        serverStore.servers[index] = server
      }
      
      appStore.addNotification({
        type: 'info',
        title: '服务器已更新',
        message: `服务器 "${server.name}" 配置已更新`,
        duration: 3000
      })
    })

    websocketService.on('server:deleted', (serverId) => {
      // 从本地列表中移除
      const index = serverStore.servers.findIndex(s => s.id === serverId)
      if (index > -1) {
        const serverName = serverStore.servers[index].name
        serverStore.servers.splice(index, 1)
        
        appStore.addNotification({
          type: 'warning',
          title: '服务器已删除',
          message: `服务器 "${serverName}" 已被删除`,
          duration: 3000
        })
      }
      
      // 取消订阅
      unsubscribeFromServer(serverId)
    })

    // 日志事件
    websocketService.on('logs:new', (entry) => {
      monitoringStore.addLogEntry(entry)
    })

    websocketService.on('logs:batch', (entries) => {
      monitoringStore.addLogEntries(entries)
    })
  }

  // 重连
  const reconnect = async (): Promise<boolean> => {
    if (connecting.value) return false
    
    disconnect()
    await new Promise(resolve => setTimeout(resolve, 1000)) // 等待1秒
    return await connect()
  }

  // 获取连接统计信息
  const getConnectionStats = () => {
    const info = websocketService.getConnectionInfo()
    return {
      ...info,
      subscriptions: Array.from(subscriptions.value)
    }
  }

  // 初始化
  const initialize = async () => {
    setupEventListeners()
    
    // 如果全局设置启用了自动连接，则自动连接
    if (appStore.globalSettings.autoRefresh) {
      await connect()
    }
  }

  return {
    // 状态
    connected,
    connecting,
    reconnectAttempts,
    lastError,
    subscriptions,
    
    // 计算属性
    connectionStatus,
    connectionInfo,
    
    // Actions
    connect,
    disconnect,
    reconnect,
    subscribeToMetrics,
    unsubscribeFromMetrics,
    subscribeToServer,
    unsubscribeFromServer,
    subscribeToLogs,
    unsubscribeFromLogs,
    getConnectionStats,
    initialize
  }
})