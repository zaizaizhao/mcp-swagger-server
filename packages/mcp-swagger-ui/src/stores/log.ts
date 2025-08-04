import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { ElMessage } from "element-plus";

// 日志级别枚举
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  FATAL = "fatal",
}

// 日志条目接口
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  tags?: string[];
}

// 日志过滤器接口
export interface LogFilter {
  levels: LogLevel[];
  sources: string[];
  searchText: string;
  startTime?: Date;
  endTime?: Date;
  tags: string[];
}

// 日志导出选项接口
export interface LogExportOptions {
  format: "json" | "txt" | "csv";
  timeRange: {
    start: Date;
    end: Date;
  };
  filters: LogFilter;
  includeContext: boolean;
  includeStack: boolean;
}

// 日志统计信息接口
export interface LogStats {
  total: number;
  byLevel: Record<LogLevel, number>;
  bySource: Record<string, number>;
  errorRate: number;
  avgResponseTime?: number;
}

export const useLogStore = defineStore("log", () => {
  // 状态
  const logs = ref<LogEntry[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const isConnected = ref(false);
  const autoRefresh = ref(true);
  const refreshInterval = ref(1000); // 1秒

  // 过滤器状态
  const filters = ref<LogFilter>({
    levels: [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
      LogLevel.FATAL,
    ],
    sources: [],
    searchText: "",
    tags: [],
  });

  // 分页状态
  const currentPage = ref(1);
  const pageSize = ref(100);
  const totalCount = ref(0);

  // WebSocket连接
  let wsConnection: WebSocket | null = null;
  let refreshTimer: number | null = null;

  // 计算属性
  const filteredLogs = computed(() => {
    return logs.value.filter((log) => {
      // 级别过滤
      if (!filters.value.levels.includes(log.level)) {
        return false;
      }

      // 来源过滤
      if (
        filters.value.sources.length > 0 &&
        !filters.value.sources.includes(log.source)
      ) {
        return false;
      }

      // 文本搜索
      if (filters.value.searchText) {
        const searchLower = filters.value.searchText.toLowerCase();
        if (
          !log.message.toLowerCase().includes(searchLower) &&
          !log.source.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // 标签过滤
      if (filters.value.tags.length > 0) {
        if (
          !log.tags ||
          !filters.value.tags.some((tag) => log.tags!.includes(tag))
        ) {
          return false;
        }
      }

      // 时间范围过滤
      if (filters.value.startTime && log.timestamp < filters.value.startTime) {
        return false;
      }

      if (filters.value.endTime && log.timestamp > filters.value.endTime) {
        return false;
      }

      return true;
    });
  });

  const logStats = computed((): LogStats => {
    const stats: LogStats = {
      total: filteredLogs.value.length,
      byLevel: {
        [LogLevel.DEBUG]: 0,
        [LogLevel.INFO]: 0,
        [LogLevel.WARN]: 0,
        [LogLevel.ERROR]: 0,
        [LogLevel.FATAL]: 0,
      },
      bySource: {},
      errorRate: 0,
    };

    filteredLogs.value.forEach((log) => {
      stats.byLevel[log.level]++;
      stats.bySource[log.source] = (stats.bySource[log.source] || 0) + 1;
    });

    const errorCount =
      stats.byLevel[LogLevel.ERROR] + stats.byLevel[LogLevel.FATAL];
    stats.errorRate = stats.total > 0 ? (errorCount / stats.total) * 100 : 0;

    return stats;
  });

  const availableSources = computed(() => {
    const sources = new Set<string>();
    logs.value.forEach((log) => sources.add(log.source));
    return Array.from(sources).sort();
  });

  const availableTags = computed(() => {
    const tags = new Set<string>();
    logs.value.forEach((log) => {
      if (log.tags) {
        log.tags.forEach((tag) => tags.add(tag));
      }
    });
    return Array.from(tags).sort();
  });

  const paginatedLogs = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    return filteredLogs.value.slice(start, end);
  });

  // 方法
  const connectWebSocket = () => {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/logs/stream`;
      wsConnection = new WebSocket(wsUrl);

      wsConnection.onopen = () => {
        isConnected.value = true;
        error.value = null;
        ElMessage.success("日志流连接成功");
      };

      wsConnection.onmessage = (event) => {
        try {
          const logEntry: LogEntry = JSON.parse(event.data);
          logEntry.timestamp = new Date(logEntry.timestamp);
          addLogEntry(logEntry);
        } catch (err) {
          console.error("解析日志消息失败:", err);
        }
      };

      wsConnection.onclose = () => {
        isConnected.value = false;
        ElMessage.warning("日志流连接已断开");

        // 自动重连
        if (autoRefresh.value) {
          setTimeout(connectWebSocket, 3000);
        }
      };

      wsConnection.onerror = (err) => {
        error.value = "日志流连接错误";
        console.error("WebSocket错误:", err);
      };
    } catch (err) {
      error.value = "无法创建WebSocket连接";
      console.error("WebSocket创建失败:", err);
    }
  };

  const disconnectWebSocket = () => {
    if (wsConnection) {
      wsConnection.close();
      wsConnection = null;
    }
    isConnected.value = false;
  };

  const addLogEntry = (logEntry: LogEntry) => {
    logs.value.unshift(logEntry);

    // 限制内存中的日志数量
    if (logs.value.length > 10000) {
      logs.value = logs.value.slice(0, 8000);
    }
  };

  const loadHistoryLogs = async (page: number = 1, size: number = 100) => {
    loading.value = true;
    error.value = null;

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
        levels: filters.value.levels.join(","),
        sources: filters.value.sources.join(","),
        search: filters.value.searchText,
        tags: filters.value.tags.join(","),
      });

      if (filters.value.startTime) {
        params.append("startTime", filters.value.startTime.toISOString());
      }

      if (filters.value.endTime) {
        params.append("endTime", filters.value.endTime.toISOString());
      }

      const response = await fetch(`/api/logs?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // 转换时间戳
      const historyLogs = data.logs.map((log: any) => ({
        ...log,
        timestamp: new Date(log.timestamp),
      }));

      if (page === 1) {
        logs.value = historyLogs;
      } else {
        logs.value.push(...historyLogs);
      }

      totalCount.value = data.total;
      currentPage.value = page;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "加载日志失败";
      ElMessage.error(error.value);
    } finally {
      loading.value = false;
    }
  };

  const clearLogs = () => {
    logs.value = [];
    totalCount.value = 0;
    currentPage.value = 1;
  };

  const exportLogs = async (options: LogExportOptions): Promise<Blob> => {
    const logsToExport = filteredLogs.value.filter((log) => {
      return (
        log.timestamp >= options.timeRange.start &&
        log.timestamp <= options.timeRange.end
      );
    });

    let content = "";

    switch (options.format) {
      case "json":
        content = JSON.stringify(
          logsToExport.map((log) => ({
            ...log,
            context: options.includeContext ? log.context : undefined,
            stack: options.includeStack ? log.stack : undefined,
          })),
          null,
          2,
        );
        break;

      case "csv":
        const headers = ["timestamp", "level", "source", "message"];
        if (options.includeContext) headers.push("context");
        if (options.includeStack) headers.push("stack");

        content = [
          headers.join(","),
          ...logsToExport.map((log) =>
            [
              log.timestamp.toISOString(),
              log.level,
              log.source,
              `"${log.message.replace(/"/g, '""')}"`,
              ...(options.includeContext
                ? [JSON.stringify(log.context || {})]
                : []),
              ...(options.includeStack
                ? [`"${(log.stack || "").replace(/"/g, '""')}"`]
                : []),
            ].join(","),
          ),
        ].join("\n");
        break;

      case "txt":
      default:
        content = logsToExport
          .map((log) => {
            let line = `[${log.timestamp.toISOString()}] ${log.level.toUpperCase()} ${log.source}: ${log.message}`;

            if (options.includeContext && log.context) {
              line += `\nContext: ${JSON.stringify(log.context, null, 2)}`;
            }

            if (options.includeStack && log.stack) {
              line += `\nStack: ${log.stack}`;
            }

            return line;
          })
          .join("\n\n");
        break;
    }

    const mimeTypes = {
      json: "application/json",
      csv: "text/csv",
      txt: "text/plain",
    };

    return new Blob([content], { type: mimeTypes[options.format] });
  };

  const updateFilters = (newFilters: Partial<LogFilter>) => {
    filters.value = { ...filters.value, ...newFilters };
    currentPage.value = 1;

    if (!isConnected.value) {
      loadHistoryLogs(1, pageSize.value);
    }
  };

  const setAutoRefresh = (enabled: boolean) => {
    autoRefresh.value = enabled;

    if (enabled) {
      connectWebSocket();
    } else {
      disconnectWebSocket();
    }
  };

  const jumpToPage = (page: number) => {
    if (!isConnected.value) {
      loadHistoryLogs(page, pageSize.value);
    } else {
      currentPage.value = page;
    }
  };

  // 初始化
  const initialize = () => {
    if (autoRefresh.value) {
      connectWebSocket();
    } else {
      loadHistoryLogs(1, pageSize.value);
    }
  };

  // 清理
  const cleanup = () => {
    disconnectWebSocket();
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  };

  return {
    // 状态
    logs,
    loading,
    error,
    isConnected,
    autoRefresh,
    refreshInterval,
    filters,
    currentPage,
    pageSize,
    totalCount,

    // 计算属性
    filteredLogs,
    logStats,
    availableSources,
    availableTags,
    paginatedLogs,

    // 方法
    connectWebSocket,
    disconnectWebSocket,
    loadHistoryLogs,
    clearLogs,
    exportLogs,
    updateFilters,
    setAutoRefresh,
    jumpToPage,
    initialize,
    cleanup,
  };
});
