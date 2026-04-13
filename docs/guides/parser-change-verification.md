# Parser Change Verification

This guide defines the required rebuild and verification path after any change in `packages/mcp-swagger-parser`.

## Purpose

`mcp-swagger-parser` is consumed by:

- `mcp-swagger-server`
- `mcp-swagger-api`
- `mcp-swagger-ui`

A parser fix is not considered complete until downstream packages have been rebuilt and re-verified.

## Required Rule

After changing parser code, do not stop at:

- parser source edit
- parser unit check
- parser build only

You must also rebuild and verify downstream consumers.

## Standard Command

Run from repository root:

```bash
pnpm run verify:parser-chain
```

This executes the fixed propagation order:

1. build parser
2. build server
3. type-check parser
4. type-check server
5. type-check api
6. type-check ui

## Faster Build-Only Command

If you only need a rebuild without the full type-check pass:

```bash
pnpm run build:parser-chain
```

## Full Consumer Build Variant

If you specifically need downstream build verification as well:

```bash
pnpm run verify:parser-chain:full
```

This additionally runs:

- `mcp-swagger-api` build
- `mcp-swagger-ui` build

Use this for release convergence or when runtime packaging behavior is under review.

## Optional Variant

If UI is not part of the current verification target:

```bash
node scripts/verify-parser-propagation.js --skip-ui
```

## When This Must Be Used

Use this flow for changes that affect:

- validation behavior
- normalization behavior
- OpenAPI / Swagger compatibility
- parser exports or parser types
- tool transformation behavior used by downstream packages

## Release Checklist Rule

If a release includes parser changes, the release verification section should include:

- `pnpm run verify:parser-chain`

Do not mark the parser change as complete until this passes.
