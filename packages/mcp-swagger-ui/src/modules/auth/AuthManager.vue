<template>
  <div class="auth-manager">
    <!-- 页面头部 -->
    <div class="header-section">
      <div class="header-content">
        <h1>
          <el-icon><Lock /></el-icon>
          认证配置管理
        </h1>
        <p class="header-description">
          配置和管理API认证信息，支持多种认证方式的安全存储和测试
        </p>
      </div>
      
      <div class="header-actions">
        <el-button 
          type="primary" 
          :icon="Plus" 
          @click="showCreateDialog"
        >
          添加认证配置
        </el-button>
        <el-button 
          :icon="Refresh" 
          @click="refreshData"
          :loading="loading"
        >
          刷新
        </el-button>
      </div>
    </div>

    <!-- 过期警告 -->
    <div v-if="expiredConfigs.length > 0" class="expired-warning">
      <el-alert
        title="认证配置过期提醒"
        type="warning"
        show-icon
        :closable="false"
      >
        <template #default>
          <div>
            以下认证配置可能已过期，建议重新测试或更新：
            <ul class="expired-list">
              <li v-for="config in expiredConfigs" :key="config.id">
                {{ getConfigDisplayName(config) }} ({{ config.type.toUpperCase() }})
                <el-button size="small" text @click="testConfig(config.id)">
                  重新测试
                </el-button>
              </li>
            </ul>
          </div>
        </template>
      </el-alert>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 管理工具栏 -->
      <div class="management-toolbar">
        <div class="toolbar-section">
          <h4>快速操作</h4>
          <div class="toolbar-actions">
            <el-button
              type="primary"
              @click="authStore.startExpirationMonitoring()"
              :icon="Connection"
            >
              启动过期监控
            </el-button>
            
            <el-button
              type="warning"
              @click="authStore.checkAllExpiration()"
              :icon="Refresh"
            >
              检查过期状态
            </el-button>
            
            <el-button
              type="danger"
              @click="confirmCleanupExpired"
              :icon="Delete"
              :disabled="expiredConfigs.length === 0"
            >
              清理过期配置 ({{ expiredConfigs.length }})
            </el-button>
          </div>
        </div>

        <div class="toolbar-section">
          <h4>统计信息</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">{{ authStore.configList.length }}</div>
              <div class="stat-label">总配置数</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ activeConfig ? 1 : 0 }}</div>
              <div class="stat-label">活跃配置</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ expiredConfigs.length }}</div>
              <div class="stat-label">已过期</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ getExpiringSoonCount() }}</div>
              <div class="stat-label">即将过期</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 认证配置列表 -->
      <div class="config-list-section">
        <div class="section-header">
          <h3>认证配置列表</h3>
          <div class="header-filters">
            <el-select
              v-model="selectedType"
              placeholder="筛选认证类型"
              clearable
              style="width: 150px"
            >
              <el-option label="Bearer Token" value="bearer" />
              <el-option label="API Key" value="apikey" />
              <el-option label="Basic Auth" value="basic" />
              <el-option label="OAuth2" value="oauth2" />
            </el-select>
          </div>
        </div>

        <div class="config-cards" v-loading="loading">
          <div
            v-for="config in filteredConfigs"
            :key="config.id"
            class="config-card"
            :class="{ 
              active: activeConfigId === config.id,
              expired: checkAuthExpiration(config.id)
            }"
          >
            <div class="card-header">
              <div class="config-info">
                <div class="config-name">
                  {{ getConfigDisplayName(config) }}
                </div>
                <el-tag :type="getTypeColor(config.type)">
                  {{ getTypeLabel(config.type) }}
                </el-tag>
              </div>
              
              <div class="card-actions">
                <el-tooltip content="设为活跃">
                  <el-button
                    size="small"
                    :type="activeConfigId === config.id ? 'primary' : 'default'"
                    :icon="activeConfigId === config.id ? Check : Plus"
                    @click="setActiveConfig(config.id)"
                    circle
                  />
                </el-tooltip>
                <el-tooltip content="测试连接">
                  <el-button
                    size="small"
                    :icon="Connection"
                    @click="testConfig(config.id)"
                    :loading="testing === config.id"
                    circle
                  />
                </el-tooltip>
                <el-tooltip content="编辑">
                  <el-button
                    size="small"
                    :icon="Edit"
                    @click="editConfig(config)"
                    circle
                  />
                </el-tooltip>
                <el-tooltip content="删除">
                  <el-button
                    size="small"
                    type="danger"
                    :icon="Delete"
                    @click="deleteConfig(config.id)"
                    circle
                  />
                </el-tooltip>
              </div>
            </div>

            <div class="card-content">
              <!-- 认证信息摘要 -->
              <div class="credentials-summary">
                <div v-if="config.type === 'bearer'" class="credential-item">
                  <span class="label">Token:</span>
                  <span class="value">{{ maskCredential(config.credentials.token) }}</span>
                </div>
                <div v-else-if="config.type === 'apikey'" class="credential-item">
                  <span class="label">API Key:</span>
                  <span class="value">{{ maskCredential(config.credentials.apiKey) }}</span>
                </div>
                <div v-else-if="config.type === 'basic'">
                  <div class="credential-item">
                    <span class="label">用户名:</span>
                    <span class="value">{{ config.credentials.username }}</span>
                  </div>
                  <div class="credential-item">
                    <span class="label">密码:</span>
                    <span class="value">{{ maskCredential(config.credentials.password) }}</span>
                  </div>
                </div>
                <div v-else-if="config.type === 'oauth2'">
                  <div class="credential-item">
                    <span class="label">Client ID:</span>
                    <span class="value">{{ config.credentials.clientId }}</span>
                  </div>
                  <div class="credential-item">
                    <span class="label">Client Secret:</span>
                    <span class="value">{{ maskCredential(config.credentials.clientSecret) }}</span>
                  </div>
                </div>
              </div>

              <!-- 环境变量 -->
              <div v-if="config.envVars && config.envVars.length > 0" class="env-vars">
                <div class="env-label">环境变量:</div>
                <el-tag
                  v-for="envVar in config.envVars"
                  :key="envVar"
                  size="small"
                  style="margin-right: 4px; margin-bottom: 4px;"
                >
                  {{ envVar }}
                </el-tag>
              </div>

              <!-- 测试结果 -->
              <div v-if="testResults.get(config.id)" class="test-result">
                <div class="result-header">
                  <span class="result-label">最近测试:</span>
                  <el-tag
                    :type="testResults.get(config.id)?.success ? 'success' : 'danger'"
                    size="small"
                  >
                    {{ testResults.get(config.id)?.success ? '成功' : '失败' }}
                  </el-tag>
                  <span class="result-time">
                    {{ formatDateTime(testResults.get(config.id)?.timestamp || new Date()) }}
                  </span>
                </div>
                <div class="result-message">
                  {{ testResults.get(config.id)?.message }}
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="filteredConfigs.length === 0" class="empty-state">
            <el-empty description="暂无认证配置">
              <el-button type="primary" @click="showCreateDialog">
                创建第一个认证配置
              </el-button>
            </el-empty>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建/编辑认证配置对话框 -->
    <el-dialog
      v-model="createDialogVisible"
      :title="editingConfig ? '编辑认证配置' : '创建认证配置'"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="authFormRef"
        :model="authForm"
        label-width="120px"
        :rules="authFormRules"
      >
        <el-form-item label="配置名称" prop="name">
          <el-input
            v-model="authForm.name"
            placeholder="输入认证配置名称"
          />
        </el-form-item>
        
        <el-form-item label="认证类型" prop="type">
          <el-select
            v-model="authForm.type"
            placeholder="选择认证类型"
            style="width: 100%"
            @change="handleTypeChange"
          >
            <el-option label="Bearer Token" value="bearer">
              <div class="option-content">
                <div class="option-title">Bearer Token</div>
                <div class="option-desc">使用Bearer令牌进行认证</div>
              </div>
            </el-option>
            <el-option label="API Key" value="apikey">
              <div class="option-content">
                <div class="option-title">API Key</div>
                <div class="option-desc">使用API密钥进行认证</div>
              </div>
            </el-option>
            <el-option label="Basic Auth" value="basic">
              <div class="option-content">
                <div class="option-title">Basic Auth</div>
                <div class="option-desc">使用用户名密码进行基础认证</div>
              </div>
            </el-option>
            <el-option label="OAuth2" value="oauth2">
              <div class="option-content">
                <div class="option-title">OAuth2</div>
                <div class="option-desc">使用OAuth2客户端凭据流</div>
              </div>
            </el-option>
          </el-select>
        </el-form-item>

        <!-- Bearer Token 配置 -->
        <template v-if="authForm.type === 'bearer'">
          <el-form-item label="Token" prop="credentials.token">
            <el-input
              v-model="authForm.credentials.token"
              type="password"
              placeholder="输入Bearer Token"
              show-password
            />
          </el-form-item>
        </template>

        <!-- API Key 配置 -->
        <template v-if="authForm.type === 'apikey'">
          <el-form-item label="API Key" prop="credentials.apiKey">
            <el-input
              v-model="authForm.credentials.apiKey"
              type="password"
              placeholder="输入API Key"
              show-password
            />
          </el-form-item>
        </template>

        <!-- Basic Auth 配置 -->
        <template v-if="authForm.type === 'basic'">
          <el-form-item label="用户名" prop="credentials.username">
            <el-input
              v-model="authForm.credentials.username"
              placeholder="输入用户名"
            />
          </el-form-item>
          <el-form-item label="密码" prop="credentials.password">
            <el-input
              v-model="authForm.credentials.password"
              type="password"
              placeholder="输入密码"
              show-password
            />
          </el-form-item>
        </template>

        <!-- OAuth2 配置 -->
        <template v-if="authForm.type === 'oauth2'">
          <el-form-item label="Client ID" prop="credentials.clientId">
            <el-input
              v-model="authForm.credentials.clientId"
              placeholder="输入Client ID"
            />
          </el-form-item>
          <el-form-item label="Client Secret" prop="credentials.clientSecret">
            <el-input
              v-model="authForm.credentials.clientSecret"
              type="password"
              placeholder="输入Client Secret"
              show-password
            />
          </el-form-item>
        </template>

        <!-- 环境变量配置 -->
        <el-form-item label="环境变量">
          <div class="env-vars-config">
            <div class="env-input-group">
              <el-input
                v-model="newEnvVar"
                placeholder="输入环境变量名称"
                @keyup.enter="addEnvVar"
              />
              <el-button @click="addEnvVar" :disabled="!newEnvVar.trim()">
                添加
              </el-button>
              <el-button @click="validateEnvVars" :loading="validatingEnvVars">
                验证环境变量
              </el-button>
            </div>
            
            <div class="env-vars-list" v-if="authForm.envVars.length > 0">
              <el-tag
                v-for="(envVar, index) in authForm.envVars"
                :key="index"
                :type="getEnvVarStatus(envVar)"
                closable
                @close="removeEnvVar(index)"
                style="margin: 4px 4px 4px 0;"
              >
                {{ envVar }}
                <el-icon v-if="getEnvVarStatus(envVar) === 'success'"><Check /></el-icon>
                <el-icon v-else-if="getEnvVarStatus(envVar) === 'danger'"><Close /></el-icon>
              </el-tag>
            </div>

            <div v-if="envVarValidationResult" class="env-validation-result">
              <div v-if="envVarValidationResult.available.length > 0" class="available-vars">
                <el-text type="success">
                  <el-icon><Check /></el-icon>
                  可用环境变量: {{ envVarValidationResult.available.join(', ') }}
                </el-text>
              </div>
              <div v-if="envVarValidationResult.missing.length > 0" class="missing-vars">
                <el-text type="danger">
                  <el-icon><Close /></el-icon>
                  缺失环境变量: {{ envVarValidationResult.missing.join(', ') }}
                </el-text>
              </div>
            </div>
            
            <div class="env-suggestions">
              <span class="suggestions-label">常用环境变量:</span>
              <el-button
                v-for="suggestion in envVarSuggestions"
                :key="suggestion"
                size="small"
                text
                @click="quickAddEnvVar(suggestion)"
              >
                {{ suggestion }}
              </el-button>
            </div>
          </div>
        </el-form-item>

        <!-- 自动续期设置 -->
        <el-form-item label="自动续期">
          <div class="auto-renewal-config">
            <el-switch
              v-model="authForm.autoRenewal"
              active-text="启用自动续期提醒"
            />
            <div v-if="authForm.autoRenewal" class="renewal-settings">
              <el-form-item label="提醒间隔" style="margin-bottom: 8px;">
                <el-select v-model="authForm.renewalInterval" style="width: 100%">
                  <el-option label="1小时" :value="1" />
                  <el-option label="6小时" :value="6" />
                  <el-option label="12小时" :value="12" />
                  <el-option label="24小时" :value="24" />
                  <el-option label="7天" :value="168" />
                </el-select>
              </el-form-item>
            </div>
          </div>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="createDialogVisible = false">取消</el-button>
          <el-button @click="testFormConfig" :loading="testing === 'form'">
            测试连接
          </el-button>
          <el-button type="primary" @click="saveAuthConfig" :loading="saving">
            {{ editingConfig ? '更新' : '创建' }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 测试详情对话框 -->
    <el-dialog
      v-model="testDetailsDialogVisible"
      title="认证测试详情"
      width="500px"
    >
      <div v-if="selectedTestResult" class="test-details">
        <div class="detail-item">
          <strong>测试状态:</strong>
          <el-tag :type="selectedTestResult.success ? 'success' : 'danger'">
            {{ selectedTestResult.success ? '成功' : '失败' }}
          </el-tag>
        </div>
        
        <div class="detail-item">
          <strong>测试时间:</strong>
          {{ formatDateTime(selectedTestResult.timestamp) }}
        </div>
        
        <div class="detail-item">
          <strong>测试消息:</strong>
          {{ selectedTestResult.message }}
        </div>
        
        <div v-if="selectedTestResult.details" class="detail-item">
          <strong>详细信息:</strong>
          <el-input
            type="textarea"
            :value="JSON.stringify(selectedTestResult.details, null, 2)"
            readonly
            :rows="6"
          />
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { 
  ElMessage, 
  ElMessageBox,
  type FormInstance,
  type FormRules
} from 'element-plus'
import {
  Lock,
  Plus,
  Refresh,
  Check,
  Close,
  Connection,
  Edit,
  Delete
} from '@element-plus/icons-vue'

import { useAuthStore } from '@/stores/auth'
import type { AuthConfig, AuthTestResult } from '@/types'

// Store
const authStore = useAuthStore()

// Reactive data
const loading = ref(false)
const saving = ref(false)
const testing = ref<string | null>(null)
const selectedType = ref('')

// 对话框状态
const createDialogVisible = ref(false)
const testDetailsDialogVisible = ref(false)
const selectedTestResult = ref<AuthTestResult | null>(null)

// 表单数据
const authFormRef = ref<FormInstance>()
const editingConfig = ref<{ id: string } & AuthConfig | null>(null)
const authForm = ref({
  name: '',
  type: '' as AuthConfig['type'],
  credentials: {
    token: '',
    apiKey: '',
    username: '',
    password: '',
    clientId: '',
    clientSecret: ''
  },
  envVars: [] as string[],
  autoRenewal: false,
  renewalInterval: 24
})

// 环境变量管理
const newEnvVar = ref('')
const validatingEnvVars = ref(false)
const envVarValidationResult = ref<{
  available: string[]
  missing: string[]
} | null>(null)
const envVarSuggestions = [
  'API_TOKEN', 'SECRET_KEY', 'CLIENT_ID', 'CLIENT_SECRET',
  'BEARER_TOKEN', 'API_KEY', 'USERNAME', 'PASSWORD'
]

// Computed properties
const filteredConfigs = computed(() => {
  if (!selectedType.value) return authStore.configList
  return authStore.configList.filter(config => config.type === selectedType.value)
})

const expiredConfigs = computed(() => {
  return authStore.getExpiredConfigs()
})

const activeConfigId = computed(() => authStore.activeConfigId)
const activeConfig = computed(() => authStore.activeConfig)
const testResults = computed(() => authStore.testResults)

// 表单验证规则
const authFormRules: FormRules = {
  name: [
    { required: true, message: '请输入配置名称', trigger: 'blur' },
    { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择认证类型', trigger: 'change' }
  ],
  'credentials.token': [
    { required: true, message: '请输入Bearer Token', trigger: 'blur' }
  ],
  'credentials.apiKey': [
    { required: true, message: '请输入API Key', trigger: 'blur' }
  ],
  'credentials.username': [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  'credentials.password': [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ],
  'credentials.clientId': [
    { required: true, message: '请输入Client ID', trigger: 'blur' }
  ],
  'credentials.clientSecret': [
    { required: true, message: '请输入Client Secret', trigger: 'blur' }
  ]
}

// Methods
const showCreateDialog = () => {
  editingConfig.value = null
  resetForm()
  createDialogVisible.value = true
}

const editConfig = (config: { id: string } & AuthConfig) => {
  editingConfig.value = config
  
  // 加载配置数据到表单
  const decryptedCredentials = authStore.getDecryptedCredentials(config.id) || {}
  authForm.value = {
    name: getConfigDisplayName(config),
    type: config.type,
    credentials: {
      token: decryptedCredentials.token || '',
      apiKey: decryptedCredentials.apiKey || '',
      username: decryptedCredentials.username || '',
      password: decryptedCredentials.password || '',
      clientId: decryptedCredentials.clientId || '',
      clientSecret: decryptedCredentials.clientSecret || ''
    },
    envVars: [...(config.envVars || [])],
    autoRenewal: false,
    renewalInterval: 24
  }
  
  createDialogVisible.value = true
}

const resetForm = () => {
  authForm.value = {
    name: '',
    type: '' as AuthConfig['type'],
    credentials: {
      token: '',
      apiKey: '',
      username: '',
      password: '',
      clientId: '',
      clientSecret: ''
    },
    envVars: [] as string[],
    autoRenewal: false,
    renewalInterval: 24
  }
}

const handleTypeChange = () => {
  // 清空凭据字段
  authForm.value.credentials = {
    token: '',
    apiKey: '',
    username: '',
    password: '',
    clientId: '',
    clientSecret: ''
  }
}

const addEnvVar = () => {
  const envVar = newEnvVar.value.trim()
  if (envVar && !authForm.value.envVars.includes(envVar)) {
    authForm.value.envVars.push(envVar)
    newEnvVar.value = ''
  }
}

const removeEnvVar = (index: number) => {
  authForm.value.envVars.splice(index, 1)
}

const quickAddEnvVar = (envVar: string) => {
  if (!authForm.value.envVars.includes(envVar)) {
    authForm.value.envVars.push(envVar)
  }
}

const testFormConfig = async () => {
  if (!authFormRef.value) return
  
  const valid = await authFormRef.value.validate().catch(() => false)
  if (!valid) {
    ElMessage.error('请检查表单输入')
    return
  }
  
  testing.value = 'form'
  
  try {
    // 创建临时配置进行测试
    const tempConfig: Omit<AuthConfig, 'encrypted'> = {
      type: authForm.value.type,
      credentials: { ...authForm.value.credentials },
      envVars: [...authForm.value.envVars]
    }
    
    // 模拟测试
    const result = await authStore.testAuthConfig('temp')
    
    selectedTestResult.value = result
    testDetailsDialogVisible.value = true
    
  } catch (error) {
    ElMessage.error('测试失败')
  } finally {
    testing.value = null
  }
}

const saveAuthConfig = async () => {
  if (!authFormRef.value) return
  
  const valid = await authFormRef.value.validate().catch(() => false)
  if (!valid) return
  
  saving.value = true
  
  try {
    const configData: Omit<AuthConfig, 'encrypted'> = {
      type: authForm.value.type,
      credentials: { ...authForm.value.credentials },
      envVars: [...authForm.value.envVars]
    }
    
    if (editingConfig.value) {
      // 更新现有配置
      authStore.updateAuthConfig(editingConfig.value.id, configData)
    } else {
      // 创建新配置
      authStore.createAuthConfig(authForm.value.name, configData)
    }
    
    createDialogVisible.value = false
    resetForm()
    
  } catch (error) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

const testConfig = async (configId: string) => {
  testing.value = configId
  
  try {
    const result = await authStore.testAuthConfig(configId)
    
    if (result.details) {
      selectedTestResult.value = result
      testDetailsDialogVisible.value = true
    }
    
  } finally {
    testing.value = null
  }
}

const deleteConfig = async (configId: string) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这个认证配置吗？这将安全清除所有相关的敏感信息。',
      '确认删除',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    )
    
    await authStore.deleteAuthConfig(configId)
    
  } catch (error) {
    // 用户取消删除
  }
}

const setActiveConfig = (configId: string) => {
  authStore.setActiveConfig(
    authStore.activeConfigId === configId ? null : configId
  )
}

const checkAuthExpiration = (configId: string): boolean => {
  return authStore.checkAuthExpiration(configId)
}

const refreshData = async () => {
  loading.value = true
  try {
    await authStore.loadAvailableEnvVars()
    ElMessage.success('数据刷新成功')
  } catch (error) {
    ElMessage.error('数据刷新失败')
  } finally {
    loading.value = false
  }
}

// 辅助函数
const getConfigDisplayName = (config: { id: string } & AuthConfig): string => {
  // 从ID中提取时间戳作为名称
  const timestamp = config.id.split('_')[1]
  const date = new Date(parseInt(timestamp))
  return `${getTypeLabel(config.type)} 配置 (${date.toLocaleDateString()})`
}

const getTypeLabel = (type: AuthConfig['type']): string => {
  const labels = {
    bearer: 'Bearer Token',
    apikey: 'API Key',
    basic: 'Basic Auth',
    oauth2: 'OAuth2'
  }
  return labels[type]
}

const getTypeColor = (type: AuthConfig['type']) => {
  const colors = {
    bearer: 'primary',
    apikey: 'success',
    basic: 'warning',
    oauth2: 'info'
  }
  return colors[type]
}

const maskCredential = (credential?: string): string => {
  if (!credential) return '未设置'
  if (credential.length <= 8) return '*'.repeat(credential.length)
  return credential.substring(0, 4) + '*'.repeat(credential.length - 8) + credential.substring(credential.length - 4)
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

// 环境变量验证方法
const validateEnvVars = async () => {
  if (authForm.value.envVars.length === 0) {
    ElMessage.warning('请先添加环境变量')
    return
  }
  
  validatingEnvVars.value = true
  try {
    // 模拟环境变量检查
    const available: string[] = []
    const missing: string[] = []
    
    for (const envVar of authForm.value.envVars) {
      // 在实际环境中，这里应该调用API检查环境变量
      // 现在我们模拟一些常见的环境变量为可用状态
      const commonVars = ['API_TOKEN', 'SECRET_KEY', 'CLIENT_ID', 'BEARER_TOKEN']
      if (commonVars.includes(envVar) || Math.random() > 0.3) {
        available.push(envVar)
      } else {
        missing.push(envVar)
      }
    }
    
    envVarValidationResult.value = { available, missing }
    
    if (missing.length === 0) {
      ElMessage.success('所有环境变量均可用')
    } else {
      ElMessage.warning(`发现 ${missing.length} 个缺失的环境变量`)
    }
  } catch (error) {
    ElMessage.error('环境变量验证失败')
  } finally {
    validatingEnvVars.value = false
  }
}

const getEnvVarStatus = (envVar: string): string => {
  if (!envVarValidationResult.value) return ''
  
  if (envVarValidationResult.value.available.includes(envVar)) {
    return 'success'
  } else if (envVarValidationResult.value.missing.includes(envVar)) {
    return 'danger'
  }
  return ''
}

// 过期管理相关方法
const getExpiringSoonCount = (): number => {
  const now = Date.now()
  return authStore.configList.filter(config => {
    if (!config.expiresAt) return false
    const timeLeft = new Date(config.expiresAt).getTime() - now
    const hoursLeft = timeLeft / (1000 * 60 * 60)
    return hoursLeft > 0 && hoursLeft <= 24
  }).length
}

const confirmCleanupExpired = async () => {
  if (expiredConfigs.value.length === 0) {
    ElMessage.info('没有过期的认证配置')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要清理 ${expiredConfigs.value.length} 个过期的认证配置吗？此操作不可撤销。`,
      '确认清理',
      {
        confirmButtonText: '确定清理',
        cancelButtonText: '取消',
        type: 'warning',
        dangerouslyUseHTMLString: false
      }
    )
    
    await authStore.cleanupExpiredConfigs()
  } catch (error) {
    // 用户取消操作
    if (error === 'cancel') {
      return
    }
    ElMessage.error('清理操作失败')
  }
}

// 生命周期
onMounted(async () => {
  loading.value = true
  try {
    await authStore.loadAvailableEnvVars()
    // 启动过期监控
    authStore.startExpirationMonitoring()
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  // 清理过期监控定时器
  authStore.stopExpirationMonitoring()
})
</script>

<style scoped>
.auth-manager {
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

.expired-warning {
  margin-bottom: 20px;
}

.expired-list {
  margin: 8px 0 0 20px;
}

.expired-list li {
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.main-content {
  flex: 1;
  overflow-y: auto;
}

.management-toolbar {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 20px;
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 20px;
}

.toolbar-section h4 {
  margin: 0 0 12px 0;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stat-item {
  text-align: center;
  padding: 8px;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-color-primary);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
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
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 16px;
}

.config-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
  transition: all 0.2s;
}

.config-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.config-card.active {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
}

.config-card.expired {
  border-color: var(--el-color-warning);
  background-color: var(--el-color-warning-light-9);
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
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.card-actions {
  display: flex;
  gap: 4px;
}

.card-content {
  margin-top: 12px;
}

.credentials-summary {
  margin-bottom: 12px;
}

.credential-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 14px;
}

.credential-item .label {
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.credential-item .value {
  color: var(--el-text-color-primary);
  font-family: monospace;
}

.env-vars {
  margin-bottom: 12px;
}

.env-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.test-result {
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.result-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.result-time {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-left: auto;
}

.result-message {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 40px;
}

.option-content {
  display: flex;
  flex-direction: column;
}

.option-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.option-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.env-vars-config {
  width: 100%;
}

.env-input-group {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.env-input-group .el-input {
  flex: 1;
}

.env-vars-list {
  margin-bottom: 12px;
  padding: 8px;
  background-color: var(--el-bg-color-page);
  border-radius: 4px;
  border: 1px solid var(--el-border-color-lighter);
}

.env-validation-result {
  margin: 8px 0;
  padding: 8px;
  border-radius: 4px;
  background-color: var(--el-bg-color-page);
}

.available-vars, .missing-vars {
  margin: 4px 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.env-suggestions {
  margin-top: 8px;
  padding: 8px;
  background-color: var(--el-fill-color-lighter);
  border-radius: 4px;
}

.suggestions-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-right: 8px;
}

.auto-renewal-config {
  width: 100%;
}

.renewal-settings {
  margin-top: 12px;
  padding: 12px;
  background-color: var(--el-fill-color-lighter);
  border-radius: 4px;
}

.env-vars-list {
  margin-bottom: 8px;
}

.env-suggestions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.suggestions-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-right: 8px;
}

.test-details .detail-item {
  margin-bottom: 16px;
}

.test-details .detail-item strong {
  display: block;
  margin-bottom: 4px;
  color: var(--el-text-color-primary);
}

@media (max-width: 768px) {
  .config-cards {
    grid-template-columns: 1fr;
  }
  
  .header-section {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .card-header {
    flex-direction: column;
    gap: 8px;
  }
  
  .card-actions {
    align-self: flex-end;
  }
}
</style>