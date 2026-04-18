# Current Convergence Plan

## Purpose

This document defines the current convergence baseline for the project.

It is intentionally narrower than historical planning material. It describes what the project is actively trying to stabilize now, not every possible future direction.

## Current Product Baseline

### Supported MCP transports

Only these MCP transports are part of the active baseline:

- `stdio`
- `streamable`
- `sse`

### Explicit non-goals for the current convergence cycle

- introducing new MCP transports that are not already implemented end to end
- expanding the operator surface before the current release path is stable
- promoting supporting management surfaces into a separate API governance platform baseline
- hiding incomplete design items behind vague wording in active docs

### Realtime channel that remains in scope

The API/UI stack still uses websocket channels for management and monitoring updates such as:

- process status updates
- realtime logs
- monitoring and operational notifications

That websocket path is management infrastructure. It is not an MCP transport and should not appear in the MCP transport matrix.

## Product Constraints That Must Hold

- product convergence takes priority over feature expansion
- Windows and Linux, especially Ubuntu, must remain supported
- SQLite remains the default database mode
- PostgreSQL remains a supported heavier deployment mode
- long-running stability and operational reliability are more important than feature count
- docs, code, CLI, API, and UI must stay aligned

## Immediate Priorities

### Priority 1: stabilize the active baseline

- keep active docs limited to real, currently supported paths
- remove stale transport wording from active code and docs
- keep transport types aligned across runtime, API, UI, and docs

### Priority 2: tighten the release path

- keep import, validation, normalization, conversion, and managed runtime flows stable
- preserve streamable multi-session behavior
- keep Windows and Ubuntu startup and run guidance accurate

### Priority 3: keep engineering discipline visible

- keep parser -> server -> api -> ui contracts explicit
- keep setup, release, and verification docs current
- track deferred or partial items through `open-items` instead of burying them

## Active Work Items In This Convergence Cycle

1. clean up active documentation and archive stale materials
2. keep architecture and implementation notes aligned with the codebase
3. keep open, partial, and deferred items visible in `docs/reference/open-items.md`
4. reduce confusion from non-baseline supporting UI and API surfaces
5. preserve release verification around current supported paths

## Current Execution Status

The current convergence cycle has already completed one focused tightening pass across the main baseline:

- security guard coverage for server management endpoints was tightened
- direct spec transformation no longer falls back through a misleading runtime-only path
- obvious UI placeholders and broken server-management interactions were removed or corrected
- placeholder CPU values were downgraded into explicit "unavailable" telemetry fields
- deferred email auth and notification delivery paths were reclassified so they no longer present themselves as release-complete behavior
- larger endpoint-governance and semantic-layer positioning has been pushed back out of the active baseline

The cycle is not finished yet. The remaining work is mostly release-path consolidation rather than broad feature development.

## Remaining Convergence Focus

- keep active docs synchronized with the tightened API and runtime boundaries
- continue pruning non-baseline supporting surfaces that still imply unfinished capability
- keep release verification honest for SQLite default mode, PostgreSQL optional mode, Windows, and Ubuntu
- keep deferred requirement documents archived when they no longer define the active baseline
- preserve traceability for still-open items instead of silently removing them from planning

## Deferred Topics

The following may be considered later, but are not part of the current convergence target:

- new transport types beyond the current MCP baseline
- broader platform features not required for the current release path
- large architectural expansion that does not directly improve current product reliability

## Exit Criteria For This Convergence Cycle

- active docs no longer claim support for stale or placeholder capabilities
- MCP transports and management websocket semantics are clearly separated
- setup, run, and release guidance reflect the real current product
- deferred items are visible through `open-items`
- the project can be operated on Windows and Ubuntu using documented paths
