<template>
  <el-card class="resource-monitor">
    <template #header>
      <div class="monitor-header">
        <span class="monitor-title">Resource Monitoring</span>
        <div class="monitor-controls">
          <el-select
            v-model="selectedTimeRange"
            size="small"
            style="width: 120px"
            @change="handleTimeRangeChange"
          >
            <el-option label="Realtime" value="realtime" />
            <el-option label="Last 1m" value="1m" />
            <el-option label="Last 5m" value="5m" />
            <el-option label="Last 15m" value="15m" />
            <el-option label="Last 30m" value="30m" />
            <el-option label="Last 1h" value="1h" />
          </el-select>

          <el-button
            size="small"
            :icon="Refresh"
            @click="refreshData"
            :loading="loading"
          >
            Refresh
          </el-button>
        </div>
      </div>
    </template>

    <el-alert
      class="resource-alert"
      type="warning"
      :closable="false"
      title="Process-level resource telemetry is not connected yet. The original monitoring surface is preserved, and unavailable placeholders are shown instead of synthetic values."
    />

    <div class="resource-overview">
      <el-row :gutter="16">
        <el-col :span="6" v-for="card in resourceCards" :key="card.key">
          <div class="resource-card">
            <div class="card-header">
              <div class="card-icon" :class="card.key">
                <el-icon><component :is="card.icon" /></el-icon>
              </div>
              <div class="card-info">
                <h4>{{ card.title }}</h4>
                <div class="card-value">
                  <span class="value unavailable">Unavailable</span>
                  <span class="trend neutral">No live source</span>
                </div>
              </div>
            </div>
            <div class="card-details">
              <div class="detail-item" v-for="detail in card.details" :key="detail">
                <span class="label">{{ detail }}</span>
                <span class="value unavailable">Unavailable</span>
              </div>
            </div>
            <div class="mini-chart unavailable-panel">Unavailable</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <div class="process-monitor">
      <div class="section-header">
        <h3>Process Monitor</h3>
        <div class="process-controls">
          <el-input
            v-model="processSearch"
            placeholder="Search process"
            size="small"
            style="width: 200px"
            :prefix-icon="Search"
            clearable
          />
          <el-select
            v-model="processSortBy"
            size="small"
            style="width: 140px"
          >
            <el-option label="CPU" value="cpu" />
            <el-option label="Memory" value="memory" />
            <el-option label="Name" value="name" />
            <el-option label="PID" value="pid" />
          </el-select>
        </div>
      </div>

      <el-table
        :data="filteredProcesses"
        class="process-table"
        size="small"
        max-height="300"
        empty-text="No process placeholder rows"
      >
        <el-table-column prop="pid" label="PID" width="100" />
        <el-table-column prop="name" label="Process" min-width="180" />
        <el-table-column prop="cpu" label="CPU" width="120" />
        <el-table-column prop="memory" label="Memory" width="120" />
        <el-table-column prop="status" label="Status" width="120">
          <template #default>
            <el-tag type="info" size="small">Unavailable</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="startTime" label="Start Time" width="180" />
        <el-table-column label="Actions" width="120" fixed="right">
          <template #default>
            <el-button size="small" disabled>Unavailable</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="service-monitor">
      <div class="section-header">
        <h3>System Services</h3>
        <el-button size="small" :icon="Refresh" @click="refreshServices">
          Refresh
        </el-button>
      </div>

      <el-row :gutter="16">
        <el-col v-for="service in systemServices" :key="service.name" :span="8">
          <div class="service-card">
            <div class="service-header">
              <div class="service-name">{{ service.displayName }}</div>
              <el-tag type="info" size="small">Unavailable</el-tag>
            </div>
            <div class="service-details">
              <div class="detail-row">
                <span class="label">Service Name</span>
                <span class="value">{{ service.name }}</span>
              </div>
              <div class="detail-row">
                <span class="label">Startup Type</span>
                <span class="value unavailable">Unavailable</span>
              </div>
              <div class="detail-row">
                <span class="label">Uptime</span>
                <span class="value unavailable">Unavailable</span>
              </div>
            </div>
            <div class="service-actions">
              <el-button-group size="small">
                <el-button disabled>Start</el-button>
                <el-button disabled>Stop</el-button>
                <el-button disabled>Restart</el-button>
              </el-button-group>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Refresh,
  Search,
  Cpu,
  Monitor,
  Connection,
  FolderOpened,
} from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";

interface PlaceholderProcess {
  pid: string;
  name: string;
  cpu: string;
  memory: string;
  status: string;
  startTime: string;
}

interface PlaceholderService {
  name: string;
  displayName: string;
}

const selectedTimeRange = ref("realtime");
const loading = ref(false);
const processSearch = ref("");
const processSortBy = ref("cpu");

const resourceCards = [
  { key: "cpu", title: "CPU Usage", icon: Cpu, details: ["Cores", "Temperature", "Frequency"] },
  { key: "memory", title: "Memory Usage", icon: Monitor, details: ["Used", "Free", "Total"] },
  { key: "network", title: "Network Traffic", icon: Connection, details: ["Ingress", "Egress", "Latency"] },
  { key: "disk", title: "Disk I/O", icon: FolderOpened, details: ["Read", "Write", "Queue"] },
];

const processes = ref<PlaceholderProcess[]>([
  {
    pid: "Unavailable",
    name: "MCP server process",
    cpu: "Unavailable",
    memory: "Unavailable",
    status: "Unavailable",
    startTime: "Unavailable",
  },
  {
    pid: "Unavailable",
    name: "Worker process",
    cpu: "Unavailable",
    memory: "Unavailable",
    status: "Unavailable",
    startTime: "Unavailable",
  },
]);

const systemServices = ref<PlaceholderService[]>([
  { name: "mcp-swagger-server", displayName: "MCP Swagger Server" },
  { name: "database", displayName: "Database" },
  { name: "management-websocket", displayName: "Management WebSocket" },
]);

const filteredProcesses = computed(() => {
  const search = processSearch.value.trim().toLowerCase();
  if (!search) return processes.value;
  return processes.value.filter(
    (process) =>
      process.name.toLowerCase().includes(search) ||
      process.pid.toLowerCase().includes(search),
  );
});

const handleTimeRangeChange = (range: string) => {
  selectedTimeRange.value = range;
};

const refreshData = async () => {
  loading.value = true;
  try {
    ElMessage.info("Live process telemetry is unavailable.");
  } finally {
    loading.value = false;
  }
};

const refreshServices = () => {
  ElMessage.info("Live service telemetry is unavailable.");
};
</script>

<style scoped>
.resource-monitor {
  height: 100%;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.monitor-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.monitor-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.resource-alert {
  margin-bottom: 16px;
}

.resource-overview {
  margin-bottom: 24px;
}

.resource-card {
  min-height: 220px;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.card-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  flex-shrink: 0;
}

.card-icon.cpu {
  background: linear-gradient(135deg, #409eff, #66d9ef);
}

.card-icon.memory {
  background: linear-gradient(135deg, #67c23a, #85ce61);
}

.card-icon.network {
  background: linear-gradient(135deg, #e6a23c, #eebe77);
}

.card-icon.disk {
  background: linear-gradient(135deg, #909399, #b1b3b8);
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-info h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.card-value {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-value .value {
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
}

.card-value .trend {
  font-size: 12px;
  font-weight: 500;
}

.unavailable {
  color: var(--el-text-color-disabled);
}

.trend.neutral {
  color: var(--el-text-color-regular);
}

.card-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  font-size: 12px;
}

.detail-item,
.detail-row {
  display: flex;
  justify-content: space-between;
}

.detail-item .label,
.detail-row .label {
  color: var(--el-text-color-regular);
}

.detail-item .value,
.detail-row .value {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.unavailable-panel {
  flex: 1;
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  color: var(--el-text-color-disabled);
  background: var(--el-fill-color-lighter);
}

.process-monitor,
.service-monitor {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.process-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.service-card {
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  margin-bottom: 16px;
}

.service-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.service-name {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.service-details {
  margin-bottom: 12px;
  font-size: 12px;
}

.service-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 1200px) {
  .resource-overview :deep(.el-col) {
    margin-bottom: 16px;
  }
}

@media (max-width: 768px) {
  .monitor-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .monitor-controls,
  .process-controls {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .resource-card {
    height: auto;
  }

  .service-header {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
}
</style>
