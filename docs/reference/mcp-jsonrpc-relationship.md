# MCP 与 JSON-RPC 2.0 的关系说明

> 本文档详细解释了Model Context Protocol (MCP) 与 JSON-RPC 2.0 的关系和协议结构。

## 核心关系概述

**MCP协议建立在JSON-RPC 2.0之上，是对JSON-RPC 2.0的扩展和应用**：

1. **MCP使用JSON-RPC 2.0作为基础传输协议**
2. **所有MCP消息都被包装在JSON-RPC 2.0的标准格式中**
3. **MCP定义了具体的方法名称、参数和响应格式**

## JSON-RPC 2.0基础结构

### 请求格式
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": { ... }
  },
  "id": 1
}
```

### 响应格式
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [...],
    "_meta": { ... }
  },
  "id": 1
}
```

### 错误响应格式
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601,
    "message": "Method not found",
    "data": { ... }
  },
  "id": 1
}
```

## MCP工具调用的完整流程

### 1. 客户端发送工具调用请求

JSON-RPC 2.0请求包装：
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_user_info",
    "arguments": {
      "userId": "123"
    }
  },
  "id": 1
}
```

### 2. 服务器返回工具调用结果

JSON-RPC 2.0成功响应：
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "User information retrieved successfully"
      }
    ],
    "isError": false,
    "_meta": {
      "progressToken": "token123"
    }
  },
  "id": 1
}
```

## MCP CallToolResult 与项目接口对比

### MCP SDK 标准 CallToolResult
```typescript
interface CallToolResult {
  content: Array<
    | { type: "text"; text: string; _meta?: any; }
    | { type: "image"; data: string; mimeType: string; _meta?: any; }
    | { type: "resource"; resource: { uri: string; text?: string; blob?: string; mimeType?: string; }; _meta?: any; }
  >;
  _meta?: {
    progressToken?: string | number;
  };
}
```

### 项目中的 MCPToolResponse
```typescript
interface MCPToolResponse {
  content: Array<
    | { [x: string]: unknown; type: "text"; text: string; }
    | { [x: string]: unknown; type: "image"; data: string; mimeType: string; }
    | { [x: string]: unknown; type: "audio"; data: string; mimeType: string; }
    | { [x: string]: unknown; type: "resource"; resource: { uri: string; text: string; mimeType?: string; } | { uri: string; blob: string; mimeType?: string; }; }
  >;
  _meta?: {
    progressToken?: string | number;
  };
  structuredContent?: {
    type: string;
    data: any;
  };
  isError?: boolean;
}
```

### 主要差异分析

1. **兼容性**：
   - ✅ `content` 数组结构完全兼容
   - ✅ `_meta` 字段完全兼容
   - ✅ 基础内容类型(text, image, resource)兼容

2. **扩展功能**：
   - ➕ 项目增加了 `audio` 内容类型
   - ➕ 项目增加了 `structuredContent` 字段
   - ➕ 项目增加了 `isError` 字段

3. **类型定义**：
   - 项目使用了更宽松的 `[x: string]: unknown` 允许额外属性
   - MCP SDK使用可选的 `_meta` 字段在每个内容项上

## 协议层次结构

```
应用层：MCP具体业务逻辑
    ↓
MCP协议层：工具、资源、提示符等概念
    ↓
JSON-RPC 2.0传输层：方法调用、参数、响应
    ↓
传输层：HTTP、WebSocket、标准输入输出等
```

## 重要理解要点

### 1. JSON-RPC 2.0是容器协议
- JSON-RPC 2.0提供标准的RPC调用框架
- 包含 `jsonrpc`、`method`、`params`、`id` 字段
- 处理请求路由、错误处理、批量请求等

### 2. MCP是应用协议
- 定义具体的方法名称（如 `tools/call`、`resources/list`）
- 定义参数和响应的具体结构
- 提供语义层面的协议约定

### 3. 工具响应在JSON-RPC中的位置
```json
{
  "jsonrpc": "2.0",     // JSON-RPC 2.0协议标识
  "result": {           // JSON-RPC 2.0结果字段
    // 这里是MCP CallToolResult的内容
    "content": [...],
    "_meta": {...}
  },
  "id": 1               // JSON-RPC 2.0请求ID
}
```

## 实际应用示例

### 完整的MCP工具调用示例

1. **请求** (JSON-RPC 2.0 + MCP):
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "swagger_to_mcp",
    "arguments": {
      "url": "https://api.example.com/swagger.json"
    }
  },
  "id": "call-123"
}
```

2. **响应** (JSON-RPC 2.0 + MCP):
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Successfully converted 15 API endpoints to MCP tools"
      }
    ],
    "structuredContent": {
      "type": "mcp-tools",
      "data": {
        "toolCount": 15,
        "endpoints": ["GET /users", "POST /users", ...]
      }
    },
    "isError": false,
    "_meta": {
      "progressToken": "conversion-123"
    }
  },
  "id": "call-123"
}
```

## 总结

1. **MCP不是独立协议**，而是建立在JSON-RPC 2.0之上的应用层协议
2. **所有MCP消息都必须符合JSON-RPC 2.0格式**
3. **CallToolResult是JSON-RPC 2.0响应中`result`字段的内容**
4. **项目的MCPToolResponse接口在保持MCP兼容性的基础上添加了有用的扩展**
5. **理解这种层次关系对于正确实现MCP服务器至关重要**

这种设计让MCP能够：
- 复用JSON-RPC 2.0的成熟基础设施
- 保持协议的简单性和互操作性
- 专注于AI工具集成的语义层面
- 支持多种传输方式（HTTP、WebSocket、stdio等）
