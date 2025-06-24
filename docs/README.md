# MCP Swagger UI 文档索引

## 📚 文档概览

本目录包含了 MCP Swagger UI 项目的完整技术文档，涵盖架构设计、开发指南、API 规范等各个方面。

## 📖 文档列表

### 0. [Node.js 模块系统详解](./nodejs-module-systems-guide.md) 🆕
**主要内容**：
- 📦 CommonJS vs ES Modules 详细对比
- 🔧 chalk 等包的 ESM 迁移问题解决
- 🚀 CLI 工具的模块系统最佳实践
- 🛠️ 项目迁移策略和工具推荐

**适合人员**：所有开发者，特别是遇到模块导入错误的开发者

### 0.1 [ESM vs CommonJS 快速参考](./esm-commonjs-quick-reference.md) 🆕
**主要内容**：
- ⚡ 快速解决 `ERR_REQUIRE_ESM` 错误
- 📋 常见解决方案对比
- 🔍 包模块类型检查方法

**适合人员**：需要快速解决问题的开发者

### 0.2 [为什么项目没有设置 "type": "module"](./why-no-type-module.md) 🆕
**主要内容**：
- 🎯 项目模块系统设计决策分析
- 🔧 CommonJS vs ESM 的选择理由
- 📦 CLI 工具的特殊考虑
- 🏗️ TypeScript 编译策略解释

**适合人员**：对项目架构感兴趣的开发者，想了解模块系统选择的技术人员

### 1. [技术文档](./mcp-swagger-ui-technical-documentation.md)
**主要内容**：
- 🏗️ 项目架构和技术栈详解
- 📁 目录结构和文件组织
- 🔧 核心模块功能说明
- 🎨 Apple 风格设计理念
- 📝 重要函数和接口说明
- ⚙️ 配置文件详解

**适合人员**：技术负责人、架构师、高级开发者

### 2. [架构设计文档](./mcp-swagger-ui-architecture.md)
**主要内容**：
- 🏛️ 整体架构图和组件关系
- 🔄 数据流图和状态管理流程
- 🌐 API 调用流程图
- 📊 类型系统架构
- 🚀 构建和部署架构
- 🔗 组件依赖关系

**适合人员**：架构师、技术负责人、系统设计者

### 3. [开发指南](./mcp-swagger-ui-development-guide.md)
**主要内容**：
- 🚀 快速开始和环境配置
- 💻 开发环境和工具推荐
- 📝 代码规范和最佳实践
- 🧪 测试和调试方法
- 🎯 性能优化技巧
- 📦 部署和发布流程
- ❓ 常见问题和解决方案

**适合人员**：前端开发者、新加入团队的开发者

## 🛠️ 技术栈概览

| 技术/工具 | 版本 | 用途 |
|-----------|------|------|
| Vue 3 | 3.4+ | 前端框架 |
| TypeScript | 5.0+ | 类型安全 |
| Vite | 5.0+ | 构建工具 |
| Element Plus | 2.4+ | UI 组件库 |
| Pinia | 2.1+ | 状态管理 |
| Axios | 1.6+ | HTTP 客户端 |
| Vue Router | 4.2+ | 路由管理 |

## 🎯 项目特色

### 风格设计
- ✨ 简洁优雅的用户界面
- 🌈 柔和的渐变色彩
- 🔄 流畅的动画效果
- 📱 响应式设计

### 现代化开发体验
- 🔥 热模块替换 (HMR)
- 📘 完整的 TypeScript 支持
- 🔧 自动化的代码检查和格式化
- 🧩 组件自动导入

### 功能丰富
- 🌐 多种输入方式（URL、文件、文本）
- 🔍 实时预览和验证
- ⚙️ 灵活的转换配置
- 📥 便捷的下载和复制功能

## 🚀 快速开始

```bash
# 1. 克隆项目
git clone <repository-url>

# 2. 进入前端目录
cd packages/mcp-swagger-ui

# 3. 安装依赖
npm install

# 4. 启动开发服务器
npm run dev

# 5. 打开浏览器访问
# http://localhost:3000
```

## 📋 开发工作流

### 开发阶段
```bash
npm run dev          # 启动开发服务器
npm run type-check   # TypeScript 类型检查
npm run lint         # 代码规范检查
npm run lint:fix     # 自动修复代码问题
```

### 构建部署
```bash
npm run build        # 构建生产版本
npm run preview      # 预览生产构建
```

## 🗂️ 项目结构

```
packages/mcp-swagger-ui/
├── 📁 docs/                    # 📚 项目文档
│   ├── mcp-swagger-ui-technical-documentation.md
│   ├── mcp-swagger-ui-architecture.md
│   └── mcp-swagger-ui-development-guide.md
├── 📁 public/                  # 🌐 静态资源
├── 📁 src/
│   ├── 📁 components/          # 🧩 可复用组件
│   ├── 📁 views/              # 📄 页面组件
│   ├── 📁 stores/             # 📊 状态管理
│   ├── 📁 utils/              # 🔧 工具函数
│   ├── 📁 types/              # 📝 类型定义
│   └── 📁 router/             # 🛣️ 路由配置
├── 📄 package.json            # 📦 项目配置
├── 📄 vite.config.ts          # ⚡ Vite 配置
├── 📄 tsconfig.json           # 📘 TypeScript 配置
└── 📄 .env.development        # 🔧 环境变量
```

## 🔗 相关链接

### 官方文档
- [Vue 3](https://vuejs.org/) - 前端框架
- [Vite](https://vitejs.dev/) - 构建工具
- [Element Plus](https://element-plus.org/) - UI 组件库
- [Pinia](https://pinia.vuejs.org/) - 状态管理
- [TypeScript](https://www.typescriptlang.org/) - 类型系统

### 工具和插件
- [Vue DevTools](https://devtools.vuejs.org/) - Vue 开发工具
- [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) - VS Code Vue 支持
- [ESLint](https://eslint.org/) - 代码检查
- [Prettier](https://prettier.io/) - 代码格式化

## 🤝 贡献指南

### 提交代码
1. Fork 项目仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 代码规范
- 使用 TypeScript 编写代码
- 遵循 ESLint 和 Prettier 配置
- 编写有意义的提交信息
- 为新功能添加测试用例

### Bug 报告
使用 GitHub Issues 报告 Bug，请包含：
- 详细的问题描述
- 重现步骤
- 期望的行为
- 实际的行为
- 环境信息（浏览器、Node.js 版本等）

## 📄 许可证

本项目采用 MIT 许可证。详细信息请查看 [LICENSE](../../LICENSE) 文件。

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 📧 Email: [开发团队邮箱]
- 💬 GitHub Issues: [项目 Issues 页面]
- 📖 Wiki: [项目 Wiki 页面]

---

**最后更新时间**: 2025年6月15日  
**文档版本**: v1.0.0  
**项目版本**: v1.0.0
