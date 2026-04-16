# Release v0.2.17

## Scope

This release closes the current Streamable HTTP regression loop and aligns the release baseline around multi-session reliability, smoke-test coverage, and operator documentation.

## Core Changes

- fixed Streamable HTTP startup paths that still reused a singleton `McpServer` in some CLI and interactive entry paths
- enabled safe per-session server creation for concurrent Streamable HTTP sessions
- added product smoke coverage for:
  - CLI entry availability
  - OpenAPI to MCP tool conversion baseline
  - Streamable HTTP multi-session regression
- aligned the active setup and release documents to the current multi-session product baseline

## Operator Impact

### Streamable HTTP

- more than one MCP client session can now connect to the same Streamable HTTP server process
- opening a second client window should no longer trigger the fatal single-session error
- `/mcp` remains an MCP protocol endpoint rather than a browser page

### Validation Commands

Use these commands from repository root:

```bash
pnpm --filter mcp-swagger-server run test:cli
pnpm --filter mcp-swagger-server run test:smoke
pnpm --filter mcp-swagger-server run test:streamable-session
pnpm --filter mcp-swagger-server run test
```

## Verified In This Release

- `pnpm --filter mcp-swagger-server run type-check`
- `pnpm --filter mcp-swagger-server run build`
- `pnpm --filter mcp-swagger-server run test:cli`
- `pnpm --filter mcp-swagger-server run test:smoke`
- `pnpm --filter mcp-swagger-server run test:streamable-session`
- `pnpm --filter mcp-swagger-server run test`

## Residual Risks

The current release confirms multi-session Streamable behavior at the package smoke-test level, but the following should still be treated as later follow-up work:

- broader end-to-end client interoperability testing across more MCP desktop clients
- CI integration for the smoke scripts so the regression gate is automatic rather than local-only
- continued reduction of UI build warnings unrelated to this release scope

## Related Guides

- [Local Setup And Run](./local-setup-and-run.md)
- [Release Readiness Checklist](./release-readiness-checklist.md)
- [GitHub Collaboration Workflow](./github-collaboration-workflow.md)
