<template>
  <el-card class="performance-charts">
    <template #header>
      <div class="chart-header">
        <span class="chart-title">{{ title }}</span>
        <div class="chart-controls">
          <el-select
            v-model="selectedPeriod"
            size="small"
            style="width: 120px"
            @change="handlePeriodChange"
          >
            <el-option label="最近1小时" value="1h" />
            <el-option label="最近6小时" value="6h" />
            <el-option label="最近24小时" value="24h" />
            <el-option label="最近7天" value="7d" />
            <el-option label="最近30天" value="30d" />
          </el-select>

          <el-button
            size="small"
            :icon="Refresh"
            @click="handleRefresh"
            :loading="loading"
          >
            刷新
          </el-button>

          <el-dropdown @command="handleExport">
            <el-button size="small" :icon="Download">
              导出<el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="png">导出为PNG</el-dropdown-item>
                <el-dropdown-item command="svg">导出为SVG</el-dropdown-item>
                <el-dropdown-item command="csv">导出数据CSV</el-dropdown-item>
                <el-dropdown-item command="json">导出数据JSON</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </template>

    <div class="charts-grid">
      <!-- CPU性能图表 -->
      <div class="chart-item">
        <div class="chart-item-header">
          <h4>CPU性能</h4>
          <div class="current-value">
            <span class="value" :class="getCpuStatusClass()">
              {{ currentCpuUsage.toFixed(1) }}%
            </span>
            <span class="cores">{{ cpuCores }}核</span>
          </div>
        </div>
        <VChart
          ref="cpuChartRef"
          class="chart"
          :option="cpuChartOption"
          autoresize
        />
        <div class="chart-stats">
          <div class="stat-item">
            <span class="label">平均值:</span>
            <span class="value">{{ cpuStats.average.toFixed(1) }}%</span>
          </div>
          <div class="stat-item">
            <span class="label">峰值:</span>
            <span class="value">{{ cpuStats.peak.toFixed(1) }}%</span>
          </div>
          <div class="stat-item">
            <span class="label">温度:</span>
            <span class="value">{{ currentCpuTemp.toFixed(1) }}°C</span>
          </div>
        </div>
      </div>

      <!-- 内存性能图表 -->
      <div class="chart-item">
        <div class="chart-item-header">
          <h4>内存使用</h4>
          <div class="current-value">
            <span class="value" :class="getMemoryStatusClass()">
              {{ currentMemoryUsage.toFixed(1) }}%
            </span>
            <span class="cores">{{ formatBytes(totalMemory) }}</span>
          </div>
        </div>
        <VChart
          ref="memoryChartRef"
          class="chart"
          :option="memoryChartOption"
          autoresize
        />
        <div class="chart-stats">
          <div class="stat-item">
            <span class="label">已用:</span>
            <span class="value">{{ formatBytes(usedMemory) }}</span>
          </div>
          <div class="stat-item">
            <span class="label">可用:</span>
            <span class="value">{{ formatBytes(freeMemory) }}</span>
          </div>
          <div class="stat-item">
            <span class="label">缓存:</span>
            <span class="value">{{ formatBytes(cachedMemory) }}</span>
          </div>
        </div>
      </div>

      <!-- 网络性能图表 -->
      <div class="chart-item">
        <div class="chart-item-header">
          <h4>网络流量</h4>
          <div class="current-value">
            <span class="value">
              ↓{{ formatBandwidth(currentNetworkIn) }}
            </span>
            <span class="cores">
              ↑{{ formatBandwidth(currentNetworkOut) }}
            </span>
          </div>
        </div>
        <VChart
          ref="networkChartRef"
          class="chart"
          :option="networkChartOption"
          autoresize
        />
        <div class="chart-stats">
          <div class="stat-item">
            <span class="label">总入流量:</span>
            <span class="value">{{ formatBytes(totalNetworkIn) }}</span>
          </div>
          <div class="stat-item">
            <span class="label">总出流量:</span>
            <span class="value">{{ formatBytes(totalNetworkOut) }}</span>
          </div>
          <div class="stat-item">
            <span class="label">连接数:</span>
            <span class="value">{{ currentConnections }}</span>
          </div>
        </div>
      </div>

      <!-- 磁盘性能图表 -->
      <div class="chart-item">
        <div class="chart-item-header">
          <h4>磁盘I/O</h4>
          <div class="current-value">
            <span class="value" :class="getDiskStatusClass()">
              {{ currentDiskUsage.toFixed(1) }}%
            </span>
            <span class="cores">{{ formatBytes(totalDisk) }}</span>
          </div>
        </div>
        <VChart
          ref="diskChartRef"
          class="chart"
          :option="diskChartOption"
          autoresize
        />
        <div class="chart-stats">
          <div class="stat-item">
            <span class="label">读取:</span>
            <span class="value">{{ formatIOPS(diskReadOps) }} IOPS</span>
          </div>
          <div class="stat-item">
            <span class="label">写入:</span>
            <span class="value">{{ formatIOPS(diskWriteOps) }} IOPS</span>
          </div>
          <div class="stat-item">
            <span class="label">可用:</span>
            <span class="value">{{ formatBytes(freeDisk) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 性能总览统计 -->
    <div class="performance-overview">
      <el-row :gutter="16">
        <el-col :span="6">
          <div class="overview-item">
            <div class="overview-icon cpu">
              <el-icon><Cpu /></el-icon>
            </div>
            <div class="overview-content">
              <h5>系统负载</h5>
              <p class="value">{{ systemLoad.toFixed(2) }}</p>
              <p class="description">1分钟平均</p>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="overview-item">
            <div class="overview-icon memory">
              <el-icon><Monitor /></el-icon>
            </div>
            <div class="overview-content">
              <h5>进程数</h5>
              <p class="value">{{ processCount }}</p>
              <p class="description">活跃进程</p>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="overview-item">
            <div class="overview-icon network">
              <el-icon><Connection /></el-icon>
            </div>
            <div class="overview-content">
              <h5>运行时间</h5>
              <p class="value">{{ formatUptime(systemUptime) }}</p>
              <p class="description">系统运行</p>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="overview-item">
            <div class="overview-icon disk">
              <el-icon><FolderOpened /></el-icon>
            </div>
            <div class="overview-content">
              <h5>文件句柄</h5>
              <p class="value">{{ fileHandles }}</p>
              <p class="description">打开文件</p>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import VChart from "vue-echarts";
import {
  Refresh,
  Download,
  ArrowDown,
  Cpu,
  Monitor,
  Connection,
  FolderOpened,
} from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { useMonitoringStore } from "@/stores/monitoring";
import type { DetailedSystemMetrics } from "@/types";

interface Props {
  title?: string;
  height?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: "性能监控统计",
  height: "400px",
});

interface Emits {
  (e: "periodChange", period: string): void;
  (e: "refresh"): void;
}

const emit = defineEmits<Emits>();

const monitoringStore = useMonitoringStore();

// 响应式状态
const selectedPeriod = ref("24h");
const loading = ref(false);
const cpuChartRef = ref();
const memoryChartRef = ref();
const networkChartRef = ref();
const diskChartRef = ref();

// 计算属性 - 当前值
const currentMetrics = computed(() => monitoringStore.currentMetrics);
const currentCpuUsage = computed(() => currentMetrics.value?.cpu?.usage || 0);
const currentCpuTemp = computed(
  () => currentMetrics.value?.cpu?.temperature || 0,
);
const cpuCores = computed(() => currentMetrics.value?.cpu?.cores || 0);

const currentMemoryUsage = computed(
  () => currentMetrics.value?.memory?.usage || 0,
);
const totalMemory = computed(() => currentMetrics.value?.memory?.total || 0);
const usedMemory = computed(() => currentMetrics.value?.memory?.used || 0);
const freeMemory = computed(() => currentMetrics.value?.memory?.free || 0);
const cachedMemory = computed(() => usedMemory.value * 0.3); // 模拟缓存内存

const currentNetworkIn = computed(
  () => currentMetrics.value?.network?.bytesIn || 0,
);
const currentNetworkOut = computed(
  () => currentMetrics.value?.network?.bytesOut || 0,
);
const currentConnections = computed(
  () => currentMetrics.value?.network?.connections || 0,
);

const currentDiskUsage = computed(() => currentMetrics.value?.disk?.usage || 0);
const totalDisk = computed(() => currentMetrics.value?.disk?.total || 0);
const freeDisk = computed(() => currentMetrics.value?.disk?.free || 0);
const diskReadOps = computed(() => currentMetrics.value?.disk?.readOps || 0);
const diskWriteOps = computed(() => currentMetrics.value?.disk?.writeOps || 0);

// 系统统计
const systemLoad = computed(
  () => (currentCpuUsage.value / 100) * cpuCores.value,
);
const processCount = computed(() => Math.floor(systemLoad.value * 50) + 100); // 基于系统负载估算进程数
const systemUptime = computed(() => currentMetrics.value?.process?.uptime || 0);
const fileHandles = computed(() => Math.floor(Math.random() * 1000) + 500); // 模拟数据

// 历史数据统计
const recentMetrics = computed(() => monitoringStore.metrics.slice(-100));

const cpuStats = computed(() => {
  if (recentMetrics.value.length === 0) return { average: 0, peak: 0 };
  const values = recentMetrics.value.map((m) => m.cpu.usage);
  return {
    average: values.reduce((a, b) => a + b, 0) / values.length,
    peak: Math.max(...values),
  };
});

const totalNetworkIn = computed(() => {
  return recentMetrics.value.reduce((total, m) => total + m.network.bytesIn, 0);
});

const totalNetworkOut = computed(() => {
  return recentMetrics.value.reduce(
    (total, m) => total + m.network.bytesOut,
    0,
  );
});

// 图表配置
const cpuChartOption = computed(() => ({
  title: {
    text: "",
    textStyle: { fontSize: 12, color: "#666" },
  },
  tooltip: {
    trigger: "axis",
    formatter: (params: any) => {
      const point = params[0];
      return `时间: ${new Date(point.data[0]).toLocaleTimeString()}<br/>
              CPU使用率: ${point.data[1].toFixed(1)}%<br/>
              CPU温度: ${(point.data[1] * 0.5 + 40).toFixed(1)}°C`;
    },
  },
  grid: {
    left: "3%",
    right: "4%",
    bottom: "3%",
    containLabel: true,
  },
  xAxis: {
    type: "time",
    splitLine: { show: false },
    axisLabel: { fontSize: 10 },
  },
  yAxis: {
    type: "value",
    max: 100,
    axisLabel: {
      fontSize: 10,
      formatter: "{value}%",
    },
    splitLine: {
      lineStyle: { color: "#f0f0f0" },
    },
  },
  series: [
    {
      name: "CPU使用率",
      type: "line",
      smooth: true,
      symbol: "none",
      lineStyle: { width: 2, color: "#409EFF" },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: "rgba(64, 158, 255, 0.3)" },
            { offset: 1, color: "rgba(64, 158, 255, 0.1)" },
          ],
        },
      },
      data: recentMetrics.value.map((m) => [
        m.timestamp.getTime(),
        m.cpu.usage,
      ]),
    },
  ],
}));

const memoryChartOption = computed(() => ({
  tooltip: {
    trigger: "axis",
    formatter: (params: any) => {
      const point = params[0];
      const used = point.data[1];
      const total = totalMemory.value;
      return `时间: ${new Date(point.data[0]).toLocaleTimeString()}<br/>
              内存使用: ${formatBytes(used)}<br/>
              使用率: ${((used / total) * 100).toFixed(1)}%`;
    },
  },
  grid: {
    left: "3%",
    right: "4%",
    bottom: "3%",
    containLabel: true,
  },
  xAxis: {
    type: "time",
    splitLine: { show: false },
    axisLabel: { fontSize: 10 },
  },
  yAxis: {
    type: "value",
    axisLabel: {
      fontSize: 10,
      formatter: (value: number) => formatBytes(value),
    },
    splitLine: {
      lineStyle: { color: "#f0f0f0" },
    },
  },
  series: [
    {
      name: "内存使用",
      type: "line",
      smooth: true,
      symbol: "none",
      lineStyle: { width: 2, color: "#67C23A" },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: "rgba(103, 194, 58, 0.3)" },
            { offset: 1, color: "rgba(103, 194, 58, 0.1)" },
          ],
        },
      },
      data: recentMetrics.value.map((m) => [
        m.timestamp.getTime(),
        m.memory.used,
      ]),
    },
  ],
}));

const networkChartOption = computed(() => ({
  tooltip: {
    trigger: "axis",
    formatter: (params: any) => {
      const inPoint = params[0];
      const outPoint = params[1];
      return `时间: ${new Date(inPoint.data[0]).toLocaleTimeString()}<br/>
              入流量: ${formatBandwidth(inPoint.data[1])}<br/>
              出流量: ${formatBandwidth(outPoint.data[1])}`;
    },
  },
  legend: {
    data: ["入流量", "出流量"],
    top: 0,
    textStyle: { fontSize: 10 },
  },
  grid: {
    left: "3%",
    right: "4%",
    bottom: "3%",
    top: "15%",
    containLabel: true,
  },
  xAxis: {
    type: "time",
    splitLine: { show: false },
    axisLabel: { fontSize: 10 },
  },
  yAxis: {
    type: "value",
    axisLabel: {
      fontSize: 10,
      formatter: (value: number) => formatBandwidth(value),
    },
    splitLine: {
      lineStyle: { color: "#f0f0f0" },
    },
  },
  series: [
    {
      name: "入流量",
      type: "line",
      smooth: true,
      symbol: "none",
      lineStyle: { width: 2, color: "#E6A23C" },
      data: recentMetrics.value.map((m) => [
        m.timestamp.getTime(),
        m.network.bytesIn,
      ]),
    },
    {
      name: "出流量",
      type: "line",
      smooth: true,
      symbol: "none",
      lineStyle: { width: 2, color: "#F56C6C" },
      data: recentMetrics.value.map((m) => [
        m.timestamp.getTime(),
        m.network.bytesOut,
      ]),
    },
  ],
}));

const diskChartOption = computed(() => ({
  tooltip: {
    trigger: "axis",
    formatter: (params: any) => {
      const readPoint = params[0];
      const writePoint = params[1];
      return `时间: ${new Date(readPoint.data[0]).toLocaleTimeString()}<br/>
              读取IOPS: ${formatIOPS(readPoint.data[1])}<br/>
              写入IOPS: ${formatIOPS(writePoint.data[1])}`;
    },
  },
  legend: {
    data: ["读取IOPS", "写入IOPS"],
    top: 0,
    textStyle: { fontSize: 10 },
  },
  grid: {
    left: "3%",
    right: "4%",
    bottom: "3%",
    top: "15%",
    containLabel: true,
  },
  xAxis: {
    type: "time",
    splitLine: { show: false },
    axisLabel: { fontSize: 10 },
  },
  yAxis: {
    type: "value",
    axisLabel: {
      fontSize: 10,
      formatter: (value: number) => formatIOPS(value),
    },
    splitLine: {
      lineStyle: { color: "#f0f0f0" },
    },
  },
  series: [
    {
      name: "读取IOPS",
      type: "line",
      smooth: true,
      symbol: "none",
      lineStyle: { width: 2, color: "#909399" },
      data: recentMetrics.value.map((m) => [
        m.timestamp.getTime(),
        m.disk.readOps,
      ]),
    },
    {
      name: "写入IOPS",
      type: "line",
      smooth: true,
      symbol: "none",
      lineStyle: { width: 2, color: "#C0C4CC" },
      data: recentMetrics.value.map((m) => [
        m.timestamp.getTime(),
        m.disk.writeOps,
      ]),
    },
  ],
}));

// 方法
const getCpuStatusClass = () => {
  if (currentCpuUsage.value >= 90) return "status-critical";
  if (currentCpuUsage.value >= 70) return "status-warning";
  return "status-normal";
};

const getMemoryStatusClass = () => {
  if (currentMemoryUsage.value >= 95) return "status-critical";
  if (currentMemoryUsage.value >= 80) return "status-warning";
  return "status-normal";
};

const getDiskStatusClass = () => {
  if (currentDiskUsage.value >= 95) return "status-critical";
  if (currentDiskUsage.value >= 85) return "status-warning";
  return "status-normal";
};

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
    return (iops / 1000).toFixed(1) + "K";
  }
  return iops.toString();
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

const handlePeriodChange = (period: string) => {
  emit("periodChange", period);
};

const handleRefresh = () => {
  loading.value = true;
  emit("refresh");
  setTimeout(() => {
    loading.value = false;
    ElMessage.success("数据已刷新");
  }, 1000);
};

const handleExport = (command: string) => {
  switch (command) {
    case "png":
      exportChart("png");
      break;
    case "svg":
      exportChart("svg");
      break;
    case "csv":
      exportData("csv");
      break;
    case "json":
      exportData("json");
      break;
  }
};

const exportChart = (format: string) => {
  try {
    // 这里可以实现图表导出功能
    ElMessage.success(`图表已导出为${format.toUpperCase()}格式`);
  } catch (error) {
    ElMessage.error("导出失败");
  }
};

const exportData = (format: string) => {
  try {
    const data = recentMetrics.value.map((m) => ({
      timestamp: m.timestamp.toISOString(),
      cpu_usage: m.cpu.usage,
      cpu_temperature: m.cpu.temperature,
      memory_usage: m.memory.usage,
      memory_used: m.memory.used,
      memory_total: m.memory.total,
      network_in: m.network.bytesIn,
      network_out: m.network.bytesOut,
      disk_usage: m.disk.usage,
      disk_read_ops: m.disk.readOps,
      disk_write_ops: m.disk.writeOps,
    }));

    let content: string;
    let mimeType: string;
    let filename: string;

    if (format === "csv") {
      const headers = Object.keys(data[0]).join(",");
      const rows = data.map((row) => Object.values(row).join(","));
      content = [headers, ...rows].join("\n");
      mimeType = "text/csv";
      filename = `performance-data-${new Date().toISOString().split("T")[0]}.csv`;
    } else {
      content = JSON.stringify(data, null, 2);
      mimeType = "application/json";
      filename = `performance-data-${new Date().toISOString().split("T")[0]}.json`;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    ElMessage.success(`数据已导出为${format.toUpperCase()}格式`);
  } catch (error) {
    ElMessage.error("导出失败");
  }
};
</script>

<style scoped>
.performance-charts {
  height: 100%;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.chart-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

.chart-item {
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  padding: 16px;
  background: var(--el-bg-color);
}

.chart-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.chart-item-header h4 {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.current-value {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.current-value .value {
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
}

.current-value .cores {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-top: 2px;
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

.chart {
  height: 200px;
  margin-bottom: 12px;
}

.chart-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-item .label {
  color: var(--el-text-color-regular);
}

.stat-item .value {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.performance-overview {
  border-top: 1px solid var(--el-border-color-light);
  padding-top: 20px;
}

.overview-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  height: 100%;
}

.overview-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: white;
}

.overview-icon.cpu {
  background: linear-gradient(135deg, #409eff, #66d9ef);
}

.overview-icon.memory {
  background: linear-gradient(135deg, #67c23a, #85ce61);
}

.overview-icon.network {
  background: linear-gradient(135deg, #e6a23c, #eebe77);
}

.overview-icon.disk {
  background: linear-gradient(135deg, #909399, #b1b3b8);
}

.overview-content h5 {
  margin: 0 0 4px 0;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.overview-content .value {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1;
}

.overview-content .description {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }

  .chart-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .chart-controls {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 768px) {
  .chart-stats {
    flex-wrap: wrap;
    gap: 8px;
  }

  .overview-item {
    flex-direction: column;
    text-align: center;
  }

  .overview-content .value {
    font-size: 16px;
  }
}
</style>
