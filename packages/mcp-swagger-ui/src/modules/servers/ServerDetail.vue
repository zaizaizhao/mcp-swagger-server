<template>
  <div class="server-detail">
    <!-- 页面头部 -->
    <div class="detail-header">
      <el-page-header
        @back="goBack"
        :content="serverInfo?.name || 'Loading...'"
      >
        <template #extra>
          <div class="header-actions">
            <el-button-group>
              <el-button
                v-if="serverInfo?.status === 'stopped'"
                type="success"
                :icon="VideoPlay"
                @click="startServer"
                :loading="actionLoading"
              >
                启动
              </el-button>
              <el-button
                v-else-if="serverInfo?.status === 'running'"
                type="warning"
                :icon="VideoPause"
                @click="stopServer"
                :loading="actionLoading"
              >
                停止
              </el-button>
              <el-button
                v-if="serverInfo?.status === 'running'"
                type="info"
                :icon="Refresh"
                @click="restartServer"
                :loading="actionLoading"
              >
                重启
              </el-button>
            </el-button-group>
            <el-button
              type="primary"
              :icon="Edit"
              @click="showEditDialog = true"
              :disabled="!serverInfo"
            >
              编辑配置
            </el-button>
          </div>
        </template>
      </el-page-header>

      <!-- 服务器状态概览 -->
      <div class="status-overview" v-if="serverInfo">
        <el-row :gutter="16">
          <el-col :span="6">
            <el-card class="status-card">
              <div class="status-content">
                <div class="status-icon" :class="`status-${serverInfo.status}`">
                  <el-icon
                    ><component :is="getStatusIcon(serverInfo.status)"
                  /></el-icon>
                </div>
                <div class="status-text">
                  <div class="status-label">
                    {{ getStatusText(serverInfo.status) }}
                  </div>
                  <div
                    class="status-time"
                    v-if="serverInfo.status === 'running'"
                  >
                    运行时间:
                    {{ formatUptime(serverInfo.metrics?.uptime || 0) }}
                  </div>
                </div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card class="metric-card">
              <div class="metric-content">
                <div class="metric-number">
                  {{ serverInfo.tools?.length || 0 }}
                </div>
                <div class="metric-label">可用工具</div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card class="metric-card">
              <div class="metric-content">
                <div class="metric-number">
                  {{ serverInfo.metrics?.totalRequests || 0 }}
                </div>
                <div class="metric-label">总请求数</div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card class="metric-card">
              <div class="metric-content">
                <div class="metric-number">
                  {{ ((serverInfo.metrics?.errorRate || 0) * 100).toFixed(1) }}%
                </div>
                <div class="metric-label">错误率</div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="detail-content" v-loading="loading">
      <el-row :gutter="24" v-if="serverInfo">
        <!-- 左侧内容 -->
        <el-col :span="16">
          <!-- 服务器配置信息 -->
          <el-card class="config-card" style="margin-bottom: 24px">
            <template #header>
              <div class="card-header">
                <span
                  ><el-icon><Setting /></el-icon> 服务器配置</span
                >
                <el-button text @click="showEditDialog = true">
                  <el-icon><Edit /></el-icon>
                </el-button>
              </div>
            </template>

            <el-descriptions :column="2" border>
              <el-descriptions-item label="服务器名称">
                {{ serverInfo.name }}
              </el-descriptions-item>
              <el-descriptions-item label="端点地址">
                <el-link
                  :href="serverInfo.endpoint"
                  target="_blank"
                  type="primary"
                >
                  {{ serverInfo.endpoint }}
                </el-link>
              </el-descriptions-item>
              <el-descriptions-item label="描述" :span="2">
                {{ serverInfo.config?.description || "暂无描述" }}
              </el-descriptions-item>
              <el-descriptions-item label="标签" :span="2">
                <el-tag
                  v-for="tag in serverInfo.config?.tags || []"
                  :key="tag"
                  size="small"
                  style="margin-right: 8px"
                >
                  {{ tag }}
                </el-tag>
                <span v-if="!serverInfo.config?.tags?.length" class="text-muted"
                  >暂无标签</span
                >
              </el-descriptions-item>
              <el-descriptions-item label="自定义头部" :span="2">
                <div v-if="customHeadersArray.length > 0">
                  <el-tag
                    v-for="header in customHeadersArray"
                    :key="header.key"
                    size="small"
                    style="margin-right: 8px; margin-bottom: 4px"
                  >
                    {{ header.key }}: {{ header.value }}
                  </el-tag>
                </div>
                <span v-else class="text-muted">暂无自定义头部</span>
              </el-descriptions-item>
              <el-descriptions-item label="创建时间">
                {{ formatDateTime(serverInfo.createdAt) }}
              </el-descriptions-item>
              <el-descriptions-item label="最后更新">
                {{ formatDateTime(serverInfo.updatedAt) }}
              </el-descriptions-item>
            </el-descriptions>
          </el-card>

          <!-- 性能图表 -->
          <el-card class="chart-card" style="margin-bottom: 24px">
            <template #header>
              <div class="card-header">
                <span
                  ><el-icon><TrendCharts /></el-icon> 性能监控</span
                >
                <el-radio-group v-model="chartTimeRange" size="small">
                  <el-radio-button label="1h">1小时</el-radio-button>
                  <el-radio-button label="6h">6小时</el-radio-button>
                  <el-radio-button label="24h">24小时</el-radio-button>
                  <el-radio-button label="7d">7天</el-radio-button>
                </el-radio-group>
              </div>
            </template>

            <div class="charts-container">
              <div class="chart-wrapper">
                <div class="chart-title">请求数量趋势</div>
                <v-chart
                  class="chart"
                  :option="requestsChartOption"
                  :loading="chartLoading"
                />
              </div>
              <div class="chart-wrapper">
                <div class="chart-title">响应时间趋势</div>
                <v-chart
                  class="chart"
                  :option="responseTimeChartOption"
                  :loading="chartLoading"
                />
              </div>
            </div>
          </el-card>

          <!-- 工具列表 -->
          <el-card class="tools-card">
            <template #header>
              <div class="card-header">
                <span
                  ><el-icon><Tools /></el-icon> 可用工具 ({{
                    serverInfo.tools?.length || 0
                  }})</span
                >
                <el-input
                  v-model="toolSearchQuery"
                  placeholder="搜索工具..."
                  :prefix-icon="Search"
                  size="small"
                  style="width: 200px"
                  clearable
                />
              </div>
            </template>

            <div class="tools-list">
              <el-row :gutter="16">
                <el-col
                  v-for="tool in filteredTools"
                  :key="tool.id"
                  :span="12"
                  style="margin-bottom: 16px"
                >
                  <el-card class="tool-card" @click="showToolDetail(tool)">
                    <div class="tool-header">
                      <div class="tool-name">
                        <el-icon><Cpu /></el-icon>
                        {{ tool.name }}
                      </div>
                      <el-button
                        size="small"
                        type="primary"
                        @click.stop="testTool(tool)"
                      >
                        测试
                      </el-button>
                    </div>
                    <div class="tool-description">
                      {{ tool.description }}
                    </div>
                    <div class="tool-meta">
                      <el-tag size="small" v-if="tool.method">
                        {{ tool.method?.toUpperCase() }}
                      </el-tag>
                      <span class="param-count">
                        {{ getParameterCount(tool.parameters) }} 个参数
                      </span>
                    </div>
                  </el-card>
                </el-col>
              </el-row>

              <el-empty
                v-if="filteredTools.length === 0"
                description="暂无工具或搜索无结果"
                :image-size="100"
              />
            </div>
          </el-card>
        </el-col>

        <!-- 右侧内容 -->
        <el-col :span="8">
          <!-- 实时日志 -->
          <el-card class="logs-card" style="margin-bottom: 24px">
            <template #header>
              <div class="card-header">
                <span
                  ><el-icon><Document /></el-icon> 实时日志</span
                >
                <div class="log-controls">
                  <el-select
                    v-model="logLevel"
                    size="small"
                    style="width: 80px"
                    @change="filterLogs"
                  >
                    <el-option label="全部" value="" />
                    <el-option label="错误" value="error" />
                    <el-option label="警告" value="warn" />
                    <el-option label="信息" value="info" />
                    <el-option label="调试" value="debug" />
                  </el-select>
                  <el-button
                    size="small"
                    :icon="Delete"
                    @click="clearLogs"
                    title="清空日志"
                  />
                </div>
              </div>
            </template>

            <div class="logs-container" ref="logsContainer">
              <div
                v-for="log in displayLogs"
                :key="log.id"
                class="log-entry"
                :class="`log-${log.level}`"
              >
                <div class="log-time">{{ formatLogTime(log.timestamp) }}</div>
                <div class="log-level">{{ log.level.toUpperCase() }}</div>
                <div class="log-message">{{ log.message }}</div>
              </div>

              <div v-if="displayLogs.length === 0" class="no-logs">
                暂无日志数据
              </div>
            </div>
          </el-card>

          <!-- 快速操作 -->
          <el-card class="actions-card">
            <template #header>
              <span
                ><el-icon><Operation /></el-icon> 快速操作</span
              >
            </template>

            <div class="quick-actions">
              <el-button
                class="action-btn"
                @click="viewAllLogs"
                :icon="View"
                type="info"
              >
                查看完整日志
              </el-button>
              <el-button
                class="action-btn"
                @click="goToTester"
                :icon="Tools"
                type="primary"
              >
                工具测试页面
              </el-button>
              <el-button
                class="action-btn"
                @click="exportConfig"
                :icon="Download"
                type="success"
              >
                导出配置
              </el-button>
              <el-button
                class="action-btn"
                @click="showDeleteConfirm = true"
                :icon="Delete"
                type="danger"
                plain
              >
                删除服务器
              </el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 加载状态 -->
      <div v-else-if="!loading" class="error-state">
        <el-result
          icon="warning"
          title="服务器未找到"
          sub-title="请检查服务器ID是否正确"
        >
          <template #extra>
            <el-button type="primary" @click="goBack">返回列表</el-button>
          </template>
        </el-result>
      </div>
    </div>

    <!-- 编辑服务器对话框 -->
    <ServerFormDialog
      v-model="showEditDialog"
      :server="serverInfo"
      @success="handleEditSuccess"
    />

    <!-- 工具详情对话框 -->
    <ToolDetailDialog
      v-model="showToolDialog"
      :tool="selectedTool"
      @test-tool="testTool"
    />

    <!-- 删除确认对话框 -->
    <el-dialog
      v-model="showDeleteConfirm"
      title="删除服务器"
      width="400px"
      align-center
    >
      <div class="delete-confirmation">
        <el-icon class="warning-icon"><WarningFilled /></el-icon>
        <div class="confirmation-text">
          <p>
            确定要删除服务器 <strong>{{ serverInfo?.name }}</strong> 吗？
          </p>
          <p class="warning-text">此操作不可逆，请谨慎操作。</p>
        </div>
      </div>

      <template #footer>
        <el-button @click="showDeleteConfirm = false"> 取消 </el-button>
        <el-button type="danger" @click="deleteServer" :loading="deleteLoading">
          确认删除
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  Edit,
  VideoPlay,
  VideoPause,
  Refresh,
  Setting,
  TrendCharts,
  Tools,
  Search,
  Cpu,
  Document,
  Operation,
  View,
  Download,
  Delete,
  WarningFilled,
} from "@element-plus/icons-vue";
import VChart from "vue-echarts";
import type { MCPServer, MCPTool, LogEntry, ServerStatus } from "@/types";
import { useServerStore } from "@/stores/server";
import { useWebSocketStore } from "@/stores/websocket";
import ServerFormDialog from "./components/ServerFormDialog.vue";
import ToolDetailDialog from "@/modules/testing/components/ToolDetailDialog.vue";

// 路由和状态
const route = useRoute();
const router = useRouter();
const serverStore = useServerStore();
const websocketStore = useWebSocketStore();

// 响应式数据
const loading = ref(true);
const actionLoading = ref(false);
const deleteLoading = ref(false);
const chartLoading = ref(false);
const showEditDialog = ref(false);
const showToolDialog = ref(false);
const showDeleteConfirm = ref(false);
const toolSearchQuery = ref("");
const logLevel = ref("");
const chartTimeRange = ref("1h");
const selectedTool = ref<MCPTool | null>(null);
const logs = ref<LogEntry[]>([]);
const logsContainer = ref<HTMLElement>();

// 计算属性
const serverId = computed(() => route.params.id as string);
const serverInfo = computed(() => serverStore.selectedServer);

const customHeadersArray = computed(() => {
  if (!serverInfo.value?.config?.customHeaders) return [];
  return Object.entries(serverInfo.value.config.customHeaders).map(
    ([key, value]) => ({ key, value }),
  );
});

const filteredTools = computed(() => {
  if (!serverInfo.value?.tools) return [];
  if (!toolSearchQuery.value) return serverInfo.value.tools;

  const query = toolSearchQuery.value.toLowerCase();
  return serverInfo.value.tools.filter(
    (tool) =>
      tool.name.toLowerCase().includes(query) ||
      tool.description.toLowerCase().includes(query),
  );
});

const displayLogs = computed(() => {
  let filtered = logs.value;
  if (logLevel.value) {
    filtered = filtered.filter((log) => log.level === logLevel.value);
  }
  return filtered.slice(-50); // 只显示最新50条日志
});

// 图表选项
const requestsChartOption = computed(() => ({
  title: { show: false },
  tooltip: { trigger: "axis" },
  xAxis: {
    type: "category",
    data: generateTimeLabels(),
  },
  yAxis: { type: "value" },
  series: [
    {
      name: "请求数",
      type: "line",
      data: generateRequestsData(),
      smooth: true,
      areaStyle: {},
    },
  ],
}));

const responseTimeChartOption = computed(() => ({
  title: { show: false },
  tooltip: { trigger: "axis" },
  xAxis: {
    type: "category",
    data: generateTimeLabels(),
  },
  yAxis: { type: "value" },
  series: [
    {
      name: "响应时间(ms)",
      type: "line",
      data: generateResponseTimeData(),
      smooth: true,
      areaStyle: {},
    },
  ],
}));

// 方法
const fetchServerDetail = async () => {
  loading.value = true;
  try {
    await serverStore.fetchServerDetails(serverId.value);
    if (!serverInfo.value) {
      throw new Error("服务器不存在");
    }
    // 选择当前服务器
    serverStore.selectServer(serverId.value);
  } catch (error) {
    ElMessage.error(`获取服务器详情失败: ${error}`);
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push("/servers");
};

const getStatusIcon = (status: ServerStatus) => {
  const iconMap = {
    running: "CircleCheck",
    stopped: "CircleClose",
    error: "CircleClose",
    starting: "Loading",
    stopping: "Loading",
  };
  return iconMap[status] || "CircleClose";
};

const getStatusText = (status: ServerStatus) => {
  const textMap = {
    running: "运行中",
    stopped: "已停止",
    error: "错误",
    starting: "启动中",
    stopping: "停止中",
  };
  return textMap[status] || "未知";
};

const formatUptime = (uptime: number) => {
  // 如果有startedAt字段，基于它实时计算运行时间
  if (serverInfo.value?.metrics?.startedAt) {
    const startTime = new Date(serverInfo.value.metrics.startedAt);
    const now = new Date();
    const uptimeMs = now.getTime() - startTime.getTime();
    const hours = Math.floor(uptimeMs / 3600000);
    const minutes = Math.floor((uptimeMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }
  
  // 兼容旧的uptime字段（毫秒）
  const hours = Math.floor(uptime / 3600000);
  const minutes = Math.floor((uptime % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
};

const formatDateTime = (date: Date) => {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
};

const formatLogTime = (date: Date) => {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
};

const getParameterCount = (parameters: any) => {
  return parameters?.properties ? Object.keys(parameters.properties).length : 0;
};

// 服务器操作
const startServer = async () => {
  actionLoading.value = true;
  try {
    await serverStore.startServer(serverId.value);
    ElMessage.success("服务器启动成功");
  } catch (error) {
    ElMessage.error(`启动服务器失败: ${error}`);
  } finally {
    actionLoading.value = false;
  }
};

const stopServer = async () => {
  actionLoading.value = true;
  try {
    await serverStore.stopServer(serverId.value);
    ElMessage.success("服务器停止成功");
  } catch (error) {
    ElMessage.error(`停止服务器失败: ${error}`);
  } finally {
    actionLoading.value = false;
  }
};

const restartServer = async () => {
  actionLoading.value = true;
  try {
    await serverStore.restartServer(serverId.value);
    ElMessage.success("服务器重启成功");
  } catch (error) {
    ElMessage.error(`重启服务器失败: ${error}`);
  } finally {
    actionLoading.value = false;
  }
};

const deleteServer = async () => {
  deleteLoading.value = true;
  try {
    await serverStore.deleteServer(serverId.value);
    ElMessage.success("服务器删除成功");
    router.push("/servers");
  } catch (error) {
    ElMessage.error(`删除服务器失败: ${error}`);
  } finally {
    deleteLoading.value = false;
    showDeleteConfirm.value = false;
  }
};

// 工具相关
const showToolDetail = (tool: MCPTool) => {
  selectedTool.value = tool;
  showToolDialog.value = true;
};

const testTool = (tool: MCPTool) => {
  router.push(`/tester?serverId=${serverId.value}&toolId=${tool.id}`);
};

// 日志相关
const addLogEntry = (entry: LogEntry) => {
  logs.value.push(entry);
  // 保持日志数量在合理范围
  if (logs.value.length > 1000) {
    logs.value = logs.value.slice(-500);
  }
  // 自动滚动到底部
  nextTick(() => {
    if (logsContainer.value) {
      logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
    }
  });
};

const filterLogs = () => {
  // 日志过滤由计算属性自动处理
};

const clearLogs = () => {
  logs.value = [];
};

// 快速操作
const viewAllLogs = () => {
  router.push(`/logs?serverId=${serverId.value}`);
};

const goToTester = () => {
  router.push(`/tester?serverId=${serverId.value}`);
};

const exportConfig = () => {
  if (!serverInfo.value) return;

  const config = {
    name: serverInfo.value.name,
    endpoint: serverInfo.value.endpoint,
    config: serverInfo.value.config,
    exportedAt: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(config, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${serverInfo.value.name}-config.json`;
  link.click();
  URL.revokeObjectURL(url);

  ElMessage.success("配置导出成功");
};

// 事件处理
const handleEditSuccess = () => {
  showEditDialog.value = false;
  fetchServerDetail();
};

// 图表数据生成
const generateTimeLabels = () => {
  const labels = [];
  const now = new Date();
  const interval =
    chartTimeRange.value === "1h"
      ? 5
      : chartTimeRange.value === "6h"
        ? 30
        : chartTimeRange.value === "24h"
          ? 60
          : 360; // 分钟
  const points = 20;

  for (let i = points - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * interval * 60000);
    labels.push(
      time.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }
  return labels;
};

const generateRequestsData = () => {
  // 模拟数据，实际应从API获取
  return Array.from({ length: 20 }, () => Math.floor(Math.random() * 100));
};

const generateResponseTimeData = () => {
  // 模拟数据，实际应从API获取
  return Array.from({ length: 20 }, () => Math.floor(Math.random() * 500 + 50));
};

// 监听图表时间范围变化
watch(chartTimeRange, () => {
  chartLoading.value = true;
  // 模拟加载延迟
  setTimeout(() => {
    chartLoading.value = false;
  }, 500);
});

// 生命周期
onMounted(async () => {
  await fetchServerDetail();

  // 订阅WebSocket事件
  websocketStore.subscribe("server-status", (data: any) => {
    if (data.serverId === serverId.value) {
      serverStore.updateServerStatus(data.serverId, data.status, data.error);
    }
  });

  websocketStore.subscribe("server-metrics", (data: any) => {
    if (data.serverId === serverId.value) {
      serverStore.updateServerMetrics(data.serverId, data.metrics);
    }
  });

  websocketStore.subscribe("logs", (data: any) => {
    if (data.serverId === serverId.value) {
      addLogEntry(data);
    }
  });
});

onUnmounted(() => {
  websocketStore.unsubscribe("server-status");
  websocketStore.unsubscribe("server-metrics");
  websocketStore.unsubscribe("logs");
});
</script>

<style scoped>
.server-detail {
  padding: 20px;
  background-color: var(--el-bg-color-page);
}

.detail-header {
  margin-bottom: 24px;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.status-overview {
  margin-top: 24px;
}

.status-card .status-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.status-running {
  background-color: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.status-stopped {
  background-color: var(--el-color-info-light-9);
  color: var(--el-color-info);
}

.status-error {
  background-color: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.status-starting,
.status-stopping {
  background-color: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

.status-text {
  flex: 1;
}

.status-label {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.status-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.metric-card .metric-content {
  text-align: center;
}

.metric-number {
  font-size: 24px;
  font-weight: 700;
  color: var(--el-color-primary);
  margin-bottom: 8px;
}

.metric-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.detail-content {
  min-height: 400px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header span {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.text-muted {
  color: var(--el-text-color-placeholder);
}

.charts-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.chart-wrapper {
  position: relative;
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--el-text-color-regular);
}

.chart {
  height: 200px;
}

.tools-list {
  max-height: 600px;
  overflow-y: auto;
}

.tool-card {
  cursor: pointer;
  transition: all 0.3s ease;
}

.tool-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.tool-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 14px;
}

.tool-description {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
  line-height: 1.4;
}

.tool-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.param-count {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.logs-card {
  height: 400px;
}

.log-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.logs-container {
  height: 320px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  padding: 8px;
  background-color: var(--el-fill-color-blank);
  font-family: "Courier New", monospace;
  font-size: 12px;
}

.log-entry {
  display: flex;
  margin-bottom: 4px;
  padding: 2px 4px;
  border-radius: 2px;
}

.log-time {
  width: 60px;
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
}

.log-level {
  width: 50px;
  font-weight: 600;
  flex-shrink: 0;
}

.log-message {
  flex: 1;
  word-break: break-all;
}

.log-error {
  background-color: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.log-warn {
  background-color: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

.log-info {
  background-color: var(--el-color-info-light-9);
  color: var(--el-color-info);
}

.log-debug {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.no-logs {
  text-align: center;
  color: var(--el-text-color-placeholder);
  padding: 40px 0;
}

.actions-card {
  height: fit-content;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-btn {
  width: 100%;
  justify-content: flex-start;
}

.error-state {
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-confirmation {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.warning-icon {
  font-size: 24px;
  color: var(--el-color-warning);
  margin-top: 2px;
}

.confirmation-text p {
  margin: 0 0 8px 0;
}

.warning-text {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}
</style>
