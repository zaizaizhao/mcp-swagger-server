<template>
  <el-card class="api-preview" shadow="hover">
    <template #header>
      <div class="card-header">
        <span>📋 API 信息预览</span>
        <el-tag :type="getStatusType()" size="large">
          {{ getStatusText() }}
        </el-tag>
      </div>
    </template>

    <!-- API 基本信息 -->
    <el-row :gutter="20" class="api-info">
      <el-col :xs="24" :sm="12" :md="6">
        <div class="info-card">
          <div class="info-label">API 标题</div>
          <div class="info-value">{{ appStore.apiInfo?.title || '-' }}</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <div class="info-card">
          <div class="info-label">版本</div>
          <div class="info-value">{{ appStore.apiInfo?.version || '-' }}</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <div class="info-card">
          <div class="info-label">服务器</div>
          <div class="info-value">{{ appStore.apiInfo?.serverUrl || '-' }}</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <div class="info-card">
          <div class="info-label">端点数量</div>
          <div class="info-value">{{ appStore.endpoints.length }} 个</div>
        </div>
      </el-col>
    </el-row>

    <!-- API 描述 -->
    <div v-if="appStore.apiInfo?.description" class="api-description">
      <h4>📝 API 描述</h4>
      <p>{{ appStore.apiInfo.description }}</p>
    </div>

    <!-- 端点列表 -->
    <div v-if="appStore.endpoints.length > 0" class="endpoints-section">
      <div class="section-header">
        <h4>🔗 API 端点 ({{ filteredEndpoints.length }} 个)</h4>
        <div class="filter-controls">
          <el-select
            v-model="selectedMethods"
            multiple
            placeholder="筛选方法"
            size="small"
            style="width: 200px"
          >
            <el-option
              v-for="method in availableMethods"
              :key="method"
              :label="method"
              :value="method"
            />
          </el-select>
          <el-select
            v-model="selectedTags"
            multiple
            placeholder="筛选标签"
            size="small"
            style="width: 200px; margin-left: 10px"
          >
            <el-option
              v-for="tag in appStore.availableTags"
              :key="tag"
              :label="tag"
              :value="tag"
            />
          </el-select>
        </div>
      </div>

      <div class="endpoints-grid">
        <div
          v-for="endpoint in filteredEndpoints.slice(0, displayCount)"
          :key="`${endpoint.method}-${endpoint.path}`"
          class="endpoint-card"
        >
          <div class="endpoint-header">
            <el-tag
              :type="getMethodTagType(endpoint.method)"
              size="small"
              class="method-tag"
            >
              {{ endpoint.method.toUpperCase() }}
            </el-tag>
            <el-tag v-if="endpoint.deprecated" type="danger" size="small">
              已弃用
            </el-tag>
          </div>
          <div class="endpoint-path">{{ endpoint.path }}</div>
          <div v-if="endpoint.summary" class="endpoint-summary">
            {{ endpoint.summary }}
          </div>
          <div v-if="endpoint.tags && endpoint.tags.length > 0" class="endpoint-tags">
            <el-tag
              v-for="tag in endpoint.tags"
              :key="tag"
              size="small"
              type="info"
              effect="plain"
            >
              {{ tag }}
            </el-tag>
          </div>
        </div>
      </div>

      <!-- 显示更多按钮 -->
      <div v-if="filteredEndpoints.length > displayCount" class="show-more">
        <el-button @click="showMore" type="primary" text>
          显示更多 (还有 {{ filteredEndpoints.length - displayCount }} 个)
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

// 筛选条件
const selectedMethods = ref<string[]>([])
const selectedTags = ref<string[]>([])
const displayCount = ref(6)

// 可用的 HTTP 方法
const availableMethods = computed(() => {
  const methods = new Set<string>()
  appStore.endpoints.forEach(endpoint => {
    methods.add(endpoint.method.toUpperCase())
  })
  return Array.from(methods).sort()
})

// 过滤后的端点
const filteredEndpoints = computed(() => {
  return appStore.endpoints.filter(endpoint => {
    // 方法过滤
    if (selectedMethods.value.length > 0) {
      if (!selectedMethods.value.includes(endpoint.method.toUpperCase())) {
        return false
      }
    }
    
    // 标签过滤
    if (selectedTags.value.length > 0) {
      const hasMatchingTag = endpoint.tags?.some(tag => 
        selectedTags.value.includes(tag)
      )
      if (!hasMatchingTag) return false
    }
    
    return true
  })
})

// 获取状态类型
const getStatusType = () => {
  if (appStore.error) return 'danger'
  if (appStore.apiInfo) return 'success'
  return 'info'
}

// 获取状态文本
const getStatusText = () => {
  if (appStore.error) return '❌ 解析失败'
  if (appStore.apiInfo) return '✅ 已解析'
  return '⏳ 等待解析'
}

// 获取方法标签类型
const getMethodTagType = (method: string) => {
  const methodUpper = method.toUpperCase()
  switch (methodUpper) {
    case 'GET': return 'success'
    case 'POST': return 'primary'
    case 'PUT': return 'warning'
    case 'DELETE': return 'danger'
    case 'PATCH': return 'info'
    default: return ''
  }
}

// 显示更多
const showMore = () => {
  displayCount.value += 6
}
</script>

<style scoped>
.api-preview {
  margin-bottom: 30px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.2rem;
  font-weight: 600;
  color: #495057;
}

.api-info {
  margin-bottom: 20px;
}

.info-card {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #667eea;
  margin-bottom: 15px;
}

.info-label {
  font-size: 0.9rem;
  color: #6c757d;
  margin-bottom: 5px;
}

.info-value {
  font-size: 1.1rem;
  font-weight: 600;
  color: #495057;
  word-break: break-all;
}

.api-description {
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.api-description h4 {
  margin-bottom: 10px;
  color: #495057;
}

.api-description p {
  margin: 0;
  color: #6c757d;
  line-height: 1.6;
}

.endpoints-section {
  margin-top: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  flex-wrap: wrap;
  gap: 10px;
}

.section-header h4 {
  margin: 0;
  color: #495057;
}

.filter-controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.endpoints-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.endpoint-card {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px;
  transition: all 0.3s ease;
}

.endpoint-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.endpoint-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.method-tag {
  font-weight: 600;
}

.endpoint-path {
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  color: #495057;
  margin-bottom: 8px;
  word-break: break-all;
}

.endpoint-summary {
  font-size: 0.9rem;
  color: #6c757d;
  margin-bottom: 10px;
  line-height: 1.4;
}

.endpoint-tags {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.show-more {
  text-align: center;
  padding: 20px;
}

@media (max-width: 768px) {
  .endpoints-grid {
    grid-template-columns: 1fr;
  }
  
  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .filter-controls {
    width: 100%;
  }
  
  .filter-controls .el-select {
    width: 100% !important;
    margin-left: 0 !important;
    margin-top: 10px;
  }
}
</style>
