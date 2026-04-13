# Next Phase Development Plan

## Purpose

This document records the latest cross-check between current project documentation and the actual implementation state.

It has two goals:

- identify the current gaps between docs, code, and product baseline
- define the next development plan in a product-first order

This document should be treated as the active planning baseline for the next stage of work.

## Current Execution Status

The following cleanup phases have already been executed on the current baseline:

- Phase 1: documentation convergence and release identity
- Phase 2: transport and contract clarification
- Phase 3: build-chain hardening
- Phase 4: baseline cleanup for unfinished operator-facing placeholders
- Phase 5: release-readiness baseline and OpenAPI smoke coverage

Current state after these phases:

- active README and guide structure has been converged to the current runtime baseline
- managed transport surface has been narrowed to `streamable` and `sse`
- parser-to-consumer verification now has an explicit documented command path
- role copy, permission-role listing, and permission tree endpoints no longer fail with raw `not implemented` errors
- unfinished profile/account/settings entries have been removed or disabled from the active operator surface
- OpenAPI validation and transformation baseline now has explicit service-level smoke coverage
- release gating is documented as a concrete checklist instead of an implicit manual process

Items still intentionally deferred from the current baseline:

- MCP `websocket` transport as a managed runtime path
- email notification delivery
- websocket-specific health checks for managed servers
- richer CPU usage metrics

## Audit Scope

The review covered:

- root governance documents
- root `README.md`
- `docs/guides`
- package-level README files
- current package scripts and runtime configuration
- selected implementation hotspots in `parser`, `api`, `server`, and `ui`

## Cross-Check Summary

## 1. Areas already aligned

The following areas are materially aligned with the current product baseline:

- default database mode is SQLite
- PostgreSQL remains the heavier deployment mode
- API startup and setup guidance in `docs/guides/local-setup-and-run.md` is broadly aligned with the current implementation
- parser-level OpenAPI 3.0.4 compatibility logic exists in source and current build output
- API/UI/CLI runtime paths and main startup commands are already documented in a usable form
- documentation structure has been cleaned up into `guides`, `reference`, and `archive`

## 2. Documentation defects found

### 2.1 Encoding corruption in README files

Multiple README files still contain mojibake or broken non-ASCII rendering.

Confirmed examples:

- root `README.md`
- `packages/mcp-swagger-api/README.md`
- `packages/mcp-swagger-server/README.md`
- `packages/mcp-swagger-ui/README.md`

This is not cosmetic only. It makes the product harder to understand and weakens release quality.

### 2.2 Package README drift

Several package README files no longer match the current product baseline.

Examples:

- `packages/mcp-swagger-ui/README.md` still says the dev server is at `5173`, while current Vite config uses `3000`
- `packages/mcp-swagger-ui/README.md` describes an older UI structure and workflow
- `packages/mcp-swagger-api/README.md` still presents some transport/configuration descriptions in a mixed and partially outdated way

### 2.3 Version communication drift

There is still inconsistency between:

- Git tags such as `v0.2.x`
- parser/server package versions such as `1.7.0`
- API/UI package versions still at `1.0.0`
- historical tag `v1.7.1`

This does not immediately break runtime behavior, but it weakens release clarity and makes support harder.

## 3. Implementation gaps found

### 3.1 Build-chain sensitivity still exists

The recent OpenAPI `3.0.4` validation issue showed a real product risk:

- source code was correct
- runtime behavior was wrong until the parser package was rebuilt

This means the monorepo build and dependency propagation path is still too fragile for long-running product work.

The product needs a more reliable policy for:

- package build order
- workspace dependency refresh
- operator guidance after lower-layer fixes

### 3.2 `websocket` semantics are still mixed

There are two different meanings currently present:

- monitoring/UI websocket functionality in the backend and UI
- MCP server transport value `websocket`

Current code and docs show these are not fully aligned.

Examples:

- API and UI still expose or type `websocket` as a transport value
- backend comments explicitly say WebSocket transport is not yet implemented in server lifecycle
- API package README says websocket is planned
- monitoring websocket module does exist

This creates operator confusion and should be clarified at the contract level.

### 3.3 Unimplemented security/management endpoints still exist

There are still controller and service areas that throw or contain explicit TODOs.

Examples include:

- permission-related controller methods throwing `Method not implemented`
- role copy functionality not implemented
- some notification paths not implemented
- websocket health check placeholders in server/process services

These do not all block the current main path, but they should be classified more clearly as:

- current baseline
- deferred non-baseline capability
- planned feature

### 3.4 UI/operator layer still carries historical overlap

The UI package still contains signs of historical drift:

- older README structure
- local validation utility paths in addition to backend validation paths
- mixed transport descriptions
- layout/profile/settings placeholders

This is not yet a clean operator-facing product layer.

### 3.5 Release baseline is still under-specified for versioning

The repository now has release notes and operation docs, but it still lacks a single clean rule for:

- product version number source of truth
- package version synchronization policy
- release tag to package version mapping

## 4. Planned or partially implemented features not yet fully delivered

The following capabilities exist in planning, types, or partial implementation, but are not yet fully closed as product-ready functions:

- MCP `websocket` transport as a real runtime path
- complete permission tree / permission relationship workflows
- role copy workflow
- email-related notification flows
- robust websocket health checking for managed servers
- richer process CPU metrics implementation
- stronger build propagation rules across parser -> api -> ui/server consumers

## 5. Product risks if left unresolved

If the current gaps are not handled, the project will continue to face these risks:

- docs will keep drifting away from the actual product behavior
- operators will confuse monitoring websocket support with MCP websocket transport support
- fixes in lower packages may appear “not working” because build propagation remains fragile
- package-level documentation will remain weaker than the current product baseline
- release identity will remain confusing because tags and package versions are not clearly governed

## Recommended Next Development Plan

## Phase 1: documentation convergence and release identity

Priority: highest

Scope:

- rewrite root `README.md` into clean UTF-8 and current product baseline wording
- rewrite package README files for `api`, `server`, and `ui`
- align all package README runtime ports, startup commands, and transport descriptions
- define and document release/versioning policy

Exit criteria:

- no mojibake in active documentation
- package README files match current runtime behavior
- release/version policy is documented in one source of truth

## Phase 2: transport and contract clarification

Priority: high

Scope:

- clarify the difference between monitoring websocket and MCP websocket transport
- remove unsupported transport options from operator-facing paths where necessary
- align API DTOs, UI types, and docs around the actual supported transport matrix

Exit criteria:

- no operator-facing surface suggests unsupported MCP websocket transport as a working path
- monitoring websocket remains clearly documented as a separate capability

## Phase 3: build-chain hardening

Priority: high

Scope:

- define reliable package build order in the monorepo
- reduce cases where lower-layer fixes require manual guesswork to become effective
- add a documented verification path for parser changes affecting API/UI behavior

Exit criteria:

- parser changes can be propagated and verified with a predictable build workflow
- release checklist includes cross-package rebuild verification where needed

## Phase 4: baseline cleanup for non-main-path placeholders

Priority: medium

Scope:

- inventory controller/service methods that still throw `not implemented`
- classify each as:
  - remove from active surface
  - defer and document
  - implement in next milestone
- trim or hide unfinished operator-facing actions that do not belong in the current baseline

Exit criteria:

- active UI/API surfaces do not expose misleading unfinished capabilities
- deferred items are explicitly documented rather than implicitly broken

## Phase 5: next product increment

Priority: medium

Recommended target:

- stable OpenAPI import/validate/normalize/convert flow
- stable managed server lifecycle for supported transports
- stable operator-facing document and server management path
- clear release identity and deployment guidance

This should be treated as the next releasable product increment.

## Suggested Execution Order

Use this order for follow-up work:

1. clean and rewrite active README files
2. define release/version policy
3. clarify transport support matrix
4. harden parser build propagation
5. inventory and reduce unfinished API/UI actions
6. only then expand adjacent features

## Concrete Near-Term Task List

### Task Group A: active documentation rewrite

- rewrite root `README.md`
- rewrite `packages/mcp-swagger-api/README.md`
- rewrite `packages/mcp-swagger-server/README.md`
- rewrite `packages/mcp-swagger-ui/README.md`

### Task Group B: transport support matrix

- document current support:
  - `stdio`
  - `streamable`
  - `sse`
- explicitly mark MCP `websocket` transport as unsupported until fully implemented
- remove or hide unsupported selections in UI/API where necessary

### Task Group C: monorepo build reliability

- create a documented parser-change verification flow
- ensure API/UI/server consuming packages are rebuilt when parser logic changes
- consider adding an integration verification script for parser compatibility fixes

### Task Group D: unfinished surface reduction

- audit `TODO` / `not implemented` controller paths
- downgrade or hide non-baseline features from active operator workflows
- document deferred items in a controlled backlog document

## Decision

The next stage should not prioritize broad new feature expansion.

The next stage should prioritize:

- documentation correctness
- transport/contract clarity
- build-chain reliability
- removal of misleading unfinished surface area

Only after these are closed should the project move into a larger new architecture increment.
