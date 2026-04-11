# MCP Swagger Server Project Analysis and V1 Plan

## 1. Project Summary

`mcp-swagger-server` is a monorepo product that converts OpenAPI/Swagger specifications into MCP-compatible tools and exposes those tools through multiple product surfaces.

Current top-level governance documents:

- `PRODUCT_CONSTRAINTS.md`
- `PROJECT_BASELINE.md`
- `RELEASE_BASELINE_V1.md`

Current repository structure:

- `packages/mcp-swagger-parser`: OpenAPI parsing, validation, normalization, Swagger 2 to OpenAPI 3 conversion
- `packages/mcp-swagger-server`: MCP tool transformation and transport runtime
- `packages/mcp-swagger-api`: NestJS backend for management, orchestration, storage, monitoring
- `packages/mcp-swagger-ui`: Vue-based operator UI

## 2. Current Product Capability Assessment

### Mature areas

- Core parser package structure is clear.
- MCP server runtime already supports `stdio`, `sse`, and `streamable`.
- CLI surface is present and usable.
- API and UI product direction are already established.

### Weak areas

- Core behavior is duplicated between packages.
- API input handling is not robust enough for product use.
- Runtime metadata and docs have drifted from actual implementation.
- Logging strategy is not transport-safe by default.
- Test coverage is far below the codebase size, but the larger problem is architectural drift rather than missing tests alone.

## 3. Main Product Problems

### P0. Core behavior duplication

`packages/mcp-swagger-api` implements parsing, normalization, and tool-generation behavior that overlaps with `mcp-swagger-parser` and `mcp-swagger-server`.

Impact:

- behavior drift
- inconsistent tool generation
- harder maintenance
- docs become harder to trust

### P0. API input handling defects

The OpenAPI controller currently force-parses `source.content` as JSON in the parse path, which is incompatible with URL input, file-path input, and YAML content.

Impact:

- valid user inputs fail
- API behavior differs from parser and CLI behavior
- UI/backend integration becomes fragile

### P0. Validation flow instability

Validation logic contains swallowed parsing errors and inconsistent handling between content input and non-content input.

Impact:

- unpredictable validation results
- harder debugging for users
- increased risk of false negatives and false positives

### P1. Version and contract drift

Observed drift includes:

- runtime/package version constants not matching package versions
- API documentation not matching actual routes or ports
- UI-facing endpoint descriptions diverging from backend routes

Impact:

- lower operator trust
- harder release management
- onboarding friction

### P1. Logging strategy is not production-safe

Library/core code emits extensive `console.log` and related output.

Impact:

- protocol pollution risk for `stdio`
- poor observability discipline
- noisy production behavior

### P1. Security posture is under-enforced

Some API routes advertise auth but have guards commented out or inconsistently applied.

Impact:

- product claims and runtime behavior differ
- management APIs are easier to misuse

### P1. Cross-platform delivery is under-specified

The project contains product code plus operational scripts, but the current optimization route does not yet treat Windows and Linux/Ubuntu as equal runtime targets.

Impact:

- platform drift
- shell/script assumptions leaking into product behavior
- harder deployment and support

## 4. Optimization Strategy

### Strategy A. Stabilize the main path first

Focus on:

- input handling correctness
- parser/runtime/API contract alignment
- version and metadata consistency
- Windows and Linux/Ubuntu compatibility for product paths

### Strategy B. Converge toward shared core implementations

Target state:

- parser owns spec parsing, normalization, and validation
- server owns MCP transformation and runtime
- API orchestrates, persists, secures, and exposes those capabilities
- UI consumes stable API contracts

### Strategy C. Treat docs and runtime as one product

All changes must update user-facing contracts where needed.

## 5. V1 Scope

V1 is intentionally limited to high-leverage product corrections.

### V1 goals

- establish top-level product constraints
- document architecture assessment and optimization route
- fix API parse and validate input handling on the main path
- remove obvious contract and metadata drift that affects product trust

### V1 non-goals

- full architecture rewrite
- broad security module redesign
- complete logging subsystem replacement
- UI redesign
- test framework expansion as the primary output

## 6. V1 Worklist

### Documentation and governance

- [x] Create top-level product constraints document
- [x] Create project analysis and staged optimization plan
- [x] Record V1 delivery scope and non-goals

### Main-path product fixes

- [x] Remove forced JSON parsing from API parse endpoint
- [x] Make validation path use consistent spec loading and validation
- [x] Ensure URL, file, and content inputs are handled by the proper parser path
- [x] Correct misleading runtime/package version constants
- [x] Keep V1 changes shell-neutral and path-neutral for Windows and Ubuntu

### Contract cleanup

- [x] Reduce the most harmful implementation drift in API handling
- [ ] Prepare follow-up work for docs/runtime alignment across packages

### Deferred to later stages

- [x] gate main-path core logging behind explicit debug flags
- [x] unify API tool generation with server core on the main OpenAPI path
- [x] align the main API/UI README contracts with the current product routes and port defaults
- [x] restore product-facing auth defaults for the primary server-management surface
- [ ] build staged product-grade verification coverage

## 7. Proposed Roadmap After V1

### V2. Core convergence

- reduce duplicate OpenAPI-to-tool logic in API layer
- make API consume shared parser/server transformation contracts
- remove internal `dist/...` package path coupling where practical

### V3. Runtime hardening

- structured logging and debug gating on the main path
- stronger transport safety guarantees
- clearer operational diagnostics

### V4. Product hardening

- security defaults review
- management contract cleanup
- release discipline and documentation synchronization
- cross-platform runtime and operator workflow audit

Delivered in the current V4 increment:

- fixed public-route metadata handling in auth guards so explicit `@Public()` boundaries are honored consistently
- made `v1/servers` management endpoints require JWT by default
- marked `health` and `openapi` controller surfaces as explicitly public to prevent future global-guard regressions
- removed stray request-debug `console.log` calls from product request paths
- synchronized the API/UI README examples with the current backend port and route contracts

## 8. Definition of Success for V1

V1 is successful if:

- top-level product constraints are explicit in the repository
- the project has a documented optimization route
- API parse and validate behavior is materially more robust
- key version metadata drift is reduced

## 9. Implementation Notes for the Current Patch

The first implementation patch should remain focused. It should fix the highest-value defects without expanding into a multi-package redesign.

Recommended patch contents:

1. API parse input handling correction
2. API validation flow correction
3. runtime version constant cleanup

This keeps the change set product-relevant, reviewable, and suitable as a first stabilization increment.
