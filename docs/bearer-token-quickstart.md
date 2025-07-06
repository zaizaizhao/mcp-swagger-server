# Bearer Token认证快速开始指南

## 概述

本指南提供了在mcp-swagger-server中快速实现Bearer Token认证的最简方案。

## 核心需求

- 为业务系统API调用自动添加 `Authorization: Bearer <token>` 头
- 支持多种Token配置方式
- 保持向后兼容性
- 预留扩展接口

## 实现方案

### 1. 最小化实现架构

```
mcp-swagger-server
├── 认证配置解析 (Server层)
├── 认证配置传递 (传递给Parser)
├── Parser层增强 (核心修改点)
│   ├── TransformerOptions扩展
│   ├── BearerAuthManager
│   └── executeHttpRequest修改
└── CLI参数支持
```

### 2. 核心文件修改

#### 2.1 Parser层认证支持

**新增文件**: `packages/mcp-swagger-parser/src/auth/types.ts`

```typescript
export interface AuthConfig {
  type: 'bearer' | 'none';
  bearer?: {
    token: string;
    source: 'static' | 'env';
    envName?: string;
  };
}

export interface AuthManager {
  getAuthHeaders(): Promise<Record<string, string>>;
  getToken(): Promise<string>;
}

export class BearerAuthManager implements AuthManager {
  constructor(private config: AuthConfig) {}
  
  async getAuthHeaders(): Promise<Record<string, string>> {
    if (this.config.type !== 'bearer') return {};
    
    const token = await this.getToken();
    return { 'Authorization': `Bearer ${token}` };
  }
  
  private async getToken(): Promise<string> {
    const { bearer } = this.config;
    if (!bearer) throw new Error('Bearer config required');
    
    if (bearer.source === 'env') {
      const envToken = process.env[bearer.envName || 'API_TOKEN'];
      if (!envToken) throw new Error(`Environment variable ${bearer.envName} not found`);
      return envToken;
    }
    
    return bearer.token;
  }
}
```

#### 2.2 扩展TransformerOptions

**修改文件**: `packages/mcp-swagger-parser/src/transformer/types.ts`

```typescript
import { AuthConfig } from '../auth/types';

export interface TransformerOptions {
  baseUrl?: string;
  includeDeprecated?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  requestTimeout?: number;
  defaultHeaders?: Record<string, string>;
  customHandlers?: Record<string, (args: any) => Promise<MCPToolResponse>>;
  pathPrefix?: string;
  stripBasePath?: boolean;
  includeFieldAnnotations?: boolean;
  annotationOptions?: AnnotationOptions;
  
  // 新增：认证配置
  authConfig?: AuthConfig;
}
```

#### 2.3 修改Transformer类

**修改文件**: `packages/mcp-swagger-parser/src/transformer/index.ts`

```typescript
import { BearerAuthManager, AuthManager } from '../auth/types';

export class OpenAPIToMCPTransformer {
  private spec: OpenAPISpec;
  private options: Required<TransformerOptions>;
  private annotationExtractor: SchemaAnnotationExtractor;
  private authManager?: AuthManager; // 新增

  constructor(spec: OpenAPISpec, options: TransformerOptions = {}) {
    this.spec = spec;
    this.options = {
      // ...existing options...
      authConfig: options.authConfig || { type: 'none' }
    };

    this.annotationExtractor = new SchemaAnnotationExtractor(spec);
    
    // 初始化认证管理器
    if (this.options.authConfig?.type === 'bearer') {
      this.authManager = new BearerAuthManager(this.options.authConfig);
    }
  }

  // 修改executeHttpRequest方法
  private async executeHttpRequest(
    method: string,
    path: string,
    args: any,
    operation: OperationObject
  ): Promise<MCPToolResponse> {
    try {
      const { url, queryParams } = this.buildUrlWithParams(path, args, operation);
      
      // 准备请求头
      const headers = { ...this.options.defaultHeaders };
      
      // 新增：添加认证头
      if (this.authManager) {
        const authHeaders = await this.authManager.getAuthHeaders();
        Object.assign(headers, authHeaders);
      }

      const requestBody = this.buildRequestBody(args, operation);

      const response = await axios({
        method: method.toLowerCase() as any,
        url,
        params: queryParams,
        data: requestBody,
        headers, // 包含认证头
        timeout: this.options.requestTimeout,
        validateStatus: () => true,
        maxRedirects: 5,
        responseType: 'json'
      });

      return this.formatHttpResponse(response, method, path, operation);
    } catch (error) {
      return this.handleRequestError(error, method, path);
    }
  }
}
```

#### 2.4 Server层集成

**修改文件**: `packages/mcp-swagger-server/src/server/index.ts`

```typescript
import { OpenAPIToMCPTransformer } from 'mcp-swagger-parser';

export class McpServer {
  constructor(private config: McpServerConfig) {}
  
  async start(): Promise<void> {
    const spec = await this.loadOpenApiSpec();
    
    // 创建transformer时传递认证配置
    const transformer = new OpenAPIToMCPTransformer(spec, {
      baseUrl: this.config.baseUrl,
      authConfig: this.config.auth, // 关键：传递认证配置
      requestTimeout: this.config.timeout
    });
    
    const tools = transformer.transformToMCPTools();
    await this.startMcpServer(tools);
  }
}
```

## 使用方式

### 1. 命令行使用

```bash
# 使用静态token
mcp-swagger-server \
  --openapi https://api.example.com/openapi.json \
  --auth-type bearer \
  --bearer-token "your-token-here"

# 使用环境变量
export API_TOKEN="your-token-here"
mcp-swagger-server \
  --openapi https://api.example.com/openapi.json \
  --auth-type bearer \
  --bearer-env API_TOKEN
```

### 2. 配置文件使用

```json
{
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

### 3. 编程式使用

```typescript
import { createServer } from 'mcp-swagger-server';
import { BearerAuth } from 'mcp-swagger-server/auth';

const auth = new BearerAuth({
  type: 'bearer',
  bearer: {
    token: 'your-token',
    source: 'static'
  }
});

const server = await createServer({
  openapi: 'https://api.example.com/openapi.json',
  auth
});

await server.start();
```

## 实施步骤

### 第1天：Parser层认证基础
- [x] 创建认证类型定义 (`auth/types.ts`)
- [x] 实现BearerAuthManager类
- [x] 扩展TransformerOptions接口
- [x] 添加基础测试

### 第2天：Parser层HTTP请求增强
- [x] 修改OpenAPIToMCPTransformer构造函数
- [x] 修改executeHttpRequest方法添加认证头
- [ ] 测试HTTP请求包含Bearer Token
- [ ] 验证认证流程

### 第3天：Server层集成
- [ ] 修改McpServerConfig支持认证
- [ ] 更新McpServer类传递认证配置到Parser
- [ ] 测试端到端认证流程
- [ ] 确保配置正确传递

### 第4天：CLI和API集成
- [ ] 添加CLI参数支持认证配置
- [ ] 更新mcp-swagger-api支持认证
- [ ] 添加配置文件支持
- [ ] 测试不同配置方式

### 第5天：测试和文档
- [ ] 完善测试覆盖
- [ ] 编写使用文档和示例
- [ ] 准备发布
- [ ] 端到端验证

## 验证方式

### 1. 单元测试
```typescript
describe('BearerAuth', () => {
  it('should add authorization header', async () => {
    const auth = new BearerAuth({
      type: 'bearer',
      bearer: { token: 'test-token', source: 'static' }
    });
    
    const headers = await auth.getHeaders();
    expect(headers.Authorization).toBe('Bearer test-token');
  });
});
```

### 2. 集成测试
```bash
# 启动测试服务器
mcp-swagger-server --openapi https://httpbin.org/spec.json --auth-type bearer --bearer-token test-token

# 验证API调用包含认证头
curl -X GET http://localhost:3322/mcp/tools/get/headers
```

### 3. 手工测试
- [ ] 使用httpbin.org测试认证头传递
- [ ] 测试不同Token配置方式
- [ ] 验证错误处理

## 风险和注意事项

### 安全风险
- 避免在日志中记录Token
- 使用环境变量存储敏感信息
- 确保HTTPS传输

### 兼容性风险
- 保持现有API不变
- 认证功能可选启用
- 向后兼容现有配置

### 性能考虑
- 避免频繁Token获取
- 复用HTTP连接
- 合理的错误重试

## 扩展计划

### 短期扩展
- API Key认证
- Basic认证
- 自定义Header认证

### 长期扩展
- OAuth2认证
- JWT Token刷新
- 多认证方式组合

## 总结

这个方案提供了最小化的Bearer Token认证实现，具有以下特点：

1. **简单易用**: 核心功能只需4个文件修改
2. **配置灵活**: 支持静态Token和环境变量
3. **向后兼容**: 不影响现有功能
4. **易于扩展**: 为其他认证方式预留接口

该方案可以在5天内完成实施，满足基本的Bearer Token认证需求。
