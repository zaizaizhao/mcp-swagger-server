<template>
  <el-card class="system-status-card">
    <template #header>
      <div class="card-header">
        <span class="header-title">系统状态</span>
        <el-tag :type="statusType" effect="dark">
          {{ statusText }}
        </el-tag>
      </div>
    </template>

    <div class="status-grid">
      <div class="status-item" v-for="service in services" :key="service.name">
        <div class="service-info">
          <div class="service-icon" :class="service.statusClass">
            <component :is="service.icon" />
          </div>
          <div class="service-details">
            <h4 class="service-name">{{ service.name }}</h4>
            <p class="service-status">{{ service.statusText }}</p>
          </div>
        </div>
        <div class="service-indicator">
          <div class="indicator-dot" :class="service.statusClass"></div>
        </div>
      </div>
    </div>

    <div class="uptime-info" v-if="uptime">
      <div class="uptime-label">系统运行时间</div>
      <div class="uptime-value">{{ formatUptime(uptime) }}</div>
    </div>

    <div class="last-update" v-if="lastUpdate">
      <el-icon><Clock /></el-icon>
      <span>最后更新：{{ formatTime(lastUpdate) }}</span>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  Clock,
  Monitor,
  Connection,
  Coin,
  Service,
  Link,
} from "@element-plus/icons-vue";

interface ServiceStatus {
  name: string;
  status: "online" | "offline" | "degraded" | "connecting";
  icon: any;
}

interface Props {
  status: "healthy" | "warning" | "critical" | "unknown";
  services: ServiceStatus[];
  uptime?: number;
  lastUpdate?: Date;
}

const props = defineProps<Props>();

const statusType = computed(() => {
  switch (props.status) {
    case "healthy":
      return "success";
    case "warning":
      return "warning";
    case "critical":
      return "danger";
    default:
      return "info";
  }
});

const statusText = computed(() => {
  switch (props.status) {
    case "healthy":
      return "正常";
    case "warning":
      return "警告";
    case "critical":
      return "严重";
    default:
      return "未知";
  }
});

const services = computed(() => {
  return props.services.map((service) => ({
    ...service,
    statusClass: getStatusClass(service.status),
    statusText: getStatusText(service.status),
  }));
});

const getStatusClass = (status: string) => {
  switch (status) {
    case "online":
      return "status-online";
    case "offline":
      return "status-offline";
    case "degraded":
      return "status-degraded";
    case "connecting":
      return "status-connecting";
    default:
      return "status-unknown";
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case "online":
      return "在线";
    case "offline":
      return "离线";
    case "degraded":
      return "降级";
    case "connecting":
      return "连接中";
    default:
      return "未知";
  }
};

const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}天 ${hours}小时 ${minutes}分钟`;
  } else if (hours > 0) {
    return `${hours}小时 ${minutes}分钟`;
  } else {
    return `${minutes}分钟`;
  }
};

const formatTime = (date: Date) => {
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};
</script>

<style scoped>
.system-status-card {
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.status-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  transition: background-color 0.3s ease;
}

.status-item:hover {
  background: var(--el-fill-color);
}

.service-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.service-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 16px;
}

.status-online {
  background: var(--el-color-success);
}

.status-offline {
  background: var(--el-color-danger);
}

.status-degraded {
  background: var(--el-color-warning);
}

.status-connecting {
  background: var(--el-color-info);
  animation: pulse 2s infinite;
}

.status-unknown {
  background: var(--el-text-color-disabled);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.service-details {
  flex: 1;
}

.service-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin: 0 0 2px 0;
}

.service-status {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin: 0;
}

.service-indicator {
  display: flex;
  align-items: center;
}

.indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-color-success);
}

.uptime-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  margin-bottom: 16px;
}

.uptime-label {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.uptime-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.last-update {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  justify-content: center;
}
</style>
