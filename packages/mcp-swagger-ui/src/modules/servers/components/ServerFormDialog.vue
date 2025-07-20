<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑服务器' : '创建服务器'"
    width="600px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="120px"
      label-position="right"
    >
      <el-form-item label="服务器名称" prop="name" required :error="getFieldError('name')">
        <el-input
          v-model="formData.name"
          placeholder="请输入服务器名称"
          clearable
          @blur="() => validateField('name', formData.name)"
        />
      </el-form-item>
      
      <el-form-item label="端点地址" prop="endpoint" required :error="getFieldError('endpoint')">
        <el-input
          v-model="formData.endpoint"
          placeholder="请输入服务器端点地址"
          clearable
          @blur="() => validateField('endpoint', formData.endpoint)"
        />
      </el-form-item>
      
      <el-form-item label="描述" prop="description" :error="getFieldError('description')">
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="3"
          placeholder="请输入服务器描述（可选）"
          @blur="() => validateField('description', formData.description)"
        />
      </el-form-item>
      
      <el-form-item label="标签" prop="tags">
        <el-tag
          v-for="tag in formData.tags"
          :key="tag"
          closable
          :disable-transitions="false"
          @close="handleTagClose(tag)"
          class="tag-item"
        >
          {{ tag }}
        </el-tag>
        <el-input
          v-if="inputVisible"
          ref="InputRef"
          v-model="inputValue"
          class="tag-input"
          size="small"
          @keyup.enter="handleInputConfirm"
          @blur="handleInputConfirm"
        />
        <el-button
          v-else
          class="tag-button"
          size="small"
          @click="showInput"
        >
          + 添加标签
        </el-button>
      </el-form-item>
      
      <el-form-item label="自定义头部" prop="customHeaders">
        <div class="headers-section">
          <div
            v-for="(header, index) in customHeadersList"
            :key="index"
            class="header-row"
          >
            <el-input
              v-model="header.key"
              placeholder="Header 名称"
              class="header-key"
            />
            <el-input
              v-model="header.value"
              placeholder="Header 值"
              class="header-value"
            />
            <el-button
              type="danger"
              :icon="Delete"
              @click="removeHeader(index)"
              circle
              size="small"
            />
          </div>
          <el-button
            type="primary"
            :icon="Plus"
            @click="addHeader"
            size="small"
            plain
          >
            添加头部
          </el-button>
        </div>
      </el-form-item>
    </el-form>
    
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="loading"
          @click="handleSubmit"
        >
          {{ isEdit ? '更新' : '创建' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'
import type { MCPServer, ServerConfig } from '@/types'
import { useServerStore } from '@/stores/server'

// 导入全局功能
import { useFormValidation } from '@/composables/useFormValidation'
import { usePerformanceMonitor } from '@/composables/usePerformance'

interface Props {
  modelValue: boolean
  server?: MCPServer | null
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'success'): void
}

const props = withDefaults(defineProps<Props>(), {
  server: null
})

const emit = defineEmits<Emits>()
const serverStore = useServerStore()

// 全局功能
const { measureFunction } = usePerformanceMonitor()

// 响应式数据
const formRef = ref<FormInstance>()
const loading = ref(false)
const inputVisible = ref(false)
const inputValue = ref('')
const InputRef = ref()

// 表单数据
const formData = ref<ServerConfig & { description?: string; tags?: string[] }>({
  name: '',
  endpoint: '',
  description: '',
  tags: [],
  customHeaders: {}
})

// 使用全局表单验证
const validationFields = [
  {
    name: 'name',
    label: '服务器名称',
    rules: [
      { required: true, message: '服务器名称不能为空' },
      { type: 'string' as const, min: 2, message: '服务器名称至少2个字符' },
      { type: 'string' as const, max: 50, message: '服务器名称不能超过50个字符' }
    ]
  },
  {
    name: 'endpoint',
    label: '端点地址',
    rules: [
      { required: true, message: '端点地址不能为空' },
      { pattern: /^https?:\/\/.+/, message: '请输入有效的HTTP/HTTPS地址' }
    ]
  },
  {
    name: 'description',
    label: '描述',
    rules: [
      { type: 'string' as const, max: 200, message: '描述不能超过200个字符' }
    ]
  }
]

const {
  formState,
  validateField,
  validateForm,
  getFieldError,
  resetForm: resetFormValidation,
  setFieldValue
} = useFormValidation(validationFields)

// 自定义头部列表
const customHeadersList = ref<Array<{ key: string; value: string }>>([])

// 计算属性
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const isEdit = computed(() => !!props.server)

// 表单验证规则
const formRules: FormRules = {
  name: [
    { required: true, message: '请输入服务器名称', trigger: 'blur' },
    { min: 2, max: 50, message: '名称长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  endpoint: [
    { required: true, message: '请输入端点地址', trigger: 'blur' },
    {
      pattern: /^https?:\/\/.+/,
      message: '请输入有效的 HTTP/HTTPS 地址',
      trigger: 'blur'
    }
  ]
}

// 监听服务器属性变化
watch(
  () => props.server,
  (server) => {
    if (server) {
      formData.value = {
        name: server.config.name,
        endpoint: server.config.endpoint,
        description: server.config.description || '',
        tags: server.config.tags || [],
        customHeaders: server.config.customHeaders || {}
      }
      
      // 转换自定义头部为列表格式
      customHeadersList.value = Object.entries(formData.value.customHeaders || {}).map(
        ([key, value]) => ({ key, value })
      )
    } else {
      resetForm()
    }
  },
  { immediate: true }
)

// 监听对话框可见性
watch(dialogVisible, (visible) => {
  if (visible && !props.server) {
    resetForm()
  }
})

// 方法
const resetForm = () => {
  formData.value = {
    name: '',
    endpoint: '',
    description: '',
    tags: [],
    customHeaders: {}
  }
  customHeadersList.value = []
  formRef.value?.clearValidate()
}

const handleClose = () => {
  emit('update:modelValue', false)
}

const handleSubmit = async () => {
  try {
    // 使用全局表单验证
    const isValid = await validateForm()
    if (!isValid) {
      ElMessage.error('请检查表单输入')
      return
    }
    
    loading.value = true
    
    // 转换自定义头部回对象格式
    const customHeaders: Record<string, string> = {}
    customHeadersList.value.forEach(({ key, value }) => {
      if (key.trim() && value.trim()) {
        customHeaders[key.trim()] = value.trim()
      }
    })
    
    const serverConfig: ServerConfig = {
      name: formData.value.name,
      endpoint: formData.value.endpoint,
      description: formData.value.description,
      tags: formData.value.tags?.filter(tag => tag.trim()),
      customHeaders
    }
    
    let success = false
    
    if (isEdit.value && props.server) {
      success = await measureFunction('updateServer', async () => {
        return await serverStore.updateServer(props.server!.id, serverConfig)
      })
    } else {
      success = await measureFunction('createServer', async () => {
        return await serverStore.createServer(serverConfig)
      })
    }
    
    if (success) {
      ElMessage.success(isEdit.value ? '服务器更新成功' : '服务器创建成功')
      emit('success')
    }
  } catch (error) {
    ElMessage.error(`${isEdit.value ? '更新' : '创建'}服务器失败: ${error}`)
  } finally {
    loading.value = false
  }
}

// 标签相关方法
const handleTagClose = (tag: string) => {
  formData.value.tags = formData.value.tags?.filter(t => t !== tag)
}

const showInput = () => {
  inputVisible.value = true
  nextTick(() => {
    InputRef.value?.input?.focus()
  })
}

const handleInputConfirm = () => {
  if (inputValue.value) {
    if (!formData.value.tags) {
      formData.value.tags = []
    }
    if (!formData.value.tags.includes(inputValue.value)) {
      formData.value.tags.push(inputValue.value)
    }
  }
  inputVisible.value = false
  inputValue.value = ''
}

// 自定义头部相关方法
const addHeader = () => {
  customHeadersList.value.push({ key: '', value: '' })
}

const removeHeader = (index: number) => {
  customHeadersList.value.splice(index, 1)
}
</script>

<style scoped>
.tag-item {
  margin-right: 8px;
  margin-bottom: 8px;
}

.tag-input {
  width: 90px;
  margin-right: 8px;
  margin-bottom: 8px;
}

.tag-button {
  margin-bottom: 8px;
}

.headers-section {
  width: 100%;
}

.header-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.header-key {
  flex: 1;
}

.header-value {
  flex: 2;
}

.dialog-footer {
  text-align: right;
}
</style>
