<template>
  <div class="document-status-progress">
    <div class="progress-container">
      <div
        class="progress-line"
        :class="{ 'progress-line--active': isProgressActive }"
      ></div>

      <!-- 进度节点 -->
      <div
        v-for="(step, index) in steps"
        :key="step.key"
        class="progress-step"
        :class="getStepClass(step, index)"
      >
        <div class="step-icon">
          <el-icon v-if="step.icon" :size="14">
            <component :is="step.icon" />
          </el-icon>
          <span v-else class="step-number">{{ index + 1 }}</span>
        </div>
        <div class="step-label">{{ step.label }}</div>
      </div>
    </div>

    <!-- 状态描述 -->
    <div
      class="status-description"
      :class="`status-description--${currentStatus}`"
    >
      <span class="status-text">{{ getStatusText(status) }}</span>
      <el-icon v-if="status === 'pending'" class="loading-icon">
        <Loading />
      </el-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  DocumentAdd,
  Clock,
  Loading,
  Check,
  Close,
} from "@element-plus/icons-vue";

interface Props {
  status: "valid" | "invalid" | "pending" | "unknown";
  size?: "small" | "default" | "large";
}

const props = withDefaults(defineProps<Props>(), {
  size: "default",
});

const { t } = useI18n();

// 进度步骤定义
const steps = computed(() => [
  {
    key: "created",
    label: t("openapi.progress.created"),
    icon: DocumentAdd,
  },
  {
    key: "pending",
    label: t("openapi.progress.pending"),
    icon: Clock,
  },
  {
    key: "validating",
    label: t("openapi.progress.validating"),
    icon: Loading,
  },
  {
    key: "completed",
    label: t("openapi.progress.completed"),
    icon: props.status === "valid" ? Check : Close,
  },
]);

// 当前状态映射到步骤索引
const currentStepIndex = computed(() => {
  switch (props.status) {
    case "unknown":
      return 0; // 创建状态
    case "pending":
      return 2; // 验证中状态
    case "valid":
    case "invalid":
      return 3; // 完成状态
    default:
      return 0;
  }
});

// 计算进度条填充百分比
const progressPercentage = computed(() => {
  switch (props.status) {
    case "unknown":
      return 0;
    case "pending":
      return 66; // 到验证中节点
    case "valid":
    case "invalid":
      return 100; // 完成状态充满
    default:
      return 0;
  }
});

const currentStatus = computed(() => props.status);

// 判断进度线是否激活
const isProgressActive = computed(() => {
  return props.status !== "unknown";
});

// 判断是否已完成
const isCompleted = computed(() => {
  return props.status === "valid" || props.status === "invalid";
});

// 获取步骤样式类
const getStepClass = (step: any, index: number) => {
  const classes = [`step-${props.size}`];

  if (index < currentStepIndex.value) {
    classes.push("step--completed");
  } else if (index === currentStepIndex.value) {
    classes.push("step--current");
    if (props.status === "valid") {
      classes.push("step--success");
    } else if (props.status === "invalid") {
      classes.push("step--error");
    } else if (props.status === "pending") {
      classes.push("step--processing");
    }
  } else {
    classes.push("step--pending");
  }

  return classes;
};

// 获取状态文本
const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    valid: t("openapi.status.valid"),
    invalid: t("openapi.status.invalid"),
    pending: t("openapi.status.pending"),
    unknown: t("openapi.status.unknown"),
  };
  return statusMap[status] || t("openapi.status.unknown");
};
</script>

<style scoped>
.document-status-progress {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.progress-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
}

.progress-line {
  position: absolute;
  top: 50%;
  left: 14px;
  right: 14px;
  height: 6px;
  background: var(--el-border-color-light);
  transform: translateY(-50%);
  transition: all 0.3s ease;
  z-index: 1;
  border-radius: 3px;
}

.progress-line--active {
  background: linear-gradient(
    to right,
    var(--el-color-success) 0%,
    var(--el-color-success) v-bind(progressPercentage + "%"),
    var(--el-border-color-light) v-bind(progressPercentage + "%"),
    var(--el-border-color-light) 100%
  );
}

.progress-step {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  z-index: 2;
  transform: translateY(10px);
}

.progress-container:has(.progress-line) .progress-step {
  transform: translateY(10px);
}

.progress-container:not(:has(.progress-line)) .progress-step {
  transform: translateY(0);
}

.step-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--el-bg-color);
  border: 3px solid var(--el-border-color);
  transition: all 0.3s ease;
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.step-small .step-icon {
  width: 24px;
  height: 24px;
  font-size: 10px;
  border-width: 2px;
}

.step-large .step-icon {
  width: 32px;
  height: 32px;
  font-size: 14px;
  border-width: 3px;
}

.step-number {
  color: var(--el-text-color-regular);
  font-size: inherit;
}

.step-label {
  font-size: 11px;
  color: var(--el-text-color-regular);
  text-align: center;
  white-space: nowrap;
  transition: color 0.3s ease;
}

.step-small .step-label {
  font-size: 10px;
}

.step-large .step-label {
  font-size: 12px;
}

/* 步骤状态样式 */
.step--completed .step-icon {
  background: var(--el-color-success);
  border-color: var(--el-color-success);
  color: white;
  border-width: 0;
}

.step--completed .step-label {
  color: var(--el-color-success);
}

.step--current.step--success .step-icon {
  background: var(--el-color-success);
  border-color: var(--el-color-success);
  color: white;
  border-width: 0;
  box-shadow: 0 0 0 3px var(--el-color-success-light-8);
}

.step--current.step--success .step-label {
  color: var(--el-color-success);
  font-weight: 500;
}

.step--current.step--error .step-icon {
  background: var(--el-color-danger);
  border-color: var(--el-color-danger);
  color: white;
  border-width: 0;
  box-shadow: 0 0 0 3px var(--el-color-danger-light-8);
}

.step--current.step--error .step-label {
  color: var(--el-color-danger);
  font-weight: 500;
}

.step--current.step--processing .step-icon {
  background: var(--el-color-warning);
  border-color: var(--el-color-warning);
  color: white;
  box-shadow: 0 0 0 3px var(--el-color-warning-light-8);
  animation: pulse 1.5s ease-in-out infinite;
}

.step--current.step--processing .step-label {
  color: var(--el-color-warning);
  font-weight: 500;
}

.step--pending .step-icon {
  background: var(--el-bg-color);
  border-color: var(--el-border-color-light);
  color: var(--el-text-color-placeholder);
}

.step--pending .step-label {
  color: var(--el-text-color-placeholder);
}

/* 状态描述样式 */
.status-description {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: var(--el-border-radius-base);
  font-size: 12px;
  font-weight: 500;
  transition: all 0.3s ease;
  margin-top: 4px;
}

.status-description--valid {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
  border: 1px solid var(--el-color-success-light-7);
}

.status-description--invalid {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
  border: 1px solid var(--el-color-danger-light-7);
}

.status-description--pending {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
  border: 1px solid var(--el-color-warning-light-7);
}

.status-description--unknown {
  background: var(--el-color-info-light-9);
  color: var(--el-color-info);
  border: 1px solid var(--el-color-info-light-7);
}

.loading-icon {
  animation: rotate 1s linear infinite;
}

/* 动画效果 */
@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .progress-container {
    padding: 0 4px;
  }

  .step-label {
    font-size: 10px;
  }

  .status-description {
    font-size: 11px;
  }
}
</style>
