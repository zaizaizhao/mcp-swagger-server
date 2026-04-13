# MCP Swagger UI 技术文档

## 概述

MCP Swagger UI 是一个基于 Vue 3 的现代化前端应用，用于将 OpenAPI/Swagger 规范转换为 Model Context Protocol (MCP) 格式。该应用采用 Apple 风格的设计理念，提供简洁、直观的用户界面。

## 技术栈

### 核心框架
- **Vue 3.4+**: 采用 Composition API，提供更好的类型推断和代码组织
- **TypeScript**: 全面的类型安全保障
- **Vite 5.0+**: 现代化的构建工具，提供快速的开发体验

### UI 框架
- **Element Plus 2.4+**: Vue 3 的企业级 UI 组件库
- **Element Plus Icons**: 丰富的图标组件
- **Apple 风格自定义样式**: 渐变背景、圆角卡片、柔和阴影

### 状态管理
- **Pinia 2.1+**: Vue 3 官方推荐的状态管理库
- **TypeScript 接口**: 强类型状态定义

### 网络请求
- **Axios 1.6+**: HTTP 客户端，支持请求/响应拦截器
- **代理配置**: 开发环境自动代理到后端服务

### 开发工具
- **ESLint + Prettier**: 代码规范和格式化
- **Vue TSC**: TypeScript 类型检查
- **Unplugin Auto Import**: 自动导入 Vue APIs
- **Unplugin Vue Components**: 自动导入组件

## 项目结构

```
packages/mcp-swagger-ui/
├── public/                    # 静态资源
├── src/
│   ├── components/           # 可复用组件
│   │   ├── ApiPreview.vue   # API 预览组件
│   │   ├── ConfigSection.vue # 配置面板组件
│   │   ├── PageHeader.vue   # 页面头部组件
│   │   └── ResultSection.vue # 结果展示组件
│   ├── router/              # Vue Router 配置
│   │   └── index.ts         # 路由定义
│   ├── stores/              # Pinia 状态管理
│   │   └── app.ts           # 应用全局状态
│   ├── types/               # TypeScript 类型定义
│   │   └── index.ts         # 接口和类型声明
│   ├── utils/               # 工具函数
│   │   ├── api.ts           # API 调用封装
│   │   └── demo-data.ts     # 演示数据
│   ├── views/               # 页面组件
│   │   └── Home.vue         # 主页面
│   ├── App.vue              # 根组件
│   └── main.ts              # 应用入口
├── .env.development         # 开发环境配置
├── .env.production          # 生产环境配置
├── package.json             # 项目依赖和脚本
├── vite.config.ts           # Vite 配置
└── tsconfig.json            # TypeScript 配置
```

## 核心模块详解

### 1. 主页面组件 (Home.vue)

`Home.vue` 是应用的核心组件，采用 Apple 风格设计，集成了所有主要功能。

#### 组件结构
```vue
<template>
  <div class="container">
    <!-- 头部：品牌展示和功能介绍 -->
    <div class="header">
      <!-- 应用标题和描述 -->
    </div>

    <div class="main-content">
      <!-- 输入部分：多标签页输入 -->
      <div class="input-section">
        <!-- URL/文件/文本输入 -->
      </div>

      <!-- API 预览：解析后的信息展示 -->
      <div class="preview-section">
        <!-- API 基本信息和端点列表 -->
      </div>

      <!-- 配置部分：转换参数设置 -->
      <div class="config-section">
        <!-- HTTP 方法过滤、高级选项、传输协议 -->
      </div>

      <!-- 结果部分：转换结果展示 -->
      <div class="results-section">
        <!-- MCP 配置文件预览和下载 -->
      </div>
    </div>

    <!-- 页脚：版权信息 -->
    <div class="footer">
    </div>
  </div>
</template>
```

#### 关键功能实现

**1. 多输入源支持**
```typescript
// 状态管理
const activeTab = ref('url')
const urlInput = ref('https://petstore.swagger.io/v2/swagger.json')
const authInput = ref('')
const textInput = ref('')
const fileName = ref('')

// 输入处理逻辑
const handleConvert = async () => {
  let content = ''
  let type: 'url' | 'file' | 'text' = 'url'
  
  switch (activeTab.value) {
    case 'url':
      content = urlInput.value
      type = 'url'
      break
    case 'file':
      content = textInput.value // 文件内容读取到 textInput
      type = 'file'
      break
    case 'text':
      content = textInput.value
      type = 'text'
      break
  }
  
  // 设置输入源并调用转换
  appStore.setInputSource({ type, content, auth: authInput.value ? {
    type: 'bearer',
    token: authInput.value
  } : undefined })
  
  await appStore.previewApi()
  await appStore.convertToMcp()
}
```

**2. 文件拖放功能**
```typescript
// 文件拖放状态
const isDragOver = ref(false)

// 拖放事件处理
const handleFileDrop = (event: DragEvent) => {
  isDragOver.value = false
  const file = event.dataTransfer?.files[0]
  if (file) {
    fileName.value = file.name
    const reader = new FileReader()
    reader.onload = (e) => {
      textInput.value = e.target?.result as string
    }
    reader.readAsText(file)
  }
}
```

**3. 进度指示器**
```typescript
// 进度状态
const progressPercentage = ref(0)

// 监听加载状态，模拟进度
watch(() => appStore.loading, (loading) => {
  if (loading) {
    progressPercentage.value = 0
    const timer = setInterval(() => {
      progressPercentage.value += Math.random() * 15
      if (progressPercentage.value >= 95) {
        progressPercentage.value = 95
        clearInterval(timer)
      }
    }, 200)
  } else {
    progressPercentage.value = 100
  }
})
```

### 2. 状态管理 (stores/app.ts)

使用 Pinia 进行全局状态管理，包含输入源、配置、API 信息、转换结果等。

#### 状态结构
```typescript
interface AppState {
  inputSource: InputSource;        // 输入源（URL/文件/文本）
  config: ConvertConfig;           // 转换配置
  apiInfo: OpenApiInfo | null;     // API 基本信息
  endpoints: ApiEndpoint[];        // API 端点列表
  convertResult: ConvertResult | null; // 转换结果
  loading: boolean;                // 加载状态
  error: string | null;            // 错误信息
}
```

#### 核心 Actions

**1. setInputSource() - 设置输入源**
```typescript
setInputSource(source: Partial<InputSource>) {
  this.inputSource = { ...this.inputSource, ...source }
  this.clearResults() // 清除之前的结果
}
```

**2. previewApi() - 预览 API**
```typescript
async previewApi() {
  if (!this.isValidInput) {
    throw new Error('请提供有效的输入内容')
  }

  this.loading = true
  this.error = null

  try {
    const result = await previewApi(this.inputSource)
    if (result.success && result.data) {
      this.apiInfo = result.data.apiInfo
      this.endpoints = result.data.endpoints || []
    } else {
      this.error = result.error || '预览失败'
    }
  } catch (error) {
    this.error = error instanceof Error ? error.message : '预览失败'
  } finally {
    this.loading = false
  }
}
```

**3. convertToMcp() - 转换为 MCP 格式**
```typescript
async convertToMcp() {
  if (!this.isValidInput) {
    throw new Error('请提供有效的输入内容')
  }

  this.loading = true
  this.error = null

  try {
    const result = await convertApi({
      source: this.inputSource,
      config: this.config
    })
    
    if (result.success && result.data) {
      this.convertResult = result.data
      // 如果还没有预览数据，更新预览信息
      if (!this.apiInfo && result.data.metadata) {
        this.apiInfo = result.data.metadata.apiInfo
      }
    } else {
      this.error = result.error || '转换失败'
    }
  } catch (error) {
    this.error = error instanceof Error ? error.message : '转换失败'
  } finally {
    this.loading = false
  }
}
```

#### Getters

**1. availableTags - 获取可用标签**
```typescript
availableTags: (state) => {
  const tags = new Set<string>()
  state.endpoints.forEach(endpoint => {
    endpoint.tags?.forEach(tag => tags.add(tag))
  })
  return Array.from(tags)
}
```

**2. filteredEndpoints - 过滤后的端点**
```typescript
filteredEndpoints: (state) => {
  return state.endpoints.filter(endpoint => {
    // 方法过滤
    if (!state.config.filters.methods.includes(endpoint.method.toUpperCase())) {
      return false
    }
    
    // 标签过滤
    if (state.config.filters.tags.length > 0) {
      const hasMatchingTag = endpoint.tags?.some(tag => 
        state.config.filters.tags.includes(tag)
      )
      if (!hasMatchingTag) return false
    }
    
    // 是否包含已弃用的端点
    if (!state.config.filters.includeDeprecated && endpoint.deprecated) {
      return false
    }
    
    return true
  })
}
```

### 3. API 层 (utils/api.ts)

封装了与后端服务的交互逻辑，支持演示模式。

#### Axios 实例配置
```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 响应拦截器
api.interceptors.response.use(
  (response: any) => response.data,
  (error: any) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)
```

#### 核心 API 函数

**1. validateApi() - 验证 OpenAPI 规范**
```typescript
export async function validateApi(source: InputSource): Promise<ApiResponse> {
  try {
    if (isDemoMode) {
      await delay(1000) // 模拟网络延迟
      return {
        success: true,
        data: { valid: true },
        message: '验证成功'
      }
    }
    
    const response = await api.post('/validate', { source })
    return response
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '验证失败'
    }
  }
}
```

**2. previewApi() - 预览 API 信息**
```typescript
export async function previewApi(source: InputSource): Promise<ApiResponse> {
  try {
    if (isDemoMode) {
      await delay(1500) // 模拟网络延迟
      return {
        success: true,
        data: {
          apiInfo: demoApiInfo,
          endpoints: demoEndpoints
        },
        message: '预览成功'
      }
    }
    
    const response = await api.post('/preview', { source })
    return response
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '预览失败'
    }
  }
}
```

**3. convertApi() - 转换为 MCP 格式**
```typescript
export async function convertApi(params: {
  source: InputSource
  config: ConvertConfig
}): Promise<ApiResponse> {
  try {
    if (isDemoMode) {
      await delay(2000) // 模拟网络延迟
      return {
        success: true,
        data: demoConvertResult,
        message: '转换成功'
      }
    }
    
    const response = await api.post('/convert', params)
    return response
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '转换失败'
    }
  }
}
```

### 4. 类型定义 (types/index.ts)

定义了完整的 TypeScript 接口，确保类型安全。

#### 核心接口

**1. InputSource - 输入源类型**
```typescript
export interface InputSource {
  type: 'url' | 'file' | 'text';
  content: string;
  auth?: {
    type: 'bearer' | 'apikey' | 'basic';
    token: string;
  };
}
```

**2. ConvertConfig - 转换配置**
```typescript
export interface ConvertConfig {
  filters: {
    methods: string[];           // HTTP 方法过滤
    tags: string[];             // 标签过滤
    includeDeprecated: boolean; // 是否包含已弃用端点
  };
  transport: 'stdio' | 'sse' | 'streamable'; // 传输协议
  optimization: {
    generateValidation: boolean; // 生成参数验证
    includeExamples: boolean;   // 包含示例
    optimizeNames: boolean;     // 优化名称
  };
}
```

**3. ConvertResult - 转换结果**
```typescript
export interface ConvertResult {
  mcpConfig: {
    mcpServers: any;           // MCP 服务器配置
    tools: McpToolConfig[];    // MCP 工具列表
  };
  metadata: {
    apiInfo: OpenApiInfo;      // API 基本信息
    stats: {
      totalEndpoints: number;       // 总端点数
      convertedTools: number;       // 转换的工具数
      skippedEndpoints: number;     // 跳过的端点数
    };
  };
  processingTime: number;      // 处理时间
}
```

### 5. 工具函数

#### 文件下载
```typescript
export function downloadFile(content: string, filename: string, type = 'application/json') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
```

#### 剪贴板操作
```typescript
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.error('复制失败:', error)
    return false
  }
}
```

## 样式设计

### Apple 风格设计原则

1. **极简主义**: 清洁的界面，没有多余的视觉元素
2. **渐变背景**: 使用柔和的蓝紫色渐变
3. **圆角设计**: 所有卡片和按钮使用 8-15px 圆角
4. **柔和阴影**: 0 20px 40px rgba(0,0,0,0.1) 类型的阴影
5. **响应式设计**: 移动端友好的布局

### 核心样式类

**1. 容器和布局**
```css
.container {
  max-width: 1200px;
  margin: 0 auto;
  background: white;
  border-radius: 15px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.1);
  overflow: hidden;
}

.main-content {
  padding: 40px;
}
```

**2. 渐变和颜色**
```css
.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px;
  text-align: center;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}
```

**3. 动画效果**
```css
.fade-in-up {
  animation: fadeInUp 0.6s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

## 配置文件

### Vite 配置 (vite.config.ts)
```typescript
export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      imports: ['vue', 'vue-router', 'pinia'],
      dts: true
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: true
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3322',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  }
})
```

### 环境配置
```bash
# .env.development
VITE_APP_TITLE=MCP Swagger Server
VITE_API_BASE_URL=http://localhost:3000/api
VITE_ENABLE_DEMO_MODE=true
```

## 开发和构建

### 开发环境启动
```bash
npm run dev
```

### 类型检查
```bash
npm run type-check
```

### 构建生产版本
```bash
npm run build
```

### 代码规范检查
```bash
npm run lint
```

## 主要特性

1. **响应式设计**: 支持桌面端和移动端
2. **多输入源**: URL、文件上传、文本粘贴
3. **实时预览**: 解析 OpenAPI 规范并展示信息
4. **配置灵活**: 支持端点过滤、传输协议选择等
5. **演示模式**: 支持离线演示，便于开发和测试
6. **类型安全**: 全面的 TypeScript 类型定义
7. **现代化构建**: 基于 Vite 的快速开发体验

## 扩展建议

1. **多语言支持**: 添加 i18n 国际化
2. **主题切换**: 支持暗色主题
3. **历史记录**: 保存转换历史
4. **批量处理**: 支持批量转换多个 API
5. **导出格式**: 支持多种配置文件格式
6. **在线编辑**: 集成 Monaco Editor 进行在线编辑
7. **测试工具**: 集成 API 测试功能

这个技术文档涵盖了 MCP Swagger UI 项目的核心架构、主要模块、关键函数和设计思路，为进一步开发提供了详细的技术指南。
