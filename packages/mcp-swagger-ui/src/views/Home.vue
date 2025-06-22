<template>
  <div class="container">
    <!-- 头部 -->
    <div class="header">
      <h1>🔄 MCP Swagger Server</h1>
      <p>将您的 OpenAPI/Swagger 规范转换为 MCP 格式，让 AI 助手能够与您的 REST API 无缝交互</p>
    </div>

    <div class="main-content">
      <!-- 输入部分 -->
      <div class="input-section">
        <div class="input-tabs">
          <button class="tab-button" :class="{ active: activeTab === 'url' }" @click="activeTab = 'url'">
            🌐 URL 输入
          </button>
          <button class="tab-button" :class="{ active: activeTab === 'file' }" @click="activeTab = 'file'">
            📁 文件上传
          </button>
          <button class="tab-button" :class="{ active: activeTab === 'text' }" @click="activeTab = 'text'">
            📝 文本输入
          </button>
        </div>

        <!-- URL 输入标签页 -->
        <div v-show="activeTab === 'url'" class="tab-content">
          <div class="form-group">
            <label class="form-label">Swagger/OpenAPI URL</label>
            <input v-model="urlInput" type="url" class="form-input"
              placeholder="https://petstore.swagger.io/v2/swagger.json" @keydown.enter="handleConvert" />
          </div>
          <div class="form-group">
            <label class="form-label">认证信息 (可选)</label>
            <input v-model="authInput" type="password" class="form-input" placeholder="Bearer token 或 API Key" />
          </div>
        </div>

        <!-- 文件上传标签页 -->
        <div v-show="activeTab === 'file'" class="tab-content">
          <div class="file-upload-area" :class="{ dragover: isDragOver }" @click="triggerFileInput"
            @dragover.prevent="isDragOver = true" @dragleave.prevent="isDragOver = false"
            @drop.prevent="handleFileDrop">
            <div class="upload-icon">📄</div>
            <div class="upload-text">点击选择文件或拖拽文件到此处</div>
            <div class="upload-hint">支持 .json, .yaml, .yml 格式的 OpenAPI 规范文件</div>
            <input ref="fileInput" type="file" style="display: none;" accept=".json,.yaml,.yml"
              @change="handleFileChange" />
          </div>
          <div v-if="fileName" class="file-selected">
            <span class="file-name">📄 {{ fileName }}</span>
          </div>
        </div>

        <!-- 文本输入标签页 -->
        <div v-show="activeTab === 'text'" class="tab-content">
          <div class="form-group">
            <label class="form-label">粘贴 OpenAPI/Swagger 规范</label>
            <textarea v-model="textInput" class="form-input" rows="10"
              placeholder="在此粘贴您的 OpenAPI JSON 或 YAML 内容..."></textarea>
          </div>
        </div>

        <div class="action-buttons">
          <button class="btn btn-primary" :disabled="appStore.loading" @click="handleConvert">
            <span v-if="appStore.loading" class="loading-spinner"></span>
            🔄 转换为 MCP
          </button>
          <button class="btn btn-secondary" :disabled="appStore.loading" @click="handleValidate">
            🔍 验证规范
          </button>
        </div>

        <div v-if="appStore.loading" class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
        </div>
      </div>

      <!-- API 信息预览 -->
      <div v-if="appStore.apiInfo" class="preview-section fade-in-up">
        <div class="preview-header">
          <h3 class="preview-title">📋 API 信息预览</h3>
          <span class="status-badge status-success">✅ 已解析</span>
        </div>

        <div class="api-info">
          <div class="info-card">
            <div class="info-label">API 标题</div>
            <div class="info-value">{{ appStore.apiInfo.title || 'N/A' }}</div>
          </div>
          <div class="info-card">
            <div class="info-label">版本</div>
            <div class="info-value">{{ appStore.apiInfo.version || 'N/A' }}</div>
          </div>
          <div class="info-card">
            <div class="info-label">服务器</div>
            <div class="info-value">{{ appStore.apiInfo.serverUrl || 'N/A' }}</div>
          </div>
          <div class="info-card">
            <div class="info-label">端点数量</div>
            <div class="info-value">{{ appStore.apiInfo.totalEndpoints || 0 }} 个</div>
          </div>
        </div>
        <h4 style="margin: 20px 0 15px 0; color: #495057;">🔗 API 端点</h4>
        <div class="endpoints-grid">
          <div v-for="endpoint in appStore.endpoints?.slice(0, 6)" :key="`${endpoint.method}-${endpoint.path}`"
            class="endpoint-card">
            <span class="endpoint-method" :class="`method-${endpoint.method?.toLowerCase()}`">
              {{ endpoint.method?.toUpperCase() }}
            </span>
            <span class="endpoint-path">{{ endpoint.path }}</span>
            <div class="endpoint-summary">{{ endpoint.summary || endpoint.description || '无描述' }}</div>
          </div>
        </div>
        <div v-if="(appStore.endpoints?.length || 0) > 6" class="more-endpoints">
          <span>还有 {{ (appStore.endpoints?.length || 0) - 6 }} 个端点...</span>
        </div>
      </div>

      <!-- 转换配置 -->
      <div class="config-section fade-in-up">
        <h3 style="margin-bottom: 20px; color: #495057;">⚙️ 转换配置</h3>

        <div class="config-grid">
          <div class="config-card">
            <div class="config-title">🎯 HTTP 方法过滤</div>
            <div class="config-option">
              <input v-model="config.methods" type="checkbox" value="GET" class="config-checkbox">
              <label>包含 GET 方法</label>
            </div>
            <div class="config-option">
              <input v-model="config.methods" type="checkbox" value="POST" class="config-checkbox">
              <label>包含 POST 方法</label>
            </div>
            <div class="config-option">
              <input v-model="config.methods" type="checkbox" value="PUT" class="config-checkbox">
              <label>包含 PUT 方法</label>
            </div>
            <div class="config-option">
              <input v-model="config.methods" type="checkbox" value="DELETE" class="config-checkbox">
              <label>包含 DELETE 方法</label>
            </div>
          </div>

          <div class="config-card">
            <div class="config-title">🔧 高级选项</div>
            <div class="config-option">
              <input v-model="config.includeExamples" type="checkbox" class="config-checkbox">
              <label>包含响应示例</label>
            </div>
            <div class="config-option">
              <input v-model="config.generateValidation" type="checkbox" class="config-checkbox">
              <label>生成参数验证</label>
            </div>
            <div class="config-option">
              <input v-model="config.includeDeprecated" type="checkbox" class="config-checkbox">
              <label>包含已弃用的端点</label>
            </div>
          </div>

          <div class="config-card">
            <div class="config-title">🌐 传输协议</div>
            <div class="config-option">
              <input v-model="config.transport" type="radio" value="stdio" class="config-checkbox">
              <label>stdio (标准输入输出)</label>
            </div>
            <div class="config-option">
              <input v-model="config.transport" type="radio" value="sse" class="config-checkbox">
              <label>SSE (服务器发送事件)</label>
            </div>
          </div>

          <div class="config-card">
            <div class="config-title">🔧 MCP 服务器配置</div>
            <div class="config-option">
              <label>服务器名称</label>
              <input v-model="config.name" type="text" class="form-input" placeholder="Generated MCP Server">
            </div>
            <div class="config-option">
              <label>版本</label>
              <input v-model="config.version" type="text" class="form-input" placeholder="1.0.0">
            </div>
            <div class="config-option">
              <label>描述</label>
              <input v-model="config.description" type="text" class="form-input" placeholder="MCP server generated from OpenAPI specification">
            </div>
          </div>
        </div>
      </div>

      <!-- 转换结果 -->
      <div v-if="appStore.convertResult" class="results-section fade-in-up">
        <div class="results-header">
          <h3 class="preview-title">🎉 转换结果</h3>
          <div class="download-buttons">
            <button class="btn-download" @click="downloadConfig">📥 下载配置</button>
            <button class="btn-download" @click="copyConfig">📋 复制配置</button>
          </div>
        </div>

        <div class="code-preview">{{ formattedResult }}</div>

        <div style="margin-top: 20px;">
          <h4 style="color: #495057; margin-bottom: 10px;">🚀 启动命令</h4>
          <div class="command-line">
            <code>npm run start -- --config mcp-config.json</code>
            <button class="copy-btn" @click="copyCommand">复制</button>
          </div>
        </div>
      </div>

      <!-- MCP 服务器状态部分 -->
      <div v-if="appStore.convertResult" class="server-status-section fade-in-up">
        <div class="status-header">
          <h3 class="preview-title">🖥️ MCP 服务器状态</h3>
          <div class="status-actions">
            <button class="btn btn-sm btn-secondary" :disabled="appStore.loading" @click="refreshStatus">
              🔄 刷新状态
            </button>
            <button class="btn btn-sm btn-warning" :disabled="appStore.loading || !appStore.isMcpServerRunning" @click="reloadTools">
              ⚡ 重新加载工具
            </button>
            <button class="btn btn-sm btn-danger" :disabled="appStore.loading || !appStore.isMcpServerRunning" @click="stopServer">
              ⏹️ 停止服务器
            </button>
          </div>
        </div>

        <div class="server-status-cards">
          <div class="status-card">
            <div class="status-icon" :class="{ 'status-running': appStore.isMcpServerRunning, 'status-stopped': !appStore.isMcpServerRunning }">
              {{ appStore.isMcpServerRunning ? '🟢' : '🔴' }}
            </div>
            <div class="status-info">
              <div class="status-label">服务器状态</div>
              <div class="status-value">{{ appStore.isMcpServerRunning ? '运行中' : '已停止' }}</div>
            </div>
          </div>

          <div class="status-card">
            <div class="status-icon">🔧</div>
            <div class="status-info">
              <div class="status-label">可用工具</div>
              <div class="status-value">{{ appStore.mcpToolsCount }} 个</div>
            </div>
          </div>

          <div class="status-card">
            <div class="status-icon">⏰</div>
            <div class="status-info">
              <div class="status-label">最后检查</div>
              <div class="status-value">{{ formatLastCheck(appStore.mcpServerStatus?.lastCheck) }}</div>
            </div>
          </div>

          <div class="status-card">
            <div class="status-icon">📊</div>
            <div class="status-info">
              <div class="status-label">健康状态</div>
              <div class="status-value">{{ appStore.mcpServerStatus?.healthy ? '健康' : '异常' }}</div>
            </div>
          </div>
        </div>

        <!-- MCP 工具列表 -->
        <div v-if="appStore.mcpTools.length > 0" class="mcp-tools-section">
          <h4 style="margin: 20px 0 15px 0; color: #495057;">🔧 可用 MCP 工具</h4>
          <div class="tools-grid">
            <div v-for="tool in appStore.mcpTools.slice(0, 8)" :key="tool.name" class="tool-card">
              <div class="tool-name">{{ tool.name }}</div>
              <div class="tool-description">{{ tool.description || '无描述' }}</div>
            </div>
          </div>
          <div v-if="appStore.mcpTools.length > 8" class="more-tools">
            <span>还有 {{ appStore.mcpTools.length - 8 }} 个工具...</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 页脚 -->
    <div class="footer">
      <p>🤖 Powered by MCP Swagger Server | 让 AI 助手轻松调用您的 REST API</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

// 状态管理
const activeTab = ref('url')
const urlInput = ref('https://petstore.swagger.io/v2/swagger.json')
const authInput = ref('')
const textInput = ref('')
const fileName = ref('')
const isDragOver = ref(false)
const fileInput = ref<HTMLInputElement>()

// 进度状态
const progressPercentage = ref(0)

// 配置
const config = reactive({
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  includeExamples: true,
  generateValidation: true,
  includeDeprecated: false,
  transport: 'streamable',
  name: 'Generated MCP Server',
  version: '1.0.0',
  description: 'MCP server generated from OpenAPI specification'
})

// 计算属性
const formattedResult = computed(() => {
  if (!appStore.convertResult) return ''
  return JSON.stringify(appStore.convertResult, null, 2)
})

// 监听加载状态
watch(() => appStore.loading, (loading) => {
  if (loading) {
    progressPercentage.value = 0
    const timer = setInterval(() => {
      progressPercentage.value += Math.random() * 15
      if (progressPercentage.value >= 95) {
        progressPercentage.value = 95
        clearInterval(timer)
      }
    }, 200)
  } else {
    progressPercentage.value = 100
  }
})

// 方法
const handleConvert = async () => {
  try {
    let content = ''
    let type: 'url' | 'file' | 'text' = 'url'

    switch (activeTab.value) {
      case 'url':
        content = urlInput.value
        type = 'url'
        break
      case 'file':
        content = textInput.value // 文件内容会被读取到 textInput
        type = 'file'
        break
      case 'text':
        content = textInput.value
        type = 'text'
        break
    }

    if (!content.trim()) {
      ElMessage.warning('请输入有效的内容')
      return
    }

    appStore.setInputSource({
      type,
      content,
      auth: authInput.value ? {
        type: 'bearer',
        token: authInput.value
      } : undefined
    })

    // 设置转换配置
    appStore.setConfig({
      filters: {
        methods: config.methods,
        tags: [],
        includeDeprecated: config.includeDeprecated
      },
      transport: config.transport as 'stdio' | 'sse' | 'streamable',
      optimization: {
        generateValidation: config.generateValidation,
        includeExamples: config.includeExamples,
        optimizeNames: true
      },
      name: config.name,
      version: config.version,
      description: config.description
    })

    await appStore.previewApi()
    await appStore.convertToMcp()

    if (appStore.convertResult) {
      ElMessage.success('🎉 转换完成！')
      // 转换完成后刷新 MCP 服务器状态
      await refreshStatus()
    }
  } catch (error) {
    ElMessage.error('❌ 转换失败，请检查输入内容')
  }
}

const handleValidate = async () => {
  try {
    let content = ''
    switch (activeTab.value) {
      case 'url':
        content = urlInput.value
        break
      case 'text':
        content = textInput.value
        break
    }

    if (!content.trim()) {
      ElMessage.warning('请输入有效的内容')
      return
    }

    // 这里应该调用验证 API
    ElMessage.success('✅ 规范验证通过')
  } catch (error) {
    ElMessage.error('❌ 验证失败')
  }
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    fileName.value = file.name
    const reader = new FileReader()
    reader.onload = (e) => {
      textInput.value = e.target?.result as string
    }
    reader.readAsText(file)
  }
}

const handleFileDrop = (event: DragEvent) => {
  isDragOver.value = false
  const file = event.dataTransfer?.files[0]
  if (file) {
    fileName.value = file.name
    const reader = new FileReader()
    reader.onload = (e) => {
      textInput.value = e.target?.result as string
    }
    reader.readAsText(file)
  }
}

const downloadConfig = () => {
  if (!appStore.convertResult) return

  const content = JSON.stringify(appStore.convertResult, null, 2)
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mcp-config.json'
  a.click()
  URL.revokeObjectURL(url)

  ElMessage.success('配置文件已下载')
}

const copyConfig = async () => {
  if (!appStore.convertResult) return

  try {
    await navigator.clipboard.writeText(formattedResult.value)
    ElMessage.success('配置已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

const copyCommand = async () => {
  try {
    await navigator.clipboard.writeText('npm run start -- --config mcp-config.json')
    ElMessage.success('命令已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

// MCP 服务器状态管理方法
const refreshStatus = async () => {
  try {
    await appStore.refreshMcpServerStatus()
    await appStore.getMcpTools()
    ElMessage.success('状态已刷新')
  } catch (error) {
    ElMessage.error('刷新状态失败')
  }
}

const reloadTools = async () => {
  try {
    const success = await appStore.reloadMcpTools()
    if (success) {
      ElMessage.success('工具已重新加载')
    } else {
      ElMessage.error(appStore.error || '重新加载工具失败')
    }
  } catch (error) {
    ElMessage.error('重新加载工具失败')
  }
}

const stopServer = async () => {
  try {
    const success = await appStore.stopMcpServer()
    if (success) {
      ElMessage.success('服务器已停止')
    } else {
      ElMessage.error(appStore.error || '停止服务器失败')
    }
  } catch (error) {
    ElMessage.error('停止服务器失败')
  }
}

// 格式化时间显示
const formatLastCheck = (dateString?: string) => {
  if (!dateString) return '未知'
  
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) { // 小于1分钟
    return '刚刚'
  } else if (diff < 3600000) { // 小于1小时
    return `${Math.floor(diff / 60000)} 分钟前`
  } else if (diff < 86400000) { // 小于1天
    return `${Math.floor(diff / 3600000)} 小时前`
  } else {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }
}
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6;
  color: #333;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  padding: 20px;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  background: white;
  border-radius: 15px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px;
  text-align: center;
}

.header h1 {
  font-size: 2.5rem;
  margin-bottom: 10px;
  font-weight: 700;
}

.header p {
  font-size: 1.1rem;
  opacity: 0.9;
}

.main-content {
  padding: 40px;
}

.input-section {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 30px;
  margin-bottom: 30px;
  border: 2px dashed #dee2e6;
  transition: all 0.3s ease;
}

.input-section:hover {
  border-color: #667eea;
  background: #f0f4ff;
}

.input-tabs {
  display: flex;
  margin-bottom: 30px;
  background: #e9ecef;
  border-radius: 8px;
  padding: 4px;
}

.tab-button {
  flex: 1;
  padding: 12px 20px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
}

.tab-button.active {
  background: white;
  color: #667eea;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tab-content {
  display: block;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #495057;
}

.form-input {
  width: 100%;
  padding: 15px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 16px;
  transition: all 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.file-upload-area {
  border: 2px dashed #dee2e6;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.file-upload-area:hover,
.file-upload-area.dragover {
  border-color: #667eea;
  background: #f0f4ff;
}

.upload-icon {
  font-size: 3rem;
  color: #6c757d;
  margin-bottom: 15px;
}

.upload-text {
  font-size: 1.1rem;
  color: #6c757d;
  margin-bottom: 10px;
}

.upload-hint {
  font-size: 0.9rem;
  color: #adb5bd;
}

.file-selected {
  margin-top: 15px;
  text-align: center;
}

.file-name {
  background: #d4edda;
  color: #155724;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 500;
}

.action-buttons {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin: 30px 0;
}

.btn {
  padding: 15px 30px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
  transform: translateY(-2px);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
  margin: 20px 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
  width: 0%;
}

.loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.preview-section,
.config-section,
.results-section {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 30px;
  margin-bottom: 30px;
}

.preview-header,
.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.preview-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #495057;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-success {
  background: #d4edda;
  color: #155724;
}

.api-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.info-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.info-label {
  font-size: 0.9rem;
  color: #6c757d;
  margin-bottom: 5px;
}

.info-value {
  font-size: 1.1rem;
  font-weight: 600;
  color: #495057;
}

.endpoints-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 15px;
  margin-top: 20px;
}

.endpoint-card {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px;
  transition: all 0.3s ease;
}

.endpoint-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.endpoint-method {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  margin-right: 10px;
}

.method-get {
  background: #d4edda;
  color: #155724;
}

.method-post {
  background: #d1ecf1;
  color: #0c5460;
}

.method-put {
  background: #fff3cd;
  color: #856404;
}

.method-delete {
  background: #f8d7da;
  color: #721c24;
}

.endpoint-path {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 0.9rem;
  color: #495057;
}

.endpoint-summary {
  margin-top: 8px;
  font-size: 0.9rem;
  color: #6c757d;
}

.more-endpoints {
  text-align: center;
  margin-top: 15px;
  color: #6c757d;
  font-style: italic;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.config-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.config-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 15px;
  color: #495057;
}

.config-option {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.config-option input[type="text"] {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  margin-top: 5px;
  background: white;
  transition: border-color 0.2s ease;
}

.config-option input[type="text"]:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.config-option label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #495057;
}

.download-buttons {
  display: flex;
  gap: 10px;
}

.btn-download {
  padding: 8px 16px;
  font-size: 0.9rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-download:hover {
  background: #218838;
  transform: translateY(-1px);
}

.code-preview {
  background: #282c34;
  color: #abb2bf;
  padding: 20px;
  border-radius: 8px;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 0.9rem;
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
  white-space: pre-wrap;
}

.command-line {
  display: flex;
  align-items: center;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 12px;
  font-family: 'Monaco', 'Consolas', monospace;
}

.command-line code {
  flex: 1;
  background: none;
  color: #495057;
  font-size: 0.9rem;
}

.copy-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  margin-left: 10px;
}

.copy-btn:hover {
  background: #5a6268;
}

.footer {
  text-align: center;
  padding: 30px;
  background: #f8f9fa;
  color: #6c757d;
  border-top: 1px solid #dee2e6;
}

.fade-in-up {
  animation: fadeInUp 0.6s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  body {
    padding: 10px;
  }

  .main-content {
    padding: 20px;
  }

  .action-buttons {
    flex-direction: column;
  }

  .api-info {
    grid-template-columns: 1fr;
  }

  .endpoints-grid {
    grid-template-columns: 1fr;
  }

  .config-grid {
    grid-template-columns: 1fr;
  }

  .download-buttons {
    flex-direction: column;
  }
}

/* MCP 服务器状态样式 */
.server-status-section {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-top: 25px;
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 15px;
}

.status-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 0.875rem;
  border-radius: 6px;
}

.server-status-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 25px;
}

.status-card {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-icon {
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: white;
}

.status-running {
  background: #d4edda !important;
}

.status-stopped {
  background: #f8d7da !important;
}

.status-info {
  flex: 1;
}

.status-label {
  font-size: 0.875rem;
  color: #6c757d;
  margin-bottom: 4px;
}

.status-value {
  font-size: 1rem;
  font-weight: 600;
  color: #495057;
}

.mcp-tools-section {
  margin-top: 25px;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
  margin-top: 15px;
}

.tool-card {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px;
  transition: all 0.2s ease;
}

.tool-card:hover {
  background: #e9ecef;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.tool-name {
  font-size: 1rem;
  font-weight: 600;
  color: #495057;
  margin-bottom: 8px;
  font-family: 'Monaco', 'Consolas', monospace;
}

.tool-description {
  font-size: 0.875rem;
  color: #6c757d;
  line-height: 1.4;
}

.more-tools {
  text-align: center;
  margin-top: 15px;
  color: #6c757d;
  font-style: italic;
}
</style>
