# 自定义请求头快速开始指南

## 概述

本指南展示如何在 mcp-swagger-server 中配置自定义请求头，用于代理 OpenAPI 接口时自动添加特定的 HTTP 头。

## 快速开始

### 1. 命令行方式

```bash
# 添加静态请求头
mcp-swagger-server \
  --openapi https://api.example.com/swagger.json \
  --custom-header "User-Agent=MCP-Client/1.0" \
  --custom-header "X-Client-Version=1.0.0"

# 添加环境变量请求头
mcp-swagger-server \
  --openapi https://api.example.com/swagger.json \
  --custom-header-env "X-Client-ID=CLIENT_ID" \
  --custom-header-env "X-API-Source=API_SOURCE"

# 启用调试模式
mcp-swagger-server \
  --openapi https://api.example.com/swagger.json \
  --custom-header "User-Agent=MCP-Client/1.0" \
  --debug-headers
```

### 2. 配置文件方式

创建配置文件 `config.json`：

```json
{
  "openapi": "https://api.example.com/swagger.json",
  "transport": "stdio",
  "customHeaders": {
    "static": {
      "User-Agent": "MCP-Swagger-Client/1.0",
      "X-Client-Version": "1.0.0",
      "Accept": "application/json"
    },
    "env": {
      "X-Client-ID": "CLIENT_ID",
      "X-Request-Source": "REQUEST_SOURCE"
    }
  },
  "debugHeaders": true
}
```

运行命令：
```bash
mcp-swagger-server --config config.json
```

### 3. 环境变量方式

创建 `.env` 文件：
```bash
# OpenAPI 配置
MCP_OPENAPI_URL=https://api.example.com/swagger.json
MCP_TRANSPORT=stdio

# 自定义请求头（格式：MCP_CUSTOM_HEADERS_<HEADER_NAME>=<VALUE>）
MCP_CUSTOM_HEADERS_USER_AGENT=MCP-Client/1.0
MCP_CUSTOM_HEADERS_X_CLIENT_VERSION=1.0.0
MCP_CUSTOM_HEADERS_ACCEPT=application/json

# 环境变量映射
CLIENT_ID=my-client-123
REQUEST_SOURCE=mcp-swagger-server
```

运行命令：
```bash
mcp-swagger-server --env .env
```

## 常见用例

### 1. API 客户端标识

```json
{
  "customHeaders": {
    "static": {
      "User-Agent": "MyApp/1.0",
      "X-Client-ID": "myapp-client",
      "X-API-Version": "v1"
    }
  }
}
```

### 2. 追踪和调试

```json
{
  "customHeaders": {
    "static": {
      "X-Request-Source": "mcp-swagger-server",
      "X-Debug-Mode": "true"
    },
    "env": {
      "X-Trace-ID": "TRACE_ID",
      "X-Session-ID": "SESSION_ID"
    }
  }
}
```

### 3. 内容类型和编码

```json
{
  "customHeaders": {
    "static": {
      "Accept": "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Accept-Language": "en-US,en;q=0.9"
    }
  }
}
```

## 进阶功能

### 1. 条件请求头

```json
{
  "customHeaders": {
    "conditional": [
      {
        "condition": "method === 'POST'",
        "headers": {
          "X-Request-Type": "mutation"
        }
      },
      {
        "condition": "path.includes('/admin')",
        "headers": {
          "X-Admin-Request": "true"
        }
      }
    ]
  }
}
```

### 2. 动态请求头

```json
{
  "customHeaders": {
    "dynamic": {
      "X-Request-ID": "generateRequestId",
      "X-Timestamp": "generateTimestamp"
    }
  }
}
```

支持的预定义函数：
- `generateRequestId`: 生成唯一请求ID
- `generateTimestamp`: 生成ISO时间戳
- `generateUnixTimestamp`: 生成Unix时间戳
- `generateUUID`: 生成UUID v4

## 重要说明

### 1. 请求头优先级

1. **系统头**（如 Content-Type）- 最高优先级，不可覆盖
2. **认证头**（如 Authorization）- 由认证系统管理
3. **自定义头** - 用户配置的头
4. **默认头** - 系统默认值

### 2. 受保护的请求头

以下请求头受到保护，不能被自定义头覆盖：
- `content-type`
- `content-length`
- `host`
- `connection`
- `transfer-encoding`
- `upgrade`

### 3. 与认证的区别

- **认证头**：专门用于身份验证，如 `Authorization: Bearer token`
- **自定义头**：用于其他目的，如客户端标识、追踪、内容协商等

两者是独立的系统，可以同时使用。

## 调试技巧

### 1. 启用调试模式

```bash
mcp-swagger-server --debug-headers --openapi https://api.example.com/swagger.json
```

### 2. 查看实际发送的请求头

调试模式会输出类似以下的信息：
```
Added static headers: { "User-Agent": "MCP-Client/1.0" }
Added env headers: { "X-Client-ID": "client123" }
Final custom headers: { "User-Agent": "MCP-Client/1.0", "X-Client-ID": "client123" }
[GET /api/users] Final headers: { "Content-Type": "application/json", "User-Agent": "MCP-Client/1.0", "X-Client-ID": "client123" }
```

### 3. 测试配置

使用工具如 `curl` 或 Postman 验证实际的 HTTP 请求是否包含了预期的请求头。

## 最佳实践

1. **使用环境变量**管理敏感或环境特定的值
2. **启用调试模式**在开发时验证配置
3. **避免覆盖系统关键头**，特别是认证相关的头
4. **使用描述性的头名称**，便于调试和维护
5. **定期检查和更新**自定义头配置

## 故障排除

### 问题：自定义头没有生效

1. 检查是否与受保护的头名称冲突
2. 确认环境变量是否正确设置
3. 启用调试模式查看实际配置
4. 检查配置文件语法是否正确

### 问题：环境变量头没有值

1. 确认环境变量确实存在
2. 检查环境变量名称是否正确
3. 确认 `.env` 文件路径正确
4. 使用 `echo $VARIABLE_NAME` 验证环境变量

### 问题：配置文件不生效

1. 检查 JSON 语法是否正确
2. 确认文件路径正确
3. 验证文件权限
4. 检查配置文件编码格式

这个功能为您的 mcp-swagger-server 提供了强大的请求头自定义能力，可以满足各种 API 集成场景的需求。
