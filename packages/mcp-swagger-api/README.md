# MCP Swagger API

`mcp-swagger-api` 是本项目的 NestJS 管理后端。

它负责：

- OpenAPI 文档导入、校验与标准化
- 文档持久化与管理
- MCP Server 管理
- 认证与会话处理
- 进程状态、日志与运维接口

## 当前定位

该包是产品后端的一部分，不是独立产品。

默认开发端口：

- API: `3001`

## 当前支持基线

### 数据库

- 默认：SQLite
- 可选：PostgreSQL

数据库模式通过环境变量控制，详见：

- [Database Mode Quickstart](../../docs/guides/database-mode-quickstart.md)
- [Database Strategy](../../docs/guides/database-strategy.md)
- [Local Setup And Run](../../docs/guides/local-setup-and-run.md)

### 托管 MCP 传输面

当前管理面应视为支持：

- `streamable`
- `sse`
- `stdio`，主要用于 CLI / MCP 客户端直接接入场景

说明：

- 本包中的 websocket 用于管理与监控实时更新。
- websocket 不属于托管 MCP transport 矩阵。

## 开发启动

```bash
pnpm --filter mcp-swagger-api run start:dev
```

生产构建：

```bash
pnpm --filter mcp-swagger-api run build
pnpm --filter mcp-swagger-api run start:prod
```

## 常用脚本

```bash
pnpm --filter mcp-swagger-api run build
pnpm --filter mcp-swagger-api run start:dev
pnpm --filter mcp-swagger-api run test
pnpm --filter mcp-swagger-api run lint
pnpm --filter mcp-swagger-api run type-check
```

## 主要接口

常见运行路径：

- `GET /health`
- `POST /api/openapi/parse`
- `POST /api/openapi/validate`
- `POST /api/openapi/normalize`
- `GET /api/documents`
- `GET /api/v1/servers`

说明：

- `/api/docs` 提供 Swagger UI 文档。
- 实际可用接口以当前 controller 实现为准。
- 未完成的管理能力不应被视为已发布承诺。

## 当前职责边界

当前稳定主路径为：

1. 导入 OpenAPI 文档
2. 校验并标准化文档
3. 管理可转换的文档资产
4. 创建并管理 MCP Server
5. 为 UI 提供一致的管理 API

当前阶段不应将本包视为“全量企业平台”。

## 相关文档

- [Project README](../../README.md)
- [Documentation Index](../../docs/README.md)
- [Local Setup And Run](../../docs/guides/local-setup-and-run.md)
- [Current Convergence Plan](../../docs/guides/current-convergence-plan.md)
