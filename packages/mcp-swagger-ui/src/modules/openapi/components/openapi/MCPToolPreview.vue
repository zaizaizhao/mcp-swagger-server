<template>
  <div class="mcp-tool-preview">
    <el-card v-if="!tools || tools.length === 0" shadow="never" class="empty-state">
      <div class="empty-content">
        <el-icon size="64" class="empty-icon">
          <Tools />
        </el-icon>
        <p class="empty-text">还没有转换的MCP工具</p>
        <p class="empty-description">选择一个有效的OpenAPI规范并点击"转换为MCP工具"</p>
      </div>
    </el-card>

    <template v-else>
      <!-- 工具统计 -->
      <el-card shadow="never" class="stats-card">
        <template #header>
          <div class="card-header">
            <h3>转换统计</h3>
            <el-tag type="success" size="large">
              {{ tools.length }} 个工具
            </el-tag>
          </div>
        </template>

        <el-row :gutter="20">
          <el-col :span="6">
            <el-statistic 
              title="GET 方法" 
              :value="getMethodCount('get')" 
              suffix="个"
            />
          </el-col>
          <el-col :span="6">
            <el-statistic 
              title="POST 方法" 
              :value="getMethodCount('post')" 
              suffix="个"
            />
          </el-col>
          <el-col :span="6">
            <el-statistic 
              title="PUT 方法" 
              :value="getMethodCount('put')" 
              suffix="个"
            />
          </el-col>
          <el-col :span="6">
            <el-statistic 
              title="DELETE 方法" 
              :value="getMethodCount('delete')" 
              suffix="个"
            />
          </el-col>
        </el-row>
      </el-card>

      <!-- 工具列表 -->
      <el-card shadow="never" class="tools-list">
        <template #header>
          <div class="card-header">
            <h3>MCP工具列表</h3>
            <div class="header-actions">
              <el-input
                v-model="searchText"
                placeholder="搜索工具..."
                size="small"
                style="width: 200px"
                clearable
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
              <el-select
                v-model="selectedMethod"
                placeholder="筛选方法"
                size="small"
                style="width: 120px"
                clearable
              >
                <el-option label="全部" value="" />
                <el-option label="GET" value="get" />
                <el-option label="POST" value="post" />
                <el-option label="PUT" value="put" />
                <el-option label="DELETE" value="delete" />
                <el-option label="PATCH" value="patch" />
              </el-select>
            </div>
          </div>
        </template>

        <div class="tools-grid">
          <div 
            v-for="(tool, index) in filteredTools" 
            :key="`${tool.id || tool.name}-${index}`"
            class="tool-card"
            @click="selectTool(tool)"
            :class="{ 'selected': selectedTool?.name === tool.name }"
          >
            <div class="tool-header">
              <div class="tool-title">
                <el-icon class="tool-icon"><Setting /></el-icon>
                <span class="tool-name">{{ tool.name }}</span>
              </div>
              <el-tag 
                :type="getMethodType(tool.method || 'get')"
                size="small"
                class="method-tag"
              >
                {{ (tool.method || 'GET').toUpperCase() }}
              </el-tag>
            </div>

            <div class="tool-description">
              {{ tool.description || '暂无描述' }}
            </div>

            <div class="tool-meta">
              <div class="tool-endpoint">
                <el-icon><Link /></el-icon>
                <code>{{props.serverUrl + (tool.endpoint || tool.path || '/')}}</code>
              </div>
              <div v-if="tool.parameters && tool.parameters.properties && Object.keys(tool.parameters.properties).length > 0" class="tool-params">
                <el-icon><List /></el-icon>
                <span>{{ Object.keys(tool.parameters.properties).length }} 个参数</span>
              </div>
            </div>

            <div class="tool-actions">
              <el-button 
                type="primary" 
                size="small" 
                @click.stop="testTool(tool)"
              >
                <el-icon><VideoPlay /></el-icon>
                测试
              </el-button>
              <el-button 
                size="small" 
                @click.stop="copyToolConfig(tool)"
              >
                <el-icon><CopyDocument /></el-icon>
                复制配置
              </el-button>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 工具详情 -->
      <el-card v-if="selectedTool" shadow="never" class="tool-detail">
        <template #header>
          <div class="card-header">
            <h3>{{ selectedTool.name }} - 详细信息</h3>
            <el-button 
              size="small"
              @click="selectedTool = null"
            >
              <el-icon><Close /></el-icon>
              关闭
            </el-button>
          </div>
        </template>

        <el-tabs v-model="activeTab" type="border-card">
          <!-- 基本信息 -->
          <el-tab-pane label="基本信息" name="basic">
            <div class="tool-basic-info">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="工具名称">
                  {{ selectedTool.name }}
                </el-descriptions-item>
                <el-descriptions-item label="HTTP方法">
                  <el-tag :type="getMethodType(selectedTool.method || 'get')">
                    {{ (selectedTool.method || 'GET').toUpperCase() }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="端点路径">
                  <code>{{ selectedTool.endpoint || selectedTool.path || '/' }}</code>
                </el-descriptions-item>
                <el-descriptions-item label="参数数量">
                  {{ selectedTool.parameters?.properties ? Object.keys(selectedTool.parameters.properties).length : 0 }} 个
                </el-descriptions-item>
                <el-descriptions-item label="描述" :span="2">
                  {{ selectedTool.description || '暂无描述' }}
                </el-descriptions-item>
              </el-descriptions>
            </div>
          </el-tab-pane>

          <!-- 参数详情 -->
          <el-tab-pane label="参数详情" name="parameters">
            <div v-if="!selectedTool.parameters || !selectedTool.parameters.properties || Object.keys(selectedTool.parameters.properties).length === 0" class="no-params">
              <el-empty description="此工具不需要参数" />
            </div>
            <div v-else class="params-list">
              <div 
                v-for="(param, paramName) in selectedTool.parameters.properties" 
                :key="paramName"
                class="param-item"
              >
                <div class="param-header">
                  <span class="param-name">{{ paramName }}</span>
                  <el-tag 
                    v-if="selectedTool.parameters.required?.includes(paramName)" 
                    type="danger" 
                    size="small"
                  >
                    必需
                  </el-tag>
                  <el-tag 
                    v-else 
                    type="info" 
                    size="small"
                  >
                    可选
                  </el-tag>
                  <el-tag 
                    type="warning" 
                    size="small"
                  >
                    {{ param.type || 'string' }}
                  </el-tag>
                </div>
                <div v-if="param.description" class="param-description">
                  {{ param.description }}
                </div>
                <div v-if="param.default !== undefined" class="param-default">
                  默认值: <code>{{ param.default }}</code>
                </div>
                <div v-if="param.enum && param.enum.length > 0" class="param-enum">
                  可选值: 
                  <el-tag 
                    v-for="value in param.enum" 
                    :key="value"
                    size="small"
                    style="margin-left: 4px"
                  >
                    {{ value }}
                  </el-tag>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- JSON Schema -->
          <el-tab-pane label="JSON Schema" name="schema">
            <div class="schema-container">
              <el-button 
                type="primary" 
                size="small" 
                @click="copySchema"
                style="margin-bottom: 12px"
              >
                <el-icon><CopyDocument /></el-icon>
                复制Schema
              </el-button>
              <el-input
                v-model="schemaText"
                type="textarea"
                :rows="20"
                readonly
                class="schema-textarea"
              />
            </div>
          </el-tab-pane>

          <!-- MCP配置 -->
          <el-tab-pane label="MCP配置" name="mcp-config">
            <div class="mcp-config-container">
              <el-button 
                type="primary" 
                size="small" 
                @click="copyMCPConfig"
                style="margin-bottom: 12px"
              >
                <el-icon><CopyDocument /></el-icon>
                复制MCP配置
              </el-button>
              <el-input
                v-model="mcpConfigText"
                type="textarea"
                :rows="20"
                readonly
                class="config-textarea"
              />
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </template>

    <!-- 工具测试对话框 -->
    <el-dialog
      v-model="testDialogVisible"
      title="测试MCP工具"
      width="800px"
      destroy-on-close
    >
      <div v-if="testingTool" class="test-container">
        <el-form :model="testForm" label-width="120px">
          <el-form-item 
            v-for="(param, paramName) in testingTool.parameters?.properties" 
            :key="paramName"
            :label="paramName"
            :required="testingTool.parameters?.required?.includes(paramName)"
          >
            <el-input
              v-model="testForm[paramName]"
              :placeholder="param.description || `请输入${paramName}`"
              :type="param.type === 'integer' || param.type === 'number' ? 'number' : 'text'"
            />
            <div v-if="param.description" class="param-help">
              {{ param.description }}
            </div>
          </el-form-item>
        </el-form>

        <div class="test-result" v-if="testResult">
          <h4>测试结果:</h4>
          <el-input
            v-model="testResult"
            type="textarea"
            :rows="10"
            readonly
          />
        </div>
      </div>

      <template #footer>
        <el-button @click="testDialogVisible = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="executeTest"
          :loading="testing"
        >
          执行测试
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Tools, Search, Setting, Link, List, VideoPlay, CopyDocument, Close
} from '@element-plus/icons-vue'
import type { MCPTool } from '@/types'
import { simulateMCPToolExecution, generateToolConfig, generateToolSchema } from '@/utils/mcp-tools'

interface Props {
  tools?: MCPTool[]
  loading?: boolean
  serverUrl?: string
}

interface Emits {
  (e: 'test-tool', tool: MCPTool, params: Record<string, any>): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 状态
const searchText = ref('')
const selectedMethod = ref('')
const selectedTool = ref<MCPTool | null>(null)
const activeTab = ref('basic')
const testDialogVisible = ref(false)
const testingTool = ref<MCPTool | null>(null)
const testForm = ref<Record<string, any>>({})
const testResult = ref('')
const testing = ref(false)

// 数据转换：将用户传入的数据格式转换为组件期望的格式
const normalizedTools = computed(() => {
  if (!props.tools) {
    return []
  }

  
  const normalized = props.tools.map((tool, index) => {
    // 如果已经是正确格式，直接返回
    if (tool.method && tool.parameters) {
      console.log(`MCPToolPreview: Tool ${index} already in correct format`)
      return tool
    }
    
    // 转换用户传入的格式
    const normalizedTool: MCPTool = {
      id: tool.id || tool.name,
      name: tool.name,
      description: tool.description,
      // 从 metadata 中获取 method 和 path
      method: (tool as any).metadata?.method?.toLowerCase() || 'get',
      endpoint: (tool as any).metadata?.path || '/',
      path: (tool as any).metadata?.path || '/',
      // 将 inputSchema 转换为 parameters
      parameters: (tool as any).inputSchema || {
        type: 'object',
        properties: {},
        required: []
      },
      serverId: tool.serverId || 'default'
    }
    
    console.log(`MCPToolPreview: Normalized tool ${index}:`, normalizedTool)
    return normalizedTool
  })
  return normalized
})

// 计算属性
const filteredTools = computed(() => {
  console.log("normalizedTools",normalizedTools.value);
  
  if (!normalizedTools.value) {
    return []
  }
  
  const filtered = normalizedTools.value.filter(tool => {
    const matchesSearch = !searchText.value || 
      tool.name.toLowerCase().includes(searchText.value.toLowerCase()) ||
      (tool.description && tool.description.toLowerCase().includes(searchText.value.toLowerCase()))
    
    const matchesMethod = !selectedMethod.value || 
      (tool.method && tool.method.toLowerCase() === selectedMethod.value.toLowerCase())
    
    const matches = matchesSearch && matchesMethod
    return matches
  })
  console.log("filters",props.serverUrl);
  
  return filtered
})

const schemaText = computed(() => {
  if (!selectedTool.value) {
    return JSON.stringify({ type: 'object', properties: {}, required: [] }, null, 2)
  }
  
  return generateToolSchema(selectedTool.value)
})

const mcpConfigText = computed(() => {
  if (!selectedTool.value) return ''
  
  return generateToolConfig(selectedTool.value)
})

// 方法
const getMethodCount = (method: string) => {
  if (!normalizedTools.value) return 0
  return normalizedTools.value.filter(tool => tool.method && tool.method.toLowerCase() === method).length
}

const getMethodType = (method: string) => {
  switch (method.toLowerCase()) {
    case 'get': return 'success'
    case 'post': return 'primary'
    case 'put': return 'warning'
    case 'delete': return 'danger'
    case 'patch': return 'info'
    default: return ''
  }
}

const selectTool = (tool: MCPTool) => {
  selectedTool.value = tool
  activeTab.value = 'basic'
}

const testTool = (tool: MCPTool) => {
  testingTool.value = tool
  testForm.value = {}
  testResult.value = ''
  
  // 初始化表单默认值
  if (tool.parameters && tool.parameters.properties) {
    Object.entries(tool.parameters.properties).forEach(([paramName, param]) => {
      if (param.default !== undefined) {
        testForm.value[paramName] = param.default
      }
    })
  }
  
  testDialogVisible.value = true
}

const executeTest = async () => {
  if (!testingTool.value) return
  
  testing.value = true
  try {
    // 使用MCP工具执行函数
    const result = await simulateMCPToolExecution(testingTool.value, testForm.value)
    
    if (result.success) {
      testResult.value = JSON.stringify({
        success: true,
        tool: testingTool.value.name,
        result: result.result
      }, null, 2)
      emit('test-tool', testingTool.value, testForm.value)
      ElMessage.success('工具测试成功')
    } else {
      testResult.value = JSON.stringify({
        success: false,
        tool: testingTool.value.name,
        error: result.error
      }, null, 2)
      ElMessage.error(result.error || '工具测试失败')
    }
  } catch (error) {
    testResult.value = JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, null, 2)
    ElMessage.error('工具测试失败')
  } finally {
    testing.value = false
  }
}

const copyToolConfig = async (tool: MCPTool) => {
  const config = {
    name: tool.name,
    description: tool.description,
    method: tool.method,
    endpoint: tool.endpoint || tool.path,
    parameters: tool.parameters
  }
  
  try {
    await navigator.clipboard.writeText(JSON.stringify(config, null, 2))
    ElMessage.success('工具配置已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

const copySchema = async () => {
  try {
    await navigator.clipboard.writeText(schemaText.value)
    ElMessage.success('Schema已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

const copyMCPConfig = async () => {
  try {
    await navigator.clipboard.writeText(mcpConfigText.value)
    ElMessage.success('MCP配置已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

// 监听工具变化，重置选择
watch(() => props.tools, () => {
  selectedTool.value = null
})

// 监听转换后的工具变化，重置选择
watch(() => normalizedTools.value, () => {
  selectedTool.value = null
})
</script>

<style scoped>
.mcp-tool-preview {
  height: 100%;
  overflow-y: auto;
}

.mcp-tool-preview .el-card {
  margin-bottom: 16px;
}

.mcp-tool-preview .el-card:last-child {
  margin-bottom: 0;
}

/* 空状态 */
.empty-state {
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-content {
  text-align: center;
}

.empty-icon {
  color: var(--el-text-color-placeholder);
  margin-bottom: 16px;
}

.empty-text {
  color: var(--el-text-color-primary);
  font-size: 16px;
  margin: 0 0 8px 0;
}

.empty-description {
  color: var(--el-text-color-regular);
  font-size: 14px;
  margin: 0;
}

/* 卡片头部 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 工具网格 */
.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  max-height: 600px;
  overflow-y: auto;
  padding-right: 4px;
}

.tools-grid::-webkit-scrollbar {
  width: 6px;
}

.tools-grid::-webkit-scrollbar-track {
  background: var(--el-fill-color-lighter);
  border-radius: 3px;
}

.tools-grid::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 3px;
}

.tools-grid::-webkit-scrollbar-thumb:hover {
  background: var(--el-border-color-dark);
}

.tool-card {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 16px;
  background-color: var(--el-bg-color);
  cursor: pointer;
  transition: all 0.3s;
}

.tool-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.tool-card.selected {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.tool-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-icon {
  color: var(--el-color-primary);
}

.tool-name {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.method-tag {
  font-weight: 600;
}

.tool-description {
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tool-meta {
  margin-bottom: 12px;
}

.tool-endpoint,
.tool-params {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.tool-endpoint code {
  background-color: var(--el-fill-color-light);
  padding: 2px 4px;
  border-radius: 3px;
  font-family: monospace;
}

.tool-actions {
  display: flex;
  gap: 8px;
}

.tool-actions .el-button {
  flex: 1;
}

/* 工具详情 */
.tool-basic-info {
  margin-top: 16px;
}

.params-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.param-item {
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background-color: var(--el-bg-color-page);
}

.param-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.param-name {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.param-description {
  color: var(--el-text-color-regular);
  font-size: 13px;
  margin-bottom: 8px;
}

.param-default {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.param-default code {
  background-color: var(--el-fill-color-light);
  padding: 2px 4px;
  border-radius: 3px;
  font-family: monospace;
}

.param-enum {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.no-params {
  padding: 40px;
}

/* Schema和配置 */
.schema-container,
.mcp-config-container {
  margin-top: 16px;
}

.schema-textarea,
.config-textarea {
  font-family: monospace;
  font-size: 12px;
}

/* 测试对话框 */
.test-container {
  max-height: 500px;
  overflow-y: auto;
}

.param-help {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.test-result {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color-light);
}

.test-result h4 {
  margin: 0 0 12px 0;
  color: var(--el-text-color-primary);
}
</style>
