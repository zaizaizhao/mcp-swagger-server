# MCP Swagger UI

一个基于 Vue 3 的现代化前端界面，用于将 OpenAPI/Swagger 规范转换为 MCP (Model Context Protocol) 格式。

## 🚀 技术栈

- **Vue 3** - 渐进式 JavaScript 框架
- **TypeScript** - 类型安全的 JavaScript 超集
- **Element Plus** - 基于 Vue 3 的企业级 UI 组件库
- **Vite** - 下一代前端构建工具
- **Pinia** - Vue 的状态管理库
- **Axios** - HTTP 客户端库

## 📁 项目结构

```
src/
├── components/          # 可复用组件
│   ├── PageHeader.vue   # 页面头部
│   ├── InputSection.vue # 输入区域
│   ├── ApiPreview.vue   # API 预览
│   ├── ConfigSection.vue # 配置区域
│   └── ResultSection.vue # 结果展示
├── views/               # 页面组件
│   └── Home.vue         # 主页
├── stores/              # 状态管理
│   └── app.ts           # 应用状态
├── utils/               # 工具函数
│   ├── api.ts           # API 调用
│   └── demo-data.ts     # 演示数据
├── types/               # 类型定义
│   └── index.ts         # 主要类型
├── assets/              # 静态资源
│   └── styles/          # 样式文件
├── router/              # 路由配置
│   └── index.ts         # 路由定义
└── main.ts              # 应用入口
```

## 🎯 功能特性

### 📥 多种输入方式
- **URL 输入**: 支持直接输入 Swagger/OpenAPI URL
- **文件上传**: 支持拖拽上传 JSON/YAML 文件
- **文本输入**: 支持直接粘贴 OpenAPI 规范内容

### 📋 API 信息预览
- 显示 API 基本信息（标题、版本、服务器地址等）
- 列出所有可用端点，支持按方法和标签筛选
- 实时显示端点数量统计

### ⚙️ 灵活的转换配置
- **端点过滤**: 选择要包含的 HTTP 方法
- **标签过滤**: 根据 OpenAPI 标签筛选端点
- **高级选项**: 参数验证、响应示例、名称优化
- **传输协议**: 支持 stdio、SSE、HTTP Stream

### 📦 转换结果展示
- **MCP 配置**: 生成完整的 MCP 服务器配置
- **工具列表**: 展示所有转换后的 MCP 工具
- **启动脚本**: 提供 package.json 脚本和命令行命令
- **一键操作**: 下载配置、复制代码、启动服务

## 🛠️ 开发环境

### 安装依赖

```bash
npm install
# 或
pnpm install
```

### 启动开发服务器

```bash
npm run dev
# 或
pnpm dev
```

访问 http://localhost:5173

### 构建生产版本

```bash
npm run build
# 或
pnpm build
```

### 预览生产构建

```bash
npm run preview
# 或
pnpm preview
```

## 🔧 配置

### 环境变量

创建 `.env.local` 文件来覆盖默认配置：

```env
# API 基础地址
VITE_API_BASE_URL=http://localhost:3000/api

# 应用标题
VITE_APP_TITLE=MCP Swagger Server

# 启用演示模式（开发时使用）
VITE_ENABLE_DEMO_MODE=true
```

### 演示模式

在开发环境中，可以启用演示模式来测试 UI 组件，无需连接真实的后端服务：

- 设置 `VITE_ENABLE_DEMO_MODE=true`
- 使用预设的演示数据进行交互
- 模拟网络延迟和真实的用户体验

## 🎨 UI 设计特性

### 🌈 现代化设计
- 渐变色背景和精美的视觉效果
- 响应式设计，支持移动端和桌面端
- 统一的组件风格和配色方案

### 🚀 用户体验
- 流畅的交互动画和过渡效果
- 实时的状态反馈和进度指示
- 智能的表单验证和错误处理

### 📱 响应式布局
- 移动端优化的组件布局
- 自适应的网格系统
- 触摸友好的交互元素

## 🔗 与后端集成

前端通过以下 API 端点与后端服务通信：

- `POST /api/validate` - 验证 OpenAPI 规范
- `POST /api/preview` - 预览 API 信息
- `POST /api/convert` - 转换为 MCP 格式

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如有问题，请提交 Issue 或联系维护团队。
