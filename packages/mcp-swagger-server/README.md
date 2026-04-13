# MCP Swagger Server Package

`mcp-swagger-server` 是本项目中负责 OpenAPI 转 MCP Tools 与 MCP Server 运行时的核心包。

它提供：

- OpenAPI 操作到 MCP Tools 的转换
- CLI 启动入口
- `stdio` / `streamable` / `sse` 运行模式
- 面向 MCP 客户端的直接接入能力

## 当前定位

这是当前产品中最接近“直接可发布 npm 包”的部分。

二进制命令：

- `mcp-swagger-server`
- `mcp-swagger`
- `mss`

推荐直接使用：

- `mss`

## 当前支持基线

### OpenAPI / Swagger

- OpenAPI 3.x
- Swagger 2.0
- JSON / YAML
- URL / 本地文件输入

### MCP 传输

当前明确支持：

- `stdio`
- `streamable`
- `sse`

说明：
- `streamable` supports concurrent multi-session access in the current release baseline

- MCP `websocket` transport 目前不应视为已实现的发布能力
- 若文档或类型中仍出现 `websocket`，应按“规划中”理解，而不是“当前可用”

## 快速使用

### 直接运行

```bash
mss --openapi https://petstore.swagger.io/v2/swagger.json --transport stdio
```

### Streamable HTTP

```bash
mss --openapi https://petstore.swagger.io/v2/swagger.json --transport streamable --port 3322
```

### SSE

```bash
mss --openapi https://petstore.swagger.io/v2/swagger.json --transport sse --port 3322
```

## 常用参数

```bash
--openapi <url|file>
--transport <stdio|streamable|sse>
--port <number>
--host <string>
--base-url <url>
--config <file>
--env <file>
--auth-type <none|bearer>
--bearer-token <token>
--bearer-env <var>
--watch
```

## 本地开发

在仓库根目录完成依赖安装后：

```bash
pnpm --filter mcp-swagger-server run build
pnpm --filter mcp-swagger-server run cli:help
```

开发模式：

```bash
pnpm --filter mcp-swagger-server run dev
```

常用脚本：

```bash
pnpm --filter mcp-swagger-server run build
pnpm --filter mcp-swagger-server run test
pnpm --filter mcp-swagger-server run test:smoke
pnpm --filter mcp-swagger-server run test:cli
pnpm --filter mcp-swagger-server run test:streamable-session
```

## 与整个项目的关系

在产品主路径中，通常有两种使用方式：

1. 直接通过 CLI / MCP 客户端使用本包。
2. 由 `mcp-swagger-api` 管理面间接调度本包能力。

## 相关文档

- [Project README](../../README.md)
- [Local Setup And Run](../../docs/guides/local-setup-and-run.md)
- [Next Phase Development Plan](../../docs/guides/next-phase-development-plan.md)
