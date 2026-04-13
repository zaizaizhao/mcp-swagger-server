# Release Readiness Checklist

This checklist is the final product-baseline gate before tagging and publishing a version.

It is intentionally practical:

- verify the current main user paths
- verify the current supported database modes
- verify parser-to-runtime propagation when parser changes are involved
- confirm that Windows and Ubuntu operators can follow the same product path

## 1. Scope Gate

Confirm that the release only promises the current supported baseline:

- managed server transports are `streamable` and `sse`
- default database mode is `SQLite`
- `PostgreSQL` remains the heavier deployment mode
- MCP `websocket` transport is not claimed as supported
- deferred items remain documented as deferred, not half-exposed as active features

## 2. Documentation Gate

Confirm the following files are updated together when behavior changes:

- `README.md`
- `docs/guides/local-setup-and-run.md`
- `docs/guides/deployment-guide.md`
- the current release note under `docs/guides/`
- package README files under `packages/`

## 3. Build And Type-Check Gate

Run from repository root:

```bash
pnpm build
pnpm type-check
```

If the release touches `packages/mcp-swagger-parser`, also run:

```bash
pnpm run verify:parser-chain
```

For release work that needs downstream consumer builds too:

```bash
pnpm run verify:parser-chain:full
```

## 4. API Test Gate

Run the critical API tests from `packages/mcp-swagger-api`.

Windows PowerShell:

```powershell
cd packages\mcp-swagger-api
.\node_modules\.bin\jest.cmd --runInBand src/modules/openapi/services/parser.service.spec.ts
.\node_modules\.bin\jest.cmd --runInBand src/modules/openapi/services/openapi.service.spec.ts
.\node_modules\.bin\jest.cmd --runInBand src/modules/openapi/services/validator.service.spec.ts
```

Ubuntu:

```bash
cd packages/mcp-swagger-api
./node_modules/.bin/jest --runInBand src/modules/openapi/services/parser.service.spec.ts
./node_modules/.bin/jest --runInBand src/modules/openapi/services/openapi.service.spec.ts
./node_modules/.bin/jest --runInBand src/modules/openapi/services/validator.service.spec.ts
```

If you want the broader API suite, run:

```bash
pnpm --filter mcp-swagger-api test
```

## 5. Runtime Path Gate

Verify these main paths:

- UI dev entry: `http://127.0.0.1:3000/`
- API main entry: `http://127.0.0.1:3001/api`
- API Swagger docs: `http://127.0.0.1:3001/api/docs`
- MCP endpoint: `http://127.0.0.1:3322/mcp`

Expected note:

- direct browser access to `/mcp` is not a UI page and requires MCP session headers

## 6. OpenAPI Product Flow Gate

Verify the current primary operator flow with a known public sample such as:

- `https://petstore.swagger.io/v2/swagger.json`

Expected product results:

- import from URL succeeds
- validate specification succeeds
- API path extraction is populated
- MCP tool conversion succeeds
- generated tools can be inspected from the UI and the managed server detail page

## 7. Database Mode Gate

### SQLite

Confirm:

- API starts with `DB_TYPE=sqlite` or with `DB_TYPE` unset
- startup log prints `Database mode: sqlite`
- SQLite file path resolves correctly

### PostgreSQL

Confirm:

- API starts with `DB_TYPE=postgres`
- startup log prints `Database mode: postgres`
- schema initialization and login path remain normal

## 8. Windows And Ubuntu Gate

Verify the documented command path is still correct for both:

- Windows PowerShell
- Ubuntu

Minimum checks:

- dependency install
- API startup
- UI startup
- build commands
- parser-chain verification commands

## 9. Release Decision

The release is ready only when:

- build and type-check pass
- critical API tests pass
- the documented runtime paths are still correct
- the OpenAPI import/validate/convert path is verified
- SQLite default mode is confirmed
- any PostgreSQL-specific release changes are explicitly verified

If any item fails, update code or docs first and rerun the gate.
