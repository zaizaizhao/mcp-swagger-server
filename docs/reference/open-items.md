# Open Items

## Purpose

This document records intentionally deferred, partially implemented, or not-yet-productized items in the current design.

These items should stay visible. They should not be hidden from documentation simply because they are not finished yet.

At the same time, they are not part of the current release baseline unless explicitly stated otherwise.

## Open Item Rules

- An open item may be planned, partially implemented, or explicitly deferred.
- An open item is not a release commitment unless it is moved into the active baseline.
- If an open item affects operator expectations, active docs should reference it here instead of implying that it already works.

## Current Open Items

### 1. Architecture documentation baseline rewrite

Status:

- partially addressed

Why it remains open:

- architecture documentation has historically drifted away from the real implementation
- package-level architecture notes still need continued tightening as code evolves

Impact:

- medium

### 2. Active guide set still needs pruning and normalization

Status:

- partially addressed

Why it remains open:

- core setup and database-mode guides have been rewritten into the current baseline
- the broader active guide set still needs continued pruning and consistency review as release work continues
- several historical or feature-specific guides have now been moved to archive, but package-level README cleanup and some remaining guide normalization work still remain

Impact:

- high

### 3. Direct spec transformation fallback consistency

Related code:

- `packages/mcp-swagger-server/src/lib/initTools.ts`

Status:

- partially addressed / still inconsistent

Why it remains open:

- direct spec initialization is now supported in the runtime wrapper, but transformation behavior is still split across more than one entry path and should continue to be unified

Impact:

- high

### 4. Security guard coverage on management endpoints

Related code:

- `packages/mcp-swagger-api/src/modules/servers/servers.controller.ts`

Status:

- partially addressed

Why it remains open:

- server management now has JWT plus permission guard coverage in the controller, but the broader management surface still needs a full endpoint-by-endpoint permission review

Impact:

- high

### 5. Permission and security workflow completeness

Related code:

- `packages/mcp-swagger-api/src/modules/security/controllers/permission.controller.ts`

Status:

- deferred / partial

Why it remains open:

- some permission-related capabilities are present as structure or commented placeholders but are not fully productized

Impact:

- medium

### 6. Email-based auth and notification delivery

Related code:

- `packages/mcp-swagger-api/src/modules/security/services/auth.service.ts`
- `packages/mcp-swagger-api/src/modules/websocket/services/notification.service.ts`

Status:

- partially addressed / delivery still deferred

Why it remains open:

- registration verification, password reset mail delivery, and email notification sending are not fully implemented
- the current baseline now makes this boundary more explicit in API/runtime behavior, but it still does not provide a real outbound email path

Impact:

- medium

### 7. CPU usage and monitoring metric completeness

Related code:

- `packages/mcp-swagger-api/src/modules/servers/services/server-metrics.service.ts`

Status:

- partially addressed

Why it remains open:

- placeholder CPU values in `ServerMetricsService` have been downgraded to explicit unavailable fields, but a consistent real CPU telemetry path is still not implemented across summary metrics
- the monitoring UI surface has been restored, but several cards, tables, and resource panels now intentionally render `Unavailable` until a real telemetry source is connected

Impact:

- medium

### 8. UI non-baseline entry points and development placeholders

Related code:

- `packages/mcp-swagger-ui/src/layout/MainLayout.vue`
- `packages/mcp-swagger-ui/src/locales/*`

Status:

- partially addressed / placeholder surfaces retained

Why it remains open:

- placeholder entries such as settings/profile and non-baseline routes have been restored so operator-facing surfaces do not disappear unexpectedly
- these routes and screens still include non-productized placeholders and should remain clearly marked until they are fully implemented or archived

Impact:

- medium

### 9. Component and UI dependency cleanup in server management views

Related code:

- `packages/mcp-swagger-ui/src/modules/servers/ServerManager.vue`

Status:

- partially addressed

Why it remains open:

- the broken `CircleClosure` reference and dropdown nesting in server management were corrected, but the view still needs continued cleanup around interaction complexity and historical debug-oriented behavior

Impact:

- medium

### 10. Cross-platform operational polish

Status:

- partially addressed

Why it remains open:

- Windows and Ubuntu remain supported product targets
- active local setup and database-mode guides have been rewritten into a clean baseline
- command examples, process behavior, encoding, and path handling still require continued review whenever runtime changes occur

Impact:

- high

### 11. UI production bundle size and code-splitting

Related code:

- `packages/mcp-swagger-ui/vite.config.ts`
- `packages/mcp-swagger-ui/src/modules/*`

Status:

- partially addressed

Why it remains open:

- Monaco editor has been moved out of the application startup path and the UI build now uses clearer feature-level chunking
- the main entry bundle is materially smaller, but Vite still reports oversized vendor chunks for Monaco, charts, and Element Plus
- further reduction likely needs more selective dependency loading and targeted vendor-splitting rather than only route-level chunking

Impact:

- medium

### 12. Semantic endpoint layer for LLM-oriented publishing

Related documents:

- `docs/guides/endpoint-semantic-layer-requirements.md`
- `docs/guides/endpoint-semantic-layer-sprint-breakdown.md`

Status:

- planned / deferred

Why it remains open:

- manual and imported endpoints can now be governed at a lightweight lifecycle level, but tool publication still largely reflects upstream API semantics directly
- the planned semantic layer for operator-defined endpoint meaning, naming refinement, and LLM-oriented descriptions has not been implemented yet

Impact:

- high

### 13. Imported-endpoint governance is still narrower than the manual registry path

Related code:

- `packages/mcp-swagger-api/src/modules/servers/services/api-management-center.service.ts`
- `packages/mcp-swagger-ui/src/modules/endpoint-registry/EndpointRegistry.vue`

Status:

- partially addressed

Why it remains open:

- the current API Center and Endpoint Registry now provide a usable control path for manually registered endpoints
- imported OpenAPI endpoints still do not have the same operator-facing registry workflow, selective publication controls, or lifecycle review surface end to end
- this is an intentional scope boundary for the current convergence pass, but it must remain visible so the product is not misrepresented as a full API governance platform

Impact:

- high

## What Is Not An Open Item

The following are already decided baseline positions, not open items:

- supported MCP transports are `stdio`, `streamable`, and `sse`
- management websocket is not an MCP transport
- SQLite and PostgreSQL are both supported product paths, with SQLite as default
- Windows and Ubuntu must both remain supported

## Promotion Rule

An open item should only move into the active baseline after all of the following are true:

1. implementation is complete enough for product use
2. API/UI/CLI/docs behavior is aligned
3. release verification exists for the affected path
4. the item no longer creates operator confusion
