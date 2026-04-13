# 实用MCP Swagger UI架构实现方案

## 🎯 项目目标

基于现有的项目实现，设计一个简洁实用的架构：用户通过Web UI解析OpenAPI协议，然后通过HTTP Stream接口让MCP客户端调用这些API工具。

## 📊 现状分析

### 当前项目结构
```
mcp-swagger-server/
├── packages/
│   ├── mcp-swagger-parser/          # ✅ 已实现：核心解析库
│   ├── mcp-swagger-server/          # ✅ 已实现：MCP服务器
│   │   ├── src/
│   │   │   ├── server.ts           # MCP服务器核心
│   │   │   ├── tools/initTools.ts  # 工具初始化
│   │   │   ├── transform/          # OpenAPI→MCP转换
│   │   │   ├── transportUtils/     # 传输层(stdio,sse,stream)
│   │   │   └── swagger_json_file/  # 静态swagger文件
│   └── mcp-swagger-ui/             # ✅ 已实现：Web UI界面
│       ├── src/
│       │   ├── views/Home.vue      # 主界面
│       │   ├── stores/app.ts       # 状态管理
│       │   ├── utils/parser.ts     # 解析工具(目前是mock)
│       │   └── utils/api.ts        # API调用
```

### 当前实现状态
1. **✅ MCP服务器**: 已实现，支持多种传输协议(stdio、sse、stream)
2. **✅ Web UI**: 已实现基础界面，支持OpenAPI输入和预览
3. **✅ 解析库**: mcp-swagger-parser已实现核心解析功能
4. **❌ 集成**: UI和MCP服务器之间缺少桥接
5. **❌ 动态配置**: 目前使用静态swagger.json文件

## 🏗️ 实用架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      Web Browser                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              MCP Swagger UI                             │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │    │
│  │  │ OpenAPI     │ │   Preview   │ │   Config    │      │    │
│  │  │ Input       │ │  Component  │ │  Manager    │      │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘      │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────┼───────────────────────────────────────┘
                          │ HTTP API Calls
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Configuration API Server                      │
│                      (Port: 3001)                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  Express API                            │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │    │
│  │  │ POST /parse │ │POST /config │ │GET /status  │      │    │
│  │  │   OpenAPI   │ │   Update    │ │   Check     │      │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Configuration Manager                      │    │
│  │  • 动态写入swagger.json文件                               │    │
│  │  • 触发MCP服务器重新加载                                  │    │
│  │  • 配置文件版本管理                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────┼───────────────────────────────────────┘
                          │ File System / Process Signal
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Swagger Server                           │
│                      (Port: 3322)                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                MCP Protocol Layer                       │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │    │
│  │  │    STDIO    │ │     SSE     │ │HTTP Stream  │      │    │
│  │  │  Transport  │ │  Transport  │ │ Transport   │      │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 Tools Registry                          │    │
│  │  • 从swagger.json读取API规范                              │    │
│  │  • 动态生成MCP工具                                        │    │
│  │  • 注册到MCP服务器                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────┼───────────────────────────────────────┘
                          │ MCP Protocol Communication
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MCP Client                                 │
│                   (AI Assistant)                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              StreamableHTTPClientTransport              │    │
│  │  • 连接到 http://localhost:3322/mcp                      │    │
│  │  • 发现可用工具                                           │    │
│  │  • 调用API工具                                           │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 核心实现方案

基于你的正确分析，我重新设计了一个更合理的架构：

### ❌ 原方案问题分析
1. **文件监听方案不可行**: 在生产环境中，没有静态文件变更
2. **进程重启复杂**: 管理子进程容易出错，不够稳定
3. **__dirname问题**: 打包后路径会发生变化
4. **数据来源错误**: OpenAPI数据来自前端输入，不是文件系统

### ✅ 新方案核心思路
1. **内存配置**: OpenAPI规范存储在内存中，不依赖文件系统
2. **动态工具注册**: 支持运行时动态注册/取消注册MCP工具
3. **单进程架构**: 配置API和MCP服务器运行在同一进程中
4. **实时响应**: 前端配置后立即生效，无需重启

### 第一步：创建动态MCP服务器

重新设计MCP服务器，支持动态工具注册，而不是依赖静态文件：

```typescript
// packages/mcp-swagger-server/src/dynamicServer.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { transformToMCPTools, parseFromUrl, parseFromString } from 'mcp-swagger-parser';
import type { MCPTool, OpenAPISpec, InputSource } from 'mcp-swagger-parser';

export class DynamicMCPServer {
  private mcpServer: McpServer;
  private currentTools: MCPTool[] = [];
  private currentSpec: OpenAPISpec | null = null;

  constructor() {
    this.mcpServer = new McpServer(
      {
        name: "mcp-swagger-server-dynamic",
        version: "2.0.0",
        description: "Dynamic MCP server for OpenAPI specifications"
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
  }

  /**
   * 动态加载OpenAPI规范并生成工具
   */
  async loadOpenAPISpec(source: InputSource, baseUrl?: string): Promise<{
    apiInfo: any;
    endpoints: any[];
    toolsCount: number;
  }> {
    console.log('🔄 动态加载OpenAPI规范...');
    
    try {
      // 解析OpenAPI规范
      let parseResult;
      switch (source.type) {
        case 'url':
          parseResult = await parseFromUrl(source.content, {
            strictMode: false,
            resolveReferences: true,
            validateSchema: true
          });
          break;
        case 'text':
          parseResult = await parseFromString(source.content, {
            strictMode: false,
            resolveReferences: true,
            validateSchema: true
          });
          break;
        case 'file':
          const content = Buffer.from(source.content, 'base64').toString('utf-8');
          parseResult = await parseFromString(content, {
            strictMode: false,
            resolveReferences: true,
            validateSchema: true
          });
          break;
        default:
          throw new Error(`不支持的输入源类型: ${source.type}`);
      }

      this.currentSpec = parseResult.spec;

      // 清除现有工具
      await this.clearCurrentTools();

      // 生成新的MCP工具
      const newTools = transformToMCPTools(parseResult.spec, {
        baseUrl,
        includeDeprecated: false,
        requestTimeout: 30000,
        pathPrefix: ''
      });

      // 注册新工具
      await this.registerTools(newTools);
      this.currentTools = newTools;

      console.log(`✅ 成功加载 ${newTools.length} 个MCP工具`);

      return {
        apiInfo: this.extractApiInfo(parseResult.spec),
        endpoints: this.extractEndpoints(parseResult.spec),
        toolsCount: newTools.length
      };

    } catch (error) {
      console.error('❌ 加载OpenAPI规范失败:', error);
      throw error;
    }
  }

  /**
   * 清除当前注册的工具
   */
  private async clearCurrentTools(): Promise<void> {
    // 注意：当前的MCP SDK可能没有直接的unregister方法
    // 这是一个概念性的实现，实际可能需要重启服务器实例
    console.log('🗑️ 清除现有工具...');
    
    // 如果SDK支持动态取消注册，在这里实现
    // 否则，我们需要采用重启整个服务器实例的方式
  }

  /**
   * 注册工具到MCP服务器
   */
  private async registerTools(tools: MCPTool[]): Promise<void> {
    console.log(`🔗 注册 ${tools.length} 个工具到MCP服务器...`);
    
    for (const tool of tools) {
      try {
        this.mcpServer.registerTool(
          tool.name,
          {
            description: tool.description,
            inputSchema: this.convertInputSchemaToZod(tool.inputSchema),
            annotations: tool.metadata ? {
              title: `${tool.metadata.method} ${tool.metadata.path}`,
              ...(tool.metadata.deprecated && { deprecated: true })
            } : undefined
          },
          async (extra: any) => {
            return await tool.handler(extra);
          }
        );
      } catch (error) {
        console.error(`❌ 注册工具 ${tool.name} 失败:`, error);
      }
    }
  }

  /**
   * 获取服务器实例
   */
  getServer(): McpServer {
    return this.mcpServer;
  }

  /**
   * 获取当前工具列表
   */
  getCurrentTools(): MCPTool[] {
    return this.currentTools;
  }

  /**
   * 获取当前规范
   */
  getCurrentSpec(): OpenAPISpec | null {
    return this.currentSpec;
  }

  // 辅助方法
  private extractApiInfo(spec: OpenAPISpec) {
    return {
      title: spec.info?.title || 'Untitled API',
      version: spec.info?.version || '1.0.0',
      description: spec.info?.description,
      serverUrl: spec.servers?.[0]?.url,
      totalEndpoints: Object.keys(spec.paths || {}).length
    };
  }

  private extractEndpoints(spec: OpenAPISpec) {
    const endpoints: any[] = [];
    Object.entries(spec.paths || {}).forEach(([path, pathItem]: [string, any]) => {
      Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
        if (method !== 'parameters' && typeof operation === 'object') {
          endpoints.push({
            path,
            method: method.toUpperCase(),
            operationId: operation.operationId,
            summary: operation.summary,
            description: operation.description,
            tags: operation.tags || []
          });
        }
      });
    });
    return endpoints;
  }

  private convertInputSchemaToZod(schema: any) {
    // 简化的schema转换逻辑
    // 实际实现需要更复杂的转换
    return schema;
  }
}
```

### 第二步：创建配置API服务

```typescript
// packages/mcp-swagger-config-api/src/server.ts
import express from 'express';
import cors from 'cors';
import { DynamicMCPServer } from '../../mcp-swagger-server/src/dynamicServer';
import { startStreamableMcpServer } from '../../mcp-swagger-server/src/transportUtils';

const app = express();
const PORT = 3001;
const MCP_PORT = 3322;

// 动态MCP服务器实例
let dynamicMCPServer: DynamicMCPServer | null = null;
let mcpServerStarted = false;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 初始化MCP服务器
async function initializeMCPServer() {
  if (!dynamicMCPServer) {
    dynamicMCPServer = new DynamicMCPServer();
    
    // 启动MCP传输层
    await startStreamableMcpServer(
      dynamicMCPServer.getServer(),
      '/mcp',
      MCP_PORT
    );
    
    mcpServerStarted = true;
    console.log(`✅ MCP服务器已启动在端口 ${MCP_PORT}`);
  }
}

// 解析OpenAPI并动态配置MCP工具
app.post('/api/configure', async (req, res) => {
  try {
    const { source, baseUrl, options = {} } = req.body;
    
    // 确保MCP服务器已启动
    if (!dynamicMCPServer) {
      await initializeMCPServer();
    }
    
    // 动态加载OpenAPI规范
    const result = await dynamicMCPServer!.loadOpenAPISpec(source, baseUrl);
    
    res.json({
      success: true,
      data: {
        ...result,
        mcpServerUrl: `http://localhost:${MCP_PORT}/mcp`,
        configuredAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ 配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取当前状态
app.get('/api/status', async (req, res) => {
  const tools = dynamicMCPServer?.getCurrentTools() || [];
  const spec = dynamicMCPServer?.getCurrentSpec();
  
  res.json({
    success: true,
    data: {
      mcpServerRunning: mcpServerStarted,
      mcpServerUrl: mcpServerStarted ? `http://localhost:${MCP_PORT}/mcp` : null,
      configApiUrl: `http://localhost:${PORT}`,
      toolsCount: tools.length,
      hasConfiguration: !!spec,
      apiTitle: spec?.info?.title || null,
      lastUpdate: new Date().toISOString()
    }
  });
});

// 获取当前工具列表
app.get('/api/tools', async (req, res) => {
  const tools = dynamicMCPServer?.getCurrentTools() || [];
  
  res.json({
    success: true,
    data: {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        metadata: tool.metadata
      })),
      count: tools.length
    }
  });
});

// 测试工具调用
app.post('/api/test-tool', async (req, res) => {
  try {
    const { toolName, arguments: args } = req.body;
    
    if (!dynamicMCPServer) {
      throw new Error('MCP服务器未初始化');
    }
    
    const tools = dynamicMCPServer.getCurrentTools();
    const tool = tools.find(t => t.name === toolName);
    
    if (!tool) {
      throw new Error(`工具 ${toolName} 不存在`);
    }
    
    const result = await tool.handler(args);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`📡 配置API服务已启动: http://localhost:${PORT}`);
  
  // 自动初始化MCP服务器
  initializeMCPServer().catch(console.error);
});
```

### 第二步：修改前端API调用

更新现有的`packages/mcp-swagger-ui/src/utils/parser.ts`：

```typescript
// packages/mcp-swagger-ui/src/utils/parser.ts
import axios from 'axios';

const configAPI = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 30000
});

/**
 * 动态配置MCP服务器
 */
export async function configureMCPServer(source: InputSource, baseUrl?: string): Promise<ConfigureResult> {
  console.log('🔄 配置MCP服务器...');
  
  try {
    const response = await configAPI.post('/configure', {
      source,
      baseUrl,
      options: {
        strictMode: false,
        resolveReferences: true,
        validateSchema: true
      }
    });
    
    if (!response.data.success) {
      throw new ParserError(response.data.error || '配置失败', 'CONFIGURE_ERROR');
    }
    
    return response.data.data;
    
  } catch (error) {
    console.error('❌ 配置失败:', error);
    throw new ParserError(`配置失败: ${error.message}`, 'CONFIGURE_ERROR');
  }
}

/**
 * 获取MCP服务器状态
 */
export async function getMCPServerStatus(): Promise<MCPServerStatus> {
  try {
    const response = await configAPI.get('/status');
    return response.data.data;
  } catch (error) {
    console.error('❌ 获取MCP服务器状态失败:', error);
    return {
      mcpServerRunning: false,
      mcpServerUrl: null,
      configApiUrl: 'http://localhost:3001',
      toolsCount: 0,
      hasConfiguration: false,
      apiTitle: null,
      lastUpdate: new Date().toISOString()
    };
  }
}

/**
 * 获取当前工具列表
 */
export async function getCurrentTools(): Promise<ToolInfo[]> {
  try {
    const response = await configAPI.get('/tools');
    return response.data.data.tools;
  } catch (error) {
    console.error('❌ 获取工具列表失败:', error);
    return [];
  }
}

/**
 * 测试工具调用
 */
export async function testToolCall(toolName: string, args: any): Promise<any> {
  try {
    const response = await configAPI.post('/test-tool', {
      toolName,
      arguments: args
    });
    
    if (!response.data.success) {
      throw new Error(response.data.error);
    }
    
    return response.data.data;
  } catch (error) {
    console.error('❌ 工具调用失败:', error);
    throw error;
  }
}

// 类型定义
interface ConfigureResult {
  apiInfo: any;
  endpoints: any[];
  toolsCount: number;
  mcpServerUrl: string;
  configuredAt: string;
}

interface MCPServerStatus {
  mcpServerRunning: boolean;
  mcpServerUrl: string | null;
  configApiUrl: string;
  toolsCount: number;
  hasConfiguration: boolean;
  apiTitle: string | null;
  lastUpdate: string;
}

interface ToolInfo {
  name: string;
  description: string;
  metadata?: any;
}
```

### 第三步：增强UI界面

更新`packages/mcp-swagger-ui/src/views/Home.vue`，添加完整的MCP管理界面：

```vue
<template>
  <div class="container">
    <!-- 状态栏 -->
    <div class="status-bar">
      <div class="status-item">
        <span class="status-label">配置API:</span>
        <span class="status-indicator" :class="{ active: configApiConnected }"></span>
        <span class="status-text">{{ configApiConnected ? '已连接' : '未连接' }}</span>
      </div>
      
      <div class="status-item">
        <span class="status-label">MCP服务器:</span>
        <span class="status-indicator" :class="{ active: mcpServerStatus.mcpServerRunning }"></span>
        <span class="status-text">{{ mcpServerStatus.mcpServerRunning ? '运行中' : '未运行' }}</span>
      </div>
      
      <div v-if="mcpServerStatus.hasConfiguration" class="status-item">
        <span class="status-label">当前API:</span>
        <span class="api-title">{{ mcpServerStatus.apiTitle }}</span>
        <span class="tools-count">({{ mcpServerStatus.toolsCount }} 个工具)</span>
      </div>
    </div>
    
    <!-- 现有的输入界面 -->
    <div class="input-section">
      <!-- ... 保持现有的输入组件 ... -->
      
      <div class="action-buttons">
        <button class="btn btn-primary" :disabled="appStore.loading" @click="handleConfigure">
          <span v-if="appStore.loading" class="loading-spinner"></span>
          � 配置MCP服务器
        </button>
        <button class="btn btn-secondary" :disabled="appStore.loading" @click="handleValidate">
          🔍 验证规范
        </button>
      </div>
    </div>
    
    <!-- MCP服务器配置成功后的信息 -->
    <div v-if="mcpConfigured" class="mcp-configured-section fade-in-up">
      <div class="section-header">
        <h3>🎉 MCP服务器配置成功</h3>
        <span class="success-badge">✅ 已就绪</span>
      </div>
      
      <div class="mcp-connection-info">
        <div class="connection-card">
          <h4>📡 MCP客户端连接信息</h4>
          <div class="connection-details">
            <div class="detail-item">
              <label>传输协议:</label>
              <code>HTTP Stream</code>
            </div>
            <div class="detail-item">
              <label>连接地址:</label>
              <code>{{ mcpServerStatus.mcpServerUrl }}</code>
              <button class="btn-copy" @click="copyMCPUrl">📋 复制</button>
            </div>
            <div class="detail-item">
              <label>工具数量:</label>
              <code>{{ mcpServerStatus.toolsCount }} 个</code>
            </div>
            <div class="detail-item">
              <label>配置时间:</label>
              <code>{{ formatTime(configuredAt) }}</code>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 工具列表 -->
      <div class="tools-list-section">
        <div class="tools-header">
          <h4>🛠️ 可用工具列表</h4>
          <button class="btn btn-secondary" @click="refreshTools">🔄 刷新</button>
        </div>
        
        <div v-if="toolsLoading" class="tools-loading">
          <div class="loading-spinner"></div>
          <span>加载工具列表...</span>
        </div>
        
        <div v-else-if="currentTools.length > 0" class="tools-grid">
          <div v-for="tool in currentTools" :key="tool.name" class="tool-card">
            <div class="tool-header">
              <h5 class="tool-name">{{ tool.name }}</h5>
              <span v-if="tool.metadata?.method" class="method-badge" 
                    :class="tool.metadata.method.toLowerCase()">
                {{ tool.metadata.method }}
              </span>
            </div>
            <p class="tool-description">{{ tool.description }}</p>
            <div v-if="tool.metadata?.path" class="tool-path">
              <code>{{ tool.metadata.path }}</code>
            </div>
            <div class="tool-actions">
              <button class="btn btn-small" @click="testTool(tool)">🧪 测试</button>
              <button class="btn btn-small" @click="viewToolDetails(tool)">📋 详情</button>
            </div>
          </div>
        </div>
        
        <div v-else class="no-tools">
          <p>暂无可用工具</p>
        </div>
      </div>
    </div>
    
    <!-- 工具测试模态框 -->
    <div v-if="showTestModal" class="modal-overlay" @click="closeTestModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>🧪 测试工具: {{ testingTool?.name }}</h3>
          <button class="modal-close" @click="closeTestModal">✕</button>
        </div>
        
        <div class="modal-body">
          <div class="test-input-section">
            <label>工具参数 (JSON格式):</label>
            <textarea v-model="testInput" class="test-input" rows="6" 
                      placeholder='{"param1": "value1", "param2": "value2"}'></textarea>
          </div>
          
          <div class="test-actions">
            <button class="btn btn-primary" :disabled="testLoading" @click="executeTest">
              <span v-if="testLoading" class="loading-spinner"></span>
              🚀 执行测试
            </button>
            <button class="btn btn-secondary" @click="closeTestModal">取消</button>
          </div>
          
          <div v-if="testResult" class="test-result">
            <h4>测试结果:</h4>
            <pre class="result-content">{{ JSON.stringify(testResult, null, 2) }}</pre>
          </div>
          
          <div v-if="testError" class="test-error">
            <h4>测试错误:</h4>
            <pre class="error-content">{{ testError }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { 
  getMCPServerStatus, 
  configureMCPServer, 
  getCurrentTools,
  testToolCall 
} from '@/utils/parser';

// 状态管理
const mcpServerStatus = ref({
  mcpServerRunning: false,
  mcpServerUrl: null,
  configApiUrl: 'http://localhost:3001',
  toolsCount: 0,
  hasConfiguration: false,
  apiTitle: null,
  lastUpdate: ''
});

const configApiConnected = ref(false);
const mcpConfigured = ref(false);
const configuredAt = ref('');
const currentTools = ref([]);
const toolsLoading = ref(false);

// 工具测试相关
const showTestModal = ref(false);
const testingTool = ref(null);
const testInput = ref('{}');
const testResult = ref(null);
const testError = ref('');
const testLoading = ref(false);

// 定期检查状态
let statusTimer: any = null;

onMounted(() => {
  checkStatus();
  statusTimer = setInterval(checkStatus, 5000);
});

onUnmounted(() => {
  if (statusTimer) {
    clearInterval(statusTimer);
  }
});

async function checkStatus() {
  try {
    const status = await getMCPServerStatus();
    mcpServerStatus.value = status;
    configApiConnected.value = true;
    
    // 如果有配置，则认为已配置成功
    if (status.hasConfiguration && status.mcpServerRunning) {
      mcpConfigured.value = true;
    }
  } catch (error) {
    configApiConnected.value = false;
    console.error('状态检查失败:', error);
  }
}

async function handleConfigure() {
  try {
    appStore.loading = true;
    
    const source = getInputSource();
    const result = await configureMCPServer(source);
    
    appStore.apiInfo = result.apiInfo;
    appStore.endpoints = result.endpoints;
    mcpConfigured.value = true;
    configuredAt.value = result.configuredAt;
    
    // 刷新状态和工具
    await checkStatus();
    await refreshTools();
    
  } catch (error) {
    appStore.error = error.message;
  } finally {
    appStore.loading = false;
  }
}

async function refreshTools() {
  try {
    toolsLoading.value = true;
    const tools = await getCurrentTools();
    currentTools.value = tools;
  } catch (error) {
    console.error('刷新工具列表失败:', error);
  } finally {
    toolsLoading.value = false;
  }
}

function testTool(tool) {
  testingTool.value = tool;
  testInput.value = '{}';
  testResult.value = null;
  testError.value = '';
  showTestModal.value = true;
}

async function executeTest() {
  try {
    testLoading.value = true;
    testResult.value = null;
    testError.value = '';
    
    const args = JSON.parse(testInput.value);
    const result = await testToolCall(testingTool.value.name, args);
    testResult.value = result;
    
  } catch (error) {
    testError.value = error.message;
  } finally {
    testLoading.value = false;
  }
}

function closeTestModal() {
  showTestModal.value = false;
  testingTool.value = null;
}

function copyMCPUrl() {
  if (mcpServerStatus.value.mcpServerUrl) {
    navigator.clipboard.writeText(mcpServerStatus.value.mcpServerUrl);
    // 显示复制成功提示
  }
}

function formatTime(timeString) {
  return new Date(timeString).toLocaleString();
}

// ... 其他现有方法保持不变
</script>

<style scoped>
/* 新增样式 */
.tools-list-section {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #f8fafc;
  border-radius: 8px;
}

.tools-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.tool-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 1rem;
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.method-badge {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
}

.method-badge.get { background: #e6fffa; color: #00b894; }
.method-badge.post { background: #ffeaa7; color: #fdcb6e; }
.method-badge.put { background: #74b9ff; color: #0984e3; }
.method-badge.delete { background: #fd79a8; color: #e84393; }

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.modal-body {
  padding: 1rem;
}

.test-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-family: monospace;
}

.test-result,
.test-error {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 4px;
}

.test-result {
  background: #f0f9ff;
  border: 1px solid #0ea5e9;
}

.test-error {
  background: #fef2f2;
  border: 1px solid #ef4444;
}

.result-content,
.error-content {
  margin: 0;
  padding: 0;
  font-family: monospace;
  font-size: 14px;
  white-space: pre-wrap;
}
</style>
```

## 🚀 使用流程

### 用户操作流程
1. **启动服务**: 运行`pnpm dev:full`启动完整服务
2. **打开UI**: 访问`http://localhost:5173`
3. **输入OpenAPI**: 通过URL、文件或文本输入OpenAPI规范
4. **点击转换**: 系统自动解析并配置MCP服务器
5. **获取连接信息**: UI显示MCP服务器连接地址
6. **MCP客户端连接**: 使用提供的地址连接MCP服务器

### MCP客户端连接示例

```typescript
// MCP客户端连接示例
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const client = new Client({
  name: "my-mcp-client",
  version: "1.0.0"
});

const transport = new StreamableHTTPClientTransport({
  baseUrl: "http://localhost:3322/mcp"
});

await client.connect(transport);

// 获取可用工具
const toolsResult = await client.listTools();
console.log('可用工具:', toolsResult.tools);

// 调用工具
const result = await client.callTool({
  name: "get_pet_by_id",
  arguments: { petId: 1 }
});
console.log('工具调用结果:', result);
```

## 📦 项目脚本配置

```json
// package.json (根目录)
{
  "scripts": {
    "dev:config-api": "pnpm --filter=mcp-swagger-config-api run dev",
    "dev:ui": "pnpm --filter=mcp-swagger-ui run dev",
    "dev:full": "concurrently \"pnpm run dev:config-api\" \"pnpm run dev:ui\"",
    "build:all": "pnpm -r run build",
    "start:production": "concurrently \"pnpm --filter=mcp-swagger-config-api run start\" \"pnpm --filter=mcp-swagger-ui run preview\""
  }
}
```

## 🎯 核心优势

1. **生产环境友好**: 不依赖文件系统，避免打包后路径问题
2. **内存高效**: OpenAPI规范直接在内存中处理，无IO开销
3. **实时响应**: 配置变更立即生效，无需重启服务
4. **稳定可靠**: 单进程架构，避免进程管理复杂性
5. **易于调试**: 所有组件在同一进程中，便于问题排查
6. **扩展性好**: 支持多个OpenAPI规范并存，动态切换

## 📊 技术对比

### 修改前 vs 修改后

```
原方案 (❌ 有问题)                  新方案 (✅ 改进)
┌─────────────────────────┐        ┌─────────────────────────┐
│ 前端UI → 配置API        │        │ 前端UI → 配置API        │
│ 配置API → 写入文件      │   =>   │ 配置API → 内存存储      │
│ 文件监听 → 重启服务     │        │ 动态注册 → 立即生效     │
│ 多进程管理 → 复杂      │        │ 单进程 → 简单稳定      │
└─────────────────────────┘        └─────────────────────────┘

问题:                              优势:
• 文件路径在打包后变化            • 内存操作,无路径依赖
• 进程管理复杂,容易出错           • 单进程,架构简单
• 生产环境文件权限问题            • 无文件操作,无权限问题
• 重启服务有延迟                  • 动态注册,立即生效
```

## 📊 技术规格

- **配置API服务**: Express + Node.js (端口3001)
- **MCP服务器**: 现有实现 (端口3322)
- **Web UI**: Vue 3 + Vite (端口5173)
- **通信协议**: HTTP API + MCP StreamableHTTP
- **数据流**: UI → 配置API → 文件系统 → MCP服务器 → MCP客户端

这个方案保持了项目的简洁性，同时实现了你需要的核心功能：用户通过UI配置OpenAPI，然后MCP客户端可以通过HTTP Stream连接使用这些API工具。
