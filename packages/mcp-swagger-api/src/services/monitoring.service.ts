import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface MCPMetrics {
  serversCreated: number;
  toolsGenerated: number;
  apiCalls: number;
  errors: number;
  uptime: number;
  activeConnections: number;
  lastActivity: Date;
}

export interface MCPEvent {
  type: 'server_created' | 'server_stopped' | 'tools_reloaded' | 'api_call' | 'error';
  timestamp: Date;
  data: any;
}

@Injectable()
export class MCPMonitoringService {
  private readonly logger = new Logger(MCPMonitoringService.name);
  private metrics: MCPMetrics;
  private events: MCPEvent[] = [];
  private startTime: Date;

  constructor(private eventEmitter: EventEmitter2) {
    this.startTime = new Date();
    this.metrics = {
      serversCreated: 0,
      toolsGenerated: 0,
      apiCalls: 0,
      errors: 0,
      uptime: 0,
      activeConnections: 0,
      lastActivity: new Date(),
    };

    // 监听事件
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.eventEmitter.on('mcp.server.created', (data) => {
      this.recordEvent('server_created', data);
      this.metrics.serversCreated++;
      this.metrics.toolsGenerated += data.toolsCount || 0;
    });

    this.eventEmitter.on('mcp.server.stopped', (data) => {
      this.recordEvent('server_stopped', data);
    });

    this.eventEmitter.on('mcp.tools.reloaded', (data) => {
      this.recordEvent('tools_reloaded', data);
    });

    this.eventEmitter.on('mcp.api.call', (data) => {
      this.recordEvent('api_call', data);
      this.metrics.apiCalls++;
    });

    this.eventEmitter.on('mcp.error', (data) => {
      this.recordEvent('error', data);
      this.metrics.errors++;
    });
  }

  recordEvent(type: MCPEvent['type'], data: any) {
    const event: MCPEvent = {
      type,
      timestamp: new Date(),
      data,
    };

    this.events.push(event);
    this.metrics.lastActivity = event.timestamp;

    // 保持最近1000个事件
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }

    this.logger.debug(`Event recorded: ${type}`, data);
  }

  getMetrics(): MCPMetrics {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  getRecentEvents(limit: number = 50): MCPEvent[] {
    return this.events.slice(-limit).reverse();
  }

  getEventsByType(type: MCPEvent['type'], limit: number = 50): MCPEvent[] {
    return this.events
      .filter(event => event.type === type)
      .slice(-limit)
      .reverse();
  }

  getHealthStatus() {
    const metrics = this.getMetrics();
    const errorRate = metrics.errors / Math.max(metrics.apiCalls, 1);
    
    return {
      status: errorRate > 0.1 ? 'unhealthy' : 'healthy',
      uptime: metrics.uptime,
      errorRate: errorRate,
      lastActivity: metrics.lastActivity,
      activeConnections: metrics.activeConnections,
    };
  }

  updateActiveConnections(count: number) {
    this.metrics.activeConnections = count;
  }
}
