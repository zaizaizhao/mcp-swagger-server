# MCP Swagger Server 🚀

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**将 OpenAPI/Swagger 规范转换为 Model Context Protocol (MCP) 格式的服务器**

零配置将您的 REST API 转换为 AI 可调用的工具

[🚀 快速开始](#快速开始) • [📖 使用指南](#使用指南) • [🛠️ 开发](#开发)

**Languages**: [English](README_EN.md) | 中文

</div>

---

## 🎯 项目简介

MCP Swagger Server 是一个 **Monorepo** 项目，核心功能是将任何符合 OpenAPI/Swagger 规范的 REST API 转换为 Model Context Protocol (MCP) 格式，让 AI 助手能够理解和调用您的 API。

### 📦 项目结构

```
mcp-swagger-server/
├── packages/
│   ├── mcp-swagger-server/     # 🔧 核心 MCP 服务器 (可用)
│   ├── mcp-swagger-parser/     # 📝 OpenAPI 解析器 (开发中)
│   ├── mcp-swagger-ui/         # 🎨 Web 界面 (开发中)
│   └── mcp-swagger-api/        # 🔗 REST API 后端 (开发中)
└── scripts/                    # 🔨 构建工具
```

### ✨ 核心特性

- **🔄 零配置转换**: 输入 OpenAPI 规范，立即获得 MCP 工具
- **🎯 AI 原生设计**: 专为 Claude、ChatGPT 等 AI 助手优化
- **🔌 多传输协议**: 支持 SSE、Streamable 和 Stdio 传输
- **🔐 安全认证**: 支持 Bearer Token 认证保护 API 访问
- **⚡ 高性能**: 基于 TypeScript 构建，提供完整的类型安全

## 🚀 快速开始

### 环境要求

- Node.js ≥ 20.0.0
- pnpm ≥ 8.0.0 (推荐)

### 安装

```bash
# 克隆项目
git clone https://github.com/zaizaizhao/mcp-swagger-server.git
cd mcp-swagger-server

# 安装依赖
pnpm install

# 构建项目
pnpm build
```

### 快速启动

```bash 
# 启动服务器
node packages/mcp-swagger-server/dist/index.js -openapi https://api.example.com/openapi.json --operation-filter-methods GET,POST --transport streamable -auth-type bearer --bearer-token "your-token-here"
```

## 📖 使用指南

### 🔧 `mcp-swagger-server` 包

这是项目的核心包，提供了完整的 MCP 服务器功能。

#### 安装和使用

```bash
# 全局安装
npm install -g mcp-swagger-server

# 命令行使用
mcp-swagger-server --openapi https://petstore.swagger.io/v2/swagger.json --transport streamable --port 3322
```

#### 支持的传输协议

- **stdio**: 用于命令行集成
- **sse**: Server-Sent Events，适用于 Web 应用
- **streamable**: HTTP 流传输，适用于现代 Web 应用

#### 命令行选项

```bash
# 基本用法
mcp-swagger-server [选项]

# 选项：
--openapi, -o       OpenAPI 规范的 URL 或文件路径
--transport, -t     传输协议 (stdio|sse|streamable)
--port, -p          端口号
--watch, -w         监控文件变化
--verbose           详细日志输出

# Bearer Token 认证选项：
--auth-type         认证类型 (bearer)
--bearer-token      直接指定 Bearer Token
--bearer-env        从环境变量读取 Token
--config, -c        配置文件路径

# 操作过滤选项：
--operation-filter-methods <methods>        HTTP方法过滤 (可重复) [示例: GET,POST]
--operation-filter-paths <paths>            路径过滤 (支持通配符, 可重复) [示例: /api/*]
--operation-filter-operation-ids <ids>      操作ID过滤 (可重复) [示例: getUserById]
--operation-filter-status-codes <codes>     状态码过滤 (可重复) [示例: 200,201]
--operation-filter-parameters <params>      参数过滤 (可重复) [示例: userId,name]
```

#### 示例

```bash
# 使用本地 OpenAPI 文件
mcp-swagger-server --openapi ./swagger.json --transport sse --port 3322

# 使用远程 OpenAPI URL
mcp-swagger-server --openapi https://api.example.com/openapi.json --transport streamable --port 3323

# 监控文件变化
mcp-swagger-server --openapi ./api.yaml --transport stdio --watch

# 使用 Bearer Token 认证
mcp-swagger-server --openapi https://api.example.com/openapi.json --auth-type bearer --bearer-token "your-token-here" --transport sse --port 3322

# 从环境变量读取 Token
export API_TOKEN="your-token-here"
mcp-swagger-server --openapi https://api.example.com/openapi.json --auth-type bearer --bearer-env API_TOKEN --transport streamable

# 使用操作过滤选项
# 只包含 GET 和 POST 方法的接口
mcp-swagger-server --openapi https://api.example.com/openapi.json --operation-filter-methods GET,POST --transport streamable

# 只包含特定路径的接口
mcp-swagger-server --openapi https://api.example.com/openapi.json --operation-filter-paths "/api/users/*,/api/orders/*" --transport streamable

# 只包含特定操作ID的接口
mcp-swagger-server --openapi https://api.example.com/openapi.json --operation-filter-operation-ids "getUserById,createUser" --transport streamable

# 只包含特定状态码的接口
mcp-swagger-server --openapi https://api.example.com/openapi.json --operation-filter-status-codes "200,201,204" --transport streamable

# 只包含特定参数的接口
mcp-swagger-server --openapi https://api.example.com/openapi.json --operation-filter-parameters "userId,email" --transport streamable

# 组合使用多个过滤选项
mcp-swagger-server --openapi https://api.example.com/openapi.json \
  --operation-filter-methods GET,POST \
  --operation-filter-paths "/api/users/*" \
  --operation-filter-status-codes "200,201" \
  --transport streamable
```

### 🔐 Bearer Token 认证

`mcp-swagger-server` 支持 Bearer Token 认证，可以保护需要身份验证的 API 访问。

#### 认证方式

**1. 直接指定 Token**
```bash
mcp-swagger-server --auth-type bearer --bearer-token "your-token-here" --openapi https://api.example.com/openapi.json --transport streamable
```

**2. 环境变量方式**
```bash
# 设置环境变量
export API_TOKEN="your-token-here"

# 使用环境变量
mcp-swagger-server --auth-type bearer --bearer-env API_TOKEN --openapi https://api.example.com/openapi.json
```

**3. 配置文件方式**
```json
{
  "transport": "sse",
  "port": 3322,
  "openapi": "https://api.example.com/openapi.json",
  "auth": {
    "type": "bearer",
    "bearer": {
      "token": "your-token-here",
      "source": "static"
    }
  }
}
```

```bash
# 使用配置文件
mcp-swagger-server --config config.json
```

#### 环境变量配置

创建 `.env` 文件：
```env
# 基础配置
MCP_PORT=3322
MCP_TRANSPORT=stdio
MCP_OPENAPI_URL=https://api.example.com/openapi.json

# 认证配置
MCP_AUTH_TYPE=bearer
API_TOKEN=your-bearer-token-here
```

### 🤖 与 AI 助手集成

#### Claude Desktop 配置

```json
{
  "mcpServers": {
    "swagger-converter": {
      "command": "mcp-swagger-server",
      "args": [
        "--openapi", "https://petstore.swagger.io/v2/swagger.json",
        "--transport", "stdio"
      ]
    },
    "secured-api": {
      "command": "mcp-swagger-server",
      "args": [
        "--openapi", "https://api.example.com/openapi.json",
        "--transport", "stdio",
        "--auth-type", "bearer",
        "--bearer-env", "API_TOKEN"
      ],
      "env": {
        "API_TOKEN": "your-bearer-token-here"
      }
    }
  }
}
```

#### 编程方式使用

```typescript
import { createMcpServer } from 'mcp-swagger-server';

// 基本使用
const server = await createMcpServer({
  openapi: 'https://api.example.com/openapi.json',
  transport: 'streamable',
  port: 3322
});

// 使用 Bearer Token 认证
const securedServer = await createMcpServer({
  openapi: 'https://api.example.com/openapi.json',
  transport: 'streamable',
  port: 3322,
  auth: {
    type: 'bearer',
    bearer: {
      token: 'your-token-here',
      source: 'static'
    }
  }
});

await server.start();
```

## 🛠️ 开发

### 构建系统

```bash
# 构建所有包
pnpm build

# 仅构建后端包
pnpm build:packages

# 开发模式
pnpm dev

# 清理构建产物
pnpm clean
```

### 测试和调试

```bash
# 运行测试
pnpm test

# 代码检查
pnpm lint

# 类型检查
pnpm type-check

# 项目健康检查
pnpm diagnostic
```

### 开发 MCP 服务器

```bash
cd packages/mcp-swagger-server

# 开发模式启动
pnpm dev

# 运行 CLI 工具
pnpm cli --help

```

## 📋 项目状态

| 包 | 状态 | 描述 |
|---|---|---|
| `mcp-swagger-server` | ✅ 可用 | 核心 MCP 服务器，支持多种传输协议 |
| `mcp-swagger-parser` | 🚧 开发中 | OpenAPI 解析器和转换工具 |
| `mcp-swagger-ui` | 🚧 开发中 | Vue.js Web 界面 |
| `mcp-swagger-api` | 🚧 开发中 | NestJS REST API 后端 |

## 🤝 贡献

欢迎贡献！请先阅读 [贡献指南](CONTRIBUTING.md)。

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件。

---

<div align="center">

**Built with ❤️ by ZhaoYaNan(ZTE)**

[⭐ Star](../../stargazers) • [🐛 Issues](../../issues) • [💬 Discussions](../../discussions)

</div>