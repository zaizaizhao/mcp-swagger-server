# Release v0.2.14

## Scope

This release closes the current product baseline around installation, startup, database mode selection, and long-running runtime stability.

## Core Changes

- default database mode is now `SQLite`
- `PostgreSQL` remains a supported heavy-load and production-oriented mode
- API startup now validates the SQLite path and reports the active database mode
- runtime write amplification is reduced through process-log throttling and retention cleanup
- health-check persistence is sampled and bounded
- system-log retention cleanup is scheduled
- critical service behavior now has unit-test coverage
- operational documentation has been aligned to the current product baseline

## Operator Impact

### Default local path

- no external database is required for first startup
- if `DB_TYPE` is unset, the API defaults to SQLite
- the default SQLite file path is `data/mcp-swagger.db`

### Production path

- use `DB_TYPE=postgres` for heavier multi-user and long-running deployments
- keep PostgreSQL as the recommended database for higher sustained write volume

## Verified in this release

- `pnpm --filter mcp-swagger-api run type-check`
- `pnpm --filter mcp-swagger-api run build`
- `pnpm --filter mcp-swagger-api test`
- `pnpm --filter mcp-swagger-ui run build`
- `pnpm --filter mcp-swagger-server run build`
- default SQLite initialization when `DB_TYPE` is unset

## Related Guides

- [Local Setup And Run](./local-setup-and-run.md)
- [Database Mode Quickstart](./database-mode-quickstart.md)
- [Database Strategy](./database-strategy.md)
