# MCP Swagger Server

将 OpenAPI / Swagger 描述的 REST API 转换为可运行的 MCP 工具与服务。

**Languages**: [English](./README_EN.md) | 中文

## 当前定位

本仓库当前目标是收敛一个“基本可用、可发布、可接入大模型应用”的版本，而不是继续扩散功能面。

当前主链路为：

- OpenAPI/Swagger 输入
- 解析与标准化
- 端点提取与过滤
- MCP 工具生成
- MCP 运行时暴露
- API / UI 管理与运维

## Monorepo 结构

- `packages/mcp-swagger-parser`
  OpenAPI/Swagger 解析、校验、标准化、端点提取
- `packages/mcp-swagger-server`
  MCP 工具转换与运行时，支持 `stdio`、`sse`、`streamable`
- `packages/mcp-swagger-api`
  管理后端，负责编排、持久化、安全边界与运维接口
- `packages/mcp-swagger-ui`
  操作界面，消费后端稳定合同

## 当前推荐使用方式

### 1. 作为 MCP Server 直接接入大模型应用

先安装：

```bash
npm install -g mcp-swagger-server
```

然后以 `stdio` 模式启动：

```bash
mss --openapi https://petstore.swagger.io/v2/swagger.json --transport stdio
```

用于 Claude Desktop 一类客户端时，可使用类似配置：

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

### 2. 本地开发

环境要求：

- Node.js `>= 20`
- pnpm `>= 8`

Development environment bootstrap:

Windows PowerShell:

```powershell
node -v
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
```

Ubuntu:

```bash
node -v
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
```

If `corepack` is unavailable, install pnpm via npm:

```bash
npm install -g pnpm
```

安装依赖：

```bash
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

完整本地安装与运行基线（含 SQLite/PostgreSQL、API/UI/CLI 启动）见：
[docs/guides/local-setup-and-run.md](./docs/guides/local-setup-and-run.md)

## 认证与过滤能力

当前主路径已支持：

- Bearer Token 认证
- 自定义请求头
- 基于方法、路径、`operationId`、状态码、参数的端点过滤

示例：

```bash
mss \
  --openapi https://api.example.com/openapi.json \
  --transport streamable \
  --auth-type bearer \
  --bearer-env API_TOKEN \
  --operation-filter-methods GET \
  --operation-filter-methods POST
```

## 文档入口

当前有效的项目基线与文档入口：

- [产品约束](./PRODUCT_CONSTRAINTS.md)
- [项目基线](./PROJECT_BASELINE.md)
- [发布基线](./RELEASE_BASELINE_V1.md)
- [阶段分析与计划](./PROJECT_ANALYSIS_AND_V1_PLAN.md)
- [文档索引](./docs/README.md)

`docs/` 已区分为：

- `docs/guides`
  当前使用、部署、认证、排障文档
- `docs/reference`
  当前仍有效的发布与协议参考
- `docs/archive`
  历史方案、阶段总结、旧设计文档归档

## 当前工作原则

- 先收敛可发布版本，再扩展新功能
- 外部设计资料仅作参考，不直接覆盖当前架构
- Windows 和 Linux/Ubuntu 都必须可运行
- CLI、API、UI、文档合同必须尽量一致

## 许可证

MIT，见 [LICENSE](./LICENSE)。
