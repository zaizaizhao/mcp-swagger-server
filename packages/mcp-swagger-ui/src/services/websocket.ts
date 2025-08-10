import { io, type Socket } from "socket.io-client";
import type { SystemMetrics, LogEntry, MCPServer } from "@/types";

export interface WebSocketEvents {
  // 系统指标更新
  "metrics:system": (metrics: SystemMetrics) => void;
  "metrics:server": (data: {
    serverId: string;
    metrics: SystemMetrics;
  }) => void;

  // 服务器状态更新
  "server:status": (data: {
    serverId: string;
    status: MCPServer["status"];
    error?: string;
  }) => void;
  "server:created": (server: MCPServer) => void;
  "server:updated": (server: MCPServer) => void;
  "server:deleted": (serverId: string) => void;

  // 进程信息更新
  "process:info": (data: {
    serverId: string;
    processInfo: {
      process: {
        pid: number;
        name: string;
        status: string;
        startTime: Date;
        uptime: number;
      };
      resources: {
        cpu: number;
        memory: number;
        handles?: number;
        threads?: number;
      };
      system: {
        platform: string;
        arch: string;
        nodeVersion: string;
      };
      details: any;
    };
  }) => void;
  "process:logs": (data: {
    serverId: string;
    logs: Array<{
      serverId: string;
      pid: number;
      timestamp: Date;
      level: string;
      source: string;
      message: string;
      metadata?: Record<string, any>;
    }>;
  }) => void;

  // 日志更新
  "logs:new": (entry: LogEntry) => void;
  "logs:batch": (entries: LogEntry[]) => void;

  // 连接状态事件
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
  connect_error: (error: Error) => void;
}

export class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private eventHandlers = new Map<keyof WebSocketEvents, Function[]>();

  constructor(private url: string = "/") {
    this.setupEventHandlers();
  }

  // 连接WebSocket
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[WebSocketService] Attempting to connect to: ${this.url}`);
      
      if (this.socket?.connected) {
        console.log('[WebSocketService] Already connected');
        resolve();
        return;
      }

      if (this.isConnecting) {
        console.log('[WebSocketService] Connection already in progress');
        reject(new Error("Connection already in progress"));
        return;
      }

      this.isConnecting = true;

      try {
        console.log('[WebSocketService] Creating socket.io connection...');
        this.socket = io(this.url, {
          transports: ["websocket", "polling"],
          timeout: 10000,
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectDelay,
          autoConnect: false,
          forceNew: true,
        });

        this.setupSocketEventHandlers();

        console.log('[WebSocketService] Initiating connection...');
        this.socket.connect();

        this.socket.on("connect", () => {
          console.log("[WebSocketService] WebSocket connected successfully!");
          console.log("[WebSocketService] Socket ID:", this.socket?.id);
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.emitEvent("connect");
          resolve();
        });

        this.socket.on("connect_error", (error) => {
          console.error("[WebSocketService] WebSocket connection error:", error);
          console.error("[WebSocketService] Error details:", {
            message: error.message,
            description: (error as any).description,
            context: (error as any).context,
            type: (error as any).type
          });
          this.isConnecting = false;
          this.emitEvent("connect_error", error);
          reject(error);
        });

        // 添加更多调试事件
        this.socket.on("disconnect", (reason) => {
          console.log("[WebSocketService] Disconnected:", reason);
        });

        this.socket.on("reconnect_attempt", (attemptNumber) => {
          console.log("[WebSocketService] Reconnect attempt:", attemptNumber);
        });

        this.socket.on("reconnect_error", (error) => {
          console.error("[WebSocketService] Reconnect error:", error);
        });

        this.socket.on("reconnect_failed", () => {
          console.error("[WebSocketService] Reconnect failed");
        });

        // 添加连接状态事件监听
        this.socket.on("connection-stats", (data: {
          totalClients: number;
          activeRooms: string[];
          timestamp: string;
        }) => {
          if (process.env.NODE_ENV === 'development') {
            console.log(`[WebSocketService] Connection stats:`, data);
          }
        });
      } catch (error) {
        console.error('[WebSocketService] Error creating socket:', error);
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  // 断开连接
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  // 检查连接状态
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // 设置Socket事件处理器
  private setupSocketEventHandlers(): void {
    if (!this.socket) return;

    console.log('[WebSocketService] Setting up socket event handlers...');

    // 连接状态事件
    this.socket.on("disconnect", (reason) => {
      console.log("[WebSocketService] WebSocket disconnected:", reason);
      this.emitEvent("disconnect");

      // 如果是服务器主动断开，尝试重连
      if (reason === "io server disconnect") {
        this.attemptReconnect();
      }
    });

    this.socket.on("reconnect", () => {
      console.log("WebSocket reconnected");
      this.reconnectAttempts = 0;
      this.emitEvent("reconnect");
    });

    // 系统指标事件（修复事件名称不匹配问题）
    this.socket.on("system-metrics-update", (data: { data: SystemMetrics; timestamp: string }) => {
      this.emitEvent("metrics:system", data.data);
    });

    this.socket.on("initial-system-metrics", (data: { data: SystemMetrics; timestamp: string }) => {
      this.emitEvent("metrics:system", data.data);
    });

    // 服务器指标事件已在下方处理

    // 服务器状态事件（修复事件名称不匹配问题）
    this.socket.on("server-status-changed", (data: {
      serverId: string;
      status: string;
      timestamp: string;
    }) => {
      this.emitEvent("server:status", {
        serverId: data.serverId,
        status: data.status as MCPServer["status"],
      });
    });

    this.socket.on("server-health-changed", (data: {
      serverId: string;
      healthy: boolean;
      error?: string;
      timestamp: string;
    }) => {
      this.emitEvent("server:status", {
        serverId: data.serverId,
        status: data.healthy ? "running" : "error" as MCPServer["status"],
        error: data.error,
      });
    });

    // 服务器CRUD事件（这些可能需要后端添加支持）
    this.socket.on("server:created", (server: MCPServer) => {
      this.emitEvent("server:created", server);
    });

    this.socket.on("server:updated", (server: MCPServer) => {
      this.emitEvent("server:updated", server);
    });

    this.socket.on("server:deleted", (serverId: string) => {
      this.emitEvent("server:deleted", serverId);
    });

    // 进程信息事件
    this.socket.on("process:info", (data: {
      serverId: string;
      processInfo: any;
    }) => {
      this.emitEvent("process:info", data);
    });

    this.socket.on("process:logs", (data: {
      serverId: string;
      logs: any[];
    }) => {
      this.emitEvent("process:logs", data);
    });

    // 服务器指标更新事件（后端发送的实际事件名称）
    this.socket.on("server-metrics-update", (data: {
      serverId: string;
      data: any;
      timestamp: string;
    }) => {
      console.log('[WebSocketService] 前端日志:', data);
      // 转换为前端期望的process:info格式
      this.emitEvent("process:info", {
        serverId: data.serverId,
        processInfo: data.data
      });
    });

    // 订阅确认事件（修复事件名称不匹配问题）
    this.socket.on("subscription-confirmed", (data: {
      room: string;
      serverId?: string;
      interval?: number;
      timestamp: string;
    }) => {
      console.log(`[WebSocketService] ✅ Subscription confirmed:`, data);
      console.log(`[WebSocketService] Successfully joined room: ${data.room}`);
    });

    // 取消订阅确认事件
    this.socket.on("unsubscription-confirmed", (data: {
      room: string;
      timestamp: string;
    }) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[WebSocketService] Unsubscription confirmed:`, data);
      }
    });

    // 日志事件（修复事件名称不匹配问题）
    this.socket.on("server-log", (data: {
      serverId: string;
      level: string;
      message: string;
      source: string;
      timestamp: string;
    }) => {
      const logEntry: LogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(data.timestamp),
        level: data.level as LogEntry['level'],
        message: data.message,
        source: data.source,
        serverId: data.serverId,
      };
      this.emitEvent("logs:new", logEntry);
    });

    // 告警事件
    this.socket.on("alert", (data: {
      id: string;
      type: string;
      severity: string;
      serverId?: string;
      message: string;
      source?: string;
      timestamp: string;
    }) => {
      const logEntry: LogEntry = {
        id: data.id,
        timestamp: new Date(data.timestamp),
        level: data.severity as LogEntry['level'],
        message: data.message,
        source: data.source || 'alert',
        serverId: data.serverId,
      };
      this.emitEvent("logs:new", logEntry);
    });

    // 保留原有的批量日志事件（如果后端有发送）
    this.socket.on("logs:batch", (entries: LogEntry[]) => {
      this.emitEvent("logs:batch", entries);
    });
  }

  // 尝试重连
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 指数退避

    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`,
    );

    setTimeout(() => {
      if (!this.isConnected()) {
        this.connect().catch((error) => {
          console.error("Reconnection failed:", error);
        });
      }
    }, delay);
  }

  // 设置事件处理器
  private setupEventHandlers(): void {
    // 初始化事件处理器映射
    const eventKeys: (keyof WebSocketEvents)[] = [
      "metrics:system",
      "metrics:server",
      "server:status",
      "server:created",
      "server:updated",
      "server:deleted",
      "process:info",
      "process:logs",
      "logs:new",
      "logs:batch",
      "connect",
      "disconnect",
      "reconnect",
      "connect_error",
    ];

    eventKeys.forEach((event) => {
      this.eventHandlers.set(event, []);
    });
  }

  // 注册事件监听器
  on<K extends keyof WebSocketEvents>(
    event: K,
    handler: WebSocketEvents[K],
  ): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  // 移除事件监听器
  off<K extends keyof WebSocketEvents>(
    event: K,
    handler?: WebSocketEvents[K],
  ): void {
    const handlers = this.eventHandlers.get(event) || [];

    if (handler) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    } else {
      // 如果没有指定处理器，清除所有处理器
      this.eventHandlers.set(event, []);
    }
  }

  // 触发事件
  private emitEvent<K extends keyof WebSocketEvents>(
    event: K,
    ...args: Parameters<WebSocketEvents[K]>
  ): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach((handler) => {
      try {
        (handler as Function)(...args);
      } catch (error) {
        console.error(`Error in WebSocket event handler for ${event}:`, error);
      }
    });
  }

  // 发送消息到服务器
  emit(event: string, data?: any): void {
    if (this.socket?.connected) {
      console.log(`[WebSocketService] 📤 Emitting event: ${event}`, data);
      this.socket.emit(event, data);
    } else {
      console.error(`[WebSocketService] ❌ WebSocket not connected, cannot emit event: ${event}`, data);
    }
  }

  // 订阅特定服务器的更新
  subscribeToServer(serverId: string): void {
    this.emit("subscribe:server", { serverId });
  }

  // 取消订阅特定服务器的更新
  unsubscribeFromServer(serverId: string): void {
    this.emit("unsubscribe:server", { serverId });
  }

  // 订阅系统指标更新
  subscribeToMetrics(): void {
    this.emit("subscribe:metrics");
  }

  // 取消订阅系统指标更新
  unsubscribeFromMetrics(): void {
    this.emit("unsubscribe:metrics");
  }

  // 订阅日志更新
  subscribeToLogs(filter?: { level?: string[]; serverId?: string }): void {
    this.emit("subscribe:logs", filter);
  }

  // 取消订阅日志更新
  unsubscribeFromLogs(): void {
    this.emit("unsubscribe:logs");
  }

  // 订阅进程信息更新
  subscribeToProcessInfo(serverId: string): void {
    console.log(`[WebSocketService] 🔄 Subscribing to process info for server: ${serverId}`);
    console.log(`[WebSocketService] Socket connected: ${this.socket?.connected}`);
    console.log(`[WebSocketService] Socket ID: ${this.socket?.id}`);
    
    if (!this.socket?.connected) {
      console.error('[WebSocketService] ❌ Socket not connected, cannot subscribe to process info');
      return;
    }
    
    const subscribeData = { serverId, interval: 5000 };
    console.log(`[WebSocketService] 📤 Emitting subscribe-server-metrics with data:`, subscribeData);
    console.log(`[WebSocketService] Expected room name: server-metrics-${serverId}`);
    this.emit("subscribe-server-metrics", subscribeData);
    
    // 添加订阅后的状态检查
    setTimeout(() => {
      console.log(`[WebSocketService] 🔍 Checking subscription status after 2 seconds...`);
      console.log(`[WebSocketService] Socket still connected: ${this.socket?.connected}`);
    }, 2000);
  }

  // 取消订阅进程信息更新
  unsubscribeFromProcessInfo(serverId: string): void {
    this.emit("unsubscribe", { room: `server-metrics-${serverId}` });
  }

  // 订阅进程日志更新
  subscribeToProcessLogs(serverId: string, level?: string): void {
    this.emit("subscribe-server-logs", { serverId, level });
  }

  // 取消订阅进程日志更新
  unsubscribeFromProcessLogs(serverId: string): void {
    this.emit("unsubscribe", { room: `server-logs-${serverId}` });
  }

  // 获取连接状态信息
  getConnectionInfo(): {
    connected: boolean;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
    isConnecting: boolean;
  } {
    return {
      connected: this.isConnected(),
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      isConnecting: this.isConnecting,
    };
  }
}

// 创建全局WebSocket服务实例
export const websocketService = new WebSocketService('http://localhost:3001/monitoring');

// 导出类型已在文件顶部定义
