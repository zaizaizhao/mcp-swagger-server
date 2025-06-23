# 🎉 MCP Swagger Server - 发布完成使用指南

恭喜！您的 `mcp-swagger-server` 已经成功发布到 NPM！以下是完整的使用指南。

## 📦 安装

### 全局安装（推荐）

```bash
npm install -g mcp-swagger-server
```

### 验证安装

```bash
# 检查版本
mcp-swagger-server --help

# 应该显示完整的帮助信息
```

## 🚀 快速开始

### 1. 基础使用

```bash
# 从 GitHub API 启动 streamable 服务器
mcp-swagger-server --transport streamable --port 3322 --openapi https://api.github.com/openapi.json

# 从 Petstore API 启动 STDIO 模式（适合 AI 客户端）
mcp-swagger-server --transport stdio --openapi https://petstore.swagger.io/v2/swagger.json

# 从本地文件启动并监控变化
mcp-swagger-server --transport http --openapi ./my-api.yaml --watch
```

### 2. 与 Claude Desktop 集成

编辑 Claude Desktop 配置文件：

**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "github-api": {
      "command": "mcp-swagger-server",
      "args": [
        "--transport", "stdio",
        "--openapi", "https://api.github.com/openapi.json"
      ]
    },
    "petstore-api": {
      "command": "mcp-swagger-server", 
      "args": [
        "--transport", "stdio",
        "--openapi", "https://petstore.swagger.io/v2/swagger.json"
      ]
    }
  }
}
```

重启 Claude Desktop，现在您可以让 Claude 调用这些 API！

### 3. VS Code MCP Extension 集成

如果您使用 VS Code MCP 扩展，可以这样配置：

```json
{
  "mcp.servers": [
    {
      "name": "GitHub API",
      "command": "mcp-swagger-server",
      "args": [
        "--transport", "stdio",
        "--openapi", "https://api.github.com/openapi.json"
      ]
    }
  ]
}
```

## 🔧 高级用法

### 环境变量配置

```bash
# 设置默认配置
export MCP_PORT=3322
export MCP_TRANSPORT=streamable
export MCP_OPENAPI_URL=https://api.github.com/openapi.json
export MCP_AUTO_RELOAD=true

# 直接运行（使用环境变量）
mcp-swagger-server
```

### 进程管理

```bash
# 托管模式 - 自动重启
mcp-swagger-server --transport streamable --openapi https://api.example.com/openapi.json --managed --auto-restart

# 使用 PM2 管理
pm2 start "mcp-swagger-server --transport http --openapi https://api.example.com/openapi.json" --name "my-mcp-server"
```

### 文件监控

```bash
# 监控本地 OpenAPI 文件变化
mcp-swagger-server --transport streamable --openapi ./api.yaml --watch

# 适合开发环境，API 规范变化时自动重载
```

## 📋 实际使用场景

### 场景 1: 内部 API 集成

```bash
# 让 AI 助手访问公司内部 API
mcp-swagger-server --transport stdio --openapi https://internal-api.company.com/openapi.json
```

现在 Claude 可以：
- 查询用户信息
- 创建和更新订单
- 执行业务逻辑操作
- 获取报表数据

### 场景 2: API 开发调试

```bash
# 开发环境自动同步
mcp-swagger-server --transport http --port 3322 --openapi ./dev-api.yaml --watch
```

访问 `http://localhost:3322` 进行交互式 API 测试。

### 场景 3: 微服务集成

```bash
# 为每个微服务启动独立的 MCP 服务器
mcp-swagger-server --transport streamable --port 3001 --openapi https://user-service.com/openapi.json
mcp-swagger-server --transport streamable --port 3002 --openapi https://order-service.com/openapi.json
mcp-swagger-server --transport streamable --port 3003 --openapi https://payment-service.com/openapi.json
```

## 🔍 故障排除

### 常见问题

**1. 端口占用**
```bash
# 检查端口使用
netstat -an | findstr :3322  # Windows
lsof -i :3322                # macOS/Linux

# 使用其他端口
mcp-swagger-server --port 3323
```

**2. OpenAPI 解析失败**
```bash
# 验证 OpenAPI URL 可访问性
curl -I https://api.github.com/openapi.json

# 检查本地文件格式
mcp-swagger-server --openapi ./api.yaml --validate-only
```

**3. 权限问题（Windows）**
```bash
# 以管理员身份运行 PowerShell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 调试模式

```bash
# 启用详细日志
set DEBUG=mcp-swagger:*        # Windows
export DEBUG=mcp-swagger:*     # macOS/Linux

mcp-swagger-server --openapi ./api.yaml
```

## 📚 更多资源

### 文档链接

- **GitHub Repository**: https://github.com/yourusername/mcp-swagger-server
- **Model Context Protocol**: https://modelcontextprotocol.io/
- **OpenAPI Specification**: https://swagger.io/specification/

### 示例 OpenAPI 规范

- **GitHub API**: https://api.github.com/openapi.json
- **Petstore API**: https://petstore.swagger.io/v2/swagger.json
- **JSONPlaceholder**: https://jsonplaceholder.typicode.com/openapi.json

### 社区

- **Issues**: https://github.com/yourusername/mcp-swagger-server/issues
- **Discussions**: https://github.com/yourusername/mcp-swagger-server/discussions

## 🎯 最佳实践

### 生产环境部署

```bash
# 使用 PM2 进程管理
npm install -g pm2
pm2 start "mcp-swagger-server --transport http --openapi https://api.prod.com/openapi.json" --name "mcp-api"
pm2 save
pm2 startup
```

### 安全考虑

```bash
# 限制访问地址
mcp-swagger-server --transport http --host 127.0.0.1 --openapi ./internal-api.yaml

# 使用环境变量存储敏感 URL
export API_URL="https://api.company.com/openapi.json?token=SECRET"
mcp-swagger-server --openapi $API_URL
```

### 性能优化

```bash
# 使用本地缓存的 OpenAPI 文件避免网络延迟
curl -o cached-api.json https://api.github.com/openapi.json
mcp-swagger-server --openapi ./cached-api.json
```

## 🚀 下一步

1. **尝试不同的传输协议**，找到最适合您用例的方式
2. **集成到您的 AI 工作流程**中，提升开发效率
3. **为您的内部 API 创建 MCP 服务器**，让 AI 助手更智能
4. **参与社区贡献**，帮助改进项目

---

**🎉 恭喜！您现在已经掌握了 MCP Swagger Server 的完整使用方法。开始让您的 API 与 AI 无缝集成吧！**
