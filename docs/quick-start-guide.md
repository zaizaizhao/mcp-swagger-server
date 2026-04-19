# MCP Swagger Server - 快速入门指南

## 项目概述

本项目是一个基于 monorepo 的 OpenAPI / Swagger 到 MCP 转换工具集，当前保留三条核心链路：

- `mcp-swagger-parser`：负责解析、校验和标准化 OpenAPI / Swagger 文档
- `mcp-swagger-server`：负责 CLI、交互式终端和 MCP Server 启动
- `mcp-swagger-api`：负责可选的 NestJS REST API 后端

当前仓库不再包含独立的 Web UI 项目，默认使用方式是终端和 CLI。

## 项目结构

```text
mcp-swagger-server/
├── packages/
│   ├── mcp-swagger-parser/    # 核心解析器包
│   ├── mcp-swagger-server/    # MCP 服务器与交互式终端
│   └── mcp-swagger-api/       # 可选的 REST API 后端
├── scripts/
│   ├── build.js               # 统一构建脚本
│   ├── dev.js                 # CLI / parser 开发环境脚本
│   ├── clean.js               # 清理脚本
│   └── diagnostic.js          # 诊断脚本
├── docs/                      # 技术文档
└── README.md
```

## 环境要求

- Node.js `>= 18.0.0`
- pnpm `>= 8`
- macOS、Linux、Windows 均可

## 安装指南

### 1. 安装 pnpm

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

如果你已经有 pnpm，可以直接跳过这一步。

### 2. 克隆并安装项目

```bash
git clone <repository-url>
cd mcp-swagger-server
pnpm install
```

## 常用命令

### 根目录命令

```bash
# 构建当前工作区包
pnpm run build

# 构建核心包（当前等同于 parser/server/api）
pnpm run build:packages

# 终端开发模式：构建并启动 parser/server 的 watch 流程
pnpm run dev

# 清理构建产物
pnpm run clean

# 项目诊断
pnpm run diagnostic
```

### CLI / 终端链路开发

```bash
cd packages/mcp-swagger-server

# 开发模式
pnpm run dev

# 查看 CLI 帮助
pnpm run cli -- --help

# 构建产物
pnpm run build
```

### Parser 开发

```bash
cd packages/mcp-swagger-parser

pnpm run build
pnpm run test
pnpm run type-check
```

### API 后端开发

```bash
cd packages/mcp-swagger-api

pnpm run start:dev
pnpm run test
pnpm run build
```

## 推荐开发路径

### 只关注终端功能

```bash
pnpm install
pnpm run build
cd packages/mcp-swagger-server
pnpm run cli -- --help
```

### 修改 parser 或 CLI 后的最小验证

```bash
pnpm run build:packages
cd packages/mcp-swagger-server
pnpm run build
```

### 排查依赖或构建异常

```bash
pnpm run diagnostic
pnpm run clean
pnpm install
pnpm run build
```

## 常见问题

### 1. 依赖解析失败

如果出现类似下面的问题：

```text
Failed to resolve entry for package "mcp-swagger-parser"
```

先执行：

```bash
pnpm run build:packages
```

### 2. 类型定义找不到

如果出现：

```text
Cannot find module 'mcp-swagger-parser'
```

说明依赖包还没有构建出 `dist` 和类型定义，先重新执行：

```bash
pnpm run build
```

### 3. 开发模式没有启动 API 后端

根目录的 `pnpm run dev` 只负责 parser / CLI 相关链路。API 后端需要单独进入 `packages/mcp-swagger-api` 运行：

```bash
pnpm run start:dev
```

## 进一步阅读

- [文档索引](./README.md)
- [使用指南](./usage-guide.md)
- [技术架构](./technical-architecture.md)
