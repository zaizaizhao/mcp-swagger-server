# MCP Swagger Parser API 文档

## 快速开始

### 安装

```bash
npm install @mcp-swagger/parser
```

### 基础使用

```typescript
import { parseFromUrl, parseFromFile, parseFromString, transformToMCPTools } from '@mcp-swagger/parser';

// 从 URL 解析
const result = await parseFromUrl('https://api.example.com/swagger.json');

// 从文件解析
const result = await parseFromFile('./swagger.json');

// 从字符串解析
const swaggerJson = '{"openapi": "3.0.0", ...}';
const result = await parseFromString(swaggerJson);

// 转换为 MCP 工具
const tools = transformToMCPTools(result.spec);
```

## 核心 API

### parseFromUrl(url, config?)

从 URL 解析 OpenAPI 规范。

**参数**:
- `url: string` - OpenAPI 规范的 URL
- `config?: ParserConfig` - 可选的解析器配置

**返回**: `Promise<ParseResult>`

**示例**:
```typescript
const result = await parseFromUrl('https://petstore.swagger.io/v2/swagger.json', {
  validateSchema: true,
  strictMode: false
});

console.log(`解析了 ${result.metadata.endpointCount} 个端点`);
```

### parseFromFile(filePath, config?)

从文件解析 OpenAPI 规范。

**参数**:
- `filePath: string` - 文件路径
- `config?: ParserConfig` - 可选的解析器配置

**返回**: `Promise<ParseResult>`

**示例**:
```typescript
const result = await parseFromFile('./api/swagger.yaml', {
  validateSchema: true,
  resolveReferences: true
});
```

### parseFromString(content, config?)

从字符串内容解析 OpenAPI 规范。

**参数**:
- `content: string` - OpenAPI 规范内容（JSON 或 YAML）
- `config?: ParserConfig` - 可选的解析器配置

**返回**: `Promise<ParseResult>`

### transformToMCPTools(spec, options?)

将 OpenAPI 规范转换为 MCP 工具。

**参数**:
- `spec: OpenAPISpec` - 解析后的 OpenAPI 规范
- `options?: TransformerOptions` - 转换选项

**返回**: `MCPTool[]`

**示例**:
```typescript
const tools = transformToMCPTools(result.spec, {
  baseUrl: 'https://api.example.com',
  includeDeprecated: false,
  includeTags: ['user', 'order']
});
```

## 高级 API

### OpenAPIParser 类

主解析器类，提供更多控制选项。

```typescript
import { OpenAPIParser } from '@mcp-swagger/parser';

const parser = new OpenAPIParser({
  validateSchema: true,
  resolveReferences: true,
  strictMode: false,
  customValidators: []
});

// 使用解析器
const result = await parser.parseFromUrl('https://api.example.com/swagger.json');
```

### OpenAPIToMCPTransformer 类

OpenAPI 到 MCP 的转换器类。

```typescript
import { OpenAPIToMCPTransformer } from '@mcp-swagger/parser';

const transformer = new OpenAPIToMCPTransformer(spec, {
  baseUrl: 'https://api.example.com',
  includeDeprecated: false,
  requestTimeout: 30000,
  defaultHeaders: {
    'Authorization': 'Bearer token',
    'Content-Type': 'application/json'
  }
});

const tools = transformer.transformToMCPTools();
```

## 配置选项

### ParserConfig

```typescript
interface ParserConfig {
  validateSchema?: boolean;        // 是否验证 OpenAPI schema，默认 true
  resolveReferences?: boolean;     // 是否解析 $ref 引用，默认 true
  allowEmptyPaths?: boolean;       // 是否允许空的 paths，默认 false
  strictMode?: boolean;            // 严格模式，默认 false
  customValidators?: ValidationRule[];  // 自定义验证规则
}
```

### TransformerOptions

```typescript
interface TransformerOptions {
  baseUrl?: string;               // API 基础 URL
  includeDeprecated?: boolean;    // 是否包含废弃的 API，默认 false
  includeTags?: string[];         // 包含的标签列表
  excludeTags?: string[];         // 排除的标签列表
  requestTimeout?: number;        // 请求超时时间，默认 30000ms
  defaultHeaders?: Record<string, string>;  // 默认请求头
  customHandlers?: Record<string, Function>; // 自定义处理器
  pathPrefix?: string;            // 路径前缀
  stripBasePath?: boolean;        // 是否移除基础路径
}
```

## 类型定义

### ParseResult

```typescript
interface ParseResult {
  spec: ParsedApiSpec;           // 解析后的 API 规范
  validation: ValidationResult;   // 验证结果
  metadata: ParseMetadata;        // 解析元数据
}
```

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean;                 // 是否有效
  isValid: boolean;              // 是否有效（兼容性）
  errors: ValidationError[];      // 错误列表
  warnings: ValidationWarning[];  // 警告列表
  metadata?: ValidationMetadata;  // 验证元数据
}
```

### MCPTool

```typescript
interface MCPTool {
  name: string;                   // 工具名称
  description: string;            // 工具描述
  inputSchema: {                  // 输入 schema
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
  handler: (args: any) => Promise<MCPToolResponse>;  // 处理函数
  metadata?: {                    // 元数据
    method: string;
    path: string;
    tags?: string[];
    operationId?: string;
    deprecated?: boolean;
  };
}
```

## 错误处理

### 错误类型

```typescript
// 基础解析错误
class OpenAPIParseError extends Error {
  code: string;
  context?: any;
}

// 验证错误
class OpenAPIValidationError extends OpenAPIParseError {
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
```

### 错误处理示例

```typescript
try {
  const result = await parseFromUrl('https://api.example.com/invalid.json');
} catch (error) {
  if (error instanceof OpenAPIValidationError) {
    console.log('验证错误:');
    error.errors.forEach(err => {
      console.log(`- ${err.path}: ${err.message}`);
    });
  } else if (error instanceof OpenAPIParseError) {
    console.log(`解析错误 (${error.code}): ${error.message}`);
  } else {
    console.log('未知错误:', error);
  }
}
```

## 实际使用案例

### 1. 基础 API 转换

```typescript
import { parseFromUrl, transformToMCPTools } from '@mcp-swagger/parser';

async function convertPetstoreAPI() {
  try {
    // 解析 Petstore API
    const result = await parseFromUrl('https://petstore.swagger.io/v2/swagger.json');
    
    // 检查验证结果
    if (!result.validation.valid) {
      console.warn('API 规范有问题:');
      result.validation.errors.forEach(error => {
        console.warn(`- ${error.message}`);
      });
    }
    
    // 转换为 MCP 工具
    const tools = transformToMCPTools(result.spec, {
      baseUrl: 'https://petstore.swagger.io/v2',
      excludeTags: ['store'],  // 排除 store 相关 API
      includeDeprecated: false
    });
    
    console.log(`生成了 ${tools.length} 个 MCP 工具`);
    
    // 输出工具信息
    tools.forEach(tool => {
      console.log(`- ${tool.name}: ${tool.description}`);
    });
    
    return tools;
  } catch (error) {
    console.error('转换失败:', error);
    throw error;
  }
}
```

### 2. 自定义验证规则

```typescript
import { OpenAPIParser, ValidationRule } from '@mcp-swagger/parser';

// 自定义验证规则：检查是否所有操作都有 operationId
const requireOperationId: ValidationRule = {
  name: 'require-operation-id',
  validate: (spec) => {
    const errors = [];
    const warnings = [];
    
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (typeof operation === 'object' && !operation.operationId) {
          warnings.push({
            code: 'MISSING_OPERATION_ID',
            message: `操作 ${method.toUpperCase()} ${path} 缺少 operationId`,
            path: `paths.${path}.${method}`,
            severity: 'warning'
          });
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
};

// 使用自定义验证
const parser = new OpenAPIParser({
  customValidators: [requireOperationId]
});

const result = await parser.parseFromFile('./api.json');
```

### 3. 批量处理多个 API

```typescript
import { parseFromUrl, transformToMCPTools } from '@mcp-swagger/parser';

async function processMultipleAPIs(apiUrls: string[]) {
  const results = [];
  
  for (const url of apiUrls) {
    try {
      console.log(`处理 ${url}...`);
      
      const result = await parseFromUrl(url);
      const tools = transformToMCPTools(result.spec);
      
      results.push({
        url,
        success: true,
        toolCount: tools.length,
        tools,
        metadata: result.metadata
      });
      
    } catch (error) {
      console.error(`处理 ${url} 失败:`, error.message);
      results.push({
        url,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

// 使用示例
const apiUrls = [
  'https://petstore.swagger.io/v2/swagger.json',
  'https://api.example1.com/swagger.json',
  'https://api.example2.com/openapi.yaml'
];

const results = await processMultipleAPIs(apiUrls);
console.log(`成功处理 ${results.filter(r => r.success).length}/${results.length} 个 API`);
```

### 4. 与 MCP 服务器集成

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { parseFromFile, transformToMCPTools } from '@mcp-swagger/parser';

async function setupMCPServer() {
  const server = new McpServer({
    name: 'swagger-api-server',
    version: '1.0.0'
  });
  
  // 解析 API 规范
  const result = await parseFromFile('./api/swagger.json');
  const tools = transformToMCPTools(result.spec, {
    baseUrl: process.env.API_BASE_URL,
    defaultHeaders: {
      'Authorization': `Bearer ${process.env.API_TOKEN}`
    }
  });
  
  // 注册工具到 MCP 服务器
  for (const tool of tools) {
    server.addTool({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }, tool.handler);
  }
  
  console.log(`注册了 ${tools.length} 个工具到 MCP 服务器`);
  
  return server;
}
```

## 性能优化建议

### 1. 缓存解析结果

```typescript
const cache = new Map<string, ParseResult>();

async function cachedParseFromUrl(url: string) {
  if (cache.has(url)) {
    return cache.get(url)!;
  }
  
  const result = await parseFromUrl(url);
  cache.set(url, result);
  return result;
}
```

### 2. 并行处理

```typescript
async function parseMultipleURLs(urls: string[]) {
  const promises = urls.map(url => parseFromUrl(url));
  return Promise.allSettled(promises);
}
```

### 3. 流式处理大文件

```typescript
// 对于超大 OpenAPI 文件，考虑使用流式处理
import { createReadStream } from 'fs';

async function parseStreamFile(filePath: string) {
  // 实现流式解析逻辑
  // 这个功能在后续版本中会添加
}
```

## 故障排除

### 常见问题

1. **解析失败**: 检查 OpenAPI 规范格式是否正确
2. **验证错误**: 使用 `strictMode: false` 跳过非关键验证
3. **内存不足**: 对大文件使用分块处理
4. **网络超时**: 调整请求超时设置

### 调试模式

```typescript
// 启用详细日志
const parser = new OpenAPIParser({
  validateSchema: true,
  strictMode: true  // 在开发阶段启用严格模式
});

// 捕获所有错误和警告
const result = await parser.parseFromUrl(url);
if (result.validation.warnings.length > 0) {
  console.warn('发现警告:');
  result.validation.warnings.forEach(warning => {
    console.warn(`- ${warning.path}: ${warning.message}`);
  });
}
```
