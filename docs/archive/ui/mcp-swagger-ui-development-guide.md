# MCP Swagger UI 开发指南

## 快速开始

### 环境要求

- **Node.js**: 18.0+ (推荐使用 LTS 版本)
- **npm/pnpm**: 最新版本
- **TypeScript**: 5.0+
- **现代浏览器**: Chrome 90+, Firefox 88+, Safari 14+

### 安装和启动

```bash
# 1. 进入项目目录
cd packages/mcp-swagger-ui

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 4. 在浏览器中访问
# http://localhost:3000
```

### 项目脚本

```bash
npm run dev        # 启动开发服务器
npm run build      # 构建生产版本
npm run preview    # 预览生产构建
npm run type-check # TypeScript 类型检查
npm run lint       # ESLint 代码检查
npm run lint:fix   # 自动修复 ESLint 问题
```

## 开发环境配置

### VS Code 推荐扩展

创建 `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "Vue.volar",                    // Vue 3 语言支持
    "Vue.vscode-typescript-vue-plugin", // Vue TypeScript 支持
    "bradlc.vscode-tailwindcss",    // Tailwind CSS 支持
    "esbenp.prettier-vscode",       // 代码格式化
    "dbaeumer.vscode-eslint",       // ESLint 集成
    "ms-vscode.vscode-typescript-next", // TypeScript 支持
    "formulahendry.auto-rename-tag", // 自动重命名标签
    "christian-kohler.path-intellisense" // 路径智能提示
  ]
}
```

### VS Code 工作区设置

创建 `.vscode/settings.json`:

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[vue]": {
    "editor.defaultFormatter": "Vue.volar"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "volar.completion.autoImportComponent": true
}
```

## 项目结构详解

### 目录组织原则

```
src/
├── components/     # 可复用组件
│   ├── common/     # 通用组件
│   ├── forms/      # 表单组件
│   └── display/    # 展示组件
├── views/          # 页面组件
├── stores/         # Pinia 状态管理
├── utils/          # 工具函数
├── types/          # TypeScript 类型定义
├── assets/         # 静态资源
├── styles/         # 全局样式
└── router/         # 路由配置
```

### 命名规范

- **组件文件**: PascalCase (如 `ApiPreview.vue`)
- **工具文件**: camelCase (如 `apiUtils.ts`)
- **类型文件**: PascalCase 接口 + camelCase 文件 (如 `types/index.ts`)
- **样式类**: kebab-case (如 `.api-preview`)

## 核心开发模式

### 1. 组件开发模式

#### 单文件组件结构
```vue
<template>
  <!-- 模板，使用 Element Plus 组件 -->
</template>

<script setup lang="ts">
// Composition API，TypeScript 优先
import { ref, computed, watch } from 'vue'
import type { ApiEndpoint } from '@/types'

// Props 定义
interface Props {
  endpoints: ApiEndpoint[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

// Emits 定义
interface Emits {
  update: [endpoints: ApiEndpoint[]]
  error: [message: string]
}

const emit = defineEmits<Emits>()

// 响应式状态
const selectedEndpoint = ref<ApiEndpoint | null>(null)

// 计算属性
const filteredEndpoints = computed(() => {
  return props.endpoints.filter(ep => !ep.deprecated)
})

// 方法
const handleSelect = (endpoint: ApiEndpoint) => {
  selectedEndpoint.value = endpoint
  emit('update', [endpoint])
}
</script>

<style scoped>
/* 组件作用域样式 */
.api-endpoint {
  @apply p-4 rounded-lg border border-gray-200;
}
</style>
```

#### 组件测试
```typescript
// components/__tests__/ApiPreview.test.ts
import { mount } from '@vue/test-utils'
import ApiPreview from '../ApiPreview.vue'
import type { ApiEndpoint } from '@/types'

describe('ApiPreview', () => {
  const mockEndpoints: ApiEndpoint[] = [
    {
      method: 'GET',
      path: '/users',
      summary: 'Get users'
    }
  ]

  it('renders endpoints correctly', () => {
    const wrapper = mount(ApiPreview, {
      props: { endpoints: mockEndpoints }
    })
    
    expect(wrapper.text()).toContain('Get users')
  })
})
```

### 2. 状态管理模式

#### Store 结构
```typescript
// stores/feature.ts
import { defineStore } from 'pinia'

export const useFeatureStore = defineStore('feature', {
  state: () => ({
    data: [] as FeatureItem[],
    loading: false,
    error: null as string | null
  }),

  getters: {
    itemCount: (state) => state.data.length,
    hasError: (state) => !!state.error
  },

  actions: {
    async fetchData() {
      this.loading = true
      this.error = null
      
      try {
        const response = await api.getData()
        this.data = response.data
      } catch (error) {
        this.error = error.message
      } finally {
        this.loading = false
      }
    },

    updateItem(id: string, updates: Partial<FeatureItem>) {
      const index = this.data.findIndex(item => item.id === id)
      if (index !== -1) {
        this.data[index] = { ...this.data[index], ...updates }
      }
    }
  }
})
```

#### 在组件中使用 Store
```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useFeatureStore } from '@/stores/feature'

const featureStore = useFeatureStore()
const { data, loading, error } = storeToRefs(featureStore)

// 响应式地使用 store 数据
const handleRefresh = () => {
  featureStore.fetchData()
}
</script>
```

### 3. API 服务模式

#### API 服务结构
```typescript
// services/api.ts
import axios from 'axios'
import type { ApiResponse, PaginatedResponse } from '@/types'

class ApiService {
  private readonly baseURL: string
  private readonly timeout: number

  constructor(baseURL: string, timeout = 10000) {
    this.baseURL = baseURL
    this.timeout = timeout
  }

  // 通用请求方法
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: any
  ): Promise<ApiResponse<T>> {
    try {
      const response = await axios({
        method,
        url: `${this.baseURL}${url}`,
        data,
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      })

      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  // 具体 API 方法
  async validateOpenApi(spec: string): Promise<ApiResponse<ValidationResult>> {
    return this.request('POST', '/validate', { spec })
  }

  async convertToMcp(config: ConvertConfig): Promise<ApiResponse<McpResult>> {
    return this.request('POST', '/convert', config)
  }
}

export const apiService = new ApiService(
  import.meta.env.VITE_API_BASE_URL || '/api'
)
```

### 4. 类型定义模式

#### 类型组织
```typescript
// types/api.ts - API 相关类型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

// types/domain.ts - 业务领域类型
export interface User {
  id: string
  name: string
  email: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateUserRequest {
  name: string
  email: string
}

// types/ui.ts - UI 相关类型
export interface TabItem {
  key: string
  label: string
  icon?: string
  disabled?: boolean
}

export interface FormState {
  values: Record<string, any>
  errors: Record<string, string>
  touched: Record<string, boolean>
}
```

## 样式开发指南

### Apple 风格设计系统

#### 颜色系统
```scss
// styles/variables.scss
:root {
  // 主色调
  --color-primary: #667eea;
  --color-primary-dark: #5a67d8;
  --color-primary-light: #7c3aed;

  // 功能色
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;

  // 中性色
  --color-gray-50: #f9fafb;
  --color-gray-100: #f3f4f6;
  --color-gray-200: #e5e7eb;
  --color-gray-300: #d1d5db;
  --color-gray-400: #9ca3af;
  --color-gray-500: #6b7280;
  --color-gray-600: #4b5563;
  --color-gray-700: #374151;
  --color-gray-800: #1f2937;
  --color-gray-900: #111827;

  // 渐变
  --gradient-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --gradient-surface: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
}
```

#### 组件样式模式
```scss
// styles/components.scss
.card {
  background: var(--gradient-surface);
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--color-gray-200);
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }

  &__header {
    padding: 20px 24px;
    border-bottom: 1px solid var(--color-gray-200);
    font-weight: 600;
    color: var(--color-gray-800);
  }

  &__body {
    padding: 24px;
  }
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
  border: none;

  &--primary {
    background: var(--gradient-primary);
    color: white;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
  }

  &--secondary {
    background: white;
    color: var(--color-gray-700);
    border: 1px solid var(--color-gray-300);

    &:hover {
      background: var(--color-gray-50);
      border-color: var(--color-gray-400);
    }
  }
}
```

#### 响应式设计
```scss
// styles/responsive.scss
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;

  @media (max-width: 768px) {
    padding: 0 16px;
  }
}

.grid {
  display: grid;
  gap: 24px;

  &--auto-fit {
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  }

  &--responsive {
    grid-template-columns: repeat(3, 1fr);

    @media (max-width: 1024px) {
      grid-template-columns: repeat(2, 1fr);
    }

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }
}
```

## 调试和测试

### 开发调试

#### Vue DevTools
```javascript
// 在开发环境中启用 Vue DevTools
if (import.meta.env.DEV) {
  const { createApp } = await import('vue')
  const { createPinia } = await import('pinia')
  
  const app = createApp(App)
  app.use(createPinia())
  
  // 启用 Vue DevTools
  app.config.devtools = true
}
```

#### 控制台调试
```typescript
// utils/debug.ts
export const debug = {
  log: (message: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.log(`[DEBUG] ${message}`, data)
    }
  },
  
  error: (message: string, error?: any) => {
    if (import.meta.env.DEV) {
      console.error(`[ERROR] ${message}`, error)
    }
  },
  
  table: (data: any) => {
    if (import.meta.env.DEV) {
      console.table(data)
    }
  }
}

// 在组件中使用
import { debug } from '@/utils/debug'

const handleApiCall = async () => {
  debug.log('Starting API call', { endpoint: '/api/convert' })
  try {
    const result = await apiService.convert(config)
    debug.log('API call successful', result)
  } catch (error) {
    debug.error('API call failed', error)
  }
}
```

### 单元测试

#### 测试配置
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
```

#### 测试示例
```typescript
// src/components/__tests__/ApiPreview.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ApiPreview from '../ApiPreview.vue'

describe('ApiPreview', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('displays API information correctly', () => {
    const props = {
      apiInfo: {
        title: 'Test API',
        version: '1.0.0',
        description: 'Test description'
      }
    }

    const wrapper = mount(ApiPreview, { props })

    expect(wrapper.find('[data-testid="api-title"]').text()).toBe('Test API')
    expect(wrapper.find('[data-testid="api-version"]').text()).toBe('1.0.0')
  })

  it('emits events correctly', async () => {
    const wrapper = mount(ApiPreview)
    
    await wrapper.find('[data-testid="refresh-button"]').trigger('click')
    
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })
})
```

## 性能优化

### 代码分割
```typescript
// router/index.ts
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'), // 懒加载
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/Settings.vue'),
  }
]
```

### 组件懒加载
```vue
<!-- 在组件中使用 Suspense -->
<template>
  <Suspense>
    <template #default>
      <AsyncComponent />
    </template>
    <template #fallback>
      <div class="loading">Loading...</div>
    </template>
  </Suspense>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

const AsyncComponent = defineAsyncComponent(
  () => import('@/components/HeavyComponent.vue')
)
</script>
```

### 虚拟滚动
```vue
<!-- 对于大列表使用虚拟滚动 -->
<template>
  <el-virtual-list
    :data="largeDataset"
    :height="400"
    :item-size="50"
  >
    <template #default="{ item }">
      <div class="list-item">{{ item.name }}</div>
    </template>
  </el-virtual-list>
</template>
```

## 部署指南

### 环境变量配置
```bash
# .env.production
VITE_APP_TITLE=MCP Swagger Server
VITE_API_BASE_URL=https://api.example.com
VITE_ENABLE_DEMO_MODE=false
```

### Docker 部署
```dockerfile
# Dockerfile
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 静态部署
```bash
# 构建生产版本
npm run build

# 部署到静态文件服务器
# dist/ 目录包含所有需要的文件
```

## 常见问题和解决方案

### 1. TypeScript 类型错误
```typescript
// 使用类型断言
const element = document.getElementById('app') as HTMLElement

// 使用可选链
const value = response.data?.user?.name || 'Unknown'

// 定义完整的类型
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
```

### 2. Element Plus 样式问题
```vue
<!-- 使用 :deep() 修改第三方组件样式 -->
<style scoped>
:deep(.el-button) {
  border-radius: 8px;
}

:deep(.el-input__inner) {
  border-color: var(--color-primary);
}
</style>
```

### 3. 路由导航问题
```typescript
// 使用 router.push 进行编程式导航
import { useRouter } from 'vue-router'

const router = useRouter()

const navigateToHome = () => {
  router.push({ name: 'Home' })
}
```

### 4. 状态持久化
```typescript
// 使用 localStorage 持久化状态
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    userPreferences: {}
  }),
  
  actions: {
    loadFromStorage() {
      const saved = localStorage.getItem('app-state')
      if (saved) {
        this.$patch(JSON.parse(saved))
      }
    },
    
    saveToStorage() {
      localStorage.setItem('app-state', JSON.stringify(this.$state))
    }
  }
})
```

这个开发指南提供了完整的开发流程、最佳实践和常见问题解决方案，帮助开发者快速上手并高效地开发 MCP Swagger UI 项目。
