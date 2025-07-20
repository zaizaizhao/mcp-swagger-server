<template>
  <el-card class="alerts-panel">
    <template #header>
      <div class="panel-header">
        <div class="header-left">
          <span class="panel-title">系统告警</span>
          <el-badge 
            :value="activeAlerts.length" 
            :type="badgeType"
            :hidden="activeAlerts.length === 0"
          />
        </div>
        <div class="header-actions">
          <el-button 
            size="small" 
            :icon="Refresh"
            @click="$emit('refresh')"
          >
            刷新
          </el-button>
          <el-button 
            size="small" 
            :icon="Delete"
            @click="$emit('clearAcknowledged')"
            :disabled="acknowledgedCount === 0"
          >
            清除已确认
          </el-button>
        </div>
      </div>
    </template>

    <div class="alerts-summary" v-if="alerts.length > 0">
      <div class="summary-item critical">
        <el-icon><Warning /></el-icon>
        <span>严重: {{ criticalCount }}</span>
      </div>
      <div class="summary-item warning">
        <el-icon><InfoFilled /></el-icon>
        <span>警告: {{ warningCount }}</span>
      </div>
      <div class="summary-item info">
        <el-icon><SuccessFilled /></el-icon>
        <span>信息: {{ infoCount }}</span>
      </div>
    </div>

    <div class="alerts-filters" v-if="alerts.length > 0">
      <el-select 
        v-model="selectedLevel" 
        placeholder="筛选级别" 
        size="small"
        clearable
        style="width: 120px"
      >
        <el-option label="严重" value="critical" />
        <el-option label="警告" value="warning" />
        <el-option label="信息" value="info" />
      </el-select>
      
      <el-select 
        v-model="selectedType" 
        placeholder="筛选类型" 
        size="small"
        clearable
        style="width: 120px"
      >
        <el-option label="CPU" value="cpu" />
        <el-option label="内存" value="memory" />
        <el-option label="磁盘" value="disk" />
        <el-option label="网络" value="network" />
        <el-option label="错误" value="error" />
      </el-select>

      <el-checkbox v-model="showAcknowledged" size="small">
        显示已确认
      </el-checkbox>
    </div>

    <div class="alerts-list">
      <div 
        v-if="filteredAlerts.length === 0" 
        class="empty-state"
      >
        <el-empty 
          :image-size="80"
          description="暂无告警信息"
        />
      </div>

      <div 
        v-for="alert in filteredAlerts" 
        :key="alert.id"
        class="alert-item"
        :class="[
          `alert-${alert.level}`,
          { 'alert-acknowledged': alert.acknowledged }
        ]"
      >
        <div class="alert-icon">
          <el-icon>
            <Warning v-if="alert.level === 'critical'" />
            <InfoFilled v-else-if="alert.level === 'warning'" />
            <SuccessFilled v-else />
          </el-icon>
        </div>

        <div class="alert-content">
          <div class="alert-header">
            <span class="alert-type">{{ getTypeLabel(alert.type) }}</span>
            <span class="alert-time">{{ formatTime(alert.timestamp) }}</span>
          </div>
          <div class="alert-message">{{ alert.message }}</div>
          <div class="alert-details" v-if="alert.value !== undefined">
            <span>当前值: {{ alert.value.toFixed(1) }}</span>
            <span>阈值: {{ alert.threshold.toFixed(1) }}</span>
          </div>
        </div>

        <div class="alert-actions">
          <el-button 
            v-if="!alert.acknowledged"
            size="small"
            type="primary"
            @click="$emit('acknowledge', alert.id)"
          >
            确认
          </el-button>
          <el-button 
            size="small"
            :icon="Delete"
            @click="$emit('dismiss', alert.id)"
          />
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  Warning, 
  InfoFilled, 
  SuccessFilled, 
  Refresh, 
  Delete 
} from '@element-plus/icons-vue'
import type { PerformanceAlert } from '@/types'

interface Props {
  alerts: PerformanceAlert[]
}

interface Emits {
  (e: 'acknowledge', alertId: string): void
  (e: 'dismiss', alertId: string): void
  (e: 'refresh'): void
  (e: 'clearAcknowledged'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const selectedLevel = ref<string>('')
const selectedType = ref<string>('')
const showAcknowledged = ref(false)

const activeAlerts = computed(() => 
  props.alerts.filter(alert => !alert.acknowledged)
)

const criticalCount = computed(() => 
  activeAlerts.value.filter(alert => alert.level === 'critical').length
)

const warningCount = computed(() => 
  activeAlerts.value.filter(alert => alert.level === 'warning').length
)

const infoCount = computed(() => 
  activeAlerts.value.filter(alert => alert.level === 'info').length
)

const acknowledgedCount = computed(() => 
  props.alerts.filter(alert => alert.acknowledged).length
)

const badgeType = computed(() => {
  if (criticalCount.value > 0) return 'danger'
  if (warningCount.value > 0) return 'warning'
  return 'primary'
})

const filteredAlerts = computed(() => {
  let filtered = props.alerts

  if (!showAcknowledged.value) {
    filtered = filtered.filter(alert => !alert.acknowledged)
  }

  if (selectedLevel.value) {
    filtered = filtered.filter(alert => alert.level === selectedLevel.value)
  }

  if (selectedType.value) {
    filtered = filtered.filter(alert => alert.type === selectedType.value)
  }

  return filtered.sort((a, b) => {
    // 先按确认状态排序
    if (a.acknowledged !== b.acknowledged) {
      return a.acknowledged ? 1 : -1
    }
    
    // 再按级别排序
    const levelOrder = { critical: 0, warning: 1, info: 2 }
    const levelDiff = levelOrder[a.level] - levelOrder[b.level]
    if (levelDiff !== 0) return levelDiff
    
    // 最后按时间排序（新的在前）
    return b.timestamp.getTime() - a.timestamp.getTime()
  })
})

const getTypeLabel = (type: string) => {
  const typeMap: Record<string, string> = {
    cpu: 'CPU',
    memory: '内存',
    disk: '磁盘',
    network: '网络',
    error: '错误'
  }
  return typeMap[type] || type
}

const formatTime = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) {
    return '刚刚'
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`
  } else {
    return date.toLocaleDateString('zh-CN')
  }
}
</script>

<style scoped>
.alerts-panel {
  height: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.alerts-summary {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
}

.summary-item.critical {
  color: var(--el-color-danger);
}

.summary-item.warning {
  color: var(--el-color-warning);
}

.summary-item.info {
  color: var(--el-color-info);
}

.alerts-filters {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.alerts-list {
  max-height: 400px;
  overflow-y: auto;
}

.empty-state {
  padding: 20px;
  text-align: center;
}

.alert-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid transparent;
  margin-bottom: 8px;
  background: var(--el-fill-color-light);
  transition: all 0.3s ease;
}

.alert-item:hover {
  background: var(--el-fill-color);
}

.alert-critical {
  border-left-color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.alert-warning {
  border-left-color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
}

.alert-info {
  border-left-color: var(--el-color-info);
  background: var(--el-color-info-light-9);
}

.alert-acknowledged {
  opacity: 0.6;
}

.alert-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.alert-critical .alert-icon {
  color: var(--el-color-danger);
}

.alert-warning .alert-icon {
  color: var(--el-color-warning);
}

.alert-info .alert-icon {
  color: var(--el-color-info);
}

.alert-content {
  flex: 1;
}

.alert-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.alert-type {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color);
  padding: 2px 6px;
  border-radius: 3px;
}

.alert-time {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.alert-message {
  font-size: 14px;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.alert-details {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--el-text-color-regular);
}

.alert-actions {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
