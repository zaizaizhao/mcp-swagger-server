<template>
  <div class="log-viewer">
    <div class="log-header">
      <h2>系统日志</h2>
      <div class="log-controls">
        <el-select v-model="selectedLevel" placeholder="日志级别" style="width: 120px">
          <el-option label="全部" value="all" />
          <el-option label="错误" value="error" />
          <el-option label="警告" value="warn" />
          <el-option label="信息" value="info" />
          <el-option label="调试" value="debug" />
        </el-select>
        <el-button @click="clearLogs" type="danger" plain>
          <el-icon><Delete /></el-icon>
          清空日志
        </el-button>
        <el-button @click="refreshLogs" type="primary" plain>
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <div class="log-content">
      <div v-if="filteredLogs.length === 0" class="empty-logs">
        <el-empty description="暂无日志数据" />
      </div>
      <div v-else class="log-list">
        <div
          v-for="log in filteredLogs"
          :key="log.id"
          :class="['log-item', `log-${log.level}`]"
        >
          <div class="log-time">{{ formatTime(log.timestamp) }}</div>
          <div class="log-level">{{ log.level.toUpperCase() }}</div>
          <div class="log-message">{{ log.message }}</div>
          <div v-if="log.details" class="log-details">
            <pre>{{ JSON.stringify(log.details, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Delete, Refresh } from '@element-plus/icons-vue'

interface LogEntry {
  id: string
  timestamp: number
  level: 'error' | 'warn' | 'info' | 'debug'
  message: string
  details?: any
}

const selectedLevel = ref('all')
const logs = ref<LogEntry[]>([])

const filteredLogs = computed(() => {
  if (selectedLevel.value === 'all') {
    return logs.value
  }
  return logs.value.filter(log => log.level === selectedLevel.value)
})

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const clearLogs = () => {
  logs.value = []
}

const refreshLogs = () => {
  // 模拟获取日志数据
  loadLogs()
}

const loadLogs = () => {
  // 模拟日志数据
  const mockLogs: LogEntry[] = [
    {
      id: '1',
      timestamp: Date.now() - 60000,
      level: 'info',
      message: 'MCP服务器启动成功'
    },
    {
      id: '2',
      timestamp: Date.now() - 30000,
      level: 'warn',
      message: 'OpenAPI规范解析警告',
      details: { endpoint: '/api/users', issue: 'Missing response schema' }
    },
    {
      id: '3',
      timestamp: Date.now() - 10000,
      level: 'error',
      message: 'API调用失败',
      details: { url: 'https://api.example.com/users', error: 'Network timeout' }
    }
  ]
  
  logs.value = mockLogs.sort((a, b) => b.timestamp - a.timestamp)
}

onMounted(() => {
  loadLogs()
})
</script>

<style scoped>
.log-viewer {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--el-border-color);
}

.log-header h2 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.log-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.log-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.empty-logs {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.log-list {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
}

.log-item {
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: grid;
  grid-template-columns: 150px 80px 1fr;
  gap: 12px;
  align-items: start;
}

.log-item:last-child {
  border-bottom: none;
}

.log-item.log-error {
  background-color: var(--el-color-error-light-9);
  border-left: 4px solid var(--el-color-error);
}

.log-item.log-warn {
  background-color: var(--el-color-warning-light-9);
  border-left: 4px solid var(--el-color-warning);
}

.log-item.log-info {
  background-color: var(--el-color-info-light-9);
  border-left: 4px solid var(--el-color-info);
}

.log-item.log-debug {
  background-color: var(--el-color-success-light-9);
  border-left: 4px solid var(--el-color-success);
}

.log-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-family: monospace;
}

.log-level {
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
}

.log-item.log-error .log-level {
  color: var(--el-color-error);
}

.log-item.log-warn .log-level {
  color: var(--el-color-warning);
}

.log-item.log-info .log-level {
  color: var(--el-color-info);
}

.log-item.log-debug .log-level {
  color: var(--el-color-success);
}

.log-message {
  color: var(--el-text-color-primary);
  word-break: break-word;
}

.log-details {
  grid-column: 1 / -1;
  margin-top: 8px;
  padding: 8px;
  background-color: var(--el-fill-color-lighter);
  border-radius: 4px;
  font-size: 12px;
}

.log-details pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--el-text-color-secondary);
}
</style>