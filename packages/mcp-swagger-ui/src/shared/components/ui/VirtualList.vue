<template>
  <div 
    ref="containerRef"
    class="virtual-list"
    :style="{ height: height + 'px' }"
    @scroll="handleScroll"
  >
    <!-- 总高度占位 -->
    <div :style="{ height: totalHeight + 'px' }" class="virtual-list-spacer">
      <!-- 可见项目容器 -->
      <div 
        class="virtual-list-content"
        :style="{ 
          transform: `translateY(${offsetY}px)`,
          position: 'relative'
        }"
      >
        <div
          v-for="(item, index) in visibleItems"
          :key="getItemKey(item, startIndex + index)"
          :style="{ height: itemHeight + 'px' }"
          class="virtual-list-item"
          :class="{ 'virtual-list-item-odd': (startIndex + index) % 2 === 1 }"
        >
          <slot :item="item" :index="startIndex + index" />
        </div>
      </div>
    </div>
    
    <!-- 加载更多指示器 -->
    <div v-if="hasMore && isNearBottom" class="virtual-list-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载更多...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Loading } from '@element-plus/icons-vue'

interface Props {
  items: any[]
  itemHeight: number
  height: number
  hasMore?: boolean
  keyField?: string
}

interface Emits {
  (e: 'load-more'): void
  (e: 'scroll', event: Event): void
}

const props = withDefaults(defineProps<Props>(), {
  hasMore: false,
  keyField: 'id'
})

const emit = defineEmits<Emits>()

// 引用
const containerRef = ref<HTMLElement>()

// 状态
const scrollTop = ref(0)
const isNearBottom = ref(false)

// 计算属性
const visibleCount = computed(() => Math.ceil(props.height / props.itemHeight) + 2)

const startIndex = computed(() => {
  const index = Math.floor(scrollTop.value / props.itemHeight)
  return Math.max(0, index - 1)
})

const endIndex = computed(() => {
  return Math.min(props.items.length, startIndex.value + visibleCount.value)
})

const visibleItems = computed(() => {
  return props.items.slice(startIndex.value, endIndex.value)
})

const totalHeight = computed(() => props.items.length * props.itemHeight)

const offsetY = computed(() => startIndex.value * props.itemHeight)

// 方法
const getItemKey = (item: any, index: number): string | number => {
  if (props.keyField && item[props.keyField] !== undefined) {
    return item[props.keyField]
  }
  return index
}

const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  scrollTop.value = target.scrollTop
  
  // 检查是否接近底部
  const { scrollTop: st, scrollHeight, clientHeight } = target
  const bottomDistance = scrollHeight - st - clientHeight
  isNearBottom.value = bottomDistance < props.itemHeight * 3
  
  // 如果接近底部且有更多数据，触发加载更多
  if (isNearBottom.value && props.hasMore) {
    emit('load-more')
  }
  
  emit('scroll', event)
}

const scrollToTop = () => {
  if (containerRef.value) {
    containerRef.value.scrollTop = 0
  }
}

const scrollToBottom = () => {
  if (containerRef.value) {
    containerRef.value.scrollTop = containerRef.value.scrollHeight
  }
}

const scrollToIndex = (index: number) => {
  if (containerRef.value) {
    const targetScrollTop = index * props.itemHeight
    containerRef.value.scrollTop = targetScrollTop
  }
}

// 监听项目变化，保持滚动位置
watch(() => props.items.length, (newLength, oldLength) => {
  if (newLength > oldLength && containerRef.value) {
    // 如果用户在底部，自动滚动到新的底部
    const { scrollTop: st, scrollHeight, clientHeight } = containerRef.value
    const bottomDistance = scrollHeight - st - clientHeight
    
    if (bottomDistance < props.itemHeight * 2) {
      nextTick(() => {
        scrollToBottom()
      })
    }
  }
})

// 暴露方法
defineExpose({
  scrollToTop,
  scrollToBottom,
  scrollToIndex
})
</script>

<style scoped>
.virtual-list {
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

.virtual-list-spacer {
  position: relative;
}

.virtual-list-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.virtual-list-item {
  display: flex;
  align-items: center;
  padding: 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  transition: background-color 0.2s ease;
}

.virtual-list-item:hover {
  background: var(--el-bg-color-page);
}

.virtual-list-item-odd {
  background: var(--el-fill-color-lighter);
}

.virtual-list-item-odd:hover {
  background: var(--el-bg-color-page);
}

.virtual-list-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

/* 自定义滚动条 */
.virtual-list::-webkit-scrollbar {
  width: 8px;
}

.virtual-list::-webkit-scrollbar-track {
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
}

.virtual-list::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 4px;
}

.virtual-list::-webkit-scrollbar-thumb:hover {
  background: var(--el-border-color-darker);
}
</style>
