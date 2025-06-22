# MCP Swagger Server Architecture

## 🏗️ Overview

MCP Swagger Server is designed as a modular, extensible system that transforms OpenAPI/Swagger specifications into Model Context Protocol (MCP) format. The architecture emphasizes separation of concerns, type safety, and multi-transport protocol support.

## 📦 Core Architecture

```
mcp-swagger-server/
├── src/
│   ├── cli.ts                 # 🎯 Main CLI entry point
│   ├── cli-enhanced.ts        # 🚀 Enhanced CLI with advanced features
│   ├── index.ts              # 📚 Library entry point & exports
│   ├── server.ts             # ⚙️ Core MCP server implementation
│   ├── core/                 # 🔧 Core business logic
│   ├── adapters/             # 🔌 Integration adapters
│   ├── transport/            # 🚛 Transport protocol implementations
│   ├── transform/            # 🔄 OpenAPI to MCP transformation
│   ├── types/                # 📝 TypeScript type definitions
│   └── tools/                # 🛠️ Utility tools and managers
├── dist/                     # 📦 Compiled JavaScript output
└── docs/                     # 📚 Architecture documentation
```

## 🎯 Key Components

### 1. CLI Layer (`cli.ts`, `cli-enhanced.ts`)

**Responsibility**: Command-line interface and argument parsing

**Features**:
- Multi-transport protocol support
- File watching and auto-reload
- Process management and auto-restart
- Environment variable configuration
- Rich error handling and logging

**Entry Points**:
- `cli.ts` - Standard CLI with core features
- `cli-enhanced.ts` - Advanced CLI with extended functionality

### 2. Core Layer (`core/`)

**Responsibility**: Business logic and MCP protocol implementation

**Components**:
- **MCP Server Factory**: Creates and configures MCP server instances
- **Protocol Handler**: Manages MCP message processing
- **Tool Registry**: Registers and manages MCP tools
- **Schema Validator**: Validates OpenAPI specifications

### 3. Adapter Layer (`adapters/`)

**Responsibility**: Integration with different environments

**Adapters**:
- **CLI Adapter**: Command-line integration
- **HTTP Adapter**: Web server integration
- **Programmatic Adapter**: Library usage

### 4. Transport Layer (`transport/`)

**Responsibility**: Protocol-specific communication

**Protocols**:
- **STDIO Transport**: Standard input/output for AI clients
- **HTTP Transport**: RESTful HTTP endpoints
- **SSE Transport**: Server-Sent Events for web frontends
- **Streamable Transport**: WebSocket-like bidirectional streaming

### 5. Transformation Layer (`transform/`)

**Responsibility**: OpenAPI to MCP conversion

**Components**:
- **OpenAPI Parser**: Parses and validates OpenAPI specifications
- **MCP Tool Generator**: Converts API endpoints to MCP tools
- **Schema Mapper**: Maps OpenAPI schemas to MCP schemas
- **Parameter Transformer**: Transforms API parameters

## 🔄 Data Flow

```
1. CLI Input → Argument Parser → Configuration
2. Configuration → OpenAPI Loader → Specification
3. Specification → Transformer → MCP Tools
4. MCP Tools → Server Factory → MCP Server
5. MCP Server → Transport Layer → Client Communication
```

## 🚛 Transport Architecture

### Transport Abstraction

```typescript
interface Transport {
  start(server: MCPServer, options: TransportOptions): Promise<void>;
  stop(): Promise<void>;
  send(message: MCPMessage): Promise<void>;
  onMessage(handler: MessageHandler): void;
}
```

### Protocol Implementations

#### STDIO Transport
- **Use Case**: AI clients (Claude Desktop, VS Code extensions)
- **Communication**: Process stdin/stdout
- **Message Format**: JSON-RPC over newline-delimited JSON

#### HTTP Transport
- **Use Case**: Web applications, REST APIs
- **Communication**: HTTP request/response
- **Message Format**: JSON over HTTP

#### SSE Transport
- **Use Case**: Web frontends requiring real-time updates
- **Communication**: Server-Sent Events
- **Message Format**: JSON events

#### Streamable Transport
- **Use Case**: Real-time applications, persistent connections
- **Communication**: WebSocket-like streaming
- **Message Format**: Bidirectional JSON streaming

## 🔧 Configuration System

### Configuration Sources (Priority Order)

1. **Command Line Arguments** (Highest)
2. **Environment Variables**
3. **Configuration File** (`.mcprc.json`)
4. **Default Values** (Lowest)

### Configuration Schema

```typescript
interface ServerConfig {
  transport: 'stdio' | 'http' | 'sse' | 'streamable';
  port?: number;
  host?: string;
  openapi: string; // URL or file path
  watch?: boolean;
  managed?: boolean;
  autoRestart?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}
```

## 🛠️ Tool Management

### MCP Tool Generation

```typescript
interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  handler: ToolHandler;
}
```

### OpenAPI to MCP Mapping

| OpenAPI Element | MCP Equivalent | Transformation |
|-----------------|----------------|----------------|
| Path + Method | Tool Name | `{method}_{path_segments}` |
| Operation Description | Tool Description | Direct mapping |
| Parameters | Input Schema | JSON Schema conversion |
| Request Body | Input Schema | Merged with parameters |
| Responses | Tool Output | Success response structure |

## 🔍 Error Handling

### Error Categories

1. **Configuration Errors**: Invalid CLI arguments, missing files
2. **Network Errors**: OpenAPI URL unreachable, timeout
3. **Parsing Errors**: Invalid OpenAPI specification
4. **Runtime Errors**: Server crashes, transport failures

### Error Recovery

- **Auto-restart**: Configurable process restart on failure
- **Retry Logic**: Exponential backoff for transient failures
- **Graceful Degradation**: Fallback to basic functionality
- **Error Reporting**: Structured error messages and logging

## 📊 Performance Considerations

### Memory Management

- **OpenAPI Caching**: Cache parsed specifications to avoid re-parsing
- **Tool Registry**: Lazy loading of MCP tools
- **Connection Pooling**: Reuse HTTP connections for OpenAPI fetching

### Scalability

- **Stateless Design**: Server instances are stateless for horizontal scaling
- **Async/Await**: Non-blocking I/O operations
- **Stream Processing**: Efficient handling of large OpenAPI specifications

## 🔒 Security Architecture

### Input Validation

- **OpenAPI Validation**: Schema validation for OpenAPI specifications
- **Parameter Sanitization**: Clean and validate all input parameters
- **URL Validation**: Restrict OpenAPI source URLs if needed

### Process Isolation

- **Sandboxed Execution**: Each server instance runs in isolation
- **Resource Limits**: Memory and CPU usage constraints
- **Error Boundaries**: Prevent cascading failures

## 🧪 Testing Strategy

### Unit Tests

- **Core Logic**: Business logic and transformations
- **Transport Layer**: Protocol implementations
- **Error Handling**: Error scenarios and recovery

### Integration Tests

- **End-to-End**: CLI to MCP server communication
- **Transport Protocols**: All transport implementations
- **Real APIs**: Testing with actual OpenAPI specifications

### Performance Tests

- **Load Testing**: High-volume MCP tool invocations
- **Memory Usage**: Long-running server instances
- **Latency**: Response time measurements

## 🚀 Deployment Architecture

### Standalone Deployment

```bash
# Global CLI installation
npm install -g mcp-swagger-server

# Direct execution
mcp-swagger-server --transport http --openapi https://api.example.com/openapi.json
```

### Container Deployment

```dockerfile
FROM node:18-alpine
RUN npm install -g mcp-swagger-server
EXPOSE 3322
CMD ["mcp-swagger-server", "--transport", "http", "--port", "3322"]
```

### Process Management

- **PM2 Integration**: Production process management
- **Docker Support**: Containerized deployment
- **Kubernetes**: Scalable container orchestration

## 🔮 Future Architecture Enhancements

### Plugin System

```typescript
interface Plugin {
  name: string;
  transform(openapi: OpenAPISpec): OpenAPISpec;
  generateTools(spec: OpenAPISpec): MCPTool[];
}
```

### Distributed Architecture

- **Service Mesh**: Multiple MCP servers with load balancing
- **Event Bus**: Asynchronous communication between components
- **Caching Layer**: Redis/Memcached for performance

### Monitoring Integration

- **Metrics**: Prometheus metrics collection
- **Tracing**: OpenTelemetry distributed tracing
- **Logging**: Structured logging with correlation IDs

---

## 📚 References

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)