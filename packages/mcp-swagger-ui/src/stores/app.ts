import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { GlobalSettings, Notification, SystemHealth } from "@/types";

export const useAppStore = defineStore("app", () => {
  // 状态
  const loading = ref(false);
  const error = ref<string | null>(null);
  const notifications = ref<Notification[]>([]);
  const startTime = Date.now(); // 应用启动时间

  const globalSettings = ref<GlobalSettings>({
    theme: "light",
    language: "zh",
    autoRefresh: true,
    refreshInterval: 30000, // 30秒
    logLevel: "info",
    maxLogEntries: 1000,
    enableNotifications: true,
    enableWebSocket: true,
    enableSounds: false,
  });

  // 系统健康状态
  const systemHealth = ref<SystemHealth>({
    status: "healthy",
    errorCount: 0,
    uptime: 0,
    version: "1.0.0",
    lastCheck: new Date(),
    services: {
      api: "online",
      database: "online",
      websocket: "connected",
    },
  });

  // 计算属性
  const hasError = computed(() => !!error.value);
  const isHealthy = computed(() => systemHealth.value.status === "healthy");
  const unreadNotifications = computed(() =>
    notifications.value.filter((n) => !n.read),
  );
  const criticalNotifications = computed(() =>
    notifications.value.filter((n) => n.type === "error" && !n.read),
  );

  // Actions
  const setLoading = (value: boolean) => {
    loading.value = value;
  };

  const setError = (errorMessage: string | null) => {
    error.value = errorMessage;
    if (errorMessage) {
      addNotification({
        type: "error",
        title: "系统错误",
        message: errorMessage,
        duration: 5000,
      });
    }
  };

  const clearError = () => {
    error.value = null;
  };

  // 通知管理
  const addNotification = (
    notification: Omit<Notification, "id" | "timestamp" | "read">,
  ) => {
    const newNotification: Notification = {
      ...notification,
      id: `notification-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date(),
      read: false,
    };

    notifications.value.unshift(newNotification);

    // 限制通知数量
    if (notifications.value.length > 100) {
      notifications.value = notifications.value.slice(0, 100);
    }

    // 自动移除通知
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        removeNotification(newNotification.id);
      }, notification.duration);
    }
  };

  const removeNotification = (id: string) => {
    const index = notifications.value.findIndex((n) => n.id === id);
    if (index > -1) {
      notifications.value.splice(index, 1);
    }
  };

  const markNotificationAsRead = (id: string) => {
    const notification = notifications.value.find((n) => n.id === id);
    if (notification) {
      notification.read = true;
    }
  };

  const markAllNotificationsAsRead = () => {
    notifications.value.forEach((n) => (n.read = true));
  };

  const clearAllNotifications = () => {
    notifications.value = [];
  };

  // 全局设置管理
  const updateGlobalSettings = (settings: Partial<GlobalSettings>) => {
    globalSettings.value = { ...globalSettings.value, ...settings };
    // 持久化到本地存储
    localStorage.setItem(
      "mcp-gateway-settings",
      JSON.stringify(globalSettings.value),
    );
  };

  const loadGlobalSettings = () => {
    try {
      const saved = localStorage.getItem("mcp-gateway-settings");
      if (saved) {
        const parsedSettings = JSON.parse(saved);
        globalSettings.value = { ...globalSettings.value, ...parsedSettings };
      }
    } catch (error) {
      console.warn("Failed to load global settings:", error);
    }
  };

  // 系统健康检查
  const updateSystemHealth = (health: Partial<SystemHealth>) => {
    systemHealth.value = {
      ...systemHealth.value,
      ...health,
      lastCheck: new Date(),
    };
  };

  const checkSystemHealth = async () => {
    try {
      // TODO: 实际的健康检查逻辑
      // const healthData = await api.checkHealth()

      // 模拟健康检查
      const isHealthy = Math.random() > 0.1; // 90% 概率健康
      const errorCount = isHealthy ? 0 : Math.floor(Math.random() * 3) + 1;

      updateSystemHealth({
        status: isHealthy ? "healthy" : "error",
        errorCount,
        uptime: Date.now() - startTime,
        services: {
          api: isHealthy ? "online" : "offline",
          database: "online",
          websocket: "connected",
        },
      });
    } catch (error) {
      updateSystemHealth({
        status: "error",
        errorCount: systemHealth.value.errorCount + 1,
        services: {
          ...systemHealth.value.services,
          api: "offline",
        },
      });
    }
  };

  // 数据刷新
  const refreshData = async () => {
    setLoading(true);
    try {
      await checkSystemHealth();
      // TODO: 刷新其他数据
      addNotification({
        type: "success",
        title: "刷新成功",
        message: "系统数据已更新",
        duration: 2000,
      });
    } catch (error) {
      setError("数据刷新失败");
    } finally {
      setLoading(false);
    }
  };

  // 初始化
  const initialize = () => {
    loadGlobalSettings();
    checkSystemHealth();
  };

  return {
    // 状态
    loading,
    error,
    notifications,
    globalSettings,
    systemHealth,

    // 计算属性
    hasError,
    isHealthy,
    unreadNotifications,
    criticalNotifications,

    // Actions
    setLoading,
    setError,
    clearError,
    addNotification,
    removeNotification,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearAllNotifications,
    updateGlobalSettings,
    loadGlobalSettings,
    updateSystemHealth,
    checkSystemHealth,
    refreshData,
    initialize,
  };
});
