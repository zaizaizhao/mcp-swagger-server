# MCP Swagger Server CLI 接口过滤配置实现方案

## 1. 当前 CLI 架构分析

### 1.1 现有 CLI 结构

基于代码分析，`mcp-swagger-server` 的 CLI 架构如下：

```
├── cli.ts                    # 主 CLI 入口文件
├── cli-enhanced.ts           # 增强版 CLI（备用）
├── adapters/CLIAdapter.ts    # CLI 适配器
├── types/core.ts             # 核心类型定义
└── server.ts                 # 服务器启动逻辑
```

### 1.2 当前支持的 CLI 参数

```bash
# 基础配置
-t, --transport <type>        # 传输协议 (stdio|sse|streamable)
-p, --port <port>            # 服务器端口号
-e, --endpoint <path>        # 自定义端点路径
-o, --openapi <source>       # OpenAPI 数据源
-c, --config <file>          # 配置文件路径
-w, --watch                  # 监控文件变化

# 认证配置
--auth-type <type>           # 认证类型 (none|bearer)
--bearer-token <token>       # Bearer Token 静态值
--bearer-env <varname>       # Bearer Token 环境变量名

# 自定义请求头
--custom-header <header>     # 自定义请求头 "Key=Value"
--custom-headers-config <file> # 自定义请求头配置文件
--debug-headers              # 启用请求头调试模式
```

### 1.3 当前转换选项支持

基于 `TransformerOptions` 接口，当前支持的转换选项：

```typescript
interface TransformerOptions {
  baseUrl?: string;
  includeDeprecated?: boolean;
  includeTags?: string[];        // 包含的标签
  excludeTags?: string[];        // 排除的标签
  requestTimeout?: number;
  pathPrefix?: string;
  // ... 其他选项
}
```

**缺失的过滤能力：**
- HTTP 方法过滤（GET、POST、PUT、DELETE 等）
- 路径前缀过滤（更精细的路径控制）
- 操作 ID 过滤
- 响应状态码过滤
- 参数类型过滤

## 2. 新增 CLI 参数设计

### 2.1 接口过滤参数设计

```bash
# HTTP 方法过滤
--include-methods <methods>      # 包含的 HTTP 方法，逗号分隔
--exclude-methods <methods>      # 排除的 HTTP 方法，逗号分隔

# 路径过滤
--include-paths <patterns>       # 包含的路径模式，逗号分隔
--exclude-paths <patterns>       # 排除的路径模式，逗号分隔

# 操作 ID 过滤
--include-operations <ids>       # 包含的操作 ID，逗号分隔
--exclude-operations <ids>       # 排除的操作 ID，逗号分隔

# 响应状态码过滤
--include-status <codes>         # 包含的状态码，逗号分隔
--exclude-status <codes>         # 排除的状态码，逗号分隔

# 复合过滤配置文件
--filter-config <file>           # 过滤规则配置文件
```

### 2.2 CLI 参数扩展实现

#### 2.2.1 扩展 `ServerOptions` 接口

```typescript
// cli.ts 中的 ServerOptions 接口扩展
interface ServerOptions {
  // ... 现有选项
  
  // 新增：接口过滤选项
  includeMethods?: string[];       // --include-methods
  excludeMethods?: string[];       // --exclude-methods
  includePaths?: string[];         // --include-paths
  excludePaths?: string[];         // --exclude-paths
  includeOperations?: string[];    // --include-operations
  excludeOperations?: string[];    // --exclude-operations
  includeStatus?: string[];        // --include-status
  excludeStatus?: string[];        // --exclude-status
  filterConfig?: string;           // --filter-config
}
```

#### 2.2.2 扩展 `parseArgs` 配置

```typescript
// cli.ts 中的 parseArgs 扩展
const { values, positionals } = parseArgs({
  options: {
    // ... 现有选项
    
    // 新增：接口过滤选项
    "include-methods": {
      type: "string",
      multiple: true,
    },
    "exclude-methods": {
      type: "string",
      multiple: true,
    },
    "include-paths": {
      type: "string",
      multiple: true,
    },
    "exclude-paths": {
      type: "string",
      multiple: true,
    },
    "include-operations": {
      type: "string",
      multiple: true,
    },
    "exclude-operations": {
      type: "string",
      multiple: true,
    },
    "include-status": {
      type: "string",
      multiple: true,
    },
    "exclude-status": {
      type: "string",
      multiple: true,
    },
    "filter-config": {
      type: "string",
    },
  },
});
```

## 3. 配置文件扩展方案

### 3.1 扩展 `ConfigFile` 接口

```typescript
// cli.ts 中的 ConfigFile 接口扩展
interface ConfigFile {
  // ... 现有配置
  
  // 新增：接口过滤配置
  operationFilter?: {
    // HTTP 方法过滤
    methods?: {
      include?: string[];
      exclude?: string[];
    };
    
    // 路径过滤
    paths?: {
      include?: string[];  // 支持通配符和正则表达式
      exclude?: string[];
    };
    
    // 操作 ID 过滤
    operations?: {
      include?: string[];
      exclude?: string[];
    };
    
    // 响应状态码过滤
    status?: {
      include?: number[];
      exclude?: number[];
    };
    
    // 参数过滤
    parameters?: {
      requireQuery?: boolean;     // 必须有查询参数
      requireBody?: boolean;      // 必须有请求体
      maxParameters?: number;     // 最大参数数量
    };
    
    // 自定义过滤函数（高级用法）
    custom?: {
      script?: string;           // JavaScript 过滤脚本路径
      function?: string;         // 过滤函数名
    };
  };
}
```

### 3.2 过滤配置文件示例

```json
{
  "transport": "stdio",
  "openapi": "./api.json",
  "operationFilter": {
    "methods": {
      "include": ["GET", "POST"],
      "exclude": ["DELETE"]
    },
    "paths": {
      "include": ["/api/v1/*", "/users/*"],
      "exclude": ["/internal/*", "/admin/*"]
    },
    "operations": {
      "include": ["getUser", "createUser", "updateUser"]
    },
    "status": {
      "include": [200, 201, 400, 404]
    },
    "parameters": {
      "maxParameters": 10,
      "requireQuery": false
    }
  }
}
```

## 4. 实现步骤和代码示例

### 4.1 步骤 1：扩展 TransformerOptions

```typescript
// packages/mcp-swagger-parser/src/transformer/types.ts
export interface TransformerOptions {
  // ... 现有选项
  
  /**
   * 操作过滤配置
   */
  operationFilter?: {
    methods?: {
      include?: string[];
      exclude?: string[];
    };
    paths?: {
      include?: string[];
      exclude?: string[];
    };
    operations?: {
      include?: string[];
      exclude?: string[];
    };
    status?: {
      include?: number[];
      exclude?: number[];
    };
    parameters?: {
      requireQuery?: boolean;
      requireBody?: boolean;
      maxParameters?: number;
    };
  };
}
```

### 4.2 步骤 2：扩展过滤逻辑

```typescript
// packages/mcp-swagger-parser/src/transformer/index.ts
class OpenAPIToMCPTransformer {
  private shouldIncludeOperation(
    path: string,
    method: string,
    operation: OperationObject
  ): boolean {
    const filter = this.options.operationFilter;
    if (!filter) return this.originalShouldIncludeOperation(path, method, operation);
    
    // HTTP 方法过滤
    if (filter.methods) {
      if (filter.methods.include && !filter.methods.include.includes(method.toUpperCase())) {
        return false;
      }
      if (filter.methods.exclude && filter.methods.exclude.includes(method.toUpperCase())) {
        return false;
      }
    }
    
    // 路径过滤
    if (filter.paths) {
      if (filter.paths.include && !this.matchesPathPatterns(path, filter.paths.include)) {
        return false;
      }
      if (filter.paths.exclude && this.matchesPathPatterns(path, filter.paths.exclude)) {
        return false;
      }
    }
    
    // 操作 ID 过滤
    if (filter.operations && operation.operationId) {
      if (filter.operations.include && !filter.operations.include.includes(operation.operationId)) {
        return false;
      }
      if (filter.operations.exclude && filter.operations.exclude.includes(operation.operationId)) {
        return false;
      }
    }
    
    // 响应状态码过滤
    if (filter.status && operation.responses) {
      const statusCodes = Object.keys(operation.responses).map(code => parseInt(code)).filter(code => !isNaN(code));
      
      if (filter.status.include && !statusCodes.some(code => filter.status.include!.includes(code))) {
        return false;
      }
      if (filter.status.exclude && statusCodes.some(code => filter.status.exclude!.includes(code))) {
        return false;
      }
    }
    
    // 参数过滤
    if (filter.parameters) {
      const parameters = operation.parameters || [];
      
      if (filter.parameters.maxParameters && parameters.length > filter.parameters.maxParameters) {
        return false;
      }
      
      if (filter.parameters.requireQuery) {
        const hasQueryParams = parameters.some(p => 'in' in p && p.in === 'query');
        if (!hasQueryParams) return false;
      }
      
      if (filter.parameters.requireBody) {
        const hasRequestBody = !!operation.requestBody;
        if (!hasRequestBody) return false;
      }
    }
    
    return this.originalShouldIncludeOperation(path, method, operation);
  }
  
  private matchesPathPatterns(path: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      // 支持通配符匹配
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(path);
    });
  }
}
```

### 4.3 步骤 3：CLI 参数解析和转换

```typescript
// cli.ts 中的参数处理函数
function parseFilterOptions(options: ServerOptions): TransformerOptions['operationFilter'] {
  const filter: TransformerOptions['operationFilter'] = {};
  
  // 解析 HTTP 方法
  if (options.includeMethods || options.excludeMethods) {
    filter.methods = {};
    if (options.includeMethods) {
      filter.methods.include = options.includeMethods.flatMap(m => m.split(',').map(s => s.trim().toUpperCase()));
    }
    if (options.excludeMethods) {
      filter.methods.exclude = options.excludeMethods.flatMap(m => m.split(',').map(s => s.trim().toUpperCase()));
    }
  }
  
  // 解析路径模式
  if (options.includePaths || options.excludePaths) {
    filter.paths = {};
    if (options.includePaths) {
      filter.paths.include = options.includePaths.flatMap(p => p.split(',').map(s => s.trim()));
    }
    if (options.excludePaths) {
      filter.paths.exclude = options.excludePaths.flatMap(p => p.split(',').map(s => s.trim()));
    }
  }
  
  // 解析操作 ID
  if (options.includeOperations || options.excludeOperations) {
    filter.operations = {};
    if (options.includeOperations) {
      filter.operations.include = options.includeOperations.flatMap(o => o.split(',').map(s => s.trim()));
    }
    if (options.excludeOperations) {
      filter.operations.exclude = options.excludeOperations.flatMap(o => o.split(',').map(s => s.trim()));
    }
  }
  
  // 解析状态码
  if (options.includeStatus || options.excludeStatus) {
    filter.status = {};
    if (options.includeStatus) {
      filter.status.include = options.includeStatus.flatMap(s => 
        s.split(',').map(code => parseInt(code.trim())).filter(code => !isNaN(code))
      );
    }
    if (options.excludeStatus) {
      filter.status.exclude = options.excludeStatus.flatMap(s => 
        s.split(',').map(code => parseInt(code.trim())).filter(code => !isNaN(code))
      );
    }
  }
  
  return Object.keys(filter).length > 0 ? filter : undefined;
}
```

### 4.4 步骤 4：集成到服务器启动逻辑

```typescript
// cli.ts 中的 main 函数修改
async function main() {
  // ... 现有逻辑
  
  // 解析过滤配置
  const operationFilter = parseFilterOptions(options);
  
  // 合并配置文件中的过滤配置
  if (config?.operationFilter) {
    // 合并 CLI 参数和配置文件中的过滤规则
    const mergedFilter = mergeFilterConfigs(operationFilter, config.operationFilter);
    operationFilter = mergedFilter;
  }
  
  // 创建 TransformOptions
  const transformOptions: TransformOptions = {
    baseUrl: options.baseUrl,
    includeDeprecated: options.includeDeprecated,
    authConfig,
    customHeaders,
    debugHeaders,
    operationFilter, // 新增过滤配置
  };
  
  // 启动服务器时传递转换选项
  switch (transport.toLowerCase()) {
    case 'stdio':
      await runStdioServer(openApiData, authConfig, customHeaders, debugHeaders, transformOptions);
      break;
    // ... 其他传输协议
  }
}
```

## 5. 使用示例和最佳实践

### 5.1 基础过滤示例

#### 示例 1：只包含 GET 和 POST 方法

```bash
mcp-swagger-server \
  -o ./api.json \
  --include-methods "GET,POST"
```

#### 示例 2：排除管理员接口

```bash
mcp-swagger-server \
  -o ./api.json \
  --exclude-paths "/admin/*,/internal/*"
```

#### 示例 3：只包含用户相关操作

```bash
mcp-swagger-server \
  -o ./api.json \
  --include-operations "getUser,createUser,updateUser,deleteUser"
```

### 5.2 复合过滤示例

#### 示例 4：组合多种过滤条件

```bash
mcp-swagger-server \
  -o ./api.json \
  --include-methods "GET,POST" \
  --include-paths "/api/v1/*" \
  --exclude-paths "/api/v1/admin/*" \
  --include-status "200,201,400,404"
```

#### 示例 5：使用配置文件进行复杂过滤

```bash
mcp-swagger-server --filter-config ./filter-config.json
```

`filter-config.json`：
```json
{
  "transport": "stdio",
  "openapi": "https://petstore.swagger.io/v2/swagger.json",
  "operationFilter": {
    "methods": {
      "include": ["GET", "POST"],
      "exclude": ["DELETE"]
    },
    "paths": {
      "include": ["/pet/*", "/user/*"],
      "exclude": ["/store/*"]
    },
    "parameters": {
      "maxParameters": 5,
      "requireQuery": false
    }
  }
}
```

### 5.3 高级过滤示例

#### 示例 6：开发环境 vs 生产环境

**开发环境配置** (`dev-filter.json`)：
```json
{
  "operationFilter": {
    "methods": {
      "include": ["GET", "POST", "PUT", "DELETE"]
    },
    "paths": {
      "include": ["/api/*"]
    }
  }
}
```

**生产环境配置** (`prod-filter.json`)：
```json
{
  "operationFilter": {
    "methods": {
      "include": ["GET", "POST"]
    },
    "paths": {
      "include": ["/api/v1/*"],
      "exclude": ["/api/v1/admin/*", "/api/v1/debug/*"]
    },
    "status": {
      "exclude": [500, 502, 503]
    }
  }
}
```

#### 示例 7：按功能模块过滤

```bash
# 只暴露用户管理相关接口
mcp-swagger-server \
  -o ./api.json \
  --include-paths "/users/*,/auth/*" \
  --include-operations "login,logout,getProfile,updateProfile"

# 只暴露只读接口
mcp-swagger-server \
  -o ./api.json \
  --include-methods "GET" \
  --exclude-paths "/admin/*"
```

### 5.4 最佳实践

#### 5.4.1 过滤策略建议

1. **渐进式过滤**：从宽松到严格
   ```bash
   # 第一步：排除明显不需要的接口
   --exclude-paths "/internal/*,/debug/*"
   
   # 第二步：限制 HTTP 方法
   --include-methods "GET,POST"
   
   # 第三步：精确控制操作
   --include-operations "getUser,createUser"
   ```

2. **环境差异化配置**：
   - 开发环境：包含更多接口用于测试
   - 生产环境：严格限制，只暴露必要接口

3. **安全优先**：
   ```bash
   # 优先排除敏感接口
   --exclude-paths "/admin/*,/system/*,/config/*"
   ```

#### 5.4.2 配置文件组织

```
config/
├── base-filter.json          # 基础过滤配置
├── dev-filter.json           # 开发环境配置
├── prod-filter.json          # 生产环境配置
└── module-filters/
    ├── user-module.json      # 用户模块过滤
    ├── order-module.json     # 订单模块过滤
    └── payment-module.json   # 支付模块过滤
```

#### 5.4.3 验证和测试

```bash
# 使用 --dry-run 参数预览过滤结果（需要实现）
mcp-swagger-server \
  -o ./api.json \
  --include-methods "GET" \
  --dry-run

# 输出过滤统计信息
mcp-swagger-server \
  -o ./api.json \
  --include-methods "GET,POST" \
  --verbose
```

## 6. 向后兼容性保证

### 6.1 兼容性原则

1. **默认行为不变**：不指定过滤参数时，行为与现有版本完全一致
2. **配置文件兼容**：现有配置文件无需修改即可继续使用
3. **API 兼容**：现有的编程 API 保持不变

### 6.2 迁移指南

对于现有用户，可以逐步采用新的过滤功能：

```bash
# 现有用法（继续有效）
mcp-swagger-server -t stdio -o ./api.json

# 逐步添加过滤（可选）
mcp-swagger-server -t stdio -o ./api.json --include-methods "GET,POST"

# 完全迁移到配置文件（推荐）
mcp-swagger-server --config ./enhanced-config.json
```

## 7. 实现优先级和路线图

### 7.1 第一阶段（核心功能）
- [ ] HTTP 方法过滤 (`--include-methods`, `--exclude-methods`)
- [ ] 路径前缀过滤 (`--include-paths`, `--exclude-paths`)
- [ ] 基础配置文件支持

### 7.2 第二阶段（增强功能）
- [ ] 操作 ID 过滤 (`--include-operations`, `--exclude-operations`)
- [ ] 响应状态码过滤 (`--include-status`, `--exclude-status`)
- [ ] 参数数量限制

### 7.3 第三阶段（高级功能）
- [ ] 自定义过滤脚本支持
- [ ] 过滤结果预览 (`--dry-run`)
- [ ] 详细统计信息 (`--verbose`)
- [ ] 过滤性能优化

## 8. 总结

通过以上设计，`mcp-swagger-server` 的 CLI 将支持灵活的 OpenAPI 接口过滤配置，主要优势包括：

1. **简洁易用**：CLI 参数设计直观，支持常见的过滤场景
2. **灵活组合**：支持多种过滤条件的组合使用
3. **配置文件支持**：复杂过滤规则可通过配置文件管理
4. **向后兼容**：现有用法完全不受影响
5. **渐进式采用**：用户可以逐步使用新功能

这个实现方案既满足了用户对接口过滤的需求，又保持了良好的用户体验和系统架构的清晰性。