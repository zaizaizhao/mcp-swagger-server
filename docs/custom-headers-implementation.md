# MCP Swagger 自定义请求头实现方案

## 1. 实现架构

### 1.1 类型定义扩展

#### 更新 TransformerOptions 接口

```typescript
// packages/mcp-swagger-parser/src/transformer/types.ts

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
   * key: 请求头名称, value: 环境变量名称
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

export interface TransformerOptions {
  baseUrl?: string;
  includeDeprecated?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  requestTimeout?: number;
  defaultHeaders?: Record<string, string>;
  customHandlers?: Record<string, (extra: any) => Promise<MCPToolResponse>>;
  pathPrefix?: string;
  stripBasePath?: boolean;
  authConfig?: AuthConfig;
  
  // 新增：自定义请求头配置
  customHeaders?: CustomHeaders;
  
  // 新增：是否启用请求头调试
  debugHeaders?: boolean;
  
  // 新增：受保护的请求头列表（不允许被覆盖）
  protectedHeaders?: string[];
  
  // ... 其他现有选项
}
```

### 1.2 核心实现类

#### CustomHeadersManager 类

```typescript
// packages/mcp-swagger-parser/src/headers/CustomHeadersManager.ts

import { CustomHeaders, RequestContext } from '../transformer/types';

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
      'transfer-encoding',
      'upgrade',
      ...(options.protectedHeaders || [])
    ]);
    this.debugMode = options.debugMode || false;
  }

  /**
   * 获取所有自定义请求头
   */
  async getHeaders(context: RequestContext): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    try {
      // 1. 添加静态头
      if (this.config.static) {
        Object.assign(headers, this.config.static);
        if (this.debugMode) {
          console.log('Added static headers:', this.config.static);
        }
      }

      // 2. 添加环境变量头
      if (this.config.env) {
        const envHeaders = await this.resolveEnvHeaders(this.config.env);
        Object.assign(headers, envHeaders);
        if (this.debugMode) {
          console.log('Added env headers:', envHeaders);
        }
      }

      // 3. 添加动态头
      if (this.config.dynamic) {
        const dynamicHeaders = await this.resolveDynamicHeaders(this.config.dynamic);
        Object.assign(headers, dynamicHeaders);
        if (this.debugMode) {
          console.log('Added dynamic headers:', dynamicHeaders);
        }
      }

      // 4. 添加条件头
      if (this.config.conditional) {
        const conditionalHeaders = await this.resolveConditionalHeaders(this.config.conditional, context);
        Object.assign(headers, conditionalHeaders);
        if (this.debugMode) {
          console.log('Added conditional headers:', conditionalHeaders);
        }
      }

      // 5. 过滤受保护的头
      const filteredHeaders = this.filterProtectedHeaders(headers);

      if (this.debugMode) {
        console.log('Final custom headers:', filteredHeaders);
      }

      return filteredHeaders;
    } catch (error) {
      console.error('Error resolving custom headers:', error);
      return {};
    }
  }

  private async resolveEnvHeaders(envConfig: Record<string, string>): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    
    for (const [headerName, envName] of Object.entries(envConfig)) {
      const value = process.env[envName];
      if (value) {
        headers[headerName] = value;
      } else if (this.debugMode) {
        console.warn(`Environment variable ${envName} not found for header ${headerName}`);
      }
    }
    
    return headers;
  }

  private async resolveDynamicHeaders(dynamicConfig: Record<string, () => string | Promise<string>>): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    
    for (const [headerName, generator] of Object.entries(dynamicConfig)) {
      try {
        const value = await generator();
        if (value) {
          headers[headerName] = value;
        }
      } catch (error) {
        console.warn(`Failed to generate dynamic header ${headerName}:`, error);
      }
    }
    
    return headers;
  }

  private async resolveConditionalHeaders(
    conditionalConfig: Array<{ condition: (context: RequestContext) => boolean; headers: Record<string, string> }>,
    context: RequestContext
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    
    for (const rule of conditionalConfig) {
      try {
        if (rule.condition(context)) {
          Object.assign(headers, rule.headers);
        }
      } catch (error) {
        console.warn('Error evaluating conditional header rule:', error);
      }
    }
    
    return headers;
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

### 1.3 Transformer 集成

#### 更新 OpenAPIToMCPTransformer 类

```typescript
// packages/mcp-swagger-parser/src/transformer/index.ts

import { CustomHeadersManager } from '../headers/CustomHeadersManager';

export class OpenAPIToMCPTransformer {
  private customHeadersManager?: CustomHeadersManager;

  constructor(spec: OpenAPISpec, options: TransformerOptions = {}) {
    // ... 现有代码 ...
    
    // 初始化自定义请求头管理器
    if (options.customHeaders) {
      this.customHeadersManager = new CustomHeadersManager(
        options.customHeaders,
        {
          protectedHeaders: options.protectedHeaders,
          debugMode: options.debugHeaders
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
      
      // 2. 自定义头（在认证头之前添加，优先级较低）
      if (this.customHeadersManager) {
        const customHeaders = await this.customHeadersManager.getHeaders({
          method,
          path,
          args,
          operation
        });
        Object.assign(headers, customHeaders);
      }
      
      // 3. 认证头（最高优先级，可能覆盖自定义头）
      if (this.authManager) {
        const authHeaders = await this.authManager.getAuthHeaders({
          method,
          path,
          args
        });
        Object.assign(headers, authHeaders);
      }

      // 4. 调试输出最终请求头
      if (this.options.debugHeaders) {
        console.log(`[${method} ${path}] Final headers:`, headers);
      }

      // 5. 执行请求
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

## 2. CLI 参数扩展

### 2.1 新增 CLI 参数

```typescript
// packages/mcp-swagger-server/src/cli.ts

interface ServerOptions {
  // ... 现有选项 ...
  
  // 自定义请求头相关选项
  customHeaders?: string[];        // --custom-header "Key=Value"
  customHeadersConfig?: string;    // --custom-headers-config headers.json
  customHeadersEnv?: string[];     // --custom-header-env "X-Client-ID=CLIENT_ID"
  debugHeaders?: boolean;          // --debug-headers
}

// 解析参数
const { values, positionals } = parseArgs({
  options: {
    // ... 现有选项 ...
    
    // 自定义请求头选项
    "custom-header": {
      type: "string",
      multiple: true,
    },
    "custom-headers-config": {
      type: "string",
    },
    "custom-header-env": {
      type: "string",
      multiple: true,
    },
    "debug-headers": {
      type: "boolean",
      default: false,
    },
    
    // ... 其他选项 ...
  },
  allowPositionals: true,
});
```

### 2.2 配置解析函数

```typescript
// packages/mcp-swagger-server/src/cli.ts

interface CustomHeadersConfig {
  static?: Record<string, string>;
  env?: Record<string, string>;
  dynamic?: Record<string, string>; // 用于存储动态头的配置
  conditional?: Array<{
    condition: string; // 条件表达式字符串
    headers: Record<string, string>;
  }>;
}

/**
 * 解析自定义请求头配置
 */
function parseCustomHeaders(
  options: ServerOptions & { 'custom-header'?: string[], 'custom-headers-config'?: string, 'custom-header-env'?: string[] },
  config?: ConfigFile,
  envVars?: Record<string, string>
): CustomHeaders | undefined {
  const customHeaders: CustomHeaders = {};
  let hasConfig = false;

  // 1. 从配置文件读取
  if (config?.customHeaders) {
    Object.assign(customHeaders, config.customHeaders);
    hasConfig = true;
  }

  // 2. 从专用配置文件读取
  if (options['custom-headers-config']) {
    try {
      const configFile = JSON.parse(fs.readFileSync(options['custom-headers-config'], 'utf8'));
      Object.assign(customHeaders, configFile);
      hasConfig = true;
    } catch (error) {
      console.error(`Error loading custom headers config: ${error.message}`);
    }
  }

  // 3. 从命令行参数读取静态头
  if (options['custom-header']) {
    if (!customHeaders.static) customHeaders.static = {};
    
    for (const header of options['custom-header']) {
      const [key, value] = header.split('=', 2);
      if (key && value) {
        customHeaders.static[key] = value;
        hasConfig = true;
      }
    }
  }

  // 4. 从命令行参数读取环境变量头
  if (options['custom-header-env']) {
    if (!customHeaders.env) customHeaders.env = {};
    
    for (const header of options['custom-header-env']) {
      const [key, envName] = header.split('=', 2);
      if (key && envName) {
        customHeaders.env[key] = envName;
        hasConfig = true;
      }
    }
  }

  // 5. 从环境变量读取（MCP_CUSTOM_HEADERS_* 格式）
  const customHeadersFromEnv = extractCustomHeadersFromEnv(envVars);
  if (Object.keys(customHeadersFromEnv).length > 0) {
    if (!customHeaders.static) customHeaders.static = {};
    Object.assign(customHeaders.static, customHeadersFromEnv);
    hasConfig = true;
  }

  return hasConfig ? customHeaders : undefined;
}

/**
 * 从环境变量中提取自定义请求头
 * 格式：MCP_CUSTOM_HEADERS_<HEADER_NAME>=<VALUE>
 */
function extractCustomHeadersFromEnv(envVars: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {};
  const prefix = 'MCP_CUSTOM_HEADERS_';
  
  // 合并系统环境变量和 .env 文件变量
  const allEnvVars = { ...envVars, ...process.env };
  
  for (const [key, value] of Object.entries(allEnvVars)) {
    if (key.startsWith(prefix) && value) {
      const headerName = key.substring(prefix.length).replace(/_/g, '-');
      headers[headerName] = value;
    }
  }
  
  return headers;
}
```

### 2.3 配置文件格式

```typescript
// packages/mcp-swagger-server/src/types/config.ts

export interface ConfigFile {
  openapi?: string;
  transport?: string;
  port?: number;
  auth?: {
    type: string;
    bearer?: {
      token?: string;
      envName?: string;
    };
  };
  
  // 新增：自定义请求头配置
  customHeaders?: {
    static?: Record<string, string>;
    env?: Record<string, string>;
    conditional?: Array<{
      condition: string;
      headers: Record<string, string>;
    }>;
  };
  
  // 新增：调试选项
  debugHeaders?: boolean;
}
```

## 3. 使用示例

### 3.1 命令行使用

```bash
# 1. 基本静态头
mcp-swagger-server \
  --openapi https://api.example.com/swagger.json \
  --custom-header "User-Agent=MCP-Client/1.0" \
  --custom-header "X-Client-Version=1.0.0"

# 2. 环境变量头
mcp-swagger-server \
  --openapi https://api.example.com/swagger.json \
  --custom-header-env "X-Client-ID=CLIENT_ID" \
  --custom-header-env "X-Request-Source=REQUEST_SOURCE"

# 3. 配置文件
mcp-swagger-server \
  --config config.json \
  --custom-headers-config headers.json \
  --debug-headers

# 4. 环境变量格式
export MCP_CUSTOM_HEADERS_USER_AGENT="MCP-Client/1.0"
export MCP_CUSTOM_HEADERS_X_CLIENT_VERSION="1.0.0"
mcp-swagger-server --openapi https://api.example.com/swagger.json
```

### 3.2 配置文件示例

```json
// config.json
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
    },
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
  },
  "debugHeaders": true
}
```

```json
// headers.json (专用头配置文件)
{
  "static": {
    "User-Agent": "MCP-Swagger-Client/1.0",
    "X-Client-Version": "1.0.0",
    "Accept": "application/json"
  },
  "env": {
    "X-API-Client": "API_CLIENT_NAME",
    "X-Request-ID": "REQUEST_ID_PREFIX"
  },
  "dynamic": {
    "X-Request-ID": "generateRequestId",
    "X-Timestamp": "generateTimestamp"
  }
}
```

### 3.3 .env 文件示例

```bash
# .env
MCP_OPENAPI_URL=https://api.example.com/swagger.json
MCP_TRANSPORT=stdio

# 自定义请求头
MCP_CUSTOM_HEADERS_USER_AGENT=MCP-Client/1.0
MCP_CUSTOM_HEADERS_X_CLIENT_VERSION=1.0.0
MCP_CUSTOM_HEADERS_ACCEPT=application/json

# 环境变量映射
CLIENT_ID=my-client-123
REQUEST_SOURCE=mcp-swagger-server
```

## 4. 预定义动态头函数

### 4.1 常用动态头生成器

```typescript
// packages/mcp-swagger-parser/src/headers/generators.ts

export const predefinedGenerators = {
  /**
   * 生成唯一请求ID
   */
  generateRequestId: () => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * 生成时间戳
   */
  generateTimestamp: () => {
    return new Date().toISOString();
  },

  /**
   * 生成Unix时间戳
   */
  generateUnixTimestamp: () => {
    return Math.floor(Date.now() / 1000).toString();
  },

  /**
   * 生成UUID v4
   */
  generateUUID: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};
```

### 4.2 动态头配置支持

```typescript
// 在 CustomHeadersManager 中添加对预定义函数的支持
import { predefinedGenerators } from './generators';

private async resolveDynamicHeaders(dynamicConfig: Record<string, string | (() => string | Promise<string>)>): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  
  for (const [headerName, generator] of Object.entries(dynamicConfig)) {
    try {
      let value: string;
      
      if (typeof generator === 'string') {
        // 字符串形式，查找预定义函数
        const predefinedFn = predefinedGenerators[generator];
        if (predefinedFn) {
          value = await predefinedFn();
        } else {
          console.warn(`Unknown predefined generator: ${generator}`);
          continue;
        }
      } else if (typeof generator === 'function') {
        // 函数形式，直接调用
        value = await generator();
      } else {
        console.warn(`Invalid generator type for header ${headerName}`);
        continue;
      }
      
      if (value) {
        headers[headerName] = value;
      }
    } catch (error) {
      console.warn(`Failed to generate dynamic header ${headerName}:`, error);
    }
  }
  
  return headers;
}
```

## 5. 测试用例

### 5.1 单元测试

```typescript
// packages/mcp-swagger-parser/src/headers/__tests__/CustomHeadersManager.test.ts

import { CustomHeadersManager } from '../CustomHeadersManager';

describe('CustomHeadersManager', () => {
  beforeEach(() => {
    // 清理环境变量
    delete process.env.TEST_HEADER;
  });

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

  it('should add environment headers', async () => {
    process.env.TEST_HEADER = 'env-value';
    
    const manager = new CustomHeadersManager({
      env: { 'X-Test': 'TEST_HEADER' }
    });
    
    const headers = await manager.getHeaders({
      method: 'GET',
      path: '/test',
      args: {}
    });
    
    expect(headers['X-Test']).toBe('env-value');
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

  it('should handle conditional headers', async () => {
    const manager = new CustomHeadersManager({
      conditional: [
        {
          condition: (context) => context.method === 'POST',
          headers: { 'X-Post-Only': 'true' }
        }
      ]
    });
    
    const getHeaders = await manager.getHeaders({
      method: 'GET',
      path: '/test',
      args: {}
    });
    
    const postHeaders = await manager.getHeaders({
      method: 'POST',
      path: '/test',
      args: {}
    });
    
    expect(getHeaders['X-Post-Only']).toBeUndefined();
    expect(postHeaders['X-Post-Only']).toBe('true');
  });
});
```

### 5.2 集成测试

```typescript
// packages/mcp-swagger-parser/src/transformer/__tests__/CustomHeaders.integration.test.ts

import { OpenAPIToMCPTransformer } from '../index';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

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
    
    mockedAxios.mockResolvedValue({
      status: 200,
      data: { success: true },
      headers: {},
      config: {}
    });
    
    const tools = transformer.transformToMCPTools();
    const tool = tools[0];
    
    await tool.handler({});
    
    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Test': 'integration'
        })
      })
    );
  });

  it('should respect header priority order', async () => {
    const transformer = new OpenAPIToMCPTransformer(
      mockOpenAPISchema,
      {
        defaultHeaders: { 'X-Priority': 'default' },
        customHeaders: {
          static: { 'X-Priority': 'custom' }
        },
        authConfig: {
          type: 'bearer',
          bearer: { token: 'test-token' }
        }
      }
    );
    
    mockedAxios.mockResolvedValue({
      status: 200,
      data: { success: true },
      headers: {},
      config: {}
    });
    
    const tools = transformer.transformToMCPTools();
    const tool = tools[0];
    
    await tool.handler({});
    
    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Priority': 'custom', // 自定义头覆盖默认头
          'Authorization': 'Bearer test-token' // 认证头优先级最高
        })
      })
    );
  });
});
```

## 6. 文档更新

### 6.1 README 更新

需要更新以下文档：
- `packages/mcp-swagger-parser/README.md`
- `packages/mcp-swagger-server/README.md`
- `docs/usage-guide.md`

### 6.2 API 文档更新

需要更新：
- `packages/mcp-swagger-parser/docs/API_DOCUMENTATION.md`
- `packages/mcp-swagger-parser/docs/TECHNICAL_DOCUMENTATION.md`

## 7. 向后兼容性

### 7.1 兼容性保证

1. **现有的 `defaultHeaders` 选项继续工作**
2. **现有的认证配置不受影响**
3. **新功能是可选的，不会破坏现有配置**

### 7.2 迁移路径

```typescript
// 旧配置
const options = {
  defaultHeaders: {
    'User-Agent': 'MyApp/1.0',
    'X-Client-ID': 'client123'
  }
};

// 新配置（推荐）
const options = {
  defaultHeaders: {
    'Content-Type': 'application/json'
  },
  customHeaders: {
    static: {
      'User-Agent': 'MyApp/1.0',
      'X-Client-ID': 'client123'
    }
  }
};
```

## 8. 实施计划

### 8.1 开发阶段

1. **阶段 1**：实现核心类型定义和 `CustomHeadersManager`
2. **阶段 2**：集成到 `OpenAPIToMCPTransformer`
3. **阶段 3**：扩展 CLI 参数解析
4. **阶段 4**：添加预定义动态头生成器
5. **阶段 5**：完善测试用例和文档

### 8.2 测试策略

1. **单元测试**：测试 `CustomHeadersManager` 的各种配置场景
2. **集成测试**：测试与 `OpenAPIToMCPTransformer` 的集成
3. **端到端测试**：测试完整的 CLI 到 HTTP 请求的流程
4. **性能测试**：确保动态头生成不影响性能

这个设计方案提供了：
- 灵活的配置选项
- 清晰的优先级规则
- 完整的 CLI 支持
- 良好的向后兼容性
- 完善的测试覆盖

实现后，用户可以通过多种方式配置自定义请求头，满足各种场景的需求。
