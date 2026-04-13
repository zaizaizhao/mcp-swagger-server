# MCP Swagger Server Release Baseline V1

## Goal

Converge the repository toward a basic usable version that is suitable for release and can be connected to real LLM applications through MCP.

This is a release-baseline document, not a long-term feature roadmap.

## Definition of "Basic Usable, Releasable"

The release baseline is acceptable only if the following are true:

- the OpenAPI-to-MCP main path is correct enough for normal product use
- CLI, API, and UI no longer materially contradict each other on the main path
- the main management surface has explicit security boundaries
- runtime logging does not pollute MCP transports by default
- Windows and Ubuntu usage paths are both documented and viable
- a user can import an OpenAPI spec, generate tools, run an MCP server, and connect it to an LLM client with a documented path

## Current Release Focus

### P0. Keep the main path stable

- OpenAPI input handling must stay correct for URL, file, and content
- parser and runtime transformation must remain shared on the main path
- generated tools must be predictable and documented

### P0. Avoid new scope expansion

Until this release baseline is reached, do not prioritize:

- large new import workflows
- broad UI redesign
- major storage changes
- speculative discovery systems
- new feature clusters that increase maintenance burden

### P1. Tighten operator trust

- docs must match actual behavior
- auth boundaries must be explicit
- release instructions must be reproducible
- examples must work on Windows and Ubuntu

### P1. Preserve room for later versions

The following may be planned for later versions, but are not release blockers for the current baseline:

- automatic OpenAPI discovery from base URLs
- richer endpoint risk scoring
- strategy-driven import wizard flows
- deeper auth scheme automation

## Current Version Strategy

The next version should be treated as a convergence version, not a feature explosion version.

Expected characteristics:

- fewer surprises
- clearer contracts
- easier setup
- easier connection to MCP-capable LLM applications

## Release Work Checklist

### Product contract

- [x] root documentation reflects current architecture and scope
- [x] release path is documented from install to MCP connection
- [ ] CLI/API/UI main-path behavior is cross-checked

### Runtime and security

- [ ] main-path runtime logging is quiet by default
- [x] management APIs use explicit auth boundaries
- [x] public endpoints are intentionally declared

### Cross-platform

- [x] Windows setup path is documented
- [x] Ubuntu setup path is documented
- [ ] runtime assumptions are reviewed for platform sensitivity

### Usability

- [x] at least one documented end-to-end path exists for direct MCP use
- [x] operator can understand what input to provide and what output to expect
- [x] major README contradictions are removed

## Defer List

The following should stay deferred unless they directly unblock release:

- replacing the current database strategy
- introducing a new top-level architecture style
- broad automatic discovery systems
- nonessential new management modules
- demo-oriented features that do not improve the release path
