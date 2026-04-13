# MCP Swagger Server

将 OpenAPI / Swagger 文档转换为可接入大模型应用的 MCP Tools 与 MCP Server。

**Languages**: [English](./README_EN.md) | 中文

## 当前定位

本项目当前目标是收敛一个可实际运行、可发布、可维护的产品化版本，而不是继续无边界扩展功能面。

当前主路径为：

- OpenAPI / Swagger 导入
- 规范解析、校验、标准化
- 接口路径与操作提取
- MCP Tools 生成
- MCP Server 运行与管理
- API / UI / CLI 统一接入

## Monorepo 结构

- `packages/mcp-swagger-parser`
  负责 OpenAPI / Swagger 解析、校验、标准化与兼容处理。
- `packages/mcp-swagger-server`
  负责将 OpenAPI 操作转换为 MCP Tools，并提供 CLI 与 MCP Server 运行能力。
- `packages/mcp-swagger-api`
  负责管理后端、文档管理、服务器管理、认证与持久化。
- `packages/mcp-swagger-ui`
  负责操作界面，面向文档导入、校验、转换与服务器管理。

## 当前支持基线

### 运行环境

- Node.js `>= 20`
- pnpm `>= 8`
- Windows
- Linux，重点兼容 Ubuntu

### 数据库模式

- 默认模式：SQLite
- 可选模式：PostgreSQL

SQLite 适用于单机、小规模、低运维成本场景。

PostgreSQL 适用于更高并发、更长期运行、更强可运维性的部署场景。

### MCP 传输支持

当前明确支持：

- `stdio`
- `streamable`
- `sse`

说明：

- 监控与管理层存在 websocket 能力
- MCP `websocket` transport 仍不应视为当前发布基线

## 快速开始

### 1. 作为 CLI / MCP Server 直接运行

先安装：

```bash
npm install -g mcp-swagger-server
```

然后启动：

```bash
mss --openapi https://petstore.swagger.io/v2/swagger.json --transport stdio
```

用于 MCP 客户端时，可参考：

```json
{
  "mcpServers": {
    "swagger-api": {
      "command": "mss",
      "args": [
        "--openapi",
        "https://petstore.swagger.io/v2/swagger.json",
        "--transport",
        "stdio"
      ]
    }
  }
}
```

### 2. 本地开发运行

环境初始化：

```bash
node -v
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
pnpm install
```

常用命令：

```bash
pnpm build
pnpm dev
pnpm test
pnpm lint
pnpm type-check
```

完整安装、数据库配置、API/UI/CLI 启动命令见：

- [Local Setup And Run](./docs/guides/local-setup-and-run.md)
- [Database Mode Quickstart](./docs/guides/database-mode-quickstart.md)
- [Database Strategy](./docs/guides/database-strategy.md)

## 当前主要访问路径

默认开发环境下：

- UI: `http://127.0.0.1:3000`
- API: `http://127.0.0.1:3001`
- MCP Streamable 示例: `http://127.0.0.1:3322/mcp`

说明：

- `/mcp` 是 MCP 协议入口，不是浏览器查看页面
- 浏览器直接访问时，如果缺少 MCP 会话头，返回 `Mcp-Session-Id header is required` 属于正常行为

## 当前已收敛的产品能力

- OpenAPI / Swagger 文档导入
- URL 导入、文本导入、上传导入
- 规范校验与标准化
- Swagger 2.0 到 OpenAPI 3.x 兼容转换
- OpenAPI `3.0.4` 校验兼容处理
- 工具列表预览与转换
- Bearer Token 与自定义请求头配置
- 服务器管理与进程日志查看
- SQLite / PostgreSQL 双数据库模式

## 当前文档入口

项目基线与说明请优先从这里进入：

- [PRODUCT_CONSTRAINTS](./PRODUCT_CONSTRAINTS.md)
- [PROJECT_BASELINE](./PROJECT_BASELINE.md)
- [RELEASE_BASELINE_V1](./RELEASE_BASELINE_V1.md)
- [Documentation Index](./docs/README.md)
- [Next Phase Development Plan](./docs/guides/next-phase-development-plan.md)

## 当前工作原则

- 先保证主路径稳定可发布，再扩展功能
- 外部需求文档仅作为参考，不直接覆盖当前产品基线
- Windows 与 Linux / Ubuntu 必须同时可运行
- 文档、CLI、API、UI 的主路径描述必须尽量一致
- 长时间运行的稳定性和可靠性优先于功能堆叠

## License

MIT，见 [LICENSE](./LICENSE)
