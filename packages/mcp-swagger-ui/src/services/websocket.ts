import { io, type Socket } from 'socket.io-client'
import type { SystemMetrics, LogEntry, MCPServer } from '@/types'

export interface WebSocketEvents {
  // 系统指标更新
  'metrics:system': (metrics: SystemMetrics) => void
  'metrics:server': (data: { serverId: string; metrics: SystemMetrics }) => void
  
  // 服务器状态更新
  'server:status': (data: { serverId: string; status: MCPServer['status']; error?: string }) => void
  'server:created': (server: MCPServer) => void
  'server:updated': (server: MCPServer) => void
  'server:deleted': (serverId: string) => void
  
  // 日志更新
  'logs:new': (entry: LogEntry) => void
  'logs:batch': (entries: LogEntry[]) => void
  
  // 连接状态
  'connect': () => void
  'disconnect': () => void
  'reconnect': () => void
  'connect_error': (error: Error) => void
}

export class WebSocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private isConnecting = false
  private eventHandlers = new Map<keyof WebSocketEvents, Function[]>()

  constructor(private url: string = '/') {
    this.setupEventHandlers()
  }

  // 连接WebSocket
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve()
        return
      }

      if (this.isConnecting) {
        reject(new Error('Connection already in progress'))
        return
      }

      this.isConnecting = true

      try {
        this.socket = io(this.url, {
          transports: ['websocket', 'polling'],
          timeout: 10000,
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectDelay,
          autoConnect: false
        })

        this.setupSocketEventHandlers()

        this.socket.connect()

        this.socket.on('connect', () => {
          console.log('WebSocket connected')
          this.isConnecting = false
          this.reconnectAttempts = 0
          this.emitEvent('connect')
          resolve()
        })

        this.socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error)
          this.isConnecting = false
          this.emitEvent('connect_error', error)
          reject(error)
        })

      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  // 断开连接
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.isConnecting = false
    this.reconnectAttempts = 0
  }

  // 检查连接状态
  isConnected(): boolean {
    return this.socket?.connected || false
  }

  // 设置Socket事件处理器
  private setupSocketEventHandlers(): void {
    if (!this.socket) return

    // 连接状态事件
    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      this.emitEvent('disconnect')
      
      // 如果是服务器主动断开，尝试重连
      if (reason === 'io server disconnect') {
        this.attemptReconnect()
      }
    })

    this.socket.on('reconnect', () => {
      console.log('WebSocket reconnected')
      this.reconnectAttempts = 0
      this.emitEvent('reconnect')
    })

    // 系统指标事件
    this.socket.on('metrics:system', (metrics: SystemMetrics) => {
      this.emitEvent('metrics:system', metrics)
    })

    this.socket.on('metrics:server', (data: { serverId: string; metrics: SystemMetrics }) => {
      this.emitEvent('metrics:server', data)
    })

    // 服务器状态事件
    this.socket.on('server:status', (data: { serverId: string; status: MCPServer['status']; error?: string }) => {
      this.emitEvent('server:status', data)
    })

    this.socket.on('server:created', (server: MCPServer) => {
      this.emitEvent('server:created', server)
    })

    this.socket.on('server:updated', (server: MCPServer) => {
      this.emitEvent('server:updated', server)
    })

    this.socket.on('server:deleted', (serverId: string) => {
      this.emitEvent('server:deleted', serverId)
    })

    // 日志事件
    this.socket.on('logs:new', (entry: LogEntry) => {
      this.emitEvent('logs:new', entry)
    })

    this.socket.on('logs:batch', (entries: LogEntry[]) => {
      this.emitEvent('logs:batch', entries)
    })
  }

  // 尝试重连
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1) // 指数退避

    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`)

    setTimeout(() => {
      if (!this.isConnected()) {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error)
        })
      }
    }, delay)
  }

  // 设置事件处理器
  private setupEventHandlers(): void {
    // 初始化事件处理器映射
    const eventKeys: (keyof WebSocketEvents)[] = [
      'metrics:system',
      'metrics:server',
      'server:status',
      'server:created',
      'server:updated',
      'server:deleted',
      'logs:new',
      'logs:batch',
      'connect',
      'disconnect',
      'reconnect',
      'connect_error'
    ]

    eventKeys.forEach(event => {
      this.eventHandlers.set(event, [])
    })
  }

  // 注册事件监听器
  on<K extends keyof WebSocketEvents>(event: K, handler: WebSocketEvents[K]): void {
    const handlers = this.eventHandlers.get(event) || []
    handlers.push(handler)
    this.eventHandlers.set(event, handlers)
  }

  // 移除事件监听器
  off<K extends keyof WebSocketEvents>(event: K, handler?: WebSocketEvents[K]): void {
    const handlers = this.eventHandlers.get(event) || []
    
    if (handler) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    } else {
      // 如果没有指定处理器，清除所有处理器
      this.eventHandlers.set(event, [])
    }
  }

  // 触发事件
  private emitEvent<K extends keyof WebSocketEvents>(event: K, ...args: Parameters<WebSocketEvents[K]>): void {
    const handlers = this.eventHandlers.get(event) || []
    handlers.forEach(handler => {
      try {
        (handler as Function)(...args)
      } catch (error) {
        console.error(`Error in WebSocket event handler for ${event}:`, error)
      }
    })
  }

  // 发送消息到服务器
  emit(event: string, data?: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    } else {
      console.warn('WebSocket not connected, cannot emit event:', event)
    }
  }

  // 订阅特定服务器的更新
  subscribeToServer(serverId: string): void {
    this.emit('subscribe:server', { serverId })
  }

  // 取消订阅特定服务器的更新
  unsubscribeFromServer(serverId: string): void {
    this.emit('unsubscribe:server', { serverId })
  }

  // 订阅系统指标更新
  subscribeToMetrics(): void {
    this.emit('subscribe:metrics')
  }

  // 取消订阅系统指标更新
  unsubscribeFromMetrics(): void {
    this.emit('unsubscribe:metrics')
  }

  // 订阅日志更新
  subscribeToLogs(filter?: { level?: string[]; serverId?: string }): void {
    this.emit('subscribe:logs', filter)
  }

  // 取消订阅日志更新
  unsubscribeFromLogs(): void {
    this.emit('unsubscribe:logs')
  }

  // 获取连接状态信息
  getConnectionInfo(): {
    connected: boolean
    reconnectAttempts: number
    maxReconnectAttempts: number
    isConnecting: boolean
  } {
    return {
      connected: this.isConnected(),
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      isConnecting: this.isConnecting
    }
  }
}

// 创建全局WebSocket服务实例
export const websocketService = new WebSocketService()

// 导出类型已在文件顶部定义