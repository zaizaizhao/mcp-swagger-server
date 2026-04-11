# MCP Swagger 自定义请求头设计方案

## 1. 概述

本文档描述了如何在 `mcp-swagger-parser` 中实现自定义请求头功能，以及如何通过 `mcp-swagger-server` 传递这些参数。

## 2. 设计原则

### 2.1 架构分离
- **认证头（Authentication Headers）**：单独管理，通过 `AuthManager` 处理
- **自定义头（Custom Headers）**：通用请求头，如 User-Agent、Accept、自定义业务头等
- **系统头（System Headers）**：由系统自动管理，如 Content-Type 等

### 2.2 优先级设计
1. **系统头** - 最高优先级，不可覆盖
2. **认证头** - 由 AuthManager 管理
3. **自定义头** - 用户配置的通用头
4. **默认头** - 系统默认值

## 3. 数据结构设计

### 3.1 自定义头配置接口

```typescript
/**
 * 自定义请求头配置
 */
export interface CustomHeaders {
  /**
   * 静态头：固定值的请求头
   */
  static?: Record<string, string>;
  
  /**
   * 环境变量头：从环境变量获取值
   */
  env?: Record<string, string>;
  
  /**
   * 动态头：通过函数动态生成
   */
  dynamic?: Record<string, () => string | Promise<string>>;
  
  /**
   * 条件头：根据条件动态添加
   */
  conditional?: Array<{
    condition: (context: RequestContext) => boolean;
    headers: Record<string, string>;
  }>;
}

/**
 * 请求上下文
 */
export interface RequestContext {
  method: string;
  path: string;
  args: any;
  operation?: OperationObject;
}
```

### 3.2 TransformerOptions 扩展

```typescript
export interface TransformerOptions {
  // ...existing options...
  
  /**
   * 自定义请求头配置
   */
  customHeaders?: CustomHeaders;
  
  /**
   * 是否启用请求头调试
   */
  debugHeaders?: boolean;
  
  /**
   * 请求头黑名单（不允许覆盖的系统头）
   */
  protectedHeaders?: string[];
}
```

## 4. 实现方案

### 4.1 请求头管理器

```typescript
/**
 * 自定义请求头管理器
 */
export class CustomHeadersManager {
  private config: CustomHeaders;
  private protectedHeaders: Set<string>;
  private debugMode: boolean;

  constructor(config: CustomHeaders = {}, options: { 
    protectedHeaders?: string[], 
    debugMode?: boolean 
  } = {}) {
    this.config = config;
    this.protectedHeaders = new Set([
      'content-type',
      'content-length',
      'host',
      'connection',
      ...(options.protectedHeaders || [])
    ]);
    this.debugMode = options.debugMode || false;
  }

  /**
   * 获取所有自定义请求头
   */
  async getHeaders(context: RequestContext): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    // 1. 添加静态头
    if (this.config.static) {
      Object.assign(headers, this.config.static);
    }

    // 2. 添加环境变量头
    if (this.config.env) {
      for (const [key, envName] of Object.entries(this.config.env)) {
        const value = process.env[envName];
        if (value) {
          headers[key] = value;
        }
      }
    }

    // 3. 添加动态头
    if (this.config.dynamic) {
      for (const [key, generator] of Object.entries(this.config.dynamic)) {
        try {
          const value = await generator();
          if (value) {
            headers[key] = value;
          }
        } catch (error) {
          console.warn(`Failed to generate dynamic header ${key}:`, error);
        }
      }
    }

    // 4. 添加条件头
    if (this.config.conditional) {
      for (const rule of this.config.conditional) {
        if (rule.condition(context)) {
          Object.assign(headers, rule.headers);
        }
      }
    }

    // 5. 过滤受保护的头
    const filteredHeaders = this.filterProtectedHeaders(headers);

    // 6. 调试输出
    if (this.debugMode) {
      console.log('Custom Headers:', filteredHeaders);
    }

    return filteredHeaders;
  }

  private filterProtectedHeaders(headers: Record<string, string>): Record<string, string> {
    const filtered: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      const normalizedKey = key.toLowerCase();
      if (!this.protectedHeaders.has(normalizedKey)) {
        filtered[key] = value;
      } else if (this.debugMode) {
        console.warn(`Protected header ignored: ${key}`);
      }
    }
    
    return filtered;
  }
}
```

### 4.2 Transformer 集成

```typescript
export class OpenAPIToMCPTransformer {
  private customHeadersManager?: CustomHeadersManager;

  constructor(
    private schema: OpenAPIObject,
    private options: TransformerOptions = {},
    private authManager?: AuthManager
  ) {
    // 初始化自定义请求头管理器
    if (this.options.customHeaders) {
      this.customHeadersManager = new CustomHeadersManager(
        this.options.customHeaders,
        {
          protectedHeaders: this.options.protectedHeaders,
          debugMode: this.options.debugHeaders
        }
      );
    }
  }

  private async executeHttpRequest(
    method: string,
    path: string,
    args: any,
    operation: OperationObject
  ): Promise<MCPToolResponse> {
    try {
      const { url, queryParams } = this.buildUrlWithParams(path, args, operation);
      
      // 1. 系统默认头
      const headers = { ...this.options.defaultHeaders };
      
      // 2. 自定义头
      if (this.customHeadersManager) {
        const customHeaders = await this.customHeadersManager.getHeaders({
          method,
          path,
          args,
          operation
        });
        Object.assign(headers, customHeaders);
      }
      
      // 3. 认证头（最高优先级）
      if (this.authManager) {
        const authHeaders = await this.authManager.getAuthHeaders({
          method,
          path,
          args
        });
        Object.assign(headers, authHeaders);
      }

      // 4. 执行请求
      const response = await axios({
        method: method.toLowerCase() as any,
        url,
        params: queryParams,
        data: this.buildRequestBody(args, operation),
        headers,
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

## 5. 参数传递方案

### 5.1 CLI 参数

```bash
# 环境变量文件
mcp-swagger-server --env .env --custom-headers-config headers.json

# 直接传递
mcp-swagger-server --custom-header "User-Agent=MyApp/1.0" --custom-header "X-Client-ID=12345"

# 配置文件
mcp-swagger-server --config config.json
```

### 5.2 配置文件格式

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
      "X-API-Client": "API_CLIENT_NAME",
      "X-Request-ID": "REQUEST_ID_PREFIX"
    },
    "conditional": [
      {
        "condition": "method === 'POST'",
        "headers": {
          "X-Request-Type": "mutation"
        }
      }
    ]
  },
  "debugHeaders": true
}
```

### 5.3 环境变量支持

```bash
# .env 文件
MCP_CUSTOM_HEADERS_USER_AGENT=MyApp/1.0
MCP_CUSTOM_HEADERS_X_CLIENT_ID=12345
MCP_CUSTOM_HEADERS_DEBUG=true

# 环境变量映射
API_CLIENT_NAME=MyApplication
REQUEST_ID_PREFIX=req_
```

## 6. 使用示例

### 6.1 基本使用

```typescript
const transformer = new OpenAPIToMCPTransformer(
  openApiSchema,
  {
    customHeaders: {
      static: {
        'User-Agent': 'MCP-Swagger-Client/1.0',
        'X-Client-Version': '1.0.0'
      },
      env: {
        'X-API-Key': 'API_KEY_HEADER'
      }
    },
    debugHeaders: true
  }
);
```

### 6.2 高级用法

```typescript
const transformer = new OpenAPIToMCPTransformer(
  openApiSchema,
  {
    customHeaders: {
      static: {
        'User-Agent': 'MCP-Swagger-Client/1.0'
      },
      dynamic: {
        'X-Request-ID': () => `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        'X-Timestamp': () => new Date().toISOString()
      },
      conditional: [
        {
          condition: (context) => context.method === 'POST',
          headers: {
            'X-Request-Type': 'mutation'
          }
        },
        {
          condition: (context) => context.path.includes('/admin'),
          headers: {
            'X-Admin-Request': 'true'
          }
        }
      ]
    },
    debugHeaders: true,
    protectedHeaders: ['authorization', 'cookie']
  }
);
```

## 7. 迁移指南

### 7.1 现有代码兼容性

现有的 `defaultHeaders` 配置将自动迁移到新的 `customHeaders.static` 配置。

### 7.2 升级步骤

1. 更新 `TransformerOptions` 接口
2. 实现 `CustomHeadersManager` 类
3. 更新 `OpenAPIToMCPTransformer` 构造函数
4. 修改 CLI 参数解析
5. 更新配置文件格式

## 8. 最佳实践

### 8.1 性能优化

- 静态头优先使用，避免不必要的计算
- 动态头使用缓存机制
- 条件头使用简单的布尔表达式

### 8.2 安全考虑

- 不要在自定义头中包含敏感信息
- 使用环境变量管理敏感配置
- 定期审查自定义头的内容

### 8.3 调试建议

- 启用 `debugHeaders` 选项查看实际发送的头
- 使用网络抓包工具验证请求头
- 在测试环境中验证头的正确性

## 9. 测试用例

### 9.1 单元测试

```typescript
describe('CustomHeadersManager', () => {
  it('should add static headers', async () => {
    const manager = new CustomHeadersManager({
      static: { 'X-Test': 'value' }
    });
    
    const headers = await manager.getHeaders({
      method: 'GET',
      path: '/test',
      args: {}
    });
    
    expect(headers['X-Test']).toBe('value');
  });

  it('should filter protected headers', async () => {
    const manager = new CustomHeadersManager({
      static: { 'Content-Type': 'application/xml' }
    });
    
    const headers = await manager.getHeaders({
      method: 'GET',
      path: '/test',
      args: {}
    });
    
    expect(headers['Content-Type']).toBeUndefined();
  });
});
```

### 9.2 集成测试

```typescript
describe('OpenAPIToMCPTransformer with CustomHeaders', () => {
  it('should include custom headers in HTTP requests', async () => {
    const transformer = new OpenAPIToMCPTransformer(
      mockOpenAPISchema,
      {
        customHeaders: {
          static: { 'X-Test': 'integration' }
        }
      }
    );
    
    // Mock axios and verify headers
    const axiosSpy = jest.spyOn(axios, 'request');
    
    await transformer.executeHttpRequest('GET', '/test', {}, mockOperation);
    
    expect(axiosSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Test': 'integration'
        })
      })
    );
  });
});
```

## 10. 总结

通过以上设计方案，我们实现了：

1. **灵活的自定义头配置**：支持静态、环境变量、动态和条件头
2. **安全的头管理**：保护系统关键头不被覆盖
3. **简单的参数传递**：通过 CLI、配置文件和环境变量多种方式配置
4. **良好的扩展性**：易于添加新的头类型和规则
5. **完整的调试支持**：提供详细的调试信息

该方案与现有的 Bearer Token 认证功能完全兼容，并提供了清晰的架构分离。
