<template>
  <div class="dashboard">
    <!-- 页面头部 -->
    <div class="dashboard-header">
      <div class="title-section">
        <h1>
          <el-icon><Monitor /></el-icon>
          {{ $t("dashboard.title") }}
        </h1>
        <p class="subtitle">{{ $t("dashboard.systemStatus") }}</p>
      </div>

      <div class="header-actions">
        <el-button
          :type="isMonitoring ? 'danger' : 'primary'"
          @click="togglePerformanceMonitoring"
          :icon="isMonitoring ? VideoPause : VideoPlay"
        >
          {{ isMonitoring ? $t("logs.pause") : $t("dashboard.refresh") }}
        </el-button>
        <el-button @click="refreshData" :loading="loading" :icon="Refresh">
          {{ $t("dashboard.refresh") }}
        </el-button>
      </div>
    </div>

    <!-- 系统概览统计 -->
    <div class="overview-section">
      <el-row :gutter="20">
        <el-col :span="6">
          <el-card class="metric-card">
            <div class="metric-content">
              <div class="metric-icon running">
                <el-icon><CircleCheck /></el-icon>
              </div>
              <div class="metric-data">
                <div class="metric-value">{{ systemStats.runningServers }}</div>
                <div class="metric-label">
                  {{ $t("dashboard.activeServers") }}
                </div>
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="metric-card">
            <div class="metric-content">
              <div class="metric-icon tools">
                <el-icon><Tools /></el-icon>
              </div>
              <div class="metric-data">
                <div class="metric-value">{{ systemStats.totalTools }}</div>
                <div class="metric-label">{{ $t("tester.toolList") }}</div>
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="metric-card">
            <div class="metric-content">
              <div class="metric-icon requests">
                <el-icon><DataLine /></el-icon>
              </div>
              <div class="metric-data">
                <div class="metric-value">
                  {{ formatNumber(systemStats.totalRequests) }}
                </div>
                <div class="metric-label">
                  {{ $t("dashboard.totalRequests") }}
                </div>
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="metric-card">
            <div class="metric-content">
              <div class="metric-icon error">
                <el-icon><Warning /></el-icon>
              </div>
              <div class="metric-data">
                <div class="metric-value">{{ systemStats.errorCount }}</div>
                <div class="metric-label">{{ $t("common.error") }}</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 性能监控面板 -->
    <div class="performance-section">
      <el-card :header="$t('dashboard.performanceMetrics')">
        <el-row :gutter="16">
          <el-col :span="6">
            <el-statistic
              :title="$t('dashboard.responseTime')"
              :value="performanceMetrics.renderTime"
              suffix="ms"
            />
          </el-col>
          <el-col :span="6">
            <el-statistic
              title="内存使用"
              :value="performanceMetrics.memoryUsage"
              suffix="MB"
              precision="2"
            />
          </el-col>
          <el-col :span="6">
            <el-statistic
              title="组件数量"
              :value="performanceMetrics.componentCount"
            />
          </el-col>
          <el-col :span="6">
            <el-statistic
              title="更新次数"
              :value="performanceMetrics.updateCount"
            />
          </el-col>
        </el-row>
      </el-card>
    </div>

    <!-- 系统健康状态 -->
    <div class="health-section">
      <el-row :gutter="20">
        <el-col :span="12">
          <el-card header="系统健康状态">
            <div class="health-grid">
              <div
                v-for="(status, service) in systemHealth"
                :key="service"
                class="health-item"
                :class="status.status"
              >
                <div class="health-indicator">
                  <el-icon>
                    <CircleCheck v-if="status.status === 'healthy'" />
                    <Warning v-else-if="status.status === 'warning'" />
                    <CircleClose v-else />
                  </el-icon>
                </div>
                <div class="health-info">
                  <div class="service-name">{{ status.name }}</div>
                  <div class="service-status">
                    {{ getStatusText(status.status) }}
                  </div>
                  <div class="response-time" v-if="status.responseTime">
                    响应时间: {{ status.responseTime }}ms
                  </div>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="12">
          <el-card header="最近活动">
            <div class="activity-list">
              <div
                v-for="activity in recentActivities"
                :key="activity.id"
                class="activity-item"
              >
                <div class="activity-time">
                  {{ formatTime(activity.timestamp) }}
                </div>
                <div class="activity-content">
                  <div class="activity-title">{{ activity.title }}</div>
                  <div class="activity-description">
                    {{ activity.description }}
                  </div>
                </div>
                <div class="activity-status" :class="activity.type">
                  <el-tag
                    :type="getActivityTagType(activity.type)"
                    size="small"
                  >
                    {{ activity.type }}
                  </el-tag>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 实时日志流 -->
    <div class="logs-section">
      <el-card header="实时日志">
        <div class="logs-header">
          <div class="log-controls">
            <el-select v-model="logLevel" placeholder="日志级别" size="small">
              <el-option label="全部" value="" />
              <el-option label="错误" value="error" />
              <el-option label="警告" value="warn" />
              <el-option label="信息" value="info" />
              <el-option label="调试" value="debug" />
            </el-select>

            <el-button @click="clearLogs" size="small" :icon="Delete">
              清空日志
            </el-button>

            <el-button
              @click="pauseLogs = !pauseLogs"
              :type="pauseLogs ? 'primary' : 'default'"
              size="small"
              :icon="pauseLogs ? VideoPlay : VideoPause"
            >
              {{ pauseLogs ? "继续" : "暂停" }}
            </el-button>
          </div>
        </div>

        <div class="logs-container">
          <div
            v-for="log in filteredLogs"
            :key="log.id"
            class="log-entry"
            :class="log.level"
          >
            <span class="log-time">{{ formatTime(log.timestamp) }}</span>
            <span class="log-level">{{ log.level.toUpperCase() }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 加载遮罩 -->
    <LoadingOverlay
      v-model="showLoadingOverlay"
      message="正在加载系统数据..."
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  Monitor,
  Refresh,
  VideoPlay,
  VideoPause,
  CircleCheck,
  Warning,
  CircleClose,
  Tools,
  DataLine,
  Delete,
} from "@element-plus/icons-vue";
import { usePerformanceMonitor } from "@/composables/usePerformance";
import { useWebSocketStore } from "@/stores/websocket";
import LoadingOverlay from "@/shared/components/ui/LoadingOverlay.vue";

// 全局功能
const {
  metrics: performanceMetrics,
  isMonitoring,
  startMonitoring,
  stopMonitoring,
  measureFunction,
} = usePerformanceMonitor();

const websocketStore = useWebSocketStore();

// 状态数据
const loading = ref(false);
const showLoadingOverlay = ref(false);
const pauseLogs = ref(false);
const logLevel = ref("");

// 系统统计数据
const systemStats = ref({
  runningServers: 0,
  totalTools: 0,
  totalRequests: 0,
  errorCount: 0,
});

// 系统健康状态
const systemHealth = ref({
  database: { name: "数据库", status: "healthy", responseTime: 12 },
  websocket: { name: "WebSocket", status: "healthy", responseTime: 8 },
  api: { name: "API服务", status: "healthy", responseTime: 15 },
  storage: { name: "存储服务", status: "warning", responseTime: 45 },
});

// 最近活动
const recentActivities = ref([
  {
    id: 1,
    timestamp: new Date(),
    title: "服务器启动",
    description: 'MCP服务器 "api-server" 已成功启动',
    type: "success",
  },
  {
    id: 2,
    timestamp: new Date(Date.now() - 300000),
    title: "工具调用",
    description: '执行了工具 "get-weather" 请求',
    type: "info",
  },
  {
    id: 3,
    timestamp: new Date(Date.now() - 600000),
    title: "配置更新",
    description: "更新了OpenAPI规范配置",
    type: "warning",
  },
]);

// 日志数据
const logs = ref([
  { id: 1, timestamp: new Date(), level: "info", message: "系统启动完成" },
  { id: 2, timestamp: new Date(), level: "debug", message: "加载配置文件" },
  { id: 3, timestamp: new Date(), level: "warn", message: "检测到高内存使用" },
]);

// 计算属性
const filteredLogs = computed(() => {
  if (!logLevel.value) return logs.value;
  return logs.value.filter((log) => log.level === logLevel.value);
});

// 方法
const togglePerformanceMonitoring = () => {
  if (isMonitoring.value) {
    stopMonitoring();
  } else {
    startMonitoring();
  }
};

const refreshData = async () => {
  loading.value = true;
  showLoadingOverlay.value = true;

  try {
    await measureFunction("refreshDashboardData", async () => {
      // 模拟API调用
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 更新统计数据
      systemStats.value = {
        runningServers: Math.floor(Math.random() * 10) + 1,
        totalTools: Math.floor(Math.random() * 50) + 10,
        totalRequests: Math.floor(Math.random() * 10000) + 1000,
        errorCount: Math.floor(Math.random() * 20),
      };
    });
  } catch (error) {
    console.error("刷新数据失败:", error);
  } finally {
    loading.value = false;
    showLoadingOverlay.value = false;
  }
};

const formatNumber = (num: number) => {
  return new Intl.NumberFormat().format(num);
};

const formatTime = (date: Date) => {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
};

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    healthy: "正常",
    warning: "警告",
    error: "错误",
  };
  return statusMap[status] || "未知";
};

const getActivityTagType = (type: string) => {
  const typeMap: Record<string, string> = {
    success: "success",
    info: "info",
    warning: "warning",
    error: "danger",
  };
  return typeMap[type] || "info";
};

const clearLogs = () => {
  logs.value = [];
};

// 模拟实时日志
const simulateLogs = () => {
  if (pauseLogs.value) return;

  const levels = ["info", "debug", "warn", "error"];
  const messages = [
    "用户请求处理完成",
    "缓存更新成功",
    "检测到慢查询",
    "网络连接超时",
    "数据同步完成",
  ];

  const newLog = {
    id: Date.now(),
    timestamp: new Date(),
    level: levels[Math.floor(Math.random() * levels.length)],
    message: messages[Math.floor(Math.random() * messages.length)],
  };

  logs.value.unshift(newLog);

  // 保持最多100条日志
  if (logs.value.length > 100) {
    logs.value = logs.value.slice(0, 100);
  }
};

// 生命周期
onMounted(async () => {
  // 启动性能监控
  startMonitoring();

  // 加载初始数据
  await refreshData();

  // 启动日志模拟
  const logInterval = setInterval(simulateLogs, 3000);

  onUnmounted(() => {
    stopMonitoring();
    clearInterval(logInterval);
  });
});
</script>

<style scoped>
.dashboard {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.title-section h1 {
  margin: 0 0 8px 0;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.subtitle {
  margin: 0;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.overview-section {
  margin-bottom: 24px;
}

.metric-card {
  height: 100px;
}

.metric-content {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 100%;
}

.metric-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.metric-icon.running {
  background: var(--el-color-success-light-8);
  color: var(--el-color-success);
}

.metric-icon.tools {
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
}

.metric-icon.requests {
  background: var(--el-color-info-light-8);
  color: var(--el-color-info);
}

.metric-icon.error {
  background: var(--el-color-danger-light-8);
  color: var(--el-color-danger);
}

.metric-data {
  flex: 1;
}

.metric-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.metric-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.performance-section {
  margin-bottom: 24px;
}

.health-section {
  margin-bottom: 24px;
}

.health-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.health-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.health-indicator {
  font-size: 20px;
}

.health-item.healthy .health-indicator {
  color: var(--el-color-success);
}

.health-item.warning .health-indicator {
  color: var(--el-color-warning);
}

.health-item.error .health-indicator {
  color: var(--el-color-danger);
}

.health-info {
  flex: 1;
}

.service-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.service-status {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.response-time {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin-top: 2px;
}

.activity-list {
  max-height: 300px;
  overflow-y: auto;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-time {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  white-space: nowrap;
  min-width: 60px;
}

.activity-content {
  flex: 1;
}

.activity-title {
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.activity-description {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.logs-section {
  margin-bottom: 24px;
}

.logs-header {
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.log-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.logs-container {
  max-height: 400px;
  overflow-y: auto;
  background: var(--el-fill-color-darker);
  border-radius: 4px;
  padding: 12px;
  font-family: "Courier New", monospace;
  font-size: 12px;
}

.log-entry {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
  line-height: 1.4;
}

.log-time {
  color: var(--el-text-color-placeholder);
  white-space: nowrap;
  min-width: 80px;
}

.log-level {
  min-width: 50px;
  font-weight: 600;
}

.log-entry.info .log-level {
  color: var(--el-color-info);
}

.log-entry.debug .log-level {
  color: var(--el-text-color-secondary);
}

.log-entry.warn .log-level {
  color: var(--el-color-warning);
}

.log-entry.error .log-level {
  color: var(--el-color-danger);
}

.log-message {
  flex: 1;
  color: var(--el-text-color-primary);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .metric-content {
    flex-direction: column;
    text-align: center;
    gap: 8px;
  }

  .health-grid {
    grid-template-columns: 1fr;
  }

  .activity-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
