# MCP Swagger Server 接口过滤配置实现方案

## 1. 项目概述

本文档分析了如何在 `mcp-swagger-server` 项目中实现 OpenAPI 接口选择性转换配置功能，允许用户根据 HTTP 方法、路径前缀、操作 ID 等维度过滤需要转换为 MCP Tools 的接口。

## 2. 当前代码分析

### 2.1 核心转换流程

当前的 OpenAPI 到 MCP Tools 转换流程如下：

1. **入口点**: `packages/mcp-swagger-server/src/transform/transformOpenApiToMcpTools.ts`
   - 使用 `mcp-swagger-parser` 包进行转换
   - 调用 `transformToMCPTools` 函数

2. **转换器**: `packages/mcp-swagger-parser/src/transformer/index.ts`
   - `OpenAPIToMCPTransformer` 类负责核心转换逻辑
   - `transformToMCPTools` 函数作为便捷入口

3. **过滤逻辑**: `shouldIncludeOperation` 方法
   - 当前仅支持基于 `deprecated` 状态和 `tags` 的过滤
   - 不支持 HTTP 方法或路径前缀过滤

### 2.2 现有配置选项

`TransformerOptions` 接口当前支持的配置：

```typescript
interface TransformerOptions {
  baseUrl?: string;
  includeDeprecated?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  requestTimeout?: number;
  defaultHeaders?: Record<string, string>;
  customHandlers?: Record<string, CustomHandler>;
  pathPrefix?: string;
  stripBasePath?: boolean;
  authConfig?: AuthConfig;
  // ... 其他配置
}
```

### 2.3 配置缺口分析

当前缺少以下过滤维度：
- HTTP 方法过滤（GET、POST、PUT、DELETE 等）
- 路径模式匹配（前缀、后缀、正则表达式）
- 操作 ID 模式匹配
- 响应状态码过滤
- 参数类型过滤

## 3. 配置设计方案

### 3.1 配置结构设计

建议在 `TransformerOptions` 中添加 `operationFilter` 配置项：

```typescript
interface OperationFilter {
  // HTTP 方法过滤
  methods?: {
    include?: string[]; // 包含的方法，如 ['GET', 'POST']
    exclude?: string[]; // 排除的方法
  };
  
  // 路径过滤
  paths?: {
    includePatterns?: string[]; // 包含的路径模式
    excludePatterns?: string[]; // 排除的路径模式
    prefixes?: string[];        // 路径前缀
    suffixes?: string[];        // 路径后缀
    regex?: string[];           // 正则表达式模式
  };
  
  // 操作 ID 过滤
  operationIds?: {
    includePatterns?: string[];
    excludePatterns?: string[];
    prefixes?: string[];
    suffixes?: string[];
    regex?: string[];
  };
  
  // 响应状态码过滤
  responseStatus?: {
    include?: string[]; // 如 ['200', '201']
    exclude?: string[];
  };
  
  // 参数过滤
  parameters?: {
    requireQuery?: boolean;     // 必须有查询参数
    requireBody?: boolean;      // 必须有请求体
    requirePath?: boolean;      // 必须有路径参数
    maxParameters?: number;     // 最大参数数量
  };
  
  // 自定义过滤函数
  customFilter?: (operation: OpenAPIV3.OperationObject, path: string, method: string) => boolean;
}

interface TransformerOptions {
  // ... 现有配置
  operationFilter?: OperationFilter;
}
```

### 3.2 配置文件结构

在项目根目录的 `mcp-config.json` 中添加转换配置：

```json
{
  "maxRetries": 10,
  "retryDelay": 1000,
  // ... 现有配置
  
  "transformOptions": {
    "baseUrl": "https://api.example.com",
    "includeDeprecated": false,
    "operationFilter": {
      "methods": {
        "include": ["GET", "POST"]
      },
      "paths": {
        "prefixes": ["/api/v1/users", "/api/v1/orders"],
        "excludePatterns": ["*/internal/*"]
      },
      "operationIds": {
        "prefixes": ["get", "list", "create"]
      },
      "parameters": {
        "maxParameters": 10
      }
    }
  }
}
```

## 4. 实现方案

### 4.1 核心实现步骤

#### 步骤 1: 扩展类型定义

在 `packages/mcp-swagger-parser/src/transformer/types.ts` 中添加：

```typescript
export interface OperationFilter {
  methods?: {
    include?: string[];
    exclude?: string[];
  };
  paths?: {
    includePatterns?: string[];
    excludePatterns?: string[];
    prefixes?: string[];
    suffixes?: string[];
    regex?: string[];
  };
  operationIds?: {
    includePatterns?: string[];
    excludePatterns?: string[];
    prefixes?: string[];
    suffixes?: string[];
    regex?: string[];
  };
  responseStatus?: {
    include?: string[];
    exclude?: string[];
  };
  parameters?: {
    requireQuery?: boolean;
    requireBody?: boolean;
    requirePath?: boolean;
    maxParameters?: number;
  };
  customFilter?: (operation: OpenAPIV3.OperationObject, path: string, method: string) => boolean;
}

export interface TransformerOptions {
  // ... 现有属性
  operationFilter?: OperationFilter;
}
```

#### 步骤 2: 实现过滤逻辑

在 `packages/mcp-swagger-parser/src/transformer/index.ts` 中扩展 `shouldIncludeOperation` 方法：

```typescript
private shouldIncludeOperation(
  operation: OpenAPIV3.OperationObject,
  path: string,
  method: string
): boolean {
  // 现有的 deprecated 和 tags 过滤逻辑
  if (!this.options.includeDeprecated && operation.deprecated) {
    return false;
  }

  if (!this.shouldIncludeByTags(operation)) {
    return false;
  }

  // 新增的操作过滤逻辑
  if (this.options.operationFilter) {
    return this.shouldIncludeByOperationFilter(operation, path, method);
  }

  return true;
}

private shouldIncludeByOperationFilter(
  operation: OpenAPIV3.OperationObject,
  path: string,
  method: string
): boolean {
  const filter = this.options.operationFilter!;

  // HTTP 方法过滤
  if (!this.matchesMethodFilter(method, filter.methods)) {
    return false;
  }

  // 路径过滤
  if (!this.matchesPathFilter(path, filter.paths)) {
    return false;
  }

  // 操作 ID 过滤
  if (!this.matchesOperationIdFilter(operation.operationId, filter.operationIds)) {
    return false;
  }

  // 响应状态码过滤
  if (!this.matchesResponseStatusFilter(operation.responses, filter.responseStatus)) {
    return false;
  }

  // 参数过滤
  if (!this.matchesParameterFilter(operation, filter.parameters)) {
    return false;
  }

  // 自定义过滤函数
  if (filter.customFilter && !filter.customFilter(operation, path, method)) {
    return false;
  }

  return true;
}

// 辅助方法实现
private matchesMethodFilter(method: string, methodFilter?: OperationFilter['methods']): boolean {
  if (!methodFilter) return true;
  
  const upperMethod = method.toUpperCase();
  
  if (methodFilter.include && !methodFilter.include.includes(upperMethod)) {
    return false;
  }
  
  if (methodFilter.exclude && methodFilter.exclude.includes(upperMethod)) {
    return false;
  }
  
  return true;
}

private matchesPathFilter(path: string, pathFilter?: OperationFilter['paths']): boolean {
  if (!pathFilter) return true;
  
  // 前缀匹配
  if (pathFilter.prefixes) {
    const hasMatchingPrefix = pathFilter.prefixes.some(prefix => path.startsWith(prefix));
    if (!hasMatchingPrefix) return false;
  }
  
  // 后缀匹配
  if (pathFilter.suffixes) {
    const hasMatchingSuffix = pathFilter.suffixes.some(suffix => path.endsWith(suffix));
    if (!hasMatchingSuffix) return false;
  }
  
  // 包含模式
  if (pathFilter.includePatterns) {
    const hasMatchingPattern = pathFilter.includePatterns.some(pattern => 
      this.matchesPattern(path, pattern)
    );
    if (!hasMatchingPattern) return false;
  }
  
  // 排除模式
  if (pathFilter.excludePatterns) {
    const hasExcludingPattern = pathFilter.excludePatterns.some(pattern => 
      this.matchesPattern(path, pattern)
    );
    if (hasExcludingPattern) return false;
  }
  
  // 正则表达式
  if (pathFilter.regex) {
    const hasMatchingRegex = pathFilter.regex.some(regexStr => {
      try {
        const regex = new RegExp(regexStr);
        return regex.test(path);
      } catch {
        return false;
      }
    });
    if (!hasMatchingRegex) return false;
  }
  
  return true;
}

private matchesPattern(text: string, pattern: string): boolean {
  // 支持通配符 * 匹配
  const regexPattern = pattern.replace(/\*/g, '.*');
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(text);
}

// 其他辅助方法...
```

#### 步骤 3: 更新配置加载

在 `packages/mcp-swagger-server/src/types/core.ts` 中更新 `TransformOptions`：

```typescript
export interface TransformOptions {
  // ... 现有属性
  operationFilter?: OperationFilter;
}
```

#### 步骤 4: 配置文件集成

更新配置加载逻辑，从 `mcp-config.json` 读取 `transformOptions`。

### 4.2 配置验证

添加配置验证逻辑：

```typescript
export function validateOperationFilter(filter: OperationFilter): string[] {
  const errors: string[] = [];
  
  // 验证 HTTP 方法
  if (filter.methods) {
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    const invalidInclude = filter.methods.include?.filter(m => !validMethods.includes(m.toUpperCase()));
    const invalidExclude = filter.methods.exclude?.filter(m => !validMethods.includes(m.toUpperCase()));
    
    if (invalidInclude?.length) {
      errors.push(`Invalid HTTP methods in include: ${invalidInclude.join(', ')}`);
    }
    if (invalidExclude?.length) {
      errors.push(`Invalid HTTP methods in exclude: ${invalidExclude.join(', ')}`);
    }
  }
  
  // 验证正则表达式
  if (filter.paths?.regex) {
    filter.paths.regex.forEach((regexStr, index) => {
      try {
        new RegExp(regexStr);
      } catch (e) {
        errors.push(`Invalid regex pattern at paths.regex[${index}]: ${regexStr}`);
      }
    });
  }
  
  return errors;
}
```

## 5. 配置示例

### 5.1 基础配置示例

```json
{
  "transformOptions": {
    "operationFilter": {
      "methods": {
        "include": ["GET", "POST"]
      }
    }
  }
}
```

### 5.2 复杂配置示例

```json
{
  "transformOptions": {
    "baseUrl": "https://api.example.com",
    "includeDeprecated": false,
    "operationFilter": {
      "methods": {
        "include": ["GET", "POST", "PUT"],
        "exclude": ["DELETE"]
      },
      "paths": {
        "prefixes": ["/api/v1/users", "/api/v1/orders"],
        "excludePatterns": ["*/internal/*", "*/admin/*"],
        "regex": ["^/api/v[12]/public/.*"]
      },
      "operationIds": {
        "prefixes": ["get", "list", "create", "update"],
        "excludePatterns": ["*Internal*", "*Admin*"]
      },
      "responseStatus": {
        "include": ["200", "201", "204"]
      },
      "parameters": {
        "maxParameters": 10,
        "requireQuery": false
      }
    }
  }
}
```

### 5.3 场景化配置示例

#### 只转换读取操作
```json
{
  "transformOptions": {
    "operationFilter": {
      "methods": {
        "include": ["GET", "HEAD"]
      },
      "operationIds": {
        "prefixes": ["get", "list", "find", "search"]
      }
    }
  }
}
```

#### 只转换公共 API
```json
{
  "transformOptions": {
    "operationFilter": {
      "paths": {
        "prefixes": ["/api/public"],
        "excludePatterns": ["*/internal/*", "*/private/*"]
      }
    }
  }
}
```

#### 排除管理员接口
```json
{
  "transformOptions": {
    "operationFilter": {
      "paths": {
        "excludePatterns": ["*/admin/*", "*/management/*"]
      },
      "operationIds": {
        "excludePatterns": ["*Admin*", "*Management*"]
      }
    }
  }
}
```

## 6. 扩展建议

### 6.1 动态配置支持

- 支持运行时动态更新过滤配置
- 提供配置热重载功能
- 添加配置变更通知机制

### 6.2 UI 配置界面

- 在 Web UI 中添加可视化配置界面
- 提供配置预览和验证功能
- 支持配置模板和预设

### 6.3 高级过滤功能

- 支持基于 OpenAPI 扩展字段的过滤
- 添加基于安全要求的过滤
- 支持基于响应 Schema 复杂度的过滤

### 6.4 性能优化

- 缓存过滤结果
- 优化正则表达式编译
- 添加过滤统计和性能监控

### 6.5 配置管理

- 支持多环境配置
- 添加配置版本控制
- 提供配置导入导出功能

## 7. 总结

本方案提供了一个完整的 OpenAPI 接口过滤配置系统，支持多维度的接口筛选，包括 HTTP 方法、路径模式、操作 ID、响应状态码和参数等。通过灵活的配置选项和强大的过滤逻辑，用户可以精确控制哪些接口被转换为 MCP Tools，从而优化工具集的大小和相关性。

该方案具有良好的扩展性和可维护性，可以根据实际需求进一步定制和优化。