<template>
  <el-dialog
    v-model="visible"
    :title="title"
    :width="width"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    :center="center"
    class="confirmation-dialog"
  >
    <div class="confirmation-content">
      <!-- 图标 -->
      <div :class="['confirmation-icon', iconType]">
        <el-icon :size="48">
          <component :is="iconComponent" />
        </el-icon>
      </div>
      
      <!-- 主要消息 -->
      <div class="confirmation-message">
        <h3 v-if="title" class="confirmation-title">{{ title }}</h3>
        <p class="confirmation-text">{{ message }}</p>
      </div>
      
      <!-- 详细信息 -->
      <div v-if="details" class="confirmation-details">
        <el-collapse v-model="detailsExpanded">
          <el-collapse-item title="查看详情" name="details">
            <div class="details-content">{{ details }}</div>
          </el-collapse-item>
        </el-collapse>
      </div>
      
      <!-- 危险操作警告 -->
      <div v-if="dangerous" class="danger-warning">
        <el-alert
          type="error"
          :title="dangerTitle"
          :description="dangerDescription"
          :show-icon="true"
          :closable="false"
        />
      </div>
      
      <!-- 确认输入 -->
      <div v-if="requireConfirmation" class="confirmation-input">
        <p class="input-hint">{{ confirmationHint }}</p>
        <el-input
          v-model="confirmationInput"
          :placeholder="confirmationPlaceholder"
          @keyup.enter="handleConfirm"
        />
      </div>
      
      <!-- 倒计时 -->
      <div v-if="countdown > 0" class="countdown">
        <el-progress
          :percentage="countdownPercentage"
          :show-text="false"
          :stroke-width="4"
          status="warning"
        />
        <p class="countdown-text">{{ countdown }}秒后自动{{ autoAction }}</p>
      </div>
    </div>
    
    <template #footer>
      <div class="confirmation-footer">
        <!-- 取消按钮 -->
        <el-button
          v-if="showCancel"
          @click="handleCancel"
          :disabled="loading"
          :size="buttonSize"
        >
          {{ cancelText }}
        </el-button>
        
        <!-- 确认按钮 -->
        <el-button
          :type="confirmButtonType"
          @click="handleConfirm"
          :loading="loading"
          :disabled="!canConfirm"
          :size="buttonSize"
        >
          {{ confirmText }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { 
  QuestionFilled, 
  WarningFilled, 
  InfoFilled, 
  CircleCheckFilled,
  Delete,
  Lock
} from '@element-plus/icons-vue'

interface Props {
  modelValue?: boolean
  type?: 'confirm' | 'warning' | 'danger' | 'info' | 'success'
  title?: string
  message: string
  details?: string
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
  width?: string
  center?: boolean
  dangerous?: boolean
  dangerTitle?: string
  dangerDescription?: string
  requireConfirmation?: boolean
  confirmationText?: string
  confirmationHint?: string
  confirmationPlaceholder?: string
  countdown?: number
  autoAction?: 'confirm' | 'cancel'
  buttonSize?: 'large' | 'default' | 'small'
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  type: 'confirm',
  confirmText: '确定',
  cancelText: '取消',
  showCancel: true,
  width: '420px',
  center: true,
  dangerous: false,
  dangerTitle: '危险操作警告',
  dangerDescription: '此操作不可撤销，请谨慎确认',
  requireConfirmation: false,
  confirmationText: 'DELETE',
  confirmationHint: '请输入以下文本以确认操作：',
  confirmationPlaceholder: '输入确认文本',
  countdown: 0,
  autoAction: 'cancel',
  buttonSize: 'default'
})

const emit = defineEmits<Emits>()

// 响应式数据
const visible = ref(false)
const loading = ref(false)
const confirmationInput = ref('')
const detailsExpanded = ref<string[]>([])
const currentCountdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

// 计算属性
const iconType = computed(() => {
  switch (props.type) {
    case 'warning':
    case 'danger':
      return 'warning'
    case 'info':
      return 'info'
    case 'success':
      return 'success'
    default:
      return 'question'
  }
})

const iconComponent = computed(() => {
  switch (props.type) {
    case 'warning':
    case 'danger':
      return WarningFilled
    case 'info':
      return InfoFilled
    case 'success':
      return CircleCheckFilled
    default:
      return QuestionFilled
  }
})

const confirmButtonType = computed(() => {
  switch (props.type) {
    case 'danger':
      return 'danger'
    case 'warning':
      return 'warning'
    case 'success':
      return 'success'
    default:
      return 'primary'
  }
})

const canConfirm = computed(() => {
  if (loading.value) return false
  
  if (props.requireConfirmation) {
    return confirmationInput.value === props.confirmationText
  }
  
  return true
})

const countdownPercentage = computed(() => {
  if (props.countdown === 0) return 0
  return ((props.countdown - currentCountdown.value) / props.countdown) * 100
})

// 方法
const handleConfirm = () => {
  if (!canConfirm.value) return
  
  loading.value = true
  emit('confirm')
  
  // 模拟异步操作
  setTimeout(() => {
    loading.value = false
    visible.value = false
  }, 300)
}

const handleCancel = () => {
  emit('cancel')
  visible.value = false
}

const startCountdown = () => {
  if (props.countdown <= 0) return
  
  currentCountdown.value = props.countdown
  countdownTimer = setInterval(() => {
    currentCountdown.value--
    
    if (currentCountdown.value <= 0) {
      clearInterval(countdownTimer!)
      
      if (props.autoAction === 'confirm') {
        handleConfirm()
      } else {
        handleCancel()
      }
    }
  }, 1000)
}

const stopCountdown = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  currentCountdown.value = 0
}

// 监听器
watch(() => props.modelValue, (newValue) => {
  visible.value = newValue
  
  if (newValue) {
    confirmationInput.value = ''
    detailsExpanded.value = []
    loading.value = false
    
    if (props.countdown > 0) {
      startCountdown()
    }
  } else {
    stopCountdown()
  }
})

watch(visible, (newValue) => {
  emit('update:modelValue', newValue)
})

// 生命周期
onMounted(() => {
  if (props.modelValue) {
    visible.value = true
  }
})

onUnmounted(() => {
  stopCountdown()
})
</script>

<style scoped>
.confirmation-dialog {
  .el-dialog__body {
    padding: 24px;
  }
}

.confirmation-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;
}

.confirmation-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin-bottom: 8px;
}

.confirmation-icon.question {
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
}

.confirmation-icon.warning {
  background: var(--el-color-warning-light-8);
  color: var(--el-color-warning);
}

.confirmation-icon.info {
  background: var(--el-color-info-light-8);
  color: var(--el-color-info);
}

.confirmation-icon.success {
  background: var(--el-color-success-light-8);
  color: var(--el-color-success);
}

.confirmation-message {
  width: 100%;
}

.confirmation-title {
  margin: 0 0 12px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.confirmation-text {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.confirmation-details {
  width: 100%;
  text-align: left;
}

.details-content {
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  max-height: 200px;
  overflow-y: auto;
}

.danger-warning {
  width: 100%;
}

.confirmation-input {
  width: 100%;
}

.input-hint {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
  text-align: left;
}

.countdown {
  width: 100%;
}

.countdown-text {
  margin: 8px 0 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.confirmation-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .confirmation-dialog {
    .el-dialog {
      width: 90% !important;
      margin: 5vh auto;
    }
  }
  
  .confirmation-icon {
    width: 60px;
    height: 60px;
  }
  
  .confirmation-icon .el-icon {
    font-size: 32px !important;
  }
  
  .confirmation-footer {
    flex-direction: column-reverse;
  }
  
  .confirmation-footer .el-button {
    width: 100%;
  }
}
</style>
