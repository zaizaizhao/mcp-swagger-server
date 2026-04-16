# Release Readiness Checklist

Use this checklist before cutting a release or calling the current baseline publishable.

The goal is to validate the real supported path, not to create an aspirational checklist for features that are still incomplete.

## 1. Baseline Confirmation

Confirm the release still matches the current baseline:

- supported MCP transports are `stdio`, `streamable`, and `sse`
- `streamable` multi-session behavior remains working
- default database mode is `SQLite`
- `PostgreSQL` remains a supported optional deployment mode
- email verification delivery, password reset mail delivery, and email notification delivery are not claimed as baseline features unless they are actually implemented
- active docs do not claim unsupported transport or feature behavior

## 2. Documentation Check

Confirm active documentation is aligned with the implementation:

- `README.md`
- `docs/guides/local-setup-and-run.md`
- `docs/guides/database-mode-quickstart.md`
- `docs/guides/database-strategy.md`
- `docs/guides/current-convergence-plan.md`
- package README files for affected packages
- deferred or partial items are tracked in `docs/reference/open-items.md`

## 3. Build And Type Validation

Run:

```bash
pnpm build
pnpm type-check
pnpm --filter mcp-swagger-server run test
```

If parser behavior changed, also run:

```bash
pnpm run verify:parser-chain
```

If the release touches broader parser compatibility or downstream contracts, run:

```bash
pnpm run verify:parser-chain:full
```

## 4. API Test Verification

For targeted OpenAPI management and validation paths under `packages/mcp-swagger-api`:

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

For broader API regression verification:

```bash
pnpm --filter mcp-swagger-api test
```

## 5. Runtime Path Verification

Verify the main operator paths:

- UI main entry: `http://127.0.0.1:3000/`
- API main entry: `http://127.0.0.1:3001/api`
- API Swagger docs: `http://127.0.0.1:3001/api/docs`
- MCP endpoint example: `http://127.0.0.1:3322/mcp`

Check:

- `/mcp` is treated as an MCP protocol endpoint, not a browser page
- concurrent streamable sessions can be established

## 6. OpenAPI Management Verification

Use at least one known public operator test spec:

- `https://petstore.swagger.io/v2/swagger.json`

Verify:

- import from URL works
- the spec can be parsed and normalized
- validation succeeds on the normalized document
- tool preview renders usable results
- conversion to MCP succeeds on the supported path

## 7. Database Mode Verification

### SQLite

Verify:

- API runs with `DB_TYPE=sqlite` or with `DB_TYPE` omitted
- startup logs clearly report `Database mode: sqlite`
- SQLite migrations and startup behavior succeed

### PostgreSQL

Verify:

- API runs with `DB_TYPE=postgres`
- startup logs clearly report `Database mode: postgres`
- schema initialization and migrations succeed

## 8. Endpoint Registry Verification

Verify the manual endpoint lifecycle path:

- register a manual endpoint from the UI or API
- edit the manual endpoint and confirm the method/path display updates correctly
- run `probe` and verify healthy endpoints do not incorrectly revive `offline` items
- run `publish readiness` and confirm blocking reasons are visible when applicable
- run `publish` and `offline` and confirm lifecycle status changes match the operator action
- delete the manual endpoint and confirm it disappears from the grouped registry view

## 9. Windows And Ubuntu Verification

Check the documented run path on both:

- Windows PowerShell
- Ubuntu

At minimum verify:

- dependency install
- API startup
- UI startup
- basic import and conversion workflow
- parser verification path
- `pnpm --filter mcp-swagger-server run test:streamable-session`

## 10. Open Items Review

Before release, review `docs/reference/open-items.md` and confirm:

- unfinished items are not being claimed as release-complete
- operator-visible gaps are disclosed clearly enough
- no archived guide is still treated as an active source of truth
- security, auth, monitoring, and UI placeholder risks are understood
- deferred auth and notification flows are described honestly in API and operator guidance

A release is ready only when the documented baseline, the real implementation, and the tested operator path all match.
