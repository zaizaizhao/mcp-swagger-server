# 发布收敛核对清单

本文档作为当前发布收敛阶段的实际核对记录，优先覆盖可发布主路径，而不是历史设计目标。

## 1. 当前发布主路径

本轮认定的发布主路径如下：

- CLI 主路径：`mcp-swagger-server` / `mcp-swagger` / `mss` 直接读取 OpenAPI 并启动 MCP Server
- API 主路径：健康检查、OpenAPI 解析/校验、Server 管理、Swagger 文档
- UI 主路径：开发态通过 Vite 代理访问后端，并覆盖 OpenAPI 解析上传、Server 列表与操作等已对齐路径

以下能力暂不作为本轮发布门槛：

- UI 中未完成与后端契约收敛的扩展模块
- 历史文档中的旧接口、旧端口、旧前缀
- 额外自动化、AI 助手、日志导出等非主链路能力

## 2. 已实际核对的运行入口

### CLI

- 包入口：
  - `mcp-swagger-server`
  - `mcp-swagger`
  - `mss`
- 当前可用帮助命令：
  - `pnpm --filter mcp-swagger-server run cli:help`
  - `node packages/mcp-swagger-server/dist/cli.js --help`
- 默认关键参数：
  - `--openapi <url|file>`
  - `--transport <stdio|streamable|sse>`
  - `--port <number>`，默认 `3322`
  - `--host <string>`，默认 `127.0.0.1`

### API

- 默认端口：`3001`
- 全局前缀：`/api`
- 开放主路径：
  - `GET /health`
  - `GET /health/ready`
  - `GET /health/live`
  - `GET /health/info`
  - `GET /api/docs`
  - `POST /api/openapi/parse`
  - `POST /api/openapi/validate`
  - `POST /api/openapi/normalize`
  - `POST /api/openapi/upload`
  - `POST /api/openapi/validate-upload`
  - `GET /api/openapi/validate-url`
  - `GET /api/openapi/parse-url`
- 受 JWT 保护的 Server 管理主路径：
  - `GET /api/v1/servers`
  - `POST /api/v1/servers`
  - `GET /api/v1/servers/:id`
  - `POST /api/v1/servers/:id/actions`
  - `GET /api/v1/servers/:id/health`
  - `GET /api/v1/servers/health/overview`

### UI

- Vite 开发端口：`3000`
- API 代理：
  - `/api -> http://localhost:3001`
- 本轮已对齐的 UI 服务层主路径：
  - `POST /api/openapi/parse`
  - `POST /api/openapi/upload`
  - `POST /api/openapi/validate-upload`
  - `GET /api/openapi/validate-url`
  - `GET /api/v1/servers`
  - `POST /api/v1/servers/:id/actions`
  - `GET /api/v1/servers/:id`

## 3. 安装与运行命令

API 运行前置条件：

- 需要可访问的 PostgreSQL
- 需要正确的数据库账号与密码，否则 `mcp-swagger-api` 无法完成启动，`/health` 与 `/api/docs` 不会可用

### Windows PowerShell

```powershell
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
pnpm build
pnpm --filter mcp-swagger-server run cli:help
pnpm --filter mcp-swagger-api run build
pnpm --filter mcp-swagger-ui run build
```

本地最小 CLI 验证：

```powershell
node packages/mcp-swagger-server/dist/cli.js --openapi .\examples\minimal-openapi.json --transport stdio
```

本地开发启动：

```powershell
pnpm --filter mcp-swagger-api run start:dev
pnpm --filter mcp-swagger-ui run dev
```

### Ubuntu

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
pnpm build
pnpm --filter mcp-swagger-server run cli:help
pnpm --filter mcp-swagger-api run build
pnpm --filter mcp-swagger-ui run build
```

本地最小 CLI 验证：

```bash
node packages/mcp-swagger-server/dist/cli.js --openapi ./examples/minimal-openapi.json --transport stdio
```

本地开发启动：

```bash
pnpm --filter mcp-swagger-api run start:dev
pnpm --filter mcp-swagger-ui run dev
```

## 4. 最小接入示例

### MCP 客户端接入

```json
{
  "mcpServers": {
    "swagger-api": {
      "command": "mss",
      "args": [
        "--openapi",
        "/absolute/path/to/openapi.json",
        "--transport",
        "stdio"
      ]
    }
  }
}
```

### API 解析最小请求

```bash
curl -X POST http://localhost:3001/api/openapi/parse \
  -H "Content-Type: application/json" \
  -d '{
    "source": {
      "type": "content",
      "content": "{\"openapi\":\"3.0.3\",\"info\":{\"title\":\"demo\",\"version\":\"1.0.0\"},\"paths\":{}}"
    }
  }'
```

## 5. 本轮实际核对结论

- 已核对：
  - CLI 帮助脚本可修复并作为正式核对入口
  - API 主路径与默认端口、前缀、文档入口已明确
  - UI 代理目标与部分主路径接口已对齐
  - Windows / Ubuntu 命令均采用同一套 Node 20 + pnpm 方案，可跨平台执行
- 已发现并修正：
  - `mcp-swagger-server` 的 `cli:help` 脚本参数透传错误
  - `mcp-swagger-api` 的 `start:prod` 启动路径错误
  - UI 服务层中的 `parse/upload/validate-url` 主路径调用错误
- 当前边界：
  - UI 仍存在历史模块与旧接口并存的情况，尚未达到“所有页面都可发布”
  - API 已完成本地数据库连接与启动验证，但仍需继续收敛更大范围的页面级联调验证
  - 根目录与包内仍有部分历史文档未完全收敛，不能再作为运行事实来源

## 6. 后续收敛建议

- 继续按“主路径优先”策略处理 UI，先收敛 OpenAPI 管理页与 Server 管理页
- 为 API 建立一份稳定的契约清单，避免 UI 再次漂移
- 将历史文档中的旧端口、旧前缀、旧 transport 描述逐步归档或标注失效
