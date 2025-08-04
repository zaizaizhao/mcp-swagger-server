<template>
  <div v-if="visible" :class="['loading-overlay', { fullscreen }]">
    <div class="loading-content">
      <!-- 加载动画 -->
      <div class="loading-spinner">
        <component :is="spinnerComponent" :size="spinnerSize" />
      </div>

      <!-- 加载文本 -->
      <div v-if="text" class="loading-text">{{ text }}</div>

      <!-- 进度条 -->
      <div v-if="showProgress" class="loading-progress">
        <el-progress
          :percentage="progress"
          :show-text="showProgressText"
          :status="progressStatus"
          :stroke-width="4"
        />
        <div v-if="progressText" class="progress-text">{{ progressText }}</div>
      </div>

      <!-- 详细信息 -->
      <div v-if="details" class="loading-details">{{ details }}</div>

      <!-- 取消按钮 -->
      <div v-if="cancelable" class="loading-actions">
        <el-button size="small" @click="handleCancel">取消</el-button>
      </div>
    </div>

    <!-- 背景遮罩 -->
    <div v-if="mask" class="loading-mask" @click="handleMaskClick"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  Loading,
  CircleCheck,
  CircleClose,
  Warning,
} from "@element-plus/icons-vue";

interface Props {
  visible?: boolean;
  text?: string;
  fullscreen?: boolean;
  mask?: boolean;
  maskClosable?: boolean;
  spinner?: "loading" | "dots" | "circle" | "bars";
  size?: "small" | "default" | "large";
  showProgress?: boolean;
  progress?: number;
  progressText?: string;
  progressStatus?: "success" | "exception" | "warning" | "";
  showProgressText?: boolean;
  details?: string;
  cancelable?: boolean;
}

interface Emits {
  (e: "cancel"): void;
  (e: "mask-click"): void;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  fullscreen: false,
  mask: true,
  maskClosable: false,
  spinner: "loading",
  size: "default",
  showProgress: false,
  progress: 0,
  progressStatus: "",
  showProgressText: true,
  cancelable: false,
});

const emit = defineEmits<Emits>();

// 计算属性
const spinnerComponent = computed(() => {
  switch (props.spinner) {
    case "loading":
      return Loading;
    case "circle":
      return Loading;
    case "dots":
      return Loading;
    case "bars":
      return Loading;
    default:
      return Loading;
  }
});

const spinnerSize = computed(() => {
  const sizes = {
    small: 24,
    default: 32,
    large: 48,
  };
  return sizes[props.size];
});

// 事件处理
const handleCancel = () => {
  emit("cancel");
};

const handleMaskClick = () => {
  if (props.maskClosable) {
    emit("mask-click");
  }
};
</script>

<style scoped>
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-overlay.fullscreen {
  position: fixed;
  z-index: 9999;
}

.loading-content {
  position: relative;
  z-index: 2001;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px;
  background: var(--el-bg-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 200px;
  max-width: 400px;
}

.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-color-primary);
}

.loading-spinner .el-icon {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 14px;
  color: var(--el-text-color-primary);
  text-align: center;
  line-height: 1.5;
}

.loading-progress {
  width: 100%;
  margin-top: 8px;
}

.progress-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
  margin-top: 8px;
}

.loading-details {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
  line-height: 1.4;
  max-height: 60px;
  overflow-y: auto;
}

.loading-actions {
  margin-top: 8px;
}

.loading-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
}
</style>
