# mcp-swagger-server

## 1.7.1

### Patch Changes

- add smoke coverage for CLI availability, MCP tool conversion baseline, and Streamable HTTP multi-session behavior
- fix Streamable HTTP runtime paths so multiple sessions can coexist in the same server process
- align operator and release documentation with the current multi-session Streamable baseline

## 1.7.0

### Minor Changes

- Mcp版本升级，修复可能的安全问题，以及多客户端连接问题，base url指向问题，代码重构

### Patch Changes

- Updated dependencies []:
  - mcp-swagger-parser@1.7.0

## 1.6.0

### Minor Changes

- "渐进式 cli 实现"

### Patch Changes

- Updated dependencies []:
  - mcp-swagger-parser@1.6.0

## 1.5.0

### Minor Changes

- add Operation filtering options,make system more safe for mcp use

### Patch Changes

- Updated dependencies []:
  - mcp-swagger-parser@1.5.0

## 1.4.0

### Minor Changes

- "解决 mcp 调用不准确问题"

### Patch Changes

- Updated dependencies []:
  - mcp-swagger-parser@1.4.0

## 1.3.0

### Minor Changes

- "add custom http headers"

### Patch Changes

- Updated dependencies []:
  - mcp-swagger-parser@1.3.0

## 1.2.2

### Patch Changes

- "Workspace error"

- Updated dependencies []:
  - mcp-swagger-parser@1.2.2

## 1.2.1

### Patch Changes

- "workspace"

- Updated dependencies []:
  - mcp-swagger-parser@1.2.1

## 1.2.0

### Minor Changes

- "workspace"

### Patch Changes

- Updated dependencies []:
  - mcp-swagger-parser@1.2.0

## 1.1.1

### Patch Changes

- workspace error

- Updated dependencies []:
  - mcp-swagger-parser@1.1.1

## 1.1.0

### Minor Changes

- Add Bearer token authentication support and improve OpenAPI 3.0 compatibility

  This change includes:
  - New Bearer token authentication middleware
  - Enhanced OpenAPI 3.0 specification parsing
  - Better error handling for malformed swagger files
  - Updated TypeScript definitions for better type safety

- add jwt token

### Patch Changes

- Updated dependencies []:
  - mcp-swagger-parser@1.1.0
