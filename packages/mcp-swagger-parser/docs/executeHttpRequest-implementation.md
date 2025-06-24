# executeHttpRequest 实现说明

## 概述

`executeHttpRequest` 函数是 `OpenAPIToMCPTransformer` 类中的核心方法，负责执行实际的 HTTP 请求并返回符合 MCP 标准的响应格式。

## 实现特性

### 1. 完整的 HTTP 客户端集成
- 使用 `axios` 作为 HTTP 客户端
- 支持所有 HTTP 方法（GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, TRACE）
- 配置超时控制和重定向限制

### 2. 智能参数处理
- **路径参数**：自动替换 URL 中的 `{paramName}` 占位符，并进行 URL 编码
- **查询参数**：根据 OpenAPI 规范自动提取查询参数
- **请求体**：智能构建请求体，支持直接 `body` 参数或自动合并非路径/查询参数

### 3. 响应格式化
- 将 HTTP 响应转换为 MCP 标准格式
- 提供结构化内容（JSON 响应）
- 包含完整的请求/响应元信息

### 4. 全面的错误处理
- **HTTP 错误响应**：处理 4xx, 5xx 状态码
- **网络错误**：处理连接超时、拒绝连接等网络问题
- **配置错误**：处理无效 URL、请求配置错误
- **意外错误**：捕获并优雅处理所有未预期的错误

## 使用示例

### GET 请求示例
```typescript
// OpenAPI 定义
{
  "/users/{id}": {
    "get": {
      "parameters": [
        { "name": "id", "in": "path", "required": true },
        { "name": "include", "in": "query" }
      ]
    }
  }
}

// 调用示例
const result = await tool.handler({
  id: "123",
  include: "profile"
});

// 实际请求: GET https://api.example.com/users/123?include=profile
```

### POST 请求示例
```typescript
// OpenAPI 定义
{
  "/users": {
    "post": {
      "requestBody": {
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "name": { "type": "string" },
                "email": { "type": "string" }
              }
            }
          }
        }
      }
    }
  }
}

// 调用示例
const result = await tool.handler({
  name: "John Doe",
  email: "john@example.com"
});

// 实际请求: POST https://api.example.com/users
// Body: {"name": "John Doe", "email": "john@example.com"}
```

## 响应格式

### 成功响应
```typescript
{
  content: [{
    type: 'text',
    text: `HTTP 200 OK
GET https://api.example.com/users/123

Response:
{
  "id": "123",
  "name": "John Doe",
  "email": "john@example.com"
}`
  }],
  structuredContent: {
    type: 'json',
    data: {
      id: "123",
      name: "John Doe", 
      email: "john@example.com"
    }
  },
  isError: false
}
```

### 错误响应
```typescript
{
  content: [{
    type: 'text',
    text: `HTTP 404 Not Found
GET /users/999

Error Response:
{
  "error": "User not found"
}`
  }],
  isError: true
}
```

## 安全特性

1. **URL 编码**：所有路径参数都会进行 URL 编码，防止注入攻击
2. **超时控制**：配置请求超时，防止长时间阻塞
3. **状态码验证**：不依赖 axios 的自动错误抛出，手动处理所有状态码
4. **错误信息过滤**：敏感信息不会暴露在错误消息中

## 配置选项

- `baseUrl`: API 基础 URL
- `requestTimeout`: 请求超时时间（默认 30 秒）
- `defaultHeaders`: 默认请求头（如认证信息）
- `pathPrefix`: URL 路径前缀
- `customHandlers`: 自定义处理器，可覆盖默认的 HTTP 请求行为

## 扩展性

该实现支持通过 `customHandlers` 选项提供自定义处理逻辑，可以：
- 添加自定义认证
- 实现特殊的错误处理
- 添加请求/响应拦截器
- 集成监控和日志记录

这使得该实现既能满足标准 HTTP API 调用需求，又能灵活适应特殊业务场景。
