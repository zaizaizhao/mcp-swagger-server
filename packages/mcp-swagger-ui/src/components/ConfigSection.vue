<template>
  <el-card class="config-section" shadow="hover">
    <template #header>
      <div class="card-header">
        <span>⚙️ 转换配置</span>
      </div>
    </template>

    <el-row :gutter="20">
      <!-- 端点过滤 -->
      <el-col :xs="24" :sm="12" :lg="6">
        <div class="config-card">
          <h4 class="config-title">🎯 端点过滤</h4>          <el-checkbox-group v-model="config.filters.methods">
            <el-checkbox value="GET">GET 方法</el-checkbox>
            <el-checkbox value="POST">POST 方法</el-checkbox>
            <el-checkbox value="PUT">PUT 方法</el-checkbox>
            <el-checkbox value="DELETE">DELETE 方法</el-checkbox>
            <el-checkbox value="PATCH">PATCH 方法</el-checkbox>
          </el-checkbox-group>
          <el-divider />
          <el-checkbox v-model="config.filters.includeDeprecated">
            包含已弃用的端点
          </el-checkbox>
        </div>
      </el-col>

      <!-- 标签过滤 -->
      <el-col :xs="24" :sm="12" :lg="6">
        <div class="config-card">
          <h4 class="config-title">🏷️ 标签过滤</h4>
          <div v-if="appStore.availableTags.length > 0">            <el-checkbox-group v-model="config.filters.tags">
              <el-checkbox
                v-for="tag in appStore.availableTags"
                :key="tag"
                :value="tag"
              >
                {{ tag }}
              </el-checkbox>
            </el-checkbox-group>
          </div>
          <div v-else class="no-tags">
            <el-text type="info">暂无可用标签</el-text>
          </div>
        </div>
      </el-col>

      <!-- 高级选项 -->
      <el-col :xs="24" :sm="12" :lg="6">
        <div class="config-card">
          <h4 class="config-title">🔧 高级选项</h4>
          <el-checkbox v-model="config.optimization.generateValidation">
            生成参数验证
          </el-checkbox>
          <el-checkbox v-model="config.optimization.includeExamples">
            包含响应示例
          </el-checkbox>
          <el-checkbox v-model="config.optimization.optimizeNames">
            优化工具名称
          </el-checkbox>
        </div>
      </el-col>

      <!-- 传输协议 -->
      <el-col :xs="24" :sm="12" :lg="6">
        <div class="config-card">
          <h4 class="config-title">🌐 传输协议</h4>
          <el-radio-group v-model="config.transport" direction="vertical">
            <el-radio label="stdio">
              <div class="radio-content">
                <div class="radio-title">stdio</div>
                <div class="radio-desc">标准输入输出</div>
              </div>
            </el-radio>
            <el-radio label="sse">
              <div class="radio-content">
                <div class="radio-title">SSE</div>
                <div class="radio-desc">服务器发送事件</div>
              </div>
            </el-radio>
            <el-radio label="streamable">
              <div class="radio-content">
                <div class="radio-title">HTTP Stream</div>
                <div class="radio-desc">流式HTTP</div>
              </div>
            </el-radio>
          </el-radio-group>
        </div>
      </el-col>
    </el-row>

    <!-- 配置预览 -->
    <el-divider />
    <div class="config-preview">
      <h4>📋 当前配置预览</h4>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="包含方法">
          <el-tag
            v-for="method in config.filters.methods"
            :key="method"
            :type="getMethodTagType(method)"
            size="small"
            style="margin-right: 5px"
          >
            {{ method }}
          </el-tag>
          <span v-if="config.filters.methods.length === 0">全部方法</span>
        </el-descriptions-item>
        
        <el-descriptions-item label="包含标签">
          <el-tag
            v-for="tag in config.filters.tags"
            :key="tag"
            type="info"
            size="small"
            style="margin-right: 5px"
          >
            {{ tag }}
          </el-tag>
          <span v-if="config.filters.tags.length === 0">全部标签</span>
        </el-descriptions-item>
        
        <el-descriptions-item label="传输协议">
          <el-tag :type="getTransportTagType(config.transport)">
            {{ getTransportLabel(config.transport) }}
          </el-tag>
        </el-descriptions-item>
        
        <el-descriptions-item label="高级选项">
          <div class="advanced-options">
            <el-tag v-if="config.optimization.generateValidation" type="success" size="small">
              参数验证
            </el-tag>
            <el-tag v-if="config.optimization.includeExamples" type="success" size="small">
              响应示例
            </el-tag>
            <el-tag v-if="config.optimization.optimizeNames" type="success" size="small">
              名称优化
            </el-tag>
            <span v-if="!hasAdvancedOptions">无</span>
          </div>
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <!-- 快速配置模板 -->
    <el-divider />
    <div class="quick-templates">
      <h4>🚀 快速配置模板</h4>
      <div class="template-buttons">
        <el-button @click="applyTemplate('minimal')" size="small">
          最小配置
        </el-button>
        <el-button @click="applyTemplate('standard')" size="small" type="primary">
          标准配置
        </el-button>
        <el-button @click="applyTemplate('comprehensive')" size="small" type="warning">
          完整配置
        </el-button>
        <el-button @click="resetConfig()" size="small" type="info">
          重置配置
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import type { ConvertConfig } from '@/types'

const appStore = useAppStore()

// 本地配置状态
const config = computed({
  get: () => appStore.config,
  set: (value: ConvertConfig) => appStore.setConfig(value)
})

// 监听配置变化，同步到 store
watch(config, (newConfig) => {
  appStore.setConfig(newConfig)
}, { deep: true })

// 是否有高级选项
const hasAdvancedOptions = computed(() => {
  const opts = config.value.optimization
  return opts.generateValidation || opts.includeExamples || opts.optimizeNames
})

// 获取方法标签类型
const getMethodTagType = (method: string) => {
  switch (method) {
    case 'GET': return 'success'
    case 'POST': return 'primary'
    case 'PUT': return 'warning'
    case 'DELETE': return 'danger'
    case 'PATCH': return 'info'
    default: return ''
  }
}

// 获取传输协议标签类型
const getTransportTagType = (transport: string) => {
  switch (transport) {
    case 'stdio': return 'success'
    case 'sse': return 'primary'
    case 'streamable': return 'warning'
    default: return ''
  }
}

// 获取传输协议标签
const getTransportLabel = (transport: string) => {
  switch (transport) {
    case 'stdio': return 'stdio (标准输入输出)'
    case 'sse': return 'SSE (服务器发送事件)'
    case 'streamable': return 'HTTP Stream (流式HTTP)'
    default: return transport
  }
}

// 应用配置模板
const applyTemplate = (template: string) => {
  switch (template) {
    case 'minimal':
      appStore.setConfig({
        filters: {
          methods: ['GET'],
          tags: [],
          includeDeprecated: false
        },
        transport: 'stdio',
        optimization: {
          generateValidation: false,
          includeExamples: false,
          optimizeNames: false
        }
      })
      break
      
    case 'standard':
      appStore.setConfig({
        filters: {
          methods: ['GET', 'POST'],
          tags: [],
          includeDeprecated: false
        },
        transport: 'sse',
        optimization: {
          generateValidation: true,
          includeExamples: false,
          optimizeNames: true
        }
      })
      break
      
    case 'comprehensive':
      appStore.setConfig({
        filters: {
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          tags: appStore.availableTags,
          includeDeprecated: true
        },
        transport: 'streamable',
        optimization: {
          generateValidation: true,
          includeExamples: true,
          optimizeNames: true
        }
      })
      break
  }
}

// 重置配置
const resetConfig = () => {
  appStore.setConfig({
    filters: {
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      tags: [],
      includeDeprecated: false
    },
    transport: 'stdio',
    optimization: {
      generateValidation: true,
      includeExamples: false,
      optimizeNames: true
    }
  })
}
</script>

<style scoped>
.config-section {
  margin-bottom: 30px;
}

.card-header {
  font-size: 1.2rem;
  font-weight: 600;
  color: #495057;
}

.config-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  height: 100%;
}

.config-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 15px;
  color: #495057;
}

.no-tags {
  padding: 20px;
  text-align: center;
}

:deep(.el-checkbox) {
  display: block;
  margin-bottom: 10px;
}

:deep(.el-radio) {
  display: block;
  margin-bottom: 15px;
  margin-right: 0;
}

.radio-content {
  margin-left: 5px;
}

.radio-title {
  font-weight: 600;
  color: #495057;
}

.radio-desc {
  font-size: 0.8rem;
  color: #6c757d;
}

.config-preview {
  margin-top: 20px;
}

.config-preview h4 {
  margin-bottom: 15px;
  color: #495057;
}

.advanced-options {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.quick-templates {
  margin-top: 20px;
}

.quick-templates h4 {
  margin-bottom: 15px;
  color: #495057;
}

.template-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .template-buttons {
    flex-direction: column;
  }
  
  .template-buttons .el-button {
    width: 100%;
  }
}
</style>
