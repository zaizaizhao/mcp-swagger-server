# MCP Swagger Server

将 OpenAPI / Swagger 规范转换为 MCP Tools，并以可运行的 MCP Server 形式对外提供。

当前文档以中文说明为主；如有必要，可附带英文说明，但默认以中文表述作为主版本。

## Project Origin

本仓库起源于原始的 `mcp-swagger-server` 项目。

原始 upstream 为 OpenAPI / Swagger 解析、MCP Tool 生成以及 MCP Server 快速运行提供了良好的初始设计。本仓库在此基础上继续维护，并感谢原作者与贡献者的工作。

本仓库继续沿用 upstream 的总体方向：导入 OpenAPI / Swagger，完成标准化处理，生成兼容 MCP 的 Tools，并通过可用的运行时形态对外提供。

本仓库当前仍作为 upstream 的下游项目维护，会继续跟踪 upstream 变化，在实际可行的前提下保持兼容，并将合适的改进回馈给 upstream。

## Current Product Position

本仓库当前处于收敛阶段。

当前目标不是大规模扩展功能，而是在尽量贴近 upstream 项目形态的前提下，收敛出一个稳定、可运行、可发布的基线版本，并补足可靠性、兼容性和基本可用性。

当前主路径：

- import OpenAPI / Swagger documents
- parse, validate, and normalize specifications
- inspect API paths and generated tool definitions
- convert API operations into MCP tools
- run and manage MCP servers
- keep CLI, API, and UI behavior aligned

## Monorepo Structure

- `packages/mcp-swagger-parser`
  Parses, validates, normalizes, and reconciles OpenAPI / Swagger inputs.
- `packages/mcp-swagger-server`
  Transforms normalized API operations into MCP tools and provides the MCP runtime.
- `packages/mcp-swagger-api`
  Provides management APIs, persistence, authentication, server orchestration, and monitoring support.
- `packages/mcp-swagger-ui`
  Provides the operator-facing import, validation, conversion, and server management UI.

## Current Baseline

### Runtime requirements

- Node.js `>= 20`
- pnpm `>= 8`
- Windows
- Linux, with Ubuntu treated as the primary Linux compatibility target

### Database modes

- default: `SQLite`
- optional: `PostgreSQL`

SQLite is the default path for single-node and lightweight deployments.

PostgreSQL remains the heavier deployment path for higher concurrency, longer-running operations, and stronger operational requirements.

### Supported MCP transports

Current baseline transports:

- `stdio`
- `streamable`
- `sse`

Notes:

- `streamable` is expected to support concurrent multi-session access in the current baseline
- API/UI websocket channels are used for management and monitoring, but they are not MCP transports

## Quick Start

### Run as a CLI / MCP server

Install:

```bash
npm install -g mcp-swagger-server
```

Start with `stdio`:

```bash
mss --openapi https://petstore.swagger.io/v2/swagger.json --transport stdio
```

Example MCP client configuration:

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

### Local development

```bash
node -v
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
pnpm install
pnpm build
pnpm dev
pnpm test
pnpm lint
pnpm type-check
```

See:

- [Local Setup And Run](./docs/guides/local-setup-and-run.md)
- [Database Mode Quickstart](./docs/guides/database-mode-quickstart.md)
- [Database Strategy](./docs/guides/database-strategy.md)

Database mode quick check:

- if `DB_TYPE` is omitted, `mcp-swagger-api` defaults to `SQLite`
- if `DB_TYPE=postgres`, `mcp-swagger-api` runs in `PostgreSQL` mode
- startup logs print `Database mode: sqlite` or `Database mode: postgres`
- the current baseline has already verified:
  - SQLite default startup path
  - PostgreSQL schema initialization and startup path
  - CI coverage for both database modes

## Main Runtime Endpoints

In the default development layout:

- UI: `http://127.0.0.1:3000`
- API: `http://127.0.0.1:3001`
- MCP streamable example: `http://127.0.0.1:3322/mcp`

Notes:

- `/mcp` is an MCP protocol endpoint, not a browser UI page
- if a browser hits `/mcp` directly and receives `Mcp-Session-Id header is required`, that is expected protocol behavior

## Current Product Capabilities

- OpenAPI / Swagger import
- URL import, raw text import, and file upload import
- specification validation and normalization
- Swagger 2.0 to OpenAPI 3.x compatibility conversion
- OpenAPI `3.0.4` compatibility handling in the validation path
- tool preview and conversion workflows
- Bearer token and custom header injection
- streamable multi-session support
- CLI and server smoke test coverage
- managed process lifecycle and process log inspection
- SQLite / PostgreSQL dual database support

## Additional Features In This Repository

相较于原始 upstream 基线，本仓库目前主要补充或加强了以下几类实际能力：

- supporting API and UI surfaces for import, validation, conversion, and runtime management
- SQLite as the default local database mode, while keeping PostgreSQL as a supported option
- stronger release and setup documentation for Windows and Ubuntu
- additional runtime smoke tests and streamable multi-session verification
- tighter documentation and release-baseline discipline around the active supported path

对应的中文说明：

- 补充了围绕导入、校验、转换和运行管理的 API / UI 支持面
- 增加了默认 SQLite、可选 PostgreSQL 的双数据库运行方式
- 强化了 Windows 与 Ubuntu 的安装、启动和发布说明
- 增加了运行时 smoke tests 与 streamable 多会话验证
- 收紧了活动文档与发布基线的约束，减少文档漂移

## English Summary

This downstream repository keeps the original upstream direction and focuses on making the supported path more stable and easier to operate.

Compared with upstream, the current additions mainly include supporting API/UI surfaces, SQLite as the default local database option, stronger Windows/Ubuntu operational guidance, and stricter release-baseline discipline.

Current operator boundary note:

- OpenAPI import, validation, preview, conversion, and managed runtime remain the core baseline
- supporting API/UI management surfaces exist to help operators work with the runtime, but they should not be treated as a separate API governance platform baseline
- broader endpoint-governance and semantic-layer ideas remain deferred and are not part of the current upstream-aligned baseline

## Documentation Entry Points

Start from:

- [PRODUCT_CONSTRAINTS](./PRODUCT_CONSTRAINTS.md)
- [PROJECT_BASELINE](./PROJECT_BASELINE.md)
- [RELEASE_BASELINE_V1](./RELEASE_BASELINE_V1.md)
- [Documentation Index](./docs/README.md)
- [Current Convergence Plan](./docs/guides/current-convergence-plan.md)
- [Open Items](./docs/reference/open-items.md)

## Working Rules

- stabilize the release path before expanding scope
- keep deferred items visible instead of implying they already work
- keep Windows and Linux / Ubuntu support aligned
- keep docs, CLI, API, and UI aligned with the real implementation
- prefer reliability of long-running operation over feature count

## License

MIT, see [LICENSE](./LICENSE)
