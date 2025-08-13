<template>
  <div class="server-manager">
    <!-- 页面标题和操作栏 -->
    <div class="header-section">
      <div class="title-bar">
        <h1>
          <el-icon><Monitor /></el-icon>
          {{ t("servers.title") }}
        </h1>
        <div class="header-actions">
          <el-button
            type="primary"
            @click="showCreateDialog = true"
            :icon="Plus"
          >
            {{ t("servers.createServer") }}
          </el-button>
          <el-button @click="refreshServers" :loading="loading" :icon="Refresh">
            {{ t("common.refresh") }}
          </el-button>
        </div>
      </div>

      <!-- 搜索和过滤 -->
      <div class="filter-bar">
        <el-input
          v-model="searchQuery"
          :placeholder="t('servers.searchPlaceholder')"
          :prefix-icon="Search"
          clearable
          class="search-input"
        />
        <el-select
          v-model="statusFilter"
          :placeholder="t('servers.statusFilter')"
          clearable
          class="status-filter"
        >
          <el-option :label="t('servers.status.running')" value="running" />
          <el-option :label="t('servers.status.stopped')" value="stopped" />
          <el-option :label="t('servers.status.error')" value="error" />
          <el-option :label="t('servers.status.starting')" value="starting" />
          <el-option :label="t('servers.status.stopping')" value="stopping" />
        </el-select>
        <el-button-group class="view-toggle">
          <el-button
            :type="viewMode === 'grid' ? 'primary' : 'default'"
            @click="viewMode = 'grid'"
            :icon="Grid"
          />
          <el-button
            :type="viewMode === 'list' ? 'primary' : 'default'"
            @click="viewMode = 'list'"
            :icon="List"
          />
        </el-button-group>
      </div>
    </div>

    <!-- 统计概览 -->
    <div class="stats-section">
      <el-row :gutter="16">
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon running">
                <el-icon><CircleCheck /></el-icon>
              </div>
              <div class="stat-text">
                <div class="stat-number">{{ runningServers }}</div>
                <div class="stat-label">{{ t("servers.status.running") }}</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon stopped">
                <el-icon><CircleClosure /></el-icon>
              </div>
              <div class="stat-text">
                <div class="stat-number">{{ stoppedServers }}</div>
                <div class="stat-label">{{ t("servers.status.stopped") }}</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon error">
                <el-icon><CircleClose /></el-icon>
              </div>
              <div class="stat-text">
                <div class="stat-number">{{ errorServers }}</div>
                <div class="stat-label">{{ t("servers.status.error") }}</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon total">
                <el-icon><Monitor /></el-icon>
              </div>
              <div class="stat-text">
                <div class="stat-number">{{ totalServers }}</div>
                <div class="stat-label">{{ t("common.total") }}</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 服务器列表 -->
    <div class="servers-section">
      <!-- 网格视图 -->
      <div v-if="viewMode === 'grid'" class="grid-view">
        <el-row :gutter="16">
          <el-col
            v-for="server in filteredServers"
            :key="server.id"
            :span="8"
            class="server-card-col"
          >
            <el-card
              class="server-card"
              :class="[`status-${server.status}`]"
              @click="goToServerDetail(server.id)"
            >
              <template #header>
                <div class="card-header">
                  <div class="server-name">
                    <el-icon><Monitor /></el-icon>
                    {{ server.name }}
                  </div>
                  <div class="server-actions">
                    <el-dropdown @command="handleServerAction">
                      <el-button text :icon="More" @click.stop />
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item
                            :command="{ action: 'start', server }"
                            :disabled="server.status === 'running'"
                          >
                            {{ t("servers.startServer") }}
                          </el-dropdown-item>
                          <el-dropdown-item
                            :command="{ action: 'stop', server }"
                            :disabled="server.status === 'stopped'"
                          >
                            {{ t("servers.stopServer") }}
                          </el-dropdown-item>
                          <el-dropdown-item
                            :command="{ action: 'restart', server }"
                            :disabled="server.status !== 'running'"
                          >
                            {{ t("servers.restartServer") }}
                          </el-dropdown-item>
                          <el-dropdown-item divided>
                            <el-dropdown-item
                              :command="{ action: 'edit', server }"
                            >
                              {{ t("servers.editServer") }}
                            </el-dropdown-item>
                          </el-dropdown-item>
                          <el-dropdown-item
                            :command="{ action: 'delete', server }"
                            class="danger-action"
                          >
                            {{ t("servers.deleteServer") }}
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>
                </div>
              </template>

              <div class="card-content">
                <div class="server-status">
                  <el-tag
                    :type="getStatusType(server.status)"
                    :icon="getStatusIcon(server.status)"
                  >
                    {{ getStatusText(server.status) }}
                  </el-tag>
                  <span class="uptime" v-if="server.status === 'running'">
                    {{ t("servers.runningTime") }}:
                    {{ formatUptime(server.metrics?.uptime || 0, server) }}
                  </span>
                </div>

                <div class="server-info">
                  <div class="info-item" v-if="server.endpoint">
                    <span class="label">{{ t("servers.serverUrl") }}:</span>
                    <span class="value">{{ server.endpoint || "N/A" }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">{{ t('servers.port') }}:</span>
                    <span class="value">{{ server.port }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">{{ t('servers.transportType') }}:</span>
                    <span class="value">{{ server.transport }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">{{ t('servers.toolCount') }}:</span>
                    <span class="value">{{ server.toolCount || 0 }}</span>
                  </div>
                  <div class="info-item" v-if="server.autoStart !== undefined">
                    <span class="label">{{ t('servers.autoStart') }}:</span>
                    <span class="value">{{
                      server.autoStart ? t("common.yes") : t("common.no")
                    }}</span>
                  </div>
                </div>

                <div class="server-metrics" v-if="server.status === 'running'">
                  <el-progress
                    :percentage="
                      Math.min(100, (server.metrics?.errorRate || 0) * 100)
                    "
                    :color="getErrorRateColor(server.metrics?.errorRate || 0)"
                    :show-text="false"
                    :stroke-width="4"
                  />
                  <span class="metrics-text">
                    {{ t('servers.errorRate') }}:
                    {{ ((server.metrics?.errorRate || 0) * 100).toFixed(1) }}%
                  </span>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- 列表视图 -->
      <div v-else class="list-view">
        <el-table
          :data="filteredServers"
          v-loading="loading"
          @row-click="(row: MCPServer) => goToServerDetail(row.id)"
          row-class-name="server-row"
        >
          <el-table-column
            prop="name"
            :label="t('servers.serverName')"
            min-width="150"
          >
            <template #default="{ row }">
              <div class="server-name-cell">
                <el-icon><Monitor /></el-icon>
                <span>{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column
            prop="status"
            :label="t('servers.serverStatus')"
            width="120"
          >
            <template #default="{ row }">
              <el-tag
                :type="getStatusType(row.status)"
                :icon="getStatusIcon(row.status)"
                size="small"
              >
                {{ getStatusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column
            prop="endpoint"
            :label="t('servers.serverUrl')"
            min-width="200"
          >
            <template #default="{ row }">
              {{
                row.endpoint ||
                `${row.transport}://${row.host || "localhost"}:${row.port}`
              }}
            </template>
          </el-table-column>

          <el-table-column
            prop="transport"
            :label="t('servers.transportType')"
            width="100"
          />

          <el-table-column
            prop="port"
            :label="t('servers.serverPort')"
            width="80"
          />

          <el-table-column
            prop="toolCount"
            :label="t('servers.toolCount')"
            width="100"
          >
            <template #default="{ row }">
              {{ row.toolCount || 0 }}
            </template>
          </el-table-column>

          <el-table-column
            prop="autoStart"
            :label="t('servers.autoStart')"
            width="100"
          >
            <template #default="{ row }">
              <el-tag :type="row.autoStart ? 'success' : 'info'" size="small">
                {{ row.autoStart ? t("common.yes") : t("common.no") }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column
            prop="updatedAt"
            :label="t('servers.lastUpdated')"
            width="160"
          >
            <template #default="{ row }">
              {{ formatDateTime(row.updatedAt) }}
            </template>
          </el-table-column>

          <el-table-column
            fixed="right"
            :label="t('common.actions')"
            width="100"
          >
            <template #default="{ row }">
              <div class="action-buttons-container">
                <el-tooltip
                  v-if="row.status === 'stopped'"
                  :content="t('servers.startServer')"
                  placement="top"
                >
                  <el-button
                    class="action-btn start-btn"
                    size="small"
                    @click.stop="startServer(row)"
                    :icon="VideoPlay"
                  />
                </el-tooltip>
                <el-tooltip
                  v-else-if="row.status === 'running'"
                  :content="t('servers.stopServer')"
                  placement="top"
                >
                  <el-button
                    class="action-btn stop-btn"
                    size="small"
                    @click.stop="stopServer(row)"
                    :icon="VideoPause"
                  />
                </el-tooltip>
                <el-tooltip
                  v-if="row.status === 'running'"
                  :content="t('servers.restartServer')"
                  placement="top"
                >
                  <el-button
                    class="action-btn restart-btn"
                    size="small"
                    @click.stop="restartServer(row)"
                    :icon="RefreshRight"
                  />
                </el-tooltip>
                <el-tooltip
                  :content="t('servers.editServer')"
                  placement="top"
                >
                  <el-button
                    class="action-btn edit-btn"
                    size="small"
                    @click.stop="editServer(row)"
                    :icon="Edit"
                  />
                </el-tooltip>
                <el-tooltip
                  :content="t('servers.deleteServer')"
                  placement="top"
                >
                  <el-button
                    class="action-btn delete-btn"
                    size="small"
                    @click.stop="deleteServer(row)"
                    :icon="Delete"
                  />
                </el-tooltip>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 空状态 -->
      <el-empty
        v-if="filteredServers.length === 0 && !loading"
        :description="t('servers.noServers')"
        :image-size="200"
      >
        <el-button type="primary" @click="showCreateDialog = true" :icon="Plus">
          {{ t("servers.createFirstServer") }}
        </el-button>
      </el-empty>
    </div>

    <!-- 创建/编辑服务器对话框 -->
    <ServerFormDialog
      v-model="showCreateDialog"
      :server="editingServer"
      @success="handleFormSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  Monitor,
  Plus,
  Refresh,
  Search,
  Grid,
  List,
  More,
  Edit,
  Delete,
  CircleCheck,
  CircleClose,
  VideoPlay,
  VideoPause,
  RefreshRight,
  WarningFilled,
  MoreFilled,
} from "@element-plus/icons-vue";
import type { MCPServer, ServerStatus } from "@/types";
import { useServerStore } from "@/stores/server";
import { useWebSocketStore } from "@/stores/websocket";
import ServerFormDialog from "./components/ServerFormDialog.vue";

// 导入全局功能
import { useConfirmation } from "@/composables/useConfirmation";
import { useFormValidation } from "@/composables/useFormValidation";
import { usePerformanceMonitor } from "@/composables/usePerformance";
import LoadingOverlay from "@/shared/components/ui/LoadingOverlay.vue";

// 路由和状态
const router = useRouter();
const serverStore = useServerStore();
const websocketStore = useWebSocketStore();
const { t } = useI18n();

// 全局功能
const {
  confirmDelete: globalConfirmDelete,
  confirmDangerousAction,
  confirmBatchDelete,
} = useConfirmation();

const { startMonitoring, stopMonitoring, measureFunction } =
  usePerformanceMonitor();

// 响应式数据
const loading = ref(false);
const searchQuery = ref("");
const statusFilter = ref<ServerStatus | "">("");
const viewMode = ref<"grid" | "list">("grid");
const showCreateDialog = ref(false);
const editingServer = ref<MCPServer | null>(null);

// 计算属性
const servers = computed(() => serverStore.servers);

const filteredServers = computed(() => {
  let filtered = servers.value;

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (server) =>
        server.name.toLowerCase().includes(query) ||
        (server.endpoint || "").toLowerCase().includes(query) ||
        (server.config?.description || "").toLowerCase().includes(query),
    );
  }

  // 状态过滤
  if (statusFilter.value) {
    filtered = filtered.filter(
      (server) => server.status === statusFilter.value,
    );
  }

  return filtered;
});

const totalServers = computed(() => servers.value.length);
const runningServers = computed(
  () => servers.value.filter((s) => s.status === "running").length,
);
const stoppedServers = computed(
  () => servers.value.filter((s) => s.status === "stopped").length,
);
const errorServers = computed(
  () => servers.value.filter((s) => s.status === "error").length,
);

// 方法
const refreshServers = async () => {
  loading.value = true;
  try {
    await measureFunction("refreshServers", async () => {
      await serverStore.fetchServers();
    });
  } catch (error) {
    ElMessage.error(`刷新服务器列表失败: ${error}`);
  } finally {
    loading.value = false;
  }
};

const goToServerDetail = (serverId: string) => {
  router.push(`/servers/${serverId}`);
};

const getStatusType = (status: ServerStatus) => {
  const statusMap = {
    running: "success",
    stopped: "info",
    error: "danger",
    starting: "warning",
    stopping: "warning",
  };
  return statusMap[status] || "info";
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
    running: t("servers.status.running"),
    stopped: t("servers.status.stopped"),
    error: t("servers.status.error"),
    starting: t("servers.status.starting"),
    stopping: t("servers.status.stopping"),
  };
  return textMap[status] || t("servers.status.unknown");
};

const formatUptime = (uptime: number, server?: any) => {
  // 如果有startedAt字段，基于它实时计算运行时间
  if (server?.metrics?.startedAt) {
    try {
      const startTime = new Date(server.metrics.startedAt);
      
      // 检查日期是否有效
      if (isNaN(startTime.getTime())) {
        console.warn('Invalid startedAt value:', server.metrics.startedAt);
        // 回退到使用uptime参数
        const hours = Math.floor(uptime / 3600000);
        const minutes = Math.floor((uptime % 3600000) / 60000);
        return `${hours}h ${minutes}m`;
      }
      
      const now = new Date();
      const uptimeMs = now.getTime() - startTime.getTime();
      
      // 确保计算结果为正数
      if (uptimeMs < 0) {
        console.warn('Negative uptime calculated, using fallback');
        const hours = Math.floor(uptime / 3600000);
        const minutes = Math.floor((uptime % 3600000) / 60000);
        return `${hours}h ${minutes}m`;
      }
      
      const hours = Math.floor(uptimeMs / 3600000);
      const minutes = Math.floor((uptimeMs % 3600000) / 60000);
      return `${hours}h ${minutes}m`;
    } catch (error) {
      console.error('Error formatting uptime with startedAt:', error);
      // 回退到使用uptime参数
      const hours = Math.floor(uptime / 3600000);
      const minutes = Math.floor((uptime % 3600000) / 60000);
      return `${hours}h ${minutes}m`;
    }
  }

  // 兼容旧的uptime字段（毫秒）
  const hours = Math.floor(uptime / 3600000);
  const minutes = Math.floor((uptime % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
};

const formatDateTime = (date: Date | string | number) => {
  let validDate: Date;
  
  // 处理不同类型的输入
  if (date instanceof Date) {
    validDate = date;
  } else if (typeof date === 'string' || typeof date === 'number') {
    validDate = new Date(date);
  } else {
    return "N/A";
  }
  
  // 检查日期是否有效
  if (isNaN(validDate.getTime())) {
    return "N/A";
  }
  
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(validDate);
  } catch (error) {
    console.warn('formatDateTime error:', error);
    return "N/A";
  }
};

const getErrorRateColor = (errorRate: number) => {
  if (errorRate < 0.01) return "#67C23A";
  if (errorRate < 0.05) return "#E6A23C";
  return "#F56C6C";
};

const handleServerAction = async ({
  action,
  server,
}: {
  action: string;
  server: MCPServer;
}) => {
  console.log(action, server);

  switch (action) {
    case "start":
      await startServer(server);
      break;
    case "stop":
      await stopServer(server);
      break;
    case "restart":
      await restartServer(server);
      break;
    case "health":
      await serverStore.performHealthCheck(server.id);
      break;
    case "edit":
      editServer(server);
      break;
    case "delete":
      deleteServer(server);
      break;
  }
};

const startServer = async (server: MCPServer) => {
  try {
    await measureFunction("startServer", async () => {
      await serverStore.startServer(server.id);
    });
    ElMessage.success(
      t("servers.messages.startSuccess", { name: server.name }),
    );
  } catch (error) {
    ElMessage.error(t("servers.messages.startError", { error }));
  }
};

const stopServer = async (server: MCPServer) => {
  console.log("🛑 [FRONTEND DEBUG] stopServer called with server:", {
    id: server.id,
    name: server.name,
    status: server.status,
  });

  const confirmed = await confirmDangerousAction(
    t("servers.messages.confirmStop", { name: server.name }),
  );
  if (!confirmed) {
    console.log("🛑 [FRONTEND DEBUG] User cancelled stop operation");
    return;
  }

  try {
    console.log(
      "🛑 [FRONTEND DEBUG] Calling serverStore.stopServer with ID:",
      server.id,
    );
    await measureFunction("stopServer", async () => {
      await serverStore.stopServer(server.id);
    });
    console.log(
      "🛑 [FRONTEND DEBUG] serverStore.stopServer completed successfully",
    );
    ElMessage.success(t("servers.messages.stopSuccess", { name: server.name }));
  } catch (error) {
    console.error("🛑 [FRONTEND DEBUG] stopServer failed:", error);
    ElMessage.error(t("servers.messages.stopError", { error }));
  }
};

const restartServer = async (server: MCPServer) => {
  const confirmed = await confirmDangerousAction(
    t("servers.messages.confirmRestart", { name: server.name }),
  );
  if (!confirmed) return;

  try {
    await measureFunction("restartServer", async () => {
      await serverStore.restartServer(server.id);
    });
    ElMessage.success(
      t("servers.messages.restartSuccess", { name: server.name }),
    );
  } catch (error) {
    ElMessage.error(t("servers.messages.restartError", { error }));
  }
};

const editServer = (server: MCPServer) => {
  editingServer.value = server;
  showCreateDialog.value = true;
};

// 检查服务器是否正在运行
const checkServerRunning = async (server: MCPServer): Promise<boolean> => {
  try {
    // 从服务器配置中获取端口，默认使用3004
    const port = server.config?.port || 3004;
    const baseUrl = `http://localhost:${port}`;

    // 创建AbortController用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      // 检查health接口
      const healthResponse = await fetch(`${baseUrl}/health`, {
        method: "GET",
        signal: controller.signal,
      });

      if (!healthResponse.ok) {
        return false;
      }

      const healthData = await healthResponse.text();

      // 检查ping接口
      const pingResponse = await fetch(`${baseUrl}/ping`, {
        method: "GET",
        signal: controller.signal,
      });

      if (!pingResponse.ok) {
        return false;
      }

      const pingData = await pingResponse.text();

      // 判断服务器是否运行：health返回'ok'且ping返回'pong'
      return (
        healthData.trim().toLowerCase() === "ok" &&
        pingData.trim().toLowerCase() === "pong"
      );
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.log("Check server status failed:", error);
    return false;
  }
};

const deleteServer = async (server: MCPServer) => {
  try {
    // 检查服务器是否正在运行
    const isRunning = await checkServerRunning(server);

    if (isRunning) {
      // 服务器正在运行，提示用户需要先停止服务器
      const stopConfirmed = await ElMessageBox.confirm(
        t("servers.messages.confirmStopAndDelete", { name: server.name }),
        t("servers.messages.serverRunning"),
        {
          confirmButtonText: t("servers.messages.stopAndDelete"),
          cancelButtonText: t("common.cancel"),
          type: "warning",
          dangerouslyUseHTMLString: true,
        },
      ).catch(() => false);

      if (!stopConfirmed) return;

      // 先停止服务器
      try {
        await serverStore.stopServer(server.id);
        ElMessage.success(
          t("servers.messages.stopSuccess", { name: server.name }),
        );

        // 等待一段时间确保服务器完全停止
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        ElMessage.error(t("servers.messages.stopError", { error }));
        return;
      }
    }

    // 显示删除确认对话框
    const confirmed = await globalConfirmDelete(server.name);
    if (!confirmed) return;

    // 执行删除操作
    await measureFunction("deleteServer", async () => {
      await serverStore.deleteServer(server.id);
    });
    ElMessage.success(
      t("servers.messages.deleteSuccess", { name: server.name }),
    );
  } catch (error) {
    ElMessage.error(t("servers.messages.deleteError", { error }));
  }
};

const handleFormSuccess = () => {
  showCreateDialog.value = false;
  editingServer.value = null;
  refreshServers();
};

// 生命周期
onMounted(async () => {
  // 启动性能监控
  startMonitoring();

  await refreshServers();

  // 订阅 WebSocket 实时更新
  websocketStore.subscribe("server-status", handleServerStatusUpdate);
  websocketStore.subscribe("server-metrics", handleServerMetricsUpdate);
});

onUnmounted(() => {
  // 停止性能监控
  stopMonitoring();

  websocketStore.unsubscribe("server-status");
  websocketStore.unsubscribe("server-metrics");
});

const handleServerStatusUpdate = (data: any) => {
  serverStore.updateServerStatus(data.serverId, data.status);
};

const handleServerMetricsUpdate = (data: any) => {
  serverStore.updateServerMetrics(data.serverId, data.metrics);
};
</script>

<style scoped>
.server-manager {
  padding: 24px;
  background-color: var(--el-bg-color-page);
  min-height: 100vh;
}

/* 页面标题和操作栏 */
.header-section {
  margin-bottom: 24px;
}

.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.title-bar h1 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 24px;
  color: var(--el-text-color-primary);
}

.header-actions {
  display: flex;
  gap: 12px;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.search-input {
  width: 300px;
}

.status-filter {
  width: 160px;
}

.view-toggle {
  margin-left: auto;
}

/* 统计概览 */
.stats-section {
  margin-bottom: 24px;
}

.stat-card {
  height: 100px;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 100%;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.stat-icon.running {
  background-color: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.stat-icon.stopped {
  background-color: var(--el-color-info-light-9);
  color: var(--el-color-info);
}

.stat-icon.error {
  background-color: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.stat-icon.total {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.stat-text {
  flex: 1;
}

.stat-number {
  font-size: 28px;
  font-weight: bold;
  color: var(--el-text-color-primary);
  line-height: 1;
}

.stat-label {
  font-size: 14px;
  color: var(--el-text-color-regular);
  margin-top: 4px;
}

/* 服务器列表 */
.servers-section {
  background-color: var(--el-bg-color);
  border-radius: 8px;
  padding: 24px;
}

/* 网格视图 */
.grid-view {
  min-height: 400px;
}

.server-card-col {
  margin-bottom: 16px;
}

.server-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.server-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--el-box-shadow-light);
}

.server-card.status-running {
  border-color: var(--el-color-success-light-8);
}

.server-card.status-error {
  border-color: var(--el-color-danger-light-8);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.server-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.server-actions {
  opacity: 0;
  transition: opacity 0.3s ease;
}

.server-card:hover .server-actions {
  opacity: 1;
}

.card-content {
  padding-top: 16px;
}

.server-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.uptime {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.server-info {
  margin-bottom: 16px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.info-item .label {
  color: var(--el-text-color-regular);
}

.info-item .value {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.server-metrics {
  display: flex;
  align-items: center;
  gap: 8px;
}

.metrics-text {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

/* 列表视图 */
.list-view {
  min-height: 400px;
}

.server-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.server-row) {
  cursor: pointer;
}

:deep(.server-row:hover) {
  background-color: var(--el-fill-color-light);
}

/* 删除确认对话框 */
.delete-confirmation {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 0;
}

.warning-icon {
  font-size: 24px;
  color: var(--el-color-warning);
  margin-top: 2px;
}

.confirmation-text {
  flex: 1;
}

.confirmation-text p {
  margin: 0 0 8px 0;
}

.warning-text {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.danger-action {
  color: var(--el-color-danger) !important;
}

/* 操作按钮样式 */
.action-buttons-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  justify-content: center;
  align-items: center;
  min-height: 140px;
  padding: 8px 4px;
}

/* 重置Element Plus按钮默认间距 */
.action-buttons-container .el-button {
  margin-left: 0 !important;
  margin-right: 0 !important;
}

.action-buttons-container .el-button + .el-button {
  margin-left: 0 !important;
}

.action-btn {
  position: relative;
  border-radius: 8px !important;
  border: none !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  min-width: 32px;
  height: 32px;
}

.action-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.2) 50%, transparent 70%);
  transform: translateX(-100%);
  transition: transform 0.6s;
}

.action-btn:hover::before {
  transform: translateX(100%);
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.action-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* 启动按钮 */
.start-btn {
  background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%) !important;
  color: white !important;
  border: 1px solid rgba(82, 196, 26, 0.3) !important;
}

.start-btn:hover {
  background: linear-gradient(135deg, #73d13d 0%, #95de64 100%) !important;
  box-shadow: 0 4px 16px rgba(82, 196, 26, 0.5);
  border-color: rgba(82, 196, 26, 0.6) !important;
}

/* 停止按钮 */
.stop-btn {
  background: linear-gradient(135deg, #fa8c16 0%, #ffa940 100%) !important;
  color: white !important;
  border: 1px solid rgba(250, 140, 22, 0.3) !important;
}

.stop-btn:hover {
  background: linear-gradient(135deg, #ffa940 0%, #ffc069 100%) !important;
  box-shadow: 0 4px 16px rgba(250, 140, 22, 0.5);
  border-color: rgba(250, 140, 22, 0.6) !important;
}

/* 重启按钮 */
.restart-btn {
  background: linear-gradient(135deg, #722ed1 0%, #9254de 100%) !important;
  color: white !important;
  border: 1px solid rgba(114, 46, 209, 0.3) !important;
}

.restart-btn:hover {
  background: linear-gradient(135deg, #9254de 0%, #b37feb 100%) !important;
  box-shadow: 0 4px 16px rgba(114, 46, 209, 0.5);
  border-color: rgba(114, 46, 209, 0.6) !important;
}

/* 编辑按钮 */
.edit-btn {
  background: linear-gradient(135deg, #1890ff 0%, #40a9ff 100%) !important;
  color: white !important;
  border: 1px solid rgba(24, 144, 255, 0.3) !important;
}

.edit-btn:hover {
  background: linear-gradient(135deg, #40a9ff 0%, #69c0ff 100%) !important;
  box-shadow: 0 4px 16px rgba(24, 144, 255, 0.5);
  border-color: rgba(24, 144, 255, 0.6) !important;
}

/* 删除按钮 */
.delete-btn {
  background: linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%) !important;
  color: white !important;
  border: 1px solid rgba(255, 77, 79, 0.3) !important;
}

.delete-btn:hover {
  background: linear-gradient(135deg, #ff7875 0%, #ffa39e 100%) !important;
  box-shadow: 0 4px 16px rgba(255, 77, 79, 0.5);
  border-color: rgba(255, 77, 79, 0.6) !important;
}

/* 按钮禁用状态 */
.action-btn:disabled {
  background: linear-gradient(135deg, #c0c4cc 0%, #d3d4d6 100%) !important;
  color: #a8abb2 !important;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
}

.action-btn:disabled::before {
  display: none;
}

/* 网格视图下拉菜单按钮样式 */
.dropdown-trigger-btn {
  width: 32px !important;
  height: 32px !important;
  border-radius: 50% !important;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.dropdown-trigger-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.3) 50%, transparent 70%);
  transform: translateX(-100%);
  transition: transform 0.6s;
}

.dropdown-trigger-btn:hover::before {
  transform: translateX(100%);
}

.dropdown-trigger-btn:hover {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  color: white !important;
  transform: scale(1.1) rotate(90deg);
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
}

.dropdown-trigger-btn:active {
  transform: scale(1.05) rotate(90deg);
}

/* 下拉菜单项样式优化 */
:deep(.el-dropdown-menu) {
  border-radius: 12px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
  border: 1px solid rgba(0, 0, 0, 0.06) !important;
  padding: 8px !important;
}

:deep(.el-dropdown-menu__item) {
  border-radius: 8px !important;
  margin: 2px 0 !important;
  padding: 10px 16px !important;
  transition: all 0.2s ease !important;
  font-weight: 500 !important;
}

:deep(.el-dropdown-menu__item:hover) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  color: white !important;
  transform: translateX(4px);
}

:deep(.el-dropdown-menu__item.danger-action) {
  color: #f56c6c !important;
}

:deep(.el-dropdown-menu__item.danger-action:hover) {
  background: linear-gradient(135deg, #f56c6c 0%, #f89898 100%) !important;
  color: white !important;
}

/* 按钮脉冲动画 */
@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(64, 158, 255, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(64, 158, 255, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(64, 158, 255, 0);
  }
}

@keyframes success-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(103, 194, 58, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(103, 194, 58, 0);
  }
}

@keyframes danger-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(245, 108, 108, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(245, 108, 108, 0);
  }
}

@keyframes restart-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(114, 46, 209, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(114, 46, 209, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(114, 46, 209, 0);
  }
}

/* 按钮点击时的脉冲效果 */
.action-btn:active {
  animation: pulse 0.6s;
}

.start-btn:active {
  animation: success-pulse 0.6s;
}

.delete-btn:active {
  animation: danger-pulse 0.6s;
}

.restart-btn:active {
  animation: restart-pulse 0.6s;
}

/* 按钮加载状态 */
.action-btn.is-loading {
  position: relative;
}

.action-btn.is-loading::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 16px;
  height: 16px;
  margin: -8px 0 0 -8px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 按钮组整体动画 */
.action-buttons-container {
  animation: fadeInUp 0.3s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .server-manager {
    padding: 16px;
  }

  .title-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .header-actions {
    justify-content: center;
  }

  .filter-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input,
  .status-filter {
    width: 100%;
  }

  .view-toggle {
    margin-left: 0;
    align-self: center;
  }

  .server-card-col {
    padding: 0 8px;
  }

  .servers-section {
    padding: 16px;
  }
}
</style>
