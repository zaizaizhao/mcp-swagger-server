# MCP Swagger API 🚀

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10+-red.svg)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Enterprise-grade REST API server for seamless OpenAPI to MCP protocol conversion**

Transform your existing REST APIs into Model Context Protocol (MCP) tools with zero configuration

[🚀 Quick Start](#quick-start) • [📚 Documentation](#documentation) • [🔧 API Reference](#api-reference) • [🛠️ Development](#development)

</div>

---

## 🎯 What is MCP Swagger API?

MCP Swagger API is a **NestJS-powered backend service** that bridges the gap between traditional REST APIs and AI assistants through the Model Context Protocol (MCP). It automatically converts OpenAPI/Swagger specifications into MCP-compatible tools, enabling AI assistants to interact with your APIs seamlessly.

### 🌟 Key Benefits

- **🔄 Zero Configuration**: Paste your OpenAPI spec and get MCP tools instantly
- **🎯 AI-Native**: Purpose-built for LLM and AI assistant integration  
- **🚀 Production Ready**: Enterprise-grade NestJS foundation with monitoring
- **🔌 Multi-Transport Management**: HTTP API + managed MCP transports (`streamable`, `sse`; `websocket` planned)
- **📊 Real-time**: Live status monitoring and dynamic tool management

## ✨ Core Features

### 🎨 Intelligent API Conversion
- **Multi-format Input**: JSON, YAML, URL, or raw objects
- **Smart Parsing**: Auto-detection of OpenAPI 2.0/3.x specifications  
- **Dynamic Tools**: Real-time MCP tool generation from API endpoints
- **Type Safety**: Full TypeScript support with automatic type inference

### ⚡ Enterprise-Grade Architecture
- **NestJS Foundation**: Modular, scalable, and maintainable codebase
- **Built-in Security**: CORS, Helmet, compression, and rate limiting
- **Health Monitoring**: Comprehensive status checks and diagnostics
- **Event System**: Real-time updates and notifications

### 🔌 Flexible Integration
- **Embedded MCP Server**: No external dependencies required
- **Multiple Transports**: HTTP API with MCP `streamable` / `sse` transports (`websocket` is not yet implemented)
- **RESTful API**: Clean, documented endpoints for easy integration
- **Swagger Documentation**: Auto-generated API documentation

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18.0.0
- pnpm ≥ 8.0.0 (recommended)

Environment bootstrap (from repository root):

```bash
node -v
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
pnpm install
```

Detailed setup baseline:

- [Local Setup And Run](../../docs/guides/local-setup-and-run.md)

### Installation & Setup

```bash
# Install dependencies
pnpm install

# Start development server
pnpm start:dev

# Build for production
pnpm build
```

The API server will be available at `http://localhost:3001`

### 🎯 Basic Usage

**Create an MCP Server from OpenAPI:**

```bash
curl -X POST http://localhost:3001/api/openapi/parse \
  -H "Content-Type: application/json" \
  -d '{
    "source": {
      "type": "url",
      "content": "https://petstore.swagger.io/v2/swagger.json"
    }
  }'
```

**Check Server Status:**

```bash
curl http://localhost:3001/health
```

## 🔧 API Reference

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/openapi/parse` | Parse and convert an OpenAPI spec into MCP-ready output |
| `POST` | `/api/openapi/validate` | Validate an OpenAPI specification |
| `POST` | `/api/openapi/normalize` | Normalize an OpenAPI or Swagger document |
| `GET` | `/health` | Health probe endpoint |
| `GET` | `/api/v1/servers` | List managed MCP servers |
| `POST` | `/api/v1/servers` | Create a managed MCP server instance |

### Configuration Options

```typescript
interface MCPServerConfig {
  name: string;           // Server identifier
  version: string;        // Server version
  description?: string;   // Optional description
  port: number;          // Port number (3000-65535)
  transport: 'streamable' | 'sse' | 'websocket'; // websocket is planned but not implemented yet
}
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Swagger API                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │   OpenAPI   │  │  NestJS API  │  │   MCP Server    │    │
│  │   Parser    │→ │  Controller  │→ │   Generator     │    │
│  └─────────────┘  └──────────────┘  └─────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │  Validation │  │   Security   │  │   Monitoring    │    │
│  │   Service   │  │  Middleware  │  │    Service      │    │
│  └─────────────┘  └──────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ Technology Stack

- **Framework**: NestJS 10+ (Node.js/TypeScript)
- **Protocol**: Model Context Protocol (MCP) 
- **Parser**: Custom OpenAPI 3.x parser with monorepo integration
- **Security**: Helmet, CORS, Rate Limiting, Input Validation
- **Documentation**: Swagger/OpenAPI auto-generation
- **Testing**: Jest with comprehensive test coverage
- **DevOps**: TypeScript, ESLint, Prettier

## 🌟 Use Cases

### 🤖 AI Assistant Integration
Connect your REST APIs to Claude, ChatGPT, or custom AI assistants through standardized MCP protocol.

### 🔄 API Modernization  
Transform legacy REST APIs into AI-friendly tools without changing existing infrastructure.

### 🎯 Rapid Prototyping
Quickly convert API specifications into interactive tools for testing and development.

### 📊 Enterprise Integration
Scale MCP tool generation across multiple APIs and services in enterprise environments.

## 🛠️ Development

### Project Structure
```
src/
├── modules/           # Feature modules
│   ├── mcp/          # MCP server management
│   └── openapi/      # OpenAPI parsing & validation
├── services/         # Business logic services  
├── controllers/      # REST API controllers
├── config/           # Configuration management
├── common/           # Shared utilities
└── types/            # TypeScript definitions
```

### Development Commands

```bash
# Start development server with hot reload
pnpm start:dev

# Run tests
pnpm test

# Run tests with coverage
pnpm test:cov

# Lint and format code
pnpm lint
pnpm format

# Build for production
pnpm build
```

## 📚 Documentation

- [📚 Project Documentation Index](../docs/README.md)
- [🏗️ Project Baseline](../PROJECT_BASELINE.md)
- [🚀 Release Baseline](../RELEASE_BASELINE_V1.md)
- [🔧 API Documentation](http://localhost:3001/api/docs) (when server is running)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) for the protocol specification
- [NestJS](https://nestjs.com/) for the fantastic framework
- [OpenAPI Initiative](https://www.openapis.org/) for API standardization

---

<div align="center">

**Made with ❤️ by the MCP Swagger Team**

[⭐ Star this repo](../../stargazers) • [🐛 Report issues](../../issues) • [💡 Request features](../../issues/new)

</div>
