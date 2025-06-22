# MCP Swagger Server

> 🚀 Transform any OpenAPI/Swagger specification into MCP (Model Context Protocol) format, enabling AI assistants to seamlessly interact with REST APIs.

[![NPM Version](https://img.shields.io/npm/v/mcp-swagger-server.svg)](https://www.npmjs.com/package/mcp-swagger-server)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🎯 What is MCP Swagger Server?

MCP Swagger Server is a powerful CLI tool and library that converts OpenAPI/Swagger specifications into Model Context Protocol (MCP) format. This enables AI assistants like Claude, ChatGPT, and others to understand and interact with REST APIs through a standardized protocol.

## ⚡ Quick Start

### Global Installation

```bash
npm install -g mcp-swagger-server
```

### Basic Usage

```bash
# Start a streamable MCP server from GitHub API
mcp-swagger-server --transport streamable --port 3322 --openapi https://api.github.com/openapi.json

# Start in STDIO mode (perfect for AI clients)
mcp-swagger-server --transport stdio --openapi https://petstore.swagger.io/v2/swagger.json

# Monitor local OpenAPI file changes
mcp-swagger-server --transport http --openapi ./my-api.yaml --watch
```

## 🔧 Command Line Options

```bash
Usage: mcp-swagger-server [options]

Options:
  -t, --transport <type>     Transport protocol (stdio|http|sse|streamable) [default: stdio]
  -p, --port <port>          Server port [default: 3322]
  -e, --endpoint <url>       Custom endpoint URL
  -o, --openapi <source>     OpenAPI specification source (URL or file path)
  -w, --watch               Watch OpenAPI file changes and auto-reload
  -m, --managed             Managed mode (process management)
      --auto-restart        Auto-restart on failure
      --max-retries <num>   Max retry attempts [default: 5]
      --retry-delay <ms>    Retry delay in milliseconds [default: 5000]
  -h, --help                Show help information
```

## 🌟 Key Features

- **🔄 Zero Configuration**: Paste your OpenAPI spec URL and get MCP tools instantly
- **🚀 Multiple Transport Protocols**: HTTP, WebSocket, SSE, and STDIO support
- **👁️ File Watching**: Automatic reload when OpenAPI specifications change
- **🔧 Process Management**: Built-in auto-restart and error recovery
- **🎯 AI-Native**: Designed specifically for AI assistant integration
- **📡 Remote & Local**: Supports both URL and local file OpenAPI sources

## 🔌 Integration Examples

### Claude Desktop Integration

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "swagger-api": {
      "command": "mcp-swagger-server",
      "args": [
        "--transport", "stdio",
        "--openapi", "https://api.github.com/openapi.json"
      ]
    }
  }
}
```

### Programmatic Usage

```javascript
const { createMcpServer, runStreamableServer } = require('mcp-swagger-server');

async function startServer() {
  const server = await createMcpServer('https://api.github.com/openapi.json');
  await runStreamableServer(server, { port: 3322 });
  console.log('🚀 MCP Server running on port 3322');
}

startServer();
```

## 🎯 Use Cases

### AI Assistant API Integration
Enable your AI assistant to interact with internal APIs:
```bash
mcp-swagger-server --transport stdio --openapi https://internal-api.company.com/openapi.json
```

### API Development & Testing
Quick API testing and validation:
```bash
mcp-swagger-server --transport http --openapi ./dev-api.yaml --watch
```

### Microservices Integration
Connect multiple services through MCP:
```bash
# Service A
mcp-swagger-server --transport streamable --port 3001 --openapi https://service-a.com/openapi.json

# Service B
mcp-swagger-server --transport streamable --port 3002 --openapi https://service-b.com/openapi.json
```

## 📊 Supported Transport Protocols

| Protocol | Description | Best For |
|----------|-------------|----------|
| `stdio` | Standard Input/Output | AI clients (Claude, ChatGPT) |
| `streamable` | WebSocket-like streaming | Real-time applications |
| `http` | HTTP REST endpoints | Web applications |
| `sse` | Server-Sent Events | Web frontends |

## 🌍 Environment Variables

```bash
# Set default configuration
export MCP_PORT=3322
export MCP_TRANSPORT=streamable
export MCP_OPENAPI_URL=https://api.github.com/openapi.json
export MCP_AUTO_RELOAD=true

# Run with defaults
mcp-swagger-server
```

## 🔧 Development

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-swagger-server.git

# Install dependencies
cd mcp-swagger-server
pnpm install

# Build the project
pnpm run build

# Run development server
pnpm run dev
```

## 🚨 Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Check port usage
netstat -an | grep :3322

# Use different port
mcp-swagger-server --port 3323
```

**OpenAPI parsing errors:**
```bash
# Validate OpenAPI spec
curl -I https://api.github.com/openapi.json

# Check verbose output
mcp-swagger-server --openapi ./api.yaml --verbose
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🔗 Links

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [GitHub Issues](https://github.com/yourusername/mcp-swagger-server/issues)

---

<div align="center">
Made with ❤️ for the AI and API community
</div>
