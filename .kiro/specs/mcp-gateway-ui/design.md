# 智能MCP网关UI界面设计文档

## 概述

智能MCP网关UI界面是一个现代化的Web应用程序，旨在为MCP（Model Context Protocol）服务器提供统一的管理、监控和测试平台。该系统将原有的mcp-swagger-ui重新设计为功能完整的网关管理界面，支持多服务器管理、实时监控、API测试和AI助手集成。

### 设计目标
- 提供直观的用户界面管理多个MCP服务器实例
- 实现OpenAPI到MCP格式的无缝转换
- 提供实时监控和性能分析能力
- 支持安全的认证配置管理
- 集成AI助手配置生成功能

## 架构

### 整体架构
系统采用现代化的前后端分离架构，基于React + TypeScript构建前端界面，Node.js + Express构建后端API服务。

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │  Gateway API    │    │  MCP Servers    │
│   (React/TS)    │◄──►│  (Node.js)      │◄──►│  (Multiple)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   UI Components │    │  Config Store   │    │  External APIs  │
│   Dashboard     │    │  (JSON/SQLite)  │    │  (REST/OpenAPI) │
│   Management    │    │                 │    │                 │
│   Testing       │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 技术栈选择
- **前端**: React 18 + TypeScript + Vite - 选择React是因为其成熟的生态系统和组件化开发模式
- **UI框架**: Ant Design - 提供丰富的企业级组件，减少开发时间
- **状态管理**: Zustand - 轻量级状态管理，比Redux更简单
- **后端**: Node.js + Express + TypeScript - 与现有mcp-swagger-ui技术栈保持一致
- **实时通信**: Socket.IO - 支持实时状态更新和日志流
- **数据存储**: SQLite + JSON配置文件 - 轻量级存储方案，便于部署

## 组件和接口

### 前端组件架构

#### 1. 布局组件
```typescript
// 主布局组件
interface MainLayoutProps {
  children: React.ReactNode;
  sidebarCollapsed?: boolean;
}

// 侧边栏导航
interface SidebarProps {
  activeRoute: string;
  onRouteChange: (route: string) => void;
}
```

#### 2. 核心功能组件

**服务器管理组件**
```typescript
interface ServerManagerProps {
  servers: MCPServer[];
  onServerAdd: (config: ServerConfig) => Promise<void>;
  onServerUpdate: (id: string, config: ServerConfig) => Promise<void>;
  onServerDelete: (id: string) => Promise<void>;
  onServerToggle: (id: string, enabled: boolean) => Promise<void>;
}

interface ServerConfig {
  name: string;
  endpoint: string;
  openApiSpec: string | File;
  authentication?: AuthConfig;
  customHeaders?: Record<string, string>;
}
```

**监控仪表板组件**
```typescript
interface DashboardProps {
  servers: MCPServer[];
  metrics: SystemMetrics;
  realTimeUpdates: boolean;
}

interface SystemMetrics {
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  activeConnections: number;
  resourceUsage: ResourceUsage;
}
```

**API测试组件**
```typescript
interface APITesterProps {
  tools: MCPTool[];
  onToolExecute: (toolId: string, params: any) => Promise<ToolResult>;
  savedTestCases: TestCase[];
  onSaveTestCase: (testCase: TestCase) => Promise<void>;
}

interface MCPTool {
  id: string;
  name: string;
  description: string;
  parameters: ParameterSchema;
  serverId: string;
}
```

**配置导入导出组件**
```typescript
interface ConfigManagerProps {
  onExportConfig: (options: ExportOptions) => Promise<ConfigFile>;
  onImportConfig: (file: File) => Promise<ImportResult>;
  onResolveConflicts: (conflicts: ConfigConflict[]) => Promise<void>;
}

interface ExportOptions {
  includeServers: boolean;
  includeSensitiveData: boolean;
  encryptSensitiveData: boolean;
}

interface ImportResult {
  success: boolean;
  conflicts?: ConfigConflict[];
  migrationRequired?: boolean;
}
```

**日志查看器组件**
```typescript
interface LogViewerProps {
  logs: LogEntry[];
  onFilterChange: (filter: LogFilter) => void;
  onExportLogs: (timeRange: TimeRange) => Promise<void>;
  realTimeEnabled: boolean;
}

interface LogFilter {
  level?: LogLevel[];
  serverId?: string;
  searchTerm?: string;
  timeRange?: TimeRange;
}
```

**AI助手集成组件**
```typescript
interface AIAssistantProps {
  assistantTypes: AIAssistantType[];
  onGenerateConfig: (type: AIAssistantType, options: ConfigOptions) => Promise<string>;
  onSaveTemplate: (template: ConfigTemplate) => Promise<void>;
  savedTemplates: ConfigTemplate[];
}

interface AIAssistantType {
  id: string;
  name: string;
  configTemplate: string;
  supportedFeatures: string[];
}
```

### 后端API接口

#### 1. 服务器管理API
```typescript
// GET /api/servers - 获取所有服务器
// POST /api/servers - 创建新服务器
// PUT /api/servers/:id - 更新服务器配置
// DELETE /api/servers/:id - 删除服务器
// POST /api/servers/:id/toggle - 启动/停止服务器

interface ServerAPI {
  listServers(): Promise<MCPServer[]>;
  createServer(config: ServerConfig): Promise<MCPServer>;
  updateServer(id: string, config: ServerConfig): Promise<MCPServer>;
  deleteServer(id: string): Promise<void>;
  toggleServer(id: string, enabled: boolean): Promise<MCPServer>;
}
```

#### 2. OpenAPI管理API
```typescript
// POST /api/openapi/upload - 上传OpenAPI文件
// POST /api/openapi/url - 从URL获取OpenAPI规范
// POST /api/openapi/validate - 验证OpenAPI规范
// POST /api/openapi/convert - 转换为MCP工具

interface OpenAPIAPI {
  uploadSpec(file: File): Promise<OpenAPISpec>;
  fetchFromUrl(url: string): Promise<OpenAPISpec>;
  validateSpec(spec: OpenAPISpec): Promise<ValidationResult>;
  convertToMCP(spec: OpenAPISpec): Promise<MCPTool[]>;
}
```

#### 3. 监控API
```typescript
// GET /api/metrics - 获取系统指标
// GET /api/metrics/realtime - WebSocket实时指标
 

#### 4. 配置管理API
```typescript
// POST /api/config/export - 导出配置
// POST /api/config/import - 导入配置
// POST /api/config/validate - 验证配置
// GET /api/config/conflicts - 获取配置冲突

interface ConfigAPI {
  exportConfig(options: ExportOptions): Promise<ConfigFile>;
  importConfig(file: File): Promise<ImportResult>;
  validateConfig(config: any): Promise<ValidationResult>;
  resolveConflicts(conflicts: ConfigConflict[]): Promise<void>;
}
```

#### 5. AI助手集成API
```typescript
// GET /api/ai/assistants - 获取支持的AI助手类型
// POST /api/ai/generate-config - 生成AI助手配置
// GET /api/ai/templates - 获取配置模板
// POST /api/ai/templates - 保存配置模板

interface AIAssistantAPI {
  getAssistantTypes(): Promise<AIAssistantType[]>;
  generateConfig(type: string, options: ConfigOptions): Promise<string>;
  getTemplates(): Promise<ConfigTemplate[]>;
  saveTemplate(template: ConfigTemplate): Promise<void>;
}
```

#### 6. 认证管理API
```typescript
// POST /api/auth/validate - 验证认证配置
// POST /api/auth/test - 测试认证连接
// PUT /api/auth/encrypt - 加密认证信息
// DELETE /api/auth/clear - 清除认证信息

interface AuthAPI {
  validateAuth(config: AuthConfig): Promise<ValidationResult>;
  testAuth(config: AuthConfig): Promise<TestResult>;
  encryptCredentials(credentials: any): Promise<string>;
  clearCredentials(serverId: string): Promise<void>;
}
```

## 数据模型

### 核心数据结构

```typescript
// MCP服务器模型
interface MCPServer {
  id: string;
  name: string;
  endpoint: string;
  status: 'running' | 'stopped' | 'error';
  config: ServerConfig;
  tools: MCPTool[];
  metrics: ServerMetrics;
  createdAt: Date;
  updatedAt: Date;
}

// OpenAPI规范模型
interface OpenAPISpec {
  id: string;
  version: '2.0' | '3.0' | '3.1';
  content: object;
  metadata: {
    title: string;
    version: string;
    description?: string;
  };
  validationStatus: 'valid' | 'invalid' | 'warning';
  validationErrors?: ValidationError[];
}

// 认证配置模型
interface AuthConfig {
  type: 'bearer' | 'apikey' | 'basic' | 'oauth2';
  credentials: {
    token?: string;
    apiKey?: string;
    username?: string;
    password?: string;
    clientId?: string;
    clientSecret?: string;
  };
  envVars?: string[];
  encrypted: boolean;
}

// 测试用例模型
interface TestCase {
  id: string;
  name: string;
  toolId: string;
  parameters: Record<string, any>;
  expectedResult?: any;
  tags: string[];
  createdAt: Date;
}
```

### 数据存储策略

**配置存储**: 使用JSON文件存储服务器配置，便于版本控制和备份
```json
{
  "servers": [
    {
      "id": "server-1",
      "name": "API Gateway",
      "endpoint": "http://localhost:3001",
      "config": { ... }
    }
  ],
  "globalSettings": {
    "theme": "light",
    "autoRefresh": true,
    "logLevel": "info"
  }
}
```

**运行时数据**: 使用SQLite存储日志、指标和测试历史
```sql
CREATE TABLE logs (
  id INTEGER PRIMARY KEY,
  timestamp DATETIME,
  level TEXT,
  message TEXT,
  server_id TEXT,
  metadata JSON
);

CREATE TABLE metrics (
  id INTEGER PRIMARY KEY,
  timestamp DATETIME,
  server_id TEXT,
  metric_type TEXT,
  value REAL,
  metadata JSON
);
```

## 错误处理

### 前端错误处理策略

1. **全局错误边界**: 使用React Error Boundary捕获组件错误
2. **API错误处理**: 统一的HTTP错误处理和用户友好的错误消息
3. **表单验证**: 实时表单验证和错误提示
4. **网络错误**: 自动重试机制和离线状态检测

```typescript
interface ErrorHandler {
  handleAPIError(error: APIError): void;
  handleValidationError(errors: ValidationError[]): void;
  handleNetworkError(error: NetworkError): void;
  showUserFriendlyMessage(error: Error): void;
}
```

### 后端错误处理策略

1. **统一错误响应格式**
```typescript
interface APIErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
}
```

2. **错误分类和日志记录**
- 系统错误: 记录详细堆栈信息
- 用户错误: 提供修复建议
- 网络错误: 自动重试和降级处理

## 测试策略

### 前端测试

1. **单元测试**: Jest + React Testing Library
   - 组件渲染测试
   - 用户交互测试
   - 状态管理测试

2. **集成测试**: Cypress
   - 端到端用户流程测试
   - API集成测试
   - 跨浏览器兼容性测试

3. **性能测试**: Lighthouse + Web Vitals
   - 页面加载性能
   - 运行时性能监控
   - 内存泄漏检测

### 后端测试

1. **单元测试**: Jest + Supertest
   - API端点测试
   - 业务逻辑测试
   - 数据模型测试

2. **集成测试**: 
   - 数据库集成测试
   - 外部API集成测试
   - WebSocket连接测试

3. **负载测试**: Artillery
   - 并发用户测试
   - API性能基准测试
   - 资源使用监控

### 测试数据管理

```typescript
// 测试数据工厂
interface TestDataFactory {
  createMockServer(): MCPServer;
  createMockOpenAPISpec(): OpenAPISpec;
  createMockTestCase(): TestCase;
  createMockMetrics(): SystemMetrics;
}
```

## 安全考虑

### 认证和授权
- JWT令牌认证
- 基于角色的访问控制
- API密钥管理和轮换

### 数据保护
- 敏感数据加密存储
- HTTPS强制使用
- 输入验证和SQL注入防护

### 审计日志
- 用户操作日志记录
- 配置变更追踪
- 安全事件监控

## 性能优化

### 前端优化
- 代码分割和懒加载
- 虚拟滚动处理大数据集
- 缓存策略和离线支持
- 图片和资源优化

### 后端优化
- API响应缓存
- 数据库查询优化
- 连接池管理
- 内存使用监控

### 实时更新优化
- WebSocket连接管理
- 增量数据更新
- 客户端状态同步
- 断线重连机制