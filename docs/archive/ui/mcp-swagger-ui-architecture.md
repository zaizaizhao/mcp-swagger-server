# MCP Swagger UI 架构设计文档

## 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    用户界面层 (UI Layer)                      │
├─────────────────────────────────────────────────────────────┤
│                         Home.vue                            │
│  ┌─────────────────┬─────────────────┬─────────────────┐    │
│  │   输入区域      │    预览区域     │    配置区域     │    │
│  │ ─────────────── │ ─────────────── │ ─────────────── │    │
│  │ • URL 输入      │ • API 信息      │ • HTTP 方法     │    │
│  │ • 文件上传      │ • 端点列表      │ • 标签过滤      │    │
│  │ • 文本粘贴      │ • 状态显示      │ • 高级选项      │    │
│  └─────────────────┴─────────────────┴─────────────────┘    │
│                         结果区域                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ • MCP 配置预览  • 下载功能  • 复制功能  • 启动命令     │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↕ (Vue Router)
┌─────────────────────────────────────────────────────────────┐
│                   状态管理层 (State Layer)                    │
├─────────────────────────────────────────────────────────────┤
│                        Pinia Store                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ AppStore (stores/app.ts)                                │ │
│  │ ├─ State:                                               │ │
│  │ │  • inputSource: InputSource                          │ │
│  │ │  • config: ConvertConfig                             │ │
│  │ │  • apiInfo: OpenApiInfo                              │ │
│  │ │  • endpoints: ApiEndpoint[]                          │ │
│  │ │  • convertResult: ConvertResult                      │ │
│  │ │  • loading: boolean                                  │ │
│  │ │  • error: string                                     │ │
│  │ ├─ Getters:                                             │ │
│  │ │  • isValidInput                                      │ │
│  │ │  • availableTags                                     │ │
│  │ │  • filteredEndpoints                                 │ │
│  │ ├─ Actions:                                             │ │
│  │ │  • setInputSource()                                  │ │
│  │ │  • validateInput()                                   │ │
│  │ │  • previewApi()                                      │ │
│  │ │  • convertToMcp()                                    │ │
│  │ └─ Mutations: (通过 Actions 自动处理)                    │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↕ (Axios HTTP)
┌─────────────────────────────────────────────────────────────┐
│                    服务层 (Service Layer)                    │
├─────────────────────────────────────────────────────────────┤
│                      API Service                            │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ utils/api.ts                                            │ │
│  │ ├─ validateApi(source): 验证 OpenAPI 规范                │ │
│  │ ├─ previewApi(source): 预览 API 信息                     │ │
│  │ ├─ convertApi(params): 转换为 MCP 格式                   │ │
│  │ ├─ downloadFile(): 文件下载工具                          │ │
│  │ └─ copyToClipboard(): 剪贴板操作                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ utils/demo-data.ts (演示模式数据)                        │ │
│  │ ├─ demoApiInfo: 演示 API 信息                           │ │
│  │ ├─ demoEndpoints: 演示端点数据                          │ │
│  │ └─ demoConvertResult: 演示转换结果                       │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↕ (HTTP/WebSocket)
┌─────────────────────────────────────────────────────────────┐
│                    后端服务 (Backend)                        │
├─────────────────────────────────────────────────────────────┤
│                   MCP Swagger Server                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ HTTP API 端点:                                          │ │
│  │ ├─ POST /api/validate    - 验证 OpenAPI 规范            │ │
│  │ ├─ POST /api/preview     - 预览 API 信息                │ │
│  │ └─ POST /api/convert     - 转换为 MCP 格式               │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 数据流图

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   用户输入      │    │   状态管理      │    │   API 调用      │
│                 │    │                 │    │                 │
│ • URL 地址      │───▶│ setInputSource  │───▶│ validateApi     │
│ • 上传文件      │    │                 │    │                 │
│ • 粘贴文本      │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│                 │    │ │ inputSource │ │    │ │   验证结果  │ │
└─────────────────┘    │ │   config    │ │    │ └─────────────┘ │
                       │ │  loading    │ │    │                 │
┌─────────────────┐    │ │   error     │ │    │ previewApi      │
│   配置选项      │───▶│ └─────────────┘ │───▶│                 │
│                 │    │                 │    │ ┌─────────────┐ │
│ • HTTP 方法     │    │ setConfig       │    │ │   API 信息  │ │
│ • 标签过滤      │    │                 │    │ │   端点列表  │ │
│ • 高级选项      │    │ ┌─────────────┐ │    │ └─────────────┘ │
│                 │    │ │   apiInfo   │ │    │                 │
└─────────────────┘    │ │  endpoints  │ │◀───│ convertApi      │
                       │ └─────────────┘ │    │                 │
┌─────────────────┐    │                 │    │ ┌─────────────┐ │
│   用户操作      │    │ convertToMcp    │    │ │ MCP 配置    │ │
│                 │───▶│                 │    │ │   工具列表  │ │
│ • 转换按钮      │    │ ┌─────────────┐ │    │ │   元数据    │ │
│ • 验证按钮      │    │ │convertResult│ │◀───│ └─────────────┘ │
│ • 下载按钮      │    │ └─────────────┘ │    │                 │
│                 │    │                 │    └─────────────────┘
└─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   用户界面      │
                       │                 │
                       │ • 进度指示器    │
                       │ • 预览面板      │
                       │ • 结果展示      │
                       │ • 错误提示      │
                       │                 │
                       └─────────────────┘
```

## 组件关系图

```
App.vue
├─ router-view
   └─ Home.vue (主页面)
      ├─ 输入部分 (内联组件)
      │  ├─ URL 输入标签页
      │  ├─ 文件上传标签页
      │  └─ 文本输入标签页
      │
      ├─ 预览部分 (内联组件)
      │  ├─ API 基本信息卡片
      │  ├─ 端点列表网格
      │  └─ 状态徽章
      │
      ├─ 配置部分 (内联组件)
      │  ├─ HTTP 方法过滤
      │  ├─ 标签过滤
      │  ├─ 高级选项
      │  └─ 传输协议选择
      │
      └─ 结果部分 (内联组件)
         ├─ MCP 配置预览
         ├─ 下载按钮
         ├─ 复制按钮
         └─ 启动命令
```

## 状态管理流程

```
┌─────────────────┐    Action    ┌─────────────────┐
│   Vue 组件      │─────────────▶│  Pinia Store    │
│                 │              │                 │
│ • 用户交互      │              │ • 状态更新      │
│ • 事件触发      │              │ • 副作用处理    │
│ • 生命周期      │              │ • API 调用      │
│                 │              │                 │
└─────────────────┘              └─────────────────┘
         ▲                                │
         │                                │ State Change
         │                                ▼
┌─────────────────┐   Reactive   ┌─────────────────┐
│   Vue 响应式    │◀─────────────│   Store State   │
│                 │              │                 │
│ • 重新渲染      │              │ • inputSource   │
│ • 计算属性      │              │ • config        │
│ • 监听器        │              │ • apiInfo       │
│                 │              │ • endpoints     │
└─────────────────┘              │ • convertResult │
                                 │ • loading       │
                                 │ • error         │
                                 └─────────────────┘
```

## API 调用流程

```
┌─────────────────┐
│  用户触发操作   │
│ (点击转换按钮)  │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Home.vue        │
│ handleConvert() │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ AppStore        │
│ setInputSource()│
│ previewApi()    │
│ convertToMcp()  │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐    HTTP    ┌─────────────────┐
│ API Service     │───────────▶│  Backend API    │
│ utils/api.ts    │            │                 │
│                 │◀───────────│ • /api/preview  │
│ • 请求封装      │   Response │ • /api/convert  │
│ • 错误处理      │            │ • /api/validate │
│ • 响应解析      │            │                 │
└─────────┬───────┘            └─────────────────┘
          │
          ▼
┌─────────────────┐
│ Store 状态更新  │
│ • loading: true │
│ • apiInfo: data │
│ • convertResult │
│ • error: null   │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ UI 自动更新     │
│ • 显示进度      │
│ • 展示结果      │
│ • 处理错误      │
└─────────────────┘
```

## 类型系统架构

```
types/index.ts
├─ InputSource        - 输入源类型
│  ├─ type: 'url' | 'file' | 'text'
│  ├─ content: string
│  └─ auth?: AuthConfig
│
├─ ConvertConfig      - 转换配置
│  ├─ filters: FilterConfig
│  ├─ transport: TransportType
│  └─ optimization: OptimizationConfig
│
├─ OpenApiInfo        - API 基本信息
│  ├─ title: string
│  ├─ version: string
│  ├─ description?: string
│  └─ serverUrl?: string
│
├─ ApiEndpoint        - API 端点
│  ├─ method: string
│  ├─ path: string
│  ├─ summary?: string
│  ├─ tags?: string[]
│  └─ deprecated?: boolean
│
├─ ConvertResult      - 转换结果
│  ├─ mcpConfig: McpConfig
│  ├─ metadata: ResultMetadata
│  └─ processingTime: number
│
└─ AppState           - 应用状态
   ├─ inputSource: InputSource
   ├─ config: ConvertConfig
   ├─ apiInfo: OpenApiInfo | null
   ├─ endpoints: ApiEndpoint[]
   ├─ convertResult: ConvertResult | null
   ├─ loading: boolean
   └─ error: string | null
```

## 构建和部署架构

```
开发环境 (Development)
├─ Vite Dev Server (Port 3000)
│  ├─ HMR (热模块替换)
│  ├─ TypeScript 编译
│  ├─ Vue SFC 处理
│  └─ API 代理 (/api → localhost:3322)
│
├─ 自动导入
│  ├─ Vue APIs (ref, reactive, computed...)
│  ├─ Router APIs (useRouter, useRoute...)
│  ├─ Pinia APIs (defineStore, storeToRefs...)
│  └─ Element Plus 组件
│
└─ 开发工具
   ├─ Vue DevTools
   ├─ TypeScript 类型检查
   ├─ ESLint 代码检查
   └─ Prettier 代码格式化

生产环境 (Production)
├─ 构建输出 (dist/)
│  ├─ HTML 模板
│  ├─ JavaScript 包
│  │  ├─ 主应用包
│  │  ├─ Element Plus 包
│  │  └─ Monaco Editor 包
│  ├─ CSS 样式
│  └─ 静态资源
│
├─ 优化策略
│  ├─ 代码分割 (Code Splitting)
│  ├─ Tree Shaking
│  ├─ 资源压缩
│  └─ 缓存策略
│
└─ 部署选项
   ├─ 静态文件服务器
   ├─ CDN 分发
   └─ Docker 容器化
```

这个架构设计文档提供了 MCP Swagger UI 项目的完整架构视图，包括组件关系、数据流、状态管理和构建部署等各个方面的详细说明。
