/**
 * WebSocket连接调试工具
 */

interface DebugInfo {
  timestamp: string;
  event: string;
  data?: any;
  socketId?: string;
  connected?: boolean;
}

class WebSocketDebugger {
  private logs: DebugInfo[] = [];
  private maxLogs = 100;

  log(event: string, data?: any, socketId?: string, connected?: boolean) {
    const debugInfo: DebugInfo = {
      timestamp: new Date().toISOString(),
      event,
      data,
      socketId,
      connected
    };
    
    this.logs.unshift(debugInfo);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
    
    console.log(`[WebSocketDebug] ${debugInfo.timestamp} - ${event}`, {
      data,
      socketId,
      connected
    });
  }

  getLogs(): DebugInfo[] {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
  }

  generateReport(): string {
    const report = this.logs.map(log => 
      `${log.timestamp} | ${log.event} | SocketID: ${log.socketId || 'N/A'} | Connected: ${log.connected || 'N/A'}`
    ).join('\n');
    
    return `WebSocket Debug Report\n${'='.repeat(50)}\n${report}`;
  }

  // 分析连接模式
  analyzeConnectionPattern(): {
    totalConnections: number;
    totalDisconnections: number;
    averageConnectionDuration: number;
    frequentDisconnectReasons: string[];
  } {
    const connections = this.logs.filter(log => log.event === 'connect');
    const disconnections = this.logs.filter(log => log.event === 'disconnect');
    
    return {
      totalConnections: connections.length,
      totalDisconnections: disconnections.length,
      averageConnectionDuration: 0, // 需要更复杂的计算
      frequentDisconnectReasons: disconnections.map(d => d.data?.reason || 'unknown')
    };
  }
}

export const wsDebugger = new WebSocketDebugger();

// 全局调试函数
(window as any).wsDebug = {
  logs: () => wsDebugger.getLogs(),
  report: () => console.log(wsDebugger.generateReport()),
  clear: () => wsDebugger.clear(),
  analyze: () => wsDebugger.analyzeConnectionPattern()
};
