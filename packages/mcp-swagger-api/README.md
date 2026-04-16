# MCP Swagger API

`mcp-swagger-api` is the NestJS management backend in this repository.

It is responsible for:

- OpenAPI import, validation, and normalization
- document persistence and management
- MCP server management
- authentication and session support
- process state, logs, and selected operational endpoints

## Current Position

This package is part of the product backend and is not a standalone product.

Default development port:

- API: `3001`

## Current Baseline

### Database

- default: `SQLite`
- optional: `PostgreSQL`

Database mode is controlled through environment variables. See:

- [Database Mode Quickstart](../../docs/guides/database-mode-quickstart.md)
- [Database Strategy](../../docs/guides/database-strategy.md)
- [Local Setup And Run](../../docs/guides/local-setup-and-run.md)

Current database baseline notes:

- default mode: `SQLite`
- to switch to PostgreSQL, set `DB_TYPE=postgres` in `packages/mcp-swagger-api/.env`
- the current baseline has verified PostgreSQL for:
  - application startup
  - schema initialization
  - seed initialization
  - package test pass
- to support both databases, enum column helpers now automatically ignore unsupported `length` options in PostgreSQL mode

### Managed MCP transport surface

The current managed surface should be treated as supporting:

- `streamable`
- `sse`
- `stdio`, primarily for CLI and direct MCP-client integration paths

Notes:

- websocket in this package is used for management and monitoring updates
- websocket is not part of the managed MCP transport baseline

## Development Start

```bash
pnpm --filter mcp-swagger-api run start:dev
```

Production build:

```bash
pnpm --filter mcp-swagger-api run build
pnpm --filter mcp-swagger-api run start:prod
```

## Common Scripts

```bash
pnpm --filter mcp-swagger-api run build
pnpm --filter mcp-swagger-api run start:dev
pnpm --filter mcp-swagger-api run test
pnpm --filter mcp-swagger-api run lint
pnpm --filter mcp-swagger-api run type-check
```

Database mode verification examples:

```bash
pnpm --filter mcp-swagger-api run test -- --runInBand
DB_TYPE=postgres pnpm --filter mcp-swagger-api run test -- --runInBand
```

## Main Endpoints

Common runtime paths:

- `GET /health`
- `POST /api/openapi/parse`
- `POST /api/openapi/validate`
- `POST /api/openapi/normalize`
- `GET /api/documents`
- `GET /api/v1/servers`

Notes:

- `/api/docs` provides Swagger UI documentation
- actual available endpoints are defined by the current controller implementation
- incomplete management capabilities should not be treated as released product commitments

## Responsibility Boundary

The current stable path for this package is:

1. import OpenAPI documents
2. validate and normalize documents
3. manage convertible document assets
4. create and manage MCP servers
5. provide a consistent management API to the UI

At the current stage this package should not be treated as a fully realized enterprise platform.

## Related Documents

- [Project README](../../README.md)
- [Documentation Index](../../docs/README.md)
- [Local Setup And Run](../../docs/guides/local-setup-and-run.md)
- [Current Convergence Plan](../../docs/guides/current-convergence-plan.md)
