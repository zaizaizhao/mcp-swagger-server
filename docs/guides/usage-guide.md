# MCP Swagger Server - 使用文档

> 🚀 将任何 OpenAPI/Swagger 规范转换为 MCP (Model Context Protocol) 工具，让 AI 助手轻松调用 REST API

## 📦 安装

### 全局安装 (推荐)

```bash
npm install -g mcp-swagger-server
```

### 本地项目安装

```bash
npm install mcp-swagger-server
```

---

## 🚀 快速开始

### 命令行使用

#### 1. 基础命令

```bash
# 查看帮助信息
mcp-swagger-server --help
mcp-swagger --help  # 简短别名

# 从 GitHub API 启动 HTTP 服务器
mcp-swagger-server --transport http --port 3322 --openapi https://api.github.com/openapi.json

# 从本地文件启动，并监控文件变化
mcp-swagger-server --transport streamable --openapi ./my-api.json --watch

# STDIO 模式 (最适合 AI 客户端集成)
mcp-swagger-server --transport stdio --openapi https://petstore.swagger.io/v2/swagger.json
```

#### 2. 完整命令选项

```bash
选项:
  -t, --transport <type>     传输协议 (stdio|http|sse|streamable) [默认: stdio]
  -p, --port <port>          服务器端口 [默认: 3322]
  -e, --endpoint <url>       自定义端点 URL
  -o, --openapi <source>     OpenAPI 规范源 (URL 或文件路径)
  -w, --watch               监控 OpenAPI 文件变化并自动重载
      --auto-restart        自动重启
      --max-retries <num>   最大重试次数 [默认: 5]
      --retry-delay <ms>    重试延迟 (毫秒) [默认: 5000]
  -h, --help                显示帮助信息
```

#### 3. 使用示例

```bash
# 🌐 HTTP 服务器模式 - 适合 Web 应用集成
mcp-swagger-server --transport http --port 3322 --openapi https://api.github.com/openapi.json

# 📡 SSE (Server-Sent Events) 模式 - 适合实时 Web 应用
mcp-swagger-server --transport sse --port 3323 --openapi ./openapi.yaml

# 🔄 Streamable 模式 - 适合流式处理
mcp-swagger-server --transport streamable --port 3324 --openapi https://petstore.swagger.io/v2/swagger.json

# 💻 STDIO 模式 - 最适合 AI 客户端 (Claude Desktop, VS Code 等)
mcp-swagger-server --transport stdio --openapi https://api.example.com/v1/openapi.json

# 👁️ 监控模式 - 自动重载配置变化
mcp-swagger-server --transport http --openapi ./api.yaml --watch

# 🔧 托管模式 - 自动重启和错误恢复
mcp-swagger-server --transport streamable --openapi https://api.example.com/openapi.json --auto-restart
```

### 环境变量配置

```bash
# 设置默认配置
export MCP_PORT=3322
export MCP_TRANSPORT=streamable
export MCP_OPENAPI_URL=https://api.github.com/openapi.json
export MCP_ENDPOINT=/mcp
export MCP_AUTO_RELOAD=true

# 然后直接运行
mcp-swagger-server
```

---

## 🔌 集成使用

### Claude Desktop 集成

1. **安装服务器**:
   ```bash
   npm install -g mcp-swagger-server
   ```

2. **配置 Claude Desktop** (`claude_desktop_config.json`):
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

3. **重启 Claude Desktop** 即可使用 GitHub API 功能

### VS Code MCP Extension 集成

```json
{
  "mcp.servers": [
    {
      "name": "My API Server",  
      "command": "mcp-swagger-server",
      "args": [
        "--transport", "stdio",
        "--openapi", "./my-openapi.yaml"
      ]
    }
  ]
}
```

### 编程式集成

#### Node.js 项目集成

```javascript
const { createMcpServer, runStreamableServer } = require('mcp-swagger-server');

// 从 URL 加载 OpenAPI 规范
async function startMyAPIServer() {
  const openApiUrl = 'https://api.github.com/openapi.json';
  
  // 创建 MCP 服务器
  const server = await createMcpServer(openApiUrl);
  
  // 启动 Streamable 服务器
  await runStreamableServer(server, { 
    port: 3322,
    host: 'localhost'
  });
  
  console.log('🚀 MCP Server running on port 3322');
}

startMyAPIServer().catch(console.error);
```

#### TypeScript 项目集成

```typescript
import { 
  createMcpServer, 
  runStdioServer, 
  runStreamableServer,
  ServerOptions 
} from 'mcp-swagger-server';

interface MyServerConfig {
  openApiSource: string;
  transport: 'stdio' | 'streamable' | 'sse' | 'http';
  port?: number;
}

async function setupMcpServer(config: MyServerConfig) {
  const server = await createMcpServer(config.openApiSource);
  
  const options: ServerOptions = {
    port: config.port || 3322,
    host: '0.0.0.0'
  };
  
  switch (config.transport) {
    case 'stdio':
      await runStdioServer(server);
      break;
    case 'streamable':
      await runStreamableServer(server, options);
      break;
    default:
      throw new Error(`Unsupported transport: ${config.transport}`);
  }
}
```

---

## 🎯 实际使用场景

### 1. AI 助手 API 集成

**场景**: 让 Claude 或其他 AI 助手调用你的内部 API

```bash
# 启动服务连接内部 API
mcp-swagger-server --transport stdio --openapi https://internal-api.company.com/openapi.json

# AI 助手现在可以：
# - 查询用户信息
# - 创建订单  
# - 更新数据
# - 执行业务逻辑
```

### 2. API 调试和测试

**场景**: 快速测试和验证 OpenAPI 规范

```bash
# 启动调试服务器
mcp-swagger-server --transport http --port 3322 --openapi ./my-api.yaml --watch

# 访问 http://localhost:3322 进行交互式测试
# 修改 my-api.yaml 文件会自动重载
```

### 3. 微服务集成

**场景**: 将多个微服务的 API 统一为 MCP 接口

```bash
# 服务 A
mcp-swagger-server --transport streamable --port 3001 --openapi https://service-a.com/openapi.json

# 服务 B  
mcp-swagger-server --transport streamable --port 3002 --openapi https://service-b.com/openapi.json

# 服务 C
mcp-swagger-server --transport streamable --port 3003 --openapi https://service-c.com/openapi.json
```

### 4. 开发环境自动化

**场景**: 开发环境中自动同步 API 变化

```bash
# 监控本地 OpenAPI 文件，自动重载
mcp-swagger-server --transport sse --openapi ./dev-api.yaml --watch --auto-restart

# 配合 Git hooks 实现自动更新
# .git/hooks/post-merge
#!/bin/bash
pkill -f "mcp-swagger-server" 
mcp-swagger-server --transport streamable --openapi ./openapi.yaml &
```

---

## 🔧 配置文件支持

### .mcprc.json 配置文件

在项目根目录创建 `.mcprc.json`:

```json
{
  "transport": "streamable",
  "port": 3322,
  "host": "0.0.0.0",
  "openapi": "./openapi.yaml",
  "watch": true,
  "autoRestart": true,
  "maxRetries": 5,
  "retryDelay": 5000
}
```

然后直接运行：
```bash
mcp-swagger-server  # 自动读取配置文件
```

---

## 🚨 故障排除

### 常见问题

#### 1. 端口占用错误
```bash
# 检查端口占用
netstat -an | grep :3322

# 使用其他端口
mcp-swagger-server --port 3323
```

#### 2. OpenAPI 规范解析失败
```bash
# 验证 OpenAPI 规范有效性
mcp-swagger-server --openapi ./api.yaml --validate-only

# 查看详细错误信息
mcp-swagger-server --openapi ./api.yaml --verbose
```

#### 3. 网络连接问题
```bash
# 测试 URL 连通性
curl -I https://api.github.com/openapi.json

# 使用代理
export HTTP_PROXY=http://proxy.company.com:8080
mcp-swagger-server --openapi https://api.github.com/openapi.json
```

### 日志调试

```bash
# 启用详细日志
export DEBUG=mcp-swagger:*
mcp-swagger-server --openapi ./api.yaml

# 输出到文件
mcp-swagger-server --openapi ./api.yaml 2>&1 | tee server.log
```

---

## 📋 最佳实践

### 1. 生产环境部署

```bash
# 使用 PM2 进程管理
pm2 start "mcp-swagger-server --transport http --openapi https://api.prod.com/openapi.json" --name "mcp-api-server"

# Docker 部署
docker run -d \
  --name mcp-swagger-server \
  -p 3322:3322 \
  -e MCP_OPENAPI_URL=https://api.prod.com/openapi.json \
  mcp-swagger-server:latest
```

### 2. 安全考虑

```bash
# 限制访问地址
mcp-swagger-server --transport http --host 127.0.0.1 --openapi ./internal-api.yaml

# 使用 HTTPS OpenAPI 源
mcp-swagger-server --openapi https://secure-api.company.com/openapi.json

# 环境变量存储敏感信息
export OPENAPI_URL=https://api.company.com/openapi.json?token=SECRET
mcp-swagger-server --openapi $OPENAPI_URL
```

### 3. 性能优化

```bash
# 启用缓存
export MCP_CACHE_TTL=3600  # 缓存 1 小时
mcp-swagger-server --openapi https://api.github.com/openapi.json

# 使用本地文件避免网络延迟
mcp-swagger-server --openapi ./cached-openapi.json
```

---

## 🔗 相关链接

- **GitHub Repository**: https://github.com/yourusername/mcp-swagger-server
- **NPM Package**: https://www.npmjs.com/package/mcp-swagger-server  
- **Model Context Protocol**: https://modelcontextprotocol.io/
- **OpenAPI Specification**: https://swagger.io/specification/
- **Issue Tracker**: https://github.com/yourusername/mcp-swagger-server/issues

---

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出改进建议！

```bash
# 克隆项目
git clone https://github.com/yourusername/mcp-swagger-server.git

# 安装依赖
pnpm install

# 开发模式
pnpm run dev

# 提交 Pull Request
```

---

## 📄 许可证

MIT License - 详见 [LICENSE](../LICENSE) 文件
