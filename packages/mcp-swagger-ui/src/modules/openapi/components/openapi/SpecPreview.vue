<template>
  <div class="spec-preview">
    <el-card v-if="!spec" shadow="never" class="empty-state">
      <div class="empty-content">
        <el-icon size="64" class="empty-icon">
          <Document />
        </el-icon>
        <p class="empty-text">选择一个OpenAPI规范来预览</p>
      </div>
    </el-card>

    <template v-else>
      <!-- 规范信息 -->
      <el-card shadow="never" class="spec-info">
        <template #header>
          <div class="card-header">
            <h3>{{ spec.name }}</h3>
            <div class="header-actions">
              <el-tag 
                :type="getStatusType(spec.validationStatus)"
                size="small"
              >
                {{ getStatusText(spec.validationStatus) }}
              </el-tag>
              <el-button
                type="primary"
                size="small"
                @click="$emit('convert')"
              >
                <el-icon><Tools /></el-icon>
                转换为MCP工具
              </el-button>
            </div>
          </div>
        </template>

        <div class="spec-metadata">
          <el-row :gutter="16">
            <el-col :span="6">
              <el-statistic title="版本" :value="spec.version" />
            </el-col>
            <el-col :span="6">
              <el-statistic title="API路径" :value="spec.pathCount" suffix="个" />
            </el-col>
            <el-col :span="6">
              <el-statistic title="MCP工具" :value="spec.toolCount" suffix="个" />
            </el-col>
            <el-col :span="6">
              <el-statistic title="更新时间" :value="formatDate(spec.lastModified)" />
            </el-col>
          </el-row>

          <div v-if="spec.description" class="spec-description">
            <h4>描述</h4>
            <p>{{ spec.description }}</p>
          </div>
        </div>
      </el-card>

      <!-- 验证结果 -->
      <el-card v-if="validationResult" shadow="never" class="validation-result">
        <template #header>
          <div class="card-header">
            <h4>验证结果</h4>
            <el-tag 
              :type="validationResult.valid ? 'success' : 'danger'"
              size="small"
            >
              {{ validationResult.valid ? '验证通过' : '验证失败' }}
            </el-tag>
          </div>
        </template>

        <!-- 错误列表 -->
        <div v-if="validationResult.errors && validationResult.errors.length > 0" class="error-list">
          <h5 class="error-title">
            <el-icon color="#f56c6c"><WarnTriangleFilled /></el-icon>
            错误 ({{ validationResult.errors.length }})
          </h5>
          <div class="error-items">
            <div 
              v-for="(error, index) in validationResult.errors" 
              :key="index"
              class="error-item"
            >
              <div class="error-location" v-if="error.path">
                {{ error.path }}
              </div>
              <div class="error-message">{{ error.message }}</div>
              <div v-if="error.code" class="error-code">错误代码: {{ error.code }}</div>
            </div>
          </div>
        </div>

        <!-- 警告列表 -->
        <div v-if="validationResult.warnings && validationResult.warnings.length > 0" class="warning-list">
          <h5 class="warning-title">
            <el-icon color="#e6a23c"><Warning /></el-icon>
            警告 ({{ validationResult.warnings.length }})
          </h5>
          <div class="warning-items">
            <div 
              v-for="(warning, index) in validationResult.warnings" 
              :key="index"
              class="warning-item"
            >
              <div class="warning-location" v-if="warning.path">
                {{ warning.path }}
              </div>
              <div class="warning-message">{{ warning.message }}</div>
              <div v-if="warning.code" class="warning-code">警告代码: {{ warning.code }}</div>
            </div>
          </div>
        </div>

        <!-- 成功状态 -->
        <div v-if="validationResult.valid && (!validationResult.errors || validationResult.errors.length === 0)" class="success-state">
          <el-icon color="#67c23a" size="24"><SuccessFilled /></el-icon>
          <span>OpenAPI规范验证通过，可以安全使用</span>
        </div>
      </el-card>

      <!-- API路径预览 -->
      <el-card v-if="apiPaths && apiPaths.length > 0" shadow="never" class="api-paths">
        <template #header>
          <h4>API路径预览</h4>
        </template>

        <div class="path-list">
          <div 
            v-for="(path, index) in apiPaths" 
            :key="index"
            class="path-item"
          >
            <div class="path-header">
              <el-tag 
                :type="getMethodType(path.method)"
                size="small"
                class="method-tag"
              >
                {{ path.method.toUpperCase() }}
              </el-tag>
              <code class="path-url">{{ path.path }}</code>
            </div>
            <div v-if="path.summary" class="path-summary">{{ path.summary }}</div>
            <div v-if="path.description" class="path-description">{{ path.description }}</div>
          </div>
        </div>
      </el-card>

      <!-- MCP工具预览 -->
      <el-card v-if="mcpTools && mcpTools.length > 0" shadow="never" class="mcp-tools">
        <template #header>
          <h4>MCP工具预览</h4>
        </template>

        <div class="tool-list">
          <div 
            v-for="(tool, index) in mcpTools" 
            :key="index"
            class="tool-item"
          >
            <div class="tool-header">
              <el-icon><Setting /></el-icon>
              <span class="tool-name">{{ tool.name }}</span>
            </div>
            <div v-if="tool.description" class="tool-description">{{ tool.description }}</div>
            <div class="tool-meta">
              <el-tag size="small" type="info">{{ tool.method }}</el-tag>
              <span class="tool-path">{{ tool.endpoint || '' }}</span>
            </div>
          </div>
        </div>
      </el-card>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { Document, Tools, WarnTriangleFilled, Warning, SuccessFilled, Setting } from '@element-plus/icons-vue'
import type { OpenAPISpec, ValidationResult, MCPTool } from '@/types'
import { formatDate } from '@/utils/date'

interface ApiPath {
  method: string
  path: string
  summary?: string
  description?: string
}

interface Props {
  spec?: OpenAPISpec | null
  validationResult?: ValidationResult | null
  apiPaths?: ApiPath[]
  mcpTools?: MCPTool[]
}

interface Emits {
  (e: 'convert'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const getStatusType = (status: string) => {
  switch (status) {
    case 'valid': return 'success'
    case 'invalid': return 'danger'
    case 'warning': return 'warning'
    default: return 'info'
  }
}

const getStatusText = (status: string) => {
  switch (status) {
    case 'valid': return '验证通过'
    case 'invalid': return '验证失败'
    case 'warning': return '有警告'
    default: return '未知'
  }
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
</script>

<style scoped>
.spec-preview {
  height: 100%;
  overflow-y: auto;
}

.spec-preview .el-card {
  margin-bottom: 16px;
}

.spec-preview .el-card:last-child {
  margin-bottom: 0;
}

/* 空状态 */
.empty-state {
  height: 200px;
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

.card-header h3,
.card-header h4 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 规范元数据 */
.spec-metadata {
  margin-top: 16px;
}

.spec-description {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color-light);
}

.spec-description h4 {
  margin: 0 0 8px 0;
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.spec-description p {
  margin: 0;
  color: var(--el-text-color-regular);
  line-height: 1.6;
}

/* 验证结果 */
.error-list,
.warning-list {
  margin-bottom: 16px;
}

.error-list:last-child,
.warning-list:last-child {
  margin-bottom: 0;
}

.error-title,
.warning-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
}

.error-items,
.warning-items {
  padding-left: 32px;
}

.error-item,
.warning-item {
  margin-bottom: 12px;
  padding: 12px;
  background-color: var(--el-bg-color-page);
  border-radius: 4px;
  border-left: 3px solid var(--el-color-danger);
}

.warning-item {
  border-left-color: var(--el-color-warning);
}

.error-location,
.warning-location {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.error-message,
.warning-message {
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.error-code,
.warning-code {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-family: monospace;
}

.success-state {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background-color: var(--el-color-success-light-9);
  border-radius: 4px;
  color: var(--el-color-success);
}

/* API路径 */
.path-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.path-item {
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background-color: var(--el-bg-color-page);
}

.path-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.method-tag {
  font-weight: 600;
  min-width: 60px;
  text-align: center;
}

.path-url {
  font-family: monospace;
  font-size: 14px;
  background-color: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 3px;
}

.path-summary {
  color: var(--el-text-color-primary);
  font-weight: 500;
  margin-bottom: 4px;
}

.path-description {
  color: var(--el-text-color-regular);
  font-size: 13px;
}

/* MCP工具 */
.tool-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tool-item {
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background-color: var(--el-bg-color-page);
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.tool-name {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.tool-description {
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
  font-size: 13px;
}

.tool-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-path {
  font-family: monospace;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
