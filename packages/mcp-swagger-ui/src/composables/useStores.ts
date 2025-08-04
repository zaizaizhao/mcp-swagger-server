import {
  useAppStore,
  useThemeStore,
  useServerStore,
  useMonitoringStore,
  useWebSocketStore,
} from "@/stores";

/**
 * 组合式函数，提供对所有 stores 的便捷访问
 */
export function useStores() {
  const appStore = useAppStore();
  const themeStore = useThemeStore();
  const serverStore = useServerStore();
  const monitoringStore = useMonitoringStore();
  const websocketStore = useWebSocketStore();

  return {
    app: appStore,
    theme: themeStore,
    server: serverStore,
    monitoring: monitoringStore,
    websocket: websocketStore,
  };
}

/**
 * 应用状态管理组合式函数
 */
export function useAppState() {
  const { app, server, monitoring, websocket } = useStores();

  return {
    // 全局状态
    loading: app.loading,
    error: app.error,
    notifications: app.notifications,
    globalSettings: app.globalSettings,

    // 服务器状态
    servers: server.servers,
    selectedServer: server.selectedServer,
    serverStats: server.serversByStatus,

    // 监控状态
    systemMetrics: monitoring.systemMetrics,
    systemHealth: monitoring.systemHealth,
    logs: monitoring.filteredLogs,
    logStats: monitoring.logStats,

    // WebSocket 状态
    wsConnected: websocket.connected,
    wsStatus: websocket.connectionStatus,

    // 操作方法
    addNotification: app.addNotification,
    setError: app.setError,
    clearError: app.clearError,
    refreshData: app.refreshData,
  };
}

/**
 * 服务器管理组合式函数
 */
export function useServerManagement() {
  const { server, websocket } = useStores();

  return {
    // 状态
    servers: server.servers,
    selectedServer: server.selectedServer,
    loading: server.loading,
    error: server.error,

    // 统计
    stats: server.serversByStatus,

    // 操作
    fetchServers: server.fetchServers,
    createServer: server.createServer,
    updateServer: server.updateServer,
    deleteServer: server.deleteServer,
    performServerAction: server.performServerAction,
    selectServer: server.selectServer,

    // WebSocket 订阅
    subscribeToServer: websocket.subscribeToServer,
    unsubscribeFromServer: websocket.unsubscribeFromServer,
  };
}

/**
 * 监控数据组合式函数
 */
export function useMonitoring() {
  const { monitoring, websocket } = useStores();

  return {
    // 指标数据
    systemMetrics: monitoring.systemMetrics,
    serverMetrics: monitoring.serverMetrics,
    systemHealth: monitoring.systemHealth,
    metricsHistory: monitoring.metricsHistory,

    // 日志数据
    logs: monitoring.filteredLogs,
    logFilter: monitoring.logFilter,
    logStats: monitoring.logStats,

    // 状态
    loading: monitoring.loading,
    error: monitoring.error,
    realTimeEnabled: monitoring.realTimeEnabled,
    lastUpdate: monitoring.lastUpdate,

    // 操作
    fetchSystemMetrics: monitoring.fetchSystemMetrics,
    fetchServerMetrics: monitoring.fetchServerMetrics,
    fetchLogs: monitoring.fetchLogs,
    setLogFilter: monitoring.setLogFilter,
    clearLogFilter: monitoring.clearLogFilter,
    exportLogs: monitoring.exportLogs,
    clearLogs: monitoring.clearLogs,
    toggleRealTime: monitoring.toggleRealTime,
    refreshAll: monitoring.refreshAll,

    // WebSocket 订阅
    subscribeToMetrics: websocket.subscribeToMetrics,
    subscribeToLogs: websocket.subscribeToLogs,
  };
}

/**
 * WebSocket 连接管理组合式函数
 */
export function useWebSocket() {
  const websocketStore = useWebSocketStore();

  return {
    // 状态
    connected: websocketStore.connected,
    connecting: websocketStore.connecting,
    status: websocketStore.connectionStatus,
    info: websocketStore.connectionInfo,

    // 操作
    connect: websocketStore.connect,
    disconnect: websocketStore.disconnect,
    reconnect: websocketStore.reconnect,

    // 订阅管理
    subscribeToMetrics: websocketStore.subscribeToMetrics,
    subscribeToServer: websocketStore.subscribeToServer,
    subscribeToLogs: websocketStore.subscribeToLogs,
    unsubscribeFromMetrics: websocketStore.unsubscribeFromMetrics,
    unsubscribeFromServer: websocketStore.unsubscribeFromServer,
    unsubscribeFromLogs: websocketStore.unsubscribeFromLogs,

    // 统计信息
    getStats: websocketStore.getConnectionStats,
  };
}

/**
 * 主题管理组合式函数
 */
export function useTheme() {
  const themeStore = useThemeStore();

  return {
    // 状态
    mode: themeStore.mode,
    isDark: themeStore.isDark,
    currentTheme: themeStore.currentTheme,

    // 操作
    setTheme: themeStore.setTheme,
    toggleTheme: themeStore.toggleTheme,
  };
}
