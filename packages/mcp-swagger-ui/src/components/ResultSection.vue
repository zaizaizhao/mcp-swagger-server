<template>
  <el-card class="result-section" shadow="hover">
    <template #header>
      <div class="card-header">
        <span>📦 转换结果</span>
        <div class="header-actions">
          <el-button @click="downloadConfig" type="success" size="small">
            <el-icon><Download /></el-icon>
            下载配置
          </el-button>
          <el-button @click="copyToClipboard" type="primary" size="small">
            <el-icon><CopyDocument /></el-icon>
            复制代码
          </el-button>
          <el-button @click="startServer" type="warning" size="small">
            <el-icon><VideoPlay /></el-icon>
            启动服务
          </el-button>
        </div>
      </div>
    </template>

    <!-- 转换统计 -->
    <div class="conversion-stats">
      <el-row :gutter="20">
        <el-col :xs="24" :sm="8">
          <el-statistic
            title="总端点数"
            :value="result.metadata.stats.totalEndpoints"
            suffix="个"
          >
            <template #prefix>
              <el-icon><Connection /></el-icon>
            </template>
          </el-statistic>
        </el-col>
        <el-col :xs="24" :sm="8">
          <el-statistic
            title="转换工具数"
            :value="result.metadata.stats.convertedTools"
            suffix="个"
            class="success-stat"
          >
            <template #prefix>
              <el-icon><Tools /></el-icon>
            </template>
          </el-statistic>
        </el-col>
        <el-col :xs="24" :sm="8">
          <el-statistic
            title="处理时间"
            :value="result.processingTime"
            suffix="ms"
          >
            <template #prefix>
              <el-icon><Timer /></el-icon>
            </template>
          </el-statistic>
        </el-col>
      </el-row>
    </div>

    <!-- 代码预览选项卡 -->
    <el-divider />
    <el-tabs v-model="activeTab" type="border-card">
      <!-- MCP 配置 -->
      <el-tab-pane label="📋 MCP 配置" name="mcp-config">
        <div class="code-container">
          <div class="code-header">
            <span>mcp-config.json</span>
            <el-button @click="copyCode(mcpConfigCode)" size="small" text>
              <el-icon><CopyDocument /></el-icon>
              复制
            </el-button>
          </div>
          <div class="code-editor">
            <pre><code class="language-json">{{ mcpConfigCode }}</code></pre>
          </div>
        </div>
      </el-tab-pane>

      <!-- 工具列表 -->
      <el-tab-pane label="🔧 工具列表" name="tools">
        <div class="tools-list">
          <div class="list-header">
            <span>生成的 MCP 工具 ({{ result.mcpConfig.tools.length }} 个)</span>
            <el-input
              v-model="toolSearchQuery"
              placeholder="搜索工具..."
              size="small"
              style="width: 200px"
              clearable
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </div>
          
          <div class="tools-grid">
            <div
              v-for="(tool, index) in filteredTools"
              :key="tool.name"
              class="tool-card"
            >
              <div class="tool-header">
                <h4 class="tool-name">{{ tool.name }}</h4>
                <el-tag size="small">工具 {{ index + 1 }}</el-tag>
              </div>
              <p class="tool-description">{{ tool.description }}</p>
              <div class="tool-details">
                <el-collapse accordion>
                  <el-collapse-item title="查看输入模式" :name="tool.name">
                    <pre class="schema-code"><code class="language-json">{{ JSON.stringify(tool.inputSchema, null, 2) }}</code></pre>
                  </el-collapse-item>
                </el-collapse>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 启动脚本 -->
      <el-tab-pane label="🚀 启动脚本" name="startup">
        <div class="startup-scripts">
          <el-row :gutter="20">
            <el-col :xs="24" :lg="12">
              <div class="script-card">
                <h4>📝 package.json 脚本</h4>
                <div class="code-block">
                  <pre><code class="language-json">{{ packageJsonScript }}</code></pre>
                </div>
                <el-button @click="copyCode(packageJsonScript)" size="small">
                  <el-icon><CopyDocument /></el-icon>
                  复制脚本
                </el-button>
              </div>
            </el-col>
            <el-col :xs="24" :lg="12">
              <div class="script-card">
                <h4>💻 命令行启动</h4>
                <div class="code-block">
                  <pre><code class="language-bash">{{ startupCommand }}</code></pre>
                </div>
                <el-button @click="copyCode(startupCommand)" size="small">
                  <el-icon><CopyDocument /></el-icon>
                  复制命令
                </el-button>
              </div>
            </el-col>
          </el-row>
        </div>
      </el-tab-pane>

      <!-- 完整配置 -->
      <el-tab-pane label="📄 完整配置" name="full-config">
        <div class="code-container">
          <div class="code-header">
            <span>完整的 MCP 服务器配置</span>
            <el-button @click="copyCode(fullConfigCode)" size="small" text>
              <el-icon><CopyDocument /></el-icon>
              复制全部
            </el-button>
          </div>
          <div class="code-editor">
            <pre><code class="language-json">{{ fullConfigCode }}</code></pre>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 操作结果提示 -->
    <el-alert
      v-if="operationMessage"
      :title="operationMessage"
      :type="operationMessageType"
      show-icon
      :closable="false"
      class="operation-alert"
    />
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, defineProps } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Download,
  CopyDocument,
  VideoPlay,
  Connection,
  Tools,
  Timer,
  Search
} from '@element-plus/icons-vue'
import { downloadFile, copyToClipboard as copyToClipboardUtil } from '@/utils/api'
import type { ConvertResult } from '@/types'

// Props
const props = defineProps<{
  result: ConvertResult
}>()

// 响应式数据
const activeTab = ref('mcp-config')
const toolSearchQuery = ref('')
const operationMessage = ref('')
const operationMessageType = ref<'success' | 'error' | 'warning' | 'info'>('success')

// 计算属性
const result = computed(() => props.result)

// 过滤后的工具列表
const filteredTools = computed(() => {
  if (!toolSearchQuery.value) {
    return result.value.mcpConfig.tools
  }
  
  const query = toolSearchQuery.value.toLowerCase()
  return result.value.mcpConfig.tools.filter(tool => 
    tool.name.toLowerCase().includes(query) ||
    tool.description.toLowerCase().includes(query)
  )
})

// MCP 配置代码
const mcpConfigCode = computed(() => {
  return JSON.stringify(result.value.mcpConfig.mcpServers, null, 2)
})

// package.json 脚本
const packageJsonScript = computed(() => {
  return JSON.stringify({
    scripts: {
      "mcp:start": "node dist/index.js",
      "mcp:dev": "ts-node src/index.ts",
      "mcp:manager": "ts-node src/tools/mcp-manager.ts"
    }
  }, null, 2)
})

// 启动命令
const startupCommand = computed(() => {
  return `# 安装依赖
npm install

# 构建项目
npm run build

# 启动 MCP 服务器
npm run mcp:start

# 或使用管理器启动
npm run mcp:manager start`
})

// 完整配置代码
const fullConfigCode = computed(() => {
  return JSON.stringify(result.value, null, 2)
})

// 显示操作消息
const showOperationMessage = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
  operationMessage.value = message
  operationMessageType.value = type
  
  setTimeout(() => {
    operationMessage.value = ''
  }, 3000)
}

// 下载配置文件
const downloadConfig = () => {
  try {
    const config = {
      mcpServers: result.value.mcpConfig.mcpServers,
      tools: result.value.mcpConfig.tools,
      metadata: result.value.metadata
    }
    
    downloadFile(
      JSON.stringify(config, null, 2),
      'mcp-config.json',
      'application/json'
    )
    
    showOperationMessage('✅ 配置文件下载成功')
    ElMessage.success('配置文件已下载')
  } catch (error) {
    showOperationMessage('❌ 下载失败', 'error')
    ElMessage.error('下载失败')
  }
}

// 复制代码到剪贴板
const copyCode = async (code: string) => {
  try {
    const success = await copyToClipboardUtil(code)
    if (success) {
      showOperationMessage('✅ 代码已复制到剪贴板')
      ElMessage.success('代码已复制')
    } else {
      throw new Error('复制失败')
    }
  } catch (error) {
    showOperationMessage('❌ 复制失败', 'error')
    ElMessage.error('复制失败')
  }
}

// 复制到剪贴板（整体配置）
const copyToClipboard = async () => {
  await copyCode(fullConfigCode.value)
}

// 启动服务器
const startServer = () => {
  showOperationMessage('🚀 启动功能开发中...', 'info')
  ElMessage.info('启动功能开发中...')
}
</script>

<style scoped>
.result-section {
  margin-bottom: 30px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.2rem;
  font-weight: 600;
  color: #495057;
  flex-wrap: wrap;
  gap: 10px;
}

.header-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.conversion-stats {
  margin-bottom: 20px;
}

:deep(.el-statistic) {
  text-align: center;
}

.success-stat :deep(.el-statistic__number) {
  color: #67c23a;
}

.code-container {
  position: relative;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: #f5f5f5;
  border-bottom: 1px solid #e4e7ed;
  font-weight: 600;
}

.code-editor {
  max-height: 400px;
  overflow: auto;
  background: #282c34;
  color: #abb2bf;
  padding: 20px;
}

.code-editor pre {
  margin: 0;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 0.9rem;
  line-height: 1.4;
}

.tools-list {
  padding: 20px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  font-weight: 600;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.tool-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 20px;
  background: #fafafa;
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.tool-name {
  margin: 0;
  font-size: 1.1rem;
  color: #303133;
}

.tool-description {
  color: #606266;
  margin-bottom: 15px;
  line-height: 1.4;
}

.schema-code {
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 0.8rem;
  max-height: 200px;
  overflow: auto;
}

.startup-scripts {
  padding: 20px;
}

.script-card {
  background: #fafafa;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
}

.script-card h4 {
  margin-bottom: 15px;
  color: #303133;
}

.code-block {
  background: #f5f5f5;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 15px;
}

.code-block pre {
  margin: 0;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 0.9rem;
  line-height: 1.4;
}

.operation-alert {
  margin-top: 20px;
}

@media (max-width: 768px) {
  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .header-actions {
    width: 100%;
    justify-content: flex-start;
  }
  
  .tools-grid {
    grid-template-columns: 1fr;
  }
  
  .list-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .list-header .el-input {
    width: 100% !important;
  }
}
</style>
