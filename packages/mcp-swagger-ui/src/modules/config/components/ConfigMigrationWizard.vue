<template>
  <div class="migration-wizard">
    <!-- 向导步骤指示器 -->
    <div class="wizard-steps">
      <el-steps :active="currentStep" finish-status="success" align-center>
        <el-step title="检测版本" icon="Search" />
        <el-step title="选择迁移路径" icon="Guide" />
        <el-step title="预览更改" icon="View" />
        <el-step title="执行迁移" icon="Upload" />
        <el-step title="完成" icon="Check" />
      </el-steps>
    </div>

    <div class="wizard-content">
      <!-- 步骤 1: 版本检测 -->
      <div v-if="currentStep === 0" class="step-content">
        <div class="step-header">
          <h3>配置版本检测</h3>
          <p>分析当前配置版本并检查可用的迁移路径</p>
        </div>

        <div class="detection-section">
          <div class="current-version-card">
            <el-card shadow="never">
              <template #header>
                <div class="card-header">
                  <span>当前版本信息</span>
                  <el-button size="small" @click="detectVersion" :loading="detecting">
                    重新检测
                  </el-button>
                </div>
              </template>
              
              <div v-if="currentVersionInfo" class="version-info">
                <div class="info-row">
                  <span class="label">版本号:</span>
                  <el-tag :type="getVersionTypeColor(currentVersionInfo.version)" size="large">
                    {{ currentVersionInfo.version }}
                  </el-tag>
                </div>
                <div class="info-row">
                  <span class="label">格式:</span>
                  <span class="value">{{ currentVersionInfo.format }}</span>
                </div>
                <div class="info-row">
                  <span class="label">特性:</span>
                  <div class="features">
                    <el-tag
                      v-for="feature in currentVersionInfo.features"
                      :key="feature"
                      size="small"
                      class="feature-tag"
                    >
                      {{ feature }}
                    </el-tag>
                  </div>
                </div>
                <div class="info-row">
                  <span class="label">兼容性:</span>
                  <div class="compatibility">
                    <el-tag
                      :type="currentVersionInfo.deprecated ? 'danger' : 'success'"
                      size="small"
                    >
                      {{ currentVersionInfo.deprecated ? '已弃用' : '支持中' }}
                    </el-tag>
                  </div>
                </div>
              </div>
              
              <div v-else class="no-version">
                <el-empty description="未检测到版本信息" />
              </div>
            </el-card>
          </div>

          <div class="available-versions">
            <h4>可用迁移版本</h4>
            <div class="versions-grid">
              <div
                v-for="version in availableVersions"
                :key="version.version"
                class="version-card"
                :class="{ 
                  'recommended': version.recommended,
                  'selected': selectedTargetVersion === version.version 
                }"
                @click="selectTargetVersion(version.version)"
              >
                <div class="version-header">
                  <div class="version-title">
                    <span class="version-number">{{ version.version }}</span>
                    <el-tag v-if="version.recommended" type="success" size="small">
                      推荐
                    </el-tag>
                  </div>
                  <div class="version-status">
                    <el-icon v-if="selectedTargetVersion === version.version" color="var(--el-color-primary)">
                      <Check />
                    </el-icon>
                  </div>
                </div>
                
                <div class="version-description">
                  {{ version.description }}
                </div>
                
                <div class="version-features">
                  <div class="new-features">
                    <span class="features-label">新特性:</span>
                    <ul class="features-list">
                      <li v-for="feature in version.newFeatures" :key="feature">
                        {{ feature }}
                      </li>
                    </ul>
                  </div>
                  
                  <div v-if="version.breakingChanges && version.breakingChanges.length > 0" class="breaking-changes">
                    <span class="features-label">重大变更:</span>
                    <ul class="features-list warning">
                      <li v-for="change in version.breakingChanges" :key="change">
                        {{ change }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 步骤 2: 迁移路径选择 -->
      <div v-if="currentStep === 1" class="step-content">
        <div class="step-header">
          <h3>选择迁移路径</h3>
          <p>规划从 {{ currentVersionInfo?.version }} 到 {{ selectedTargetVersion }} 的迁移步骤</p>
        </div>

        <div class="migration-path-section">
          <div class="path-overview">
            <el-card shadow="never">
              <template #header>
                <span>迁移路径概览</span>
              </template>
              
              <div class="path-flow">
                <div class="path-node current">
                  <div class="node-content">
                    <div class="node-version">{{ currentVersionInfo?.version }}</div>
                    <div class="node-label">当前版本</div>
                  </div>
                </div>
                
                <div
                  v-for="(step, index) in migrationSteps"
                  :key="step.id"
                  class="path-arrow-and-node"
                >
                  <div class="path-arrow">
                    <el-icon><ArrowRight /></el-icon>
                  </div>
                  <div class="path-node step">
                    <div class="node-content">
                      <div class="node-version">{{ step.targetVersion }}</div>
                      <div class="node-label">步骤 {{ index + 1 }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </el-card>
          </div>

          <div class="steps-details">
            <h4>迁移步骤详情</h4>
            <div class="steps-list">
              <div
                v-for="(step, index) in migrationSteps"
                :key="step.id"
                class="step-item"
              >
                <div class="step-header">
                  <div class="step-title">
                    <span class="step-number">{{ index + 1 }}</span>
                    <span class="step-name">{{ step.title }}</span>
                    <el-tag :type="getStepTypeColor(step.type || 'config')" size="small">
                      {{ getStepTypeLabel(step.type || 'config') }}
                    </el-tag>
                  </div>
                  <div class="step-duration">
                    <el-icon><Clock /></el-icon>
                    <span>预计 {{ step.estimatedDuration }}</span>
                  </div>
                </div>
                
                <div class="step-description">
                  {{ step.description }}
                </div>
                
                <div v-if="step.actions && step.actions.length > 0" class="step-actions">
                  <div class="actions-label">将执行的操作:</div>
                  <ul class="actions-list">
                    <li
                      v-for="action in step.actions"
                      :key="action.id"
                      class="action-item"
                    >
                      <el-icon :color="getActionIconColor(action.type)">
                        <component :is="getActionIcon(action.type)" />
                      </el-icon>
                      <span>{{ action.description }}</span>
                    </li>
                  </ul>
                </div>
                
                <div v-if="step.risks && step.risks.length > 0" class="step-risks">
                  <el-alert
                    title="注意事项"
                    type="warning"
                    :closable="false"
                    show-icon
                  >
                    <ul class="risks-list">
                      <li v-for="risk in step.risks" :key="risk">
                        {{ risk }}
                      </li>
                    </ul>
                  </el-alert>
                </div>
              </div>
            </div>
          </div>

          <div class="migration-options">
            <el-card shadow="never">
              <template #header>
                <span>迁移选项</span>
              </template>
              
              <div class="options-form">
                <el-form :model="migrationOptions" label-width="120px">
                  <el-form-item label="备份策略">
                    <el-radio-group v-model="migrationOptions.backupStrategy">
                      <el-radio label="full">完整备份</el-radio>
                      <el-radio label="incremental">增量备份</el-radio>
                      <el-radio label="none">不备份</el-radio>
                    </el-radio-group>
                  </el-form-item>
                  
                  <el-form-item label="失败处理">
                    <el-radio-group v-model="migrationOptions.failureHandling">
                      <el-radio label="rollback">自动回滚</el-radio>
                      <el-radio label="stop">停止执行</el-radio>
                      <el-radio label="continue">继续执行</el-radio>
                    </el-radio-group>
                  </el-form-item>
                  
                  <el-form-item label="验证级别">
                    <el-select v-model="migrationOptions.validationLevel">
                      <el-option label="严格验证" value="strict" />
                      <el-option label="标准验证" value="standard" />
                      <el-option label="宽松验证" value="loose" />
                    </el-select>
                  </el-form-item>
                  
                  <el-form-item label="并行执行">
                    <el-switch
                      v-model="migrationOptions.parallelExecution"
                      active-text="启用"
                      inactive-text="禁用"
                    />
                  </el-form-item>
                </el-form>
              </div>
            </el-card>
          </div>
        </div>
      </div>

      <!-- 步骤 3: 预览更改 -->
      <div v-if="currentStep === 2" class="step-content">
        <div class="step-header">
          <h3>预览迁移更改</h3>
          <p>查看迁移过程中将进行的所有更改</p>
        </div>

        <div class="preview-section">
          <el-tabs v-model="previewTab" type="border-card">
            <el-tab-pane label="配置对比" name="diff">
              <div class="config-diff">
                <div class="diff-header">
                  <div class="diff-section">
                    <h5>迁移前配置</h5>
                    <el-tag type="info" size="small">{{ currentVersionInfo?.version }}</el-tag>
                  </div>
                  <div class="diff-section">
                    <h5>迁移后配置</h5>
                    <el-tag type="success" size="small">{{ selectedTargetVersion }}</el-tag>
                  </div>
                </div>
                
                <div class="diff-content">
                  <div class="config-before">
                    <JsonViewer 
                      :data="previewData.before"
                      :expanded="2"
                      :show-copy="false"
                    />
                  </div>
                  <div class="config-after">
                    <JsonViewer 
                      :data="previewData.after"
                      :expanded="2"
                      :show-copy="false"
                    />
                  </div>
                </div>
              </div>
            </el-tab-pane>
            
            <el-tab-pane label="变更清单" name="changes">
              <div class="changes-list">
                <div
                  v-for="change in previewData.changes"
                  :key="change.id"
                  class="change-item"
                >
                  <div class="change-header">
                    <div class="change-type">
                      <el-icon :color="getChangeIconColor(change.type)">
                        <component :is="getChangeIcon(change.type)" />
                      </el-icon>
                      <span class="change-operation">{{ getChangeTypeText(change.type) }}</span>
                    </div>
                    <div class="change-path">{{ change.path }}</div>
                  </div>
                  
                  <div class="change-description">
                    {{ change.description }}
                  </div>
                  
                  <div v-if="change.oldValue || change.newValue" class="change-values">
                    <div v-if="change.oldValue" class="old-value">
                      <span class="value-label">原值:</span>
                      <code>{{ JSON.stringify(change.oldValue) }}</code>
                    </div>
                    <div v-if="change.newValue" class="new-value">
                      <span class="value-label">新值:</span>
                      <code>{{ JSON.stringify(change.newValue) }}</code>
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>
            
            <el-tab-pane label="风险评估" name="risks">
              <div class="risks-assessment">
                <div class="risk-summary">
                  <el-card shadow="never">
                    <div class="summary-stats">
                      <div class="stat-item">
                        <div class="stat-value high-risk">{{ riskSummary.high }}</div>
                        <div class="stat-label">高风险</div>
                      </div>
                      <div class="stat-item">
                        <div class="stat-value medium-risk">{{ riskSummary.medium }}</div>
                        <div class="stat-label">中风险</div>
                      </div>
                      <div class="stat-item">
                        <div class="stat-value low-risk">{{ riskSummary.low }}</div>
                        <div class="stat-label">低风险</div>
                      </div>
                    </div>
                  </el-card>
                </div>
                
                <div class="risks-list">
                  <div
                    v-for="risk in previewData.risks"
                    :key="risk.id"
                    class="risk-item"
                  >
                    <el-alert
                      :title="risk.title"
                      :type="getRiskAlertType(risk.level)"
                      :description="risk.description"
                      show-icon
                      :closable="false"
                    >
                      <template v-if="risk.mitigation" #default>
                        <div class="risk-mitigation">
                          <strong>缓解措施:</strong> {{ risk.mitigation }}
                        </div>
                      </template>
                    </el-alert>
                  </div>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>

      <!-- 步骤 4: 执行迁移 -->
      <div v-if="currentStep === 3" class="step-content">
        <div class="step-header">
          <h3>执行迁移</h3>
          <p>正在执行配置迁移，请耐心等待...</p>
        </div>

        <div class="execution-section">
          <div class="execution-progress">
            <el-card shadow="never">
              <template #header>
                <div class="progress-header">
                  <span>迁移进度</span>
                  <span class="progress-text">
                    {{ executionProgress.current }} / {{ executionProgress.total }}
                  </span>
                </div>
              </template>
              
              <div class="progress-content">
                <el-progress
                  :percentage="executionProgress.percentage"
                  :status="executionProgress.status"
                  :stroke-width="8"
                />
                
                <div class="current-step">
                  <div class="step-info">
                    <strong>当前步骤:</strong> {{ executionProgress.currentStepTitle }}
                  </div>
                  <div class="step-description">
                    {{ executionProgress.currentStepDescription }}
                  </div>
                </div>
              </div>
            </el-card>
          </div>

          <div class="execution-log">
            <el-card shadow="never">
              <template #header>
                <div class="log-header">
                  <span>执行日志</span>
                  <el-button size="small" @click="clearLog">清空</el-button>
                </div>
              </template>
              
              <div class="log-content" ref="logContainer">
                <div
                  v-for="(log, index) in executionLogs"
                  :key="index"
                  class="log-entry"
                  :class="log.level"
                >
                  <span class="log-time">{{ formatTime(log.timestamp) }}</span>
                  <span class="log-level">{{ log.level.toUpperCase() }}</span>
                  <span class="log-message">{{ log.message }}</span>
                </div>
              </div>
            </el-card>
          </div>
        </div>
      </div>

      <!-- 步骤 5: 完成 -->
      <div v-if="currentStep === 4" class="step-content">
        <div class="step-header">
          <h3>迁移完成</h3>
          <p>配置迁移已成功完成</p>
        </div>

        <div class="completion-section">
          <div class="completion-status">
            <el-result
              icon="success"
              title="迁移成功"
              :sub-title="`配置已从 ${currentVersionInfo?.version} 成功迁移到 ${selectedTargetVersion}`"
            >
              <template #extra>
                <div class="completion-stats">
                  <div class="stat-item">
                    <div class="stat-value">{{ completionStats.processedFiles }}</div>
                    <div class="stat-label">处理文件</div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-value">{{ completionStats.appliedChanges }}</div>
                    <div class="stat-label">应用更改</div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-value">{{ completionStats.duration }}</div>
                    <div class="stat-label">耗时</div>
                  </div>
                </div>
              </template>
            </el-result>
          </div>

          <div class="post-migration-actions">
            <el-card shadow="never">
              <template #header>
                <span>后续操作</span>
              </template>
              
              <div class="actions-list">
                <div class="action-item">
                  <el-button type="primary" @click="validateMigration">
                    验证迁移结果
                  </el-button>
                  <span class="action-description">检查迁移后的配置是否正确</span>
                </div>
                
                <div class="action-item">
                  <el-button @click="exportMigrationReport">
                    导出迁移报告
                  </el-button>
                  <span class="action-description">生成详细的迁移报告</span>
                </div>
                
                <div class="action-item">
                  <el-button @click="restartServices">
                    重启相关服务
                  </el-button>
                  <span class="action-description">应用新配置并重启服务</span>
                </div>
              </div>
            </el-card>
          </div>
        </div>
      </div>
    </div>

    <!-- 向导控制按钮 -->
    <div class="wizard-controls">
      <div class="controls-left">
        <el-button v-if="currentStep > 0" @click="previousStep">
          上一步
        </el-button>
      </div>
      
      <div class="controls-right">
        <el-button @click="cancelMigration">取消</el-button>
        
        <el-button
          v-if="currentStep < 4"
          type="primary"
          @click="nextStep"
          :disabled="!canProceedToNext"
          :loading="processing"
        >
          {{ getNextButtonText() }}
        </el-button>
        
        <el-button
          v-else
          type="success"
          @click="finishMigration"
        >
          完成
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Search, Guide, View, Upload, Check, ArrowRight, Clock,
  Setting, Plus, Edit, Delete, Warning, InfoFilled
} from '@element-plus/icons-vue'
import { useConfigStore } from '@/stores/config'
import type { 
  ConfigVersionInfo, 
  ConfigMigrationStep,
  ConfigMigrationOptions 
} from '@/stores/config'

// 引入组件
import JsonViewer from '@/shared/components/ui/JsonViewer.vue'

interface MigrationChange {
  id: string
  type: 'add' | 'modify' | 'remove' | 'rename'
  path: string
  description: string
  oldValue?: any
  newValue?: any
}

interface MigrationRisk {
  id: string
  level: 'low' | 'medium' | 'high'
  title: string
  description: string
  mitigation?: string
}

interface PreviewData {
  before: any
  after: any
  changes: MigrationChange[]
  risks: MigrationRisk[]
}

interface ExecutionLog {
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
}

interface ExecutionProgress {
  current: number
  total: number
  percentage: number
  status: 'normal' | 'exception' | 'success'
  currentStepTitle: string
  currentStepDescription: string
}

interface CompletionStats {
  processedFiles: number
  appliedChanges: number
  duration: string
}

interface Emits {
  (e: 'completed', result: any): void
  (e: 'cancelled'): void
}

const emit = defineEmits<Emits>()

// Store
const configStore = useConfigStore()

// 状态
const currentStep = ref(0)
const detecting = ref(false)
const processing = ref(false)
const previewTab = ref('diff')

// 版本信息
const currentVersionInfo = ref<ConfigVersionInfo | null>(null)
const availableVersions = ref<ConfigVersionInfo[]>([])
const selectedTargetVersion = ref('')

// 迁移信息
const migrationSteps = ref<ConfigMigrationStep[]>([])
const migrationOptions = ref<ConfigMigrationOptions>({
  backupStrategy: 'full',
  failureHandling: 'rollback',
  validationLevel: 'standard',
  parallelExecution: false
})

// 预览数据
const previewData = ref<PreviewData>({
  before: {},
  after: {},
  changes: [],
  risks: []
})

// 执行状态
const executionProgress = ref<ExecutionProgress>({
  current: 0,
  total: 0,
  percentage: 0,
  status: 'normal',
  currentStepTitle: '',
  currentStepDescription: ''
})

const executionLogs = ref<ExecutionLog[]>([])
const logContainer = ref<HTMLElement>()

// 完成统计
const completionStats = ref<CompletionStats>({
  processedFiles: 0,
  appliedChanges: 0,
  duration: '0s'
})

// 计算属性
const canProceedToNext = computed(() => {
  switch (currentStep.value) {
    case 0:
      return currentVersionInfo.value && selectedTargetVersion.value
    case 1:
      return migrationSteps.value.length > 0
    case 2:
      return true
    case 3:
      return executionProgress.value.status === 'success'
    default:
      return false
  }
})

const riskSummary = computed(() => {
  const risks = previewData.value.risks
  return {
    high: risks.filter(r => r.level === 'high').length,
    medium: risks.filter(r => r.level === 'medium').length,
    low: risks.filter(r => r.level === 'low').length
  }
})

// 方法
const detectVersion = async () => {
  detecting.value = true
  
  try {
    // 模拟检测当前版本
    currentVersionInfo.value = {
      version: '1.0.0',
      format: 'JSON',
      compatibleVersions: ['1.0.0', '1.1.0'],
      description: '当前版本',
      features: ['基础功能', '配置管理'],
      deprecated: false
    }
    
    // 模拟获取可用版本
    availableVersions.value = [
      {
        version: '1.1.0',
        format: 'JSON',
        compatibleVersions: ['1.0.0', '1.1.0', '1.2.0'],
        description: '增强版本',
        features: ['批量操作', '配置模板'],
        newFeatures: ['批量操作', '配置模板'],
        deprecated: false,
        recommended: true,
        breakingChanges: []
      },
      {
        version: '2.0.0',
        format: 'JSON',
        compatibleVersions: ['1.2.0', '2.0.0', '2.1.0'],
        description: '重大更新版本',
        features: ['新架构', 'WebSocket支持'],
        newFeatures: ['新架构', 'WebSocket支持'],
        deprecated: false,
        recommended: false,
        breakingChanges: ['API架构变更', '配置格式更新']
      }
    ]
    
    // 自动选择推荐版本
    const recommended = availableVersions.value.find(v => v.recommended)
    if (recommended) {
      selectedTargetVersion.value = recommended.version
    }
    
    ElMessage.success('版本检测完成')
  } catch (error) {
    ElMessage.error('版本检测失败: ' + (error instanceof Error ? error.message : '未知错误'))
  } finally {
    detecting.value = false
  }
}

const selectTargetVersion = (version: string) => {
  selectedTargetVersion.value = version
}

const nextStep = async () => {
  processing.value = true
  
  try {
    switch (currentStep.value) {
      case 0:
        await planMigration()
        break
      case 1:
        await generatePreview()
        break
      case 2:
        await executeMigration()
        break
      case 3:
        // 执行完成，等待用户操作
        break
    }
    
    currentStep.value++
  } catch (error) {
    ElMessage.error('操作失败: ' + (error instanceof Error ? error.message : '未知错误'))
  } finally {
    processing.value = false
  }
}

const previousStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

const planMigration = async () => {
  if (!currentVersionInfo.value || !selectedTargetVersion.value) {
    throw new Error('缺少版本信息')
  }
  
  // 模拟生成迁移步骤
  migrationSteps.value = [
    {
      id: '1',
      name: '更新配置架构',
      title: '更新配置架构',
      description: '将配置文件架构从旧版本升级到新版本',
      fromVersion: currentVersionInfo.value.version,
      toVersion: selectedTargetVersion.value,
      type: 'schema',
      estimatedDuration: '2分钟',
      required: true,
      executed: false
    },
    {
      id: '2',
      name: '迁移数据结构',
      title: '迁移数据结构',
      description: '迁移现有数据到新的数据结构',
      fromVersion: currentVersionInfo.value.version,
      toVersion: selectedTargetVersion.value,
      type: 'data',
      estimatedDuration: '3分钟',
      required: true,
      executed: false
    }
  ]
}

const generatePreview = async () => {
  if (!currentVersionInfo.value || !selectedTargetVersion.value) {
    throw new Error('缺少版本信息')
  }
  
  // 模拟预览数据
  const mockPreview = {
    currentConfig: {
      version: currentVersionInfo.value.version,
      settings: {
        theme: 'light',
        language: 'zh-CN'
      }
    },
    targetConfig: {
      version: selectedTargetVersion.value,
      settings: {
        theme: 'light',
        language: 'zh-CN',
        newFeature: true
      }
    },
    changes: [
      {
        id: 'change1',
        type: 'add',
        path: '/settings/newFeature',
        description: '添加新功能配置项',
        oldValue: undefined,
        newValue: true
      },
      {
        id: 'change2',
        type: 'modify',
        path: '/version',
        description: '更新版本号',
        oldValue: currentVersionInfo.value.version,
        newValue: selectedTargetVersion.value
      }
    ],
    risks: [
      {
        id: 'risk1',
        level: 'medium',
        title: '配置兼容性风险',
        description: '新版本配置可能与旧版本不完全兼容',
        mitigation: '建议在迁移前备份当前配置'
      },
      {
        id: 'risk2',
        level: 'low',
        title: '功能变更风险',
        description: '部分功能可能发生变化',
        mitigation: '请查阅版本更新说明'
      }
    ]
  }
  
  previewData.value = {
    before: mockPreview.currentConfig,
    after: mockPreview.targetConfig,
    changes: mockPreview.changes.map(change => ({
      id: change.id,
      type: change.type as any,
      path: change.path,
      description: change.description,
      oldValue: change.oldValue,
      newValue: change.newValue
    })),
    risks: mockPreview.risks.map((risk: any) => ({
      id: risk.id,
      level: risk.level as any,
      title: risk.title,
      description: risk.description,
      mitigation: risk.mitigation
    }))
  }
}

const executeMigration = async () => {
  if (!currentVersionInfo.value || !selectedTargetVersion.value) {
    throw new Error('缺少版本信息')
  }
  
  const startTime = Date.now()
  
  // 重置执行状态
  executionProgress.value = {
    current: 0,
    total: migrationSteps.value.length,
    percentage: 0,
    status: 'normal',
    currentStepTitle: '',
    currentStepDescription: ''
  }
  
  executionLogs.value = []
  
  addLog('info', '开始配置迁移...')
  
  try {
    for (let i = 0; i < migrationSteps.value.length; i++) {
      const step = migrationSteps.value[i]
      
      executionProgress.value.current = i + 1
      executionProgress.value.currentStepTitle = step.title || ''
      executionProgress.value.currentStepDescription = step.description || ''
      executionProgress.value.percentage = Math.round(((i + 1) / migrationSteps.value.length) * 100)
      
      addLog('info', `执行步骤 ${i + 1}: ${step.title}`)
      
      // 模拟执行迁移步骤
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      addLog('success', `步骤 ${i + 1} 完成`)
      
      // 模拟进度延迟
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    executionProgress.value.status = 'success'
    addLog('success', '配置迁移完成')
    
    // 更新完成统计
    const endTime = Date.now()
    completionStats.value = {
      processedFiles: migrationSteps.value.length,
      appliedChanges: previewData.value.changes.length,
      duration: formatDuration(endTime - startTime)
    }
    
  } catch (error) {
    executionProgress.value.status = 'exception'
    addLog('error', '迁移失败: ' + (error instanceof Error ? error.message : '未知错误'))
    throw error
  }
}

const addLog = (level: ExecutionLog['level'], message: string) => {
  executionLogs.value.push({
    timestamp: new Date(),
    level,
    message
  })
  
  // 自动滚动到底部
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}

const clearLog = () => {
  executionLogs.value = []
}

const validateMigration = async () => {
  try {
    // 简单的配置验证逻辑
    if (migrationSteps.value.length > 0 && selectedTargetVersion.value) {
      ElMessage.success('配置验证通过')
    } else {
      ElMessage.warning('配置验证失败: 缺少必要的迁移信息')
    }
  } catch (error) {
    ElMessage.error('验证失败: ' + (error instanceof Error ? error.message : '未知错误'))
  }
}

const exportMigrationReport = () => {
  const report = {
    migration: {
      fromVersion: currentVersionInfo.value?.version,
      toVersion: selectedTargetVersion.value,
      timestamp: new Date().toISOString(),
      options: migrationOptions.value
    },
    steps: migrationSteps.value,
    changes: previewData.value.changes,
    risks: previewData.value.risks,
    execution: {
      logs: executionLogs.value,
      stats: completionStats.value
    }
  }
  
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `migration-report-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
  
  ElMessage.success('迁移报告已导出')
}

const restartServices = async () => {
  try {
    await ElMessageBox.confirm(
      '重启服务将短暂中断服务，确定要继续吗？',
      '确认重启',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 模拟服务重启
    await new Promise(resolve => setTimeout(resolve, 2000))
    ElMessage.success('服务重启成功')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('服务重启失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }
}

const cancelMigration = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要取消迁移吗？已进行的操作将保留。',
      '确认取消',
      {
        confirmButtonText: '确定',
        cancelButtonText: '继续迁移',
        type: 'warning'
      }
    )
    
    emit('cancelled')
  } catch {
    // 用户选择继续迁移
  }
}

const finishMigration = () => {
  emit('completed', {
    fromVersion: currentVersionInfo.value?.version,
    toVersion: selectedTargetVersion.value,
    stats: completionStats.value
  })
}

// 辅助方法
const getNextButtonText = (): string => {
  const texts = ['开始规划', '生成预览', '执行迁移', '完成']
  return texts[currentStep.value] || '下一步'
}

const getVersionTypeColor = (version: string): string => {
  // 根据版本号返回不同颜色
  if (version.includes('beta')) return 'warning'
  if (version.includes('alpha')) return 'danger'
  return 'primary'
}

const getStepTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    schema: 'primary',
    data: 'success',
    config: 'warning',
    validation: 'info'
  }
  return colors[type] || 'default'
}

const getStepTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    schema: '架构升级',
    data: '数据迁移',
    config: '配置更新',
    validation: '验证检查'
  }
  return labels[type] || type
}

const getActionIcon = (type: string): any => {
  const icons: Record<string, any> = {
    add: Plus,
    modify: Edit,
    remove: Delete,
    rename: Edit
  }
  return icons[type] || Setting
}

const getActionIconColor = (type: string): string => {
  const colors: Record<string, string> = {
    add: 'var(--el-color-success)',
    modify: 'var(--el-color-warning)',
    remove: 'var(--el-color-danger)',
    rename: 'var(--el-color-primary)'
  }
  return colors[type] || 'var(--el-text-color-regular)'
}

const getChangeIcon = (type: string): any => {
  return getActionIcon(type)
}

const getChangeIconColor = (type: string): string => {
  return getActionIconColor(type)
}

const getChangeTypeText = (type: string): string => {
  const texts: Record<string, string> = {
    add: '新增',
    modify: '修改',
    remove: '删除',
    rename: '重命名'
  }
  return texts[type] || type
}

const getRiskAlertType = (level: string): any => {
  const types: Record<string, any> = {
    low: 'info',
    medium: 'warning',
    high: 'error'
  }
  return types[level] || 'info'
}

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString()
}

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

// 初始化
onMounted(() => {
  detectVersion()
})
</script>

<style scoped>
.migration-wizard {
  padding: 20px;
  max-height: 85vh;
  overflow-y: auto;
}

.wizard-steps {
  margin-bottom: 32px;
}

.wizard-content {
  min-height: 500px;
  margin-bottom: 24px;
}

.step-content {
  animation: fadeInUp 0.3s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.step-header {
  text-align: center;
  margin-bottom: 32px;
}

.step-header h3 {
  margin: 0 0 8px 0;
  color: var(--el-text-color-primary);
  font-size: 24px;
}

.step-header p {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

/* 版本检测样式 */
.detection-section {
  max-width: 1200px;
  margin: 0 auto;
}

.current-version-card {
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.version-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.label {
  font-weight: 600;
  color: var(--el-text-color-primary);
  min-width: 80px;
}

.value {
  color: var(--el-text-color-regular);
}

.features,
.compatibility {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.feature-tag {
  margin: 0;
}

.available-versions h4 {
  margin: 0 0 16px 0;
  color: var(--el-text-color-primary);
}

.versions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.version-card {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.version-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.version-card.recommended {
  border-color: var(--el-color-success);
  background: var(--el-color-success-light-9);
}

.version-card.selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.version-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.version-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.version-number {
  font-weight: 600;
  color: var(--el-text-color-primary);
  font-size: 16px;
}

.version-description {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-bottom: 12px;
}

.version-features {
  font-size: 12px;
}

.new-features,
.breaking-changes {
  margin-bottom: 8px;
}

.features-label {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.features-list {
  margin: 4px 0 0 16px;
  padding: 0;
}

.features-list.warning {
  color: var(--el-color-warning);
}

/* 迁移路径样式 */
.migration-path-section {
  max-width: 1200px;
  margin: 0 auto;
}

.path-overview {
  margin-bottom: 24px;
}

.path-flow {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  overflow-x: auto;
}

.path-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 120px;
}

.path-node.current .node-content {
  background: var(--el-color-primary);
  color: white;
}

.path-node.step .node-content {
  background: var(--el-color-info-light-3);
  color: var(--el-text-color-primary);
}

.node-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  border-radius: 8px;
  border: 2px solid var(--el-border-color);
}

.node-version {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}

.node-label {
  font-size: 12px;
  opacity: 0.8;
}

.path-arrow-and-node {
  display: flex;
  align-items: center;
  gap: 16px;
}

.path-arrow {
  color: var(--el-color-primary);
  font-size: 18px;
}

.steps-details h4 {
  margin: 0 0 16px 0;
  color: var(--el-text-color-primary);
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.step-item {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.step-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--el-color-primary);
  color: white;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
}

.step-name {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.step-duration {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.step-description {
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
}

.step-actions {
  margin-bottom: 12px;
}

.actions-label {
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

.actions-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.step-risks {
  margin-top: 12px;
}

.risks-list {
  list-style: none;
  padding: 0;
  margin: 8px 0 0 0;
}

.migration-options {
  margin-top: 24px;
}

.options-form {
  max-width: 600px;
}

/* 预览样式 */
.preview-section {
  max-width: 1200px;
  margin: 0 auto;
}

.config-diff {
  padding: 16px 0;
}

.diff-header {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 16px;
}

.diff-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.diff-section h5 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.diff-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.config-before,
.config-after {
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 12px;
  background: var(--el-bg-color-page);
  max-height: 400px;
  overflow-y: auto;
}

.changes-list {
  padding: 16px 0;
}

.change-item {
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 12px;
}

.change-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.change-type {
  display: flex;
  align-items: center;
  gap: 8px;
}

.change-operation {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.change-path {
  font-family: monospace;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.change-description {
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
}

.change-values {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.old-value,
.new-value {
  display: flex;
  align-items: center;
  gap: 8px;
}

.value-label {
  font-weight: 600;
  color: var(--el-text-color-primary);
  min-width: 40px;
}

.old-value code {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.new-value code {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

code {
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
}

.risks-assessment {
  padding: 16px 0;
}

.risk-summary {
  margin-bottom: 24px;
}

.summary-stats {
  display: flex;
  justify-content: center;
  gap: 32px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  margin-bottom: 4px;
}

.stat-value.high-risk {
  color: var(--el-color-danger);
}

.stat-value.medium-risk {
  color: var(--el-color-warning);
}

.stat-value.low-risk {
  color: var(--el-color-success);
}

.stat-label {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.risks-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.risk-item {
  margin-bottom: 8px;
}

.risk-mitigation {
  margin-top: 8px;
  padding: 8px;
  background: var(--el-bg-color-page);
  border-radius: 4px;
  font-size: 13px;
}

/* 执行样式 */
.execution-section {
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.execution-progress {
  width: 100%;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-text {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.progress-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.current-step {
  padding: 16px;
  background: var(--el-bg-color-page);
  border-radius: 6px;
}

.step-info {
  margin-bottom: 8px;
  color: var(--el-text-color-primary);
}

.step-description {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.execution-log {
  width: 100%;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.log-content {
  max-height: 300px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.5;
}

.log-entry {
  display: flex;
  gap: 12px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.log-entry:last-child {
  border-bottom: none;
}

.log-entry.info {
  color: var(--el-text-color-regular);
}

.log-entry.warn {
  color: var(--el-color-warning);
}

.log-entry.error {
  color: var(--el-color-danger);
}

.log-entry.success {
  color: var(--el-color-success);
}

.log-time {
  color: var(--el-text-color-secondary);
  min-width: 80px;
}

.log-level {
  font-weight: 600;
  min-width: 60px;
}

.log-message {
  flex: 1;
}

/* 完成样式 */
.completion-section {
  max-width: 800px;
  margin: 0 auto;
}

.completion-status {
  margin-bottom: 32px;
}

.completion-stats {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-top: 24px;
}

.post-migration-actions .actions-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.post-migration-actions .action-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
}

.action-description {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

/* 控制按钮 */
.wizard-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 24px;
  border-top: 1px solid var(--el-border-color);
}

.controls-left,
.controls-right {
  display: flex;
  gap: 12px;
}
</style>
