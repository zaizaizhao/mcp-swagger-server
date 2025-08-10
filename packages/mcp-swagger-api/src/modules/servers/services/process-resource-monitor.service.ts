import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as pidusage from 'pidusage';
import * as os from 'os';

export interface ProcessResourceMetrics {
  pid: number;
  cpu: number;        // CPU使用率 (百分比)
  memory: number;     // 内存使用量 (字节)
  ppid: number;       // 父进程ID
  ctime: number;      // 子进程CPU时间
  elapsed: number;    // 进程运行时间
  timestamp: Date;    // 采集时间
}

export interface SystemResourceInfo {
  totalMemory: number;    // 系统总内存
  freeMemory: number;     // 系统可用内存
  cpuCount: number;       // CPU核心数
  loadAverage: number[];  // 系统负载
}

@Injectable()
export class ProcessResourceMonitorService {
  private readonly logger = new Logger(ProcessResourceMonitorService.name);
  private readonly monitoringIntervals = new Map<string, NodeJS.Timeout>();
  private readonly resourceHistory = new Map<string, ProcessResourceMetrics[]>();
  private readonly maxHistorySize = 1000;

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * 获取进程资源使用情况
   */
  async getProcessResourceMetrics(pid: number): Promise<ProcessResourceMetrics | null> {
    try {
      const stats = await pidusage(pid);
      
      return {
        pid: stats.pid,
        cpu: Math.round(stats.cpu * 100) / 100,  // 保留2位小数
        memory: stats.memory,
        ppid: stats.ppid,
        ctime: stats.ctime,
        elapsed: stats.elapsed,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.warn(`Failed to get resource metrics for PID ${pid}:`, error.message);
      return null;
    }
  }

  /**
   * 获取系统资源信息
   */
  getSystemResourceInfo(): SystemResourceInfo {
    return {
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg()
    };
  }

  /**
   * 开始监控进程资源
   */
  startMonitoring(serverId: string, pid: number, intervalMs: number = 5000): void {
    // 清除已存在的监控
    this.stopMonitoring(serverId);

    const interval = setInterval(async () => {
      this.logger.log(`[DEBUG] Collecting resource metrics for server ${serverId} (PID: ${pid})`);
      const metrics = await this.getProcessResourceMetrics(pid);
      if (metrics) {
        this.logger.log(`[DEBUG] Resource metrics collected for server ${serverId}: CPU=${metrics.cpu}%, Memory=${Math.round(metrics.memory / 1024 / 1024)}MB`);
        this.saveResourceHistory(serverId, metrics);
        
        // 发送实时更新事件
        this.logger.log(`[DEBUG] Emitting process.resource_update event for server ${serverId}`);
        this.eventEmitter.emit('process.resource_update', {
          serverId,
          metrics,
          timestamp: new Date()
        });
        this.logger.log(`[DEBUG] process.resource_update event emitted successfully for server ${serverId}`);
      } else {
        this.logger.warn(`[DEBUG] Failed to collect resource metrics for server ${serverId} (PID: ${pid})`);
      }
    }, intervalMs);

    this.monitoringIntervals.set(serverId, interval);
    this.logger.log(`Started resource monitoring for server ${serverId} (PID: ${pid}) with interval ${intervalMs}ms`);
  }

  /**
   * 停止监控进程资源
   */
  stopMonitoring(serverId: string): void {
    const interval = this.monitoringIntervals.get(serverId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(serverId);
      this.logger.log(`Stopped resource monitoring for server ${serverId}`);
    }
  }

  /**
   * 获取资源历史数据
   */
  getResourceHistory(serverId: string, limit?: number): ProcessResourceMetrics[] {
    const history = this.resourceHistory.get(serverId) || [];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * 保存资源历史数据
   */
  private saveResourceHistory(serverId: string, metrics: ProcessResourceMetrics): void {
    let history = this.resourceHistory.get(serverId) || [];
    history.push(metrics);
    
    // 限制历史数据大小
    if (history.length > this.maxHistorySize) {
      history = history.slice(-this.maxHistorySize);
    }
    
    this.resourceHistory.set(serverId, history);
  }

  /**
   * 获取进程详细信息（跨平台）
   */
  async getProcessDetails(pid: number): Promise<any> {
    try {
      if (process.platform === 'win32') {
        return await this.getWindowsProcessDetails(pid);
      } else {
        return await this.getUnixProcessDetails(pid);
      }
    } catch (error) {
      this.logger.error(`Failed to get process details for PID ${pid}:`, error);
      return null;
    }
  }

  /**
   * Windows平台进程详情
   */
  private async getWindowsProcessDetails(pid: number): Promise<any> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      const { stdout } = await execAsync(
        `wmic process where "ProcessId=${pid}" get Name,CommandLine,WorkingSetSize,PageFileUsage /format:csv`
      );
      return this.parseWindowsProcessInfo(stdout);
    } catch (error) {
      throw new Error(`Windows process query failed: ${error.message}`);
    }
  }

  /**
   * Unix/Linux平台进程详情
   */
  private async getUnixProcessDetails(pid: number): Promise<any> {
    const fs = require('fs').promises;
    
    try {
      const [stat, status, cmdline] = await Promise.all([
        fs.readFile(`/proc/${pid}/stat`, 'utf8'),
        fs.readFile(`/proc/${pid}/status`, 'utf8'),
        fs.readFile(`/proc/${pid}/cmdline`, 'utf8')
      ]);
      
      return this.parseUnixProcessInfo(stat, status, cmdline);
    } catch (error) {
      throw new Error(`Unix process query failed: ${error.message}`);
    }
  }

  private parseWindowsProcessInfo(csvOutput: string): any {
    // 解析Windows CSV输出
    const lines = csvOutput.trim().split('\n');
    if (lines.length < 2) return null;
    
    const headers = lines[0].split(',');
    const values = lines[1].split(',');
    
    const result: any = {};
    headers.forEach((header, index) => {
      result[header.trim()] = values[index]?.trim();
    });
    
    return result;
  }

  private parseUnixProcessInfo(stat: string, status: string, cmdline: string): any {
    // 解析Unix进程信息
    const statFields = stat.trim().split(' ');
    const statusLines = status.trim().split('\n');
    
    const result: any = {
      pid: parseInt(statFields[0]),
      comm: statFields[1],
      state: statFields[2],
      ppid: parseInt(statFields[3]),
      cmdline: cmdline.replace(/\0/g, ' ').trim()
    };
    
    // 解析status文件
    statusLines.forEach(line => {
      const [key, value] = line.split(':\t');
      if (key && value) {
        result[key.toLowerCase()] = value.trim();
      }
    });
    
    return result;
  }
}