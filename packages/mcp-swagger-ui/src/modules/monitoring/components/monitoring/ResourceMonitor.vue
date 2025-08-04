<template>
  <el-card class="resource-monitor">
    <template #header>
      <div class="monitor-header">
        <span class="monitor-title">系统资源监控</span>
        <div class="monitor-controls">
          <el-select
            v-model="selectedTimeRange"
            size="small"
            style="width: 120px"
            @change="handleTimeRangeChange"
          >
            <el-option label="实时" value="realtime" />
            <el-option label="最近1分钟" value="1m" />
            <el-option label="最近5分钟" value="5m" />
            <el-option label="最近15分钟" value="15m" />
            <el-option label="最近30分钟" value="30m" />
            <el-option label="最近1小时" value="1h" />
          </el-select>

          <el-button
            size="small"
            :icon="Refresh"
            @click="refreshData"
            :loading="loading"
          >
            刷新
          </el-button>
        </div>
      </div>
    </template>

    <!-- 资源概览卡片 -->
    <div class="resource-overview">
      <el-row :gutter="16">
        <el-col :span="6">
          <div class="resource-card">
            <div class="card-header">
              <div class="card-icon cpu">
                <el-icon><Cpu /></el-icon>
              </div>
              <div class="card-info">
                <h4>CPU使用率</h4>
                <div class="card-value">
                  <span class="value" :class="getCpuStatusClass()">
                    {{ currentMetrics.cpu.usage.toFixed(1) }}%
                  </span>
                  <span class="trend" :class="getCpuTrendClass()">
                    <el-icon
                      ><ArrowUp v-if="cpuTrend > 0" /><ArrowDown v-else
                    /></el-icon>
                    {{ Math.abs(cpuTrend).toFixed(1) }}%
                  </span>
                </div>
              </div>
            </div>
            <div class="card-details">
              <div class="detail-item">
                <span class="label">核心数:</span>
                <span class="value">{{ currentMetrics.cpu.cores }}</span>
              </div>
              <div class="detail-item">
                <span class="label">温度:</span>
                <span class="value"
                  >{{
                    (currentMetrics.cpu.temperature || 0).toFixed(1)
                  }}°C</span
                >
              </div>
              <div class="detail-item">
                <span class="label">频率:</span>
                <span class="value"
                  >{{
                    ((currentMetrics.cpu as any).frequency || 2400).toFixed(0)
                  }}MHz</span
                >
              </div>
            </div>
            <div class="mini-chart">
              <VChart :option="cpuMiniChartOption" autoresize />
            </div>
          </div>
        </el-col>

        <el-col :span="6">
          <div class="resource-card">
            <div class="card-header">
              <div class="card-icon memory">
                <el-icon><Monitor /></el-icon>
              </div>
              <div class="card-info">
                <h4>内存使用</h4>
                <div class="card-value">
                  <span class="value" :class="getMemoryStatusClass()">
                    {{ currentMetrics.memory.usage.toFixed(1) }}%
                  </span>
                  <span class="trend" :class="getMemoryTrendClass()">
                    <el-icon
                      ><ArrowUp v-if="memoryTrend > 0" /><ArrowDown v-else
                    /></el-icon>
                    {{ Math.abs(memoryTrend).toFixed(1) }}%
                  </span>
                </div>
              </div>
            </div>
            <div class="card-details">
              <div class="detail-item">
                <span class="label">已用:</span>
                <span class="value">{{
                  formatBytes(currentMetrics.memory.used)
                }}</span>
              </div>
              <div class="detail-item">
                <span class="label">可用:</span>
                <span class="value">{{
                  formatBytes(currentMetrics.memory.free)
                }}</span>
              </div>
              <div class="detail-item">
                <span class="label">总计:</span>
                <span class="value">{{
                  formatBytes(currentMetrics.memory.total)
                }}</span>
              </div>
            </div>
            <div class="mini-chart">
              <VChart :option="memoryMiniChartOption" autoresize />
            </div>
          </div>
        </el-col>

        <el-col :span="6">
          <div class="resource-card">
            <div class="card-header">
              <div class="card-icon network">
                <el-icon><Connection /></el-icon>
              </div>
              <div class="card-info">
                <h4>网络流量</h4>
                <div class="card-value">
                  <span class="value">
                    {{
                      formatBandwidth(
                        currentMetrics.network.bytesIn +
                          currentMetrics.network.bytesOut,
                      )
                    }}
                  </span>
                  <span class="trend positive">
                    <el-icon><ArrowUp /></el-icon>
                    {{ networkConnections }}连接
                  </span>
                </div>
              </div>
            </div>
            <div class="card-details">
              <div class="detail-item">
                <span class="label">入流量:</span>
                <span class="value">{{
                  formatBandwidth(currentMetrics.network.bytesIn)
                }}</span>
              </div>
              <div class="detail-item">
                <span class="label">出流量:</span>
                <span class="value">{{
                  formatBandwidth(currentMetrics.network.bytesOut)
                }}</span>
              </div>
              <div class="detail-item">
                <span class="label">延迟:</span>
                <span class="value">{{ networkLatency }}ms</span>
              </div>
            </div>
            <div class="mini-chart">
              <VChart :option="networkMiniChartOption" autoresize />
            </div>
          </div>
        </el-col>

        <el-col :span="6">
          <div class="resource-card">
            <div class="card-header">
              <div class="card-icon disk">
                <el-icon><FolderOpened /></el-icon>
              </div>
              <div class="card-info">
                <h4>磁盘I/O</h4>
                <div class="card-value">
                  <span class="value" :class="getDiskStatusClass()">
                    {{ currentMetrics.disk.usage.toFixed(1) }}%
                  </span>
                  <span class="trend" :class="getDiskTrendClass()">
                    <el-icon
                      ><ArrowUp v-if="diskTrend > 0" /><ArrowDown v-else
                    /></el-icon>
                    {{ Math.abs(diskTrend).toFixed(1) }}%
                  </span>
                </div>
              </div>
            </div>
            <div class="card-details">
              <div class="detail-item">
                <span class="label">读取:</span>
                <span class="value">{{
                  formatIOPS(currentMetrics.disk.readOps)
                }}</span>
              </div>
              <div class="detail-item">
                <span class="label">写入:</span>
                <span class="value">{{
                  formatIOPS(currentMetrics.disk.writeOps)
                }}</span>
              </div>
              <div class="detail-item">
                <span class="label">队列:</span>
                <span class="value">{{ diskQueue }}</span>
              </div>
            </div>
            <div class="mini-chart">
              <VChart :option="diskMiniChartOption" autoresize />
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 进程监控 -->
    <div class="process-monitor">
      <div class="section-header">
        <h3>进程监控</h3>
        <div class="process-controls">
          <el-input
            v-model="processSearch"
            placeholder="搜索进程..."
            size="small"
            style="width: 200px"
            :prefix-icon="Search"
            clearable
          />
          <el-select
            v-model="processSortBy"
            size="small"
            style="width: 120px"
            @change="sortProcesses"
          >
            <el-option label="CPU使用率" value="cpu" />
            <el-option label="内存使用" value="memory" />
            <el-option label="进程名" value="name" />
            <el-option label="PID" value="pid" />
          </el-select>
        </div>
      </div>

      <el-table
        :data="filteredProcesses"
        class="process-table"
        size="small"
        max-height="300"
        empty-text="没有找到匹配的进程"
      >
        <el-table-column prop="pid" label="PID" width="80" />
        <el-table-column prop="name" label="进程名" min-width="150">
          <template #default="{ row }">
            <div class="process-name">
              <el-icon
                class="process-icon"
                :style="{ color: getProcessColor(row.type) }"
              >
                <Monitor />
              </el-icon>
              {{ row.name }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="cpu" label="CPU%" width="80" sortable>
          <template #default="{ row }">
            <span :class="getProcessCpuClass(row.cpu)">
              {{ row.cpu.toFixed(1) }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="memory" label="内存" width="100" sortable>
          <template #default="{ row }">
            {{ formatBytes(row.memory) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="getProcessStatusType(row.status)" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="startTime" label="启动时间" width="120">
          <template #default="{ row }">
            {{ formatProcessTime(row.startTime) }}
          </template>
        </el-table-column>
        <el-table-column prop="actions" label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="danger"
              :disabled="row.type === 'system'"
              @click="killProcess(row)"
            >
              终止
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 系统服务监控 -->
    <div class="service-monitor">
      <div class="section-header">
        <h3>系统服务</h3>
        <el-button size="small" :icon="Refresh" @click="refreshServices">
          刷新服务
        </el-button>
      </div>

      <el-row :gutter="16">
        <el-col v-for="service in systemServices" :key="service.name" :span="8">
          <div class="service-card">
            <div class="service-header">
              <div class="service-name">{{ service.displayName }}</div>
              <el-tag
                :type="service.status === 'running' ? 'success' : 'danger'"
                size="small"
              >
                {{ service.status === "running" ? "运行中" : "已停止" }}
              </el-tag>
            </div>
            <div class="service-details">
              <div class="detail-row">
                <span class="label">服务名:</span>
                <span class="value">{{ service.name }}</span>
              </div>
              <div class="detail-row">
                <span class="label">启动类型:</span>
                <span class="value">{{ service.startType }}</span>
              </div>
              <div class="detail-row">
                <span class="label">运行时间:</span>
                <span class="value">{{ formatUptime(service.uptime) }}</span>
              </div>
            </div>
            <div class="service-actions">
              <el-button-group size="small">
                <el-button
                  v-if="service.status === 'stopped'"
                  type="success"
                  @click="startService(service)"
                >
                  启动
                </el-button>
                <el-button
                  v-if="service.status === 'running'"
                  type="warning"
                  @click="stopService(service)"
                >
                  停止
                </el-button>
                <el-button @click="restartService(service)"> 重启 </el-button>
              </el-button-group>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import VChart from "vue-echarts";
import {
  Refresh,
  Search,
  Cpu,
  Monitor,
  Connection,
  FolderOpened,
  ArrowUp,
  ArrowDown,
} from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useMonitoringStore } from "@/stores/monitoring";

interface Process {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  status: string;
  startTime: Date;
  type: "user" | "system";
}

interface SystemService {
  name: string;
  displayName: string;
  status: "running" | "stopped";
  startType: string;
  uptime: number;
}

const monitoringStore = useMonitoringStore();

// 响应式状态
const selectedTimeRange = ref("realtime");
const loading = ref(false);
const processSearch = ref("");
const processSortBy = ref("cpu");

// 模拟数据
const processes = ref<Process[]>([
  {
    pid: 1234,
    name: "node.exe",
    cpu: 15.2,
    memory: 256 * 1024 * 1024,
    status: "running",
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    type: "user",
  },
  {
    pid: 5678,
    name: "chrome.exe",
    cpu: 8.7,
    memory: 512 * 1024 * 1024,
    status: "running",
    startTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
    type: "user",
  },
  {
    pid: 9012,
    name: "system",
    cpu: 2.1,
    memory: 128 * 1024 * 1024,
    status: "running",
    startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
    type: "system",
  },
  {
    pid: 3456,
    name: "vscode.exe",
    cpu: 12.5,
    memory: 384 * 1024 * 1024,
    status: "running",
    startTime: new Date(Date.now() - 6 * 60 * 60 * 1000),
    type: "user",
  },
  {
    pid: 7890,
    name: "explorer.exe",
    cpu: 3.2,
    memory: 196 * 1024 * 1024,
    status: "running",
    startTime: new Date(Date.now() - 12 * 60 * 60 * 1000),
    type: "system",
  },
]);

const systemServices = ref<SystemService[]>([
  {
    name: "mcp-swagger-server",
    displayName: "MCP Swagger 服务器",
    status: "running",
    startType: "自动",
    uptime: 2 * 60 * 60,
  },
  {
    name: "nginx",
    displayName: "Nginx Web 服务器",
    status: "running",
    startType: "自动",
    uptime: 24 * 60 * 60,
  },
  {
    name: "redis",
    displayName: "Redis 缓存服务",
    status: "stopped",
    startType: "手动",
    uptime: 0,
  },
  {
    name: "postgresql",
    displayName: "PostgreSQL 数据库",
    status: "running",
    startType: "自动",
    uptime: 18 * 60 * 60,
  },
  {
    name: "elasticsearch",
    displayName: "Elasticsearch 搜索",
    status: "stopped",
    startType: "手动",
    uptime: 0,
  },
  {
    name: "docker",
    displayName: "Docker 容器引擎",
    status: "running",
    startType: "自动",
    uptime: 12 * 60 * 60,
  },
]);

// 计算属性
const currentMetrics = computed(
  () =>
    monitoringStore.currentMetrics || {
      cpu: { usage: 0, cores: 0, temperature: 0 },
      memory: { usage: 0, used: 0, free: 0, total: 0 },
      disk: { usage: 0, readOps: 0, writeOps: 0 },
      network: { bytesIn: 0, bytesOut: 0 },
    },
);

const recentMetrics = computed(() => monitoringStore.metrics.slice(-20));

// 趋势计算
const cpuTrend = computed(() => {
  const recent = recentMetrics.value;
  if (recent.length < 2) return 0;
  return (
    recent[recent.length - 1].cpu.usage - recent[recent.length - 2].cpu.usage
  );
});

const memoryTrend = computed(() => {
  const recent = recentMetrics.value;
  if (recent.length < 2) return 0;
  return (
    recent[recent.length - 1].memory.usage -
    recent[recent.length - 2].memory.usage
  );
});

const diskTrend = computed(() => {
  const recent = recentMetrics.value;
  if (recent.length < 2) return 0;
  return (
    recent[recent.length - 1].disk.usage - recent[recent.length - 2].disk.usage
  );
});

// 网络附加信息
const networkConnections = computed(() => Math.floor(Math.random() * 50) + 10);

const networkLatency = computed(() => Math.floor(Math.random() * 20) + 5);

const diskQueue = computed(() => Math.floor(Math.random() * 10));

// 进程过滤和排序
const filteredProcesses = computed(() => {
  let filtered = processes.value;

  if (processSearch.value) {
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(processSearch.value.toLowerCase()) ||
        p.pid.toString().includes(processSearch.value),
    );
  }

  return filtered.sort((a, b) => {
    switch (processSortBy.value) {
      case "cpu":
        return b.cpu - a.cpu;
      case "memory":
        return b.memory - a.memory;
      case "name":
        return a.name.localeCompare(b.name);
      case "pid":
        return a.pid - b.pid;
      default:
        return 0;
    }
  });
});

// 迷你图表配置
const cpuMiniChartOption = computed(() => ({
  grid: { left: 0, right: 0, top: 5, bottom: 5 },
  xAxis: { type: "category", show: false },
  yAxis: { type: "value", show: false, max: 100 },
  series: [
    {
      type: "line",
      symbol: "none",
      lineStyle: { width: 2, color: "#409EFF" },
      areaStyle: { color: "rgba(64, 158, 255, 0.3)" },
      data: recentMetrics.value.map((m) => m.cpu.usage),
    },
  ],
}));

const memoryMiniChartOption = computed(() => ({
  grid: { left: 0, right: 0, top: 5, bottom: 5 },
  xAxis: { type: "category", show: false },
  yAxis: { type: "value", show: false, max: 100 },
  series: [
    {
      type: "line",
      symbol: "none",
      lineStyle: { width: 2, color: "#67C23A" },
      areaStyle: { color: "rgba(103, 194, 58, 0.3)" },
      data: recentMetrics.value.map((m) => m.memory.usage),
    },
  ],
}));

const networkMiniChartOption = computed(() => ({
  grid: { left: 0, right: 0, top: 5, bottom: 5 },
  xAxis: { type: "category", show: false },
  yAxis: { type: "value", show: false },
  series: [
    {
      type: "line",
      symbol: "none",
      lineStyle: { width: 1, color: "#E6A23C" },
      data: recentMetrics.value.map((m) => m.network.bytesIn),
    },
    {
      type: "line",
      symbol: "none",
      lineStyle: { width: 1, color: "#F56C6C" },
      data: recentMetrics.value.map((m) => m.network.bytesOut),
    },
  ],
}));

const diskMiniChartOption = computed(() => ({
  grid: { left: 0, right: 0, top: 5, bottom: 5 },
  xAxis: { type: "category", show: false },
  yAxis: { type: "value", show: false },
  series: [
    {
      type: "line",
      symbol: "none",
      lineStyle: { width: 1, color: "#909399" },
      data: recentMetrics.value.map((m) => m.disk.readOps),
    },
    {
      type: "line",
      symbol: "none",
      lineStyle: { width: 1, color: "#C0C4CC" },
      data: recentMetrics.value.map((m) => m.disk.writeOps),
    },
  ],
}));

// 方法
const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const formatBandwidth = (bytesPerSecond: number) => {
  return formatBytes(bytesPerSecond) + "/s";
};

const formatIOPS = (iops: number) => {
  if (iops >= 1000) {
    return (iops / 1000).toFixed(1) + "K IOPS";
  }
  return iops + " IOPS";
};

const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}天${hours}小时`;
  } else if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  } else {
    return `${minutes}分钟`;
  }
};

const formatProcessTime = (time: Date) => {
  return time.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

// 状态类名
const getCpuStatusClass = () => {
  const usage = currentMetrics.value.cpu.usage;
  if (usage >= 90) return "status-critical";
  if (usage >= 70) return "status-warning";
  return "status-normal";
};

const getMemoryStatusClass = () => {
  const usage = currentMetrics.value.memory.usage;
  if (usage >= 95) return "status-critical";
  if (usage >= 80) return "status-warning";
  return "status-normal";
};

const getDiskStatusClass = () => {
  const usage = currentMetrics.value.disk.usage;
  if (usage >= 95) return "status-critical";
  if (usage >= 85) return "status-warning";
  return "status-normal";
};

const getCpuTrendClass = () => (cpuTrend.value > 0 ? "negative" : "positive");
const getMemoryTrendClass = () =>
  memoryTrend.value > 0 ? "negative" : "positive";
const getDiskTrendClass = () => (diskTrend.value > 0 ? "negative" : "positive");

const getProcessColor = (type: string) => {
  return type === "system" ? "#909399" : "#409EFF";
};

const getProcessCpuClass = (cpu: number) => {
  if (cpu >= 80) return "cpu-critical";
  if (cpu >= 50) return "cpu-warning";
  return "cpu-normal";
};

const getProcessStatusType = (status: string) => {
  return status === "running" ? "success" : "info";
};

// 事件处理
const handleTimeRangeChange = (range: string) => {
  ElMessage.info(`切换到${range === "realtime" ? "实时" : range}视图`);
};

const refreshData = () => {
  loading.value = true;
  monitoringStore.refreshMetrics();
  setTimeout(() => {
    loading.value = false;
    ElMessage.success("数据已刷新");
  }, 1000);
};

const sortProcesses = () => {
  ElMessage.info(`按${processSortBy.value}排序`);
};

const killProcess = async (process: Process) => {
  try {
    await ElMessageBox.confirm(
      `确定要终止进程"${process.name}"(PID: ${process.pid})吗？`,
      "确认终止进程",
      {
        confirmButtonText: "终止",
        cancelButtonText: "取消",
        type: "warning",
      },
    );

    // 模拟终止进程
    const index = processes.value.findIndex((p) => p.pid === process.pid);
    if (index > -1) {
      processes.value.splice(index, 1);
      ElMessage.success(`进程${process.name}已终止`);
    }
  } catch {
    // 用户取消
  }
};

const refreshServices = () => {
  ElMessage.success("服务列表已刷新");
};

const startService = (service: SystemService) => {
  service.status = "running";
  service.uptime = 0;
  ElMessage.success(`服务"${service.displayName}"已启动`);
};

const stopService = async (service: SystemService) => {
  try {
    await ElMessageBox.confirm(
      `确定要停止服务"${service.displayName}"吗？`,
      "确认停止服务",
      {
        confirmButtonText: "停止",
        cancelButtonText: "取消",
        type: "warning",
      },
    );

    service.status = "stopped";
    service.uptime = 0;
    ElMessage.success(`服务"${service.displayName}"已停止`);
  } catch {
    // 用户取消
  }
};

const restartService = (service: SystemService) => {
  service.status = "running";
  service.uptime = 0;
  ElMessage.success(`服务"${service.displayName}"已重启`);
};

// 生命周期
onMounted(() => {
  // 启动监控数据更新
  if (!monitoringStore.isMonitoring) {
    monitoringStore.startMonitoring();
  }
});
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

.resource-overview {
  margin-bottom: 24px;
}

.resource-card {
  height: 220px;
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
  align-items: center;
  gap: 8px;
}

.card-value .value {
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
}

.card-value .trend {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  font-weight: 500;
}

.status-normal {
  color: var(--el-color-success);
}

.status-warning {
  color: var(--el-color-warning);
}

.status-critical {
  color: var(--el-color-danger);
}

.trend.positive {
  color: var(--el-color-success);
}

.trend.negative {
  color: var(--el-color-danger);
}

.card-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  font-size: 12px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
}

.detail-item .label {
  color: var(--el-text-color-regular);
}

.detail-item .value {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.mini-chart {
  flex: 1;
  min-height: 0;
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

.process-table {
  margin-bottom: 16px;
}

.process-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.process-icon {
  font-size: 14px;
}

.cpu-normal {
  color: var(--el-color-success);
}

.cpu-warning {
  color: var(--el-color-warning);
}

.cpu-critical {
  color: var(--el-color-danger);
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

.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.detail-row .label {
  color: var(--el-text-color-regular);
}

.detail-row .value {
  color: var(--el-text-color-primary);
}

.service-actions {
  display: flex;
  justify-content: flex-end;
}

/* 响应式设计 */
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

  .monitor-controls {
    width: 100%;
    justify-content: flex-end;
  }

  .resource-card {
    height: auto;
  }

  .card-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .process-controls {
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .process-controls .el-input,
  .process-controls .el-select {
    width: 100%;
  }

  .service-header {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
}
</style>
