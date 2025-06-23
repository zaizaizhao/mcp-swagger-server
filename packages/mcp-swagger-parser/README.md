# mcp-swagger-parser

> OpenAPI/Swagger specification parser for MCP projects

## 🎯 Overview

A TypeScript library for parsing, validating, and extracting information from OpenAPI/Swagger specifications. This library is designed to be the foundation for the MCP Swagger Server ecosystem.

## ✨ Features

- 📝 **Multi-format support**: JSON, YAML, URL, and file inputs
- 🔍 **Comprehensive validation**: OpenAPI 2.0 and 3.x specification validation
- 🛠️ **Information extraction**: Endpoints, schemas, security schemes, and metadata
- 🎯 **Type-safe**: Full TypeScript support with comprehensive type definitions
- ⚡ **Performance optimized**: Efficient parsing and processing
- 🧪 **Well-tested**: High test coverage with unit and integration tests

## 📦 Installation

```bash
npm install mcp-swagger-parser
```

## 🚀 Quick Start

```typescript
import { OpenApiParser } from 'mcp-swagger-parser';

const parser = new OpenApiParser();

// Parse from URL
const spec = await parser.parseFromUrl('https://petstore.swagger.io/v2/swagger.json');

// Parse from file
const spec = await parser.parseFromFile('./api.yaml');

// Parse from text
const spec = await parser.parseFromText(yamlContent, 'yaml');

// Extract information
console.log('API Info:', spec.info);
console.log('Endpoints:', spec.metadata.endpointCount);
```

## 📚 Documentation

- [API Reference](./docs/API.md) - Complete API documentation
- [Examples](./docs/examples/) - Usage examples and tutorials
- [Migration Guide](./docs/migration.md) - Migration from other parsers

## 🤝 Contributing

This package is part of the MCP Swagger Server monorepo. Please see the [main repository](../../README.md) for contribution guidelines.

## 📄 License

MIT License - see [LICENSE](../../LICENSE) for details.

## 🔗 Related Packages

- [@mcp-swagger/server](../mcp-swagger-server/) - MCP protocol server
- [@mcp-swagger/ui](../mcp-swagger-ui/) - Web interface

---

**Status**: 🚧 In Development | Part of MCP Swagger Server v1.0.0
