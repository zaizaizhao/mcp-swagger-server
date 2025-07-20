<template>
  <div class="server-manager">
    <!-- 页面标题和操作栏 -->
    <div class="header-section">
      <div class="title-bar">
        <h1>
          <el-icon><Monitor /></el-icon>
          MCP 服务器管理
        </h1>
        <div class="header-actions">
          <el-button 
            type="primary" 
            @click="showCreateDialog = true"
            :icon="Plus"
          >
            创建服务器
          </el-button>
          <el-button 
            @click="refreshServers"
            :loading="loading"
            :icon="Refresh"
          >
            刷新
          </el-button>
        </div>
      </div>
      
      <!-- 搜索和过滤 -->
      <div class="filter-bar">
        <el-input
          v-model="searchQuery"
          placeholder="搜索服务器名称、端点..."
          :prefix-icon="Search"
          clearable
          class="search-input"
        />
        <el-select 
          v-model="statusFilter" 
          placeholder="状态筛选"
          clearable
          class="status-filter"
        >
          <el-option label="运行中" value="running" />
          <el-option label="已停止" value="stopped" />
          <el-option label="错误" value="error" />
          <el-option label="启动中" value="starting" />
          <el-option label="停止中" value="stopping" />
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
                <div class="stat-label">运行中</div>
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
                <div class="stat-label">已停止</div>
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
                <div class="stat-label">错误</div>
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
                <div class="stat-label">总计</div>
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
                      <el-button 
                        text 
                        :icon="More"
                        @click.stop
                      />
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item 
                            :command="{action: 'start', server}"
                            :disabled="server.status === 'running'"
                          >
                            启动服务器
                          </el-dropdown-item>
                          <el-dropdown-item 
                            :command="{action: 'stop', server}"
                            :disabled="server.status === 'stopped'"
                          >
                            停止服务器
                          </el-dropdown-item>
                          <el-dropdown-item 
                            :command="{action: 'restart', server}"
                            :disabled="server.status !== 'running'"
                          >
                            重启服务器
                          </el-dropdown-item>
                          <el-dropdown-item divided>
                            <el-dropdown-item 
                              :command="{action: 'edit', server}"
                            >
                              编辑配置
                            </el-dropdown-item>
                          </el-dropdown-item>
                          <el-dropdown-item 
                            :command="{action: 'delete', server}"
                            class="danger-action"
                          >
                            删除服务器
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
                    运行时间: {{ formatUptime(server.metrics.uptime) }}
                  </span>
                </div>
                
                <div class="server-info">
                  <div class="info-item">
                    <span class="label">端点:</span>
                    <span class="value">{{ server.endpoint }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">工具数量:</span>
                    <span class="value">{{ server.tools.length }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">请求总数:</span>
                    <span class="value">{{ server.metrics.totalRequests }}</span>
                  </div>
                </div>
                
                <div class="server-metrics" v-if="server.status === 'running'">
                  <el-progress 
                    :percentage="Math.min(100, server.metrics.errorRate * 100)"
                    :color="getErrorRateColor(server.metrics.errorRate)"
                    :show-text="false"
                    :stroke-width="4"
                  />
                  <span class="metrics-text">
                    错误率: {{ (server.metrics.errorRate * 100).toFixed(1) }}%
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
          @row-click="goToServerDetail"
          row-class-name="server-row"
        >
          <el-table-column prop="name" label="服务器名称" min-width="150">
            <template #default="{ row }">
              <div class="server-name-cell">
                <el-icon><Monitor /></el-icon>
                <span>{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>
          
          <el-table-column prop="status" label="状态" width="120">
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
          
          <el-table-column prop="endpoint" label="端点" min-width="200" />
          
          <el-table-column prop="tools" label="工具数量" width="100">
            <template #default="{ row }">
              {{ row.tools.length }}
            </template>
          </el-table-column>
          
          <el-table-column prop="metrics.totalRequests" label="请求总数" width="120" />
          
          <el-table-column prop="metrics.errorRate" label="错误率" width="100">
            <template #default="{ row }">
              {{ (row.metrics.errorRate * 100).toFixed(1) }}%
            </template>
          </el-table-column>
          
          <el-table-column prop="updatedAt" label="最后更新" width="160">
            <template #default="{ row }">
              {{ formatDateTime(row.updatedAt) }}
            </template>
          </el-table-column>
          
          <el-table-column fixed="right" label="操作" width="120">
            <template #default="{ row }">
              <el-button-group>
                <el-button 
                  v-if="row.status === 'stopped'"
                  size="small"
                  type="success"
                  @click.stop="startServer(row)"
                  :icon="VideoPlay"
                />
                <el-button 
                  v-else-if="row.status === 'running'"
                  size="small"
                  type="warning"
                  @click.stop="stopServer(row)"
                  :icon="VideoPause"
                />
                <el-button 
                  size="small"
                  @click.stop="editServer(row)"
                  :icon="Edit"
                />
                <el-button 
                  size="small"
                  type="danger"
                  @click.stop="deleteServer(row)"
                  :icon="Delete"
                />
              </el-button-group>
            </template>
          </el-table-column>
        </el-table>
      </div>
      
      <!-- 空状态 -->
      <el-empty 
        v-if="filteredServers.length === 0 && !loading"
        description="暂无服务器"
        :image-size="200"
      >
        <el-button 
          type="primary" 
          @click="showCreateDialog = true"
          :icon="Plus"
        >
          创建第一个服务器
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Monitor, Plus, Refresh, Search, Grid, List, More, Edit, Delete,
  CircleCheck, CircleClose, VideoPlay, VideoPause,
  WarningFilled
} from '@element-plus/icons-vue'
import type { MCPServer, ServerStatus } from '@/types'
import { useServerStore } from '@/stores/server'
import { useWebSocketStore } from '@/stores/websocket'
import ServerFormDialog from './components/ServerFormDialog.vue'

// 导入全局功能
import { useConfirmation } from '@/composables/useConfirmation'
import { useFormValidation } from '@/composables/useFormValidation'
import { usePerformanceMonitor } from '@/composables/usePerformance'
import LoadingOverlay from '@/shared/components/ui/LoadingOverlay.vue'

// 路由和状态
const router = useRouter()
const serverStore = useServerStore()
const websocketStore = useWebSocketStore()

// 全局功能
const { 
  confirmDelete: globalConfirmDelete, 
  confirmDangerousAction,
  confirmBatchDelete 
} = useConfirmation()

const { 
  startMonitoring,
  stopMonitoring,
  measureFunction 
} = usePerformanceMonitor()

// 响应式数据
const loading = ref(false)
const searchQuery = ref('')
const statusFilter = ref<ServerStatus | ''>('')
const viewMode = ref<'grid' | 'list'>('grid')
const showCreateDialog = ref(false)
const editingServer = ref<MCPServer | null>(null)

// 计算属性
const servers = computed(() => serverStore.servers)

const filteredServers = computed(() => {
  let filtered = servers.value

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(server => 
      server.name.toLowerCase().includes(query) ||
      server.endpoint.toLowerCase().includes(query) ||
      server.config.description?.toLowerCase().includes(query)
    )
  }

  // 状态过滤
  if (statusFilter.value) {
    filtered = filtered.filter(server => server.status === statusFilter.value)
  }

  return filtered
})

const totalServers = computed(() => servers.value.length)
const runningServers = computed(() => servers.value.filter(s => s.status === 'running').length)
const stoppedServers = computed(() => servers.value.filter(s => s.status === 'stopped').length)
const errorServers = computed(() => servers.value.filter(s => s.status === 'error').length)

// 方法
const refreshServers = async () => {
  loading.value = true
  try {
    await measureFunction('refreshServers', async () => {
      await serverStore.fetchServers()
    })
  } catch (error) {
    ElMessage.error(`刷新服务器列表失败: ${error}`)
  } finally {
    loading.value = false
  }
}

const goToServerDetail = (serverId: string) => {
  router.push(`/servers/${serverId}`)
}

const getStatusType = (status: ServerStatus) => {
  const statusMap = {
    running: 'success',
    stopped: 'info',
    error: 'danger',
    starting: 'warning',
    stopping: 'warning'
  }
  return statusMap[status] || 'info'
}

const getStatusIcon = (status: ServerStatus) => {
  const iconMap = {
    running: 'CircleCheck',
    stopped: 'CircleClose', 
    error: 'CircleClose',
    starting: 'Loading',
    stopping: 'Loading'
  }
  return iconMap[status] || 'CircleClose'
}

const getStatusText = (status: ServerStatus) => {
  const textMap = {
    running: '运行中',
    stopped: '已停止',
    error: '错误',
    starting: '启动中',
    stopping: '停止中'
  }
  return textMap[status] || '未知'
}

const formatUptime = (uptime: number) => {
  const hours = Math.floor(uptime / 3600000)
  const minutes = Math.floor((uptime % 3600000) / 60000)
  return `${hours}h ${minutes}m`
}

const formatDateTime = (date: Date) => {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const getErrorRateColor = (errorRate: number) => {
  if (errorRate < 0.01) return '#67C23A'
  if (errorRate < 0.05) return '#E6A23C'
  return '#F56C6C'
}

const handleServerAction = async ({ action, server }: { action: string, server: MCPServer }) => {
  switch (action) {
    case 'start':
      await startServer(server)
      break
    case 'stop':
      await stopServer(server)
      break
    case 'restart':
      await restartServer(server)
      break
    case 'edit':
      editServer(server)
      break
    case 'delete':
      deleteServer(server)
      break
  }
}

const startServer = async (server: MCPServer) => {
  try {
    await measureFunction('startServer', async () => {
      await serverStore.startServer(server.id)
    })
    ElMessage.success(`服务器 ${server.name} 启动成功`)
  } catch (error) {
    ElMessage.error(`启动服务器失败: ${error}`)
  }
}

const stopServer = async (server: MCPServer) => {
  const confirmed = await confirmDangerousAction(
    `确定要停止服务器 "${server.name}" 吗？这将中断所有正在进行的请求。`
  )
  if (!confirmed) return

  try {
    await measureFunction('stopServer', async () => {
      await serverStore.stopServer(server.id)
    })
    ElMessage.success(`服务器 ${server.name} 停止成功`)
  } catch (error) {
    ElMessage.error(`停止服务器失败: ${error}`)
  }
}

const restartServer = async (server: MCPServer) => {
  const confirmed = await confirmDangerousAction(
    `确定要重启服务器 "${server.name}" 吗？这将临时中断服务。`
  )
  if (!confirmed) return

  try {
    await measureFunction('restartServer', async () => {
      await serverStore.restartServer(server.id)
    })
    ElMessage.success(`服务器 ${server.name} 重启成功`)
  } catch (error) {
    ElMessage.error(`重启服务器失败: ${error}`)
  }
}

const editServer = (server: MCPServer) => {
  editingServer.value = server
  showCreateDialog.value = true
}

const deleteServer = async (server: MCPServer) => {
  const confirmed = await globalConfirmDelete(server.name)
  if (!confirmed) return
  
  try {
    await measureFunction('deleteServer', async () => {
      await serverStore.deleteServer(server.id)
    })
    ElMessage.success(`服务器 ${server.name} 删除成功`)
  } catch (error) {
    ElMessage.error(`删除服务器失败: ${error}`)
  }
}

const handleFormSuccess = () => {
  showCreateDialog.value = false
  editingServer.value = null
  refreshServers()
}

// 生命周期
onMounted(async () => {
  // 启动性能监控
  startMonitoring()
  
  await refreshServers()
  
  // 订阅 WebSocket 实时更新
  websocketStore.subscribe('server-status', handleServerStatusUpdate)
  websocketStore.subscribe('server-metrics', handleServerMetricsUpdate)
})

onUnmounted(() => {
  // 停止性能监控
  stopMonitoring()
  
  websocketStore.unsubscribe('server-status')
  websocketStore.unsubscribe('server-metrics')
})

const handleServerStatusUpdate = (data: any) => {
  serverStore.updateServerStatus(data.serverId, data.status)
}

const handleServerMetricsUpdate = (data: any) => {
  serverStore.updateServerMetrics(data.serverId, data.metrics)
}
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
  width: 120px;
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