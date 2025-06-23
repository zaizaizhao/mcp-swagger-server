# MCP Swagger Server 架构重构方案

## 🎯 架构愿景

基于高级架构师的视角，将 `mcp-swagger-server` 重构为一个**多场景适用的工具库**，既保持原有的轻量级独立 MCP 服务器能力，又提供可复用的工具注册组件，支持更灵活的集成方式。

## 📊 现状分析

### 当前架构问题
```
当前 mcp-swagger-server
├── 紧耦合的设计 ❌
│   ├── 硬编码的静态文件路径
│   ├── 初始化逻辑与服务器启动绑定
│   └── 缺乏模块化的工具管理
├── 缺乏灵活性 ❌
│   ├── 只能使用预定义的 OpenAPI 文件
│   ├── 无法动态配置和更新
│   └── 难以集成到其他系统
└── 复用性差 ❌
    ├── 代码难以在其他项目中复用
    ├── 缺乏标准化的 API 接口
    └── 功能边界不清晰
```

### 目标架构优势
```
目标 mcp-swagger-server v2.0
├── 多层架构设计 ✅
│   ├── 核心工具库 (Core Library)
│   ├── 服务器运行时 (Server Runtime)  
│   └── 集成适配器 (Integration Adapters)
├── 高度可配置 ✅
│   ├── 动态工具注册和管理
│   ├── 多种配置源支持
│   └── 热重载和实时更新
└── 强复用性 ✅
    ├── 标准化的 API 接口
    ├── 插件化的架构设计
    └── 多种集成方式支持
```

## 🏗️ 重构架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    应用层 (Application Layer)                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  独立MCP服务器   │  │  NestJS集成     │  │  其他系统集成   │  │
│  │  (Standalone)   │  │  (Integration)  │  │  (Custom)       │  │
│  │                │  │                │  │                │  │
│  │ • CLI启动       │  │ • HTTP API     │  │ • SDK调用       │  │
│  │ • 配置文件      │  │ • 动态配置     │  │ • 插件集成      │  │
│  │ • 轻量运行      │  │ • 实时管理     │  │ • 定制化       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────┼───────────────────────────────────────┘
                          │ 统一 API 接口
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    服务层 (Service Layer)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              MCP Tools Manager                           │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │    │
│  │  │  Registry   │ │  Lifecycle  │ │   Events    │       │    │
│  │  │   管理器    │ │    管理     │ │   事件      │       │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                │                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Configuration Manager                       │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │    │
│  │  │   Source    │ │   Schema    │ │ Validation  │       │    │
│  │  │   配置源    │ │   模式      │ │   验证      │       │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                │                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Server Runtime                              │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │    │
│  │  │ Transport   │ │ Session     │ │ Monitoring  │       │    │
│  │  │   传输层    │ │   会话      │ │   监控      │       │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────┼───────────────────────────────────────┘
                          │ 核心能力
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    核心层 (Core Layer)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               OpenAPI Tools Factory                      │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │    │
│  │  │   Parser    │ │ Transformer │ │  Generator  │       │    │
│  │  │   解析器    │ │   转换器    │ │   生成器    │       │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘       │    │
│  │        │                │                │             │    │
│  │        ▼                ▼                ▼             │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │    │
│  │  │ @mcp-swagger│ │ Tool Schema │ │ Handler Gen │       │    │
│  │  │   /parser   │ │  Mapping    │ │  Generator  │       │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## 📦 模块化设计

### 核心模块结构

```typescript
// 新的包结构
packages/mcp-swagger-server/
├── src/
│   ├── core/                    # 🔥 新增：核心工具库
│   │   ├── index.ts            # 统一导出
│   │   ├── registry/           # 工具注册管理
│   │   │   ├── tool-registry.ts
│   │   │   ├── lifecycle-manager.ts
│   │   │   └── event-emitter.ts
│   │   ├── factory/            # 工具工厂
│   │   │   ├── openapi-tools-factory.ts
│   │   │   ├── tool-generator.ts
│   │   │   └── schema-mapper.ts
│   │   ├── config/             # 配置管理
│   │   │   ├── config-manager.ts
│   │   │   ├── source-loader.ts
│   │   │   └── validator.ts
│   │   └── types/              # 类型定义
│   │       ├── tool.types.ts
│   │       ├── config.types.ts
│   │       └── registry.types.ts
│   │
│   ├── runtime/                # 🔄 重构：运行时层
│   │   ├── server/
│   │   │   ├── mcp-server.ts   # 重构的服务器
│   │   │   ├── session-manager.ts
│   │   │   └── transport-adapter.ts
│   │   ├── standalone/         # 独立运行模式
│   │   │   ├── standalone-server.ts
│   │   │   ├── cli-runner.ts
│   │   │   └── config-loader.ts
│   │   └── integration/        # 集成适配器
│   │       ├── nestjs-adapter.ts
│   │       ├── express-adapter.ts
│   │       └── sdk-adapter.ts
│   │
│   ├── adapters/               # 🔥 新增：适配器层
│   │   ├── transport/
│   │   │   ├── stdio.adapter.ts
│   │   │   ├── sse.adapter.ts
│   │   │   └── stream.adapter.ts
│   │   └── monitoring/
│   │       ├── metrics.adapter.ts
│   │       └── health.adapter.ts
│   │
│   └── legacy/                 # 🔄 保留：向后兼容
│       ├── index.ts           # 原有的导出接口
│       ├── server.ts          # 兼容性包装
│       └── tools/             # 原有工具逻辑
│
├── examples/                   # 🔥 新增：使用示例
│   ├── standalone/            # 独立服务器示例
│   ├── nestjs-integration/    # NestJS集成示例
│   └── custom-integration/    # 自定义集成示例
│
├── docs/                      # 📚 完整文档
│   ├── architecture/          # 架构文档
│   ├── api/                   # API文档
│   ├── integration/           # 集成指南
│   └── migration/             # 迁移指南
│
└── tests/                     # 🧪 完整测试
    ├── unit/                  # 单元测试
    ├── integration/           # 集成测试
    └── e2e/                   # 端到端测试
```

## 🔧 核心接口设计

### 1. 统一的工具管理接口

```typescript
// src/core/types/tool.types.ts
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
  handler: MCPToolHandler;
  metadata: ToolMetadata;
}

export interface ToolMetadata {
  source: 'openapi' | 'custom' | 'plugin';
  version: string;
  tags?: string[];
  deprecated?: boolean;
  openapi?: {
    operationId: string;
    method: string;
    path: string;
    endpoint: string;
  };
}

export interface MCPToolHandler {
  (input: any): Promise<any>;
}
```

### 2. 工具注册管理器

```typescript
// src/core/registry/tool-registry.ts
export class MCPToolRegistry {
  private tools = new Map<string, MCPToolDefinition>();
  private lifecycleManager: LifecycleManager;
  private eventEmitter: EventEmitter;

  constructor() {
    this.lifecycleManager = new LifecycleManager();
    this.eventEmitter = new EventEmitter();
  }

  /**
   * 注册单个工具
   */
  async registerTool(tool: MCPToolDefinition): Promise<void> {
    await this.lifecycleManager.beforeRegister(tool);
    
    this.tools.set(tool.name, tool);
    this.eventEmitter.emit('tool:registered', tool);
    
    await this.lifecycleManager.afterRegister(tool);
  }

  /**
   * 批量注册工具
   */
  async registerTools(tools: MCPToolDefinition[]): Promise<void> {
    await this.lifecycleManager.beforeBatchRegister(tools);
    
    for (const tool of tools) {
      await this.registerTool(tool);
    }
    
    await this.lifecycleManager.afterBatchRegister(tools);
  }

  /**
   * 取消注册工具
   */
  async unregisterTool(name: string): Promise<boolean> {
    const tool = this.tools.get(name);
    if (!tool) return false;

    await this.lifecycleManager.beforeUnregister(tool);
    
    this.tools.delete(name);
    this.eventEmitter.emit('tool:unregistered', tool);
    
    await this.lifecycleManager.afterUnregister(tool);
    return true;
  }

  /**
   * 热重载工具
   */
  async reloadTools(source: ToolSource): Promise<void> {
    const existingTools = this.getToolsBySource(source);
    
    // 取消注册旧工具
    for (const tool of existingTools) {
      await this.unregisterTool(tool.name);
    }
    
    // 注册新工具
    const newTools = await this.generateToolsFromSource(source);
    await this.registerTools(newTools);
    
    this.eventEmitter.emit('tools:reloaded', { source, tools: newTools });
  }

  /**
   * 获取所有工具
   */
  getAllTools(): MCPToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * 按条件查询工具
   */
  findTools(filter: ToolFilter): MCPToolDefinition[] {
    return this.getAllTools().filter(tool => this.matchesFilter(tool, filter));
  }

  /**
   * 获取工具统计信息
   */
  getStats(): ToolRegistryStats {
    const tools = this.getAllTools();
    return {
      total: tools.length,
      bySource: this.groupBySource(tools),
      byStatus: this.groupByStatus(tools),
      lastUpdate: new Date(),
    };
  }
}
```

### 3. OpenAPI工具工厂

```typescript
// src/core/factory/openapi-tools-factory.ts
export class OpenAPIToolsFactory {
  private parser: typeof import('mcp-swagger-parser');
  private generator: ToolGenerator;
  private schemaMapper: SchemaMapper;

  constructor() {
    this.generator = new ToolGenerator();
    this.schemaMapper = new SchemaMapper();
  }

  /**
   * 从OpenAPI规范生成工具
   */
  async createToolsFromOpenAPI(
    source: OpenAPISource,
    options: ToolGenerationOptions = {}
  ): Promise<MCPToolDefinition[]> {
    
    // 解析OpenAPI规范
    const parseResult = await this.parseOpenAPISource(source);
    
    // 生成工具定义
    const toolDefinitions = await this.generateToolDefinitions(
      parseResult.spec,
      options
    );
    
    // 创建工具处理器
    const tools = await this.createToolHandlers(toolDefinitions, options);
    
    return tools;
  }

  /**
   * 验证和标准化工具定义
   */
  async validateAndNormalizeTools(
    tools: MCPToolDefinition[]
  ): Promise<MCPToolDefinition[]> {
    const validated: MCPToolDefinition[] = [];
    
    for (const tool of tools) {
      try {
        const normalizedTool = await this.normalizeTool(tool);
        await this.validateTool(normalizedTool);
        validated.push(normalizedTool);
      } catch (error) {
        console.warn(`Tool validation failed for ${tool.name}:`, error);
      }
    }
    
    return validated;
  }

  /**
   * 支持多种配置源
   */
  async loadFromSource(source: ToolSource): Promise<MCPToolDefinition[]> {
    switch (source.type) {
      case 'openapi-url':
        return this.createToolsFromOpenAPI({ type: 'url', url: source.url });
      
      case 'openapi-file':
        return this.createToolsFromOpenAPI({ type: 'file', path: source.path });
      
      case 'openapi-content':
        return this.createToolsFromOpenAPI({ type: 'content', content: source.content });
      
      case 'config-file':
        return this.loadFromConfigFile(source.path);
      
      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }
  }

  private async parseOpenAPISource(source: OpenAPISource) {
    switch (source.type) {
      case 'url':
        return await this.parser.parseFromUrl(source.url);
      case 'file':
        return await this.parser.parseFromFile(source.path);
      case 'content':
        return await this.parser.parseFromString(source.content);
      default:
        throw new Error(`Invalid OpenAPI source type: ${source.type}`);
    }
  }
}
```

### 4. 配置管理器

```typescript
// src/core/config/config-manager.ts
export class ConfigurationManager {
  private configs = new Map<string, Configuration>();
  private watchers = new Map<string, ConfigWatcher>();

  /**
   * 加载配置
   */
  async loadConfiguration(source: ConfigSource): Promise<Configuration> {
    const loader = this.getSourceLoader(source.type);
    const config = await loader.load(source);
    
    await this.validateConfiguration(config);
    this.configs.set(config.id, config);
    
    // 设置配置监听（如果支持）
    if (source.watch && loader.supportsWatch()) {
      await this.setupConfigWatcher(config.id, source);
    }
    
    return config;
  }

  /**
   * 动态更新配置
   */
  async updateConfiguration(id: string, updates: Partial<Configuration>): Promise<void> {
    const config = this.configs.get(id);
    if (!config) {
      throw new Error(`Configuration not found: ${id}`);
    }

    const updatedConfig = { ...config, ...updates };
    await this.validateConfiguration(updatedConfig);
    
    this.configs.set(id, updatedConfig);
    
    // 触发配置变更事件
    this.emit('config:updated', { id, config: updatedConfig, changes: updates });
  }

  /**
   * 配置热重载
   */
  private async setupConfigWatcher(id: string, source: ConfigSource): Promise<void> {
    const watcher = new ConfigWatcher(source);
    
    watcher.on('change', async (newConfig) => {
      try {
        await this.updateConfiguration(id, newConfig);
        console.log(`✅ Configuration reloaded: ${id}`);
      } catch (error) {
        console.error(`❌ Configuration reload failed: ${id}`, error);
      }
    });
    
    this.watchers.set(id, watcher);
    await watcher.start();
  }
}
```

## 🚀 使用场景和集成方式

### 场景1: 独立轻量级MCP服务器 (保持现有功能)

```typescript
// 简单CLI启动方式 (保持向后兼容)
import { runStandaloneServer } from '@mcp-swagger/server';

// 方式1: 使用配置文件 (新增)
await runStandaloneServer({
  configFile: './mcp-server.config.json',
  transport: 'streamable',
  port: 3322
});

// 方式2: 程序化配置 (新增)
await runStandaloneServer({
  tools: {
    sources: [
      {
        type: 'openapi-url',
        url: 'https://petstore.swagger.io/v2/swagger.json'
      }
    ]
  },
  server: {
    transport: 'streamable',
    port: 3322
  }
});

// 方式3: 原有方式 (保持兼容)
import { runStreamableServer } from '@mcp-swagger/server/legacy';
await runStreamableServer('/mcp', 3322);
```

### 场景2: NestJS/Express集成

```typescript
// NestJS集成适配器
import { MCPToolsModule } from '@mcp-swagger/server/adapters/nestjs';

@Module({
  imports: [
    MCPToolsModule.forRoot({
      sources: [
        {
          type: 'openapi-content',
          content: userProvidedOpenAPISpec
        }
      ],
      options: {
        enableHotReload: true,
        cacheEnabled: true
      }
    })
  ]
})
export class AppModule {}

// 在Controller中使用
@Controller('mcp')
export class MCPController {
  constructor(
    private readonly toolsRegistry: MCPToolRegistry,
    private readonly mcpServer: MCPServer
  ) {}

  @Post('configure')
  async configure(@Body() config: OpenAPIConfigDto) {
    // 动态重新配置工具
    await this.toolsRegistry.reloadTools({
      type: 'openapi-content',
      content: config.openApiSpec
    });
    
    return {
      success: true,
      toolsCount: this.toolsRegistry.getAllTools().length
    };
  }
}
```

### 场景3: SDK方式集成

```typescript
// 作为SDK使用
import { MCPToolsFactory, MCPToolRegistry } from '@mcp-swagger/server/core';

const factory = new MCPToolsFactory();
const registry = new MCPToolRegistry();

// 生成工具
const tools = await factory.createToolsFromOpenAPI({
  type: 'url',
  url: 'https://api.example.com/openapi.json'
});

// 注册工具
await registry.registerTools(tools);

// 获取工具信息
const allTools = registry.getAllTools();
const apiTools = registry.findTools({ source: 'openapi' });

// 执行工具
const result = await tools[0].handler({ petId: 123 });
```

## 📋 迁移和兼容性策略

### 向后兼容保证

```typescript
// packages/mcp-swagger-server/src/legacy/index.ts
// 保持所有原有的导出接口不变

export { createMcpServer, runStdioServer, runSseServer, runStreamableServer } from './server';
export { initTools } from './tools/initTools';
export * from './transportUtils';

// 新增的导出 (可选升级)
export { MCPToolRegistry, OpenAPIToolsFactory } from '../core';
export { StandaloneServer } from '../runtime/standalone';
export { NestJSAdapter } from '../adapters/integration';
```

### 渐进式迁移路径

```typescript
// 阶段1: 保持现有代码不变
import { runStreamableServer } from '@mcp-swagger/server';  // 继续工作

// 阶段2: 逐步使用新功能
import { runStreamableServer } from '@mcp-swagger/server/legacy';  // 明确使用legacy
import { MCPToolRegistry } from '@mcp-swagger/server/core';         // 尝试新功能

// 阶段3: 完全迁移到新架构
import { StandaloneServer } from '@mcp-swagger/server/runtime';     // 使用新架构
```

## 🎯 实施计划

### Phase 1: 核心架构搭建 (1-2周)
1. **重构核心模块**
   - 实现 `MCPToolRegistry`
   - 实现 `OpenAPIToolsFactory`
   - 实现 `ConfigurationManager`

2. **保持向后兼容**
   - 创建 `legacy` 模块
   - 确保现有API不变
   - 添加兼容性测试

### Phase 2: 运行时层开发 (1-2周)
1. **独立服务器重构**
   - 实现 `StandaloneServer`
   - 支持配置文件方式
   - 热重载功能

2. **集成适配器开发**
   - NestJS适配器
   - Express适配器
   - SDK接口

### Phase 3: 高级特性 (1-2周)
1. **监控和观测**
   - 性能指标收集
   - 健康检查
   - 错误追踪

2. **文档和示例**
   - 完整的API文档
   - 集成示例代码
   - 迁移指南

## 💡 架构优势总结

### ✅ 技术优势
1. **模块化设计**: 清晰的分层架构，职责分离
2. **高度可配置**: 支持多种配置源和动态更新
3. **强扩展性**: 插件化架构，易于扩展新功能
4. **向后兼容**: 保证现有代码继续工作
5. **多场景支持**: 从轻量级独立服务到企业级集成

### ✅ 业务优势
1. **开发效率**: 提供多种集成方式，降低使用门槛
2. **运维友好**: 支持热重载、监控和健康检查
3. **生态兼容**: 与现有框架(NestJS、Express)无缝集成
4. **渐进升级**: 用户可以按需选择升级路径

### ✅ 长期价值
1. **技术债务控制**: 清晰的架构减少技术债务累积
2. **社区生态**: 标准化接口便于社区贡献
3. **商业化潜力**: 灵活的架构支持商业化扩展
4. **技术领先**: 在MCP生态中建立技术优势

## 🚀 结论

这个重构方案既保持了原有的轻量级独立MCP服务器功能，又提供了强大的工具库能力，支持多种集成场景。通过模块化设计和向后兼容策略，确保了平滑的迁移路径和长期的技术价值。

**建议立即启动Phase 1的实施，预计4-6周完成整体重构，将显著提升项目的技术价值和市场竞争力。**
