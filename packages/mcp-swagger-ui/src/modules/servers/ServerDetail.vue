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
            <el-tag
              :type="getStatusType(serverInfo?.status || 'stopped')"
              size="large"
              class="status-tag"
            >
              <el-icon><component :is="getStatusIcon(serverInfo?.status || 'stopped')" /></el-icon>
              {{ getStatusText(serverInfo?.status || 'stopped') }}
            </el-tag>
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
            <el-button
              type="danger"
              :icon="Delete"
              @click="showDeleteConfirm = true"
              :disabled="!serverInfo"
            >
              删除
            </el-button>
          </div>
        </template>
      </el-page-header>
    </div>

    <!-- 主要内容区域 -->
    <div class="detail-content" v-loading="loading">
      <el-card v-if="serverInfo" class="tabs-container">
        <!-- 标签页导航 -->
        <el-tabs v-model="activeTab" class="server-detail-tabs">
          <!-- 服务器概览标签页 -->
          <el-tab-pane label="服务器概览" name="overview">
            <div class="overview-content">
              <!-- 基本信息和性能监控 -->
              <el-row :gutter="24" style="margin-bottom: 24px">
                <el-col :span="12">
                  <el-card class="info-card">
                    <template #header>
                      <div class="card-header">
                        <el-icon><InfoFilled /></el-icon>
                        <span>基本信息</span>
                      </div>
                    </template>
                    <div class="info-list">
                      <div class="info-item">
                        <span class="info-label">服务器ID</span>
                        <span class="info-value">{{ serverInfo.id }}</span>
                      </div>
                      <div class="info-item">
                <span class="info-label">端口</span>
                <span class="info-value">{{ serverInfo.port || 'N/A' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">传输类型</span>
                <span class="info-value">{{ serverInfo.transport || 'N/A' }}</span>
              </div>
                      <div class="info-item">
                        <span class="info-label">启动时间</span>
                        <span class="info-value">{{ serverInfo.metrics?.startedAt ? formatDateTime(new Date(serverInfo.metrics.startedAt)) : 'N/A' }}</span>
                      </div>
                      <div class="info-item">
                        <span class="info-label">运行时长</span>
                        <span class="info-value">{{ serverInfo.status === 'running' ? formatUptime(serverInfo.metrics?.uptime || 0) : 'N/A' }}</span>
                      </div>
                    </div>
                  </el-card>
                </el-col>
                <el-col :span="12">
                  <el-card class="metrics-card">
                    <template #header>
                      <div class="card-header">
                        <el-icon><Monitor /></el-icon>
                        <span>性能监控</span>
                      </div>
                    </template>
                    <div class="metrics-grid">
                      <div class="metric-item">
                        <div class="metric-value">{{ getCpuUsage() }}</div>
                        <div class="metric-label">CPU使用率</div>
                      </div>
                      <div class="metric-item">
                        <div class="metric-value">{{ getMemoryUsage() }}</div>
                        <div class="metric-label">内存使用</div>
                      </div>
                      <div class="metric-item">
                        <div class="metric-value">{{ serverInfo.metrics?.totalRequests || 0 }}</div>
                        <div class="metric-label">总请求数</div>
                      </div>
                      <div class="metric-item">
                        <div class="metric-value">{{ serverInfo.metrics?.averageResponseTime ? serverInfo.metrics.averageResponseTime.toFixed(0) + 'ms' : 'N/A' }}</div>
                        <div class="metric-label">平均响应时间</div>
                      </div>
                    </div>
                  </el-card>
                </el-col>
              </el-row>
              
              <!-- 服务器配置详情 -->
              <el-card class="config-card">
                <template #header>
                  <div class="card-header">
                    <el-icon><Setting /></el-icon>
                    <span>服务器配置</span>
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
                  <el-descriptions-item label="创建时间">
                    {{ formatDateTime(serverInfo.createdAt) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="最后更新">
                    {{ formatDateTime(serverInfo.updatedAt) }}
                  </el-descriptions-item>
                </el-descriptions>
              </el-card>
            </div>
          </el-tab-pane>

          <!-- 工具管理标签页 -->
          <el-tab-pane label="工具管理" name="tools">
            <div class="tools-content">
              <div class="tools-header">
                <el-input
                  v-model="toolSearchQuery"
                  placeholder="搜索工具..."
                  :prefix-icon="Search"
                  style="width: 300px"
                  clearable
                />
                <el-button :icon="Refresh" @click="refreshTools">刷新</el-button>
              </div>
              
              <el-table
                :data="filteredTools"
                class="tools-table"
                @row-click="showToolDetail"
                style="cursor: pointer"
              >
                <el-table-column prop="name" label="工具名称" width="200">
                  <template #default="{ row }">
                    <div class="tool-name-cell">
                      <el-icon><Cpu /></el-icon>
                      <span class="tool-name">{{ row.name }}</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="description" label="描述" show-overflow-tooltip />
                <el-table-column label="参数数量" width="100" align="center">
                  <template #default="{ row }">
                    {{ getParameterCount(row.parameters) }}
                  </template>
                </el-table-column>
                <el-table-column label="使用次数" width="100" align="center">
                  <template #default="{ row }">
                    {{ row.usageCount || 0 }}
                  </template>
                </el-table-column>
                <el-table-column label="最后使用" width="150" align="center">
                  <template #default="{ row }">
                    {{ row.lastUsed ? formatDateTime(new Date(row.lastUsed)) : 'N/A' }}
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="120" align="center">
                  <template #default="{ row }">
                    <el-button
                      size="small"
                      type="primary"
                      @click.stop="testTool(row)"
                    >
                      测试
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
              
              <el-empty
                v-if="filteredTools.length === 0"
                description="暂无工具或搜索无结果"
                :image-size="100"
              />
            </div>
          </el-tab-pane>

          <!-- 连接管理标签页 -->
          <el-tab-pane label="连接管理" name="connections">
            <div class="connections-content">
              <div class="connection-stats">
                <el-row :gutter="16">
                  <el-col :span="6">
                    <el-card class="stat-card">
                      <div class="stat-content">
                        <div class="stat-value">{{ connectionStats.active }}</div>
                        <div class="stat-label">活跃连接</div>
                      </div>
                    </el-card>
                  </el-col>
                  <el-col :span="6">
                    <el-card class="stat-card">
                      <div class="stat-content">
                        <div class="stat-value">{{ connectionStats.total }}</div>
                        <div class="stat-label">总连接数</div>
                      </div>
                    </el-card>
                  </el-col>
                  <el-col :span="6">
                    <el-card class="stat-card">
                      <div class="stat-content">
                        <div class="stat-value">{{ connectionStats.failed }}</div>
                        <div class="stat-label">失败连接</div>
                      </div>
                    </el-card>
                  </el-col>
                  <el-col :span="6">
                    <el-card class="stat-card">
                      <div class="stat-content">
                        <div class="stat-value">{{ formatDuration(connectionStats.avgDuration) }}</div>
                        <div class="stat-label">平均连接时长</div>
                      </div>
                    </el-card>
                  </el-col>
                </el-row>
              </div>

              <el-card class="connections-table-card" style="margin-top: 16px">
                <template #header>
                  <div class="card-header">
                    <span><el-icon><Connection /></el-icon> 连接历史</span>
                    <el-button :icon="Refresh" @click="refreshConnections">刷新</el-button>
                  </div>
                </template>

                <el-table :data="connections" class="connections-table">
                  <el-table-column label="连接ID" width="120">
                    <template #default="{ row }">
                      <el-text class="connection-id">{{ row.id.substring(0, 8) }}...</el-text>
                    </template>
                  </el-table-column>
                  <el-table-column label="客户端" width="150">
                    <template #default="{ row }">
                      <div class="client-info">
                        <el-icon><User /></el-icon>
                        <span>{{ row.clientName || 'Unknown' }}</span>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column label="状态" width="100" align="center">
                    <template #default="{ row }">
                      <el-tag
                        :type="getConnectionStatusType(row.status)"
                        size="small"
                      >
                        {{ row.status }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="连接时间" width="160">
                    <template #default="{ row }">
                      {{ formatDateTime(new Date(row.connectedAt)) }}
                    </template>
                  </el-table-column>
                  <el-table-column label="持续时长" width="120">
                    <template #default="{ row }">
                      {{ formatDuration(row.duration) }}
                    </template>
                  </el-table-column>
                  <el-table-column label="请求数" width="100" align="center">
                    <template #default="{ row }">
                      {{ row.requestCount || 0 }}
                    </template>
                  </el-table-column>
                  <el-table-column label="最后活动" width="160">
                    <template #default="{ row }">
                      {{ row.lastActivity ? formatDateTime(new Date(row.lastActivity)) : 'N/A' }}
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="120" align="center">
                    <template #default="{ row }">
                      <el-button
                        v-if="row.status === 'connected'"
                        size="small"
                        type="danger"
                        @click="disconnectClient(row.id)"
                      >
                        断开
                      </el-button>
                      <el-button
                        size="small"
                        @click="viewConnectionDetails(row)"
                      >
                        详情
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>

                <el-empty
                  v-if="connections.length === 0"
                  description="暂无连接记录"
                  :image-size="100"
                />
              </el-card>
            </div>
          </el-tab-pane>

          <!-- 进程监控标签页 -->
          <el-tab-pane label="进程监控" name="process">
            <div class="process-content">
              <!-- 进程资源监控 -->
              <el-row :gutter="24" style="margin-bottom: 24px">
                <el-col :span="12">
                  <el-card class="resource-chart-card">
                    <template #header>
                      <div class="card-header">
                        <el-icon><TrendCharts /></el-icon>
                        <span>CPU使用率</span>
                        <el-button text @click="refreshResourceMetrics">
                          <el-icon><Refresh /></el-icon>
                        </el-button>
                      </div>
                    </template>
                    <div ref="cpuChartRef" class="chart-container"></div>
                  </el-card>
                </el-col>
                <el-col :span="12">
                  <el-card class="resource-chart-card">
                    <template #header>
                      <div class="card-header">
                        <el-icon><TrendCharts /></el-icon>
                        <span>内存使用</span>
                        <el-button text @click="refreshResourceMetrics">
                          <el-icon><Refresh /></el-icon>
                        </el-button>
                      </div>
                    </template>
                    <div ref="memoryChartRef" class="chart-container"></div>
                  </el-card>
                </el-col>
              </el-row>

              <!-- 进程信息概览 -->
              <el-card class="process-info-card">
                <template #header>
                  <div class="card-header">
                    <el-icon><Monitor /></el-icon>
                    <span>进程信息</span>
                    <el-button text @click="refreshProcessInfo">
                      <el-icon><Refresh /></el-icon>
                    </el-button>
                  </div>
                </template>
                <el-row :gutter="16" v-if="processInfo">
                  <el-col :span="6">
                    <div class="process-stat">
                      <div class="stat-value">{{ processInfo.process?.pid || 'N/A' }}</div>
                      <div class="stat-label">进程ID</div>
                    </div>
                  </el-col>
                  <el-col :span="6">
                    <div class="process-stat">
                      <div class="stat-value">{{ getCpuUsage() }}</div>
                      <div class="stat-label">CPU使用率</div>
                    </div>
                  </el-col>
                  <el-col :span="6">
                    <div class="process-stat">
                      <div class="stat-value">{{ processInfo.resourceMetrics?.memory ? formatBytes(processInfo.resourceMetrics.memory) : 'N/A' }}</div>
                      <div class="stat-label">内存使用</div>
                    </div>
                  </el-col>
                  <el-col :span="6">
                    <div class="process-stat">
                      <div class="stat-value">{{ serverInfo.status === 'running' ? formatUptime(serverInfo.metrics?.uptime || 0) : 'N/A' }}</div>
                      <div class="stat-label">运行时长</div>
                    </div>
                  </el-col>
                </el-row>
                <el-empty v-else description="暂无进程信息" :image-size="60" />
              </el-card>
            </div>
          </el-tab-pane>

          <!-- 进程日志标签页 -->
          <el-tab-pane label="进程日志" name="process-logs">
            <div class="process-logs-content">
              <el-card class="process-logs-card">
                <template #header>
                  <div class="card-header">
                    <el-icon><Document /></el-icon>
                    <span>进程日志</span>
                    <div class="log-controls">
                      <el-select v-model="processLogLevel" placeholder="日志级别" size="small" style="width: 120px; margin-right: 8px">
                        <el-option label="全部" value="" />
                        <el-option label="错误" value="error" />
                        <el-option label="警告" value="warn" />
                        <el-option label="信息" value="info" />
                        <el-option label="调试" value="debug" />
                      </el-select>
                      <el-input
                        v-model="processLogKeyword"
                        placeholder="搜索关键词"
                        size="small"
                        style="width: 200px; margin-right: 8px"
                        clearable
                      />
                      <el-button size="small" @click="refreshProcessLogs">
                        <el-icon><Refresh /></el-icon>
                      </el-button>
                      <el-button size="small" @click="clearProcessLogs">
                        清空
                      </el-button>
                    </div>
                  </div>
                </template>
                
                <div class="log-container" ref="processLogContainer">
                  <div 
                    v-for="log in filteredProcessLogs" 
                    :key="log.id || (log.timestamp + log.message)"
                    :class="['log-entry', `log-${log.level}`]"
                  >
                    <span class="log-time">{{ formatLogTime(log.timestamp) }}</span>
                    <span class="log-level">{{ log.level.toUpperCase() }}</span>
                    <span class="log-source" v-if="log.source">{{ log.source }}</span>
                    <span class="log-message">{{ log.message }}</span>
                  </div>
                  <el-empty v-if="filteredProcessLogs.length === 0" description="暂无日志" :image-size="60" />
                </div>
              </el-card>
            </div>
          </el-tab-pane>

          <!-- 日志监控标签页 -->
          <el-tab-pane label="系统日志" name="logs">
            <div class="logs-content">
              <div class="logs-controls">
                <el-row :gutter="16" align="middle">
                  <el-col :span="4">
                    <el-select v-model="logLevel" placeholder="日志级别">
                      <el-option label="全部" value="all" />
                      <el-option label="错误" value="error" />
                      <el-option label="警告" value="warn" />
                      <el-option label="信息" value="info" />
                      <el-option label="调试" value="debug" />
                    </el-select>
                  </el-col>
                  <el-col :span="6">
                    <el-date-picker
                      v-model="logDateRange"
                      type="datetimerange"
                      range-separator="至"
                      start-placeholder="开始时间"
                      end-placeholder="结束时间"
                      format="YYYY-MM-DD HH:mm:ss"
                      value-format="YYYY-MM-DD HH:mm:ss"
                    />
                  </el-col>
                  <el-col :span="6">
                    <el-input
                      v-model="logSearchQuery"
                      placeholder="搜索日志内容..."
                      :prefix-icon="Search"
                      clearable
                    />
                  </el-col>
                  <el-col :span="8">
                    <el-button-group>
                      <el-button :icon="Refresh" @click="refreshLogs">刷新</el-button>
                      <el-button :icon="Delete" @click="clearLogs">清空</el-button>
                      <el-button :icon="Download" @click="exportLogs">导出</el-button>
                      <el-button
                        :icon="autoScroll ? 'VideoPause' : 'VideoPlay'"
                        @click="toggleAutoScroll"
                      >
                        {{ autoScroll ? '暂停' : '自动滚动' }}
                      </el-button>
                    </el-button-group>
                  </el-col>
                </el-row>
              </div>

              <el-card class="logs-display-card" style="margin-top: 16px">
                <div class="logs-container" ref="logsContainer">
                  <div
                    v-for="log in filteredLogs"
                    :key="log.id"
                    :class="['log-entry', `log-${log.level}`]"
                  >
                    <div class="log-time">{{ formatDateTime(new Date(log.timestamp)) }}</div>
                    <div class="log-level">
                      <el-tag
                        :type="getLogLevelType(log.level)"
                        size="small"
                      >
                        {{ log.level.toUpperCase() }}
                      </el-tag>
                    </div>
                    <div class="log-source" v-if="log.source">
                      <el-text class="log-source-text">{{ log.source }}</el-text>
                    </div>
                    <div class="log-message">{{ log.message }}</div>
                    <div class="log-actions" v-if="log.level === 'error'">
                      <el-button size="small" text @click="viewLogDetails(log)">
                        详情
                      </el-button>
                    </div>
                  </div>

                  <el-empty
                    v-if="filteredLogs.length === 0"
                    description="暂无日志或搜索无结果"
                    :image-size="100"
                  />
                </div>
              </el-card>

              <!-- 日志统计 -->
              <el-row :gutter="16" style="margin-top: 16px">
                <el-col :span="6">
                  <el-card class="log-stat-card">
                    <div class="stat-content">
                      <div class="stat-value error-count">{{ logStats.error }}</div>
                      <div class="stat-label">错误</div>
                    </div>
                  </el-card>
                </el-col>
                <el-col :span="6">
                  <el-card class="log-stat-card">
                    <div class="stat-content">
                      <div class="stat-value warn-count">{{ logStats.warn }}</div>
                      <div class="stat-label">警告</div>
                    </div>
                  </el-card>
                </el-col>
                <el-col :span="6">
                  <el-card class="log-stat-card">
                    <div class="stat-content">
                      <div class="stat-value info-count">{{ logStats.info }}</div>
                      <div class="stat-label">信息</div>
                    </div>
                  </el-card>
                </el-col>
                <el-col :span="6">
                  <el-card class="log-stat-card">
                    <div class="stat-content">
                      <div class="stat-value debug-count">{{ logStats.debug }}</div>
                      <div class="stat-label">调试</div>
                    </div>
                  </el-card>
                </el-col>
              </el-row>
            </div>
          </el-tab-pane>

        </el-tabs>
      </el-card>

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
  Connection,
  User,
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
const logLevel = ref("all");
const logSearchQuery = ref("");
const logDateRange = ref<[string, string] | null>(null);
const autoScroll = ref(true);
const chartTimeRange = ref("1h");
const activeTab = ref("overview");
const selectedTool = ref<MCPTool | null>(null);
const logs = ref<LogEntry[]>([]);
const connections = ref<any[]>([]);
const logsContainer = ref<HTMLElement>();

// 进程监控相关数据
const processInfo = ref<any>(null);
const resourceMetrics = ref<any>(null);
const resourceHistory = ref<any[]>([]);
const processLogs = ref<any[]>([]);
const processLogLevel = ref('');
const processLogKeyword = ref('');
const cpuChartRef = ref<HTMLElement>();
const memoryChartRef = ref<HTMLElement>();
const processLogContainer = ref<HTMLElement>();
let cpuChart: any = null;
let memoryChart: any = null;
let processLogUpdateInterval: NodeJS.Timeout | null = null;

// 存储订阅ID，用于精确取消订阅
const subscriptionIds = {
  serverStatus: '',
  serverMetrics: '',
  logs: '',
  processInfo: '',
  processLogs: ''
};

// 统计数据
const connectionStats = ref({
  active: 0,
  total: 0,
  failed: 0,
  avgDuration: 0
});

const logStats = ref({
  error: 0,
  warn: 0,
  info: 0,
  debug: 0
});

// 计算属性
const serverId = computed(() => route.params.id as string);
const serverInfo = computed(() => {
  console.log("这是server info",serverStore.selectedServer);
  
  return serverStore.selectedServer;
});

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

const filteredLogs = computed(() => {
  let filtered = logs.value;
  
  // 按级别过滤
  if (logLevel.value && logLevel.value !== 'all') {
    filtered = filtered.filter((log) => log.level === logLevel.value);
  }
  
  // 按搜索关键词过滤
  if (logSearchQuery.value) {
    const query = logSearchQuery.value.toLowerCase();
    filtered = filtered.filter((log) => 
      log.message.toLowerCase().includes(query) ||
      (log.source && log.source.toLowerCase().includes(query))
    );
  }
  
  // 按时间范围过滤
  if (logDateRange.value && logDateRange.value.length === 2) {
    const [startTime, endTime] = logDateRange.value;
    filtered = filtered.filter((log) => {
      const logTime = new Date(log.timestamp).getTime();
      return logTime >= new Date(startTime).getTime() && logTime <= new Date(endTime).getTime();
    });
  }
  
  return filtered.slice(-100); // 显示最新100条日志
});

// 进程监控计算属性
const filteredProcessLogs = computed(() => {
  let filtered = processLogs.value;
  
  // 按级别过滤
  if (processLogLevel.value) {
    filtered = filtered.filter((log) => log.level === processLogLevel.value);
  }
  
  // 按关键词过滤
  if (processLogKeyword.value) {
    const query = processLogKeyword.value.toLowerCase();
    filtered = filtered.filter((log) => 
      log.message.toLowerCase().includes(query) ||
      (log.source && log.source.toLowerCase().includes(query))
    );
  }
  
  return filtered.slice(-200); // 显示最新200条进程日志
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
    if (serverStore.servers.length === 0) {
      console.log('[ServerDetail] Servers array is empty, fetching servers list first...');
      await serverStore.fetchServers({});
      console.log('[ServerDetail] After fetchServers, servers array length:', serverStore.servers.length);
    }
    
    // 选择服务器
    serverStore.selectServer(serverId.value);
    console.log('[ServerDetail] After selectServer, selectedServer:', serverStore.selectedServer);
    
    // 如果本地已有完整的服务器数据，直接使用
    if (serverInfo.value && serverInfo.value.id === serverId.value) {
      console.log('[ServerDetail] Using cached server data');
      return;
    }
    
    // 如果本地没有数据或数据不完整，尝试从API获取详细信息
    console.log('[ServerDetail] Fetching server details from API...');
    const serverDetails = await serverStore.fetchServerDetails(serverId.value);
    
    // 如果 fetchServerDetails 返回了数据但 selectedServer 仍为空，
    // 说明服务器不在 servers 数组中，需要手动添加
    if (serverDetails && !serverStore.selectedServer) {
      console.log('[ServerDetail] Server details fetched but not in servers array, adding manually...');
      serverStore.servers.push(serverDetails);
    }
    
    // 重新选择服务器以更新selectedServer
    serverStore.selectServer(serverId.value);
    console.log('[ServerDetail] Final selectedServer:', serverStore.selectedServer);
    
    // 如果仍然没有数据，说明服务器确实不存在
    if (!serverInfo.value) {
      throw new Error("服务器不存在或无法访问");
    }
  } catch (error) {
    console.error('[ServerDetail] fetchServerDetail error:', error);
    ElMessage.error(`获取服务器详情失败: ${error}`);
  } finally {
    loading.value = false;
  }
};

// 格式化方法
const formatDateTime = (date: Date) => {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const formatDuration = (duration: number) => {
  if (duration < 60) return `${duration}秒`;
  if (duration < 3600) return `${Math.floor(duration / 60)}分钟`;
  return `${Math.floor(duration / 3600)}小时${Math.floor((duration % 3600) / 60)}分钟`;
};

// 工具管理方法
const refreshTools = async () => {
  try {
    await serverStore.fetchServerDetails(serverId.value);
    ElMessage.success('工具列表已刷新');
  } catch (error) {
    ElMessage.error('刷新工具列表失败');
  }
};

// 连接管理方法
const refreshConnections = async () => {
  try {
    // 模拟获取连接数据
    connections.value = [
      {
        id: 'conn-001',
        clientName: 'VS Code Extension',
        status: 'connected',
        connectedAt: new Date(Date.now() - 3600000).toISOString(),
        duration: 3600,
        requestCount: 45,
        lastActivity: new Date(Date.now() - 300000).toISOString()
      },
      {
        id: 'conn-002',
        clientName: 'CLI Tool',
        status: 'disconnected',
        connectedAt: new Date(Date.now() - 7200000).toISOString(),
        duration: 1800,
        requestCount: 12,
        lastActivity: new Date(Date.now() - 1800000).toISOString()
      }
    ];
    
    // 更新连接统计
    connectionStats.value = {
      active: connections.value.filter(c => c.status === 'connected').length,
      total: connections.value.length,
      failed: connections.value.filter(c => c.status === 'failed').length,
      avgDuration: connections.value.reduce((sum, c) => sum + c.duration, 0) / connections.value.length
    };
    
    ElMessage.success('连接列表已刷新');
  } catch (error) {
    ElMessage.error('刷新连接列表失败');
  }
};

const getConnectionStatusType = (status: string) => {
  switch (status) {
    case 'connected': return 'success';
    case 'disconnected': return 'info';
    case 'failed': return 'danger';
    default: return 'warning';
  }
};

const disconnectClient = async (connectionId: string) => {
  try {
    // 模拟断开连接
    const connection = connections.value.find(c => c.id === connectionId);
    if (connection) {
      connection.status = 'disconnected';
    }
    ElMessage.success('连接已断开');
    await refreshConnections();
  } catch (error) {
    ElMessage.error('断开连接失败');
  }
};

const viewConnectionDetails = (connection: any) => {
  ElMessage.info(`查看连接详情: ${connection.id}`);
};

// 日志监控方法
const refreshLogs = async () => {
  try {
    // 模拟获取日志数据
    const mockLogs = [
      {
        id: 'log-001',
        timestamp: new Date(Date.now() - 60000),
        level: 'info' as const,
        source: 'server',
        message: '服务器启动成功'
      },
      {
        id: 'log-002',
        timestamp: new Date(Date.now() - 30000),
        level: 'warn' as const,
        source: 'tool',
        message: '工具执行超时警告'
      },
      {
        id: 'log-003',
        timestamp: new Date(),
        level: 'error' as const,
        source: 'connection',
        message: '客户端连接失败'
      }
    ];
    
    logs.value = [...logs.value, ...mockLogs];
    
    // 更新日志统计
    logStats.value = {
      error: logs.value.filter(l => l.level === 'error').length,
      warn: logs.value.filter(l => l.level === 'warn').length,
      info: logs.value.filter(l => l.level === 'info').length,
      debug: logs.value.filter(l => l.level === 'debug').length
    };
    
    ElMessage.success('日志已刷新');
  } catch (error) {
    ElMessage.error('刷新日志失败');
  }
};

const exportLogs = () => {
  const logData = filteredLogs.value.map(log => ({
    时间: formatDateTime(new Date(log.timestamp)),
    级别: log.level.toUpperCase(),
    来源: log.source || 'N/A',
    消息: log.message
  }));
  
  const csvContent = 'data:text/csv;charset=utf-8,' + 
    Object.keys(logData[0]).join(',') + '\n' +
    logData.map(row => Object.values(row).join(',')).join('\n');
  
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", `server-${serverId.value}-logs.csv`);
  link.click();
  
  ElMessage.success('日志已导出');
};

const toggleAutoScroll = () => {
  autoScroll.value = !autoScroll.value;
  ElMessage.info(autoScroll.value ? '已开启自动滚动' : '已关闭自动滚动');
};

const viewLogDetails = (log: any) => {
  ElMessage.info(`查看日志详情: ${log.id}`);
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



const formatLogTime = (timestamp: string | number | Date) => {
  if (!timestamp) return 'N/A';
  
  let date: Date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'number') {
    // 如果是数字，判断是秒还是毫秒
    date = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
  } else {
    return 'N/A';
  }
  
  // 检查日期是否有效
  if (isNaN(date.getTime())) {
    return 'N/A';
  }
  
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
};

const getParameterCount = (parameters: any) => {
  return parameters?.properties ? Object.keys(parameters.properties).length : 0;
};

const getLogLevelType = (level: string) => {
  switch (level) {
    case 'error': return 'danger';
    case 'warn': return 'warning';
    case 'info': return 'primary';
    case 'debug': return 'info';
    default: return 'info';
  }
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 获取传输类型
const getTransportType = () => {
  // 优先使用配置中的传输类型
  if (serverInfo.value?.config?.transport) {
    return serverInfo.value.config.transport.toUpperCase();
  }
  
  // 根据端点URL判断传输类型
  if (serverInfo.value?.endpoint) {
    const endpoint = serverInfo.value.endpoint.toLowerCase();
    if (endpoint.includes('stdio') || endpoint.includes('process')) {
      return 'STDIO';
    }
    if (endpoint.includes('sse') || endpoint.includes('stream')) {
      return 'SSE';
    }
    if (endpoint.includes('ws') || endpoint.includes('websocket')) {
      return 'WebSocket';
    }
  }
  
  // 默认返回STDIO（因为大多数MCP服务器使用STDIO）
  return 'STDIO';
};

// 获取CPU使用率
const getCpuUsage = () => {
  // 优先使用processInfo中的实时数据
  if (processInfo.value?.resourceMetrics?.cpu !== undefined) {
    return (processInfo.value.resourceMetrics.cpu * 100).toFixed(1) + '%';
  }
  
  // 回退到serverInfo中的数据
  if (serverInfo.value?.metrics?.resourceUsage?.cpu !== undefined) {
    return (serverInfo.value.metrics.resourceUsage.cpu * 100).toFixed(1) + '%';
  }
  
  return 'N/A';
};

// 获取内存使用量
const getMemoryUsage = () => {
  // 优先使用processInfo中的实时数据
  if (processInfo.value?.resourceMetrics?.memory !== undefined) {
    return formatBytes(processInfo.value.resourceMetrics.memory);
  }
  
  // 回退到serverInfo中的数据
  if (serverInfo.value?.metrics?.resourceUsage?.memory !== undefined) {
    return formatBytes(serverInfo.value.metrics.resourceUsage.memory);
  }
  
  return 'N/A';
};

const getStatusType = (status: string) => {
  switch (status) {
    case 'running': return 'success';
    case 'stopped': return 'info';
    case 'error': return 'danger';
    case 'starting':
    case 'stopping': return 'warning';
    default: return 'info';
  }
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
  if (logs.value.length > 1000) {
    logs.value.splice(0, logs.value.length - 800);
  }
  nextTick(() => { if (logsContainer.value) logsContainer.value.scrollTop = logsContainer.value.scrollHeight; });
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

// 监听进程信息变化，自动更新图表
watch(processInfo, (newProcessInfo) => {
  console.log('[ServerDetail] processInfo changed:', newProcessInfo);
  console.log("newProcessInfo是什么",newProcessInfo);
  console.log("activeTab.value是什么",activeTab.value);
  console.log("newProcessInfo.resourceMetrics是什么",newProcessInfo.resourceMetrics);
  
  if (newProcessInfo && newProcessInfo.resourceMetrics && activeTab.value === 'process') {
    updateResourceCharts();
  }
}, { deep: true });

// 监听processLogs数据变化
watch(processLogs, (newValue, oldValue) => {
  console.log('[ServerDetail] processLogs changed, count:', newValue.length, 'previous count:', oldValue?.length || 0);
}, { deep: true });

// 进程监控方法
const refreshResourceMetrics = async () => {
  if (!serverInfo.value || serverInfo.value.status !== 'running') {
    return;
  }
  
  // 不再通过HTTP调用获取资源指标，完全依赖WebSocket推送
  // 如果当前没有进程信息，说明WebSocket还未推送数据，这是正常情况
  console.log('Resource metrics will be updated via WebSocket push');
  
  // 如果已有WebSocket推送的数据，直接更新图表
  if (processInfo.value && processInfo.value.resourceMetrics) {
    updateResourceCharts();
  }
};

const refreshProcessInfo = async () => {
  if (!serverInfo.value || serverInfo.value.status !== 'running') {
    processInfo.value = null;
    return;
  }
  
  // 不再通过HTTP调用获取进程信息，完全依赖WebSocket推送
  // 如果当前没有进程信息，说明WebSocket还未推送数据，这是正常情况
  if (process.env.NODE_ENV === 'development') {
    console.log('Process info will be updated via WebSocket push');
  }
};

const refreshProcessLogs = async () => {
  if (!serverInfo.value || serverInfo.value.status !== 'running') {
    processLogs.value = [];
    return;
  }
  
  // 不再通过HTTP调用获取进程日志，完全依赖WebSocket推送
  // 如果当前没有进程日志，说明WebSocket还未推送数据，这是正常情况
  if (process.env.NODE_ENV === 'development') {
    console.log('Process logs will be updated via WebSocket push');
  }
};

const clearProcessLogs = () => {
  processLogs.value = [];
};

const processLogsMaxTrim = () => {
  if (processLogs.value.length > MAX_PROCESS_LOGS) {
    processLogs.value.splice(0, processLogs.value.length - MAX_PROCESS_LOGS);
  }
};

const updateResourceCharts = () => {
  console.log("更新资源占用数据", processInfo.value);
  
  // 确保图表已初始化
  if (!cpuChart || !memoryChart) {
    console.log('图表未初始化，尝试初始化...');
    if (activeTab.value === 'process') {
      initResourceCharts().then(() => {
        // 初始化完成后再次调用更新
        updateResourceCharts();
      });
    }
    return;
  }
  
  // 优先使用实时数据
  if (processInfo.value?.resourceMetrics) {
    console.log('使用实时数据更新图表:', processInfo.value.resourceMetrics);
    const currentTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // 获取当前图表数据
    const cpuOption = cpuChart.getOption();
    const memoryOption = memoryChart.getOption();
    
    // 更新CPU图表
    const cpuTimes = [...(cpuOption.xAxis[0].data || []), currentTime].slice(-20); // 保留最近20个数据点
    const cpuData = [...(cpuOption.series[0].data || []), processInfo.value.resourceMetrics.cpu * 100].slice(-20);
    
    cpuChart.setOption({
      xAxis: { data: cpuTimes },
      series: [{ data: cpuData }]
    });
    
    // 更新内存图表
    const memoryMB = Math.round(processInfo.value.resourceMetrics.memory / 1024 / 1024);
    const memoryTimes = [...(memoryOption.xAxis[0].data || []), currentTime].slice(-20);
    const memoryData = [...(memoryOption.series[0].data || []), memoryMB].slice(-20);
    
    memoryChart.setOption({
      xAxis: { data: memoryTimes },
      series: [{ data: memoryData }]
    });
    
    console.log('图表更新完成 - CPU:', processInfo.value.resourceMetrics.cpu, '%, Memory:', memoryMB, 'MB');
    return;
  }
  
  // 回退使用历史数据
  if (!resourceHistory.value.length) {
    console.log('没有可用的资源数据');
    return;
  }
  
  console.log('使用历史数据更新图表');
  const times = resourceHistory.value.map(r => new Date(r.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  if (cpuChart) cpuChart.setOption({ xAxis: { data: times }, series: [{ data: resourceHistory.value.map(r => r.cpu * 100) }] });
  if (memoryChart) memoryChart.setOption({ xAxis: { data: times }, series: [{ data: resourceHistory.value.map(r => Math.round(r.memory / 1024 / 1024)) }] });
};

const initResourceCharts = async () => {
  await nextTick();
  
  // 动态导入 ECharts
  const echarts = await import('echarts');
  
  if (cpuChartRef.value) {
    cpuChart = echarts.init(cpuChartRef.value);
    cpuChart.setOption({
      title: { text: 'CPU使用率 (%)' },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value', min: 0, max: 100 },
      series: [{
        type: 'line',
        data: [],
        smooth: true,
        lineStyle: { color: '#409EFF' },
        areaStyle: { color: 'rgba(64, 158, 255, 0.1)' }
      }]
    });
  }
  
  if (memoryChartRef.value) {
    memoryChart = echarts.init(memoryChartRef.value);
    memoryChart.setOption({
      title: { text: '内存使用 (MB)' },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value', min: 0 },
      series: [{
        type: 'line',
        data: [],
        smooth: true,
        lineStyle: { color: '#67C23A' },
        areaStyle: { color: 'rgba(103, 194, 58, 0.1)' }
      }]
    });
  }
};

// 重复的函数定义已删除，使用上面已定义的函数

// 监听标签页切换
watch(activeTab, (newTab) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[ServerDetail] Tab switched to: ${newTab}, serverId: ${serverId.value}`);
  }
  
  if (newTab === 'process') {
    // 切换到进程监控标签页时初始化图表
    nextTick(() => {
      initResourceCharts();
      
      // 如果已有数据，立即更新图表
      if (processInfo.value && processInfo.value.resourceMetrics) {
        updateResourceCharts();
      }
    });
  }
  // 注意：现在不需要在标签页切换时订阅/取消订阅，因为在组件挂载时就已经订阅了
});



// 生命周期
onMounted(async () => {
  await fetchServerDetail();
  await refreshTools();
  await refreshConnections();
  await refreshLogs();

  // 初始化图表（如果当前在进程监控标签页）
  if (activeTab.value === 'process') {
    await nextTick();
    await initResourceCharts();
  }

  if (!websocketStore.connected) {
    console.log('[ServerDetail] WebSocket not connected, attempting to connect...');
    try { await websocketStore.connect(); } catch { console.error('[ServerDetail] Failed to connect WebSocket'); return; }
  }
  if (serverId.value && websocketStore.connected) {
    console.log('[ServerDetail] Subscribing to process info and logs for serverId:', serverId.value);
    websocketStore.subscribeToProcessInfo(serverId.value);
    websocketStore.subscribeToProcessLogs(serverId.value);
  }
  // 订阅事件
  subscriptionIds.processInfo = websocketStore.subscribe("process:info", (data: any) => {
    console.log('=== [ServerDetail] process:info 事件详细调试 ===');
    console.log('[ServerDetail] 完整的data对象:', JSON.stringify(data, null, 2));
    console.log('[ServerDetail] data对象的所有属性:', Object.keys(data));
    console.log('[ServerDetail] data.serverId:', data.serverId);
    console.log('[ServerDetail] 当前serverId:', serverId.value);
    console.log('[ServerDetail] serverId匹配:', data.serverId === serverId.value);
    
    if (data.serverId === serverId.value) {
      console.log('[ServerDetail] Processing process:info for serverId:', serverId.value);
      
      // 详细检查data.processInfo
      console.log('[ServerDetail] data.processInfo存在:', !!data.processInfo);
      console.log('[ServerDetail] data.processInfo类型:', typeof data.processInfo);
      if (data.processInfo) {
        console.log('[ServerDetail] data.processInfo的所有属性:', Object.keys(data.processInfo));
        console.log('[ServerDetail] data.processInfo.process存在:', !!data.processInfo.process);
        console.log('[ServerDetail] data.processInfo.resourceMetrics存在:', !!data.processInfo.resourceMetrics);
        console.log('[ServerDetail] data.processInfo.resourceMetrics类型:', typeof data.processInfo.resourceMetrics);
        console.log('[ServerDetail] data.processInfo.resourceMetrics值:', data.processInfo.resourceMetrics);
        
        if (data.processInfo.resourceMetrics) {
          console.log('[ServerDetail] resourceMetrics详细内容:', JSON.stringify(data.processInfo.resourceMetrics, null, 2));
          console.log('[ServerDetail] resourceMetrics的所有属性:', Object.keys(data.processInfo.resourceMetrics));
        } else {
          console.warn('[ServerDetail] resourceMetrics为空或未定义!');
        }
      }
      
      // 确保数据结构正确
      if (data.processInfo) {
        processInfo.value = data.processInfo;
        console.log('[ServerDetail] 更新后的processInfo:', JSON.stringify(processInfo.value, null, 2));
        
        // 验证数据结构
        if (processInfo.value.process) {
          console.log('[ServerDetail] Process data:', processInfo.value.process);
        }
        if (processInfo.value.resourceMetrics) {
          console.log('[ServerDetail] Resource metrics after update:', JSON.stringify(processInfo.value.resourceMetrics, null, 2));
        } else {
          console.warn('[ServerDetail] 更新后resourceMetrics仍为空!');
        }
        
        // updateResourceCharts 将通过 watch 监听器自动调用
      } else {
        console.warn('[ServerDetail] Received process:info event but processInfo is null/undefined');
      }
    } else {
      console.log('[ServerDetail] Ignoring process:info for different serverId:', data.serverId, 'current:', serverId.value);
    }
    console.log('=== [ServerDetail] process:info 调试结束 ===');
  }, `process-info-${serverId.value}`) || '';
  subscriptionIds.processLogs = websocketStore.subscribe("process:logs", (data: any) => {
    console.log('[ServerDetail] Received process:logs event:', data);
    if (data.serverId === serverId.value) {
      console.log('[ServerDetail] Processing process:logs for serverId:', serverId.value);
      
      // 确保有日志数据
      const logData = data.logData || data;
      if (logData && (logData.message || logData.level)) {
        const logEntry = { 
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9), 
          level: logData.level || 'info', 
          message: logData.message || 'No message', 
          timestamp: logData.timestamp || new Date().toISOString(), 
          source: logData.source || 'process',
          metadata: logData.metadata 
        };
        console.log('[ServerDetail] Adding log entry:', logEntry);
        processLogs.value.push(logEntry);
        console.log('[ServerDetail] Current processLogs count:', processLogs.value.length);
        processLogsMaxTrim();
        
        // 自动滚动到底部
        nextTick(() => {
          const container = document.querySelector('.log-container');
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        });
      } else {
        console.warn('[ServerDetail] Received process:logs event but no valid log data:', data);
      }
    } else {
      console.log('[ServerDetail] Ignoring process:logs for different serverId:', data.serverId, 'current:', serverId.value);
    }
  }, `process-logs-${serverId.value}`) || '';
});

onUnmounted(() => {
  if (subscriptionIds.processInfo) websocketStore.unsubscribe("process:info", subscriptionIds.processInfo);
  if (subscriptionIds.processLogs) websocketStore.unsubscribe("process:logs", subscriptionIds.processLogs);
  websocketStore.unsubscribeFromProcessInfo(serverId.value);
  websocketStore.unsubscribeFromProcessLogs(serverId.value);
});

// 最大进程日志保留条数
const MAX_PROCESS_LOGS = 500;
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

.status-tag {
  display: flex;
  align-items: center;
  gap: 6px;
}

.detail-content {
  min-height: 400px;
}

.tabs-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.server-detail-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 24px;
  background: #fafbfc;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.server-detail-tabs :deep(.el-tabs__content) {
  padding: 24px;
}

/* 概览页面样式 */
.overview-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.info-card,
.metrics-card,
.config-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.info-card,
.metrics-card {
  min-height: 120px;
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

.info-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.info-value {
  color: var(--el-text-color-primary);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.metric-item {
  text-align: center;
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}

.metric-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-color-primary);
  margin-bottom: 4px;
}

.metric-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 工具管理样式 */
.tools-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tools-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tools-table {
  margin-top: 16px;
}

.tool-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-name {
  font-weight: 500;
}

/* 连接管理样式 */
.connections-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.connection-stats {
  margin-bottom: 16px;
}

.stat-card {
  text-align: center;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: white;
}

.stat-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.stat-label {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.connections-table-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.client-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.connection-id {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

/* 日志监控样式 */
.logs-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.logs-controls {
  background: white;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
}

.logs-display-card {
  min-height: 400px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.logs-container {
  max-height: 500px;
  overflow-y: auto;
  background: var(--el-fill-color-blank);
  border-radius: 4px;
  padding: 12px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

.log-entry {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  color: var(--el-text-color-placeholder);
  white-space: nowrap;
  min-width: 120px;
  font-size: 11px;
}

.log-level {
  min-width: 60px;
}

.log-source {
  min-width: 80px;
}

.log-source-text {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.log-message {
  flex: 1;
  color: var(--el-text-color-primary);
  word-break: break-word;
  line-height: 1.4;
}

.log-actions {
  min-width: 60px;
}

.log-error {
  background-color: var(--el-color-danger-light-9);
  border-left: 3px solid var(--el-color-danger);
}

.log-warn {
  background-color: var(--el-color-warning-light-9);
  border-left: 3px solid var(--el-color-warning);
}

.log-info {
  background-color: var(--el-color-info-light-9);
  border-left: 3px solid var(--el-color-info);
}

.log-debug {
  background-color: var(--el-color-primary-light-9);
  border-left: 3px solid var(--el-color-primary);
}

.log-stat-card {
  text-align: center;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: white;
}

.error-count {
  color: var(--el-color-danger);
}

.warn-count {
  color: var(--el-color-warning);
}

.info-count {
  color: var(--el-color-info);
}

.debug-count {
  color: var(--el-color-primary);
}

.text-muted {
  color: var(--el-text-color-placeholder);
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

/* 图表容器样式 */
.chart-container {
  width: 100%;
  height: 300px;
  min-height: 300px;
}

.resource-chart-card {
  height: 400px;
}

.resource-chart-card .el-card__body {
  height: calc(100% - 60px);
  padding: 20px;
}
</style>
