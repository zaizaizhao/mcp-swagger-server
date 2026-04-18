# MCP Swagger Server Product Constraints

## Purpose

This document defines the top-level constraints for all follow-up optimization and upgrade work in this repository.

These constraints override local implementation preferences. Future changes must be evaluated as product work, not as isolated demos, scripts, or test-only patches.

## Product Positioning

`mcp-swagger-server` is a product for converting OpenAPI/Swagger-described APIs into usable MCP capabilities for AI clients, with supporting runtime and management surfaces around import, validation, conversion, and operation.

The repository contains four product layers:

- `packages/mcp-swagger-parser`: parsing, normalization, validation, spec compatibility
- `packages/mcp-swagger-server`: MCP tool generation and transport runtime
- `packages/mcp-swagger-api`: product backend, orchestration, persistence, security
- `packages/mcp-swagger-ui`: product frontend and operator workflow

The core product value is the stable chain:

- `OpenAPI input -> parser -> MCP tool model -> runtime transport -> client integration`

## Top-Level Constraints

### 1. Product-first, not test-first

- Do not optimize the project as a sample app or temporary test harness.
- Do not add features that only improve demos while weakening the production path.
- Do not introduce implementation shortcuts that make later productization harder.

### 2. Single source of truth for core behavior

- Parsing, normalization, validation, Swagger 2 conversion, and MCP tool generation must converge toward shared core implementations.
- API and UI layers must orchestrate core capabilities, not maintain competing transformation logic.
- Duplicate domain logic across `parser`, `server`, and `api` should be treated as architectural debt.

### 3. CLI, API, and UI must remain behaviorally aligned

- A user should get materially consistent results from CLI, programmatic usage, API endpoints, and UI workflows.
- Input semantics, auth behavior, filtering, base URL resolution, and generated tool structure must not drift between surfaces.

### 4. Documentation is part of the product

- README, package docs, API docs, CLI help, and UI guidance must reflect actual runtime behavior.
- Documentation drift is treated as a product defect, not a documentation-only issue.

### 5. Security defaults must be explicit

- Management and mutation flows should default to protected access unless intentionally exposed.
- Debug output must not leak secrets or break transport protocols.
- Transport security behavior must be deliberate and documented.

### 6. Transport safety is a product requirement

- `stdio`, `sse`, and `streamable` are product surfaces, not internal experiments.
- Library/runtime code must avoid uncontrolled stdout noise that can corrupt protocol streams.
- Logging must be controllable by environment or configuration.

### 7. Observability without pollution

- Operational visibility is required, but logging must be structured and gated.
- Debug-only traces must not be emitted in normal product flows.

### 8. Compatibility and upgrade discipline

- Version metadata exposed by packages and runtimes must stay consistent with published package versions.
- Backward compatibility must be considered when changing public CLI flags, API contracts, exports, or generated tool shapes.

### 9. Cross-platform runtime compatibility

- Product changes must preserve support for Windows and Linux, with Ubuntu treated as a first-class target environment.
- Avoid hard-coding shell behavior, paths, separators, signals, encodings, or process assumptions that only work on one platform.
- CLI, runtime management, file loading, and documentation examples should be reviewed from a cross-platform perspective.
- Platform-specific scripts are allowed only as operational helpers, not as the only supported product path.

### 10. Stage delivery around product increments

- Work should be shipped in coherent product increments, each with clear scope and user-visible value.
- Each increment should strengthen the main path before adding adjacent features.

## Delivery Priorities

All future optimization should prioritize work in this order:

1. Correctness of the core conversion chain
2. Contract consistency across CLI/API/UI/docs
3. Security and transport safety
4. Operational reliability and maintainability
5. Feature expansion

## Explicit Non-Goals For Current Upgrades

Until the main path is stabilized, avoid prioritizing:

- cosmetic-only UI expansion
- broad feature branching without contract cleanup
- duplicate parser/transformer logic in higher layers
- adding larger governance or platform features that rely on unstable core semantics

## Acceptance Standard For Future Changes

A change should be considered acceptable only if it improves at least one of:

- main-path correctness
- contract consistency
- security posture
- runtime reliability
- maintainability of shared product architecture

If a change improves local convenience but increases divergence between layers, it should be rejected or redesigned.
