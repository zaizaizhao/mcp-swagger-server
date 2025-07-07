# MCP Swagger Server 🚀

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Convert OpenAPI/Swagger specifications to Model Context Protocol (MCP) format server**

Transform your REST APIs into AI-callable tools with zero configuration

[🚀 Quick Start](#quick-start) • [📖 Usage Guide](#usage-guide) • [🛠️ Development](#development)

</div>

---

## 🎯 Project Overview

MCP Swagger Server is a **Monorepo** project that converts any OpenAPI/Swagger-compliant REST API into Model Context Protocol (MCP) format, enabling AI assistants to understand and call your APIs.

### 📦 Project Structure

```
mcp-swagger-server/
├── packages/
│   ├── mcp-swagger-server/     # 🔧 Core MCP Server (Available)
│   ├── mcp-swagger-parser/     # 📝 OpenAPI Parser (In Development)
│   ├── mcp-swagger-ui/         # � Web Interface (In Development)
│   └── mcp-swagger-api/        # 🔗 REST API Backend (In Development)
└── scripts/                    # 🔨 Build Tools
```

### ✨ Core Features

- **🔄 Zero Configuration**: Input OpenAPI spec, get MCP tools instantly
- **🎯 AI-Native Design**: Optimized for Claude, ChatGPT, and other AI assistants
- **🔌 Multi-Transport**: Support for SSE, Streamable, and Stdio transports
- **� Secure Authentication**: Bearer Token authentication to protect API access
- **⚡ High Performance**: Built with TypeScript for complete type safety

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 16.0.0
- pnpm ≥ 8.0.0 (recommended)

### Installation

```bash
# Clone the project
git clone https://github.com/zaizaizhao/mcp-swagger-server.git
cd mcp-swagger-server

# Install dependencies
pnpm install

# Build the project
pnpm build
```

### Quick Launch

```bash
# Navigate to MCP server package
cd packages/mcp-swagger-server

# Start with Petstore API example
pnpm cli:petstore

# Or start with GitHub API example
pnpm cli:github
```

## � Usage Guide

### 🔧 `mcp-swagger-server` Package

This is the core package of the project, providing complete MCP server functionality.

#### Installation and Usage

```bash
# Global installation
npm install -g mcp-swagger-server

# Command line usage
mcp-swagger-server --openapi https://petstore.swagger.io/v2/swagger.json --transport streamable --port 3322
```

#### Supported Transport Protocols

- **stdio**: For command-line integration
- **sse**: Server-Sent Events, suitable for web applications
- **streamable**: HTTP streaming transport, suitable for modern web applications

#### Command Line Options

```bash
# Basic usage
mcp-swagger-server [options]

# Options:
--openapi, -o       OpenAPI specification URL or file path
--transport, -t     Transport protocol (stdio|sse|streamable)
--port, -p          Port number
--watch, -w         Monitor file changes
--verbose           Verbose logging

# Bearer Token authentication options:
--auth-type         Authentication type (bearer)
--bearer-token      Directly specify Bearer Token
--bearer-env        Read token from environment variable
--config, -c        Configuration file path
```

#### Examples

```bash
# Use local OpenAPI file
mcp-swagger-server --openapi ./swagger.json --transport sse --port 3322

# Use remote OpenAPI URL
mcp-swagger-server --openapi https://api.example.com/openapi.json --transport streamable --port 3323

# Monitor file changes
mcp-swagger-server --openapi ./api.yaml --transport stdio --watch

# Use Bearer Token authentication
mcp-swagger-server --openapi https://api.example.com/openapi.json --auth-type bearer --bearer-token "your-token-here" --transport sse --port 3322

# Read token from environment variable
export API_TOKEN="your-token-here"
mcp-swagger-server --openapi https://api.example.com/openapi.json --auth-type bearer --bearer-env API_TOKEN --transport stdio
```

### 🔐 Bearer Token Authentication

`mcp-swagger-server` supports Bearer Token authentication to protect API access that requires authentication.

#### Authentication Methods

**1. Direct Token Specification**
```bash
mcp-swagger-server --auth-type bearer --bearer-token "your-token-here" --openapi https://api.example.com/openapi.json
```

**2. Environment Variable Method**
```bash
# Set environment variable
export API_TOKEN="your-token-here"

# Use environment variable
mcp-swagger-server --auth-type bearer --bearer-env API_TOKEN --openapi https://api.example.com/openapi.json
```

**3. Configuration File Method**
```json
{
  "transport": "sse",
  "port": 3322,
  "openapi": "https://api.example.com/openapi.json",
  "auth": {
    "type": "bearer",
    "bearer": {
      "token": "your-token-here",
      "source": "static"
    }
  }
}
```

```bash
# Use configuration file
mcp-swagger-server --config config.json
```

#### Environment Variable Configuration

Create a `.env` file:
```env
# Basic configuration
MCP_PORT=3322
MCP_TRANSPORT=stdio
MCP_OPENAPI_URL=https://api.example.com/openapi.json

# Authentication configuration
MCP_AUTH_TYPE=bearer
API_TOKEN=your-bearer-token-here
```

### 🤖 AI Assistant Integration

#### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "swagger-converter": {
      "command": "mcp-swagger-server",
      "args": [
        "--openapi", "https://petstore.swagger.io/v2/swagger.json",
        "--transport", "stdio"
      ]
    },
    "secured-api": {
      "command": "mcp-swagger-server",
      "args": [
        "--openapi", "https://api.example.com/openapi.json",
        "--transport", "stdio",
        "--auth-type", "bearer",
        "--bearer-env", "API_TOKEN"
      ],
      "env": {
        "API_TOKEN": "your-bearer-token-here"
      }
    }
  }
}
```

#### Programmatic Usage

```typescript
import { createMcpServer } from 'mcp-swagger-server';

// Basic usage
const server = await createMcpServer({
  openapi: 'https://api.example.com/openapi.json',
  transport: 'streamable',
  port: 3322
});

// With Bearer Token authentication
const securedServer = await createMcpServer({
  openapi: 'https://api.example.com/openapi.json',
  transport: 'streamable',
  port: 3322,
  auth: {
    type: 'bearer',
    bearer: {
      token: 'your-token-here',
      source: 'static'
    }
  }
});

await server.start();
```

## �️ Development

### Build System

```bash
# Build all packages
pnpm build

# Build only backend packages
pnpm build:packages

# Development mode
pnpm dev

# Clean build artifacts
pnpm clean
```

### Testing and Debugging

```bash
# Run tests
pnpm test

# Code linting
pnpm lint

# Type checking
pnpm type-check

# Project health check
pnpm diagnostic
```

### MCP Server Development

```bash
cd packages/mcp-swagger-server

# Development mode startup
pnpm dev

# Run CLI tools
pnpm cli --help

# Debug with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

## � Project Status

| Package | Status | Description |
|---------|--------|-------------|
| `mcp-swagger-server` | ✅ Available | Core MCP server with multi-transport support |
| `mcp-swagger-parser` | � In Development | OpenAPI parser and conversion tools |
| `mcp-swagger-ui` | � In Development | Vue.js web interface |
| `mcp-swagger-api` | 🚧 In Development | NestJS REST API backend |

## 🤝 Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) first.

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ by ZhaoYaNan(ZTE)**

[⭐ Star](../../stargazers) • [🐛 Issues](../../issues) • [💬 Discussions](../../discussions)

</div>
