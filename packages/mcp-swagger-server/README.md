# MCP Swagger Server 🚀

<div align="center">

[![NPM Version](https://img.shields.io/npm/v/mcp-swagger-server.svg)](https://www.npmjs.com/package/mcp-swagger-server)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**将任意 OpenAPI/Swagger 规范转换为 Model Context Protocol (MCP) 工具的强大服务器**

零配置，一键将您的 REST API 转换为 AI 助手可调用的 MCP 工具

[📖 English Documentation](README_EN.md) • [🔗 GitHub 项目地址](https://github.com/zaizaizhao/mcp-swagger-server)

</div>

---

## 🎯 什么是 MCP Swagger Server？

MCP Swagger Server 是一个专为 AI 时代设计的工具，它能够将任何符合 OpenAPI/Swagger 规范的 REST API 自动转换为 Model Context Protocol (MCP) 格式，让 AI 助手能够理解和调用您的 API。

### 🌟 核心优势

- **🔄 零配置转换**: 提供 OpenAPI 规范 URL 或文件，立即获得可用的 MCP 工具
- **🎯 AI 原生设计**: 专为 Claude、ChatGPT 等大语言模型优化
- **🚀 开箱即用**: 支持命令行、编程接口和 MCP 客户端集成
- **🔌 多传输协议**: 支持 HTTP、WebSocket、SSE 和 Stdio 多种传输方式
- **⚡ 高性能**: 基于 TypeScript 构建，提供完整的类型安全

## 🚀 快速开始

### 📦 安装

```bash
# 使用 npm
npm install -g mcp-swagger-server

# 使用 yarn
yarn global add mcp-swagger-server

# 使用 pnpm
pnpm add -g mcp-swagger-server
```

### ⚡ 立即使用

#### 1. 命令行启动

```bash
# 使用 Swagger Petstore API (推荐用于测试，OpenAPI 3.0)
mcp-swagger-server --openapi https://petstore3.swagger.io/api/v3/openapi.json --transport streamable --port 3322

# 使用 GitHub API (如果可用)
mcp-swagger-server --openapi https://api.github.com/openapi.json --transport sse --port 3323

# 使用本地 OpenAPI 文件
mcp-swagger-server --openapi ./api-spec.json --transport stdio
```

#### 2. MCP 客户端配置

在您的 MCP 客户端配置文件中添加：

```json
{
  "mcpServers": {
    "swagger-api": {
      "command": "mcp-swagger-server",
      "args": [
        "--openapi",
        "https://petstore3.swagger.io/api/v3/openapi.json",
        "--transport",
        "stdio"
      ]
    }
  }
}
```

#### 3. 编程式调用

```javascript
import { createMcpServer } from 'mcp-swagger-server';

const server = await createMcpServer({
  openapi: 'https://petstore3.swagger.io/api/v3/openapi.json',
  transport: 'streamable',
  port: 3322
});

await server.start();
```

## 🛠️ 主要功能

### 📋 支持的 OpenAPI 格式

- **OpenAPI 3.x**: 完整支持最新规范 ✅
- **Swagger 2.0**: 需要先转换为 OpenAPI 3.x 格式 ⚠️
- **多种输入**: JSON、YAML、URL、本地文件
- **实时更新**: 支持 `--watch` 模式自动重载

> **⚠️ 重要提示**: 本工具目前主要支持 OpenAPI 3.x 规范。如果您的 API 使用 Swagger 2.0 格式，建议先使用 [Swagger Editor](https://editor.swagger.io/) 或 [swagger2openapi](https://www.npmjs.com/package/swagger2openapi) 工具将其转换为 OpenAPI 3.x 格式。

### 🔌 传输协议支持

| 协议 | 说明 | 使用场景 |
|------|------|----------|
| `stdio` | 标准输入输出 | MCP 客户端集成 |
| `streamable` | WebSocket 流式传输 | 实时交互应用 |
| `sse` | Server-Sent Events | Web 应用集成 |
| `http` | HTTP REST API | 传统 Web 服务 |

### 🎛️ 命令行选项

```bash
mcp-swagger-server [选项]

选项:
  --openapi <url|file>    OpenAPI 规范 URL 或文件路径 (必需)
  --transport <type>      传输类型: stdio|streamable|sse|http (默认: stdio)
  --port <number>         服务器端口 (默认: 3322)
  --host <string>         服务器主机 (默认: localhost)
  --watch                 监听文件变化并自动重载
  --verbose               显示详细日志
  --help                  显示帮助信息
```

## 📚 使用示例

### 🐙 Swagger Petstore API 集成

```bash
# 启动 Swagger Petstore API MCP 服务器
mcp-swagger-server \
  --openapi https://petstore3.swagger.io/api/v3/openapi.json \
  --transport streamable \
  --port 3322 \
  --verbose
```

转换后，AI 助手将能够调用 Petstore API 的各种功能，如：
- 管理宠物信息（添加、更新、删除）
- 查询宠物状态和标签
- 处理宠物商店订单
- 管理用户账户

### 🏪 电商 API 集成

```bash
# 启动电商 API MCP 服务器
mcp-swagger-server \
  --openapi https://your-ecommerce-api.com/openapi.json \
  --transport sse \
  --port 3323
```

### 📊 数据分析 API

```bash
# 启动数据分析 API MCP 服务器
mcp-swagger-server \
  --openapi ./analytics-api-spec.yaml \
  --transport stdio \
  --watch
```
## 🏗️ 架构设计

```
MCP Swagger Server
├── 📥 输入层
│   ├── OpenAPI/Swagger 规范解析
│   ├── 格式验证与标准化
│   └── 实时文件监听
├── 🔄 转换层
│   ├── OpenAPI → MCP 工具映射
│   ├── 参数类型转换
│   └── 响应格式适配
├── 🚀 MCP 协议层
│   ├── 工具注册与发现
│   ├── 请求路由与执行
│   └── 错误处理与日志
└── 🔌 传输层
    ├── Stdio (MCP 标准)
    ├── WebSocket (实时通信)
    ├── SSE (服务器推送)
    └── HTTP (REST API)
```

## 🔍 故障排除

### 常见问题

#### ❌ "Missing required field: openapi" 错误

**问题**: 当尝试使用 Swagger 2.0 规范时出现此错误。

```bash
# ❌ 错误示例 - Swagger 2.0 格式
npx mcp-swagger-server --openapi https://petstore.swagger.io/v2/swagger.json

# 错误信息: OpenAPIParseError: Missing required field: openapi
```

**解决方案**:

1. **使用 OpenAPI 3.x 规范**:
   ```bash
   # ✅ 正确示例 - OpenAPI 3.x 格式
   npx mcp-swagger-server --openapi https://petstore3.swagger.io/api/v3/openapi.json
   ```

2. **转换 Swagger 2.0 到 OpenAPI 3.x**:
   ```bash
   # 安装转换工具
   npm install -g swagger2openapi
   
   # 转换 Swagger 2.0 到 OpenAPI 3.x
   swagger2openapi https://petstore.swagger.io/v2/swagger.json -o petstore-openapi3.json
   
   # 使用转换后的文件
   npx mcp-swagger-server --openapi ./petstore-openapi3.json
   ```

3. **在线转换**:
   - 访问 [Swagger Editor](https://editor.swagger.io/)
   - 导入您的 Swagger 2.0 规范
   - 使用 "Edit" > "Convert to OpenAPI 3" 功能
   - 导出转换后的 OpenAPI 3.x 文件

#### 🔗 验证 API 规范版本

```bash
# 检查 API 规范版本
curl -s https://your-api.com/swagger.json | jq '.swagger // .openapi'

# Swagger 2.0 返回: "2.0"
# OpenAPI 3.x 返回: "3.0.0" 或 "3.1.0"
```

#### 🌐 网络连接问题

```bash
# 测试 API 可访问性
curl -I https://your-api.com/openapi.json

# 使用详细日志模式
npx mcp-swagger-server --openapi https://your-api.com/openapi.json --verbose
```

### 📋 OpenAPI 规范要求

- **必需字段**: `openapi` (版本号，如 "3.0.0")
- **推荐版本**: OpenAPI 3.0.x 或 3.1.x
- **文件格式**: JSON 或 YAML
- **编码格式**: UTF-8

## 🤝 社区与支持

- **🐛 问题反馈**: [GitHub Issues](https://github.com/zaizaizhao/mcp-swagger-server/issues)
- **💡 功能建议**: [GitHub Discussions](https://github.com/zaizaizhao/mcp-swagger-server/discussions)
- **🔗 项目主页**: [GitHub Repository](https://github.com/zaizaizhao/mcp-swagger-server)

## 📝 许可证

本项目基于 [MIT 许可证](LICENSE) 开源，欢迎自由使用和贡献。

## 🚀 快速体验

想要立即体验 MCP Swagger Server？试试这个一键启动命令：

```bash
npx mcp-swagger-server --openapi https://petstore3.swagger.io/api/v3/openapi.json --transport streamable --port 3322 --verbose
```

然后访问 `http://localhost:3322` 查看生成的 MCP 工具！

---

<div align="center">

**Made with ❤️ by the MCP Community**

[⭐ Star on GitHub](https://github.com/zaizaizhao/mcp-swagger-server) • [📦 NPM Package](https://www.npmjs.com/package/mcp-swagger-server)

</div>