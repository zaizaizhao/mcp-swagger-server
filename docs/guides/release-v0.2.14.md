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
- OpenAPI validation and conversion baseline now has explicit smoke-test coverage
- release readiness is now documented as a concrete checklist

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
- `pnpm --filter mcp-swagger-ui run type-check`
- `pnpm --filter mcp-swagger-server run type-check`
- `pnpm --filter mcp-swagger-api run build`
- `pnpm --filter mcp-swagger-api test`
- `pnpm --filter mcp-swagger-ui run build`
- `pnpm --filter mcp-swagger-server run build`
- default SQLite initialization when `DB_TYPE` is unset
- `node scripts/verify-parser-propagation.js`
- `packages/mcp-swagger-api/src/modules/openapi/services/parser.service.spec.ts`
- `packages/mcp-swagger-api/src/modules/openapi/services/openapi.service.spec.ts`
- `packages/mcp-swagger-api/src/modules/openapi/services/validator.service.spec.ts`
- `packages/mcp-swagger-api/src/modules/servers/services/process-manager.service.spec.ts`
- `packages/mcp-swagger-api/src/modules/servers/services/process-health.service.spec.ts`
- `packages/mcp-swagger-api/src/modules/servers/services/system-log.service.spec.ts`

## Follow-up Baseline

For any later release that changes `mcp-swagger-parser`, downstream verification should include:

- `pnpm run verify:parser-chain`

## Residual Risks

The current release baseline is buildable and testable, but the following non-blocking items remain:

- the UI production build still reports large bundle chunk warnings
- the UI build also reports a mixed dynamic/static import warning around `src/stores/auth.ts`

These do not block the current release, but they should be treated as Phase 6 optimization work rather than ignored indefinitely.

## Related Guides

- [Local Setup And Run](./local-setup-and-run.md)
- [Database Mode Quickstart](./database-mode-quickstart.md)
- [Database Strategy](./database-strategy.md)
- [Parser Change Verification](./parser-change-verification.md)
- [Release Readiness Checklist](./release-readiness-checklist.md)
