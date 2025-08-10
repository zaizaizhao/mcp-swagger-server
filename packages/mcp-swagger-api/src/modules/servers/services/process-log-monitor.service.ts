import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import * as path from 'path';
import { Tail } from 'tail';

export interface ProcessLogEntry {
  serverId: string;
  pid: number;
  timestamp: Date;
  level: 'stdout' | 'stderr' | 'file';
  source: string;
  message: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class ProcessLogMonitorService {
  private readonly logger = new Logger(ProcessLogMonitorService.name);
  private readonly logTails = new Map<string, Tail>();
  private readonly logBuffers = new Map<string, ProcessLogEntry[]>();
  private readonly maxBufferSize = 1000;

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * 开始监控进程日志
   */
  startLogMonitoring(serverId: string, pid: number, logFilePath?: string): void {
    this.logger.log(`Starting log monitoring for server ${serverId} (PID: ${pid})`);
    
    // 监控日志文件（如果提供）
    if (logFilePath && fs.existsSync(logFilePath)) {
      this.startFileLogMonitoring(serverId, logFilePath);
    }
    
    // 初始化日志缓冲区
    if (!this.logBuffers.has(serverId)) {
      this.logBuffers.set(serverId, []);
    }
  }

  /**
   * 停止日志监控
   */
  stopLogMonitoring(serverId: string): void {
    const tail = this.logTails.get(serverId);
    if (tail) {
      tail.unwatch();
      this.logTails.delete(serverId);
    }
    
    this.logger.log(`Stopped log monitoring for server ${serverId}`);
  }

  /**
   * 监控日志文件
   */
  private startFileLogMonitoring(serverId: string, logFilePath: string): void {
    try {
      const tail = new Tail(logFilePath, {
        separator: /[\r]{0,1}\n/,
        fromBeginning: false,
        fsWatchOptions: {},
        flushAtEOF: true
      });

      tail.on('line', (data: string) => {
        const logEntry: ProcessLogEntry = {
          serverId,
          pid: 0, // 从文件无法直接获取PID
          timestamp: new Date(),
          level: 'file',
          source: path.basename(logFilePath),
          message: data,
          metadata: { filePath: logFilePath }
        };
        
        this.addLogEntry(serverId, logEntry);
      });

      tail.on('error', (error: Error) => {
        this.logger.error(`Log file monitoring error for ${serverId}:`, error);
      });

      this.logTails.set(serverId, tail);
      this.logger.log(`Started file log monitoring: ${logFilePath}`);
    } catch (error) {
      this.logger.error(`Failed to start file log monitoring for ${serverId}:`, error);
    }
  }

  /**
   * 添加日志条目
   */
  addLogEntry(serverId: string, logEntry: ProcessLogEntry): void {
    let buffer = this.logBuffers.get(serverId) || [];
    buffer.push(logEntry);
    
    // 限制缓冲区大小
    if (buffer.length > this.maxBufferSize) {
      buffer = buffer.slice(-this.maxBufferSize);
    }
    
    this.logBuffers.set(serverId, buffer);
    
    // 发送实时日志事件
    this.eventEmitter.emit('process.log_entry', logEntry);
  }

  /**
   * 获取日志历史
   */
  getLogHistory(serverId: string, limit?: number): ProcessLogEntry[] {
    const buffer = this.logBuffers.get(serverId) || [];
    return limit ? buffer.slice(-limit) : buffer;
  }

  /**
   * 搜索日志
   */
  searchLogs(serverId: string, query: {
    keyword?: string;
    level?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): ProcessLogEntry[] {
    let logs = this.logBuffers.get(serverId) || [];
    
    // 应用过滤条件
    if (query.keyword) {
      logs = logs.filter(log => 
        log.message.toLowerCase().includes(query.keyword!.toLowerCase())
      );
    }
    
    if (query.level) {
      logs = logs.filter(log => log.level === query.level);
    }
    
    if (query.startTime) {
      logs = logs.filter(log => log.timestamp >= query.startTime!);
    }
    
    if (query.endTime) {
      logs = logs.filter(log => log.timestamp <= query.endTime!);
    }
    
    // 应用限制
    if (query.limit) {
      logs = logs.slice(-query.limit);
    }
    
    return logs;
  }

  /**
   * 清空日志缓冲区
   */
  clearLogBuffer(serverId: string): void {
    this.logBuffers.set(serverId, []);
    this.logger.log(`Cleared log buffer for server ${serverId}`);
  }
}