<template>
  <div class="log-entry" :class="['log-level-' + log.level, { 'expanded': expanded }]">
    <div class="log-main" @click="toggleExpanded">
      <!-- 时间戳 -->
      <div class="log-timestamp">
        {{ formatTimestamp(log.timestamp) }}
      </div>
      
      <!-- 级别标签 -->
      <div class="log-level">
        <el-tag 
          :type="getLevelTagType(log.level)" 
          size="small" 
          effect="dark"
          class="level-tag"
        >
          {{ log.level.toUpperCase() }}
        </el-tag>
      </div>
      
      <!-- 来源 -->
      <div class="log-source">
        <el-tag size="small" type="info" class="source-tag">
          {{ log.source }}
        </el-tag>
      </div>
      
      <!-- 消息内容 -->
      <div class="log-message">
        <span v-html="highlightedMessage"></span>
      </div>
      
      <!-- 标签 -->
      <div v-if="log.tags && log.tags.length > 0" class="log-tags">
        <el-tag
          v-for="tag in log.tags"
          :key="tag"
          size="small"
          class="tag-item"
        >
          {{ tag }}
        </el-tag>
      </div>
      
      <!-- 操作按钮 -->
      <div class="log-actions">
        <el-button
          v-if="log.stack || log.context"
          :icon="expanded ? ArrowUp : ArrowDown"
          size="small"
          text
          @click.stop="toggleExpanded"
        />
        
        <el-button
          :icon="CopyDocument"
          size="small"
          text
          @click.stop="copyLog"
          title="复制日志"
        />
        
        <el-button
          v-if="log.level === 'error' || log.level === 'fatal'"
          :icon="Search"
          size="small"
          text
          @click.stop="searchRelated"
          title="查找相关日志"
        />
      </div>
    </div>
    
    <!-- 展开的详细信息 -->
    <div v-if="expanded && (log.stack || log.context)" class="log-details">
      <!-- 上下文信息 -->
      <div v-if="log.context && Object.keys(log.context).length > 0" class="log-context">
        <h5>上下文信息</h5>
        <pre class="context-content">{{ JSON.stringify(log.context, null, 2) }}</pre>
      </div>
      
      <!-- 错误堆栈 -->
      <div v-if="log.stack" class="log-stack">
        <h5>错误堆栈</h5>
        <pre class="stack-content">{{ log.stack }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowUp, ArrowDown, CopyDocument, Search } from '@element-plus/icons-vue'
import type { LogEntry, LogLevel } from '@/stores/log'

interface Props {
  log: LogEntry
  searchText?: string
}

interface Emits {
  (e: 'search-related', log: LogEntry): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 状态
const expanded = ref(false)

// 计算属性
const highlightedMessage = computed(() => {
  if (!props.searchText) {
    return escapeHtml(props.log.message)
  }
  
  const regex = new RegExp(`(${escapeRegExp(props.searchText)})`, 'gi')
  return escapeHtml(props.log.message).replace(regex, '<mark>$1</mark>')
})

// 方法
const getLevelTagType = (level: LogLevel): string => {
  const types: Record<LogLevel, string> = {
    debug: 'info',
    info: 'success',
    warn: 'warning',
    error: 'danger',
    fatal: 'danger'
  }
  return types[level] || 'info'
}

const formatTimestamp = (timestamp: Date): string => {
  return timestamp.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) + '.' + timestamp.getMilliseconds().toString().padStart(3, '0')
}

const toggleExpanded = () => {
  if (props.log.stack || props.log.context) {
    expanded.value = !expanded.value
  }
}

const copyLog = async () => {
  try {
    const logText = [
      `时间: ${formatTimestamp(props.log.timestamp)}`,
      `级别: ${props.log.level.toUpperCase()}`,
      `来源: ${props.log.source}`,
      `消息: ${props.log.message}`,
      ...(props.log.tags ? [`标签: ${props.log.tags.join(', ')}`] : []),
      ...(props.log.context ? [`上下文: ${JSON.stringify(props.log.context, null, 2)}`] : []),
      ...(props.log.stack ? [`堆栈: ${props.log.stack}`] : [])
    ].join('\n')
    
    await navigator.clipboard.writeText(logText)
    ElMessage.success('日志已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

const searchRelated = () => {
  emit('search-related', props.log)
}

const escapeHtml = (text: string): string => {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
</script>

<style scoped>
.log-entry {
  border-left: 4px solid transparent;
  transition: all 0.2s ease;
}

.log-entry:hover {
  background: var(--el-bg-color-page);
}

.log-entry.expanded {
  border-left-color: var(--el-color-primary);
}

/* 不同级别的颜色 */
.log-level-debug {
  border-left-color: var(--el-color-info);
}

.log-level-info {
  border-left-color: var(--el-color-success);
}

.log-level-warn {
  border-left-color: var(--el-color-warning);
}

.log-level-error,
.log-level-fatal {
  border-left-color: var(--el-color-danger);
}

.log-main {
  display: grid;
  grid-template-columns: 180px 80px 120px 1fr auto auto;
  gap: 12px;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  min-height: 40px;
}

.log-timestamp {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.log-level {
  display: flex;
  justify-content: center;
}

.level-tag {
  font-weight: 600;
  font-size: 10px;
  min-width: 60px;
  text-align: center;
}

.log-source {
  display: flex;
  justify-content: flex-start;
}

.source-tag {
  font-size: 11px;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.log-message {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.4;
  color: var(--el-text-color-primary);
  word-break: break-word;
  min-height: 20px;
  display: flex;
  align-items: center;
}

.log-message :deep(mark) {
  background: var(--el-color-warning-light-7);
  color: var(--el-color-warning-dark-2);
  padding: 1px 2px;
  border-radius: 2px;
}

.log-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  max-width: 200px;
}

.tag-item {
  font-size: 10px;
}

.log-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.log-entry:hover .log-actions {
  opacity: 1;
}

.log-details {
  padding: 12px 16px;
  background: var(--el-fill-color-light);
  border-top: 1px solid var(--el-border-color-lighter);
}

.log-context,
.log-stack {
  margin-bottom: 16px;
}

.log-context:last-child,
.log-stack:last-child {
  margin-bottom: 0;
}

.log-context h5,
.log-stack h5 {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.context-content,
.stack-content {
  margin: 0;
  padding: 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  font-family: 'Courier New', Consolas, monospace;
  font-size: 12px;
  line-height: 1.4;
  color: var(--el-text-color-regular);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.stack-content {
  color: var(--el-color-danger);
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .log-main {
    grid-template-columns: 160px 70px 100px 1fr auto;
  }
  
  .log-tags {
    display: none;
  }
}

@media (max-width: 768px) {
  .log-main {
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    gap: 8px;
  }
  
  .log-timestamp,
  .log-level,
  .log-source {
    grid-row: 1;
  }
  
  .log-message {
    grid-row: 2;
    grid-column: 1 / -1;
  }
  
  .log-actions {
    grid-row: 1;
    grid-column: 2;
  }
}
</style>
