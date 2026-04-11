# MCP Swagger Server

Convert OpenAPI / Swagger-described REST APIs into runnable MCP tools and servers.

**Languages**: English | [中文](./README.md)

## Current Positioning

The current repository priority is to converge on a basic usable, releasable version that can be connected to real LLM applications.

The main product chain is:

- OpenAPI/Swagger input
- parsing and normalization
- endpoint extraction and filtering
- MCP tool generation
- MCP runtime exposure
- API / UI management workflows

## Monorepo Structure

- `packages/mcp-swagger-parser`
  OpenAPI/Swagger parsing, validation, normalization, endpoint extraction
- `packages/mcp-swagger-server`
  MCP tool transformation and runtime with `stdio`, `sse`, and `streamable`
- `packages/mcp-swagger-api`
  management backend for orchestration, persistence, security, and operations
- `packages/mcp-swagger-ui`
  operator UI consuming backend contracts

## Recommended Current Usage

### 1. Connect directly as an MCP server for LLM applications

Install:

```bash
npm install -g mcp-swagger-server
```

Run in `stdio` mode:

```bash
mss --openapi https://petstore.swagger.io/v2/swagger.json --transport stdio
```

Example MCP client configuration:

```json
{
  "mcpServers": {
    "swagger-api": {
      "command": "mss",
      "args": [
        "--openapi",
        "https://petstore.swagger.io/v2/swagger.json",
        "--transport",
        "stdio"
      ]
    }
  }
}
```

### 2. Local development

Requirements:

- Node.js `>= 20`
- pnpm `>= 8`

Install dependencies:

```bash
pnpm install
```

Common commands:

```bash
pnpm build
pnpm dev
pnpm test
pnpm lint
pnpm type-check
```

## Auth and Filtering

The current main path supports:

- Bearer token authentication
- custom request headers
- endpoint filtering by method, path, `operationId`, status code, and parameters

Example:

```bash
mss \
  --openapi https://api.example.com/openapi.json \
  --transport streamable \
  --auth-type bearer \
  --bearer-env API_TOKEN \
  --operation-filter-methods GET \
  --operation-filter-methods POST
```

## Documentation Entry Points

Current active project governance and entry documents:

- [Product Constraints](./PRODUCT_CONSTRAINTS.md)
- [Project Baseline](./PROJECT_BASELINE.md)
- [Release Baseline](./RELEASE_BASELINE_V1.md)
- [Project Analysis and Plan](./PROJECT_ANALYSIS_AND_V1_PLAN.md)
- [Documentation Index](./docs/README.md)

The `docs/` directory is now organized as:

- `docs/guides`
  active setup, usage, deployment, auth, and troubleshooting docs
- `docs/reference`
  current release and protocol reference material
- `docs/archive`
  archived plans, summaries, old designs, and historical material

## Current Working Rules

- converge the releasable baseline before expanding features
- treat external design notes as reference, not direct implementation truth
- keep both Windows and Linux/Ubuntu supported
- keep CLI, API, UI, and docs aligned on main-path behavior

## License

MIT. See [LICENSE](./LICENSE).
