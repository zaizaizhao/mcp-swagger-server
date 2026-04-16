<template>
  <div class="monitoring-dashboard">
    <div class="dashboard-header">
      <div class="header-left">
        <h2 class="dashboard-title">
          <el-icon><Monitor /></el-icon>
          Process Monitoring
        </h2>
        <el-tag type="warning" size="small">Placeholder Surface</el-tag>
      </div>

      <div class="header-actions">
        <el-select
          v-model="timeRange"
          size="small"
          style="width: 120px"
          @change="handleTimeRangeChange"
        >
          <el-option label="Last 5m" value="5m" />
          <el-option label="Last 15m" value="15m" />
          <el-option label="Last 30m" value="30m" />
          <el-option label="Last 1h" value="1h" />
          <el-option label="Last 6h" value="6h" />
          <el-option label="Last 24h" value="24h" />
        </el-select>

        <el-switch
          v-model="autoRefresh"
          active-text="Auto refresh"
          @change="handleAutoRefreshChange"
        />

        <el-button
          type="primary"
          :icon="Refresh"
          :loading="isRefreshing"
          @click="handleRefresh"
        >
          Refresh
        </el-button>

        <el-button :icon="Setting" @click="showSettings = true">
          Settings
        </el-button>
      </div>
    </div>

    <el-alert
      class="availability-alert"
      type="warning"
      :closable="false"
      title="Live monitoring metrics are not wired to a product telemetry source yet. The monitoring surface is preserved, but unavailable values are shown instead of simulated runtime data."
    />

    <div class="dashboard-content">
      <div class="overview-section">
        <el-row :gutter="16">
          <el-col :span="6">
            <SystemStatusCard v-bind="systemStatusData" />
          </el-col>
          <el-col :span="18">
            <el-row :gutter="16">
              <el-col :span="6">
                <MetricCard title="CPU Usage" value="Unavailable" icon="cpu" :show-chart="false" />
              </el-col>
              <el-col :span="6">
                <MetricCard title="Memory Usage" value="Unavailable" icon="memory" :show-chart="false" />
              </el-col>
              <el-col :span="6">
                <MetricCard title="Disk Usage" value="Unavailable" icon="disk" :show-chart="false" />
              </el-col>
              <el-col :span="6">
                <MetricCard title="Network I/O" value="Unavailable" icon="network" :show-chart="false" />
              </el-col>
            </el-row>
          </el-col>
        </el-row>
      </div>

      <div class="charts-section">
        <el-row :gutter="16">
          <el-col :span="16">
            <RealtimeChart
              title="System Performance"
              :series="chartSeries"
              :time-range="timeRange"
              :is-realtime="autoRefresh"
              @time-range-change="handleTimeRangeChange"
              @realtime-toggle="handleRealtimeToggle"
            />
          </el-col>

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

      <div class="metrics-table-section">
        <el-card>
          <template #header>
            <div class="section-header">
              <span class="section-title">Detailed Metrics</span>
              <el-button size="small" :icon="Download" @click="handleExportMetrics">
                Export
              </el-button>
            </div>
          </template>

          <el-table :data="metricsTableData" stripe size="small" style="width: 100%">
            <el-table-column prop="timestamp" label="Time" width="180" />
            <el-table-column prop="cpu" label="CPU" width="120" />
            <el-table-column prop="memory" label="Memory" width="120" />
            <el-table-column prop="disk" label="Disk" width="120" />
            <el-table-column prop="network" label="Network" width="140" />
            <el-table-column prop="processes" label="Processes" width="120" />
            <el-table-column prop="connections" label="Connections" width="120" />
            <el-table-column prop="uptime" label="Uptime" min-width="140" />
            <el-table-column prop="note" label="Note" min-width="260" />
          </el-table>
        </el-card>
      </div>

      <div class="advanced-monitoring">
        <el-card>
          <template #header>
            <span class="section-title">Advanced Monitoring</span>
          </template>

          <el-tabs v-model="activeAdvancedTab" type="border-card">
            <el-tab-pane label="Performance" name="performance">
              <PerformanceCharts @period-change="handlePeriodChange" @refresh="handleRefresh" />
            </el-tab-pane>
            <el-tab-pane label="Alerts" name="alerts">
              <AlertManagement />
            </el-tab-pane>
            <el-tab-pane label="Resources" name="resources">
              <ResourceMonitor />
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </div>
    </div>

    <el-dialog v-model="showSettings" title="Monitoring Settings" width="500px">
      <el-form :model="settings" label-width="140px">
        <el-form-item label="Refresh interval">
          <el-select v-model="settings.refreshInterval">
            <el-option label="1 second" :value="1000" />
            <el-option label="5 seconds" :value="5000" />
            <el-option label="10 seconds" :value="10000" />
            <el-option label="30 seconds" :value="30000" />
            <el-option label="1 minute" :value="60000" />
          </el-select>
        </el-form-item>

        <el-form-item label="CPU alert threshold">
          <el-input-number v-model="settings.cpuThreshold" :min="1" :max="100" :step="5" />
        </el-form-item>

        <el-form-item label="Memory alert threshold">
          <el-input-number v-model="settings.memoryThreshold" :min="1" :max="100" :step="5" />
        </el-form-item>

        <el-form-item label="Disk alert threshold">
          <el-input-number v-model="settings.diskThreshold" :min="1" :max="100" :step="5" />
        </el-form-item>

        <el-form-item label="Enable notifications">
          <el-switch v-model="settings.enableNotifications" />
        </el-form-item>

        <el-form-item label="Data retention">
          <el-select v-model="settings.dataRetention">
            <el-option label="1 hour" value="1h" />
            <el-option label="6 hours" value="6h" />
            <el-option label="24 hours" value="24h" />
            <el-option label="7 days" value="7d" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showSettings = false">Cancel</el-button>
        <el-button type="primary" @click="handleSaveSettings">Save</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Monitor,
  Refresh,
  Setting,
  Download,
  Connection,
  Service as Server,
  Coin,
} from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { useMonitoringStore } from "@/stores/monitoring";
import MetricCard from "../components/monitoring/MetricCard.vue";
import SystemStatusCard from "../components/monitoring/SystemStatusCard.vue";
import RealtimeChart from "../components/monitoring/RealtimeChart.vue";
import AlertsPanel from "../components/monitoring/AlertsPanel.vue";
import PerformanceCharts from "../components/monitoring/PerformanceCharts.vue";
import AlertManagement from "../components/monitoring/AlertManagement.vue";
import ResourceMonitor from "../components/monitoring/ResourceMonitor.vue";
import type { ServiceStatus } from "@/types";

const monitoringStore = useMonitoringStore();
const timeRange = ref("30m");
const autoRefresh = ref(true);
const isRefreshing = ref(false);
const showSettings = ref(false);
const activeAdvancedTab = ref("performance");

const settings = ref({
  refreshInterval: 5000,
  cpuThreshold: 80,
  memoryThreshold: 85,
  diskThreshold: 90,
  enableNotifications: true,
  dataRetention: "24h",
});

const alerts = computed(() => monitoringStore.alerts);

const systemStatusData = computed(() => ({
  status: "warning" as const,
  services: [
    { name: "MCP Gateway", status: "degraded", icon: Server },
    { name: "Database", status: "degraded", icon: Coin },
    { name: "Notification Pipeline", status: "degraded", icon: Monitor },
    {
      name: "Management WebSocket",
      status: monitoringStore.isConnected ? "online" : "degraded",
      icon: Connection,
    },
  ] as ServiceStatus[],
  uptime: undefined,
  lastUpdate: new Date(),
}));

const chartSeries = computed(() => []);

const metricsTableData = computed(() => [
  {
    timestamp: new Date().toLocaleString(),
    cpu: "Unavailable",
    memory: "Unavailable",
    disk: "Unavailable",
    network: "Unavailable",
    processes: "Unavailable",
    connections: "Unavailable",
    uptime: "Unavailable",
    note: "Live telemetry path is not wired in the current release baseline.",
  },
]);

const handleTimeRangeChange = (value: string) => {
  timeRange.value = value;
};

const handleAutoRefreshChange = (enabled: boolean) => {
  autoRefresh.value = enabled;
};

const handleRealtimeToggle = () => {
  autoRefresh.value = !autoRefresh.value;
};

const handleRefresh = async () => {
  isRefreshing.value = true;
  try {
    ElMessage.info("Live monitoring telemetry is currently unavailable.");
  } finally {
    isRefreshing.value = false;
  }
};

const handleAcknowledgeAlert = (alertId: string) => {
  monitoringStore.acknowledgeAlert(alertId);
};

const handleDismissAlert = (alertId: string) => {
  monitoringStore.dismissAlert(alertId);
};

const handleRefreshAlerts = () => {
  ElMessage.info("Alert list refreshed.");
};

const handleClearAcknowledgedAlerts = () => {
  monitoringStore.clearAcknowledgedAlerts();
};

const handleExportMetrics = () => {
  const csvContent = [
    "timestamp,cpu,memory,disk,network,processes,connections,uptime,note",
    `${new Date().toISOString()},Unavailable,Unavailable,Unavailable,Unavailable,Unavailable,Unavailable,Unavailable,Live telemetry path not wired`,
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `monitoring-placeholder-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const handleSaveSettings = () => {
  localStorage.setItem("monitoring-settings", JSON.stringify(settings.value));
  showSettings.value = false;
  ElMessage.success("Settings saved.");
};

const handlePeriodChange = (period: string) => {
  ElMessage.info(`Switched to ${period}.`);
};
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

.availability-alert {
  margin-bottom: 20px;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
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

.advanced-monitoring :deep(.el-tabs__content) {
  padding: 20px 0;
}

.advanced-monitoring :deep(.el-tab-pane) {
  min-height: 400px;
}

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

  .overview-section :deep(.el-col),
  .charts-section :deep(.el-col) {
    margin-bottom: 16px;
  }
}
</style>
