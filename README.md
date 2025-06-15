# MCP Swagger Server

> **🚧 项目状态：开发中 | Development in Progress**

一个将 OpenAPI/Swagger 规范转换为 Model Context Protocol (MCP) 格式的综合解决方案，包含现代化的 Web UI 界面和企业级后端服务，让 AI 助手能够通过标准化协议与 REST API 交互。

## 🎯 项目概览

这是一个 **monorepo** 项目，包含以下主要组件：

### 📦 核心模块

- **🎨 Web UI (`mcp-swagger-ui`)** - Vue 3 + TypeScript + Element Plus 现代化前端界面
- **⚙️ MCP Server (`mcp-swagger-server`)** - 支持多种传输协议的 MCP 服务器
- **🔧 Backend API (`mcp-swagger-backend`)** - HTTP API 服务器（计划中）
- **📚 Documentation** - 完整的技术文档和开发指南

### 🚀 当前完成状态

| 组件 | 完成度 | 状态 | 说明 |
|------|--------|------|------|
| **前端 UI** | 🟢 **90%** | ✅ 可用 | Vue3 界面，简约风格设计 |
| **MCP 核心** | 🟡 **70%** | 🔧 调试中 | 基础 MCP 协议实现 |
| **转换逻辑** | 🟡 **60%** | 🚧 开发中 | OpenAPI → MCP 转换 |
| **HTTP API** | 🔴 **30%** | ⏳ 计划中 | REST API 端点 |
| **文档** | 🟢 **95%** | ✅ 完整 | 技术文档和指南 |
| **测试** | 🔴 **20%** | ⏳ 待实现 | 单元和集成测试 |

## ✨ 主要特性

### 🎨 现代化 Web 界面
- **简约风格设计**：简约优雅的用户界面
- **响应式布局**：支持桌面和移动端
- **实时预览**：OpenAPI 规范可视化
- **拖拽上传**：支持文件拖拽和 URL 输入
- **配置选项**：灵活的转换参数设置

### ⚡ 强大的转换引擎
- **多格式支持**：JSON、YAML、URL 输入
- **智能解析**：自动识别 OpenAPI 2.0/3.x 规范
- **灵活过滤**：按方法、标签、路径过滤 API
- **优化配置**：生成验证、示例包含等选项

### 🔌 多种传输协议
- **Stdio Transport**：命令行集成
- **SSE (Server-Sent Events)**：Web 实时通信
- **Streamable HTTP**：双向流通信
- **健康检查**：内置监控和状态检查

## � 快速开始

### 📋 环境要求

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0 (推荐) 或 npm >= 9.0.0
- **TypeScript** >= 5.0.0

### 🔧 安装依赖

```bash
# 克隆项目
git clone <repository-url>
cd mcp-swagger-server

# 安装依赖 (使用 pnpm，推荐)
pnpm install

# 或使用 npm
npm install
```

### 🎨 启动前端界面

```bash
# 进入前端目录
cd packages/mcp-swagger-ui

# 启动开发服务器
pnpm dev

# 访问界面
open http://localhost:3000
```

**✨ 前端功能完整可用**：
- 📁 文件上传和 URL 输入
- 👁️ OpenAPI 规范预览
- ⚙️ 转换配置选项
- 📋 结果展示和下载
- 🎨 简约风格的优雅界面

### ⚙️ 启动 MCP 服务器

```bash
# 进入 MCP 服务器目录
cd packages/mcp-swagger-server

# 构建项目
pnpm build

# 启动不同传输协议的服务器
pnpm start:stdio      # Stdio 传输 (CLI 集成)
pnpm start:sse         # SSE 传输 (Web 实时通信)
pnpm start:streamable  # Streamable HTTP 传输

# 开发模式 (热重载)
pnpm dev
```

### 🔍 健康检查

```bash
# 检查 SSE 服务器状态
curl http://localhost:3322/health
curl http://localhost:3322/ping

# 检查 Streamable 服务器状态  
curl http://localhost:3322/health
```

## 📖 使用指南

### 🎨 Web 界面使用

1. **访问界面**：打开 http://localhost:3000
2. **输入 API 规范**：
   - 📁 上传 JSON/YAML 文件
   - 🔗 输入 Swagger URL
   - ✏️ 直接粘贴文本内容
3. **配置转换选项**：
   - 选择传输协议 (stdio/sse/streamable)
   - 设置过滤条件 (HTTP 方法、标签等)
   - 配置优化选项
4. **转换和下载**：查看结果并下载 MCP 配置文件

### 💻 命令行使用

```bash
# Stdio 模式 (适合 CLI 集成)
node dist/index.js --transport stdio

# SSE 模式 (适合 Web 应用)
node dist/index.js --transport sse --port 3322

# Streamable 模式 (适合流通信)
node dist/index.js --transport streamable --port 3322 --endpoint /mcp

# 查看帮助
node dist/index.js --help
```

### 🔧 程序化集成

```typescript
import { createMcpServer, runSseServer } from 'mcp-swagger-server';

// 创建基础 MCP 服务器
const server = await createMcpServer();

// 启动特定传输协议
await runSseServer("/sse", 3322);
```

## 🏗️ 项目架构

### 📁 目录结构

```
mcp-swagger-server/
├── packages/
│   ├── mcp-swagger-ui/          # 🎨 Vue3 前端界面
│   │   ├── src/
│   │   │   ├── views/           # 页面组件
│   │   │   ├── components/      # UI 组件
│   │   │   ├── stores/          # Pinia 状态管理
│   │   │   ├── utils/           # 工具函数
│   │   │   └── types/           # TypeScript 类型
│   │   └── package.json
│   │
│   ├── mcp-swagger-server/      # ⚙️ MCP 协议服务器
│   │   ├── src/
│   │   │   ├── tools/           # MCP 工具实现
│   │   │   ├── transform/       # 转换逻辑
│   │   │   ├── transportUtils/  # 传输协议
│   │   │   └── server.ts        # 服务器主逻辑
│   │   └── package.json
│   │
│   └── mcp-swagger-backend/     # 🔧 HTTP API 服务器 (计划中)
│
├── docs/                        # 📚 完整技术文档
│   ├── technical-architecture.md
│   ├── mcp-swagger-ui-technical-documentation.md
│   ├── backend-technology-stack-analysis.md
│   ├── project-roadmap-and-planning.md
│   └── ...
│
├── scripts/                     # 🔨 构建和部署脚本
└── package.json                 # 根项目配置
```

### 🔄 数据流架构

```
用户输入 → Web UI → [API 验证] → [格式转换] → MCP 服务器 → AI 助手
    ↓         ↓          ↓            ↓           ↓
  文件/URL   Vue3界面   swagger-parser  转换引擎   MCP协议
```

### 🛠️ 技术栈

| 组件 | 技术栈 | 状态 |
|------|--------|------|
| **前端** | Vue 3 + TypeScript + Element Plus + Vite | ✅ 完成 |
| **状态管理** | Pinia | ✅ 完成 |
| **构建工具** | Vite + ESLint + Prettier | ✅ 完成 |
| **MCP 服务器** | Node.js + TypeScript + MCP SDK | 🔧 调试中 |
| **API 解析** | swagger-parser + zod | 🚧 部分完成 |
| **传输协议** | stdio/SSE/streamable | 🔧 测试中 |
| **后端 API** | NestJS (推荐) | ⏳ 计划中 |

## 📚 详细文档

项目包含完整的技术文档体系：

### 🎯 核心文档
- 📋 **[技术架构文档](docs/technical-architecture.md)** - 整体架构设计
- 🎨 **[前端技术文档](docs/mcp-swagger-ui-technical-documentation.md)** - UI 实现详情
- 🏗️ **[架构设计文档](docs/mcp-swagger-ui-architecture.md)** - 系统架构图
- 📖 **[开发指南](docs/mcp-swagger-ui-development-guide.md)** - 开发最佳实践

### 🚀 规划文档
- 🗺️ **[项目路线图](docs/project-roadmap-and-planning.md)** - 开发计划和里程碑
- ⚡ **[即时任务清单](docs/immediate-tasks-week1.md)** - 优先级任务
- 🔧 **[后端技术选型](docs/backend-technology-stack-analysis.md)** - 技术栈分析
- 📋 **[NestJS 实施指南](docs/nestjs-implementation-guide.md)** - 后端实现计划

### 📖 文档索引
查看 **[docs/README.md](docs/README.md)** 获取完整文档目录。

## ⚙️ 配置选项

### �️ 命令行参数

| 参数 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| `--transport` | `-t` | `stdio` | 传输协议: "stdio", "sse", "streamable" |
| `--port` | `-p` | `3322` | SSE 或 streamable 传输端口 |
| `--endpoint` | `-e` | 自动 | 端点路径 (SSE: "/sse", streamable: "/mcp") |
| `--help` | `-h` | - | 显示帮助信息 |

### 🌍 环境变量

```bash
# MCP 服务器端口
MCP_EXPRESS_PORT=8765

# CORS 允许的源
CORS_ORIGIN=http://localhost:3000

# 日志级别
LOG_LEVEL=info

# 最大文件大小 (字节)
MAX_FILE_SIZE=10485760
```

### 📄 配置文件

```json
// mcp-config.json
{
  "server": {
    "name": "swagger-mcp-server",
    "version": "1.0.0"
  },
  "transport": {
    "type": "sse",
    "port": 3322,
    "endpoint": "/sse"
  },
  "conversion": {
    "defaultFilters": {
      "methods": ["GET", "POST", "PUT", "DELETE"],
      "includeDeprecated": false
    },
    "optimization": {
      "generateValidation": true,
      "includeExamples": true
    }
  }
}
```

## 🚦 传输协议详解

### 1. 📡 Stdio Transport
**最佳用于**：CLI 集成和进程间通信

```bash
# 启动 stdio 传输
node dist/index.js --transport stdio

# 与 Claude Desktop 集成
{
  "mcpServers": {
    "swagger-server": {
      "command": "node",
      "args": ["path/to/dist/index.js", "--transport", "stdio"]
    }
  }
}
```

### 2. 🌊 SSE (Server-Sent Events) Transport  
**最佳用于**：Web 应用实时更新

```bash
# 启动 SSE 服务器
node dist/index.js --transport sse --port 3322
```

**可用端点**：
- `GET /sse` - 建立 SSE 连接
- `POST /messages` - 发送消息
- `GET /health` - 健康检查  
- `GET /ping` - 连接测试

### 3. 🔄 Streamable HTTP Transport
**最佳用于**：双向流通信

```bash
# 启动 streamable 服务器  
node dist/index.js --transport streamable --port 3322
```

**可用端点**：
- `POST /mcp` - 主要通信端点
- `GET /mcp` - 恢复会话
- `DELETE /mcp` - 关闭会话
- `GET /health` - 健康检查
- `GET /ping` - 连接测试

## 🛠️ 开发指南

### 🔨 构建项目

```bash
# 构建所有包
pnpm build

# 构建特定包
cd packages/mcp-swagger-ui && pnpm build
cd packages/mcp-swagger-server && pnpm build

# 开发模式 (热重载)
pnpm dev
```

### 🧪 测试

```bash
# 运行测试 (当测试完成后)
pnpm test

# 前端测试
cd packages/mcp-swagger-ui && pnpm test

# 后端测试  
cd packages/mcp-swagger-server && pnpm test

# 使用 MCP Inspector 调试
npx @modelcontextprotocol/inspector node dist/index.js
```

### 🐛 调试

```bash
# 启用调试模式
DEBUG=mcp:* node dist/index.js

# 检查服务器状态
curl http://localhost:3322/health
curl http://localhost:3322/ping

# 查看日志
tail -f packages/mcp-swagger-server/logs/server.log
```

## � 当前状态和下一步

### ✅ 已完成功能

#### 🎨 前端界面 (90% 完成)
- ✅ **现代化 UI 设计**：简约风格的简约界面
- ✅ **文件处理**：支持拖拽上传、URL 输入、文本粘贴
- ✅ **配置选项**：完整的转换参数设置
- ✅ **响应式设计**：适配桌面和移动端
- ✅ **状态管理**：Pinia 数据流管理
- ✅ **类型安全**：完整的 TypeScript 类型定义

#### 📚 文档体系 (95% 完成)
- ✅ **技术文档**：详细的架构和实现文档
- ✅ **开发指南**：完整的开发流程和最佳实践
- ✅ **API 文档**：接口规范和使用示例
- ✅ **部署指南**：Docker 和生产环境配置

### 🚧 开发中功能

#### ⚙️ MCP 服务器 (70% 完成)
- 🔧 **基础协议实现**：stdio/SSE/streamable 传输
- 🔧 **OpenAPI 解析**：swagger-parser 集成
- ⏳ **转换逻辑优化**：错误处理和边界情况
- ⏳ **性能优化**：大文件处理和内存管理

#### 🔗 前后端集成 (40% 完成)  
- ⏳ **API 连接**：真实后端 API 集成
- ⏳ **错误处理**：统一的错误处理机制
- ⏳ **状态同步**：前后端状态一致性

### � 待实现功能

#### 🔧 后端 HTTP API (30% 计划)
- ⏳ **NestJS 架构**：企业级后端框架
- ⏳ **REST 端点**：/validate, /preview, /convert
- ⏳ **认证授权**：API 密钥和用户管理
- ⏳ **速率限制**：防止滥用的安全措施

#### 🧪 测试体系 (20% 计划)
- ⏳ **单元测试**：组件和服务测试
- ⏳ **集成测试**：端到端流程测试
- ⏳ **性能测试**：负载和压力测试
- ⏳ **自动化 CI/CD**：GitHub Actions 集成

### 🎯 近期目标 (接下来 2 周)

1. **🔧 完善 MCP 转换逻辑** - 提高转换准确性和稳定性
2. **🔗 实现前后端完整集成** - 替换演示模式为真实 API
3. **🧪 添加基础测试** - 确保核心功能稳定性
4. **📦 优化构建和部署** - Docker 容器化和生产环境配置

### 🌟 长期规划 (3-6 个月)

1. **🏢 企业级后端**：NestJS + 数据库 + 缓存
2. **🔐 用户系统**：认证、授权、使用量统计
3. **🔌 插件生态**：自定义转换规则和扩展
4. **☁️ 云部署**：AWS/Azure 云原生部署
5. **📊 监控告警**：性能监控和日志分析

## 🤝 集成指南

### 🤖 与 Claude Desktop 集成

```json
// Claude Desktop 配置
{
  "mcpServers": {
    "swagger-converter": {
      "command": "node",
      "args": ["/path/to/packages/mcp-swagger-server/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 🔍 与 MCP Inspector 调试

```bash
# 安装 MCP Inspector
npm install -g @modelcontextprotocol/inspector

# 启动调试会话
npx @modelcontextprotocol/inspector node packages/mcp-swagger-server/dist/index.js

# 或使用特定传输协议
npx @modelcontextprotocol/inspector node dist/index.js --transport sse --port 3322
```

### 🌐 与其他 AI 平台集成

```javascript
// 示例：与自定义 AI 应用集成
import { createMcpServer } from './packages/mcp-swagger-server/dist/index.js';

const mcpServer = await createMcpServer({
  transport: 'streamable',
  port: 3322,
  cors: {
    origin: ['http://localhost:3000', 'https://your-ai-app.com']
  }
});

await mcpServer.start();
```

## � 依赖关系

### 🏃 运行时依赖

#### 前端 (mcp-swagger-ui)
```json
{
  "vue": "^3.4.0",           // Vue 3 框架
  "element-plus": "^2.4.0",  // UI 组件库
  "pinia": "^2.1.7",         // 状态管理
  "axios": "^1.6.0",         // HTTP 客户端
  "monaco-editor": "^0.44.0" // 代码编辑器
}
```

#### 后端 (mcp-swagger-server)
```json
{
  "@modelcontextprotocol/sdk": "^1.12.0", // MCP 协议 SDK
  "swagger-parser": "^10.0.3",            // OpenAPI 解析器
  "express": "^4.18.2",                   // Web 框架
  "cors": "^2.8.5",                       // 跨域支持
  "zod": "^3.25.28",                      // 模式验证
  "js-yaml": "^4.1.0",                    // YAML 解析
  "axios": "^1.6.0"                       // HTTP 客户端
}
```

### 🛠️ 开发时依赖

```json
{
  "typescript": "^5.2.0",              // TypeScript 编译器
  "vite": "^5.0.0",                    // 构建工具
  "@vitejs/plugin-vue": "^4.5.0",     // Vue 插件
  "eslint": "^8.53.0",                // 代码检查
  "prettier": "^3.0.0",               // 代码格式化
  "@modelcontextprotocol/inspector": "latest" // MCP 调试工具
}
```

## 🤝 贡献指南

我们欢迎社区贡献！请遵循以下流程：

### 📝 贡献流程

1. **🍴 Fork 项目**
   ```bash
   git clone https://github.com/your-username/mcp-swagger-server.git
   cd mcp-swagger-server
   ```

2. **🌿 创建功能分支**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **✨ 开发功能**
   - 遵循现有代码风格
   - 添加必要的测试
   - 更新相关文档

4. **🧪 运行测试**
   ```bash
   # 代码检查
   pnpm lint
   
   # 类型检查
   pnpm type-check
   
   # 运行测试 (当实现后)
   pnpm test
   ```

5. **📝 提交更改**
   ```bash
   git add .
   git commit -m 'feat: add amazing feature'
   ```

6. **🚀 推送并创建 PR**
   ```bash
   git push origin feature/amazing-feature
   ```

### 📋 代码规范

- **TypeScript**: 使用严格模式，完整类型注解
- **ESLint**: 遵循项目 ESLint 配置
- **Prettier**: 统一代码格式化
- **Git Commit**: 使用 [约定式提交](https://conventionalcommits.org/) 格式

### 🐛 问题报告

使用 GitHub Issues 报告问题时请包含：

- **📋 问题描述**：清晰描述遇到的问题
- **🔄 重现步骤**：详细的重现步骤
- **💻 环境信息**：操作系统、Node.js 版本等
- **📸 截图/日志**：相关的错误截图或日志

### 💡 功能请求

提交功能请求时请说明：

- **🎯 使用场景**：功能的实际应用场景
- **📋 详细描述**：功能的具体需求
- **✅ 验收标准**：如何验证功能完成

## 📞 支持与反馈

### 🆘 获取帮助

- **📚 查阅文档**：先查看 [docs/](docs/) 目录下的详细文档
- **🔍 搜索 Issues**：在提问前搜索已有的 GitHub Issues
- **💬 创建 Issue**：描述清楚问题和环境信息
- **📧 邮件联系**：发送邮件到 [维护者邮箱]

### 🌟 反馈渠道

- **GitHub Issues** - 问题报告和功能请求
- **GitHub Discussions** - 社区讨论和经验分享
- **Pull Requests** - 代码贡献和改进建议

## � 许可证

本项目采用 **MIT License** 开源许可证。

```
MIT License

Copyright (c) 2025 MCP Swagger Server Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🔗 相关资源

### 📖 官方文档
- **[Model Context Protocol](https://modelcontextprotocol.io/)** - MCP 官方文档
- **[OpenAPI Specification](https://swagger.io/specification/)** - OpenAPI 规范
- **[Vue 3 文档](https://vuejs.org/)** - Vue 3 官方文档
- **[Element Plus](https://element-plus.org/)** - UI 组件库文档

### 🛠️ 相关项目
- **[MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)** - MCP TypeScript SDK
- **[swagger-parser](https://github.com/APIDevTools/swagger-parser)** - OpenAPI 解析库
- **[Claude Desktop](https://claude.ai/desktop)** - Claude 桌面应用

### 🎓 学习资源
- **[MCP 入门指南](https://modelcontextprotocol.io/introduction)** - MCP 基础概念
- **[OpenAPI 设计指南](https://swagger.io/resources/articles/best-practices-in-api-design/)** - API 设计最佳实践
- **[Vue 3 Composition API](https://vuejs.org/guide/introduction.html)** - Vue 3 开发指南

---

<div align="center">
  <p>
    <strong>🌟 如果这个项目对您有帮助，请给我们一个 Star！</strong>
  </p>
  <p>
    <a href="https://github.com/your-username/mcp-swagger-server">⭐ Star on GitHub</a> | 
    <a href="https://github.com/your-username/mcp-swagger-server/issues">🐛 Report Bug</a> | 
    <a href="https://github.com/your-username/mcp-swagger-server/discussions">💬 Discussions</a>
  </p>
  <p>
    <em>由 ❤️ 和 ☕ 驱动开发</em>
  </p>
</div>
