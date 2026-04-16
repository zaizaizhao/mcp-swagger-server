# MCP Swagger Server Project Baseline

## Purpose

This document defines the current project baseline for architecture, functional scope, and development rules.

It is the reference point for all follow-up work. If an implementation, proposal, or external design note conflicts with this document, this document wins unless explicitly updated.

This baseline exists to prevent architecture drift, scope drift, and product-positioning drift.

The repository originated from the upstream `mcp-swagger-server` project, but the current baseline is governed by this repository's own product direction and release rules rather than by upstream alignment.

## Product Definition

`mcp-swagger-server` is a product for converting OpenAPI/Swagger-described APIs into MCP-compatible tools and exposing them through stable runtime and management surfaces.

The product is not a demo converter, not a one-off code generator, and not only a test harness.

The main product chain is:

- OpenAPI/Swagger input
- parsing and normalization
- endpoint extraction and filtering
- MCP tool generation
- MCP runtime exposure
- management and operator workflows

## Current Product Surfaces

### 1. Parser layer

Package:

- `packages/mcp-swagger-parser`

Responsibilities:

- parse OpenAPI and Swagger inputs from URL, file, or content
- validate specifications
- normalize schema forms
- extract endpoints and metadata
- provide shared model inputs for tool generation

### 2. Runtime/server layer

Package:

- `packages/mcp-swagger-server`

Responsibilities:

- transform parsed OpenAPI data into MCP tools
- host MCP runtime surfaces
- support `stdio`, `sse`, and `streamable`
- handle request mapping, auth injection, and transport behavior

### 3. API/backend layer

Package:

- `packages/mcp-swagger-api`

Responsibilities:

- orchestrate parser and runtime capabilities
- provide management APIs
- persist documents, server configs, and operational records
- enforce security boundaries
- expose health, management, and operator-facing workflows

### 4. UI/operator layer

Package:

- `packages/mcp-swagger-ui`

Responsibilities:

- provide operator workflows for import, preview, management, and monitoring
- consume stable backend contracts
- avoid re-implementing parser/runtime business logic

## Architecture Rules

### Single source of truth

- parser owns parsing, normalization, validation, and extracted OpenAPI structure
- server owns MCP transformation and runtime behavior
- api owns orchestration, persistence, and security
- ui owns presentation and operator flow

No higher layer should silently fork core domain logic that belongs to a lower layer.

### Shared behavior over duplicated behavior

If CLI, API, and UI produce materially different tool results from the same input, that is a product defect.

### Documentation is part of the runtime contract

README, package docs, and API docs must reflect actual ports, routes, auth boundaries, and supported flows.

## Current Functional Scope

### In scope for the current product

- import OpenAPI/Swagger from URL, file, or raw content
- validate and normalize specs
- generate MCP-compatible tools from parsed endpoints
- run MCP servers on supported transports
- manage server instances through the backend
- expose UI workflows for existing backend capabilities
- support auth-related runtime configuration already present in the codebase

### Explicitly not the current baseline

- full automatic discovery-first import from arbitrary API homepages as a required path
- broad new feature branching before current contracts are stabilized
- replacing current persistence architecture with a new storage model
- treating FastAPI as a separate core input format from OpenAPI
- large-scale architecture rewrites before a releasable baseline exists

## Development Constraints

### 1. Stabilize before expanding

Near-term work should prioritize:

- correctness
- contract consistency
- security posture
- runtime reliability
- release readiness

Feature expansion is secondary until the project is releasable with a clear main path.

### 2. External design notes are reference material only

External documents, including Swagger-to-MCP concept notes, may inform later planning but must not be copied into implementation without adaptation to this repository's architecture and constraints.

### 3. Product-first acceptance standard

A change is acceptable only if it improves at least one of:

- core conversion correctness
- consistency across CLI/API/UI/docs
- security and transport safety
- operational reliability
- maintainability
- release readiness

### 4. Cross-platform compatibility

Windows and Linux must both remain supported, with Ubuntu treated as a first-class environment.

This applies to:

- runtime behavior
- process management
- path handling
- file loading
- startup commands
- documentation examples

### 5. Avoid release-hostile drift

Do not introduce:

- new parallel contracts without migration intent
- temporary route aliases as permanent behavior
- debug output on main product protocol paths
- platform-specific assumptions in core runtime logic

## Release-Oriented Working Principle

The current project priority is not to maximize feature count.

The current priority is to converge on a basic, usable, releasable version that can be connected to real LLM applications with predictable behavior.

That means follow-up work should answer:

1. does this improve the main conversion path
2. does this reduce operator confusion
3. does this improve release confidence
4. does this avoid new architectural drift

If the answer is no, the work should be deferred.
