<template>
  <div :class="['skeleton-container', { animated }]">
    <!-- 预定义骨架屏类型 -->
    <template v-if="type === 'card'">
      <div class="skeleton-card">
        <div class="skeleton-avatar" :style="{ width: avatarSize, height: avatarSize }"></div>
        <div class="skeleton-content">
          <div class="skeleton-title" :style="{ width: titleWidth }"></div>
          <div class="skeleton-paragraph">
            <div v-for="n in paragraphRows" :key="n" class="skeleton-line" 
                 :style="{ width: n === paragraphRows ? lastLineWidth : '100%' }"></div>
          </div>
        </div>
      </div>
    </template>
    
    <template v-else-if="type === 'list'">
      <div v-for="n in rows" :key="n" class="skeleton-list-item">
        <div v-if="avatar" class="skeleton-avatar-small"></div>
        <div class="skeleton-list-content">
          <div class="skeleton-line" :style="{ width: '60%' }"></div>
          <div class="skeleton-line" :style="{ width: '40%' }"></div>
        </div>
      </div>
    </template>
    
    <template v-else-if="type === 'table'">
      <div class="skeleton-table">
        <div class="skeleton-table-header">
          <div v-for="n in columns" :key="n" class="skeleton-table-cell header"></div>
        </div>
        <div v-for="n in rows" :key="n" class="skeleton-table-row">
          <div v-for="c in columns" :key="c" class="skeleton-table-cell"></div>
        </div>
      </div>
    </template>
    
    <template v-else-if="type === 'form'">
      <div class="skeleton-form">
        <div v-for="n in rows" :key="n" class="skeleton-form-item">
          <div class="skeleton-label"></div>
          <div class="skeleton-input"></div>
        </div>
      </div>
    </template>
    
    <template v-else-if="type === 'chart'">
      <div class="skeleton-chart">
        <div class="skeleton-chart-title"></div>
        <div class="skeleton-chart-content">
          <div class="skeleton-chart-bars">
            <div v-for="n in 8" :key="n" class="skeleton-bar" 
                 :style="{ height: Math.random() * 60 + 20 + '%' }"></div>
          </div>
          <div class="skeleton-chart-axis"></div>
        </div>
      </div>
    </template>
    
    <!-- 自定义骨架屏 -->
    <template v-else-if="type === 'custom'">
      <slot></slot>
    </template>
    
    <!-- 默认文本骨架屏 -->
    <template v-else>
      <div class="skeleton-paragraph">
        <div v-for="n in rows" :key="n" class="skeleton-line" 
             :style="{ width: n === rows ? lastLineWidth : '100%' }"></div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
interface Props {
  type?: 'text' | 'card' | 'list' | 'table' | 'form' | 'chart' | 'custom'
  rows?: number
  columns?: number
  animated?: boolean
  avatar?: boolean
  avatarSize?: string
  titleWidth?: string
  paragraphRows?: number
  lastLineWidth?: string
}

withDefaults(defineProps<Props>(), {
  type: 'text',
  rows: 3,
  columns: 4,
  animated: true,
  avatar: false,
  avatarSize: '40px',
  titleWidth: '60%',
  paragraphRows: 3,
  lastLineWidth: '70%'
})
</script>

<style scoped>
.skeleton-container {
  width: 100%;
}

.skeleton-container.animated .skeleton-line,
.skeleton-container.animated .skeleton-avatar,
.skeleton-container.animated .skeleton-avatar-small,
.skeleton-container.animated .skeleton-title,
.skeleton-container.animated .skeleton-input,
.skeleton-container.animated .skeleton-label,
.skeleton-container.animated .skeleton-table-cell,
.skeleton-container.animated .skeleton-bar,
.skeleton-container.animated .skeleton-chart-title,
.skeleton-container.animated .skeleton-chart-axis {
  animation: skeleton-loading 1.5s ease-in-out infinite;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.skeleton-line,
.skeleton-avatar,
.skeleton-avatar-small,
.skeleton-title,
.skeleton-input,
.skeleton-label,
.skeleton-table-cell,
.skeleton-bar,
.skeleton-chart-title,
.skeleton-chart-axis {
  background: linear-gradient(
    90deg,
    var(--el-fill-color-light) 25%,
    var(--el-fill-color) 50%,
    var(--el-fill-color-light) 75%
  );
  background-size: 200% 100%;
  border-radius: 4px;
}

/* 卡片骨架屏 */
.skeleton-card {
  display: flex;
  gap: 16px;
  padding: 16px;
}

.skeleton-avatar {
  border-radius: 50%;
  flex-shrink: 0;
}

.skeleton-content {
  flex: 1;
}

.skeleton-title {
  height: 20px;
  margin-bottom: 12px;
}

/* 列表骨架屏 */
.skeleton-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.skeleton-list-item:last-child {
  border-bottom: none;
}

.skeleton-avatar-small {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
}

.skeleton-list-content {
  flex: 1;
}

/* 表格骨架屏 */
.skeleton-table {
  width: 100%;
}

.skeleton-table-header {
  display: flex;
  gap: 1px;
  margin-bottom: 8px;
}

.skeleton-table-row {
  display: flex;
  gap: 1px;
  margin-bottom: 8px;
}

.skeleton-table-cell {
  flex: 1;
  height: 32px;
}

.skeleton-table-cell.header {
  height: 40px;
  background-color: var(--el-fill-color-darker);
}

/* 表单骨架屏 */
.skeleton-form {
  width: 100%;
}

.skeleton-form-item {
  margin-bottom: 24px;
}

.skeleton-label {
  width: 80px;
  height: 16px;
  margin-bottom: 8px;
}

.skeleton-input {
  width: 100%;
  height: 32px;
}

/* 图表骨架屏 */
.skeleton-chart {
  width: 100%;
  padding: 16px;
}

.skeleton-chart-title {
  width: 150px;
  height: 20px;
  margin-bottom: 24px;
}

.skeleton-chart-content {
  position: relative;
}

.skeleton-chart-bars {
  display: flex;
  align-items: end;
  gap: 8px;
  height: 200px;
  margin-bottom: 8px;
}

.skeleton-bar {
  flex: 1;
  min-height: 20px;
}

.skeleton-chart-axis {
  width: 100%;
  height: 1px;
}

/* 段落骨架屏 */
.skeleton-paragraph {
  width: 100%;
}

.skeleton-line {
  height: 16px;
  margin-bottom: 8px;
}

.skeleton-line:last-child {
  margin-bottom: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .skeleton-card {
    flex-direction: column;
    text-align: center;
  }
  
  .skeleton-avatar {
    align-self: center;
  }
  
  .skeleton-table-row,
  .skeleton-table-header {
    flex-direction: column;
    gap: 8px;
  }
  
  .skeleton-chart-bars {
    height: 150px;
  }
}
</style>
