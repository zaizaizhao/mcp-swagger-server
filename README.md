# MCP Swagger Server

Convert OpenAPI and Swagger specifications into MCP tools, runnable MCP servers, and a product-oriented MCP Gateway operating surface.

Documentation priority is accuracy over localization. Active docs may remain primarily in English during convergence.

## Project Origin

This repository started from the original `mcp-swagger-server` project.

The original upstream provided an excellent initial design for OpenAPI/Swagger parsing, MCP tool generation, and fast MCP server exposure. This repository explicitly acknowledges that foundation and thanks the original author and contributors for that work.

This repository has since evolved beyond only fast OpenAPI-to-MCP conversion as a technical showcase. It is being developed as a product-oriented API Gateway and API-to-MCP platform with an MCP Gateway application shape.

This repository continues to operate as a downstream project of the original upstream. It keeps tracking upstream changes, aims to preserve useful compatibility where practical, and should continue to contribute focused improvements back upstream when appropriate.

## Current Product Position

This repository is in a product-convergence stage.

The current goal is not broad feature expansion. The goal is to keep a stable, runnable, and releasable baseline that can actually be connected to model applications and operated over time.

Current primary product paths:

- import OpenAPI / Swagger documents
- parse, validate, and normalize specifications
- inspect API paths and generated tool definitions
- convert API operations into MCP tools
- run and manage MCP servers
- provide MCP Gateway-style operator workflows across CLI, API, and UI
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
- manual endpoint registration through Endpoint Registry
- endpoint probe, readiness, publish, and offline lifecycle actions for manual endpoints
- Bearer token and custom header injection
- streamable multi-session support
- CLI and server smoke test coverage
- managed process lifecycle and process log inspection
- SQLite / PostgreSQL dual database support

Current operator boundary note:

- OpenAPI Management remains the import and specification workflow
- Endpoint Registry is a peer management surface for manually registered endpoints and lightweight governance of imported endpoints
- the semantic-layer enhancement discussed in planning is still deferred and tracked as an open item

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
