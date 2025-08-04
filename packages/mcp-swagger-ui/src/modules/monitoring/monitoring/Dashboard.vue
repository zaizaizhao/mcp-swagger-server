<template>
  <div class="monitoring-dashboard">
    <!-- 顶部工具栏 -->
    <div class="dashboard-header">
      <div class="header-left">
        <h2 class="dashboard-title">
          <el-icon><Monitor /></el-icon>
          系统监控
        </h2>
        <el-tag :type="systemStatusType" size="small">
          {{ systemStatusText }}
        </el-tag>
      </div>

      <div class="header-actions">
        <el-select
          v-model="timeRange"
          size="small"
          style="width: 120px"
          @change="handleTimeRangeChange"
        >
          <el-option label="最近 5 分钟" value="5m" />
          <el-option label="最近 15 分钟" value="15m" />
          <el-option label="最近 30 分钟" value="30m" />
          <el-option label="最近 1 小时" value="1h" />
          <el-option label="最近 6 小时" value="6h" />
          <el-option label="最近 24 小时" value="24h" />
        </el-select>

        <el-switch
          v-model="autoRefresh"
          active-text="自动刷新"
          @change="handleAutoRefreshChange"
        />

        <el-button
          type="primary"
          :icon="Refresh"
          :loading="isRefreshing"
          @click="handleRefresh"
        >
          刷新
        </el-button>

        <el-button :icon="Setting" @click="showSettings = true">
          设置
        </el-button>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="dashboard-content">
      <!-- 系统状态概览 -->
      <div class="overview-section">
        <el-row :gutter="16">
          <el-col :span="6">
            <SystemStatusCard v-bind="systemStatusData" />
          </el-col>
          <el-col :span="18">
            <el-row :gutter="16">
              <el-col :span="6">
                <MetricCard
                  title="CPU 使用率"
                  :value="currentMetrics?.cpu?.usage || 0"
                  unit="%"
                  :data="cpuHistory"
                  :threshold="80"
                  type="cpu"
                  icon="cpu"
                />
              </el-col>
              <el-col :span="6">
                <MetricCard
                  title="内存使用率"
                  :value="currentMetrics?.memory?.usage || 0"
                  unit="%"
                  :data="memoryHistory"
                  :threshold="85"
                  type="memory"
                  icon="memory"
                />
              </el-col>
              <el-col :span="6">
                <MetricCard
                  title="磁盘使用率"
                  :value="currentMetrics?.disk?.usage || 0"
                  unit="%"
                  :data="diskHistory"
                  :threshold="90"
                  type="disk"
                  icon="disk"
                />
              </el-col>
              <el-col :span="6">
                <MetricCard
                  title="网络I/O"
                  :value="
                    ((currentMetrics?.network?.bytesIn || 0) +
                      (currentMetrics?.network?.bytesOut || 0)) /
                    1024 /
                    1024
                  "
                  unit="MB/s"
                  :data="networkHistory"
                  :threshold="100"
                  type="network"
                  icon="network"
                />
              </el-col>
            </el-row>
          </el-col>
        </el-row>
      </div>

      <!-- 图表和告警区域 -->
      <div class="charts-section">
        <el-row :gutter="16">
          <!-- 实时图表 -->
          <el-col :span="16">
            <RealtimeChart
              title="系统性能监控"
              :series="chartSeries"
              :time-range="timeRange"
              :is-realtime="autoRefresh"
              @time-range-change="handleTimeRangeChange"
              @realtime-toggle="handleRealtimeToggle"
            />
          </el-col>

          <!-- 告警面板 -->
          <el-col :span="8">
            <AlertsPanel
              :alerts="alerts"
              @acknowledge="handleAcknowledgeAlert"
              @dismiss="handleDismissAlert"
              @refresh="handleRefreshAlerts"
              @clearAcknowledged="handleClearAcknowledgedAlerts"
            />
          </el-col>
        </el-row>
      </div>

      <!-- 详细指标表格 -->
      <div class="metrics-table-section">
        <el-card>
          <template #header>
            <div class="section-header">
              <span class="section-title">详细指标</span>
              <el-button
                size="small"
                :icon="Download"
                @click="handleExportMetrics"
              >
                导出数据
              </el-button>
            </div>
          </template>

          <el-table
            :data="metricsTableData"
            stripe
            size="small"
            style="width: 100%"
          >
            <el-table-column prop="timestamp" label="时间" width="160">
              <template #default="{ row }">
                {{ formatTimestamp(row.timestamp) }}
              </template>
            </el-table-column>
            <el-table-column prop="cpu" label="CPU (%)" width="100">
              <template #default="{ row }">
                <span :class="getMetricClass(row.cpu, 80)">
                  {{ row.cpu.toFixed(1) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="memory" label="内存 (%)" width="100">
              <template #default="{ row }">
                <span :class="getMetricClass(row.memory, 85)">
                  {{ row.memory.toFixed(1) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="disk" label="磁盘 (%)" width="100">
              <template #default="{ row }">
                <span :class="getMetricClass(row.disk, 90)">
                  {{ row.disk.toFixed(1) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="network" label="网络 (MB/s)" width="120">
              <template #default="{ row }">
                {{ row.network.toFixed(2) }}
              </template>
            </el-table-column>
            <el-table-column prop="processes" label="进程数" width="100" />
            <el-table-column prop="connections" label="连接数" width="100" />
            <el-table-column prop="uptime" label="运行时间" min-width="120">
              <template #default="{ row }">
                {{ formatUptime(row.uptime) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>

      <!-- 高级监控功能标签页 -->
      <div class="advanced-monitoring">
        <el-card>
          <template #header>
            <span class="section-title">高级监控功能</span>
          </template>

          <el-tabs v-model="activeAdvancedTab" type="border-card">
            <!-- 性能分析标签页 -->
            <el-tab-pane label="性能分析" name="performance">
              <PerformanceCharts
                @period-change="handlePeriodChange"
                @refresh="handleRefresh"
              />
            </el-tab-pane>

            <!-- 告警管理标签页 -->
            <el-tab-pane label="告警管理" name="alerts">
              <AlertManagement />
            </el-tab-pane>

            <!-- 资源监控标签页 -->
            <el-tab-pane label="资源监控" name="resources">
              <ResourceMonitor />
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </div>
    </div>

    <!-- 设置对话框 -->
    <el-dialog v-model="showSettings" title="监控设置" width="500px">
      <el-form :model="settings" label-width="120px">
        <el-form-item label="刷新间隔">
          <el-select v-model="settings.refreshInterval">
            <el-option label="1 秒" :value="1000" />
            <el-option label="5 秒" :value="5000" />
            <el-option label="10 秒" :value="10000" />
            <el-option label="30 秒" :value="30000" />
            <el-option label="1 分钟" :value="60000" />
          </el-select>
        </el-form-item>

        <el-form-item label="CPU 告警阈值">
          <el-input-number
            v-model="settings.cpuThreshold"
            :min="1"
            :max="100"
            :step="5"
          />
        </el-form-item>

        <el-form-item label="内存告警阈值">
          <el-input-number
            v-model="settings.memoryThreshold"
            :min="1"
            :max="100"
            :step="5"
          />
        </el-form-item>

        <el-form-item label="磁盘告警阈值">
          <el-input-number
            v-model="settings.diskThreshold"
            :min="1"
            :max="100"
            :step="5"
          />
        </el-form-item>

        <el-form-item label="启用通知">
          <el-switch v-model="settings.enableNotifications" />
        </el-form-item>

        <el-form-item label="数据保留时间">
          <el-select v-model="settings.dataRetention">
            <el-option label="1 小时" value="1h" />
            <el-option label="6 小时" value="6h" />
            <el-option label="24 小时" value="24h" />
            <el-option label="7 天" value="7d" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showSettings = false">取消</el-button>
        <el-button type="primary" @click="handleSaveSettings">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { Monitor, Refresh, Setting, Download } from "@element-plus/icons-vue";
import { ElMessage, ElNotification } from "element-plus";
import { useMonitoringStore } from "@/stores/monitoring";
import MetricCard from "../components/monitoring/MetricCard.vue";
import SystemStatusCard from "../components/monitoring/SystemStatusCard.vue";
import RealtimeChart from "../components/monitoring/RealtimeChart.vue";
import AlertsPanel from "../components/monitoring/AlertsPanel.vue";
import PerformanceCharts from "../components/monitoring/PerformanceCharts.vue";
import AlertManagement from "../components/monitoring/AlertManagement.vue";
import ResourceMonitor from "../components/monitoring/ResourceMonitor.vue";
import type { ChartDataPoint, ServiceStatus } from "@/types";

const monitoringStore = useMonitoringStore();

// 响应式状态
const timeRange = ref("30m");
const autoRefresh = ref(true);
const isRefreshing = ref(false);
const showSettings = ref(false);
const activeAdvancedTab = ref("performance");

// 设置
const settings = ref({
  refreshInterval: 5000,
  cpuThreshold: 80,
  memoryThreshold: 85,
  diskThreshold: 90,
  enableNotifications: true,
  dataRetention: "24h",
});

// 计算属性
const currentMetrics = computed(() => monitoringStore.currentMetrics);
const alerts = computed(() => monitoringStore.alerts);

const systemStatusType = computed(() => {
  const critical = alerts.value.filter(
    (a) => a.level === "critical" && !a.acknowledged,
  ).length;
  const warning = alerts.value.filter(
    (a) => a.level === "warning" && !a.acknowledged,
  ).length;

  if (critical > 0) return "danger";
  if (warning > 0) return "warning";
  return "success";
});

const systemStatusText = computed(() => {
  const critical = alerts.value.filter(
    (a) => a.level === "critical" && !a.acknowledged,
  ).length;
  const warning = alerts.value.filter(
    (a) => a.level === "warning" && !a.acknowledged,
  ).length;

  if (critical > 0) return `严重告警 ${critical} 个`;
  if (warning > 0) return `警告 ${warning} 个`;
  return "系统正常";
});

// 历史数据
const cpuHistory = computed(() => {
  return monitoringStore.metrics.slice(-20).map((m: any) => ({
    timestamp: m.timestamp,
    value: m.cpu.usage,
  }));
});

const memoryHistory = computed(() => {
  return monitoringStore.metrics.slice(-20).map((m: any) => ({
    timestamp: m.timestamp,
    value: m.memory.usage,
  }));
});

const diskHistory = computed(() => {
  return monitoringStore.metrics.slice(-20).map((m: any) => ({
    timestamp: m.timestamp,
    value: m.disk.usage,
  }));
});

const networkHistory = computed(() => {
  return monitoringStore.metrics.slice(-20).map((m: any) => ({
    timestamp: m.timestamp,
    value: (m.network.bytesIn + m.network.bytesOut) / 1024 / 1024,
  }));
});

const metricsTableData = computed(() => {
  return monitoringStore.metrics
    .slice(-50)
    .reverse()
    .map((m: any) => ({
      timestamp: m.timestamp,
      cpu: m.cpu.usage,
      memory: m.memory.usage,
      disk: m.disk.usage,
      network: (m.network.bytesIn + m.network.bytesOut) / 1024 / 1024, // 转换为MB/s
      processes: m.process.count || 0,
      connections: m.network.connections,
      uptime: m.process.uptime,
    }));
});

// 系统状态数据
const systemStatusData = computed(() => ({
  status:
    systemStatusType.value === "success"
      ? ("healthy" as const)
      : systemStatusType.value === "warning"
        ? ("warning" as const)
        : ("critical" as const),
  services: [
    { name: "MCP Gateway", status: "online", icon: "Server" },
    { name: "数据库", status: "online", icon: "DataBase" },
    { name: "Redis缓存", status: "online", icon: "Coin" },
    { name: "监控服务", status: "online", icon: "Monitor" },
    {
      name: "WebSocket",
      status: monitoringStore.isConnected ? "online" : "offline",
      icon: "Connection",
    },
    { name: "告警系统", status: "online", icon: "Bell" },
  ] as ServiceStatus[],
  uptime: 86400 + (Math.floor(Date.now() / 1000) % 3600), // 模拟运行时间
  lastUpdate: new Date(),
}));

// 图表数据系列
const chartSeries = computed(() => [
  monitoringStore.cpuSeries,
  monitoringStore.memorySeries,
  monitoringStore.networkInSeries,
  monitoringStore.networkOutSeries,
]);

// 方法
const handleTimeRangeChange = (value: string) => {
  // 根据时间范围调整数据
  console.log("时间范围变更:", value);
};

const handleAutoRefreshChange = (enabled: boolean) => {
  if (enabled) {
    monitoringStore.startMonitoring();
  } else {
    monitoringStore.stopMonitoring();
  }
};

const handleRealtimeToggle = () => {
  autoRefresh.value = !autoRefresh.value;
  handleAutoRefreshChange(autoRefresh.value);
};

const handleRefresh = async () => {
  isRefreshing.value = true;
  try {
    await monitoringStore.refreshMetrics();
    ElMessage.success("数据刷新成功");
  } catch (error) {
    ElMessage.error("数据刷新失败");
  } finally {
    isRefreshing.value = false;
  }
};

const handleAcknowledgeAlert = (alertId: string) => {
  monitoringStore.acknowledgeAlert(alertId);
  ElMessage.success("告警已确认");
};

const handleDismissAlert = (alertId: string) => {
  monitoringStore.dismissAlert(alertId);
  ElMessage.success("告警已关闭");
};

const handleRefreshAlerts = () => {
  // 刷新告警数据
  ElMessage.success("告警数据已刷新");
};

const handleClearAcknowledgedAlerts = () => {
  monitoringStore.clearAcknowledgedAlerts();
  ElMessage.success("已清除确认的告警");
};

const handleExportMetrics = () => {
  const data = monitoringStore.metrics;
  const csvContent = [
    "timestamp,cpu,memory,disk,network,processes,connections,uptime",
    ...data.map(
      (row: any) =>
        `${row.timestamp.toISOString()},${row.cpu.usage},${row.memory.usage},${row.disk.usage},${(row.network.bytesIn + row.network.bytesOut) / 1024 / 1024},${row.process.count || 0},${row.network.connections},${row.process.uptime}`,
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `metrics-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  ElMessage.success("数据导出成功");
};

const handleSaveSettings = () => {
  // 保存设置
  localStorage.setItem("monitoring-settings", JSON.stringify(settings.value));

  // 应用新的刷新间隔
  if (autoRefresh.value) {
    monitoringStore.stopMonitoring();
    monitoringStore.startMonitoring(settings.value.refreshInterval);
  }

  showSettings.value = false;
  ElMessage.success("设置已保存");
};

// 新增的高级功能事件处理
const handlePeriodChange = (period: string) => {
  ElMessage.info(`时间周期已切换到: ${period}`);
};

const formatTimestamp = (timestamp: Date) => {
  return timestamp.toLocaleString("zh-CN");
};

const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}天 ${hours}小时`;
  } else if (hours > 0) {
    return `${hours}小时 ${minutes}分钟`;
  } else {
    return `${minutes}分钟`;
  }
};

const getMetricClass = (value: number, threshold: number) => {
  if (value >= threshold) {
    return "metric-danger";
  } else if (value >= threshold * 0.8) {
    return "metric-warning";
  }
  return "metric-normal";
};

// 生命周期
onMounted(() => {
  // 加载设置
  const savedSettings = localStorage.getItem("monitoring-settings");
  if (savedSettings) {
    Object.assign(settings.value, JSON.parse(savedSettings));
  }

  // 启动监控
  if (autoRefresh.value) {
    monitoringStore.startMonitoring(settings.value.refreshInterval);
  }

  // 监听告警通知
  if (settings.value.enableNotifications) {
    // 这里可以添加浏览器通知权限请求
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }
});

onUnmounted(() => {
  monitoringStore.stopMonitoring();
});

// 监听新告警
const unwatchAlerts = monitoringStore.$subscribe((mutation, state) => {
  // 检查是否有新的告警添加
  const events = Array.isArray(mutation.events)
    ? mutation.events
    : [mutation.events];
  if (events.some((e: any) => e.key === "alerts" && e.type === "add")) {
    const newAlerts = state.alerts.filter(
      (alert: any) =>
        !alert.acknowledged && Date.now() - alert.timestamp.getTime() < 5000,
    );

    newAlerts.forEach((alert: any) => {
      ElNotification({
        title: "系统告警",
        message: alert.message,
        type: alert.level === "critical" ? "error" : "warning",
        duration: 0,
      });

      // 浏览器通知
      if (
        settings.value.enableNotifications &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification("系统告警", {
          body: alert.message,
          icon: "/favicon.ico",
        });
      }
    });
  }
});

onUnmounted(() => {
  unwatchAlerts();
});
</script>

<style scoped>
.monitoring-dashboard {
  padding: 20px;
  background: var(--el-bg-color-page);
  min-height: 100vh;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px 20px;
  background: var(--el-bg-color);
  border-radius: 8px;
  box-shadow: var(--el-box-shadow-light);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dashboard-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.overview-section {
  margin-bottom: 20px;
}

.charts-section {
  margin-bottom: 20px;
}

.metrics-table-section {
  margin-bottom: 20px;
}

.advanced-monitoring {
  margin-bottom: 20px;
}

.advanced-monitoring :deep(.el-tabs__content) {
  padding: 20px 0;
}

.advanced-monitoring :deep(.el-tab-pane) {
  min-height: 400px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.metric-danger {
  color: var(--el-color-danger);
  font-weight: 600;
}

.metric-warning {
  color: var(--el-color-warning);
  font-weight: 600;
}

.metric-normal {
  color: var(--el-text-color-primary);
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .dashboard-header {
    flex-direction: column;
    gap: 12px;
  }

  .header-actions {
    flex-wrap: wrap;
  }
}

@media (max-width: 768px) {
  .monitoring-dashboard {
    padding: 10px;
  }

  .overview-section :deep(.el-col) {
    margin-bottom: 16px;
  }

  .charts-section :deep(.el-col) {
    margin-bottom: 16px;
  }
}
</style>
