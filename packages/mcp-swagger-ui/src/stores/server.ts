import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MCPServer, ServerConfig, MCPTool, ServerMetrics } from '@/types'
import { serverAPI } from '@/services/api'
import { useAppStore } from './app'

export const useServerStore = defineStore('server', () => {
  const appStore = useAppStore()

  // 状态
  const servers = ref<MCPServer[]>([])
  const selectedServerId = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const selectedServer = computed(() => 
    servers.value.find(s => s.id === selectedServerId.value) || null
  )

  const runningServers = computed(() => 
    servers.value.filter(s => s.status === 'running')
  )

  const stoppedServers = computed(() => 
    servers.value.filter(s => s.status === 'stopped')
  )

  const errorServers = computed(() => 
    servers.value.filter(s => s.status === 'error')
  )

  const totalServers = computed(() => servers.value.length)

  const serversByStatus = computed(() => ({
    running: runningServers.value.length,
    stopped: stoppedServers.value.length,
    error: errorServers.value.length,
    total: totalServers.value
  }))

  // Actions
  const setLoading = (value: boolean) => {
    loading.value = value
  }

  const setError = (errorMessage: string | null) => {
    error.value = errorMessage
    if (errorMessage) {
      appStore.addNotification({
        type: 'error',
        title: '服务器操作错误',
        message: errorMessage,
        duration: 5000
      })
    }
  }

  const clearError = () => {
    error.value = null
  }

  // 获取所有服务器
  const fetchServers = async () => {
    setLoading(true)
    try {
      const response = await serverAPI.getServers()
      if (response.success && response.data) {
        servers.value = response.data
        clearError()
      } else {
        throw new Error(response.error || '获取服务器列表失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取服务器列表失败'
      setError(errorMessage)
      console.error('Failed to fetch servers:', err)
    } finally {
      setLoading(false)
    }
  }

  // 创建服务器
  const createServer = async (config: ServerConfig): Promise<boolean> => {
    setLoading(true)
    try {
      const response = await serverAPI.createServer(config)
      if (response.success && response.data) {
        servers.value.push(response.data)
        appStore.addNotification({
          type: 'success',
          title: '服务器创建成功',
          message: `服务器 "${config.name}" 已成功创建`,
          duration: 3000
        })
        clearError()
        return true
      } else {
        throw new Error(response.error || '创建服务器失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '创建服务器失败'
      setError(errorMessage)
      console.error('Failed to create server:', err)
      return false
    } finally {
      setLoading(false)
    }
  }

  // 更新服务器
  const updateServer = async (id: string, config: Partial<ServerConfig>): Promise<boolean> => {
    setLoading(true)
    try {
      const response = await serverAPI.updateServer(id, config)
      if (response.success && response.data) {
        const index = servers.value.findIndex(s => s.id === id)
        if (index > -1) {
          servers.value[index] = response.data
        }
        appStore.addNotification({
          type: 'success',
          title: '服务器更新成功',
          message: `服务器配置已更新`,
          duration: 3000
        })
        clearError()
        return true
      } else {
        throw new Error(response.error || '更新服务器失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '更新服务器失败'
      setError(errorMessage)
      console.error('Failed to update server:', err)
      return false
    } finally {
      setLoading(false)
    }
  }

  // 删除服务器
  const deleteServer = async (id: string): Promise<boolean> => {
    setLoading(true)
    try {
      const response = await serverAPI.deleteServer(id)
      if (response.success) {
        const index = servers.value.findIndex(s => s.id === id)
        if (index > -1) {
          const serverName = servers.value[index].name
          servers.value.splice(index, 1)
          
          // 如果删除的是当前选中的服务器，清除选择
          if (selectedServerId.value === id) {
            selectedServerId.value = null
          }
          
          appStore.addNotification({
            type: 'success',
            title: '服务器删除成功',
            message: `服务器 "${serverName}" 已删除`,
            duration: 3000
          })
        }
        clearError()
        return true
      } else {
        throw new Error(response.error || '删除服务器失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除服务器失败'
      setError(errorMessage)
      console.error('Failed to delete server:', err)
      return false
    } finally {
      setLoading(false)
    }
  }

  // 启动/停止服务器
  const toggleServer = async (id: string, enabled: boolean): Promise<boolean> => {
    setLoading(true)
    try {
      const response = await serverAPI.toggleServer(id, enabled)
      if (response.success && response.data) {
        const index = servers.value.findIndex(s => s.id === id)
        if (index > -1) {
          servers.value[index] = response.data
        }
        
        const action = enabled ? '启动' : '停止'
        appStore.addNotification({
          type: 'success',
          title: `服务器${action}成功`,
          message: `服务器已${action}`,
          duration: 3000
        })
        clearError()
        return true
      } else {
        throw new Error(response.error || `${enabled ? '启动' : '停止'}服务器失败`)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `${enabled ? '启动' : '停止'}服务器失败`
      setError(errorMessage)
      console.error('Failed to toggle server:', err)
      return false
    } finally {
      setLoading(false)
    }
  }

  // 获取服务器详情
  const fetchServerDetails = async (id: string): Promise<MCPServer | null> => {
    try {
      const response = await serverAPI.getServerDetails(id)
      if (response.success && response.data) {
        // 更新本地服务器数据
        const index = servers.value.findIndex(s => s.id === id)
        if (index > -1) {
          servers.value[index] = response.data
        }
        return response.data
      } else {
        throw new Error(response.error || '获取服务器详情失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取服务器详情失败'
      setError(errorMessage)
      console.error('Failed to fetch server details:', err)
      return null
    }
  }

  // 启动服务器
  const startServer = async (id: string): Promise<boolean> => {
    return await toggleServer(id, true)
  }

  // 停止服务器
  const stopServer = async (id: string): Promise<boolean> => {
    return await toggleServer(id, false)
  }

  // 重启服务器
  const restartServer = async (id: string): Promise<boolean> => {
    // 先停止，再启动
    const stopResult = await stopServer(id)
    if (stopResult) {
      // 等待一小段时间确保服务器完全停止
      await new Promise(resolve => setTimeout(resolve, 1000))
      return await startServer(id)
    }
    return false
  }

  // 选择服务器
  const selectServer = (id: string | null) => {
    selectedServerId.value = id
  }

  // 更新服务器状态（用于WebSocket实时更新）
  const updateServerStatus = (id: string, status: MCPServer['status'], lastError?: string) => {
    const server = servers.value.find(s => s.id === id)
    if (server) {
      server.status = status
      server.updatedAt = new Date()
      if (lastError !== undefined) {
        server.lastError = lastError
      }
    }
  }

  // 更新服务器指标（用于WebSocket实时更新）
  const updateServerMetrics = (id: string, metrics: Partial<ServerMetrics>) => {
    const server = servers.value.find(s => s.id === id)
    if (server) {
      server.metrics = { ...server.metrics, ...metrics }
      server.updatedAt = new Date()
    }
  }

  // 批量更新服务器状态
  const batchUpdateServers = (updates: Array<{ id: string; status?: MCPServer['status']; metrics?: Partial<ServerMetrics> }>) => {
    updates.forEach(update => {
      const server = servers.value.find(s => s.id === update.id)
      if (server) {
        if (update.status) {
          server.status = update.status
        }
        if (update.metrics) {
          server.metrics = { ...server.metrics, ...update.metrics }
        }
        server.updatedAt = new Date()
      }
    })
  }

  // 初始化
  const initialize = async () => {
    await fetchServers()
  }

  return {
    // 状态
    servers,
    selectedServerId,
    loading,
    error,
    
    // 计算属性
    selectedServer,
    runningServers,
    stoppedServers,
    errorServers,
    totalServers,
    serversByStatus,
    
    // Actions
    setLoading,
    setError,
    clearError,
    fetchServers,
    createServer,
    updateServer,
    deleteServer,
    toggleServer,
    startServer,
    stopServer,
    restartServer,
    fetchServerDetails,
    selectServer,
    updateServerStatus,
    updateServerMetrics,
    batchUpdateServers,
    initialize
  }
})