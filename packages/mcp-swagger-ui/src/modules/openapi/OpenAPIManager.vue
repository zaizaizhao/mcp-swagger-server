<template>
  <div class="openapi-manager">
    <!-- 页面头部 -->
    <div class="page-header">
      <el-page-header :content="'OpenAPI规范管理'">
        <template #extra>
          <div class="header-actions">
            <el-button 
              type="primary" 
              :icon="Plus" 
              @click="showCreateDialog = true"
            >
              新建规范
            </el-button>
            <el-button 
              :icon="Upload" 
              @click="showUploadDialog = true"
            >
              上传文件
            </el-button>
            <el-button 
              :icon="Link" 
              @click="showUrlDialog = true"
            >
              从URL导入
            </el-button>
          </div>
        </template>
      </el-page-header>
    </div>

    <!-- 主要内容区域 -->
    <div class="page-content">
      <el-row :gutter="24">
        <!-- 左侧：规范列表 -->
        <el-col :span="8">
          <el-card class="specs-list-card">
            <template #header>
              <div class="card-header">
                <span><el-icon><Document /></el-icon> 规范列表</span>
                <div class="list-controls">
                  <el-input
                    v-model="searchQuery"
                    placeholder="搜索规范..."
                    :prefix-icon="Search"
                    size="small"
                    style="width: 200px;"
                    clearable
                  />
                </div>
              </div>
            </template>
            
            <div class="specs-list" v-loading="specsLoading">
              <div 
                v-for="spec in filteredSpecs" 
                :key="spec.id"
                class="spec-item"
                :class="{ active: selectedSpecId === spec.id }"
                @click="selectSpec(spec)"
              >
                <div class="spec-header">
                  <div class="spec-name">
                    <el-icon><Document /></el-icon>
                    {{ spec.name }}
                  </div>
                  <div class="spec-actions">
                    <el-dropdown trigger="click" @command="handleSpecAction">
                      <el-button 
                        size="small" 
                        text 
                        :icon="MoreFilled"
                        @click.stop
                      />
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item 
                            :command="{ action: 'edit', spec }"
                            :icon="Edit"
                          >
                            编辑
                          </el-dropdown-item>
                          <el-dropdown-item 
                            :command="{ action: 'duplicate', spec }"
                            :icon="DocumentCopy"
                          >
                            复制
                          </el-dropdown-item>
                          <el-dropdown-item 
                            :command="{ action: 'download', spec }"
                            :icon="Download"
                          >
                            下载
                          </el-dropdown-item>
                          <el-dropdown-item 
                            :command="{ action: 'delete', spec }"
                            :icon="Delete"
                            divided
                          >
                            删除
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>
                </div>
                
                <div class="spec-meta">
                  <div class="spec-version">
                    <el-tag size="small" effect="plain">{{ spec.version }}</el-tag>
                  </div>
                  <div class="spec-date">
                    {{ formatDate(spec.lastModified) }}
                  </div>
                </div>
                
                <div class="spec-description" v-if="spec.description">
                  {{ spec.description }}
                </div>
                
                <div class="spec-stats">
                  <span class="stat-item">
                    <el-icon><Operation /></el-icon>
                    {{ spec.pathCount }} 路径
                  </span>
                  <span class="stat-item">
                    <el-icon><Tools /></el-icon>
                    {{ spec.toolCount }} 工具
                  </span>
                </div>
              </div>
              
              <el-empty 
                v-if="filteredSpecs.length === 0 && !specsLoading" 
                description="暂无OpenAPI规范"
                :image-size="100"
              />
            </div>
          </el-card>
        </el-col>

        <!-- 右侧：编辑器 -->
        <el-col :span="16">
          <el-card class="editor-card" v-if="selectedSpec">
            <template #header>
              <div class="card-header">
                <span>
                  <el-icon><Edit /></el-icon> 
                  {{ selectedSpec.name }}
                </span>
                <div class="editor-controls">
                  <el-button-group size="small">
                    <el-button 
                      :type="editorMode === 'edit' ? 'primary' : ''"
                      @click="editorMode = 'edit'"
                    >
                      编辑
                    </el-button>
                    <el-button 
                      :type="editorMode === 'preview' ? 'primary' : ''"
                      @click="editorMode = 'preview'"
                    >
                      预览
                    </el-button>
                    <el-button 
                      :type="editorMode === 'apis' ? 'primary' : ''"
                      @click="editorMode = 'apis'"
                    >
                      接口列表
                    </el-button>
                    <el-button 
                      :type="editorMode === 'tools' ? 'primary' : ''"
                      @click="editorMode = 'tools'"
                    >
                      MCP工具
                    </el-button>
                  </el-button-group>
                  <el-divider direction="vertical" />
                  <el-button 
                    size="small"
                    :icon="Check"
                    @click="validateSpec"
                    :loading="validating"
                  >
                    验证
                  </el-button>
                  <el-button 
                    size="small"
                    type="primary"
                    :icon="DocumentChecked"
                    @click="convertToMCP"
                    :loading="converting"
                  >
                    转换为MCP
                  </el-button>
                  <el-button 
                    size="small"
                    type="primary"
                    :icon="DocumentChecked"
                    @click="saveSpec"
                    :loading="saving"
                  >
                    保存
                  </el-button>
                </div>
              </div>
            </template>
            
            <!-- Monaco编辑器 -->
            <div class="editor-container" v-show="editorMode === 'edit'">
              <MonacoEditor
                v-model="specContent"
                language="yaml"
                :height="600"
                :options="editorOptions"
                @change="handleContentChange"
              />
            </div>
            
            <!-- 预览面板 -->
            <div class="preview-container" v-show="editorMode === 'preview'">
              <SpecPreview :spec="selectedSpec" :content="specContent" />
            </div>
            
            <!-- 接口列表 -->
            <div class="apis-container" v-show="editorMode === 'apis'">
              <div v-if="openApiStore.currentParsedResult" class="api-list">
                <div class="api-summary">
                  <el-alert
                    type="success"
                    :title="`共解析到 ${openApiStore.currentParsedResult.paths?.length || 0} 个接口`"
                    :closable="false"
                    style="margin-bottom: 16px;"
                  />
                </div>
                
                <el-table 
                  :data="openApiStore.currentParsedResult.paths || []"
                  stripe
                  style="width: 100%"
                  max-height="500"
                >
                  <el-table-column prop="method" label="方法" width="80">
                    <template #default="{ row }">
                      <el-tag 
                        :type="getMethodTagType(row.method)"
                        size="small"
                      >
                        {{ row.method.toUpperCase() }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  
                  <el-table-column prop="path" label="路径" min-width="200" />
                  
                  <el-table-column prop="summary" label="摘要" min-width="150" show-overflow-tooltip />
                  
                  <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
                  
                  <el-table-column prop="tags" label="标签" width="120">
                    <template #default="{ row }">
                      <el-tag 
                        v-for="tag in row.tags" 
                        :key="tag"
                        size="small"
                        effect="plain"
                        style="margin-right: 4px;"
                      >
                        {{ tag }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  
                  <el-table-column label="操作" width="100">
                    <template #default="{ row }">
                      <el-button 
                        size="small"
                        type="primary"
                        text
                        @click="viewApiDetail(row)"
                      >
                        详情
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
              
              <el-empty 
                v-else
                description="暂无解析结果，请先导入OpenAPI文件"
                :image-size="150"
              >
                <template #extra>
                  <el-button type="primary" @click="showUploadDialog = true">
                    上传文件
                  </el-button>
                </template>
              </el-empty>
            </div>
            
            <!-- MCP工具预览 -->
            <div class="tools-container" v-show="editorMode === 'tools'">
              <MCPToolPreview 
                :tools="mcpTools" 
                :loading="converting"
                @test-tool="handleTestTool"
              />
            </div>
            
            <!-- 验证结果 -->
            <div class="validation-results" v-if="validationResults">
              <el-alert
                :type="validationResults.valid ? 'success' : 'error'"
                :title="validationResults.valid ? '验证通过' : '验证失败'"
                :closable="false"
                style="margin-top: 16px;"
              >
                <div v-if="!validationResults.valid && validationResults.errors">
                  <div 
                    v-for="(error, index) in validationResults.errors" 
                    :key="index"
                    class="error-item"
                  >
                    <strong>{{ error.path }}</strong>: {{ error.message }}
                  </div>
                </div>
              </el-alert>
            </div>
          </el-card>
          
          <!-- 空状态 -->
          <el-card class="empty-editor" v-else>
            <el-empty 
              description="请选择一个OpenAPI规范进行编辑"
              :image-size="150"
            >
              <template #extra>
                <el-button type="primary" @click="showCreateDialog = true">
                  创建新规范
                </el-button>
              </template>
            </el-empty>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 创建规范对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      title="创建新的OpenAPI规范"
      width="600px"
      align-center
    >
      <el-form 
        ref="createFormRef"
        :model="createForm"
        :rules="createFormRules"
        label-width="100px"
      >
        <el-form-item label="规范名称" prop="name">
          <el-input 
            v-model="createForm.name"
            placeholder="请输入规范名称"
            clearable
          />
        </el-form-item>
        
        <el-form-item label="版本" prop="version">
          <el-input 
            v-model="createForm.version"
            placeholder="请输入版本号，如 1.0.0"
            clearable
          />
        </el-form-item>
        
        <el-form-item label="描述" prop="description">
          <el-input 
            v-model="createForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入描述信息"
          />
        </el-form-item>
        
        <el-form-item label="模板">
          <el-select 
            v-model="createForm.template"
            placeholder="选择模板（可选）"
            clearable
            style="width: 100%;"
          >
            <el-option label="空白模板" value="blank" />
            <el-option label="基础REST API" value="basic-rest" />
            <el-option label="电商API" value="ecommerce" />
            <el-option label="用户管理API" value="user-management" />
          </el-select>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="createNewSpec"
          :loading="creating"
        >
          创建
        </el-button>
      </template>
    </el-dialog>

    <!-- 文件上传对话框 -->
    <el-dialog
      v-model="showUploadDialog"
      title="上传OpenAPI文件"
      width="500px"
      align-center
    >
      <el-upload
        ref="uploadRef"
        class="upload-area"
        drag
        :auto-upload="false"
        :accept="'.yaml,.yml,.json'"
        :limit="1"
        :on-change="handleFileChange"
        :file-list="uploadFileList"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">
          将文件拖拽到此处，或<em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持 .yaml, .yml, .json 格式的文件，大小不超过 10MB
          </div>
        </template>
      </el-upload>
      
      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="uploadFile"
          :loading="uploading"
          :disabled="uploadFileList.length === 0"
        >
          上传
        </el-button>
      </template>
    </el-dialog>

    <!-- URL导入对话框 -->
    <el-dialog
      v-model="showUrlDialog"
      title="从URL导入OpenAPI规范"
      width="600px"
      align-center
    >
      <el-form 
        ref="urlFormRef"
        :model="urlForm"
        :rules="urlFormRules"
        label-width="80px"
      >
        <el-form-item label="URL地址" prop="url">
          <el-input 
            v-model="urlForm.url"
            placeholder="请输入OpenAPI规范的URL地址"
            clearable
          />
        </el-form-item>
        
        <el-form-item label="规范名称" prop="name">
          <el-input 
            v-model="urlForm.name"
            placeholder="请输入规范名称"
            clearable
          />
        </el-form-item>
        
        <el-form-item label="认证">
          <el-radio-group v-model="urlForm.authType">
            <el-radio label="none">无认证</el-radio>
            <el-radio label="bearer">Bearer Token</el-radio>
            <el-radio label="basic">Basic Auth</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item v-if="urlForm.authType === 'bearer'" label="Token">
          <el-input 
            v-model="urlForm.token"
            type="password"
            placeholder="请输入Bearer Token"
            show-password
          />
        </el-form-item>
        
        <el-form-item v-if="urlForm.authType === 'basic'" label="用户名">
          <el-input 
            v-model="urlForm.username"
            placeholder="请输入用户名"
          />
        </el-form-item>
        
        <el-form-item v-if="urlForm.authType === 'basic'" label="密码">
          <el-input 
            v-model="urlForm.password"
            type="password"
            placeholder="请输入密码"
            show-password
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showUrlDialog = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="importFromUrl"
          :loading="importing"
        >
          导入
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Plus, Upload, Link, Document, Search, MoreFilled, Edit, 
  DocumentCopy, Download, Delete, Operation, Tools, Check, 
  DocumentChecked, UploadFilled
} from '@element-plus/icons-vue'
import type { UploadFile, FormInstance } from 'element-plus'
import MonacoEditor from '@/shared/components/monaco/MonacoEditor.vue'
import SpecPreview from './components/openapi/SpecPreview.vue'
import MCPToolPreview from './components/openapi/MCPToolPreview.vue'
import type { OpenAPISpec, ValidationResult, MCPTool } from '@/types'
import { useOpenAPIStore } from '@/stores/openapi'
import { parseOpenAPI, validateOpenAPI } from '@/utils/openapi'

// 导入全局功能
import { useConfirmation } from '@/composables/useConfirmation'
import { useFormValidation } from '@/composables/useFormValidation'
import { usePerformanceMonitor } from '@/composables/usePerformance'
import LoadingOverlay from '@/shared/components/ui/LoadingOverlay.vue'

// 状态管理
const openApiStore = useOpenAPIStore()

// 全局功能
const { 
  confirmDelete: globalConfirmDelete, 
  confirmDangerousAction,
  confirmSave 
} = useConfirmation()

const { 
  startMonitoring,
  stopMonitoring,
  measureFunction 
} = usePerformanceMonitor()

// 响应式数据
const specsLoading = ref(false)
const searchQuery = ref('')
const selectedSpecId = ref<string | null>(null)
const editorMode = ref<'edit' | 'preview' | 'apis' | 'tools'>('edit')
const specContent = ref('')
const saving = ref(false)
const validating = ref(false)
const converting = ref(false)
const validationResults = ref<ValidationResult | null>(null)
const mcpTools = ref<any[]>([])  // MCP工具列表

// 对话框状态
const showCreateDialog = ref(false)
const showUploadDialog = ref(false)
const showUrlDialog = ref(false)
const creating = ref(false)
const uploading = ref(false)
const importing = ref(false)

// 表单引用
const createFormRef = ref<FormInstance>()
const urlFormRef = ref<FormInstance>()
const uploadRef = ref()

// 上传文件列表
const uploadFileList = ref<UploadFile[]>([])

// 表单数据
const createForm = ref({
  name: '',
  version: '1.0.0',
  description: '',
  template: ''
})

const urlForm = ref({
  url: '',
  name: '',
  authType: 'none',
  token: '',
  username: '',
  password: ''
})

// 表单验证规则
const createFormRules = {
  name: [
    { required: true, message: '请输入规范名称', trigger: 'blur' },
    { min: 2, max: 50, message: '名称长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  version: [
    { required: true, message: '请输入版本号', trigger: 'blur' },
    { pattern: /^\d+\.\d+\.\d+$/, message: '版本号格式不正确', trigger: 'blur' }
  ]
}

const urlFormRules = {
  url: [
    { required: true, message: '请输入URL地址', trigger: 'blur' },
    { type: 'url', message: '请输入有效的URL地址', trigger: 'blur' }
  ],
  name: [
    { required: true, message: '请输入规范名称', trigger: 'blur' }
  ]
}

// Monaco编辑器选项
const editorOptions = {
  theme: 'vs-dark',
  fontSize: 14,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  wordWrap: 'on' as const
}

// 计算属性
const filteredSpecs = computed(() => {
  if (!searchQuery.value) return openApiStore.specs
  
  const query = searchQuery.value.toLowerCase()
  return openApiStore.specs.filter(spec =>
    spec.name.toLowerCase().includes(query) ||
    spec.description?.toLowerCase().includes(query) ||
    spec.version.toLowerCase().includes(query)
  )
})

const selectedSpec = computed(() => {
  return openApiStore.specs.find(spec => spec.id === selectedSpecId.value) || null
})

// 方法
const formatDate = (date: Date | string) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dateObj)
}

const selectSpec = async (spec: OpenAPISpec) => {
  selectedSpecId.value = spec.id
  specContent.value = spec.content || ''
  validationResults.value = null
  
  // 加载规范内容
  try {
    const content = await openApiStore.getSpecContent(spec.id)
    specContent.value = content
  } catch (error) {
    ElMessage.error(`加载规范内容失败: ${error}`)
  }
}

const handleSpecAction = async (command: { action: string; spec: OpenAPISpec }) => {
  const { action, spec } = command
  
  switch (action) {
    case 'edit':
      await selectSpec(spec)
      editorMode.value = 'edit'
      break
      
    case 'duplicate':
      try {
        await openApiStore.duplicateSpec(spec.id)
        ElMessage.success('规范复制成功')
      } catch (error) {
        ElMessage.error(`复制失败: ${error}`)
      }
      break
      
    case 'download':
      downloadSpec(spec)
      break
      
    case 'delete':
      try {
        const confirmed = await globalConfirmDelete(spec.name)
        if (!confirmed) break
        
        await measureFunction('deleteSpec', async () => {
          await openApiStore.deleteSpec(spec.id)
        })
        
        if (selectedSpecId.value === spec.id) {
          selectedSpecId.value = null
          specContent.value = ''
        }
        ElMessage.success('规范删除成功')
      } catch (error) {
        ElMessage.error(`删除失败: ${error}`)
      }
      break
  }
}

const downloadSpec = (spec: OpenAPISpec) => {
  const blob = new Blob([spec.content || ''], {
    type: 'application/yaml'
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${spec.name}-${spec.version}.yaml`
  link.click()
  URL.revokeObjectURL(url)
  ElMessage.success('下载开始')
}

const handleContentChange = (content: string) => {
  specContent.value = content
  validationResults.value = null
}

const validateSpec = async () => {
  if (!specContent.value.trim()) {
    ElMessage.warning('请输入规范内容')
    return
  }
  
  validating.value = true
  try {
    const result = await measureFunction('validateSpec', async () => {
      return await validateOpenAPI(specContent.value)
    })
    validationResults.value = result
    
    if (result.valid) {
      ElMessage.success('规范验证通过')
    } else {
      ElMessage.error('规范验证失败，请查看详细错误信息')
    }
  } catch (error) {
    ElMessage.error(`验证失败: ${error}`)
  } finally {
    validating.value = false
  }
}

const saveSpec = async () => {
  if (!selectedSpec.value) return
  
  const confirmed = await confirmSave('是否保存对规范的修改？')
  if (!confirmed) return
  
  saving.value = true
  try {
    await measureFunction('saveSpec', async () => {
      await openApiStore.updateSpecContent(selectedSpec.value!.id, specContent.value)
    })
    ElMessage.success('保存成功')
  } catch (error) {
    ElMessage.error(`保存失败: ${error}`)
  } finally {
    saving.value = false
  }
}

const createNewSpec = async () => {
  if (!createFormRef.value) return
  
  try {
    await createFormRef.value.validate()
    creating.value = true
    
    const newSpec = await openApiStore.createSpec({
      name: createForm.value.name,
      version: createForm.value.version,
      description: createForm.value.description,
      template: createForm.value.template
    })
    
    selectedSpecId.value = newSpec.id
    specContent.value = newSpec.content || ''
    showCreateDialog.value = false
    
    // 重置表单
    createForm.value = {
      name: '',
      version: '1.0.0',
      description: '',
      template: ''
    }
    
    ElMessage.success('规范创建成功')
  } catch (error) {
    ElMessage.error(`创建失败: ${error}`)
  } finally {
    creating.value = false
  }
}

const handleFileChange = (file: UploadFile) => {
  uploadFileList.value = [file]
}

const uploadFile = async () => {
  if (uploadFileList.value.length === 0) return
  
  uploading.value = true
  try {
    const file = uploadFileList.value[0]
    const content = await readFileContent(file.raw!)
    
    // 首先使用后端 API 解析 OpenAPI 内容
    const parseResult = await openApiStore.parseOpenAPIContent(content)
    
    // 创建规范并保存解析结果
    const spec = await openApiStore.createSpecFromContent({
      name: file.name.replace(/\.(yaml|yml|json)$/, ''),
      content,
      fileName: file.name
    })
    
    // 保存解析后的接口列表到 store
    openApiStore.setCurrentParsedResult(parseResult)
    
    selectedSpecId.value = spec.id
    specContent.value = spec.content || ''
    showUploadDialog.value = false
    uploadFileList.value = []
    
    ElMessage.success(`文件上传成功！解析到 ${parseResult.paths?.length || 0} 个接口`)
  } catch (error) {
    ElMessage.error(`上传失败: ${error}`)
  } finally {
    uploading.value = false
  }
}

const importFromUrl = async () => {
  if (!urlFormRef.value) return
  
  try {
    await urlFormRef.value.validate()
    importing.value = true
    
    const authHeaders: Record<string, string> = {}
    
    if (urlForm.value.authType === 'bearer' && urlForm.value.token) {
      authHeaders['Authorization'] = `Bearer ${urlForm.value.token}`
    } else if (urlForm.value.authType === 'basic' && urlForm.value.username && urlForm.value.password) {
      const credentials = btoa(`${urlForm.value.username}:${urlForm.value.password}`)
      authHeaders['Authorization'] = `Basic ${credentials}`
    }

    // 先解析 OpenAPI 内容
    const parseResult = await openApiStore.parseOpenAPIFromUrl(urlForm.value.url, authHeaders)
    
    // 然后导入规范
    const spec = await openApiStore.importFromUrl({
      url: urlForm.value.url,
      name: urlForm.value.name,
      authType: urlForm.value.authType as 'none' | 'bearer' | 'basic',
      token: urlForm.value.token,
      username: urlForm.value.username,
      password: urlForm.value.password
    })
    
    // 保存解析结果
    openApiStore.setCurrentParsedResult(parseResult)
    
    selectedSpecId.value = spec.id
    specContent.value = spec.content || ''
    showUrlDialog.value = false
    
    // 重置表单
    urlForm.value = {
      url: '',
      name: '',
      authType: 'none',
      token: '',
      username: '',
      password: ''
    }
    
    ElMessage.success(`导入成功，解析到 ${parseResult.paths?.length || 0} 个接口`)
  } catch (error) {
    ElMessage.error(`导入失败: ${error}`)
  } finally {
    importing.value = false
  }
}

const readFileContent = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      resolve(e.target?.result as string)
    }
    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }
    reader.readAsText(file)
  })
}

// MCP相关方法
const convertToMCP = async () => {
  if (!selectedSpec.value) {
    ElMessage.warning('请先选择一个OpenAPI规范')
    return
  }
  
  converting.value = true
  try {
    // 首先验证当前规范
    const validation = validateOpenAPI(specContent.value)
    if (!validation.valid) {
      ElMessage.error('当前规范验证失败，请先修复错误')
      return
    }
    
    // 调用转换API
    const tools = await openApiStore.convertToMCP(selectedSpec.value)
    mcpTools.value = tools
    editorMode.value = 'tools'
    
    ElMessage.success(`成功转换为 ${tools.length} 个MCP工具`)
  } catch (error) {
    ElMessage.error(`转换失败: ${error instanceof Error ? error.message : error}`)
  } finally {
    converting.value = false
  }
}

const handleTestTool = async (tool: MCPTool, params: Record<string, any>) => {
  try {
    ElMessage.info(`正在测试工具: ${tool.name}`)
    // 这里可以集成实际的工具测试逻辑
    console.log('Testing tool:', tool, 'with params:', params)
  } catch (error) {
    ElMessage.error(`工具测试失败: ${error instanceof Error ? error.message : error}`)
  }
}

// 接口相关方法
const getMethodTagType = (method: string) => {
  const methodMap: Record<string, string> = {
    'get': 'success',
    'post': 'primary',
    'put': 'warning',
    'delete': 'danger',
    'patch': 'info',
    'head': '',
    'options': ''
  }
  return methodMap[method.toLowerCase()] || ''
}

const viewApiDetail = (api: any) => {
  ElMessageBox.alert(
    `<div>
      <p><strong>路径:</strong> ${api.path}</p>
      <p><strong>方法:</strong> ${api.method.toUpperCase()}</p>
      <p><strong>摘要:</strong> ${api.summary || '无'}</p>
      <p><strong>描述:</strong> ${api.description || '无'}</p>
      <p><strong>操作ID:</strong> ${api.operationId || '无'}</p>
      <p><strong>标签:</strong> ${api.tags?.join(', ') || '无'}</p>
    </div>`,
    '接口详情',
    {
      dangerouslyUseHTMLString: true,
      confirmButtonText: '确定'
    }
  )
}

// 生命周期
onMounted(async () => {
  specsLoading.value = true
  try {
    await openApiStore.fetchSpecs()
  } catch (error) {
    ElMessage.error(`加载规范列表失败: ${error}`)
  } finally {
    specsLoading.value = false
  }
})
</script>