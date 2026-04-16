# Next Phase Development Plan

## Purpose

This document defines the next focused product-convergence stage after the current baseline cleanup.

It is intentionally narrow. It does not try to open a new broad feature roadmap.

## Current Situation

The project already has a usable main path, but the next bottlenecks are now concentrated in four areas:

- architecture documentation is not yet a reliable engineering reference everywhere
- some active guides are stale and should be archived rather than endlessly patched
- intentionally unimplemented items are not yet managed through a clear open-items mechanism
- some non-baseline or partially implemented surfaces still create operator confusion

## Next Stage Goal

The next stage goal is:

- make the documentation set trustworthy as a product engineering baseline
- keep deferred items visible through open-items rather than through hidden placeholders
- reduce active-surface noise without pretending unfinished work does not exist
- tighten the contract between architecture docs and current code reality

## Stage Name

Recommended stage name:

- Phase 6: Product Baseline Consolidation

## Scope

### Workstream 1: documentation baseline cleanup

Deliverables:

- rewrite the active architecture document so it matches current implementation
- keep only current-use guides in `docs/guides`
- archive stale guides that no longer match the current baseline
- update `docs/README.md`, `docs/guides/README.md`, and `docs/reference/README.md` to reflect the cleaned structure

Exit criteria:

- active docs can be used as current engineering references
- stale guides no longer appear as active guidance

### Workstream 2: open-items management

Deliverables:

- create and maintain `docs/reference/open-items.md`
- move intentionally deferred or partially implemented design items into that list
- reference open items from active planning docs where needed

Exit criteria:

- unfinished items are visible and explicitly tracked
- active docs do not imply that deferred items are already part of the release baseline

### Workstream 3: operator-surface reduction

Deliverables:

- identify UI and API surfaces that still expose non-baseline or fragile capabilities
- either remove them from the active path or clearly classify them as not baseline
- keep user-facing flows focused on import, validate, convert, and managed runtime

Exit criteria:

- the main operator path is clearer
- fewer entry points imply unfinished capability

### Workstream 4: code-to-doc contract tightening

Deliverables:

- confirm architecture docs against current runtime, API, and UI contracts
- confirm that parser propagation guidance still matches the actual build chain
- confirm that security boundary notes match current implementation status

Exit criteria:

- architecture and planning docs do not over-claim functionality
- next engineering decisions can use the docs as a reliable baseline

## Concrete Execution Order

1. rewrite active architecture documentation
2. create open-items and move deferred design notes into it
3. archive stale guides from the active guide set
4. update guide indexes and documentation entry points
5. review UI/API non-baseline surfaces and classify them against open-items
6. prepare the next implementation-focused increment only after the baseline docs are stable

## Recommended Implementation Backlog After Doc Consolidation

The next implementation increment should stay narrow and focus on product reliability, not feature expansion.

Status note:

- the first tightening pass for Steps 1 through 5 below has already been completed
- the next pass should focus on release-path verification, residual surface cleanup, and shrinking the remaining open-items set without inventing a new roadmap

### Step 1: security boundary tightening

Target:

- review management endpoint guard coverage in `packages/mcp-swagger-api/src/modules/servers/servers.controller.ts`
- confirm which endpoints must require authenticated access by default
- remove any ambiguity between documented auth expectations and actual controller behavior

Expected result:

- management APIs no longer expose unclear or inconsistent protection boundaries

### Step 2: runtime transformation path cleanup

Target:

- review `packages/mcp-swagger-server/src/lib/initTools.ts`
- reduce or eliminate fallback-only transformation behavior where practical
- keep parser output and runtime transformation behavior aligned

Expected result:

- fewer surprising differences between validation, preview, and runtime conversion paths

### Step 3: operator-surface cleanup in UI

Target:

- review development placeholders in `packages/mcp-swagger-ui/src/layout/MainLayout.vue`
- review fragile component usage in `packages/mcp-swagger-ui/src/modules/servers/ServerManager.vue`
- remove or downgrade non-baseline actions that confuse operators

Expected result:

- the UI emphasizes import, validate, convert, and server operations instead of unfinished side paths

### Step 4: observability honesty and monitoring cleanup

Target:

- review placeholder CPU metrics in `packages/mcp-swagger-api/src/modules/servers/services/server-metrics.service.ts`
- ensure monitoring surfaces do not over-claim metric accuracy
- classify any incomplete monitoring behavior in `open-items`

Expected result:

- monitoring remains useful without presenting placeholder data as production-grade telemetry

### Step 5: deferred auth and notification capabilities

Target:

- keep email verification, password reset mail, and notification delivery explicitly classified as deferred until implemented
- avoid treating those structures as release-complete features

Expected result:

- operator expectations remain aligned with the current product reality

## Next Pass After The First Tightening Round

The next implementation pass should be execution-oriented rather than exploratory.

### Pass A: release-path verification

Target:

- verify the real release path against `docs/guides/release-readiness-checklist.md`
- confirm SQLite default mode, PostgreSQL optional mode, Windows, and Ubuntu guidance still match implementation
- re-check the OpenAPI import -> validate -> convert -> managed runtime path with known public specs

Expected result:

- the documented publishable path is confirmed against the current codebase

### Pass B: residual operator-surface cleanup

Target:

- identify any remaining API/UI entry points that still overstate unfinished capability
- either downgrade them to explicit non-baseline behavior or move them behind clearer operator expectations

Expected result:

- the operator surface is narrower and less misleading

### Pass C: open-items reduction with traceability

Target:

- review `docs/reference/open-items.md` item by item
- close only items that are truly aligned across code, docs, and verification
- keep the remaining items explicit instead of burying them in broad planning language

Expected result:

- open-items becomes a smaller, more actionable product engineering register

## Out Of Scope For This Stage

Do not prioritize these during this stage unless they directly unblock baseline consolidation:

- new MCP transport expansion
- broad new UI feature families
- large speculative architecture rewrites
- hidden cleanup that removes traceability of deferred work

## Success Criteria

This stage is complete when:

- active docs are smaller, clearer, and closer to the code
- stale active docs are archived
- deferred items are tracked in open-items
- architecture docs can be used to plan the next engineering increment
