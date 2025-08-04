<template>
  <el-card class="realtime-chart">
    <template #header>
      <div class="chart-header">
        <span class="chart-title">{{ title }}</span>
        <div class="chart-controls">
          <el-button-group>
            <el-button
              size="small"
              :type="timeRange === '1h' ? 'primary' : ''"
              @click="$emit('timeRangeChange', '1h')"
            >
              1小时
            </el-button>
            <el-button
              size="small"
              :type="timeRange === '6h' ? 'primary' : ''"
              @click="$emit('timeRangeChange', '6h')"
            >
              6小时
            </el-button>
            <el-button
              size="small"
              :type="timeRange === '24h' ? 'primary' : ''"
              @click="$emit('timeRangeChange', '24h')"
            >
              24小时
            </el-button>
          </el-button-group>
          <el-button
            size="small"
            :icon="isRealtime ? VideoPause : VideoPlay"
            @click="$emit('realtimeToggle')"
          >
            {{ isRealtime ? "暂停" : "继续" }}
          </el-button>
        </div>
      </div>
    </template>

    <div class="chart-container">
      <v-chart
        ref="chartRef"
        :option="chartOption"
        :style="{ height: chartHeight }"
        @click="handleChartClick"
      />
    </div>

    <div class="chart-legend" v-if="series.length > 1">
      <div
        class="legend-item"
        v-for="s in series"
        :key="s.name"
        @click="toggleSeries(s.name)"
      >
        <div class="legend-color" :style="{ backgroundColor: s.color }"></div>
        <span
          class="legend-name"
          :class="{ 'legend-disabled': hiddenSeries.includes(s.name) }"
        >
          {{ s.name }}
        </span>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { use } from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import VChart from "vue-echarts";
import { VideoPlay, VideoPause } from "@element-plus/icons-vue";
import type { ChartSeries } from "@/types";

use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

interface Props {
  title: string;
  series: ChartSeries[];
  timeRange: string;
  isRealtime: boolean;
  height?: string;
  unit?: string;
  formatter?: (value: number) => string;
}

interface Emits {
  (e: "timeRangeChange", range: string): void;
  (e: "realtimeToggle"): void;
  (e: "pointClick", data: any): void;
}

const props = withDefaults(defineProps<Props>(), {
  height: "400px",
  unit: "",
});

const emit = defineEmits<Emits>();

const chartRef = ref();
const hiddenSeries = ref<string[]>([]);

const chartHeight = computed(() => props.height);

const visibleSeries = computed(() =>
  props.series.filter((s) => !hiddenSeries.value.includes(s.name)),
);

const chartOption = computed(() => ({
  tooltip: {
    trigger: "axis",
    axisPointer: {
      type: "cross",
    },
    formatter: (params: any[]) => {
      if (!params || params.length === 0) return "";

      const time = new Date(params[0].value[0]).toLocaleString("zh-CN");
      let content = `<div style="margin-bottom: 4px;">${time}</div>`;

      params.forEach((param) => {
        const value = props.formatter
          ? props.formatter(param.value[1])
          : `${param.value[1].toFixed(2)}${props.unit}`;
        content += `
          <div style="display: flex; align-items: center; margin-bottom: 2px;">
            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${param.color}; margin-right: 8px;"></span>
            <span style="margin-right: 8px;">${param.seriesName}:</span>
            <span style="font-weight: bold;">${value}</span>
          </div>
        `;
      });

      return content;
    },
  },
  grid: {
    left: "3%",
    right: "4%",
    bottom: "10%",
    top: "10%",
    containLabel: true,
  },
  xAxis: {
    type: "time",
    axisLine: {
      lineStyle: {
        color: "#E4E7ED",
      },
    },
    axisLabel: {
      color: "#909399",
      formatter: (value: number) => {
        const date = new Date(value);
        return date.toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        });
      },
    },
  },
  yAxis: {
    type: "value",
    axisLine: {
      lineStyle: {
        color: "#E4E7ED",
      },
    },
    axisLabel: {
      color: "#909399",
      formatter: (value: number) => {
        if (props.formatter) {
          return props.formatter(value);
        }
        return `${value}${props.unit}`;
      },
    },
    splitLine: {
      lineStyle: {
        color: "#F5F7FA",
      },
    },
  },
  dataZoom: [
    {
      type: "inside",
      xAxisIndex: 0,
      filterMode: "none",
    },
  ],
  series: visibleSeries.value.map((s) => ({
    name: s.name,
    type: "line",
    data: s.data.map((point) => [point.timestamp, point.value]),
    smooth: true,
    symbol: "none",
    lineStyle: {
      color: s.color,
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
          { offset: 0, color: s.color + "20" },
          { offset: 1, color: s.color + "05" },
        ],
      },
    },
  })),
}));

const toggleSeries = (seriesName: string) => {
  const index = hiddenSeries.value.indexOf(seriesName);
  if (index === -1) {
    hiddenSeries.value.push(seriesName);
  } else {
    hiddenSeries.value.splice(index, 1);
  }
};

const handleChartClick = (params: any) => {
  emit("pointClick", params);
};

// 当实时模式时，自动滚动到最新数据
watch(
  () => props.isRealtime,
  (newVal) => {
    if (newVal && chartRef.value) {
      nextTick(() => {
        const chart = chartRef.value.getChart();
        if (chart) {
          chart.dispatchAction({
            type: "dataZoom",
            end: 100,
          });
        }
      });
    }
  },
);

// 当新数据到达时，在实时模式下自动滚动
watch(
  () => props.series,
  () => {
    if (props.isRealtime && chartRef.value) {
      nextTick(() => {
        const chart = chartRef.value.getChart();
        if (chart) {
          chart.dispatchAction({
            type: "dataZoom",
            end: 100,
          });
        }
      });
    }
  },
  { deep: true },
);
</script>

<style scoped>
.realtime-chart {
  height: 100%;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.chart-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.chart-container {
  margin: 16px 0;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.3s ease;
}

.legend-item:hover {
  background: var(--el-fill-color-light);
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.legend-name {
  font-size: 12px;
  color: var(--el-text-color-regular);
  transition: color 0.3s ease;
}

.legend-disabled {
  color: var(--el-text-color-disabled);
  text-decoration: line-through;
}
</style>
