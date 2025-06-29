# MCP Swagger Server 🚀

<div align="center">

[![NPM Version](https://img.shields.io/npm/v/mcp-swagger-server.svg)](https://www.npmjs.com/package/mcp-swagger-server)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**A powerful server that transforms any OpenAPI/Swagger specification into Model Context Protocol (MCP) tools**

Zero-configuration conversion of your REST APIs into AI-callable MCP tools

[📖 中文文档](README.md) • [🔗 GitHub Repository](https://github.com/zaizaizhao/mcp-swagger-server)

</div>

---

## 🎯 What is MCP Swagger Server?

MCP Swagger Server is a tool designed for the AI era that automatically converts any OpenAPI/Swagger-compliant REST API into Model Context Protocol (MCP) format, enabling AI assistants to understand and invoke your APIs.

### 🌟 Key Features

- **🔄 Zero Configuration**: Provide an OpenAPI spec URL or file and get usable MCP tools instantly
- **🎯 AI-Native Design**: Optimized for large language models like Claude and ChatGPT
- **🚀 Ready to Use**: Supports command line, programmatic interface, and MCP client integration
- **🔌 Multi-Transport**: Supports HTTP, WebSocket, SSE, and Stdio transport protocols
- **⚡ High Performance**: Built with TypeScript for complete type safety

## 🚀 Quick Start

### 📦 Installation

```bash
# Using npm
npm install -g mcp-swagger-server

# Using yarn
yarn global add mcp-swagger-server

# Using pnpm
pnpm add -g mcp-swagger-server
```

### ⚡ Immediate Usage

#### 1. Command Line Launch

```bash
# Using Swagger Petstore API (recommended for testing, OpenAPI 3.0)
mcp-swagger-server --openapi https://petstore3.swagger.io/api/v3/openapi.json --transport streamable --port 3322

# Using GitHub API (if available)
mcp-swagger-server --openapi https://api.github.com/openapi.json --transport sse --port 3323

# Using local OpenAPI file
mcp-swagger-server --openapi ./api-spec.json --transport stdio
```

#### 2. MCP Client Configuration

Add to your MCP client configuration file:

```json
{
  "mcpServers": {
    "swagger-api": {
      "command": "mcp-swagger-server",
      "args": [
        "--openapi",
        "https://petstore3.swagger.io/api/v3/openapi.json",
        "--transport",
        "stdio"
      ]
    }
  }
}
```

#### 3. Programmatic Usage

```javascript
import { createMcpServer } from 'mcp-swagger-server';

const server = await createMcpServer({
  openapi: 'https://petstore3.swagger.io/api/v3/openapi.json',
  transport: 'streamable',
  port: 3322
});

await server.start();
```

## 🛠️ Main Features

### 📋 Supported OpenAPI Formats

- **OpenAPI 3.x**: Full support for the latest specification ✅
- **Swagger 2.0**: Requires conversion to OpenAPI 3.x format first ⚠️
- **Multiple Inputs**: JSON, YAML, URL, local files
- **Real-time Updates**: Support for `--watch` mode auto-reload

> **⚠️ Important Notice**: This tool currently primarily supports OpenAPI 3.x specifications. If your API uses Swagger 2.0 format, it's recommended to first convert it to OpenAPI 3.x format using [Swagger Editor](https://editor.swagger.io/) or [swagger2openapi](https://www.npmjs.com/package/swagger2openapi) tool.

### 🔌 Transport Protocol Support

| Protocol | Description | Use Case |
|----------|-------------|----------|
| `stdio` | Standard Input/Output | MCP client integration |
| `streamable` | WebSocket streaming | Real-time interactive applications |
| `sse` | Server-Sent Events | Web application integration |
| `http` | HTTP REST API | Traditional web services |

### 🎛️ Command Line Options

```bash
mcp-swagger-server [options]

Options:
  --openapi <url|file>    OpenAPI specification URL or file path (required)
  --transport <type>      Transport type: stdio|streamable|sse|http (default: stdio)
  --port <number>         Server port (default: 3322)
  --host <string>         Server host (default: localhost)
  --watch                 Watch for file changes and auto-reload
  --verbose               Show verbose logging
  --help                  Show help information
```

## 📚 Usage Examples

### � Swagger Petstore API Integration

```bash
# Start Swagger Petstore API MCP server
mcp-swagger-server \
  --openapi https://petstore3.swagger.io/api/v3/openapi.json \
  --transport streamable \
  --port 3322 \
  --verbose
```

After conversion, AI assistants can call various Petstore API functions, such as:
- Manage pet information (add, update, delete)
- Query pet status and tags
- Handle pet store orders
- Manage user accounts

### 🏪 E-commerce API Integration

```bash
# Start e-commerce API MCP server
mcp-swagger-server \
  --openapi https://your-ecommerce-api.com/openapi.json \
  --transport sse \
  --port 3323
```

### 📊 Data Analytics API

```bash
# Start data analytics API MCP server
mcp-swagger-server \
  --openapi ./analytics-api-spec.yaml \
  --transport stdio \
  --watch
```

## 🔧 Advanced Configuration

### Environment Variables

```bash
# Set default OpenAPI specification
export MCP_SWAGGER_OPENAPI_URL="https://api.example.com/openapi.json"

# Set default transport type
export MCP_SWAGGER_TRANSPORT="streamable"

# Set default port
export MCP_SWAGGER_PORT="3322"
```

### Configuration File

Create `mcp-swagger.config.json`:

```json
{
  "openapi": "https://api.example.com/openapi.json",
  "transport": "streamable",
  "port": 3322,
  "cors": true,
  "rateLimit": {
    "max": 100,
    "windowMs": 900000
  },
  "auth": {
    "apiKey": "your-api-key"
  }
}
```

## 🏗️ Architecture Design

```
MCP Swagger Server
├── 📥 Input Layer
│   ├── OpenAPI/Swagger specification parsing
│   ├── Format validation and normalization
│   └── Real-time file monitoring
├── 🔄 Transformation Layer
│   ├── OpenAPI → MCP tool mapping
│   ├── Parameter type conversion
│   └── Response format adaptation
├── 🚀 MCP Protocol Layer
│   ├── Tool registration and discovery
│   ├── Request routing and execution
│   └── Error handling and logging
└── 🔌 Transport Layer
    ├── Stdio (MCP standard)
    ├── WebSocket (real-time communication)
    ├── SSE (server push)
    └── HTTP (REST API)
```

## � Troubleshooting

### Common Issues

#### ❌ "Missing required field: openapi" Error

**Problem**: This error occurs when trying to use Swagger 2.0 specifications.

```bash
# ❌ Error example - Swagger 2.0 format
npx mcp-swagger-server --openapi https://petstore.swagger.io/v2/swagger.json

# Error message: OpenAPIParseError: Missing required field: openapi
```

**Solutions**:

1. **Use OpenAPI 3.x specifications**:
   ```bash
   # ✅ Correct example - OpenAPI 3.x format
   npx mcp-swagger-server --openapi https://petstore3.swagger.io/api/v3/openapi.json
   ```

2. **Convert Swagger 2.0 to OpenAPI 3.x**:
   ```bash
   # Install conversion tool
   npm install -g swagger2openapi
   
   # Convert Swagger 2.0 to OpenAPI 3.x
   swagger2openapi https://petstore.swagger.io/v2/swagger.json -o petstore-openapi3.json
   
   # Use the converted file
   npx mcp-swagger-server --openapi ./petstore-openapi3.json
   ```

3. **Online conversion**:
   - Visit [Swagger Editor](https://editor.swagger.io/)
   - Import your Swagger 2.0 specification
   - Use "Edit" > "Convert to OpenAPI 3" feature
   - Export the converted OpenAPI 3.x file

#### 🔗 Verify API Specification Version

```bash
# Check API specification version
curl -s https://your-api.com/swagger.json | jq '.swagger // .openapi'

# Swagger 2.0 returns: "2.0"
# OpenAPI 3.x returns: "3.0.0" or "3.1.0"
```

#### 🌐 Network Connection Issues

```bash
# Test API accessibility
curl -I https://your-api.com/openapi.json

# Use verbose logging mode
npx mcp-swagger-server --openapi https://your-api.com/openapi.json --verbose
```

### 📋 OpenAPI Specification Requirements

- **Required Fields**: `openapi` (version number, e.g., "3.0.0")
- **Recommended Versions**: OpenAPI 3.0.x or 3.1.x
- **File Formats**: JSON or YAML
- **Encoding**: UTF-8

## �📖 Best Practices

### 🔒 Security Recommendations

1. **API Key Management**: Use environment variables to store sensitive information
2. **CORS Configuration**: Properly configure cross-origin policies in production
3. **Rate Limiting**: Enable request frequency limiting to prevent abuse
4. **HTTPS**: Use HTTPS transport in production environments

### ⚡ Performance Optimization

1. **Caching**: Enable OpenAPI specification caching
2. **Connection Pooling**: Properly configure HTTP connection pool size
3. **Monitoring**: Enable performance monitoring and logging

## 🤝 Community & Support

- **🐛 Bug Reports**: [GitHub Issues](https://github.com/zaizaizhao/mcp-swagger-server/issues)
- **💡 Feature Requests**: [GitHub Discussions](https://github.com/zaizaizhao/mcp-swagger-server/discussions)
- **📖 Full Documentation**: [Project Wiki](https://github.com/zaizaizhao/mcp-swagger-server/wiki)
- **🔗 Project Homepage**: [GitHub Repository](https://github.com/zaizaizhao/mcp-swagger-server)

## 📝 License

This project is open-sourced under the [MIT License](LICENSE). Feel free to use and contribute.

## 🚀 Quick Experience

Want to experience MCP Swagger Server immediately? Try this one-click launch command:

```bash
npx mcp-swagger-server --openapi https://petstore3.swagger.io/api/v3/openapi.json --transport streamable --port 3322 --verbose
```

Then visit `http://localhost:3322` to see the generated MCP tools!

---

<div align="center">

**Made with ❤️ by the MCP Community**

[⭐ Star on GitHub](https://github.com/zaizaizhao/mcp-swagger-server) • [📦 NPM Package](https://www.npmjs.com/package/mcp-swagger-server)

</div>
