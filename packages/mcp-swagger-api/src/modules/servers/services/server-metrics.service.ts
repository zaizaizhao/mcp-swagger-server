import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as os from 'os';
import * as process from 'process';

import { MCPServerEntity } from '../../../database/entities/mcp-server.entity';
import { LogEntryEntity, LogLevel, LogSource } from '../../../database/entities/log-entry.entity';
import { ServerManagerService } from './server-manager.service';

export interface ServerMetrics {
  serverId: string;
  serverName: string;
  timestamp: Date;
  
  // 基础指标
  uptime: number; // 运行时间（秒）
  requestCount: number; // 请求总数
  errorCount: number; // 错误总数
  responseTime: number; // 平均响应时间（毫秒）
  
  // 性能指标
  cpuUsage: number; // CPU使用率（百分比）
  memoryUsage: number; // 内存使用量（MB）
  memoryUsagePercent: number; // 内存使用率（百分比）
  
  // 网络指标
  activeConnections: number; // 活跃连接数
  totalConnections: number; // 总连接数
  bytesReceived: number; // 接收字节数
  bytesSent: number; // 发送字节数
  
  // 工具指标
  toolCallCount: number; // 工具调用次数
  toolErrorCount: number; // 工具错误次数
  averageToolResponseTime: number; // 平均工具响应时间
}

export interface SystemMetrics {
  timestamp: Date;
  
  // 系统资源
  totalMemory: number; // 总内存（MB）
  freeMemory: number; // 可用内存（MB）
  cpuCount: number; // CPU核心数
  loadAverage: number[]; // 负载平均值
  
  // 进程信息
  processMemory: number; // 进程内存使用（MB）
  processCpuUsage: number; // 进程CPU使用率
  
  // 服务器统计
  totalServers: number; // 总服务器数
  runningServers: number; // 运行中的服务器数
  healthyServers: number; // 健康的服务器数
}

export interface MetricsQuery {
  serverId?: string;
  startTime?: Date;
  endTime?: Date;
  interval?: 'minute' | 'hour' | 'day';
  limit?: number;
}

@Injectable()
export class ServerMetricsService {
  private readonly logger = new Logger(ServerMetricsService.name);
  private readonly metricsHistory = new Map<string, ServerMetrics[]>();
  private readonly systemMetricsHistory: SystemMetrics[] = [];
  private readonly maxHistorySize = 1000;
  private readonly serverStats = new Map<string, {
    requestCount: number;
    errorCount: number;
    responseTimes: number[];
    toolCallCount: number;
    toolErrorCount: number;
    toolResponseTimes: number[];
    connections: Set<string>;
    bytesReceived: number;
    bytesSent: number;
  }>();

  constructor(
    @InjectRepository(MCPServerEntity)
    private readonly serverRepository: Repository<MCPServerEntity>,
    @InjectRepository(LogEntryEntity)
    private readonly logRepository: Repository<LogEntryEntity>,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly serverManager: ServerManagerService,
  ) {
    this.initializeMetricsCollection();
  }

  /**
   * 初始化指标收集
   */
  private async initializeMetricsCollection(): Promise<void> {
    try {
      const servers = await this.serverRepository.find();
      
      for (const server of servers) {
        this.initializeServerStats(server.id);
      }

      this.logger.log(`Initialized metrics collection for ${servers.length} servers`);
    } catch (error) {
      this.logger.error('Failed to initialize metrics collection:', error);
    }
  }

  /**
   * 初始化服务器统计信息
   */
  private initializeServerStats(serverId: string): void {
    if (!this.serverStats.has(serverId)) {
      this.serverStats.set(serverId, {
        requestCount: 0,
        errorCount: 0,
        responseTimes: [],
        toolCallCount: 0,
        toolErrorCount: 0,
        toolResponseTimes: [],
        connections: new Set(),
        bytesReceived: 0,
        bytesSent: 0,
      });
    }
  }

  /**
   * 记录请求指标
   */
  recordRequest(serverId: string, responseTime: number, isError: boolean = false): void {
    this.initializeServerStats(serverId);
    const stats = this.serverStats.get(serverId)!;
    
    stats.requestCount++;
    stats.responseTimes.push(responseTime);
    
    if (isError) {
      stats.errorCount++;
    }
    
    // 限制响应时间数组大小
    if (stats.responseTimes.length > 1000) {
      stats.responseTimes = stats.responseTimes.slice(-1000);
    }
  }

  /**
   * 记录工具调用指标
   */
  recordToolCall(serverId: string, responseTime: number, isError: boolean = false): void {
    this.initializeServerStats(serverId);
    const stats = this.serverStats.get(serverId)!;
    
    stats.toolCallCount++;
    stats.toolResponseTimes.push(responseTime);
    
    if (isError) {
      stats.toolErrorCount++;
    }
    
    // 限制工具响应时间数组大小
    if (stats.toolResponseTimes.length > 1000) {
      stats.toolResponseTimes = stats.toolResponseTimes.slice(-1000);
    }
  }

  /**
   * 记录连接指标
   */
  recordConnection(serverId: string, connectionId: string, connected: boolean): void {
    this.initializeServerStats(serverId);
    const stats = this.serverStats.get(serverId)!;
    
    if (connected) {
      stats.connections.add(connectionId);
    } else {
      stats.connections.delete(connectionId);
    }
  }

  /**
   * 记录网络流量
   */
  recordNetworkTraffic(serverId: string, bytesReceived: number, bytesSent: number): void {
    this.initializeServerStats(serverId);
    const stats = this.serverStats.get(serverId)!;
    
    stats.bytesReceived += bytesReceived;
    stats.bytesSent += bytesSent;
  }

  /**
   * 收集服务器指标
   */
  async collectServerMetrics(serverId: string): Promise<ServerMetrics> {
    const server = await this.serverRepository.findOne({ where: { id: serverId } });
    if (!server) {
      throw new Error(`Server with ID ${serverId} not found`);
    }

    const instance = this.serverManager.getServerInstance(serverId);
    const stats = this.serverStats.get(serverId);
    
    if (!stats) {
      this.initializeServerStats(serverId);
    }

    const currentStats = this.serverStats.get(serverId)!;
    
    // 计算平均响应时间
    const averageResponseTime = currentStats.responseTimes.length > 0
      ? currentStats.responseTimes.reduce((sum, time) => sum + time, 0) / currentStats.responseTimes.length
      : 0;
    
    // 计算平均工具响应时间
    const averageToolResponseTime = currentStats.toolResponseTimes.length > 0
      ? currentStats.toolResponseTimes.reduce((sum, time) => sum + time, 0) / currentStats.toolResponseTimes.length
      : 0;
    
    // 计算运行时间
    const uptime = instance?.startTime 
      ? Math.floor((Date.now() - instance.startTime.getTime()) / 1000)
      : 0;
    
    // 获取系统资源使用情况（简化版，实际应该通过进程监控获取）
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const metrics: ServerMetrics = {
      serverId,
      serverName: server.name,
      timestamp: new Date(),
      uptime,
      requestCount: currentStats.requestCount,
      errorCount: currentStats.errorCount,
      responseTime: averageResponseTime,
      cpuUsage: 0, // TODO: 实现真实的CPU使用率计算
      memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      memoryUsagePercent: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      activeConnections: currentStats.connections.size,
      totalConnections: currentStats.connections.size, // 简化版
      bytesReceived: currentStats.bytesReceived,
      bytesSent: currentStats.bytesSent,
      toolCallCount: currentStats.toolCallCount,
      toolErrorCount: currentStats.toolErrorCount,
      averageToolResponseTime,
    };

    // 保存指标历史
    this.saveServerMetricsHistory(serverId, metrics);
    
    return metrics;
  }

  /**
   * 收集系统指标
   */
  async collectSystemMetrics(): Promise<SystemMetrics> {
    const totalMemory = Math.round(os.totalmem() / 1024 / 1024); // MB
    const freeMemory = Math.round(os.freemem() / 1024 / 1024); // MB
    const processMemoryUsage = process.memoryUsage();
    
    // 获取服务器统计
    const allServers = await this.serverRepository.find();
    const runningServers = allServers.filter(s => s.status === 'running').length;
    const healthyServers = allServers.filter(s => s.healthy).length;
    
    const metrics: SystemMetrics = {
      timestamp: new Date(),
      totalMemory,
      freeMemory,
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg(),
      processMemory: Math.round(processMemoryUsage.heapUsed / 1024 / 1024),
      processCpuUsage: 0, // TODO: 实现进程CPU使用率计算
      totalServers: allServers.length,
      runningServers,
      healthyServers,
    };

    // 保存系统指标历史
    this.saveSystemMetricsHistory(metrics);
    
    return metrics;
  }

  /**
   * 获取服务器指标
   */
  async getServerMetrics(serverId: string, query?: MetricsQuery): Promise<ServerMetrics[]> {
    const history = this.metricsHistory.get(serverId) || [];
    
    let filteredHistory = history;
    
    // 应用时间过滤
    if (query?.startTime) {
      filteredHistory = filteredHistory.filter(m => m.timestamp >= query.startTime!);
    }
    
    if (query?.endTime) {
      filteredHistory = filteredHistory.filter(m => m.timestamp <= query.endTime!);
    }
    
    // 应用限制
    if (query?.limit) {
      filteredHistory = filteredHistory.slice(-query.limit);
    }
    
    return filteredHistory;
  }

  /**
   * 获取系统指标
   */
  getSystemMetrics(query?: MetricsQuery): SystemMetrics[] {
    let filteredHistory = this.systemMetricsHistory;
    
    // 应用时间过滤
    if (query?.startTime) {
      filteredHistory = filteredHistory.filter(m => m.timestamp >= query.startTime!);
    }
    
    if (query?.endTime) {
      filteredHistory = filteredHistory.filter(m => m.timestamp <= query.endTime!);
    }
    
    // 应用限制
    if (query?.limit) {
      filteredHistory = filteredHistory.slice(-query.limit);
    }
    
    return filteredHistory;
  }

  /**
   * 获取服务器性能摘要
   */
  async getServerPerformanceSummary(serverId: string): Promise<{
    current: ServerMetrics;
    averages: {
      responseTime: number;
      errorRate: number;
      toolResponseTime: number;
      toolErrorRate: number;
    };
    trends: {
      requestTrend: 'up' | 'down' | 'stable';
      errorTrend: 'up' | 'down' | 'stable';
      performanceTrend: 'up' | 'down' | 'stable';
    };
  }> {
    const current = await this.collectServerMetrics(serverId);
    const history = this.metricsHistory.get(serverId) || [];
    
    // 计算平均值（最近24小时）
    const recentHistory = history.filter(
      m => m.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    
    const averageResponseTime = recentHistory.length > 0
      ? recentHistory.reduce((sum, m) => sum + m.responseTime, 0) / recentHistory.length
      : 0;
    
    const averageErrorRate = recentHistory.length > 0
      ? recentHistory.reduce((sum, m) => sum + (m.errorCount / Math.max(m.requestCount, 1)), 0) / recentHistory.length * 100
      : 0;
    
    const averageToolResponseTime = recentHistory.length > 0
      ? recentHistory.reduce((sum, m) => sum + m.averageToolResponseTime, 0) / recentHistory.length
      : 0;
    
    const averageToolErrorRate = recentHistory.length > 0
      ? recentHistory.reduce((sum, m) => sum + (m.toolErrorCount / Math.max(m.toolCallCount, 1)), 0) / recentHistory.length * 100
      : 0;
    
    // 计算趋势（简化版）
    const requestTrend = this.calculateTrend(recentHistory.map(m => m.requestCount));
    const errorTrend = this.calculateTrend(recentHistory.map(m => m.errorCount));
    const performanceTrend = this.calculateTrend(recentHistory.map(m => m.responseTime), true); // 响应时间越低越好
    
    return {
      current,
      averages: {
        responseTime: averageResponseTime,
        errorRate: averageErrorRate,
        toolResponseTime: averageToolResponseTime,
        toolErrorRate: averageToolErrorRate,
      },
      trends: {
        requestTrend,
        errorTrend,
        performanceTrend,
      },
    };
  }

  /**
   * 定时收集所有服务器指标
   */
  @Cron(CronExpression.EVERY_MINUTE)
  private async collectAllServerMetrics(): Promise<void> {
    try {
      const runningInstances = this.serverManager.getRunningInstances();
      
      for (const instance of runningInstances) {
        try {
          await this.collectServerMetrics(instance.id);
        } catch (error) {
          this.logger.error(`Failed to collect metrics for server ${instance.id}:`, error);
        }
      }
      
      // 收集系统指标
      await this.collectSystemMetrics();
    } catch (error) {
      this.logger.error('Failed to collect server metrics:', error);
    }
  }

  /**
   * 定时清理过期指标
   */
  @Cron(CronExpression.EVERY_HOUR)
  private async cleanupMetricsHistory(): Promise<void> {
    const maxAge = this.configService.get<number>('METRICS_HISTORY_MAX_AGE', 7 * 24 * 60 * 60 * 1000); // 7天
    const cutoffTime = new Date(Date.now() - maxAge);

    // 清理服务器指标历史
    for (const [serverId, history] of this.metricsHistory.entries()) {
      const filteredHistory = history.filter(m => m.timestamp > cutoffTime);
      
      if (filteredHistory.length !== history.length) {
        this.metricsHistory.set(serverId, filteredHistory);
        this.logger.debug(`Cleaned up metrics history for server ${serverId}`);
      }
    }

    // 清理系统指标历史
    const filteredSystemHistory = this.systemMetricsHistory.filter(m => m.timestamp > cutoffTime);
    if (filteredSystemHistory.length !== this.systemMetricsHistory.length) {
      this.systemMetricsHistory.splice(0, this.systemMetricsHistory.length, ...filteredSystemHistory);
      this.logger.debug('Cleaned up system metrics history');
    }
  }

  /**
   * 保存服务器指标历史
   */
  private saveServerMetricsHistory(serverId: string, metrics: ServerMetrics): void {
    let history = this.metricsHistory.get(serverId) || [];
    
    history.push(metrics);
    
    // 限制历史记录大小
    if (history.length > this.maxHistorySize) {
      history = history.slice(-this.maxHistorySize);
    }
    
    this.metricsHistory.set(serverId, history);
  }

  /**
   * 保存系统指标历史
   */
  private saveSystemMetricsHistory(metrics: SystemMetrics): void {
    this.systemMetricsHistory.push(metrics);
    
    // 限制历史记录大小
    if (this.systemMetricsHistory.length > this.maxHistorySize) {
      this.systemMetricsHistory.splice(0, this.systemMetricsHistory.length - this.maxHistorySize);
    }
  }

  /**
   * 计算趋势
   */
  private calculateTrend(values: number[], lowerIsBetter: boolean = false): 'up' | 'down' | 'stable' {
    if (values.length < 2) {
      return 'stable';
    }
    
    const recent = values.slice(-5); // 最近5个值
    const older = values.slice(-10, -5); // 之前5个值
    
    if (recent.length === 0 || older.length === 0) {
      return 'stable';
    }
    
    const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
    const olderAvg = older.reduce((sum, v) => sum + v, 0) / older.length;
    
    const threshold = 0.1; // 10%的变化阈值
    const change = (recentAvg - olderAvg) / olderAvg;
    
    if (Math.abs(change) < threshold) {
      return 'stable';
    }
    
    if (lowerIsBetter) {
      return change > 0 ? 'down' : 'up'; // 对于响应时间等，增加是坏事
    } else {
      return change > 0 ? 'up' : 'down';
    }
  }

  /**
   * 服务器创建时的事件处理
   */
  onServerCreated(serverId: string): void {
    this.initializeServerStats(serverId);
  }

  /**
   * 服务器删除时的事件处理
   */
  onServerDeleted(serverId: string): void {
    this.serverStats.delete(serverId);
    this.metricsHistory.delete(serverId);
  }

  /**
   * 模块销毁时清理资源
   */
  onModuleDestroy(): void {
    this.serverStats.clear();
    this.metricsHistory.clear();
    this.systemMetricsHistory.splice(0);
  }
}