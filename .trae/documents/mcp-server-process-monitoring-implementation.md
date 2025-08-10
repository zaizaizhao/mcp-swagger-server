# 基于进程ID的MCP服务器资源监控与日志获取技术实现文档

## 1. 概述

本文档详细说明如何通过MCP服务器的进程ID（PID）来获取其资源使用情况和日志信息的技术实现方案。基于当前架构分析，这种方案是完全可行的，并且能够显著改进现有的进程监控机制。

## 2. 当前架构分析

### 2.1 现有进程管理机制

当前系统通过 `ProcessManagerService` 管理MCP服务器进程：

```typescript
// 当前进程信息存储结构
interface ProcessInfo {
  id: string;           // 服务器ID
  name: string;         // 服务器名称
  pid: number;          // 进程ID
  startTime: Date;      // 启动时间
  status: ProcessStatus; // 进程状态
  process: ChildProcess; // 子进程引用
  // ... 其他字段
}
```

### 2.2 当前监控局限性

**问题1：资源监控不准确**

```typescript
// 当前实现返回主进程资源，而非子进程资源
async getProcessMetrics(serverId: string) {
  const memoryUsage = process.memoryUsage(); // ❌ 主进程内存
  const cpuUsage = process.cpuUsage();       // ❌ 主进程CPU
  return { memoryUsage, cpuUsage };
}
```

**问题2：日志获取机制不完善**

* 当前日志主要通过数据库存储

* 缺乏实时日志流获取

* 无法获取子进程的标准输出/错误流

## 3. 技术可行性分析

### 3.1 资源监控可行性

✅ **完全可行**

通过进程ID可以获取以下资源信息：

* **内存使用量**：RSS、VSZ、堆内存等

* **CPU使用率**：实时CPU占用百分比

* **文件描述符**：打开的文件数量

* **网络连接**：TCP/UDP连接状态

* **磁盘I/O**：读写字节数和操作次数

### 3.2 日志获取可行性

✅ **完全可行**

可以通过以下方式获取日志：

* **标准输出/错误流**：通过子进程的stdio管道

* **日志文件监控**：监控进程写入的日志文件

* **系统日志**：通过系统日志API获取进程相关日志

## 4. 技术实现方案

### 4.1 资源监控实现

#### 4.1.1 跨平台进程监控库选择

推荐使用 `pidusage` 库：

```bash
npm install pidusage @types/pidusage
```

#### 4.1.2 资源监控服务实现

```typescript
// src/modules/servers/services/process-resource-monitor.service.ts
import { Injectable, Logger } from '@nestjs/common';
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
      const metrics = await this.getProcessResourceMetrics(pid);
      if (metrics) {
        this.saveResourceHistory(serverId, metrics);
        
        // 发送实时更新事件
        this.eventEmitter.emit('process.resource_update', {
          serverId,
          metrics,
          timestamp: new Date()
        });
      }
    }, intervalMs);

    this.monitoringIntervals.set(serverId, interval);
    this.logger.log(`Started resource monitoring for server ${serverId} (PID: ${pid})`);
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
```

### 4.2 日志监控实现

#### 4.2.1 进程日志监控服务

```typescript
// src/modules/servers/services/process-log-monitor.service.ts
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
```

### 4.3 改进ProcessManagerService

```typescript
// 在现有ProcessManagerService中添加以下方法

export class ProcessManagerService {
  constructor(
    // ... 现有依赖
    private readonly resourceMonitor: ProcessResourceMonitorService,
    private readonly logMonitor: ProcessLogMonitorService,
  ) {}

  /**
   * 启动进程（改进版）
   */
  async startProcess(config: ProcessConfig): Promise<ProcessInfo> {
    // ... 现有启动逻辑
    
    const processInfo = await this.createProcess(config);
    
    // 启动资源监控
    this.resourceMonitor.startMonitoring(
      processInfo.id, 
      processInfo.pid, 
      5000 // 5秒间隔
    );
    
    // 启动日志监控
    this.logMonitor.startLogMonitoring(
      processInfo.id,
      processInfo.pid,
      config.logFilePath
    );
    
    // 监控子进程输出
    this.setupProcessOutputMonitoring(processInfo);
    
    return processInfo;
  }

  /**
   * 停止进程（改进版）
   */
  async stopProcess(serverId: string, force = false): Promise<void> {
    // 停止监控
    this.resourceMonitor.stopMonitoring(serverId);
    this.logMonitor.stopLogMonitoring(serverId);
    
    // ... 现有停止逻辑
  }

  /**
   * 监控进程输出
   */
  private setupProcessOutputMonitoring(processInfo: ProcessInfo): void {
    const { id: serverId, pid, process: childProcess } = processInfo;
    
    // 监控标准输出
    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data: Buffer) => {
        const logEntry: ProcessLogEntry = {
          serverId,
          pid,
          timestamp: new Date(),
          level: 'stdout',
          source: 'process',
          message: data.toString().trim()
        };
        
        this.logMonitor.addLogEntry(serverId, logEntry);
      });
    }
    
    // 监控标准错误
    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data: Buffer) => {
        const logEntry: ProcessLogEntry = {
          serverId,
          pid,
          timestamp: new Date(),
          level: 'stderr',
          source: 'process',
          message: data.toString().trim()
        };
        
        this.logMonitor.addLogEntry(serverId, logEntry);
      });
    }
  }

  /**
   * 获取进程完整信息（改进版）
   */
  async getProcessFullInfo(serverId: string): Promise<{
    basicInfo: ProcessInfo;
    resourceMetrics: ProcessResourceMetrics | null;
    systemInfo: SystemResourceInfo;
    resourceHistory: ProcessResourceMetrics[];
    recentLogs: ProcessLogEntry[];
  } | null> {
    const basicInfo = this.getProcessInfo(serverId);
    if (!basicInfo) {
      return null;
    }
    
    const [resourceMetrics, systemInfo, resourceHistory, recentLogs] = await Promise.all([
      this.resourceMonitor.getProcessResourceMetrics(basicInfo.pid),
      Promise.resolve(this.resourceMonitor.getSystemResourceInfo()),
      Promise.resolve(this.resourceMonitor.getResourceHistory(serverId, 100)),
      Promise.resolve(this.logMonitor.getLogHistory(serverId, 50))
    ]);
    
    return {
      basicInfo,
      resourceMetrics,
      systemInfo,
      resourceHistory,
      recentLogs
    };
  }
}
```

### 4.4 API端点更新

```typescript
// servers.controller.ts 中添加新的端点

/**
 * 获取进程资源监控数据
 */
@Get(':id/process/resources')
@ApiOperation({ summary: '获取进程资源监控数据' })
async getProcessResources(
  @Param('id') id: string,
  @Query('limit') limit?: number
) {
  try {
    const processInfo = await this.processManager.getProcessInfo(id);
    if (!processInfo) {
      throw new HttpException('Process not found', HttpStatus.NOT_FOUND);
    }
    
    const [currentMetrics, history, systemInfo] = await Promise.all([
      this.resourceMonitor.getProcessResourceMetrics(processInfo.pid),
      this.resourceMonitor.getResourceHistory(id, limit || 100),
      Promise.resolve(this.resourceMonitor.getSystemResourceInfo())
    ]);
    
    return {
      current: currentMetrics,
      history,
      system: systemInfo,
      timestamp: new Date()
    };
  } catch (error) {
    throw new HttpException(
      `Failed to get process resources: ${error.message}`,
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * 获取进程日志
 */
@Get(':id/process/logs/stream')
@ApiOperation({ summary: '获取进程日志流' })
async getProcessLogStream(
  @Param('id') id: string,
  @Query() query: {
    keyword?: string;
    level?: string;
    limit?: number;
  }
) {
  try {
    const logs = this.logMonitor.searchLogs(id, {
      keyword: query.keyword,
      level: query.level,
      limit: query.limit || 100
    });
    
    return {
      logs,
      total: logs.length,
      timestamp: new Date()
    };
  } catch (error) {
    throw new HttpException(
      `Failed to get process logs: ${error.message}`,
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * 获取进程完整信息
 */
@Get(':id/process/full')
@ApiOperation({ summary: '获取进程完整信息' })
async getProcessFullInfo(@Param('id') id: string) {
  try {
    const fullInfo = await this.processManager.getProcessFullInfo(id);
    if (!fullInfo) {
      throw new HttpException('Process not found', HttpStatus.NOT_FOUND);
    }
    
    return fullInfo;
  } catch (error) {
    throw new HttpException(
      `Failed to get process full info: ${error.message}`,
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
```

## 5. 前端集成

### 5.1 API服务更新

```typescript
// services/api.ts 中添加新的API调用

export const serverAPI = {
  // ... 现有方法
  
  // 获取进程资源监控数据
  getProcessResources: (id: string, limit?: number) => 
    api.get(`/v1/servers/${id}/process/resources`, { params: { limit } }),
  
  // 获取进程日志流
  getProcessLogStream: (id: string, query?: {
    keyword?: string;
    level?: string;
    limit?: number;
  }) => api.get(`/v1/servers/${id}/process/logs/stream`, { params: query }),
  
  // 获取进程完整信息
  getProcessFullInfo: (id: string) => 
    api.get(`/v1/servers/${id}/process/full`)
};
```

### 5.2 ServerDetail组件更新

```vue
<!-- ServerDetail.vue 中的改进 -->
<template>
  <!-- 现有模板内容 -->
  
  <!-- 性能监控改进 -->
  <el-card class="performance-card">
    <template #header>
      <span>实时性能监控</span>
      <el-button @click="refreshResourceMetrics" size="small">刷新</el-button>
    </template>
    
    <el-row :gutter="16">
      <el-col :span="6">
        <div class="metric-item">
          <span class="metric-label">CPU使用率</span>
          <span class="metric-value">{{ resourceMetrics?.cpu || 0 }}%</span>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="metric-item">
          <span class="metric-label">内存使用</span>
          <span class="metric-value">{{ formatBytes(resourceMetrics?.memory || 0) }}</span>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="metric-item">
          <span class="metric-label">进程ID</span>
          <span class="metric-value">{{ resourceMetrics?.pid || 'N/A' }}</span>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="metric-item">
          <span class="metric-label">运行时长</span>
          <span class="metric-value">{{ formatDuration(resourceMetrics?.elapsed || 0) }}</span>
        </div>
      </el-col>
    </el-row>
    
    <!-- 资源使用历史图表 -->
    <div class="resource-charts">
      <el-row :gutter="16">
        <el-col :span="12">
          <div ref="cpuChartRef" class="chart-container"></div>
        </el-col>
        <el-col :span="12">
          <div ref="memoryChartRef" class="chart-container"></div>
        </el-col>
      </el-row>
    </div>
  </el-card>
  
  <!-- 实时日志改进 -->
  <el-card class="logs-card">
    <template #header>
      <span>实时日志</span>
      <div class="log-controls">
        <el-select v-model="logLevel" placeholder="日志级别" size="small">
          <el-option label="全部" value=""></el-option>
          <el-option label="标准输出" value="stdout"></el-option>
          <el-option label="标准错误" value="stderr"></el-option>
          <el-option label="文件日志" value="file"></el-option>
        </el-select>
        <el-input 
          v-model="logKeyword" 
          placeholder="搜索关键词" 
          size="small" 
          style="width: 200px; margin-left: 10px;"
        ></el-input>
        <el-button @click="refreshLogs" size="small">刷新</el-button>
        <el-button @click="clearLogs" size="small">清空</el-button>
      </div>
    </template>
    
    <div class="log-container" ref="logContainer">
      <div 
        v-for="log in filteredLogs" 
        :key="log.timestamp + log.message"
        :class="['log-entry', `log-${log.level}`]"
      >
        <span class="log-time">{{ formatLogTime(log.timestamp) }}</span>
        <span class="log-level">{{ log.level.toUpperCase() }}</span>
        <span class="log-source">{{ log.source }}</span>
        <span class="log-message">{{ log.message }}</span>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import { serverAPI } from '@/services/api'

// 响应式数据
const resourceMetrics = ref<any>(null)
const resourceHistory = ref<any[]>([])
const processLogs = ref<any[]>([])
const logLevel = ref('')
const logKeyword = ref('')

// 图表引用
const cpuChartRef = ref<HTMLElement>()
const memoryChartRef = ref<HTMLElement>()
let cpuChart: echarts.ECharts | null = null
let memoryChart: echarts.ECharts | null = null

// 计算属性
const filteredLogs = computed(() => {
  let logs = processLogs.value
  
  if (logLevel.value) {
    logs = logs.filter(log => log.level === logLevel.value)
  }
  
  if (logKeyword.value) {
    logs = logs.filter(log => 
      log.message.toLowerCase().includes(logKeyword.value.toLowerCase())
    )
  }
  
  return logs
})

// 方法
const refreshResourceMetrics = async () => {
  try {
    const response = await serverAPI.getProcessResources(serverId.value, 100)
    resourceMetrics.value = response.data.current
    resourceHistory.value = response.data.history
    
    // 更新图表
    updateResourceCharts()
  } catch (error) {
    console.error('Failed to refresh resource metrics:', error)
  }
}

const refreshLogs = async () => {
  try {
    const response = await serverAPI.getProcessLogStream(serverId.value, {
      keyword: logKeyword.value,
      level: logLevel.value,
      limit: 200
    })
    processLogs.value = response.data.logs
  } catch (error) {
    console.error('Failed to refresh logs:', error)
  }
}

const updateResourceCharts = () => {
  if (!resourceHistory.value.length) return
  
  const times = resourceHistory.value.map(item => 
    new Date(item.timestamp).toLocaleTimeString()
  )
  const cpuData = resourceHistory.value.map(item => item.cpu)
  const memoryData = resourceHistory.value.map(item => 
    Math.round(item.memory / 1024 / 1024) // 转换为MB
  )
  
  // 更新CPU图表
  if (cpuChart) {
    cpuChart.setOption({
      title: { text: 'CPU使用率 (%)' },
      xAxis: { data: times },
      series: [{ data: cpuData }]
    })
  }
  
  // 更新内存图表
  if (memoryChart) {
    memoryChart.setOption({
      title: { text: '内存使用 (MB)' },
      xAxis: { data: times },
      series: [{ data: memoryData }]
    })
  }
}

const initCharts = () => {
  if (cpuChartRef.value) {
    cpuChart = echarts.init(cpuChartRef.value)
    cpuChart.setOption({
      title: { text: 'CPU使用率 (%)' },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value', min: 0, max: 100 },
      series: [{
        type: 'line',
        data: [],
        smooth: true,
        lineStyle: { color: '#409EFF' }
      }]
    })
  }
  
  if (memoryChartRef.value) {
    memoryChart = echarts.init(memoryChartRef.value)
    memoryChart.setOption({
      title: { text: '内存使用 (MB)' },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value' },
      series: [{
        type: 'line',
        data: [],
        smooth: true,
        lineStyle: { color: '#67C23A' }
      }]
    })
  }
}

// 生命周期
onMounted(() => {
  // 初始化图表
  nextTick(() => {
    initCharts()
  })
  
  // 获取初始数据
  refreshResourceMetrics()
  refreshLogs()
  
  // 设置定时刷新
  const resourceInterval = setInterval(refreshResourceMetrics, 5000)
  const logInterval = setInterval(refreshLogs, 3000)
  
  onUnmounted(() => {
    clearInterval(resourceInterval)
    clearInterval(logInterval)
    
    // 销毁图表
    if (cpuChart) {
      cpuChart.dispose()
    }
    if (memoryChart) {
      memoryChart.dispose()
    }
  })
})
</script>
```

## 6. 实施步骤

### 6.1 第一阶段：基础设施搭建

1. **安装依赖包**

   ```bash
   cd packages/mcp-swagger-api
   npm install pidusage @types/pidusage tail @types/tail
   ```

2. **创建监控服务**

   * 创建 `ProcessResourceMonitorService`

   * 创建 `ProcessLogMonitorService`

   * 更新依赖注入配置

3. **数据库迁移**（如需持久化）

   ```sql
   -- 创建资源监控历史表
   CREATE TABLE process_resource_history (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     server_id VARCHAR(255) NOT NULL,
     pid INTEGER NOT NULL,
     cpu_usage DECIMAL(5,2),
     memory_usage BIGINT,
     timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     INDEX idx_server_timestamp (server_id, timestamp)
   );
   ```

### 6.2 第二阶段：服务集成

1. **更新ProcessManagerService**

   * 集成资源监控

   * 集成日志监控

   * 添加进程输出监控

2. **更新API端点**

   * 添加资源监控端点

   * 添加日志流端点

   * 更新现有端点返回数据

3. **测试后端功能**

   * 单元测试

   * 集成测试

   * 性能测试

### 6.3 第三阶段：前端集成

1. **更新API服务**

   * 添加新的API调用方法

   * 更新类型定义

2. **更新ServerDetail组件**

   * 添加实时资源监控

   * 改进日志显示

   * 添加图表展示

3. **WebSocket集成**（可选）

   * 实时资源数据推送

   * 实时日志流推送

### 6.4 第四阶段：优化和完善

1. **性能优化**

   * 监控频率调优

   * 内存使用优化

   * 缓存策略优化

2. **错误处理**

   * 进程不存在处理

   * 权限不足处理

   * 跨平台兼容性

3. **用户体验**

   * 加载状态显示

   * 错误提示优化

   * 响应式设计

## 7. 注意事项和最佳实践

### 7.1 性能考虑

1. **监控频率**

   * 资源监控：建议5-10秒间隔

   * 日志监控：实时或1-3秒间隔

   * 避免过于频繁的监控导致性能问题

2. **内存管理**

   * 限制历史数据大小

   * 定期清理过期数据

   * 使用循环缓冲区

3. **CPU使用**

   * 避免同步阻塞操作

   * 使用异步处理

   * 合理使用缓存

### 7.2 安全考虑

1. **权限控制**

   * 确保只能监控自己创建的进程

   * 验证进程所有权

   * 限制敏感信息访问

2. **数据保护**

   * 日志内容脱敏

   * 敏感信息过滤

   * 访问权限控制

### 7.3 跨平台兼容性

1. **Windows平台**

   * 使用WMI查询进程信息

   * 处理路径分隔符差异

   * 考虑权限模型差异

2. **Unix/Linux平台**

   * 使用/proc文件系统

   * 处理信号机制

   * 考虑容器环境

3. **macOS平台**

   * 使用系统API

   * 处理沙盒限制

   * 考虑权限要求

## 8. 总结

基于进程ID获取MCP服务器资源使用情况和日志信息的方案是**完全可行**的，并且能够显著改进当前的监控机制。通过实施本文档提出的技术方案，可以实现：

✅ **准确的资源监控**：获取真实的CPU、内存使用情况
✅ **实时日志流**：监控进程输出和日志文件
✅ **历史数据追踪**：保存和查询历史监控数据
✅ **跨平台支持**：Windows、Linux、macOS兼容
✅ **高性能实现**：优化的监控机制，最小化性能影响
✅ **用户友好界面**：直观的图表和日志展示

该
