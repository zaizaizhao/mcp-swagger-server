import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { MCPServer, ServerConfig, MCPTool, ServerMetrics } from "@/types";
import { serverAPI } from "@/services/api";
import { useAppStore } from "./app";

export const useServerStore = defineStore("server", () => {
  const appStore = useAppStore();

  // 状态
  const servers = ref<MCPServer[]>([]);
  const selectedServerId = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const selectedServer = computed(
    () => servers.value.find((s) => s.id === selectedServerId.value) || null,
  );

  const runningServers = computed(() =>
    servers.value.filter((s) => s.status === "running"),
  );

  const stoppedServers = computed(() =>
    servers.value.filter((s) => s.status === "stopped"),
  );

  const errorServers = computed(() =>
    servers.value.filter((s) => s.status === "error"),
  );

  const totalServers = computed(() => servers.value.length);

  const serversByStatus = computed(() => ({
    running: runningServers.value.length,
    stopped: stoppedServers.value.length,
    error: errorServers.value.length,
    total: totalServers.value,
  }));

  // Actions
  const setLoading = (value: boolean) => {
    loading.value = value;
  };

  const setError = (errorMessage: string | null) => {
    error.value = errorMessage;
    if (errorMessage) {
      appStore.addNotification({
        type: "error",
        title: "服务器操作错误",
        message: errorMessage,
        duration: 5000,
      });
    }
  };

  const clearError = () => {
    error.value = null;
  };

  // 获取所有服务器
  const fetchServers = async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    tags?: string[];
  }) => {
    setLoading(true);
    try {
      const response = await serverAPI.getServers(params);
      servers.value = response.data || response;
      clearError();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "获取服务器列表失败";
      setError(errorMessage);
      console.error("Failed to fetch servers:", err);
    } finally {
      setLoading(false);
    }
  };

  // 创建服务器
  const createServer = async (config: ServerConfig): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await serverAPI.createServer(config);
      servers.value.push(response);
      appStore.addNotification({
        type: "success",
        title: "服务器创建成功",
        message: `服务器 "${config.name}" 已成功创建`,
        duration: 3000,
      });
      clearError();
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "创建服务器失败";
      setError(errorMessage);
      console.error("Failed to create server:", err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 更新服务器
  const updateServer = async (
    id: string,
    config: Partial<ServerConfig>,
  ): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await serverAPI.updateServer(id, config);
      const index = servers.value.findIndex((s) => s.id === id);
      if (index > -1) {
        servers.value[index] = response;
      }
      appStore.addNotification({
        type: "success",
        title: "服务器更新成功",
        message: `服务器配置已更新`,
        duration: 3000,
      });
      clearError();
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "更新服务器失败";
      setError(errorMessage);
      console.error("Failed to update server:", err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 删除服务器
  const deleteServer = async (id: string): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await serverAPI.deleteServer(id);
      const index = servers.value.findIndex((s) => s.id === id);
      if (index > -1) {
        const serverName = servers.value[index].name;
        servers.value.splice(index, 1);

        // 如果删除的是当前选中的服务器，清除选择
        if (selectedServerId.value === id) {
          selectedServerId.value = null;
        }

        appStore.addNotification({
          type: "success",
          title: "服务器删除成功",
          message: `服务器 "${serverName}" 已删除`,
          duration: 3000,
        });
      }
      clearError();
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "删除服务器失败";
      setError(errorMessage);
      console.error("Failed to delete server:", err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 执行服务器操作
  const performServerAction = async (
    id: string,
    action: "start" | "stop" | "restart",
    force?: boolean,
  ): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await serverAPI.performServerAction(id, action, force);

      // 刷新服务器列表以获取最新状态
      await fetchServers({});

      const actionText = {
        start: "启动",
        stop: "停止",
        restart: "重启",
      }[action];

      appStore.addNotification({
        type: "success",
        title: `服务器${actionText}成功`,
        message: response.message || `服务器已${actionText}`,
        duration: 3000,
      });
      clearError();
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : `服务器操作失败`;
      setError(errorMessage);
      console.error("Failed to perform server action:", err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 获取服务器详情
  const fetchServerDetails = async (id: string): Promise<MCPServer | null> => {
    try {
      const response = await serverAPI.getServerDetails(id);
      // 更新本地服务器数据
      const index = servers.value.findIndex((s) => s.id === id);
      if (index > -1) {
        servers.value[index] = response;
      }
      return response;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "获取服务器详情失败";
      setError(errorMessage);
      console.error("Failed to fetch server details:", err);
      return null;
    }
  };

  // 启动服务器
  const startServer = async (id: string, force?: boolean): Promise<boolean> => {
    return await performServerAction(id, "start", force);
  };

  // 停止服务器
  const stopServer = async (id: string, force?: boolean): Promise<boolean> => {
    return await performServerAction(id, "stop", force);
  };

  // 重启服务器
  const restartServer = async (
    id: string,
    force?: boolean,
  ): Promise<boolean> => {
    return await performServerAction(id, "restart", force);
  };

  // 选择服务器
  const selectServer = (id: string | null) => {
    selectedServerId.value = id;
  };

  // 更新服务器状态（用于WebSocket实时更新）
  const updateServerStatus = (
    id: string,
    status: MCPServer["status"],
    lastError?: string,
  ) => {
    const server = servers.value.find((s) => s.id === id);
    if (server) {
      server.status = status;
      server.updatedAt = new Date();
      if (lastError !== undefined) {
        server.lastError = lastError;
      }
    }
  };

  // 更新服务器指标（用于WebSocket实时更新）
  const updateServerMetrics = (id: string, metrics: Partial<ServerMetrics>) => {
    const server = servers.value.find((s) => s.id === id);
    if (server) {
      server.metrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        activeConnections: 0,
        lastRequestTime: undefined,
        uptime: 0,
        ...server.metrics,
        ...metrics,
      };
      server.updatedAt = new Date();
    }
  };

  // 批量更新服务器状态
  const batchUpdateServers = (
    updates: Array<{
      id: string;
      status?: MCPServer["status"];
      metrics?: Partial<ServerMetrics>;
    }>,
  ) => {
    updates.forEach((update) => {
      const server = servers.value.find((s) => s.id === update.id);
      if (server) {
        if (update.status) {
          server.status = update.status;
        }
        if (update.metrics) {
          server.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            errorRate: 0,
            activeConnections: 0,
            lastRequestTime: undefined,
            uptime: 0,
            ...server.metrics,
            ...update.metrics,
          };
        }
        server.updatedAt = new Date();
      }
    });
  };

  // 批量执行服务器操作
  const performBatchAction = async (
    serverIds: string[],
    action: "start" | "stop" | "restart",
    force?: boolean,
  ): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await serverAPI.performBatchAction(
        serverIds,
        action,
        force,
      );

      // 刷新服务器列表以获取最新状态
      await fetchServers({});

      const actionText = {
        start: "启动",
        stop: "停止",
        restart: "重启",
      }[action];

      appStore.addNotification({
        type: "success",
        title: `批量${actionText}成功`,
        message:
          response.message || `已${actionText} ${serverIds.length} 个服务器`,
        duration: 3000,
      });
      clearError();
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "批量操作失败";
      setError(errorMessage);
      console.error("Failed to perform batch action:", err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 获取服务器健康状态
  const getServerHealth = async (id: string) => {
    try {
      const response = await serverAPI.getServerHealth(id);
      return response;
    } catch (err) {
      console.error("Failed to get server health:", err);
      return null;
    }
  };

  // 获取所有服务器健康状态概览
  const getAllServersHealth = async () => {
    try {
      const response = await serverAPI.getAllServersHealth();
      // 更新本地服务器数据的健康状态和指标
      if (response && Array.isArray(response)) {
        response.forEach((serverHealth: any) => {
          const server = servers.value.find((s) => s.id === serverHealth.id);
          if (server) {
            server.healthy = serverHealth.healthy;
            server.lastHealthCheck = new Date();
            server.metrics = {
              totalRequests: serverHealth.totalRequests || 0,
              successfulRequests: serverHealth.successfulRequests || 0,
              failedRequests: serverHealth.failedRequests || 0,
              averageResponseTime: serverHealth.averageResponseTime || 0,
              errorRate: serverHealth.errorRate || 0,
              activeConnections: serverHealth.activeConnections || 0,
              lastRequestTime: serverHealth.lastRequestTime,
              uptime: serverHealth.uptime || 0,
            };
            server.updatedAt = new Date();
          }
        });
      }
      return response;
    } catch (err) {
      console.error("Failed to get all servers health:", err);
      return null;
    }
  };

  // 执行健康检查
  const performHealthCheck = async (id: string): Promise<boolean> => {
    try {
      const response = await serverAPI.performHealthCheck(id);

      // 更新服务器健康状态
      const server = servers.value.find((s) => s.id === id);
      if (server) {
        server.healthy = response.healthy;
        server.lastHealthCheck = new Date();
        server.updatedAt = new Date();
      }

      appStore.addNotification({
        type: "success",
        title: "健康检查完成",
        message: `服务器健康状态: ${response.healthy ? "健康" : "异常"}`,
        duration: 3000,
      });
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "健康检查失败";
      setError(errorMessage);
      console.error("Failed to perform health check:", err);
      return false;
    }
  };

  // 初始化
  const initialize = async () => {
    await fetchServers({});
  };

  return {
    // 状态
    servers,
    selectedServerId,
    loading,
    error,

    // 计算属性
    selectedServer,
    runningServers,
    stoppedServers,
    errorServers,
    totalServers,
    serversByStatus,

    // Actions
    setLoading,
    setError,
    clearError,
    fetchServers,
    createServer,
    updateServer,
    deleteServer,
    performServerAction,
    startServer,
    stopServer,
    restartServer,
    fetchServerDetails,
    selectServer,
    updateServerStatus,
    updateServerMetrics,
    batchUpdateServers,
    performBatchAction,
    getServerHealth,
    getAllServersHealth,
    performHealthCheck,
    initialize,
  };
});
