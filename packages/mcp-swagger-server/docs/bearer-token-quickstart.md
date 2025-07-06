# Bearer Token 认证快速开始指南

## 概述

MCP Swagger Server 支持 Bearer Token 认证，可以保护你的 API 访问。支持三种配置方式：

1. **命令行参数**：直接在命令行中指定
2. **环境变量**：通过环境变量配置
3. **配置文件**：使用 JSON 配置文件

## 配置方式

### 1. 命令行参数

#### 静态 Token
```bash
# 直接指定 Bearer Token
mcp-swagger-server --auth-type bearer --bearer-token "your-token-here" -o ./api.json

# 使用 SSE 传输 + Bearer Token
mcp-swagger-server -t sse -p 3323 --auth-type bearer --bearer-token "your-token-here" -o ./api.json
```

#### 环境变量 Token
```bash
# 使用默认环境变量 API_TOKEN
mcp-swagger-server --auth-type bearer --bearer-env API_TOKEN -o ./api.json

# 使用自定义环境变量
mcp-swagger-server --auth-type bearer --bearer-env CUSTOM_TOKEN -o ./api.json
```

### 2. 环境变量配置

#### 创建 .env 文件
```bash
# 复制示例文件
cp .env.example .env
```

#### 编辑 .env 文件
```env
# 基础配置
MCP_PORT=3322
MCP_TRANSPORT=stdio
MCP_OPENAPI_URL=https://petstore.swagger.io/v2/swagger.json

# 认证配置
MCP_AUTH_TYPE=bearer
API_TOKEN=your-bearer-token-here
```

#### 启动服务器
```bash
# 环境变量会自动加载
mcp-swagger-server -o ./api.json
```

### 3. 配置文件方式

#### 创建配置文件
```json
{
  "transport": "sse",
  "port": 3323,
  "endpoint": "/api/mcp",
  "openapi": "https://petstore.swagger.io/v2/swagger.json",
  "watch": true,
  "auth": {
    "type": "bearer",
    "bearer": {
      "token": "your-static-token-here",
      "source": "static"
    }
  },
  "autoRestart": true,
  "maxRetries": 3,
  "retryDelay": 2000
}
```

#### 使用配置文件启动
```bash
# 使用配置文件
mcp-swagger-server -c config.json

# 或者使用完整路径
mcp-swagger-server --config ./config/production.json
```

## 配置优先级

配置的优先级顺序（从高到低）：

1. **命令行参数**
2. **配置文件**
3. **环境变量**
4. **默认值**

## 环境变量 Token 示例

### 设置环境变量
```bash
# Windows PowerShell
$env:API_TOKEN = "your-bearer-token-here"

# Windows CMD
set API_TOKEN=your-bearer-token-here

# Linux/macOS
export API_TOKEN=your-bearer-token-here
```

### 使用环境变量
```bash
# 使用默认环境变量名 API_TOKEN
mcp-swagger-server --auth-type bearer --bearer-env API_TOKEN -o ./api.json

# 使用自定义环境变量名
export CUSTOM_TOKEN=your-token-here
mcp-swagger-server --auth-type bearer --bearer-env CUSTOM_TOKEN -o ./api.json
```

## 配置文件示例

### 静态 Token 配置
```json
{
  "transport": "streamable",
  "port": 3324,
  "openapi": "./openapi.yaml",
  "auth": {
    "type": "bearer",
    "bearer": {
      "token": "your-static-token-here",
      "source": "static"
    }
  }
}
```

### 环境变量 Token 配置
```json
{
  "transport": "sse",
  "port": 3323,
  "openapi": "https://api.example.com/openapi.json",
  "auth": {
    "type": "bearer",
    "bearer": {
      "source": "env",
      "envName": "API_TOKEN"
    }
  }
}
```

## 完整示例

### 示例 1：开发环境
```bash
# 设置环境变量
export API_TOKEN=dev-token-123

# 启动开发服务器
mcp-swagger-server \
  --transport sse \
  --port 3323 \
  --openapi https://petstore.swagger.io/v2/swagger.json \
  --auth-type bearer \
  --bearer-env API_TOKEN \
  --watch
```

### 示例 2：生产环境
```bash
# 使用配置文件
mcp-swagger-server --config production.json
```

```json
{
  "transport": "streamable",
  "port": 3322,
  "endpoint": "/api/mcp",
  "openapi": "https://api.yourcompany.com/openapi.json",
  "auth": {
    "type": "bearer",
    "bearer": {
      "source": "env",
      "envName": "PROD_API_TOKEN"
    }
  },
  "managed": true,
  "autoRestart": true,
  "maxRetries": 5,
  "retryDelay": 5000
}
```

## 安全建议

1. **不要在命令行中直接使用明文 Token**，推荐使用环境变量
2. **不要将包含 Token 的配置文件提交到版本控制系统**
3. **定期轮换 Bearer Token**
4. **使用 HTTPS 传输**
5. **为不同环境使用不同的 Token**

## 故障排除

### 常见问题

1. **Token 未设置**
   ```
   错误：环境变量 API_TOKEN 未设置或为空
   解决：设置正确的环境变量
   ```

2. **认证失败**
   ```
   错误：Bearer Token 静态模式需要提供 token 值
   解决：检查配置文件或命令行参数
   ```

3. **配置文件格式错误**
   ```
   错误：加载配置文件失败
   解决：检查 JSON 格式是否正确
   ```

### 调试技巧

1. **查看当前配置**
   启动服务器时会显示当前认证配置信息

2. **测试 Token**
   ```bash
   # 使用 curl 测试
   curl -H "Authorization: Bearer your-token-here" http://localhost:3323/api/mcp
   ```

3. **检查环境变量**
   ```bash
   # Windows
   echo $env:API_TOKEN

   # Linux/macOS
   echo $API_TOKEN
   ```

## 相关文档

- [API 文档](./docs/api.md)
- [配置参考](./docs/configuration.md)
- [部署指南](./docs/deployment.md)
