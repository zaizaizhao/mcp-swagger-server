<template>
  <div class="config-manager">
    <!-- 页面头部 -->
    <div class="header-section">
      <div class="header-content">
        <h1>
          <el-icon><Setting /></el-icon>
          配置导入导出
        </h1>
        <p class="header-description">管理MCP网关配置的导入导出，支持配置备份和环境迁移</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="showExportDialog" :icon="Download">
          导出配置
        </el-button>
        <el-button type="success" @click="showImportDialog" :icon="Upload">
          导入配置
        </el-button>
        <el-button type="warning" @click="showMigrationWizard" :icon="Guide">
          配置迁移
        </el-button>
        <el-button @click="refreshData" :loading="loading" :icon="Refresh">
          刷新
        </el-button>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <el-tabs v-model="activeTab" class="config-tabs">
      <el-tab-pane label="配置管理" name="config">
        <div class="main-content">
          <!-- 配置预览区域 -->
          <div class="config-preview-section">
            <div class="section-header">
              <h3>当前配置概览</h3>
              <div class="header-actions">
                <el-select
                  v-model="selectedConfigType"
                  placeholder="筛选配置类型"
                  clearable
                  style="width: 180px"
                >
                  <el-option label="服务器配置" value="servers" />
                  <el-option label="认证配置" value="auth" />
                  <el-option label="OpenAPI规范" value="openapi" />
                  <el-option label="测试用例" value="testcases" />
                  <el-option label="系统设置" value="settings" />
                </el-select>
              </div>
            </div>

        <div class="config-cards" v-loading="loading">
          <div
            v-for="config in filteredConfigs"
            :key="config.type"
            class="config-card"
          >
            <div class="card-header">
              <div class="config-info">
                <div class="config-name">
                  <el-icon :class="getConfigIcon(config.type)"></el-icon>
                  {{ getConfigLabel(config.type) }}
                </div>
                <el-tag :type="getConfigStatus(config)">
                  {{ config.count }} 项配置
                </el-tag>
              </div>
              
              <div class="card-actions">
                <el-tooltip content="预览配置">
                  <el-button
                    size="small"
                    @click="previewConfig(config.type)"
                    :icon="View"
                    circle
                  />
                </el-tooltip>
                
                <el-tooltip content="单独导出">
                  <el-button
                    size="small"
                    type="primary"
                    @click="exportSingleConfig(config.type)"
                    :icon="Download"
                    circle
                  />
                </el-tooltip>
              </div>
            </div>

            <div class="config-details">
              <div class="detail-item">
                <span class="label">最后更新:</span>
                <span class="value">{{ formatDateTime(config.lastUpdated) }}</span>
              </div>
              <div class="detail-item">
                <span class="label">配置大小:</span>
                <span class="value">{{ formatFileSize(config.size) }}</span>
              </div>
              <div class="detail-item">
                <span class="label">状态:</span>
                <span class="value" :class="config.valid ? 'valid' : 'invalid'">
                  {{ config.valid ? '有效' : '无效' }}
                </span>
              </div>
            </div>
          </div>

          <div v-if="filteredConfigs.length === 0" class="empty-state">
            <el-empty description="没有找到配置信息">
              <el-button type="primary" @click="refreshData">刷新数据</el-button>
            </el-empty>
          </div>
        </div>
      </div>

      <!-- 操作历史 -->
      <div class="history-section">
        <div class="section-header">
          <h3>操作历史</h3>
          <el-button size="small" @click="clearHistory" :disabled="operationHistory.length === 0">
            清空历史
          </el-button>
        </div>

        <div class="history-timeline">
          <el-timeline>
            <el-timeline-item
              v-for="item in operationHistory"
              :key="item.id"
              :timestamp="formatDateTime(item.timestamp)"
              :type="getHistoryType(item.type)"
            >
              <div class="history-content">
                <div class="history-title">{{ item.title }}</div>
                <div class="history-description">{{ item.description }}</div>
                <div class="history-details" v-if="item.details">
                  <el-button size="small" text @click="showHistoryDetails(item)">
                    查看详情
                  </el-button>
                </div>
              </div>
            </el-timeline-item>
          </el-timeline>

          <div v-if="operationHistory.length === 0" class="empty-history">
            <el-text type="info">暂无操作历史</el-text>
          </div>
        </div>
      </div>
    </div>
      </el-tab-pane>

    <!-- 导出配置对话框 -->
    <el-dialog
      v-model="exportDialogVisible"
      title="导出配置"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form ref="exportFormRef" :model="exportForm" label-width="120px">
        <el-form-item label="导出类型">
          <el-checkbox-group v-model="exportForm.types">
            <el-checkbox label="servers">服务器配置</el-checkbox>
            <el-checkbox label="auth">认证配置</el-checkbox>
            <el-checkbox label="openapi">OpenAPI规范</el-checkbox>
            <el-checkbox label="testcases">测试用例</el-checkbox>
            <el-checkbox label="settings">系统设置</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="导出格式">
          <el-radio-group v-model="exportForm.format">
            <el-radio label="json">JSON</el-radio>
            <el-radio label="yaml">YAML</el-radio>
            <el-radio label="zip">ZIP压缩包</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="敏感信息处理">
          <el-radio-group v-model="exportForm.sensitiveData">
            <el-radio label="exclude">排除敏感信息</el-radio>
            <el-radio label="encrypt">加密敏感信息</el-radio>
            <el-radio label="include">包含所有信息</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="加密密码" v-if="exportForm.sensitiveData === 'encrypt'">
          <el-input
            v-model="exportForm.password"
            type="password"
            placeholder="请输入加密密码"
            show-password
          />
        </el-form-item>

        <el-form-item label="备注信息">
          <el-input
            v-model="exportForm.notes"
            type="textarea"
            placeholder="可选的备注信息"
            :rows="3"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="exportDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          @click="executeExport"
          :loading="configStore.loading"
          :disabled="exportForm.types.length === 0"
        >
          导出配置
        </el-button>
      </template>
    </el-dialog>

    <!-- 导入配置对话框 -->
    <el-dialog
      v-model="importDialogVisible"
      title="导入配置"
      width="700px"
      :close-on-click-modal="false"
    >
      <div class="import-steps">
        <el-steps :active="importStep" align-center>
          <el-step title="选择文件" description="上传配置文件" />
          <el-step title="验证配置" description="检查配置有效性" />
          <el-step title="解决冲突" description="处理配置冲突" />
          <el-step title="应用配置" description="完成导入" />
        </el-steps>
      </div>

      <!-- 步骤1: 文件上传 -->
      <div v-if="importStep === 0" class="import-step">
        <el-upload
          ref="uploadRef"
          drag
          :auto-upload="false"
          :on-change="handleFileChange"
          :before-remove="handleFileRemove"
          accept=".json,.yaml,.yml,.zip"
          :limit="1"
        >
          <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
          <div class="el-upload__text">
            将配置文件拖拽到此处，或<em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              支持 JSON、YAML 和 ZIP 格式的配置文件
            </div>
          </template>
        </el-upload>

        <div v-if="importForm.file" class="file-info">
          <h4>文件信息</h4>
          <div class="file-details">
            <div class="detail-item">
              <span class="label">文件名:</span>
              <span class="value">{{ importForm.file.name }}</span>
            </div>
            <div class="detail-item">
              <span class="label">文件大小:</span>
              <span class="value">{{ formatFileSize(importForm.file.size) }}</span>
            </div>
            <div class="detail-item">
              <span class="label">文件类型:</span>
              <span class="value">{{ getFileType(importForm.file.name) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 步骤2: 配置验证 -->
      <div v-if="importStep === 1" class="import-step">
        <div class="validation-result" v-loading="configStore.loading">
          <div v-if="validationResult">
            <div class="validation-summary">
              <div class="summary-item" :class="validationResult.valid ? 'success' : 'error'">
                <el-icon><Check v-if="validationResult.valid" /><Close v-else /></el-icon>
                <span>配置验证{{ validationResult.valid ? '成功' : '失败' }}</span>
              </div>
            </div>

            <div class="validation-details">
              <el-collapse>
                <el-collapse-item title="配置内容概览" name="1">
                  <div class="config-overview">
                    <div
                      v-for="(count, type) in validationResult.configCounts"
                      :key="type"
                      class="config-count-item"
                    >
                      <span class="type">{{ getConfigLabel(type) }}:</span>
                      <span class="count">{{ count }} 项</span>
                    </div>
                  </div>
                </el-collapse-item>

                <el-collapse-item
                  v-if="validationResult.errors.length > 0"
                  title="验证错误"
                  name="2"
                >
                  <div class="validation-errors">
                    <div
                      v-for="error in validationResult.errors"
                      :key="error.id"
                      class="error-item"
                    >
                      <el-text type="danger">{{ error.message }}</el-text>
                      <div class="error-details">{{ error.details }}</div>
                    </div>
                  </div>
                </el-collapse-item>

                <el-collapse-item
                  v-if="validationResult.warnings.length > 0"
                  title="验证警告"
                  name="3"
                >
                  <div class="validation-warnings">
                    <div
                      v-for="warning in validationResult.warnings"
                      :key="warning.id"
                      class="warning-item"
                    >
                      <el-text type="warning">{{ warning.message }}</el-text>
                      <div class="warning-details">{{ warning.details }}</div>
                    </div>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </div>
          </div>
        </div>
      </div>

      <!-- 步骤3: 冲突解决 -->
      <div v-if="importStep === 2" class="import-step">
        <div v-if="conflicts.length > 0" class="conflicts-section">
          <h4>检测到配置冲突</h4>
          <p class="conflicts-description">
            以下配置项与现有配置存在冲突，请选择处理方式：
          </p>

          <div class="conflicts-list">
            <div
              v-for="conflict in conflicts"
              :key="conflict.id"
              class="conflict-item"
            >
              <div class="conflict-header">
                <div class="conflict-info">
                  <div class="conflict-title">{{ conflict.title }}</div>
                  <el-tag size="small" :type="getConflictType(conflict.type)">
                    {{ getConflictLabel(conflict.type) }}
                  </el-tag>
                </div>
                <el-radio-group v-model="conflict.resolution">
                  <el-radio label="keep">保留现有</el-radio>
                  <el-radio label="replace">替换为新</el-radio>
                  <el-radio label="merge">合并配置</el-radio>
                </el-radio-group>
              </div>

              <div class="conflict-details">
                <div class="conflict-comparison">
                  <div class="current-config">
                    <h5>当前配置</h5>
                    <pre>{{ JSON.stringify(conflict.current, null, 2) }}</pre>
                  </div>
                  <div class="new-config">
                    <h5>导入配置</h5>
                    <pre>{{ JSON.stringify(conflict.incoming, null, 2) }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="no-conflicts">
          <el-result icon="success" title="无配置冲突" sub-title="可以安全导入配置">
          </el-result>
        </div>
      </div>

      <!-- 步骤4: 应用配置 -->
      <div v-if="importStep === 3" class="import-step">
        <div class="import-progress" v-loading="importing">
          <div v-if="!importing && importResult">
            <el-result
              :icon="importResult.success ? 'success' : 'error'"
              :title="importResult.success ? '导入成功' : '导入失败'"
              :sub-title="importResult.message"
            >
              <template #extra>
                <div class="import-summary">
                  <div v-if="importResult.success" class="success-details">
                    <h4>导入概要</h4>
                    <div
                      v-for="(count, type) in importResult.appliedCounts"
                      :key="type"
                      class="applied-item"
                    >
                      <span>{{ getConfigLabel(type) }}: </span>
                      <span>{{ count }} 项已应用</span>
                    </div>
                  </div>
                  <div v-else class="error-details">
                    <h4>错误详情</h4>
                    <div class="error-message">{{ importResult.error }}</div>
                  </div>
                </div>
              </template>
            </el-result>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="cancelImport">取消</el-button>
          <el-button
            v-if="importStep > 0"
            @click="prevStep"
            :disabled="importing"
          >
            上一步
          </el-button>
          <el-button
            type="primary"
            @click="nextStep"
            :loading="configStore.loading || importing"
            :disabled="!canProceed"
          >
            {{ getNextStepText() }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 配置预览对话框 -->
    <el-dialog
      v-model="previewDialogVisible"
      :title="`${getConfigLabel(previewConfigType)} 配置预览`"
      width="800px"
    >
      <div class="config-preview">
        <div class="preview-toolbar">
          <el-radio-group v-model="previewFormat">
            <el-radio-button label="json">JSON</el-radio-button>
            <el-radio-button label="yaml">YAML</el-radio-button>
          </el-radio-group>
          <el-button size="small" @click="copyPreviewContent" :icon="CopyDocument">
            复制
          </el-button>
        </div>
        
        <div class="preview-content">
          <pre v-if="previewFormat === 'json'">{{ previewContent.json }}</pre>
          <pre v-else>{{ previewContent.yaml }}</pre>
        </div>
      </div>
    </el-dialog>

    <!-- 历史详情对话框 -->
    <el-dialog
      v-model="historyDetailsVisible"
      title="操作详情"
      width="600px"
    >
      <div v-if="selectedHistoryItem" class="history-details">
        <div class="detail-section">
          <h4>基本信息</h4>
          <div class="info-grid">
            <div class="info-item">
              <span class="label">操作类型:</span>
              <span class="value">{{ selectedHistoryItem.title }}</span>
            </div>
            <div class="info-item">
              <span class="label">执行时间:</span>
              <span class="value">{{ formatDateTime(selectedHistoryItem.timestamp) }}</span>
            </div>
            <div class="info-item">
              <span class="label">操作状态:</span>
              <span class="value" :class="selectedHistoryItem.success ? 'success' : 'error'">
                {{ selectedHistoryItem.success ? '成功' : '失败' }}
              </span>
            </div>
          </div>
        </div>

        <div class="detail-section" v-if="selectedHistoryItem.details">
          <h4>详细信息</h4>
          <pre>{{ JSON.stringify(selectedHistoryItem.details, null, 2) }}</pre>
        </div>
      </div>
    </el-dialog>

    <!-- 配置迁移向导对话框 -->
    <el-dialog
      v-model="migrationWizardVisible"
      title="配置迁移向导"
      width="90%"
      :before-close="handleMigrationWizardClose"
      :close-on-click-modal="false"
    >
      <ConfigMigrationWizard
        @completed="handleMigrationCompleted"
        @cancelled="handleMigrationCancelled"
      />
    </el-dialog>

    <!-- 冲突解决对话框 -->
    <el-dialog
      v-model="conflictResolverVisible"
      title="解决配置冲突"
      width="85%"
      :before-close="handleConflictResolverClose"
      :close-on-click-modal="false"
    >
      <ConflictResolver
        :conflicts="detectedConflicts"
        :model-value="conflictResolverVisible"
        @update:model-value="conflictResolverVisible = $event"
        @resolved="handleConflictsResolved"
        @cancelled="handleConflictResolutionCancelled"
      />
    </el-dialog>

      <el-tab-pane label="备份管理" name="backup">
        <BackupManager />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { 
  ElMessage, 
  ElMessageBox,
  type FormInstance,
  type UploadInstance,
  type UploadFile
} from 'element-plus'
import {
  Setting,
  Download,
  Upload,
  Refresh,
  View,
  Check,
  Close,
  UploadFilled,
  CopyDocument,
  Guide
} from '@element-plus/icons-vue'

// 引入stores
import { useAppStore } from '@/stores/app'
import { useConfigStore, type ConfigExportOptions, type ConfigValidationResult, type ConfigConflict, type ConfigConflictResolution } from '@/stores/config'

// 引入组件
import BackupManager from './components/BackupManager.vue'
import ConfigMigrationWizard from './components/ConfigMigrationWizard.vue'
import ConflictResolver from './components/ConflictResolver.vue'

// Types
interface ConfigItem {
  type: string
  count: number
  lastUpdated: Date
  size: number
  valid: boolean
}

interface OperationHistory {
  id: string
  type: 'export' | 'import' | 'migration' | 'conflict-resolution'
  title: string
  description: string
  timestamp: Date
  success: boolean
  details?: any
}

interface ExportForm {
  types: string[]
  format: 'json' | 'yaml' | 'zip'
  sensitiveData: 'exclude' | 'encrypt' | 'include'
  password: string
  notes: string
}

interface ImportForm {
  file: File | null
}

interface ValidationResult {
  valid: boolean
  configCounts: Record<string, number>
  errors: Array<{ id: string; message: string; details: string }>
  warnings: Array<{ id: string; message: string; details: string }>
}

interface ConflictItem {
  id: string
  type: string
  title: string
  current: any
  incoming: any
  resolution: 'keep' | 'replace' | 'merge'
}

interface ImportResult {
  success: boolean
  message: string
  appliedCounts?: Record<string, number>
  error?: string
}

// Store
const appStore = useAppStore()
const configStore = useConfigStore()

// Reactive data
const loading = ref(false)
const selectedConfigType = ref('')
const activeTab = ref('config')

// 对话框状态
const exportDialogVisible = ref(false)
const importDialogVisible = ref(false)
const previewDialogVisible = ref(false)
const historyDetailsVisible = ref(false)
const migrationWizardVisible = ref(false)
const conflictResolverVisible = ref(false)

// 表单数据
const exportFormRef = ref<FormInstance>()
const uploadRef = ref<UploadInstance>()
const exportForm = ref<ConfigExportOptions>({
  types: ['servers', 'auth', 'openapi', 'testcases', 'settings'],
  format: 'json',
  sensitiveData: 'exclude',
  password: '',
  notes: ''
})

const importForm = ref<ImportForm>({
  file: null
})

// 导入流程状态
const importStep = ref(0)
const importing = ref(false)
const validationResult = ref<ConfigValidationResult | null>(null)
const conflicts = ref<ConfigConflict[]>([])
const detectedConflicts = ref<ConfigConflict[]>([])
const importResult = ref<ImportResult | null>(null)

// 预览相关
const previewConfigType = ref('')
const previewFormat = ref<'json' | 'yaml'>('json')
const previewContent = ref({ json: '', yaml: '' })

// 历史记录
const operationHistory = ref<OperationHistory[]>([])
const selectedHistoryItem = ref<OperationHistory | null>(null)

// 模拟配置数据
const configItems = ref<ConfigItem[]>([
  {
    type: 'servers',
    count: 3,
    lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000),
    size: 2048,
    valid: true
  },
  {
    type: 'auth',
    count: 2,
    lastUpdated: new Date(Date.now() - 1 * 60 * 60 * 1000),
    size: 512,
    valid: true
  },
  {
    type: 'openapi',
    count: 5,
    lastUpdated: new Date(Date.now() - 30 * 60 * 1000),
    size: 15360,
    valid: true
  },
  {
    type: 'testcases',
    count: 12,
    lastUpdated: new Date(Date.now() - 10 * 60 * 1000),
    size: 8192,
    valid: true
  },
  {
    type: 'settings',
    count: 1,
    lastUpdated: new Date(Date.now() - 5 * 60 * 1000),
    size: 256,
    valid: true
  }
])

// Computed properties
const filteredConfigs = computed(() => {
  if (!selectedConfigType.value) return configItems.value
  return configItems.value.filter(config => config.type === selectedConfigType.value)
})

const canProceed = computed(() => {
  switch (importStep.value) {
    case 0:
      return importForm.value.file !== null
    case 1:
      return validationResult.value?.valid === true
    case 2:
      return true // 冲突解决步骤总是可以继续
    case 3:
      return false // 最后一步不需要继续按钮
    default:
      return false
  }
})

// Methods
const showExportDialog = () => {
  exportDialogVisible.value = true
}

const showImportDialog = () => {
  importStep.value = 0
  importForm.value.file = null
  validationResult.value = null
  conflicts.value = []
  importResult.value = null
  importDialogVisible.value = true
}

// 迁移向导相关方法
const showMigrationWizard = () => {
  migrationWizardVisible.value = true
}

const handleMigrationWizardClose = () => {
  migrationWizardVisible.value = false
}

const handleMigrationCompleted = (result: any) => {
  migrationWizardVisible.value = false
  ElMessage.success(`配置迁移完成: ${result.fromVersion} → ${result.toVersion}`)
  
  // 添加到操作历史
  operationHistory.value.unshift({
    id: Date.now().toString(),
    type: 'migration',
    title: '配置迁移',
    description: `从版本 ${result.fromVersion} 迁移到 ${result.toVersion}`,
    timestamp: new Date(),
    success: true,
    details: result.stats
  })
  
  // 刷新配置数据
  refreshData()
}

const handleMigrationCancelled = () => {
  migrationWizardVisible.value = false
}

// 冲突解决相关方法
const handleConflictResolverClose = () => {
  conflictResolverVisible.value = false
}

const handleConflictsResolved = (resolutions: ConfigConflictResolution[]) => {
  conflictResolverVisible.value = false
  
  ElMessage.success(`已解决 ${resolutions.length} 个配置冲突`)
  
  // 清空冲突数据
  detectedConflicts.value = []
  
  // 添加到操作历史
  operationHistory.value.unshift({
    id: Date.now().toString(),
    type: 'conflict-resolution',
    title: '冲突解决',
    description: `解决了 ${resolutions.length} 个配置冲突`,
    timestamp: new Date(),
    success: true,
    details: { resolutions }
  })
  
  // 刷新配置数据
  refreshData()
}

const handleConflictResolutionCancelled = () => {
  conflictResolverVisible.value = false
}

const refreshData = async () => {
  loading.value = true
  try {
    // 模拟数据刷新
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 更新配置项的时间戳
    configItems.value.forEach(config => {
      config.lastUpdated = new Date(Date.now() - Math.random() * 60 * 60 * 1000)
    })
    
    ElMessage.success('数据刷新成功')
  } catch (error) {
    ElMessage.error('数据刷新失败')
  } finally {
    loading.value = false
  }
}

const getConfigIcon = (type: string): string => {
  const icons: Record<string, string> = {
    servers: 'el-icon-server',
    auth: 'el-icon-lock',
    openapi: 'el-icon-document',
    testcases: 'el-icon-data-analysis',
    settings: 'el-icon-setting'
  }
  return icons[type] || 'el-icon-files'
}

const getConfigLabel = (type: string): string => {
  const labels: Record<string, string> = {
    servers: '服务器配置',
    auth: '认证配置',
    openapi: 'OpenAPI规范',
    testcases: '测试用例',
    settings: '系统设置'
  }
  return labels[type] || type
}

const getConfigStatus = (config: ConfigItem): string => {
  if (!config.valid) return 'danger'
  if (config.count === 0) return 'info'
  return 'success'
}

const formatDateTime = (date: Date): string => {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(date))
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const previewConfig = async (type: string) => {
  previewConfigType.value = type
  
  // 模拟获取配置数据
  const mockConfig = generateMockConfig(type)
  previewContent.value = {
    json: JSON.stringify(mockConfig, null, 2),
    yaml: convertToYaml(mockConfig)
  }
  
  previewDialogVisible.value = true
}

const exportSingleConfig = async (type: string) => {
  try {
    const config = generateMockConfig(type)
    const filename = `${type}-config-${Date.now()}.json`
    downloadFile(JSON.stringify(config, null, 2), filename, 'application/json')
    
    addOperationHistory('export', `导出${getConfigLabel(type)}`, `已导出 ${filename}`, true, { type, filename })
    ElMessage.success('配置导出成功')
  } catch (error) {
    ElMessage.error('配置导出失败')
  }
}

const executeExport = async () => {
  if (exportForm.value.types.length === 0) {
    ElMessage.warning('请选择要导出的配置类型')
    return
  }
  
  const success = await configStore.exportConfig(exportForm.value)
  
  if (success) {
    addOperationHistory(
      'export',
      '导出配置',
      `已导出 ${exportForm.value.types.length} 种配置类型`,
      true,
      { types: exportForm.value.types, format: exportForm.value.format }
    )
    exportDialogVisible.value = false
  }
}

const handleFileChange = (file: UploadFile) => {
  importForm.value.file = file.raw || null
}

const handleFileRemove = () => {
  importForm.value.file = null
  return true
}

const nextStep = async () => {
  switch (importStep.value) {
    case 0:
      if (importForm.value.file) {
        importStep.value = 1
        await validateConfig()
      }
      break
    case 1:
      if (validationResult.value?.valid) {
        importStep.value = 2
        await detectConflicts()
      }
      break
    case 2:
      importStep.value = 3
      await applyConfig()
      break
  }
}

const prevStep = () => {
  if (importStep.value > 0) {
    importStep.value--
  }
}

const validateConfig = async () => {
  if (!importForm.value.file) return
  
  validationResult.value = await configStore.validateImportConfig(importForm.value.file)
}

const detectConflicts = async () => {
  if (!importForm.value.file) return
  
  try {
    const fileContent = await readFileContent(importForm.value.file)
    const parsedConfig = parseConfigFile(fileContent, importForm.value.file.name)
    conflicts.value = await configStore.detectConflicts(parsedConfig)
  } catch (error) {
    console.error('冲突检测失败:', error)
    ElMessage.error('冲突检测失败')
  }
}

const applyConfig = async () => {
  importing.value = true
  try {
    if (!importForm.value.file) {
      throw new Error('没有选择文件')
    }
    
    const fileContent = await readFileContent(importForm.value.file)
    const parsedConfig = parseConfigFile(fileContent, importForm.value.file.name)
    
    const result = await configStore.applyImportConfig(parsedConfig, conflicts.value)
    
    if (result.success) {
      importResult.value = result
      
      addOperationHistory(
        'import',
        '导入配置',
        `成功导入 ${importForm.value.file.name}`,
        true,
        { filename: importForm.value.file.name, conflicts: conflicts.value.length }
      )
    } else {
      importResult.value = {
        success: false,
        message: result.message,
        error: result.errors?.[0] || '导入失败'
      }
    }
  } catch (error) {
    importResult.value = {
      success: false,
      message: '配置导入失败',
      error: error instanceof Error ? error.message : '未知错误'
    }
    
    addOperationHistory(
      'import',
      '导入配置',
      `导入失败: ${importForm.value.file?.name}`,
      false,
      { filename: importForm.value.file?.name, error: error instanceof Error ? error.message : '未知错误' }
    )
    
    ElMessage.error('配置导入失败')
  } finally {
    importing.value = false
  }
}

const cancelImport = () => {
  importDialogVisible.value = false
  importStep.value = 0
  importForm.value.file = null
}

const getNextStepText = (): string => {
  switch (importStep.value) {
    case 0: return '验证配置'
    case 1: return '检查冲突'
    case 2: return '应用配置'
    case 3: return '完成'
    default: return '下一步'
  }
}

const getFileType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase()
  const types: Record<string, string> = {
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    zip: 'ZIP压缩包'
  }
  return types[ext || ''] || '未知类型'
}

const getConflictType = (type: string): string => {
  const types: Record<string, string> = {
    server: 'warning',
    auth: 'danger',
    setting: 'info'
  }
  return types[type] || 'info'
}

const getConflictLabel = (type: string): string => {
  const labels: Record<string, string> = {
    server: '服务器冲突',
    auth: '认证冲突',
    setting: '设置冲突'
  }
  return labels[type] || type
}

const getHistoryType = (type: string): string => {
  const types: Record<string, string> = {
    export: 'primary',
    import: 'success'
  }
  return types[type] || 'info'
}

const copyPreviewContent = async () => {
  try {
    const content = previewFormat.value === 'json' 
      ? previewContent.value.json 
      : previewContent.value.yaml
    await navigator.clipboard.writeText(content)
    ElMessage.success('内容已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

const clearHistory = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有操作历史吗？', '确认操作', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    operationHistory.value = []
    ElMessage.success('操作历史已清空')
  } catch (error) {
    // 用户取消操作
  }
}

const showHistoryDetails = (item: OperationHistory) => {
  selectedHistoryItem.value = item
  historyDetailsVisible.value = true
}

// Helper functions
const generateMockConfig = (type: string): any => {
  const configs: Record<string, any> = {
    servers: [
      { id: '1', name: 'API Server', port: 3000, status: 'running' },
      { id: '2', name: 'Test Server', port: 3001, status: 'stopped' }
    ],
    auth: [
      { id: '1', type: 'bearer', name: 'API Token' },
      { id: '2', type: 'basic', name: 'Basic Auth' }
    ],
    openapi: [
      { id: '1', name: 'User API', version: '1.0.0' },
      { id: '2', name: 'Product API', version: '2.0.0' }
    ],
    testcases: [
      { id: '1', name: 'Login Test', type: 'auth' },
      { id: '2', name: 'CRUD Test', type: 'api' }
    ],
    settings: {
      theme: 'light',
      language: 'zh-CN',
      notifications: true
    }
  }
  return configs[type] || {}
}

const convertToYaml = (obj: any): string => {
  // 简单的JSON到YAML转换（实际项目中应使用专门的库）
  return JSON.stringify(obj, null, 2)
    .replace(/"/g, '')
    .replace(/,$/gm, '')
    .replace(/^\s*{\s*$/gm, '')
    .replace(/^\s*}\s*$/gm, '')
    .replace(/^\s*\[\s*$/gm, '')
    .replace(/^\s*\]\s*$/gm, '')
}

const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const readFileContent = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = (e) => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}

const parseConfigFile = (content: string, filename: string): any => {
  const ext = filename.split('.').pop()?.toLowerCase()
  
  if (ext === 'json') {
    return JSON.parse(content)
  } else if (ext === 'yaml' || ext === 'yml') {
    // 实际项目中应使用yaml解析库
    return JSON.parse(content) // 临时实现
  } else {
    throw new Error('不支持的文件格式')
  }
}

const removeSensitiveData = (data: any) => {
  // 递归移除敏感数据
  const sensitiveKeys = ['password', 'token', 'secret', 'key']
  
  const removeSensitive = (obj: any): void => {
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          obj[key] = '[REMOVED]'
        } else if (typeof obj[key] === 'object') {
          removeSensitive(obj[key])
        }
      }
    }
  }
  
  removeSensitive(data)
}

const encryptSensitiveData = (data: any, password: string) => {
  // 简单的加密实现（实际项目中应使用更安全的加密方法）
  const encrypt = (text: string): string => {
    return btoa(text + password) // 简单的base64编码
  }
  
  const sensitiveKeys = ['password', 'token', 'secret', 'key']
  
  const encryptSensitive = (obj: any): void => {
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          if (typeof obj[key] === 'string') {
            obj[key] = `[ENCRYPTED]${encrypt(obj[key])}`
          }
        } else if (typeof obj[key] === 'object') {
          encryptSensitive(obj[key])
        }
      }
    }
  }
  
  encryptSensitive(data)
}

const createZipFile = async (data: any): Promise<string> => {
  // 模拟ZIP文件创建（实际项目中应使用JSZip等库）
  return JSON.stringify(data, null, 2)
}

const addOperationHistory = (
  type: 'export' | 'import',
  title: string,
  description: string,
  success: boolean,
  details?: any
) => {
  const item: OperationHistory = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    title,
    description,
    timestamp: new Date(),
    success,
    details
  }
  
  operationHistory.value.unshift(item)
  
  // 限制历史记录数量
  if (operationHistory.value.length > 50) {
    operationHistory.value = operationHistory.value.slice(0, 50)
  }
}

// 生命周期
onMounted(async () => {
  await refreshData()
})
</script>

<style scoped>
.config-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
  background-color: var(--el-bg-color-page);
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.header-content h1 {
  margin: 0 0 8px 0;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 24px;
  font-weight: 600;
}

.header-description {
  margin: 0;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 18px;
  font-weight: 600;
}

.config-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.config-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.3s ease;
}

.config-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.config-info {
  flex: 1;
}

.config-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-actions {
  display: flex;
  gap: 8px;
}

.config-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.detail-item .label {
  color: var(--el-text-color-secondary);
}

.detail-item .value {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.detail-item .value.valid {
  color: var(--el-color-success);
}

.detail-item .value.invalid {
  color: var(--el-color-danger);
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 40px;
}

.history-section {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 16px;
  height: fit-content;
}

.history-timeline {
  max-height: 400px;
  overflow-y: auto;
}

.history-content {
  margin-left: 12px;
}

.history-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.history-description {
  color: var(--el-text-color-regular);
  font-size: 12px;
  margin-bottom: 4px;
}

.history-details {
  margin-top: 8px;
}

.empty-history {
  text-align: center;
  padding: 20px;
}

.import-steps {
  margin-bottom: 20px;
}

.import-step {
  min-height: 200px;
}

.file-info {
  margin-top: 20px;
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
}

.file-info h4 {
  margin: 0 0 12px 0;
  color: var(--el-text-color-primary);
}

.file-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.validation-result {
  min-height: 150px;
}

.validation-summary {
  margin-bottom: 16px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}

.summary-item.success {
  color: var(--el-color-success);
}

.summary-item.error {
  color: var(--el-color-danger);
}

.config-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.config-count-item {
  display: flex;
  justify-content: space-between;
  padding: 8px;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
}

.validation-errors, .validation-warnings {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.error-item, .warning-item {
  padding: 8px;
  border-radius: 4px;
  border-left: 3px solid;
}

.error-item {
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger);
}

.warning-item {
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning);
}

.error-details, .warning-details {
  font-size: 12px;
  margin-top: 4px;
  opacity: 0.8;
}

.conflicts-section {
  padding: 16px;
}

.conflicts-description {
  margin-bottom: 16px;
  color: var(--el-text-color-regular);
}

.conflicts-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.conflict-item {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
}

.conflict-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.conflict-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.conflict-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.current-config, .new-config {
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
}

.current-config h5, .new-config h5 {
  margin: 0 0 8px 0;
  color: var(--el-text-color-primary);
}

.current-config pre, .new-config pre {
  margin: 0;
  font-size: 12px;
  background: transparent;
  white-space: pre-wrap;
}

.no-conflicts {
  text-align: center;
  padding: 40px;
}

.import-progress {
  min-height: 200px;
}

.import-summary {
  text-align: left;
  margin-top: 16px;
}

.success-details h4, .error-details h4 {
  margin: 0 0 12px 0;
  color: var(--el-text-color-primary);
}

.applied-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.error-message {
  padding: 12px;
  background: var(--el-color-danger-light-9);
  border-radius: 4px;
  color: var(--el-color-danger);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.config-preview {
  height: 500px;
  display: flex;
  flex-direction: column;
}

.preview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.preview-content {
  flex: 1;
  overflow: auto;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
  padding: 12px;
}

.preview-content pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.history-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-section h4 {
  margin: 0 0 12px 0;
  color: var(--el-text-color-primary);
  font-size: 16px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item .label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.info-item .value {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.info-item .value.success {
  color: var(--el-color-success);
}

.info-item .value.error {
  color: var(--el-color-danger);
}

.detail-section pre {
  background: var(--el-fill-color-lighter);
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  overflow: auto;
  max-height: 300px;
}
</style>