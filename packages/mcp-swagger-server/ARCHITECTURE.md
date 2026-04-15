# MCP Swagger Server Architecture

## Purpose

This document describes the current runtime architecture that is actually implemented and should be treated as the working architecture baseline for follow-up product work.

It is not a future-state proposal. If code and this document conflict, the code wins until this document is updated.

## Current Product Boundary

`mcp-swagger-server` is the runtime layer in a four-layer product structure:

- `mcp-swagger-parser`: parse, validate, normalize, and extract OpenAPI/Swagger structure
- `mcp-swagger-server`: transform parsed API operations into MCP tools and host MCP runtime transports
- `mcp-swagger-api`: orchestrate runtime processes, persistence, security, and management APIs
- `mcp-swagger-ui`: provide operator-facing import, preview, conversion, and management workflows

The current stable runtime transport baseline is:

- `stdio`
- `sse`
- `streamable`

Management websocket used by API/UI monitoring is not part of the MCP transport architecture.

## Current Runtime Responsibilities

### 1. CLI and runtime startup

Primary files and areas:

- `src/cli/`
- `src/interactive-cli/`
- `src/index.ts`

Responsibilities:

- load OpenAPI input from file, URL, or content-related options
- validate runtime options
- select the supported MCP transport
- inject auth and custom header behavior into tool execution
- start the MCP runtime in the requested transport mode

### 2. OpenAPI to MCP transformation

Primary files and areas:

- `src/transform/`
- `src/core/Transformer.ts`
- `src/lib/initTools.ts`

Responsibilities:

- convert normalized OpenAPI operations into MCP-compatible tool definitions
- map parameters and request bodies into MCP input schema
- preserve enough endpoint metadata for correct runtime invocation

This layer should remain behaviorally aligned with parser output and must not silently fork parser semantics.

### 3. MCP runtime registry and tool execution

Primary files and areas:

- `src/core/MCPRegistry.ts`
- `src/core/ToolManager.ts`
- `src/adapters/ProgrammaticAdapter.ts`

Responsibilities:

- register MCP tools
- map MCP tool invocation to HTTP request execution
- manage runtime server instances and tool handlers
- isolate execution failures so one tool failure does not corrupt the whole runtime process

### 4. Transport implementation

Primary files and areas:

- `src/transportUtils/stdio.ts`
- `src/transportUtils/sse.ts`
- `src/transportUtils/stream.ts`

Responsibilities:

- expose the same MCP tool surface through each supported transport
- keep protocol framing clean and avoid stdout pollution
- preserve transport-specific behavior without changing tool semantics

## Current Data Flow

1. CLI or API-managed runtime startup resolves configuration.
2. OpenAPI input is loaded and validated.
3. Parsed or transformed endpoint data is converted into MCP tools.
4. MCP tools are registered into a runtime server instance.
5. A supported transport exposes the runtime to an MCP client.
6. Tool calls execute outbound HTTP requests against the target API.

## Current Cross-Layer Contracts

### Parser to runtime

The runtime assumes parser-compatible OpenAPI structure. Parser changes must be propagated and verified through downstream rebuild and type-check flow.

Reference guide:

- `docs/guides/parser-change-verification.md`

### Runtime to API

`mcp-swagger-api` manages server lifecycle by spawning the runtime package through its built CLI entry. That means:

- CLI flags are part of a real cross-package contract
- transport names and runtime options must remain stable or be intentionally migrated
- runtime startup behavior must stay compatible with Windows and Ubuntu process handling

### API to UI

UI must consume the managed transport matrix exposed by API and must not invent extra runtime transports in its own types or pages.

## Current Design Constraints

- the runtime architecture must stay aligned with `PROJECT_BASELINE.md` and `PRODUCT_CONSTRAINTS.md`
- no new MCP transport should be introduced into the baseline without end-to-end implementation, docs, and verification
- runtime logs must not corrupt stdio protocol behavior
- Windows and Linux path handling, process invocation, and file loading must remain supported
- reliability of long-running managed server processes is more important than feature count

## Known Gaps And Technical Debt

These are current architecture-level gaps, not hidden defects:

- direct transformation fallback behavior in some runtime paths still needs cleanup and consistency review
- interactive CLI remains broader than the current release baseline and should be treated carefully
- runtime observability exists, but some metrics are still incomplete in higher layers
- email verification delivery, password reset mail delivery, and email notification delivery are not part of the current product baseline
- downstream packages still depend on correct rebuild discipline after parser changes

See also:

- `docs/reference/open-items.md`

## Near-Term Architecture Priorities

1. keep parser -> runtime -> api -> ui contracts aligned
2. reduce non-baseline runtime surface that is not release-critical
3. improve long-running process reliability and observability without polluting protocol paths
4. keep runtime docs and real implementation synchronized
