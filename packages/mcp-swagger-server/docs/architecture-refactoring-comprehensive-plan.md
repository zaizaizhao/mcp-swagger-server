# MCP Swagger Server 架构重构综合方案

## 目标与设计原则

### 核心目标
1. **保持向下兼容**：现有的独立MCP服务器功能完全保留
2. **提供工具库接口**：可被NestJS等框架集成使用
3. **实现动态注册**：支持运行时动态注册/注销MCP工具
4. **提升可复用性**：核心逻辑抽象为独立模块
5. **生产级稳定性**：内存管理、错误处理、监控能力

### 设计原则
- **单一职责**：每个模块专注特定功能
- **依赖倒置**：核心逻辑不依赖具体传输层
- **开闭原则**：易于扩展新传输协议和工具类型
- **接口隔离**：提供最小必要的公开接口

## 重构架构设计

### 分层架构
```
┌─────────────────────────────────────────────────────────────┐
│                    Applications Layer                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐ │
│  │  Standalone CLI │  │   NestJS API    │  │  Other Apps   │ │
│  └─────────────────┘  └─────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   Adapters Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐ │
│  │   CLI Adapter   │  │  HTTP Adapter   │  │ Future...     │ │
│  └─────────────────┘  └─────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                      Core Library                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐ │
│  │  Tool Manager   │  │  MCP Registry   │  │  Transformer  │ │
│  └─────────────────┘  └─────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   Foundation Layer                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐ │
│  │    Transport    │  │    Utilities    │  │     Types     │ │
│  └─────────────────┘  └─────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 核心模块设计

### 1. 工具管理器 (ToolManager)

```typescript
interface ToolManager {
  // 动态注册工具
  registerTool(tool: MCPTool): Promise<void>;
  registerTools(tools: MCPTool[]): Promise<void>;
  
  // 动态注销工具
  unregisterTool(toolId: string): Promise<void>;
  unregisterTools(toolIds: string[]): Promise<void>;
  
  // 工具查询
  getTool(toolId: string): MCPTool | undefined;
  getTools(): MCPTool[];
  getToolsByTag(tag: string): MCPTool[];
  
  // 生命周期管理
  dispose(): Promise<void>;
  
  // 事件通知
  on(event: 'toolRegistered' | 'toolUnregistered', handler: Function): void;
}
```

### 2. MCP注册中心 (MCPRegistry)

```typescript
interface MCPRegistry {
  // MCP服务器管理
  createServer(config: McpServerConfig): Promise<McpServer>;
  getServer(serverId: string): McpServer | undefined;
  destroyServer(serverId: string): Promise<void>;
  
  // 工具绑定
  bindToolsToServer(serverId: string, tools: MCPTool[]): Promise<void>;
  unbindToolsFromServer(serverId: string, toolIds: string[]): Promise<void>;
  
  // 健康检查
  getServerStatus(serverId: string): ServerStatus;
  getAllServersStatus(): Map<string, ServerStatus>;
}
```

### 3. 转换器 (Transformer)

```typescript
interface Transformer {
  // OpenAPI转换
  transformFromOpenAPI(spec: OpenAPISpec, options?: TransformOptions): Promise<MCPTool[]>;
  transformFromFile(filePath: string, options?: TransformOptions): Promise<MCPTool[]>;
  transformFromUrl(url: string, options?: TransformOptions): Promise<MCPTool[]>;
  
  // 验证与规范化
  validateTools(tools: MCPTool[]): ValidationResult;
  normalizeTools(tools: MCPTool[]): MCPTool[];
}
```

## 新的项目结构

```
packages/mcp-swagger-server/
├── src/
│   ├── core/                    # 核心工具库
│   │   ├── ToolManager.ts       # 工具管理器
│   │   ├── MCPRegistry.ts       # MCP注册中心
│   │   ├── Transformer.ts       # 转换器
│   │   └── index.ts            # 核心API导出
│   │
│   ├── adapters/               # 适配器层
│   │   ├── CLIAdapter.ts       # CLI适配器
│   │   ├── HTTPAdapter.ts      # HTTP适配器
│   │   └── index.ts           # 适配器导出
│   │
│   ├── lib/                   # 兼容层(保持向下兼容)
│   │   ├── server.ts          # 原server.ts(封装核心API)
│   │   ├── initTools.ts       # 原initTools.ts(封装核心API)
│   │   └── index.ts          # 原index.ts(保持不变)
│   │
│   ├── transport/             # 传输层
│   │   ├── stdio.ts          # STDIO传输
│   │   ├── sse.ts            # SSE传输
│   │   ├── streamable.ts     # HTTP Stream传输
│   │   └── index.ts         # 传输层导出
│   │
│   ├── utils/                # 工具类
│   │   ├── logger.ts         # 日志工具
│   │   ├── config.ts         # 配置管理
│   │   └── health.ts         # 健康检查
│   │
│   └── types/                # 类型定义
│       ├── core.ts           # 核心类型
│       ├── adapters.ts       # 适配器类型
│       └── index.ts         # 类型导出
│
├── examples/                 # 使用示例
│   ├── standalone-cli.ts     # 独立CLI示例
│   ├── nestjs-integration.ts # NestJS集成示例
│   └── dynamic-tools.ts      # 动态工具示例
│
└── docs/                    # 文档
    ├── API.md               # API文档
    ├── MIGRATION.md         # 迁移指南
    └── EXAMPLES.md          # 示例文档
```

## 核心实现计划

### Phase 1: 核心库重构

#### 1.1 ToolManager 实现
```typescript
// src/core/ToolManager.ts
export class ToolManager implements IToolManager {
  private tools = new Map<string, MCPTool>();
  private eventEmitter = new EventEmitter();
  
  async registerTool(tool: MCPTool): Promise<void> {
    // 验证工具
    const validation = this.validateTool(tool);
    if (!validation.valid) {
      throw new Error(`Invalid tool: ${validation.errors.join(', ')}`);
    }
    
    // 注册工具
    this.tools.set(tool.id, tool);
    
    // 触发事件
    this.eventEmitter.emit('toolRegistered', tool);
    
    console.log(`✅ Tool registered: ${tool.id}`);
  }
  
  async registerTools(tools: MCPTool[]): Promise<void> {
    for (const tool of tools) {
      await this.registerTool(tool);
    }
  }
  
  // ... 其他方法实现
}
```

#### 1.2 MCPRegistry 实现
```typescript
// src/core/MCPRegistry.ts
export class MCPRegistry implements IMCPRegistry {
  private servers = new Map<string, McpServer>();
  private serverConfigs = new Map<string, McpServerConfig>();
  
  async createServer(config: McpServerConfig): Promise<McpServer> {
    const server = new McpServer(
      {
        name: config.name || "mcp-swagger-server",
        version: config.version || "2.0.0",
        description: config.description
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    const serverId = config.id || uuidv4();
    this.servers.set(serverId, server);
    this.serverConfigs.set(serverId, config);
    
    console.log(`🚀 MCP Server created: ${serverId}`);
    return server;
  }
  
  // ... 其他方法实现
}
```

### Phase 2: 适配器层实现

#### 2.1 CLI适配器
```typescript
// src/adapters/CLIAdapter.ts
export class CLIAdapter {
  private toolManager: ToolManager;
  private mcpRegistry: MCPRegistry;
  private transformer: Transformer;
  
  constructor() {
    this.toolManager = new ToolManager();
    this.mcpRegistry = new MCPRegistry();
    this.transformer = new Transformer();
  }
  
  async runStandalone(options: CLIOptions): Promise<void> {
    // 创建MCP服务器
    const server = await this.mcpRegistry.createServer({
      id: 'standalone',
      name: 'mcp-swagger-server',
      version: '2.0.0'
    });
    
    // 从OpenAPI生成工具
    const tools = await this.transformer.transformFromFile(
      options.swaggerFile || './swagger.json'
    );
    
    // 注册工具
    await this.toolManager.registerTools(tools);
    
    // 绑定到服务器
    await this.mcpRegistry.bindToolsToServer('standalone', tools);
    
    // 启动传输层
    await this.startTransport(server, options.transport);
  }
  
  // ... 其他方法
}
```

#### 2.2 HTTP适配器
```typescript
// src/adapters/HTTPAdapter.ts
export class HTTPAdapter {
  private toolManager: ToolManager;
  private mcpRegistry: MCPRegistry;
  
  constructor() {
    this.toolManager = new ToolManager();
    this.mcpRegistry = new MCPRegistry();
  }
  
  // 提供给NestJS等框架的接口
  async createManagedServer(config: McpServerConfig): Promise<string> {
    const server = await this.mcpRegistry.createServer(config);
    return server.id;
  }
  
  async registerToolsToServer(serverId: string, tools: MCPTool[]): Promise<void> {
    await this.toolManager.registerTools(tools);
    await this.mcpRegistry.bindToolsToServer(serverId, tools);
  }
  
  async getServerHandler(serverId: string): Promise<RequestHandler> {
    const server = this.mcpRegistry.getServer(serverId);
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }
    
    return createMcpHttpHandler(server);
  }
  
  // ... 其他方法
}
```

### Phase 3: 兼容层实现

#### 3.1 保持原有API不变
```typescript
// src/lib/server.ts (重构版，保持接口不变)
import { CLIAdapter } from '../adapters/CLIAdapter';

const cliAdapter = new CLIAdapter();

// 保持原有API，内部使用新架构
export async function createMcpServer() {
  return cliAdapter.createStandaloneServer();
}

export async function runStdioServer(): Promise<void> {
  await cliAdapter.runStandalone({ transport: 'stdio' });
}

export async function runSseServer(endpoint = "/sse", port = 3322): Promise<void> {
  await cliAdapter.runStandalone({ 
    transport: 'sse', 
    endpoint, 
    port 
  });
}

export async function runStreamableServer(endpoint = "/mcp", port = 3322): Promise<void> {
  await cliAdapter.runStandalone({ 
    transport: 'streamable', 
    endpoint, 
    port 
  });
}
```

#### 3.2 保持工具初始化API
```typescript
// src/lib/initTools.ts (重构版，保持接口不变)
import { Transformer } from '../core/Transformer';
import { ToolManager } from '../core/ToolManager';

const transformer = new Transformer();
const toolManager = new ToolManager();

// 保持原有API，内部使用新架构
export async function initTools(server: McpServer) {
  console.log("🔧 初始化 MCP 工具...");
  
  try {
    // 使用新的转换器
    const tools = await transformer.transformFromFile();
    
    console.log(`📦 成功生成 ${tools.length} 个工具`);
    printToolsSummary(tools);
    
    // 使用新的工具管理器
    await toolManager.registerTools(tools);
    
    // 绑定到服务器
    await registerToolsToMcpServer(server, tools);
    
    console.log("✅ 工具初始化完成");
    
  } catch (error) {
    console.error("❌ 初始化工具失败:", error);
    throw error;
  }
}
```

## 新的导出接口

### 核心库导出
```typescript
// src/core/index.ts
export { ToolManager } from './ToolManager';
export { MCPRegistry } from './MCPRegistry';
export { Transformer } from './Transformer';

// 类型导出
export type {
  IToolManager,
  IMCPRegistry,
  ITransformer,
  McpServerConfig,
  MCPTool,
  TransformOptions,
  ValidationResult,
  ServerStatus
} from '../types';
```

### 适配器导出
```typescript
// src/adapters/index.ts
export { CLIAdapter } from './CLIAdapter';
export { HTTPAdapter } from './HTTPAdapter';

export type {
  CLIOptions,
  HTTPAdapterConfig
} from '../types/adapters';
```

### 主入口导出
```typescript
// src/index.ts
// 兼容层导出(保持向下兼容)
export * from './lib';

// 新的核心API导出
export * from './core';
export * from './adapters';
export * from './transport';
export * from './types';

// 便捷工厂函数
export { createToolManager, createMCPRegistry, createTransformer } from './factories';
```

## 使用示例

### 1. 独立使用(兼容现有方式)
```typescript
// 现有代码无需修改
import { runStdioServer } from '@mcp-swagger/server';

runStdioServer();
```

### 2. NestJS集成使用
```typescript
// nestjs-service.ts
import { Injectable } from '@nestjs/common';
import { HTTPAdapter, MCPTool } from '@mcp-swagger/server';

@Injectable()
export class McpService {
  private httpAdapter = new HTTPAdapter();
  private serverId: string;
  
  async onModuleInit() {
    this.serverId = await this.httpAdapter.createManagedServer({
      name: 'nestjs-mcp-server'
    });
  }
  
  async registerToolsFromOpenAPI(filePath: string): Promise<void> {
    const transformer = new Transformer();
    const tools = await transformer.transformFromFile(filePath);
    
    await this.httpAdapter.registerToolsToServer(this.serverId, tools);
  }
  
  async addCustomTool(tool: MCPTool): Promise<void> {
    await this.httpAdapter.registerToolsToServer(this.serverId, [tool]);
  }
  
  getServerHandler() {
    return this.httpAdapter.getServerHandler(this.serverId);
  }
}
```

### 3. 动态工具管理
```typescript
// dynamic-tools.ts
import { ToolManager, Transformer } from '@mcp-swagger/server';

const toolManager = new ToolManager();
const transformer = new Transformer();

// 监听工具变化
toolManager.on('toolRegistered', (tool) => {
  console.log(`New tool available: ${tool.id}`);
});

// 动态添加OpenAPI工具
async function addApiTools(swaggerUrl: string) {
  const tools = await transformer.transformFromUrl(swaggerUrl);
  await toolManager.registerTools(tools);
}

// 动态移除工具
async function removeApiTools(tag: string) {
  const tools = toolManager.getToolsByTag(tag);
  const toolIds = tools.map(t => t.id);
  await toolManager.unregisterTools(toolIds);
}
```

## 迁移指南

### 对现有用户
1. **无需修改**：现有代码完全兼容，无需任何修改
2. **渐进升级**：可以逐步使用新的API获得更多功能
3. **性能提升**：新架构提供更好的性能和稳定性

### 对新用户
1. **推荐使用新API**：获得更好的灵活性和功能
2. **参考示例**：查看examples目录获得最佳实践
3. **文档齐全**：详细的API文档和迁移指南

## 总结

这个重构方案实现了您的所有目标：

1. ✅ **保持向下兼容**：现有API和功能完全保留
2. ✅ **提供工具库接口**：新的核心API可供任何框架集成
3. ✅ **支持动态注册**：运行时动态管理MCP工具
4. ✅ **架构清晰**：分层设计，职责明确
5. ✅ **易于扩展**：支持新的传输协议和工具类型
6. ✅ **生产级质量**：完善的错误处理、监控和日志

这样既满足了轻量级独立服务器的需求，又为企业级集成提供了强大的工具库，是一个"向下兼容，向上扩展"的最佳架构方案。
