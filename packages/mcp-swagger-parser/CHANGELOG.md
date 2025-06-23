# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-06-23

### Added
- 🎉 Initial release of mcp-swagger-parser
- 📝 Multi-format OpenAPI/Swagger specification parsing (JSON, YAML, URL)
- 🔍 Comprehensive validation for OpenAPI 2.0 and 3.x specifications
- 🛠️ Information extraction capabilities (endpoints, schemas, security schemes)
- 🎯 Full TypeScript support with comprehensive type definitions
- ⚡ Performance-optimized parsing and processing
- 🏗️ Modular architecture with extensible plugin system
- 📊 Built-in normalization and transformation utilities
- 🔧 Error handling with detailed validation messages
- 📚 Complete API documentation and usage examples

### Features
- **Core Parser**: Robust OpenAPI specification parsing engine
- **Validators**: Schema validation and specification compliance checking
- **Extractors**: Endpoint, parameter, and metadata extraction utilities
- **Transformers**: Data transformation and normalization tools
- **Type System**: Comprehensive TypeScript type definitions
- **Error Handling**: Detailed error reporting and validation messages

### Technical Details
- Built with TypeScript 5.2+
- Supports Node.js 18.0.0+
- Zero runtime dependencies for core functionality
- Comprehensive test coverage
- ESLint and Prettier configured
- Rollup-based build system

### Dependencies
- @apidevtools/swagger-parser: ^10.1.0
- axios: ^1.6.0
- js-yaml: ^4.1.0
- zod: ^3.25.28
