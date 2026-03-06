# MCP Swagger Server 🚀

<div align="center">

[![NPM Version](https://img.shields.io/npm/v/mcp-swagger-server.svg)](https://www.npmjs.com/package/mcp-swagger-server)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
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
- **🔌 Multi-Transport**: Supports SSE, Streamable, and Stdio transport protocols
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

#### 1. Command Line Launch (recommended: `mss`)

```bash
# Interactive mode (no arguments)
mss

# One-shot startup (with arguments)
mss --openapi https://petstore3.swagger.io/api/v3/openapi.json --transport streamable --port 3322

# Using GitHub API (if available)
mss --openapi https://api.github.com/openapi.json --transport sse --port 3323

# Using local OpenAPI file
mss --openapi ./api-spec.json --transport stdio

# Compatible aliases (equivalent)
mcp-swagger-server --openapi ./api-spec.json --transport stdio
```

#### 2. MCP Client Configuration

Add to your MCP client configuration file:

```json
{
  "mcpServers": {
    "swagger-api": {
      "command": "mss",
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
import { runStreamableServer } from 'mcp-swagger-server';
import axios from 'axios';

const { data: openApiData } = await axios.get(
  'https://petstore3.swagger.io/api/v3/openapi.json'
);

await runStreamableServer('/mcp', 3322, openApiData);
```

## 🛠️ Main Features

### 📋 Supported OpenAPI Formats

- **OpenAPI 3.x**: Fully supported ✅
- **Swagger 2.0**: Auto-converted to OpenAPI 3.x on startup (including `host/basePath`) ✅
- **Multiple Inputs**: JSON, YAML, URL, local files
- **Real-time Updates**: Support for `--watch` mode auto-reload

> **Note**: If your spec uses relative `servers.url` values (for example `/api/v3`), prefer loading the OpenAPI document from a remote URL, or set `--base-url` explicitly to keep the correct host and port.

### 🔌 Transport Protocol Support

| Protocol | Description | Use Case |
|----------|-------------|----------|
| `stdio` | Standard Input/Output | MCP client integration |
| `streamable` | Streamable HTTP (recommended) | Remote MCP / Web integration |
| `sse` | HTTP + Server-Sent Events (legacy) | Legacy client compatibility |

### 🎛️ Common CLI Options

```bash
mss [options]

Options:
  --openapi <url|file>    OpenAPI specification URL or file path (required)
  --transport <type>      Transport type: stdio|streamable|sse (default: stdio)
  --port <number>         Server port (default: 3322)
  --host <string>         Server host (default: 127.0.0.1)
  --base-url <url>        Override API base URL (highest priority)
  --config <file>         JSON config file
  --env <file>            .env file
  --auth-type <type>      Auth type: none|bearer
  --bearer-token <token>  Bearer token static value
  --bearer-env <varname>  Bearer token environment variable name
  --watch                 Watch for file changes and auto-reload
  --debug-headers         Print final request headers for debugging
  --allowed-host <host>   Allowed Host header (repeatable)
  --allowed-origin <url>  Allowed Origin header (repeatable)
  --disable-dns-rebinding-protection  Disable Host/Origin header protection
  --help                  Show help information
```

## 📚 Usage Examples

### 🐙 Swagger Petstore API Integration

```bash
# Start Swagger Petstore API MCP server
mss \
  --openapi https://petstore3.swagger.io/api/v3/openapi.json \
  --transport streamable \
  --port 3322
```

After conversion, AI assistants can call various Petstore API functions, such as:
- Manage pet information (add, update, delete)
- Query pet status and tags
- Handle pet store orders
- Manage user accounts

### 🏪 E-commerce API Integration

```bash
# Start e-commerce API MCP server
mss \
  --openapi https://your-ecommerce-api.com/openapi.json \
  --transport sse \
  --port 3323
```

### 📊 Data Analytics API

```bash
# Start data analytics API MCP server
mss \
  --openapi ./analytics-api-spec.yaml \
  --transport stdio \
  --watch
```

## 🔧 Advanced Configuration

### Environment Variables

```bash
# Set default OpenAPI specification
export MCP_OPENAPI_URL="https://api.example.com/openapi.json"

# Set default transport type
export MCP_TRANSPORT="streamable"

# Set default port
export MCP_PORT="3322"

# Optional: set default base URL override
export MCP_BASE_URL="https://api.example.com/v1"

# Optional: bearer token
export API_TOKEN="your-token-here"
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
    ├── Streamable HTTP (recommended)
    └── SSE (legacy compatibility)
```

## 🔍 Troubleshooting

### Common Issues

#### ❌ Request URL loses the original port (for example `http://localhost/...`)

**Problem**: This usually happens when `servers.url` in the OpenAPI document is relative (for example `/v1`).

```bash
# Example: source URL has a port but servers uses a relative URL
mss --openapi http://localhost:65531/openapi.json
# servers: [{ "url": "/v1" }]
```

**Solutions**:

1. **Prefer loading OpenAPI from a remote URL** so the origin can be inferred automatically.

2. **Set `--base-url` explicitly**:
   ```bash
   mss --openapi ./openapi.json --base-url http://localhost:65531/v1
   ```

3. **Use absolute `servers.url` in your spec**:
   ```json
   {
     "servers": [{ "url": "http://localhost:65531/v1" }]
   }
   ```

#### ⚙️ Swagger 2.0 compatibility

Swagger 2.0 specs are auto-converted to OpenAPI 3.x by default (including mapping `host/basePath` to `servers`).

If conversion fails, manually convert first:

```bash
npm install -g swagger2openapi
swagger2openapi https://petstore.swagger.io/v2/swagger.json -o petstore-openapi3.json
mss --openapi ./petstore-openapi3.json
```

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

# Force a base URL override for verification
mss --openapi https://your-api.com/openapi.json --base-url https://your-api.com
```

### 📋 OpenAPI Specification Requirements

- **Required Fields**: `openapi` (3.x) or `swagger` (2.0)
- **Recommended Versions**: OpenAPI 3.0.x / 3.1.x, or Swagger 2.0
- **File Formats**: JSON or YAML
- **Encoding**: UTF-8

## 📖 Best Practices

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
mss --openapi https://petstore3.swagger.io/api/v3/openapi.json --transport streamable --port 3322
```

Then visit `http://localhost:3322` to see the generated MCP tools!

---

<div align="center">

**Made with ❤️ by the MCP Community**

[⭐ Star on GitHub](https://github.com/zaizaizhao/mcp-swagger-server) • [📦 NPM Package](https://www.npmjs.com/package/mcp-swagger-server)

</div>
