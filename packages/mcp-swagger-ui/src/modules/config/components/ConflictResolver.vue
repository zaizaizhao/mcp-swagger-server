<template>
  <div class="conflict-resolver">
    <div class="resolver-header">
      <h3>配置冲突解决</h3>
      <div class="conflict-stats">
        <el-tag type="warning" size="large">
          {{ conflicts.length }} 个冲突待解决
        </el-tag>
      </div>
    </div>

    <div class="resolver-content">
      <!-- 批量操作工具栏 -->
      <div class="batch-actions">
        <el-space>
          <el-button @click="selectAllResolution('keep')" size="small">
            全部保留当前
          </el-button>
          <el-button @click="selectAllResolution('replace')" size="small">
            全部使用新配置
          </el-button>
          <el-button @click="selectAllResolution('merge')" size="small">
            全部智能合并
          </el-button>
          <el-button 
            @click="showPreview = !showPreview" 
            :type="showPreview ? 'primary' : 'default'"
            size="small"
          >
            预览结果
          </el-button>
        </el-space>
      </div>

      <!-- 冲突列表 -->
      <div class="conflicts-container">
        <div
          v-for="(conflict, index) in conflicts"
          :key="conflict.id"
          class="conflict-card"
          :class="{ 'resolved': isConflictResolved(conflict.id) }"
        >
          <!-- 冲突头部 -->
          <div class="conflict-header">
            <div class="conflict-title">
              <el-icon class="conflict-icon"><Warning /></el-icon>
              <h4>{{ conflict.title }}</h4>
              <el-tag size="small" :type="getConflictTypeColor(conflict.type)">
                {{ getConfigTypeLabel(conflict.type) }}
              </el-tag>
            </div>
            <div class="conflict-actions">
              <el-button 
                size="small" 
                @click="toggleConflictExpanded(conflict.id)"
                :icon="expandedConflicts.has(conflict.id) ? 'ArrowUp' : 'ArrowDown'"
              >
                {{ expandedConflicts.has(conflict.id) ? '收起' : '展开' }}
              </el-button>
            </div>
          </div>

          <!-- 冲突内容 -->
          <div v-show="expandedConflicts.has(conflict.id)" class="conflict-body">
            <div class="conflict-comparison">
              <!-- 当前配置 -->
              <div class="config-section current">
                <div class="section-header">
                  <h5>当前配置</h5>
                  <el-tag size="small" type="info">Current</el-tag>
                </div>
                <div class="config-content">
                  <JsonViewer 
                    :data="conflict.current" 
                    :expanded="2"
                    :show-copy="false"
                  />
                </div>
              </div>

              <!-- 分隔符 -->
              <div class="separator">
                <el-divider direction="vertical" />
                <div class="vs-label">VS</div>
                <el-divider direction="vertical" />
              </div>

              <!-- 导入配置 -->
              <div class="config-section incoming">
                <div class="section-header">
                  <h5>导入配置</h5>
                  <el-tag size="small" type="warning">Incoming</el-tag>
                </div>
                <div class="config-content">
                  <JsonViewer 
                    :data="conflict.incoming" 
                    :expanded="2"
                    :show-copy="false"
                  />
                </div>
              </div>
            </div>

            <!-- 解决方案选择 -->
            <div class="resolution-section">
              <h5>选择解决方案：</h5>
              <el-radio-group 
                v-model="resolutions[conflict.id]" 
                @change="updateResolution(conflict.id, $event)"
                class="resolution-options"
              >
                <el-radio label="keep" class="resolution-option">
                  <div class="option-content">
                    <div class="option-title">保留当前配置</div>
                    <div class="option-description">使用现有的配置，忽略导入的更改</div>
                  </div>
                </el-radio>
                
                <el-radio label="replace" class="resolution-option">
                  <div class="option-content">
                    <div class="option-title">使用导入配置</div>
                    <div class="option-description">完全替换为导入的配置</div>
                  </div>
                </el-radio>
                
                <el-radio label="merge" class="resolution-option">
                  <div class="option-content">
                    <div class="option-title">智能合并</div>
                    <div class="option-description">自动合并两个配置，保留最佳部分</div>
                  </div>
                </el-radio>
                
                <el-radio label="custom" class="resolution-option">
                  <div class="option-content">
                    <div class="option-title">自定义配置</div>
                    <div class="option-description">手动编辑最终配置</div>
                  </div>
                </el-radio>
              </el-radio-group>

              <!-- 合并预览 -->
              <div 
                v-if="resolutions[conflict.id] === 'merge'" 
                class="merge-preview"
              >
                <h6>合并预览：</h6>
                <div class="preview-content">
                  <JsonViewer 
                    :data="getMergePreview(conflict)"
                    :expanded="1"
                    :show-copy="false"
                  />
                </div>
              </div>

              <!-- 自定义编辑器 -->
              <div 
                v-if="resolutions[conflict.id] === 'custom'" 
                class="custom-editor"
              >
                <h6>自定义配置：</h6>
                <div class="editor-wrapper">
                  <monaco-editor
                    v-model="customConfigs[conflict.id]"
                    language="json"
                    :height="200"
                    :options="{
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 13,
                      lineNumbers: 'on',
                      folding: true,
                      wordWrap: 'on'
                    }"
                    @change="validateCustomConfig(conflict.id)"
                  />
                </div>
                <div v-if="customConfigErrors[conflict.id]" class="editor-error">
                  <el-alert
                    :title="customConfigErrors[conflict.id]"
                    type="error"
                    show-icon
                    :closable="false"
                  />
                </div>
              </div>

              <!-- 解决方案说明 -->
              <div class="resolution-note">
                <el-alert
                  :title="getResolutionDescription(conflict.id)"
                  type="info"
                  :show-icon="false"
                  :closable="false"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 解决结果预览 -->
      <div v-if="showPreview" class="resolution-preview">
        <el-card shadow="never" class="preview-card">
          <template #header>
            <div class="card-header">
              <span>解决结果预览</span>
              <el-button size="small" @click="refreshPreview">
                刷新预览
              </el-button>
            </div>
          </template>
          
          <div class="preview-tabs">
            <el-tabs v-model="previewTab" type="border-card">
              <el-tab-pane label="完整配置" name="full">
                <div class="preview-content">
                  <JsonViewer 
                    :data="resolvedConfig"
                    :expanded="2"
                    :show-copy="true"
                  />
                </div>
              </el-tab-pane>
              
              <el-tab-pane label="变更摘要" name="summary">
                <div class="change-summary">
                  <div
                    v-for="change in changeSummary"
                    :key="change.path"
                    class="change-item"
                  >
                    <div class="change-path">{{ change.path }}</div>
                    <div class="change-action" :class="change.action">
                      <el-tag :type="getChangeTypeColor(change.action)" size="small">
                        {{ getChangeActionText(change.action) }}
                      </el-tag>
                    </div>
                    <div class="change-description">{{ change.description }}</div>
                  </div>
                </div>
              </el-tab-pane>
            </el-tabs>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="resolver-footer">
      <div class="resolution-stats">
        <span class="stats-text">
          已解决: {{ resolvedCount }} / {{ conflicts.length }}
        </span>
        <el-progress
          :percentage="resolutionProgress"
          :stroke-width="6"
          status="success"
          :show-text="false"
        />
      </div>
      
      <div class="footer-actions">
        <el-button @click="cancelResolution">取消</el-button>
        <el-button @click="resetResolutions">重置</el-button>
        <el-button 
          type="primary" 
          @click="applyResolutions"
          :disabled="!allConflictsResolved"
          :loading="applying"
        >
          应用解决方案
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'
import { useConfigStore, type ConfigConflict, type ConfigConflictResolution } from '@/stores/config'

// 引入JSON查看器组件 (需要安装或创建)
import JsonViewer from '@/shared/components/ui/JsonViewer.vue'
import MonacoEditor from '@/shared/components/MonacoEditor.vue'

interface ChangeItem {
  path: string
  action: 'added' | 'modified' | 'removed' | 'merged'
  description: string
}

interface Props {
  conflicts: ConfigConflict[]
  modelValue: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'resolved', resolutions: ConfigConflictResolution[]): void
  (e: 'cancelled'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Store
const configStore = useConfigStore()

// 状态
const showPreview = ref(false)
const previewTab = ref('full')
const applying = ref(false)
const expandedConflicts = ref(new Set<string>())

// 解决方案
const resolutions = ref<Record<string, string>>({})
const customConfigs = ref<Record<string, string>>({})
const customConfigErrors = ref<Record<string, string>>({})

// 计算属性
const resolvedCount = computed(() => {
  return Object.keys(resolutions.value).length
})

const resolutionProgress = computed(() => {
  if (props.conflicts.length === 0) return 100
  return Math.round((resolvedCount.value / props.conflicts.length) * 100)
})

const allConflictsResolved = computed(() => {
  return props.conflicts.every(conflict => 
    resolutions.value[conflict.id] && 
    (resolutions.value[conflict.id] !== 'custom' || 
     (customConfigs.value[conflict.id] && !customConfigErrors.value[conflict.id]))
  )
})

const resolvedConfig = computed(() => {
  if (!allConflictsResolved.value) return {}
  
  const resolved: any = {}
  
  for (const conflict of props.conflicts) {
    const resolution = resolutions.value[conflict.id]
    
    switch (resolution) {
      case 'keep':
        resolved[conflict.type] = conflict.current
        break
      case 'replace':
        resolved[conflict.type] = conflict.incoming
        break
      case 'merge':
        resolved[conflict.type] = configStore.mergeConfigurations(
          conflict.current,
          conflict.incoming
        )
        break
      case 'custom':
        try {
          resolved[conflict.type] = JSON.parse(customConfigs.value[conflict.id] || '{}')
        } catch {
          resolved[conflict.type] = conflict.current
        }
        break
    }
  }
  
  return resolved
})

const changeSummary = computed((): ChangeItem[] => {
  const changes: ChangeItem[] = []
  
  for (const conflict of props.conflicts) {
    const resolution = resolutions.value[conflict.id]
    const path = `${conflict.type}`
    
    switch (resolution) {
      case 'keep':
        changes.push({
          path,
          action: 'modified',
          description: '保留当前配置，忽略导入更改'
        })
        break
      case 'replace':
        changes.push({
          path,
          action: 'modified',
          description: '使用导入配置替换当前配置'
        })
        break
      case 'merge':
        changes.push({
          path,
          action: 'merged',
          description: '智能合并当前配置和导入配置'
        })
        break
      case 'custom':
        changes.push({
          path,
          action: 'modified',
          description: '使用自定义配置'
        })
        break
    }
  }
  
  return changes
})

// 方法
const selectAllResolution = (resolution: string) => {
  for (const conflict of props.conflicts) {
    resolutions.value[conflict.id] = resolution
    
    if (resolution === 'custom') {
      initializeCustomConfig(conflict.id, conflict)
    }
  }
}

const updateResolution = (conflictId: string, resolution: string) => {
  resolutions.value[conflictId] = resolution
  
  if (resolution === 'custom') {
    const conflict = props.conflicts.find(c => c.id === conflictId)
    if (conflict) {
      initializeCustomConfig(conflictId, conflict)
    }
  }
}

const initializeCustomConfig = (conflictId: string, conflict: ConfigConflict) => {
  // 使用合并后的配置作为自定义配置的起点
  const merged = configStore.mergeConfigurations(conflict.current, conflict.incoming)
  customConfigs.value[conflictId] = JSON.stringify(merged, null, 2)
  validateCustomConfig(conflictId)
}

const validateCustomConfig = (conflictId: string) => {
  try {
    JSON.parse(customConfigs.value[conflictId] || '{}')
    delete customConfigErrors.value[conflictId]
  } catch (error) {
    customConfigErrors.value[conflictId] = 'JSON格式错误: ' + 
      (error instanceof Error ? error.message : '语法错误')
  }
}

const toggleConflictExpanded = (conflictId: string) => {
  if (expandedConflicts.value.has(conflictId)) {
    expandedConflicts.value.delete(conflictId)
  } else {
    expandedConflicts.value.add(conflictId)
  }
}

const isConflictResolved = (conflictId: string): boolean => {
  return !!resolutions.value[conflictId]
}

const getMergePreview = (conflict: ConfigConflict): any => {
  return configStore.mergeConfigurations(conflict.current, conflict.incoming)
}

const getResolutionDescription = (conflictId: string): string => {
  const resolution = resolutions.value[conflictId]
  
  const descriptions: Record<string, string> = {
    keep: '将保留现有配置，导入的更改将被忽略',
    replace: '将使用导入的配置完全替换现有配置',
    merge: '将智能合并两个配置，保留最佳部分',
    custom: '将使用您自定义编辑的配置'
  }
  
  return descriptions[resolution] || '请选择一个解决方案'
}

const refreshPreview = () => {
  // 强制刷新预览
  showPreview.value = false
  setTimeout(() => {
    showPreview.value = true
  }, 100)
}

const applyResolutions = async () => {
  applying.value = true
  
  try {
    const resolutionList: ConfigConflictResolution[] = props.conflicts.map(conflict => ({
      conflictId: conflict.id,
      resolution: resolutions.value[conflict.id] as any,
      customValue: resolutions.value[conflict.id] === 'custom' 
        ? JSON.parse(customConfigs.value[conflict.id] || '{}')
        : undefined,
      description: getResolutionDescription(conflict.id)
    }))
    
    emit('resolved', resolutionList)
    ElMessage.success('冲突解决方案已应用')
  } catch (error) {
    ElMessage.error('应用解决方案失败: ' + (error instanceof Error ? error.message : '未知错误'))
  } finally {
    applying.value = false
  }
}

const cancelResolution = () => {
  emit('cancelled')
}

const resetResolutions = () => {
  resolutions.value = {}
  customConfigs.value = {}
  customConfigErrors.value = {}
}

const getConfigTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    servers: '服务器配置',
    auth: '认证配置',
    openapi: 'OpenAPI规范',
    testcases: '测试用例',
    settings: '系统设置'
  }
  return labels[type] || type
}

const getConflictTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    servers: 'primary',
    auth: 'warning',
    openapi: 'success',
    testcases: 'info',
    settings: 'danger'
  }
  return colors[type] || 'default'
}

const getChangeTypeColor = (action: string): string => {
  const colors: Record<string, string> = {
    added: 'success',
    modified: 'warning',
    removed: 'danger',
    merged: 'primary'
  }
  return colors[action] || 'info'
}

const getChangeActionText = (action: string): string => {
  const texts: Record<string, string> = {
    added: '新增',
    modified: '修改',
    removed: '删除',
    merged: '合并'
  }
  return texts[action] || action
}

// 初始化
onMounted(() => {
  // 默认展开第一个冲突
  if (props.conflicts.length > 0) {
    expandedConflicts.value.add(props.conflicts[0].id)
  }
})

// 监听冲突变化
watch(() => props.conflicts, (newConflicts) => {
  // 清理不存在的冲突的解决方案
  const conflictIds = new Set(newConflicts.map(c => c.id))
  
  Object.keys(resolutions.value).forEach(id => {
    if (!conflictIds.has(id)) {
      delete resolutions.value[id]
      delete customConfigs.value[id]
      delete customConfigErrors.value[id]
    }
  })
}, { immediate: true })
</script>

<style scoped>
.conflict-resolver {
  padding: 20px;
  max-height: 80vh;
  overflow-y: auto;
}

.resolver-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color);
}

.resolver-header h3 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.batch-actions {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--el-bg-color-page);
  border-radius: 8px;
}

.conflicts-container {
  margin-bottom: 20px;
}

.conflict-card {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  margin-bottom: 16px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.conflict-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.conflict-card.resolved {
  border-color: var(--el-color-success);
  background: var(--el-color-success-light-9);
}

.conflict-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color);
}

.conflict-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.conflict-title h4 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.conflict-icon {
  color: var(--el-color-warning);
  font-size: 18px;
}

.conflict-body {
  padding: 20px;
}

.conflict-comparison {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

.config-section {
  min-height: 200px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h5 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.config-content {
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 12px;
  background: var(--el-bg-color-page);
  max-height: 300px;
  overflow-y: auto;
}

.separator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.vs-label {
  padding: 8px 12px;
  background: var(--el-color-primary);
  color: white;
  border-radius: 16px;
  font-weight: 600;
  font-size: 12px;
}

.resolution-section {
  margin-top: 20px;
}

.resolution-section h5 {
  margin: 0 0 16px 0;
  color: var(--el-text-color-primary);
}

.resolution-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.resolution-option {
  margin: 0;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  transition: all 0.3s ease;
}

.resolution-option:hover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.option-content {
  margin-left: 24px;
}

.option-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.option-description {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.merge-preview,
.custom-editor {
  margin-top: 16px;
  padding: 16px;
  background: var(--el-bg-color-page);
  border-radius: 6px;
}

.merge-preview h6,
.custom-editor h6 {
  margin: 0 0 12px 0;
  color: var(--el-text-color-primary);
}

.preview-content {
  max-height: 200px;
  overflow-y: auto;
}

.editor-wrapper {
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  overflow: hidden;
}

.editor-error {
  margin-top: 8px;
}

.resolution-note {
  margin-top: 12px;
}

.resolution-preview {
  margin: 20px 0;
}

.preview-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-content {
  max-height: 400px;
  overflow-y: auto;
}

.change-summary {
  padding: 16px 0;
}

.change-item {
  display: grid;
  grid-template-columns: 200px 100px 1fr;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--el-border-color);
  align-items: center;
}

.change-item:last-child {
  border-bottom: none;
}

.change-path {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.change-description {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.resolver-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color);
}

.resolution-stats {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stats-text {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.footer-actions {
  display: flex;
  gap: 12px;
}
</style>
