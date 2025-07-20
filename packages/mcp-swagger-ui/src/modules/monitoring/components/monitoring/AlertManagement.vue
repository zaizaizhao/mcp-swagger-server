<template>
  <el-card class="alert-management">
    <template #header>
      <div class="alert-header">
        <span class="alert-title">智能告警系统</span>
        <div class="alert-controls">
          <el-button 
            type="primary" 
            size="small" 
            :icon="Plus"
            @click="showCreateAlert = true"
          >
            新建告警规则
          </el-button>
          
          <el-button 
            size="small" 
            :icon="Setting"
            @click="showSettings = true"
          >
            全局设置
          </el-button>
          
          <el-switch
            v-model="alertsEnabled"
            class="alert-switch"
            active-text="告警启用"
            inactive-text="告警禁用"
            @change="handleToggleAlerts"
          />
        </div>
      </div>
    </template>

    <!-- 告警统计概览 -->
    <div class="alert-overview">
      <el-row :gutter="16">
        <el-col :span="6">
          <div class="overview-card critical">
            <div class="card-content">
              <div class="count">{{ criticalAlerts.length }}</div>
              <div class="label">严重告警</div>
            </div>
            <el-icon class="card-icon"><Warning /></el-icon>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="overview-card warning">
            <div class="card-content">
              <div class="count">{{ warningAlerts.length }}</div>
              <div class="label">警告告警</div>
            </div>
            <el-icon class="card-icon"><InfoFilled /></el-icon>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="overview-card info">
            <div class="card-content">
              <div class="count">{{ infoAlerts.length }}</div>
              <div class="label">信息告警</div>
            </div>
            <el-icon class="card-icon"><Bell /></el-icon>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="overview-card success">
            <div class="card-content">
              <div class="count">{{ activeRules.length }}</div>
              <div class="label">活跃规则</div>
            </div>
            <el-icon class="card-icon"><CircleCheck /></el-icon>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 告警规则管理 -->
    <div class="alert-rules">
      <div class="section-header">
        <h3>告警规则</h3>
        <el-input
          v-model="ruleSearch"
          placeholder="搜索规则..."
          size="small"
          style="width: 200px"
          :prefix-icon="Search"
          clearable
        />
      </div>

      <el-table 
        :data="filteredRules" 
        class="rules-table"
        empty-text="暂无告警规则"
      >
        <el-table-column prop="name" label="规则名称" min-width="150">
          <template #default="{ row }">
            <div class="rule-name">
              <el-icon 
                :class="['rule-status-icon', row.enabled ? 'enabled' : 'disabled']"
              >
                <CircleCheck v-if="row.enabled" />
                <CircleClose v-else />
              </el-icon>
              {{ row.name }}
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="metric" label="监控指标" width="120">
          <template #default="{ row }">
            <el-tag 
              :type="getMetricTagType(row.metric)"
              size="small"
            >
              {{ getMetricLabel(row.metric) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="condition" label="触发条件" width="150">
          <template #default="{ row }">
            <span class="condition-text">
              {{ getConditionText(row) }}
            </span>
          </template>
        </el-table-column>
        
        <el-table-column prop="severity" label="严重级别" width="100">
          <template #default="{ row }">
            <el-tag 
              :type="getSeverityTagType(row.severity)"
              size="small"
            >
              {{ getSeverityLabel(row.severity) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="lastTriggered" label="最后触发" width="150">
          <template #default="{ row }">
            <span v-if="row.lastTriggered" class="time-text">
              {{ formatTime(row.lastTriggered) }}
            </span>
            <span v-else class="no-trigger">从未触发</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="actions" label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button-group size="small">
              <el-button 
                :icon="row.enabled ? 'Pause' : 'VideoPlay'"
                @click="toggleRule(row)"
              >
                {{ row.enabled ? '禁用' : '启用' }}
              </el-button>
              <el-button 
                :icon="Edit"
                @click="editRule(row)"
              >
                编辑
              </el-button>
              <el-button 
                :icon="Delete"
                type="danger"
                @click="deleteRule(row)"
              >
                删除
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 活跃告警列表 -->
    <div class="active-alerts">
      <div class="section-header">
        <h3>活跃告警</h3>
        <div class="alert-actions">
          <el-button 
            size="small" 
            @click="refreshAlerts"
            :icon="Refresh"
          >
            刷新
          </el-button>
          <el-button 
            size="small" 
            type="warning"
            @click="acknowledgeAllAlerts"
            :disabled="activeAlerts.length === 0"
          >
            全部确认
          </el-button>
          <el-button 
            size="small" 
            type="danger"
            @click="clearAllAlerts"
            :disabled="activeAlerts.length === 0"
          >
            全部清除
          </el-button>
        </div>
      </div>

      <div v-if="activeAlerts.length === 0" class="no-alerts">
        <el-empty description="当前没有活跃告警" />
      </div>

      <div v-else class="alerts-list">
        <div 
          v-for="alert in sortedActiveAlerts" 
          :key="alert.id"
          :class="['alert-item', `alert-${alert.level}`]"
        >
          <div class="alert-icon">
            <el-icon v-if="alert.level === 'critical'"><Warning /></el-icon>
            <el-icon v-else-if="alert.level === 'warning'"><InfoFilled /></el-icon>
            <el-icon v-else><Bell /></el-icon>
          </div>
          
          <div class="alert-content">
            <div class="alert-title">{{ alert.message }}</div>
            <div class="alert-description">{{ alert.type === 'error' ? '系统错误告警' : '性能监控告警' }}</div>
            <div class="alert-meta">
              <span class="alert-time">{{ formatTime(alert.timestamp) }}</span>
              <span class="alert-source">来源: {{ alert.type === 'error' ? '系统' : '性能监控' }}</span>
              <span class="alert-metric">指标: {{ alert.value }}</span>
            </div>
          </div>
          
          <div class="alert-actions">
            <el-button 
              size="small" 
              type="primary"
              @click="acknowledgeAlert(alert.id)"
              v-if="!alert.acknowledged"
            >
              确认
            </el-button>
            <el-button 
              size="small" 
              type="danger"
              @click="dismissAlert(alert.id)"
            >
              忽略
            </el-button>
            <el-dropdown @command="(cmd) => handleAlertAction(alert.id, cmd)">
              <el-button size="small" :icon="MoreFilled" />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="snooze">延后1小时</el-dropdown-item>
                  <el-dropdown-item command="escalate">升级告警</el-dropdown-item>
                  <el-dropdown-item command="details">查看详情</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建告警规则对话框 -->
    <el-dialog
      v-model="showCreateAlert"
      title="创建告警规则"
      width="600px"
      @close="resetAlertForm"
    >
      <el-form 
        ref="alertFormRef"
        :model="alertForm"
        :rules="alertFormRules"
        label-width="100px"
      >
        <el-form-item label="规则名称" prop="name">
          <el-input 
            v-model="alertForm.name"
            placeholder="输入规则名称"
            clearable
          />
        </el-form-item>
        
        <el-form-item label="监控指标" prop="metric">
          <el-select 
            v-model="alertForm.metric"
            placeholder="选择监控指标"
            style="width: 100%"
          >
            <el-option label="CPU使用率" value="cpu_usage" />
            <el-option label="内存使用率" value="memory_usage" />
            <el-option label="磁盘使用率" value="disk_usage" />
            <el-option label="网络流量" value="network_traffic" />
            <el-option label="系统负载" value="system_load" />
            <el-option label="进程数量" value="process_count" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="触发条件" prop="operator">
          <el-row :gutter="12">
            <el-col :span="8">
              <el-select v-model="alertForm.operator" placeholder="选择操作符">
                <el-option label="大于" value="gt" />
                <el-option label="大于等于" value="gte" />
                <el-option label="小于" value="lt" />
                <el-option label="小于等于" value="lte" />
                <el-option label="等于" value="eq" />
                <el-option label="不等于" value="neq" />
              </el-select>
            </el-col>
            <el-col :span="10">
              <el-input-number
                v-model="alertForm.threshold"
                :min="0"
                :max="getMaxThreshold(alertForm.metric)"
                :step="getThresholdStep(alertForm.metric)"
                style="width: 100%"
                placeholder="阈值"
              />
            </el-col>
            <el-col :span="6">
              <span class="threshold-unit">{{ getThresholdUnit(alertForm.metric) }}</span>
            </el-col>
          </el-row>
        </el-form-item>
        
        <el-form-item label="严重级别" prop="severity">
          <el-radio-group v-model="alertForm.severity">
            <el-radio value="info">信息</el-radio>
            <el-radio value="warning">警告</el-radio>
            <el-radio value="critical">严重</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="持续时间">
          <el-input-number
            v-model="alertForm.duration"
            :min="1"
            :max="60"
            style="width: 150px"
          />
          <span style="margin-left: 8px;">分钟后触发告警</span>
        </el-form-item>
        
        <el-form-item label="通知方式">
          <el-checkbox-group v-model="alertForm.notifications">
            <el-checkbox value="email">邮件通知</el-checkbox>
            <el-checkbox value="sms">短信通知</el-checkbox>
            <el-checkbox value="webhook">Webhook</el-checkbox>
            <el-checkbox value="desktop">桌面通知</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        
        <el-form-item label="描述">
          <el-input
            v-model="alertForm.description"
            type="textarea"
            :rows="3"
            placeholder="规则描述（可选）"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showCreateAlert = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="createAlertRule"
          :loading="creating"
        >
          创建规则
        </el-button>
      </template>
    </el-dialog>

    <!-- 全局设置对话框 -->
    <el-dialog
      v-model="showSettings"
      title="告警系统设置"
      width="500px"
    >
      <el-form label-width="120px">
        <el-form-item label="检查间隔">
          <el-input-number
            v-model="globalSettings.checkInterval"
            :min="10"
            :max="300"
            style="width: 150px"
          />
          <span style="margin-left: 8px;">秒</span>
        </el-form-item>
        
        <el-form-item label="历史保留">
          <el-input-number
            v-model="globalSettings.historyRetention"
            :min="1"
            :max="365"
            style="width: 150px"
          />
          <span style="margin-left: 8px;">天</span>
        </el-form-item>
        
        <el-form-item label="最大告警数">
          <el-input-number
            v-model="globalSettings.maxAlerts"
            :min="10"
            :max="1000"
            style="width: 150px"
          />
          <span style="margin-left: 8px;">条</span>
        </el-form-item>
        
        <el-form-item label="静音模式">
          <el-time-picker
            v-model="globalSettings.silentHours"
            is-range
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            format="HH:mm"
            value-format="HH:mm"
          />
        </el-form-item>
        
        <el-form-item label="自动清理">
          <el-switch
            v-model="globalSettings.autoCleanup"
            active-text="启用"
            inactive-text="禁用"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showSettings = false">取消</el-button>
        <el-button type="primary" @click="saveSettings">保存设置</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { 
  Plus, 
  Setting, 
  Search, 
  Edit, 
  Delete, 
  Warning, 
  InfoFilled, 
  Bell, 
  CircleCheck, 
  CircleClose,
  Refresh,
  MoreFilled
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import { useMonitoringStore } from '@/stores/monitoring'
import type { PerformanceAlert } from '@/types'

interface AlertRule {
  id: string
  name: string
  metric: string
  operator: string
  threshold: number
  severity: 'info' | 'warning' | 'critical'
  duration: number
  enabled: boolean
  notifications: string[]
  description: string
  lastTriggered?: Date
  createTime: Date
}

interface GlobalSettings {
  checkInterval: number
  historyRetention: number
  maxAlerts: number
  silentHours: [string, string] | null
  autoCleanup: boolean
}

const monitoringStore = useMonitoringStore()

// 响应式状态
const alertsEnabled = ref(true)
const showCreateAlert = ref(false)
const showSettings = ref(false)
const ruleSearch = ref('')
const creating = ref(false)
const alertFormRef = ref<FormInstance>()

// 告警规则
const alertRules = ref<AlertRule[]>([
  {
    id: '1',
    name: 'CPU使用率过高',
    metric: 'cpu_usage',
    operator: 'gt',
    threshold: 80,
    severity: 'warning',
    duration: 5,
    enabled: true,
    notifications: ['email', 'desktop'],
    description: '当CPU使用率超过80%持续5分钟时触发警告',
    lastTriggered: new Date(Date.now() - 2 * 60 * 60 * 1000),
    createTime: new Date(Date.now() - 24 * 60 * 60 * 1000)
  },
  {
    id: '2',
    name: '内存使用率严重',
    metric: 'memory_usage',
    operator: 'gt',
    threshold: 95,
    severity: 'critical',
    duration: 2,
    enabled: true,
    notifications: ['email', 'sms', 'webhook'],
    description: '当内存使用率超过95%持续2分钟时触发严重告警',
    createTime: new Date(Date.now() - 48 * 60 * 60 * 1000)
  },
  {
    id: '3',
    name: '磁盘空间不足',
    metric: 'disk_usage',
    operator: 'gt',
    threshold: 90,
    severity: 'warning',
    duration: 10,
    enabled: false,
    notifications: ['email'],
    description: '当磁盘使用率超过90%持续10分钟时触发警告',
    createTime: new Date(Date.now() - 72 * 60 * 60 * 1000)
  }
])

// 告警表单
const alertForm = reactive({
  name: '',
  metric: '',
  operator: 'gt',
  threshold: 0,
  severity: 'warning' as 'info' | 'warning' | 'critical',
  duration: 5,
  notifications: ['email'],
  description: ''
})

// 表单验证规则
const alertFormRules = {
  name: [
    { required: true, message: '请输入规则名称', trigger: 'blur' },
    { min: 2, max: 50, message: '名称长度在2到50个字符', trigger: 'blur' }
  ],
  metric: [
    { required: true, message: '请选择监控指标', trigger: 'change' }
  ],
  operator: [
    { required: true, message: '请选择操作符', trigger: 'change' }
  ]
}

// 全局设置
const globalSettings = reactive<GlobalSettings>({
  checkInterval: 30,
  historyRetention: 30,
  maxAlerts: 100,
  silentHours: null,
  autoCleanup: true
})

// 计算属性
const activeAlerts = computed(() => monitoringStore.alerts)

const criticalAlerts = computed(() => 
  activeAlerts.value.filter(alert => alert.level === 'critical')
)

const warningAlerts = computed(() => 
  activeAlerts.value.filter(alert => alert.level === 'warning')
)

const infoAlerts = computed(() => 
  activeAlerts.value.filter(alert => alert.level === 'info')
)

const activeRules = computed(() => 
  alertRules.value.filter(rule => rule.enabled)
)

const filteredRules = computed(() => {
  if (!ruleSearch.value) return alertRules.value
  
  return alertRules.value.filter(rule =>
    rule.name.toLowerCase().includes(ruleSearch.value.toLowerCase()) ||
    rule.description.toLowerCase().includes(ruleSearch.value.toLowerCase())
  )
})

const sortedActiveAlerts = computed(() => {
  return [...activeAlerts.value].sort((a, b) => {
    // 按严重程度排序：critical > warning > info
    const severityOrder: Record<string, number> = { critical: 3, warning: 2, info: 1 }
    const severityDiff = severityOrder[b.level] - severityOrder[a.level]
    if (severityDiff !== 0) return severityDiff
    
    // 按时间排序：最新的在前
    return b.timestamp.getTime() - a.timestamp.getTime()
  })
})

// 方法
const getMetricTagType = (metric: string) => {
  const types: Record<string, string> = {
    cpu_usage: 'primary',
    memory_usage: 'success',
    disk_usage: 'warning',
    network_traffic: 'info',
    system_load: 'danger',
    process_count: ''
  }
  return types[metric] || ''
}

const getMetricLabel = (metric: string) => {
  const labels: Record<string, string> = {
    cpu_usage: 'CPU',
    memory_usage: '内存',
    disk_usage: '磁盘',
    network_traffic: '网络',
    system_load: '负载',
    process_count: '进程'
  }
  return labels[metric] || metric
}

const getSeverityTagType = (severity: string) => {
  const types: Record<string, string> = {
    info: 'info',
    warning: 'warning',
    critical: 'danger'
  }
  return types[severity] || ''
}

const getSeverityLabel = (severity: string) => {
  const labels: Record<string, string> = {
    info: '信息',
    warning: '警告',
    critical: '严重'
  }
  return labels[severity] || severity
}

const getConditionText = (rule: AlertRule) => {
  const operators: Record<string, string> = {
    gt: '>',
    gte: '≥',
    lt: '<',
    lte: '≤',
    eq: '=',
    neq: '≠'
  }
  const unit = getThresholdUnit(rule.metric)
  return `${operators[rule.operator]} ${rule.threshold}${unit}`
}

const getMaxThreshold = (metric: string) => {
  const maxValues: Record<string, number> = {
    cpu_usage: 100,
    memory_usage: 100,
    disk_usage: 100,
    network_traffic: 10000,
    system_load: 100,
    process_count: 10000
  }
  return maxValues[metric] || 100
}

const getThresholdStep = (metric: string) => {
  const steps: Record<string, number> = {
    cpu_usage: 1,
    memory_usage: 1,
    disk_usage: 1,
    network_traffic: 100,
    system_load: 0.1,
    process_count: 10
  }
  return steps[metric] || 1
}

const getThresholdUnit = (metric: string) => {
  const units: Record<string, string> = {
    cpu_usage: '%',
    memory_usage: '%',
    disk_usage: '%',
    network_traffic: 'MB/s',
    system_load: '',
    process_count: '个'
  }
  return units[metric] || ''
}

const formatTime = (time: Date) => {
  return time.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const getAlertDescription = (alert: any) => {
  const typeMap: Record<string, string> = {
    cpu: 'CPU使用率告警',
    memory: '内存使用率告警',
    disk: '磁盘使用率告警',
    network: '网络流量告警',
    error: '系统错误告警'
  }
  return typeMap[alert.type] || alert.message
}

const getAlertSource = (alert: any) => {
  return alert.type === 'error' ? '系统' : '性能监控'
}

const handleToggleAlerts = (enabled: boolean) => {
  if (enabled) {
    monitoringStore.startMonitoring()
    ElMessage.success('告警系统已启用')
  } else {
    monitoringStore.stopMonitoring()
    ElMessage.warning('告警系统已禁用')
  }
}

const toggleRule = (rule: AlertRule) => {
  rule.enabled = !rule.enabled
  ElMessage.success(`规则"${rule.name}"已${rule.enabled ? '启用' : '禁用'}`)
}

const editRule = (rule: AlertRule) => {
  // 复制规则数据到表单
  Object.assign(alertForm, {
    name: rule.name,
    metric: rule.metric,
    operator: rule.operator,
    threshold: rule.threshold,
    severity: rule.severity,
    duration: rule.duration,
    notifications: [...rule.notifications],
    description: rule.description
  })
  showCreateAlert.value = true
}

const deleteRule = async (rule: AlertRule) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除告警规则"${rule.name}"吗？`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const index = alertRules.value.findIndex(r => r.id === rule.id)
    if (index > -1) {
      alertRules.value.splice(index, 1)
      ElMessage.success('规则删除成功')
    }
  } catch {
    // 用户取消删除
  }
}

const createAlertRule = async () => {
  if (!alertFormRef.value) return
  
  try {
    await alertFormRef.value.validate()
    creating.value = true
    
    // 模拟创建延迟
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const newRule: AlertRule = {
      id: Date.now().toString(),
      ...alertForm,
      enabled: true,
      createTime: new Date()
    }
    
    alertRules.value.unshift(newRule)
    showCreateAlert.value = false
    resetAlertForm()
    ElMessage.success('告警规则创建成功')
  } catch (error) {
    ElMessage.error('创建失败，请检查表单数据')
  } finally {
    creating.value = false
  }
}

const resetAlertForm = () => {
  Object.assign(alertForm, {
    name: '',
    metric: '',
    operator: 'gt',
    threshold: 0,
    severity: 'warning',
    duration: 5,
    notifications: ['email'],
    description: ''
  })
  alertFormRef.value?.clearValidate()
}

const refreshAlerts = () => {
  monitoringStore.refreshMetrics()
  ElMessage.success('告警数据已刷新')
}

const acknowledgeAlert = (alertId: string) => {
  monitoringStore.acknowledgeAlert(alertId)
}

const dismissAlert = (alertId: string) => {
  monitoringStore.dismissAlert(alertId)
}

const acknowledgeAllAlerts = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要确认所有告警吗？',
      '批量确认',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
    
    activeAlerts.value.forEach(alert => {
      if (!alert.acknowledged) {
        monitoringStore.acknowledgeAlert(alert.id)
      }
    })
    
    ElMessage.success('所有告警已确认')
  } catch {
    // 用户取消
  }
}

const clearAllAlerts = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清除所有告警吗？此操作不可恢复。',
      '批量清除',
      {
        confirmButtonText: '清除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    activeAlerts.value.forEach(alert => {
      monitoringStore.dismissAlert(alert.id)
    })
    
    ElMessage.success('所有告警已清除')
  } catch {
    // 用户取消
  }
}

const handleAlertAction = (alertId: string, action: string) => {
  const alert = activeAlerts.value.find(a => a.id === alertId)
  if (!alert) return
  
  switch (action) {
    case 'snooze':
      ElMessage.info(`告警"${alert.message}"已延后1小时`)
      break
    case 'escalate':
      ElMessage.warning(`告警"${alert.message}"已升级`)
      break
    case 'details':
      ElMessage.info('查看告警详情功能开发中...')
      break
  }
}

const saveSettings = () => {
  showSettings.value = false
  ElMessage.success('设置已保存')
}

// 生命周期
onMounted(() => {
  // 启动告警检查
  if (alertsEnabled.value) {
    monitoringStore.startMonitoring()
  }
})
</script>

<style scoped>
.alert-management {
  height: 100%;
}

.alert-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.alert-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.alert-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.alert-switch {
  margin-left: 8px;
}

.alert-overview {
  margin-bottom: 24px;
}

.overview-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-radius: 8px;
  color: white;
  position: relative;
  overflow: hidden;
}

.overview-card.critical {
  background: linear-gradient(135deg, #F56C6C, #F78989);
}

.overview-card.warning {
  background: linear-gradient(135deg, #E6A23C, #EEBE77);
}

.overview-card.info {
  background: linear-gradient(135deg, #409EFF, #66D9EF);
}

.overview-card.success {
  background: linear-gradient(135deg, #67C23A, #85CE61);
}

.card-content .count {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 4px;
}

.card-content .label {
  font-size: 14px;
  opacity: 0.9;
}

.card-icon {
  font-size: 40px;
  opacity: 0.6;
}

.alert-rules,
.active-alerts {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.section-header h3 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.alert-actions {
  display: flex;
  gap: 8px;
}

.rules-table {
  margin-bottom: 24px;
}

.rule-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rule-status-icon.enabled {
  color: var(--el-color-success);
}

.rule-status-icon.disabled {
  color: var(--el-color-info);
}

.condition-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  padding: 2px 6px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.time-text {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.no-trigger {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.no-alerts {
  margin: 40px 0;
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.alert-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid;
  background: var(--el-bg-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.alert-item.alert-critical {
  border-left-color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.alert-item.alert-warning {
  border-left-color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
}

.alert-item.alert-info {
  border-left-color: var(--el-color-info);
  background: var(--el-color-info-light-9);
}

.alert-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: white;
  font-size: 20px;
}

.alert-item.alert-critical .alert-icon {
  color: var(--el-color-danger);
}

.alert-item.alert-warning .alert-icon {
  color: var(--el-color-warning);
}

.alert-item.alert-info .alert-icon {
  color: var(--el-color-info);
}

.alert-content {
  flex: 1;
  min-width: 0;
}

.alert-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.alert-description {
  font-size: 14px;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
  line-height: 1.4;
}

.alert-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex-wrap: wrap;
}

.alert-actions {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.threshold-unit {
  display: flex;
  align-items: center;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .alert-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .alert-controls {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 768px) {
  .overview-card {
    padding: 16px;
  }
  
  .card-content .count {
    font-size: 24px;
  }
  
  .card-icon {
    font-size: 32px;
  }
  
  .alert-item {
    flex-direction: column;
    gap: 12px;
  }
  
  .alert-actions {
    align-self: stretch;
    justify-content: flex-end;
  }
  
  .alert-meta {
    flex-direction: column;
    gap: 4px;
  }
  
  .rules-table :deep(.el-table__body-wrapper) {
    overflow-x: auto;
  }
}
</style>
