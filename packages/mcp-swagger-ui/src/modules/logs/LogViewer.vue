<template>
  <div class="log-viewer">
    <div class="log-header">
      <h2>{{ t('logs.title') }}</h2>
      <div class="log-controls">
        <!-- 搜索框 -->
        <el-input
          v-model="searchText"
          :placeholder="t('logs.searchPlaceholder')"
          style="width: 200px"
          clearable
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        
        <!-- 级别筛选 -->
        <el-select v-model="selectedLevel" :placeholder="t('logs.logLevel')" style="width: 120px">
          <el-option :label="t('common.all')" value="all" />
          <el-option :label="t('logs.debug')" value="debug" />
          <el-option :label="t('logs.info')" value="info" />
          <el-option :label="t('logs.warn')" value="warn" />
          <el-option :label="t('logs.error')" value="error" />
          <el-option :label="t('logs.fatal')" value="fatal" />
        </el-select>
        
        <!-- 来源筛选 -->
        <el-select 
          v-model="selectedSource" 
          :placeholder="t('logs.source')" 
          style="width: 150px"
          clearable
        >
          <el-option :label="t('common.all')" value="all" />
          <el-option
            v-for="source in availableSources"
            :key="source"
            :label="source"
            :value="source"
          />
        </el-select>
        
        <el-button @click="clearLogs" type="danger" plain>
          <el-icon><Delete /></el-icon>
          {{ t('logs.clearLogs') }}
        </el-button>
        <el-button @click="refreshLogs" type="primary" plain>
          <el-icon><Refresh /></el-icon>
          {{ t('logs.refresh') }}
        </el-button>
      </div>
    </div>

    <div class="log-content">
      <div v-if="filteredLogs.length === 0" class="empty-logs">
        <el-empty :description="t('logs.noLogs')" />
      </div>
      <div v-else class="log-list">
        <LogEntry
          v-for="log in filteredLogs"
          :key="log.id"
          :log="log"
          :search-text="searchText"
          @search-related="handleSearchRelated"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Delete, Refresh, Search } from '@element-plus/icons-vue'
import LogEntry from './components/LogEntry.vue'
import type { LogEntry as LogEntryType, LogLevel } from '@/stores/log'

// 国际化
const { t, locale } = useI18n()

// 响应式数据
const selectedLevel = ref('all')
const selectedSource = ref('all')
const searchText = ref('')
const rawLogs = ref<LogEntryType[]>([])

// 计算属性
const logs = computed(() => rawLogs.value)

const availableSources = computed(() => {
  const sources = new Set(rawLogs.value.map(log => log.source))
  return Array.from(sources).sort()
})

const filteredLogs = computed(() => {
  let filtered = logs.value

  // 按级别筛选
  if (selectedLevel.value !== 'all') {
    filtered = filtered.filter(log => log.level === selectedLevel.value)
  }

  // 按来源筛选
  if (selectedSource.value !== 'all') {
    filtered = filtered.filter(log => log.source === selectedSource.value)
  }

  // 按搜索文本筛选
  if (searchText.value.trim()) {
    const searchTerm = searchText.value.toLowerCase()
    filtered = filtered.filter(log => 
      log.message.toLowerCase().includes(searchTerm) ||
      log.source.toLowerCase().includes(searchTerm) ||
      (log.tags && log.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
    )
  }

  return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
})

// 方法
const clearLogs = () => {
  rawLogs.value = []
}

const refreshLogs = () => {
  loadLogs()
}

const handleSearchRelated = (log: LogEntryType) => {
  // 根据日志来源或错误类型搜索相关日志
  selectedSource.value = log.source
  if (log.level === 'error' || log.level === 'fatal') {
    selectedLevel.value = 'error'
  }
}

const loadLogs = () => {
  // 模拟日志数据 - 使用新的LogEntry结构
  const mockLogs: LogEntryType[] = [
    {
      id: '1',
      timestamp: new Date(Date.now() - 60000),
      level: 'info' as LogLevel,
      source: 'mcp-server',
      message: 'MCP服务器启动成功',
      tags: ['startup', 'server']
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 45000),
      level: 'info' as LogLevel,
      source: 'swagger-parser',
      message: '正在解析OpenAPI规范文件',
      context: { 
        file: 'test-openapi.json',
        endpoints: 15 
      },
      tags: ['parsing', 'openapi']
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 30000),
      level: 'warn' as LogLevel,
      source: 'swagger-parser',
      message: 'OpenAPI规范解析警告：部分端点缺少响应模式定义',
      context: { 
        endpoint: '/api/users',
        issue: 'Missing response schema',
        severity: 'medium'
      },
      tags: ['parsing', 'validation', 'warning']
    },
    {
      id: '4',
      timestamp: new Date(Date.now() - 15000),
      level: 'debug' as LogLevel,
      source: 'api-client',
      message: '发送API请求',
      context: {
        method: 'GET',
        url: '/api/users',
        headers: { 'Content-Type': 'application/json' }
      },
      tags: ['api', 'request']
    },
    {
      id: '5',
      timestamp: new Date(Date.now() - 10000),
      level: 'error' as LogLevel,
      source: 'api-client',
      message: 'API调用失败：网络超时',
      context: { 
        url: 'https://api.example.com/users',
        timeout: 5000,
        retryCount: 3
      },
      stack: `Error: Network timeout
    at ApiClient.request (/path/to/api-client.js:45:12)
    at async UserService.getUsers (/path/to/user-service.js:23:18)
    at async UserController.handleGetUsers (/path/to/user-controller.js:67:25)`,
      tags: ['api', 'error', 'network']
    },
    {
      id: '6',
      timestamp: new Date(Date.now() - 5000),
      level: 'fatal' as LogLevel,
      source: 'database',
      message: '数据库连接失败',
      context: {
        host: 'localhost',
        port: 5432,
        database: 'mcp_swagger',
        error: 'Connection refused'
      },
      stack: `Error: Connection refused
    at Database.connect (/path/to/database.js:78:15)
    at DatabaseManager.initialize (/path/to/db-manager.js:34:22)
    at Server.start (/path/to/server.js:56:18)`,
      tags: ['database', 'fatal', 'connection']
    }
  ]
  
  rawLogs.value = mockLogs
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
  flex-wrap: wrap;
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
  background: var(--el-bg-color);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .log-header {
    flex-direction: column;
    gap: 15px;
    align-items: flex-start;
  }
  
  .log-controls {
    width: 100%;
    justify-content: flex-start;
  }
  
  .log-controls > * {
    flex-shrink: 0;
  }
}

@media (max-width: 480px) {
  .log-viewer {
    padding: 10px;
  }
  
  .log-controls {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .log-controls .el-input,
  .log-controls .el-select {
    width: 100% !important;
  }
}
</style>