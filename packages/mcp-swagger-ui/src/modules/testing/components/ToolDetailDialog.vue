<template>
  <el-dialog
    v-model="visible"
    :title="tool?.name || '工具详情'"
    width="60%"
    :before-close="handleClose"
  >
    <div v-if="tool" class="tool-detail">
      <!-- 工具基础信息 -->
      <el-card class="basic-info" style="margin-bottom: 20px;">
        <template #header>
          <span><el-icon><InfoFilled /></el-icon> 基础信息</span>
        </template>
        
        <el-descriptions :column="2" border>
          <el-descriptions-item label="工具名称">
            {{ tool.name }}
          </el-descriptions-item>
          <el-descriptions-item label="HTTP方法">
            <el-tag v-if="tool.method" size="small" :type="getMethodType(tool.method)">
              {{ tool.method.toUpperCase() }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">
            {{ tool.description }}
          </el-descriptions-item>
          <el-descriptions-item label="工具ID" :span="2">
            <el-text type="info" size="small">{{ tool.id }}</el-text>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 参数信息 -->
      <el-card class="parameters-info" style="margin-bottom: 20px;">
        <template #header>
          <span><el-icon><List /></el-icon> 参数信息</span>
        </template>
        
        <div v-if="parametersList.length > 0">
          <el-table :data="parametersList" style="width: 100%">
            <el-table-column prop="name" label="参数名" width="150" />
            <el-table-column prop="type" label="类型" width="100">
              <template #default="{ row }">
                <el-tag size="small" effect="plain">{{ row.type }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="required" label="必需" width="80">
              <template #default="{ row }">
                <el-tag 
                  :type="row.required ? 'danger' : 'info'" 
                  size="small"
                  effect="plain"
                >
                  {{ row.required ? '是' : '否' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="描述" />
            <el-table-column prop="default" label="默认值" width="100">
              <template #default="{ row }">
                <el-text v-if="row.default !== undefined" size="small" type="info">
                  {{ row.default }}
                </el-text>
                <el-text v-else size="small" type="placeholder">-</el-text>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <el-empty v-else description="该工具无需参数" :image-size="80" />
      </el-card>

      <!-- Schema详情 -->
      <el-card class="schema-info">
        <template #header>
          <div class="schema-header">
            <span><el-icon><Document /></el-icon> Schema详情</span>
            <el-button 
              size="small" 
              :icon="copySchemaLoading ? Loading : DocumentCopy"
              @click="copySchema"
              :loading="copySchemaLoading"
            >
              复制Schema
            </el-button>
          </div>
        </template>
        
        <el-scrollbar height="300px">
          <pre class="schema-content">{{ formatSchema(tool.parameters) }}</pre>
        </el-scrollbar>
      </el-card>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">关闭</el-button>
        <el-button type="primary" @click="testTool">
          <el-icon><Tools /></el-icon>
          测试工具
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  InfoFilled, List, Document, DocumentCopy, Tools, Loading 
} from '@element-plus/icons-vue'
import type { MCPTool } from '@/types'

interface Props {
  modelValue: boolean
  tool: MCPTool | null
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'test-tool', tool: MCPTool): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 全局功能注入
const globalErrorHandler = inject('$globalErrorHandler') as any
const globalConfirmDelete = inject('$globalConfirmDelete') as any

// 简化的性能监控函数
const measureFunction = (fn: () => void | Promise<void>, name: string, metadata?: any) => {
  const startTime = performance.now()
  try {
    const result = fn()
    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - startTime
        console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`, metadata)
      })
    } else {
      const duration = performance.now() - startTime
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`, metadata)
      return result
    }
  } catch (error) {
    const duration = performance.now() - startTime
    console.error(`[Performance] ${name} failed after ${duration.toFixed(2)}ms`, error, metadata)
    throw error
  }
}

const visible = ref(false)
const copySchemaLoading = ref(false)

// 计算属性
const parametersList = computed(() => {
  if (!props.tool?.parameters?.properties) return []
  
  const properties = props.tool.parameters.properties
  const required = props.tool.parameters.required || []
  
  return Object.entries(properties).map(([name, schema]: [string, any]) => ({
    name,
    type: schema.type || 'unknown',
    required: required.includes(name),
    description: schema.description || '-',
    default: schema.default,
    enum: schema.enum
  }))
})

// 方法
const getMethodType = (method: string) => {
  const typeMap: Record<string, any> = {
    get: 'success',
    post: 'primary',
    put: 'warning',
    delete: 'danger',
    patch: 'info'
  }
  return typeMap[method.toLowerCase()] || 'info'
}

const formatSchema = (schema: any) => {
  return JSON.stringify(schema, null, 2)
}

const copySchema = async () => {
  if (!props.tool?.parameters) return
  
  copySchemaLoading.value = true
  
  try {
    await measureFunction(
      async () => {
        if (props.tool?.parameters) {
          await navigator.clipboard.writeText(formatSchema(props.tool.parameters))
        }
      },
      'copy-tool-schema',
      { toolName: props.tool.name }
    )
    ElMessage.success('Schema已复制到剪贴板')
  } catch (error: any) {
    globalErrorHandler?.captureError(error, {
      context: 'tool-detail-copy-schema',
      toolName: props.tool?.name,
      action: 'copy_schema'
    })
    ElMessage.error('复制失败，请手动复制')
  } finally {
    copySchemaLoading.value = false
  }
}

const testTool = () => {
  if (props.tool) {
    try {
      measureFunction(
        () => {
          emit('test-tool', props.tool!)
          handleClose()
        },
        'start-tool-test',
        { toolName: props.tool.name }
      )
    } catch (error: any) {
      globalErrorHandler?.captureError(error, {
        context: 'tool-detail-test',
        toolName: props.tool.name,
        action: 'start_test'
      })
    }
  }
}

const handleClose = () => {
  emit('update:modelValue', false)
}

// 监听
watch(
  () => props.modelValue,
  (newValue) => {
    visible.value = newValue
  },
  { immediate: true }
)

watch(visible, (newValue) => {
  if (!newValue) {
    emit('update:modelValue', false)
  }
})
</script>

<style scoped>
.tool-detail {
  max-height: 70vh;
  overflow-y: auto;
}

.schema-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.schema-header span {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.schema-content {
  background-color: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  padding: 16px;
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.4;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  word-break: break-all;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

:deep(.el-card__header) {
  padding: 16px 20px;
}

:deep(.el-descriptions__label) {
  font-weight: 600;
}
</style>
