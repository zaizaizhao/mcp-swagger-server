# 嵌入式 MCP 服务使用指南

## 🎯 **概述**

`mcp-swagger-api` 项目现在支持嵌入式 MCP (Model Context Protocol) 服务器，能够动态地从 OpenAPI 规范创建 MCP 工具，而不需要读取本地文件。

## 🏗️ **架构设计**

```
mcp-swagger-ui (前端)
    ↓ 传递 OpenAPI 数据 (URL/JSON/对象)
mcp-swagger-api (NestJS API)
    ↓ EmbeddedMCPService 解析并创建工具
嵌入式 MCP 服务器 (HTTP/WebSocket)
    ↓ 提供 MCP 协议接口
AI 助手/客户端连接
```

## 🚀 **主要功能**

1. **动态创建**: 从前端传入的 OpenAPI 数据实时创建 MCP 工具
2. **多种输入格式**: 支持 URL、JSON 字符串、JSON 对象
3. **嵌入式运行**: MCP 服务器运行在 NestJS 应用内部
4. **多传输协议**: 支持 HTTP 和 WebSocket
5. **实时监控**: 完整的状态监控和事件系统

## 📋 **API 接口**

### 1. 创建 MCP 服务器
```http
POST /api/v1/mcp/create
Content-Type: application/json

{
  "openApiData": "https://api.example.com/openapi.json",
  // 或者
  // "openApiData": {"openapi": "3.0.0", "info": {...}, "paths": {...}},
  // 或者  
  // "openApiData": "{\"openapi\": \"3.0.0\", ...}",
  "config": {
    "name": "my-api-server",
    "version": "1.0.0",
    "port": 3322,
    "transport": "http"
  }
}
```

**响应:**
```json
{
  "status": "success",
  "message": "MCP server created successfully",
  "data": {
    "serverId": "mcp-server-1703123456789",
    "endpoint": "http://localhost:3322/mcp",
    "toolsCount": 15,
    "tools": [
      {
        "name": "getUserById",
        "description": "Get user by ID"
      }
    ]
  }
}
```

### 2. 获取服务器状态
```http
GET /api/v1/mcp/status
```

**响应:**
```json
{
  "status": "success",
  "data": {
    "isRunning": true,
    "toolsCount": 15,
    "endpoint": "http://localhost:3322/mcp",
    "config": {
      "name": "my-api-server",
      "port": 3322,
      "transport": "http"
    },
    "tools": [...]
  }
}
```

### 3. 重新加载工具
```http
POST /api/v1/mcp/reload
Content-Type: application/json

{
  "openApiData": "https://api.example.com/v2/openapi.json"
}
```

### 4. 获取工具列表
```http
GET /api/v1/mcp/tools
```

### 5. 停止服务器
```http
DELETE /api/v1/mcp/stop
```

## 💻 **前端集成示例**

### JavaScript/TypeScript
```javascript
// 1. 创建 MCP 服务器
async function createMCPServer(openApiUrl) {
  const response = await fetch('/api/v1/mcp/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      openApiData: openApiUrl,
      config: {
        name: 'my-api',
        port: 3322,
        transport: 'http'
      }
    })
  });
  
  const result = await response.json();
  if (result.status === 'success') {
    console.log('MCP Server created:', result.data.endpoint);
    return result.data;
  }
  throw new Error(result.error);
}

// 2. 获取状态
async function getMCPStatus() {
  const response = await fetch('/api/v1/mcp/status');
  const result = await response.json();
  return result.data;
}

// 3. 使用示例
const mcpData = await createMCPServer('https://api.github.com/openapi.json');
console.log(`MCP 服务器已启动: ${mcpData.endpoint}`);
console.log(`可用工具数量: ${mcpData.toolsCount}`);
```

### Vue.js 组件示例
```vue
<template>
  <div class="mcp-manager">
    <div class="input-section">
      <input 
        v-model="openApiUrl" 
        placeholder="输入 OpenAPI URL 或粘贴 JSON"
        class="input-field"
      />
      <button @click="createServer" :disabled="loading">
        {{ loading ? '创建中...' : '创建 MCP 服务器' }}
      </button>
    </div>
    
    <div v-if="mcpStatus.isRunning" class="status-section">
      <h3>MCP 服务器状态</h3>
      <p>端点: {{ mcpStatus.endpoint }}</p>
      <p>工具数量: {{ mcpStatus.toolsCount }}</p>
      <button @click="stopServer">停止服务器</button>
    </div>
    
    <div v-if="tools.length > 0" class="tools-section">
      <h3>可用工具</h3>
      <ul>
        <li v-for="tool in tools" :key="tool.name">
          <strong>{{ tool.name }}</strong>: {{ tool.description }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const openApiUrl = ref('');
const loading = ref(false);
const mcpStatus = ref({ isRunning: false, toolsCount: 0 });
const tools = ref([]);

const createServer = async () => {
  loading.value = true;
  try {
    const response = await fetch('/api/v1/mcp/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        openApiData: openApiUrl.value,
        config: { port: 3322, transport: 'http' }
      })
    });
    
    const result = await response.json();
    if (result.status === 'success') {
      await refreshStatus();
      tools.value = result.data.tools;
    }
  } finally {
    loading.value = false;
  }
};

const refreshStatus = async () => {
  const response = await fetch('/api/v1/mcp/status');
  const result = await response.json();
  mcpStatus.value = result.data;
};

const stopServer = async () => {
  await fetch('/api/v1/mcp/stop', { method: 'DELETE' });
  await refreshStatus();
  tools.value = [];
};

onMounted(refreshStatus);
</script>
```

## 🔗 **MCP 客户端连接**

### AI 助手连接示例
```javascript
// 使用 MCP SDK 连接到嵌入式服务器
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { HTTPTransport } from '@modelcontextprotocol/sdk/client/http.js';

const transport = new HTTPTransport({
  baseUrl: "http://localhost:3322/mcp"
});

const client = new Client({ name: "my-client", version: "1.0.0" }, {});
await client.connect(transport);

// 获取工具列表
const tools = await client.request({ method: "tools/list" });
console.log("可用工具:", tools.tools);

// 调用工具
const result = await client.request({
  method: "tools/call",
  params: {
    name: "getUserById",
    arguments: { id: "123" }
  }
});
```

## 🎛️ **配置选项**

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `name` | string | `dynamic-swagger-mcp` | MCP 服务器名称 |
| `version` | string | `1.0.0` | 服务器版本 |
| `port` | number | `3322` | 服务器端口 |
| `transport` | string | `http` | 传输协议 (`http` 或 `websocket`) |

## 🔄 **工作流程**

1. **前端用户输入**: 用户在 `mcp-swagger-ui` 中输入 OpenAPI URL 或粘贴 JSON
2. **API 调用**: 前端调用 `/api/v1/mcp/create` 接口
3. **数据解析**: `EmbeddedMCPService` 解析 OpenAPI 规范
4. **工具生成**: 自动生成对应的 MCP 工具定义
5. **服务器启动**: 启动嵌入式 MCP 服务器 (HTTP/WebSocket)
6. **客户端连接**: AI 助手连接到 MCP 端点
7. **工具调用**: 通过 MCP 协议调用生成的工具
8. **API 代理**: 工具调用被代理到原始 API

## 🛠️ **开发和调试**

### 启动开发服务器
```bash
cd packages/mcp-swagger-api
pnpm start:dev
```

### 查看 Swagger 文档
访问: http://localhost:3001/api/docs

### 健康检查
```bash
curl http://localhost:3322/health
```

### 查看 MCP 工具
```bash
curl http://localhost:3322/tools
```

## 🎯 **使用场景**

1. **API 探索**: 快速将任何 OpenAPI 服务转换为 MCP 工具
2. **AI 集成**: 让 AI 助手能够调用第三方 API
3. **原型开发**: 快速构建 API 代理和转换服务
4. **测试环境**: 为 API 测试提供 MCP 接口

## 🔧 **故障排除**

### 常见问题

1. **端口冲突**: 修改配置中的 `port` 参数
2. **OpenAPI 解析失败**: 检查 URL 是否可访问，JSON 格式是否正确
3. **工具数量为 0**: 确保 OpenAPI 规范包含 `paths` 和 `operationId`

### 日志查看
```bash
# 查看 NestJS 应用日志
tail -f logs/application.log

# 查看 MCP 服务器日志
curl http://localhost:3322/health
```

这个新的架构完全解决了你提到的问题：MCP 服务器不再读取本地文件，而是动态地从前端传入的数据创建工具，实现了真正的前后端分离和动态配置。
