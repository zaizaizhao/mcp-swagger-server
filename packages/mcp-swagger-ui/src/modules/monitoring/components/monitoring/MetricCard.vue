<template>
  <div class="metric-card">
    <div class="metric-header">
      <div class="metric-icon">
        <component :is="iconComponent" />
      </div>
      <div class="metric-info">
        <h3 class="metric-title">{{ title }}</h3>
        <p class="metric-value">{{ formattedValue }}</p>
      </div>
    </div>
    <div class="metric-trend" v-if="trend !== undefined">
      <span class="trend-icon" :class="trendClass">
        <ArrowUp v-if="trend > 0" />
        <ArrowDown v-if="trend < 0" />
        <Minus v-if="trend === 0" />
      </span>
      <span class="trend-text">{{ Math.abs(trend).toFixed(1) }}%</span>
    </div>
    <div class="metric-chart" v-if="showChart && chartData.length > 0">
      <v-chart :option="chartOption" :style="{ height: '60px' }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { use } from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import VChart from "vue-echarts";
import { ArrowUp, ArrowDown, Minus } from "@element-plus/icons-vue";
import type { ChartDataPoint } from "@/types";

use([LineChart, GridComponent, CanvasRenderer]);

interface Props {
  title: string;
  value: number | string;
  unit?: string;
  icon?: string;
  trend?: number;
  showChart?: boolean;
  chartData?: ChartDataPoint[];
  color?: string;
  formatter?: (value: number | string) => string;
}

const props = withDefaults(defineProps<Props>(), {
  unit: "",
  showChart: true,
  chartData: () => [],
  color: "#409EFF",
});

const iconComponent = computed(() => {
  const iconMap: Record<string, any> = {
    cpu: "Monitor",
    memory: "MemoryCard",
    disk: "HardDrive",
    network: "Network",
    server: "Server",
  };
  return iconMap[props.icon || "Monitor"] || "Monitor";
});

const formattedValue = computed(() => {
  if (props.formatter) {
    return props.formatter(props.value);
  }

  if (typeof props.value === "number") {
    return `${props.value.toFixed(1)}${props.unit}`;
  }

  return `${props.value}${props.unit}`;
});

const trendClass = computed(() => ({
  "trend-up": props.trend && props.trend > 0,
  "trend-down": props.trend && props.trend < 0,
  "trend-neutral": props.trend === 0,
}));

const chartOption = computed(() => ({
  grid: {
    left: 0,
    right: 0,
    top: 5,
    bottom: 5,
  },
  xAxis: {
    type: "time",
    show: false,
  },
  yAxis: {
    type: "value",
    show: false,
  },
  series: [
    {
      type: "line",
      data: props.chartData.map((point) => [point.timestamp, point.value]),
      smooth: true,
      symbol: "none",
      lineStyle: {
        color: props.color,
        width: 2,
      },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: props.color + "40" },
            { offset: 1, color: props.color + "10" },
          ],
        },
      },
    },
  ],
}));
</script>

<style scoped>
.metric-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 20px;
  transition: all 0.3s ease;
}

.metric-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--el-color-primary);
}

.metric-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.metric-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: linear-gradient(
    135deg,
    var(--el-color-primary),
    var(--el-color-primary-light-3)
  );
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  margin-right: 12px;
}

.metric-info {
  flex: 1;
}

.metric-title {
  font-size: 14px;
  color: var(--el-text-color-regular);
  margin: 0 0 4px 0;
  font-weight: 500;
}

.metric-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0;
}

.metric-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
}

.trend-icon {
  display: flex;
  align-items: center;
  font-size: 12px;
}

.trend-up {
  color: var(--el-color-success);
}

.trend-down {
  color: var(--el-color-danger);
}

.trend-neutral {
  color: var(--el-text-color-regular);
}

.trend-text {
  font-size: 12px;
  font-weight: 500;
}

.metric-chart {
  height: 60px;
  margin-top: 8px;
}
</style>
