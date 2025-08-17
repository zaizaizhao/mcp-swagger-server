# MCP Swagger 兼容性修复实现指南

## 1. 实现概述

本文档提供了修复 `mcp-swagger-parser` 和 `mcp-swagger-server` 包兼容性问题的具体实现步骤，确保新增的 `operationFilter` 配置能够在整个调用链中正确传递和使用。

## 2. 修改清单

### 2.1 需要修改的文件

| 包 | 文件路径 | 修改类型 | 优先级 |
|---|---------|---------|--------|
| mcp-swagger-parser | `src/transformer/types.ts` | 扩展接口 | 高 |
| mcp-swagger-parser | `src/transformer/index.ts` | 实现过滤逻辑 | 高 |
| mcp-swagger-server | `src/types/core.ts` | 扩展接口 | 高 |
| mcp-swagger-server | `src/lib/Transformer.ts` | 完善转换逻辑 | 高 |
| mcp-swagger-server | `src/cli.ts` | 添加CLI参数 | 中 |
| mcp-swagger-server | `src/config/types.ts` | 扩展配置接口 | 中 |

## 3. 详细实现步骤

### 3.1 第一步：扩展 mcp-swagger-parser 类型定义

**文件：** `packages/mcp-swagger-parser/src/transformer/types.ts`

```typescript
// 在现有接口基础上添加以下内容

/**
 * 操作过滤配置接口
 */
export interface OperationFilter {
  /** HTTP 方法过滤 */
  methods?: {
    include?: string[]; // 包含的方法，如 ['GET', 'POST']
    exclude?: string[]; // 排除的方法，如 ['DELETE']
  };
  
  /** 路径过滤 */
  paths?: {
    include?: string[]; // 包含的路径模式，支持通配符
    exclude?: string[]; // 排除的路径模式，支持通配符
  };
  
  /** 操作ID过滤 */
  operationIds?: {
    include?: string[]; // 包含的操作ID模式
    exclude?: string[]; // 排除的操作ID模式
  };
  
  /** 响应状态码过滤 */
  statusCodes?: {
    include?: number[]; // 包含的状态码，如 [200, 201]
    exclude?: number[]; // 排除的状态码，如 [404, 500]
  };
  
  /** 参数过滤 */
  parameters?: {
    required?: boolean; // 是否只包含有必需参数的操作
    types?: string[];   // 参数类型过滤，如 ['string', 'number']
  };
  
  /** 自定义过滤函数 */
  custom?: (operation: any, path: string, method: string) => boolean;
}

// 扩展现有的 TransformerOptions 接口
export interface TransformerOptions {
  // ... 现有字段保持不变 ...
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
  customHeaders?: CustomHeaders;
  debugHeaders?: boolean;
  protectedHeaders?: string[];
  includeFieldAnnotations?: boolean;
  annotationOptions?: AnnotationOptions;
  
  /** 新增：操作过滤配置 */
  operationFilter?: OperationFilter;
}
```

### 3.2 第二步：实现过滤逻辑

**文件：** `packages/mcp-swagger-parser/src/transformer/index.ts`

```typescript
// 找到现有的 shouldIncludeOperation 方法，替换为以下实现

/**
 * 检查是否应该包含某个操作
 */
private shouldIncludeOperation(
  operation: any,
  path: string,
  method: string,
  options: TransformerOptions
): boolean {
  // 现有的 deprecated 检查
  if (!options.includeDeprecated && operation.deprecated) {
    return false;
  }
  
  // 现有的 tags 检查
  if (options.includeTags || options.excludeTags) {
    const operationTags = operation.tags || [];
    
    if (options.includeTags && options.includeTags.length > 0) {
      const hasIncludedTag = operationTags.some((tag: string) => 
        options.includeTags!.includes(tag)
      );
      if (!hasIncludedTag) {
        return false;
      }
    }
    
    if (options.excludeTags && options.excludeTags.length > 0) {
      const hasExcludedTag = operationTags.some((tag: string) => 
        options.excludeTags!.includes(tag)
      );
      if (hasExcludedTag) {
        return false;
      }
    }
  }
  
  // 新增：操作过滤检查
  if (options.operationFilter) {
    return this.checkOperationFilter(operation, path, method, options.operationFilter);
  }
  
  return true;
}

/**
 * 检查操作是否通过过滤条件
 */
private checkOperationFilter(
  operation: any,
  path: string,
  method: string,
  filter: OperationFilter
): boolean {
  // HTTP 方法过滤
  if (filter.methods) {
    if (filter.methods.include && filter.methods.include.length > 0) {
      if (!filter.methods.include.includes(method.toUpperCase())) {
        return false;
      }
    }
    
    if (filter.methods.exclude && filter.methods.exclude.length > 0) {
      if (filter.methods.exclude.includes(method.toUpperCase())) {
        return false;
      }
    }
  }
  
  // 路径过滤
  if (filter.paths) {
    if (filter.paths.include && filter.paths.include.length > 0) {
      const matchesInclude = filter.paths.include.some(pattern => 
        this.matchesPathPattern(path, pattern)
      );
      if (!matchesInclude) {
        return false;
      }
    }
    
    if (filter.paths.exclude && filter.paths.exclude.length > 0) {
      const matchesExclude = filter.paths.exclude.some(pattern => 
        this.matchesPathPattern(path, pattern)
      );
      if (matchesExclude) {
        return false;
      }
    }
  }
  
  // 操作ID过滤
  if (filter.operationIds && operation.operationId) {
    if (filter.operationIds.include && filter.operationIds.include.length > 0) {
      const matchesInclude = filter.operationIds.include.some(pattern => 
        this.matchesPattern(operation.operationId, pattern)
      );
      if (!matchesInclude) {
        return false;
      }
    }
    
    if (filter.operationIds.exclude && filter.operationIds.exclude.length > 0) {
      const matchesExclude = filter.operationIds.exclude.some(pattern => 
        this.matchesPattern(operation.operationId, pattern)
      );
      if (matchesExclude) {
        return false;
      }
    }
  }
  
  // 状态码过滤
  if (filter.statusCodes && operation.responses) {
    const responseCodes = Object.keys(operation.responses)
      .map(code => parseInt(code))
      .filter(code => !isNaN(code));
    
    if (filter.statusCodes.include && filter.statusCodes.include.length > 0) {
      const hasIncludedCode = responseCodes.some(code => 
        filter.statusCodes!.include!.includes(code)
      );
      if (!hasIncludedCode) {
        return false;
      }
    }
    
    if (filter.statusCodes.exclude && filter.statusCodes.exclude.length > 0) {
      const hasExcludedCode = responseCodes.some(code => 
        filter.statusCodes!.exclude!.includes(code)
      );
      if (hasExcludedCode) {
        return false;
      }
    }
  }
  
  // 参数过滤
  if (filter.parameters) {
    const parameters = operation.parameters || [];
    
    if (filter.parameters.required !== undefined) {
      const hasRequiredParams = parameters.some((param: any) => param.required);
      if (filter.parameters.required && !hasRequiredParams) {
        return false;
      }
      if (!filter.parameters.required && hasRequiredParams) {
        return false;
      }
    }
    
    if (filter.parameters.types && filter.parameters.types.length > 0) {
      const paramTypes = parameters.map((param: any) => 
        param.schema?.type || param.type
      ).filter(Boolean);
      
      const hasMatchingType = paramTypes.some((type: string) => 
        filter.parameters!.types!.includes(type)
      );
      if (!hasMatchingType) {
        return false;
      }
    }
  }
  
  // 自定义过滤函数
  if (filter.custom) {
    if (!filter.custom(operation, path, method)) {
      return false;
    }
  }
  
  return true;
}

/**
 * 检查路径是否匹配模式（支持通配符）
 */
private matchesPathPattern(path: string, pattern: string): boolean {
  // 将通配符模式转换为正则表达式
  const regexPattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * 检查字符串是否匹配模式（支持通配符）
 */
private matchesPattern(value: string, pattern: string): boolean {
  const regexPattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(value);
}
```

### 3.3 第三步：扩展 mcp-swagger-server 类型定义

**文件：** `packages/mcp-swagger-server/src/types/core.ts`

```typescript
// 导入 OperationFilter 类型
import { OperationFilter } from 'mcp-swagger-parser/src/transformer/types';

// 扩展现有的 TransformOptions 接口
export interface TransformOptions {
  // 现有字段保持不变
  baseUrl?: string;
  includeDeprecated?: boolean;
  requestTimeout?: number;
  pathPrefix?: string;
  
  // 保持向后兼容的 tagFilter
  tagFilter?: {
    include?: string[];
    exclude?: string[];
  };
  
  // 新增字段，直接传递给 parser
  includeTags?: string[];
  excludeTags?: string[];
  customHeaders?: CustomHeaders;
  debugHeaders?: boolean;
  protectedHeaders?: string[];
  includeFieldAnnotations?: boolean;
  annotationOptions?: AnnotationOptions;
  
  // 新增：操作过滤配置
  operationFilter?: OperationFilter;
  
  // server 层特有字段
  operationIdPrefix?: string;
  enableAuth?: boolean;
  authConfig?: AuthConfig;
}
```

### 3.4 第四步：完善类型转换逻辑

**文件：** `packages/mcp-swagger-server/src/lib/Transformer.ts`

```typescript
// 找到现有的 transformFromOpenAPI 方法，更新类型转换逻辑

/**
 * 构建 TransformerOptions
 */
private buildTransformerOptions(options: TransformOptions): TransformerOptions {
  const transformerOptions: TransformerOptions = {
    baseUrl: options.baseUrl,
    includeDeprecated: options.includeDeprecated,
    requestTimeout: options.requestTimeout,
    pathPrefix: options.pathPrefix,
    stripBasePath: options.stripBasePath,
    authConfig: options.authConfig,
    customHeaders: options.customHeaders,
    debugHeaders: options.debugHeaders,
    protectedHeaders: options.protectedHeaders,
    includeFieldAnnotations: options.includeFieldAnnotations,
    annotationOptions: options.annotationOptions,
    
    // 处理标签过滤（向后兼容）
    includeTags: options.includeTags || options.tagFilter?.include,
    excludeTags: options.excludeTags || options.tagFilter?.exclude,
    
    // 新增：操作过滤配置
    operationFilter: options.operationFilter,
  };
  
  return transformerOptions;
}

// 更新 transformFromOpenAPI 方法
async transformFromOpenAPI(
  openApiSpec: any,
  options: TransformOptions = {}
): Promise<MCPTool[]> {
  try {
    // 构建 transformer 选项
    const transformerOptions = this.buildTransformerOptions(options);
    
    // 调用 parser 进行转换
    const parserTools = await this.parser.transformFromOpenAPI(
      openApiSpec,
      transformerOptions
    );
    
    // 应用 server 层的后处理
    let processedTools = parserTools;
    
    // 应用操作ID前缀（如果配置了）
    if (options.operationIdPrefix) {
      processedTools = processedTools.map(tool => ({
        ...tool,
        name: `${options.operationIdPrefix}${tool.name}`
      }));
    }
    
    // 应用认证配置（如果启用了）
    if (options.enableAuth && options.authConfig) {
      processedTools = this.applyAuthConfig(processedTools, options.authConfig);
    }
    
    // 转换为 MCPTool 格式
    const mcpTools = processedTools.map(tool => this.convertToMCPTool(tool));
    
    // 标准化和验证
    const normalizedTools = mcpTools.map(tool => this.normalizeToolName(tool));
    const validatedTools = normalizedTools.filter(tool => this.validateTool(tool));
    
    return validatedTools;
  } catch (error) {
    console.error('Error transforming OpenAPI spec:', error);
    throw error;
  }
}
```

### 3.5 第五步：扩展 CLI 参数支持

**文件：** `packages/mcp-swagger-server/src/cli.ts`

```typescript
// 扩展 ServerOptions 接口
interface ServerOptions {
  // 现有字段...
  port?: number;
  transport?: 'stdio' | 'sse' | 'streamable';
  openApiUrl?: string;
  openApiFile?: string;
  configFile?: string;
  
  // 新增过滤参数
  includeMethods?: string[];
  excludeMethods?: string[];
  includePaths?: string[];
  excludePaths?: string[];
  includeOperations?: string[];
  excludeOperations?: string[];
  includeStatus?: number[];
  excludeStatus?: number[];
  filterConfig?: string; // 过滤配置文件路径
  requireParams?: boolean;
  paramTypes?: string[];
}

// 更新 CLI 参数定义
const program = new Command()
  .name('mcp-swagger-server')
  .description('MCP Server for OpenAPI/Swagger specifications')
  .version(version)
  // 现有参数...
  .option('-p, --port <port>', 'Server port', '3000')
  .option('-t, --transport <type>', 'Transport type (stdio|sse|streamable)', 'stdio')
  .option('--openapi-url <url>', 'OpenAPI specification URL')
  .option('--openapi-file <file>', 'OpenAPI specification file path')
  .option('-c, --config <file>', 'Configuration file path')
  
  // 新增过滤参数
  .option('--include-methods <methods>', 'Include HTTP methods (comma-separated)', (value) => value.split(','))
  .option('--exclude-methods <methods>', 'Exclude HTTP methods (comma-separated)', (value) => value.split(','))
  .option('--include-paths <paths>', 'Include path patterns (comma-separated)', (value) => value.split(','))
  .option('--exclude-paths <paths>', 'Exclude path patterns (comma-separated)', (value) => value.split(','))
  .option('--include-operations <operations>', 'Include operation IDs (comma-separated)', (value) => value.split(','))
  .option('--exclude-operations <operations>', 'Exclude operation IDs (comma-separated)', (value) => value.split(','))
  .option('--include-status <codes>', 'Include status codes (comma-separated)', (value) => value.split(',').map(Number))
  .option('--exclude-status <codes>', 'Exclude status codes (comma-separated)', (value) => value.split(',').map(Number))
  .option('--filter-config <file>', 'Filter configuration file path')
  .option('--require-params', 'Only include operations with required parameters')
  .option('--param-types <types>', 'Include parameter types (comma-separated)', (value) => value.split(','));

// 添加过滤选项解析函数
function parseFilterOptions(options: ServerOptions): OperationFilter | undefined {
  const filter: OperationFilter = {};
  let hasFilter = false;
  
  // HTTP 方法过滤
  if (options.includeMethods || options.excludeMethods) {
    filter.methods = {
      include: options.includeMethods,
      exclude: options.excludeMethods,
    };
    hasFilter = true;
  }
  
  // 路径过滤
  if (options.includePaths || options.excludePaths) {
    filter.paths = {
      include: options.includePaths,
      exclude: options.excludePaths,
    };
    hasFilter = true;
  }
  
  // 操作ID过滤
  if (options.includeOperations || options.excludeOperations) {
    filter.operationIds = {
      include: options.includeOperations,
      exclude: options.excludeOperations,
    };
    hasFilter = true;
  }
  
  // 状态码过滤
  if (options.includeStatus || options.excludeStatus) {
    filter.statusCodes = {
      include: options.includeStatus,
      exclude: options.excludeStatus,
    };
    hasFilter = true;
  }
  
  // 参数过滤
  if (options.requireParams !== undefined || options.paramTypes) {
    filter.parameters = {
      required: options.requireParams,
      types: options.paramTypes,
    };
    hasFilter = true;
  }
  
  return hasFilter ? filter : undefined;
}

// 更新主函数中的配置构建逻辑
async function main() {
  const options = program.parse().opts<ServerOptions>();
  
  // 现有的配置加载逻辑...
  
  // 构建过滤配置
  let operationFilter = parseFilterOptions(options);
  
  // 如果指定了过滤配置文件，加载并合并
  if (options.filterConfig) {
    try {
      const filterConfigContent = await fs.readFile(options.filterConfig, 'utf-8');
      const filterConfig = JSON.parse(filterConfigContent);
      
      // 合并配置（CLI 参数优先）
      operationFilter = {
        ...filterConfig,
        ...operationFilter,
      };
    } catch (error) {
      console.error(`Error loading filter config: ${error}`);
      process.exit(1);
    }
  }
  
  // 构建 TransformOptions
  const transformOptions: TransformOptions = {
    baseUrl: config.baseUrl || process.env.MCP_BASE_URL,
    includeDeprecated: config.includeDeprecated,
    requestTimeout: config.requestTimeout,
    pathPrefix: config.pathPrefix,
    tagFilter: config.tagFilter,
    operationIdPrefix: config.operationIdPrefix,
    enableAuth: config.enableAuth,
    authConfig: authConfig,
    customHeaders: config.customHeaders,
    debugHeaders: config.debugHeaders,
    
    // 新增：操作过滤配置
    operationFilter: operationFilter,
  };
  
  // 其余启动逻辑保持不变...
}
```

### 3.6 第六步：扩展配置文件支持

**文件：** `packages/mcp-swagger-server/src/config/types.ts`（如果不存在则创建）

```typescript
import { OperationFilter } from 'mcp-swagger-parser/src/transformer/types';

// 扩展配置文件接口
export interface ConfigFile {
  server?: {
    port?: number;
    transport?: 'stdio' | 'sse' | 'streamable';
  };
  
  openapi?: {
    url?: string;
    file?: string;
  };
  
  transform?: {
    baseUrl?: string;
    includeDeprecated?: boolean;
    requestTimeout?: number;
    pathPrefix?: string;
    
    // 标签过滤（向后兼容）
    tagFilter?: {
      include?: string[];
      exclude?: string[];
    };
    
    // 新增：操作过滤配置
    operationFilter?: OperationFilter;
    
    // 其他配置
    operationIdPrefix?: string;
    enableAuth?: boolean;
    authConfig?: AuthConfig;
    customHeaders?: CustomHeaders;
    debugHeaders?: boolean;
  };
}
```

## 4. 配置验证实现

**文件：** `packages/mcp-swagger-server/src/utils/validation.ts`（新建）

```typescript
import { OperationFilter } from 'mcp-swagger-parser/src/transformer/types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * 验证操作过滤配置
 */
export function validateOperationFilter(filter: OperationFilter): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 验证 HTTP 方法
  if (filter.methods) {
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    
    const checkMethods = (methods: string[] | undefined, type: string) => {
      if (methods) {
        const invalidMethods = methods.filter(method => 
          !validMethods.includes(method.toUpperCase())
        );
        if (invalidMethods.length > 0) {
          errors.push(`Invalid HTTP methods in ${type}: ${invalidMethods.join(', ')}`);
        }
      }
    };
    
    checkMethods(filter.methods.include, 'include');
    checkMethods(filter.methods.exclude, 'exclude');
    
    // 检查冲突
    if (filter.methods.include && filter.methods.exclude) {
      const conflicts = filter.methods.include.filter(method => 
        filter.methods.exclude!.includes(method)
      );
      if (conflicts.length > 0) {
        warnings.push(`Conflicting methods in include/exclude: ${conflicts.join(', ')}`);
      }
    }
  }
  
  // 验证状态码
  if (filter.statusCodes) {
    const checkStatusCodes = (codes: number[] | undefined, type: string) => {
      if (codes) {
        const invalidCodes = codes.filter(code => code < 100 || code > 599);
        if (invalidCodes.length > 0) {
          errors.push(`Invalid status codes in ${type}: ${invalidCodes.join(', ')}`);
        }
      }
    };
    
    checkStatusCodes(filter.statusCodes.include, 'include');
    checkStatusCodes(filter.statusCodes.exclude, 'exclude');
  }
  
  // 验证参数类型
  if (filter.parameters?.types) {
    const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object'];
    const invalidTypes = filter.parameters.types.filter(type => 
      !validTypes.includes(type)
    );
    if (invalidTypes.length > 0) {
      errors.push(`Invalid parameter types: ${invalidTypes.join(', ')}`);
    }
  }
  
  // 验证路径模式
  if (filter.paths) {
    const checkPathPatterns = (patterns: string[] | undefined, type: string) => {
      if (patterns) {
        patterns.forEach(pattern => {
          try {
            // 测试路径模式是否为有效的正则表达式
            const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
            new RegExp(`^${regexPattern}$`);
          } catch (error) {
            errors.push(`Invalid path pattern in ${type}: ${pattern}`);
          }
        });
      }
    };
    
    checkPathPatterns(filter.paths.include, 'include');
    checkPathPatterns(filter.paths.exclude, 'exclude');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * 验证完整的转换选项
 */
export function validateTransformOptions(options: TransformOptions): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 验证基础URL
  if (options.baseUrl) {
    try {
      new URL(options.baseUrl);
    } catch (error) {
      errors.push(`Invalid baseUrl: ${options.baseUrl}`);
    }
  }
  
  // 验证超时时间
  if (options.requestTimeout !== undefined) {
    if (options.requestTimeout <= 0) {
      errors.push('requestTimeout must be greater than 0');
    }
    if (options.requestTimeout > 300000) { // 5分钟
      warnings.push('requestTimeout is very high (>5 minutes)');
    }
  }
  
  // 验证操作过滤配置
  if (options.operationFilter) {
    const filterValidation = validateOperationFilter(options.operationFilter);
    errors.push(...filterValidation.errors);
    if (filterValidation.warnings) {
      warnings.push(...filterValidation.warnings);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
```

## 5. 测试实现

### 5.1 单元测试示例

**文件：** `packages/mcp-swagger-parser/tests/operation-filter.test.ts`（新建）

```typescript
import { describe, it, expect } from 'jest';
import { Transformer } from '../src/transformer';
import { OperationFilter } from '../src/transformer/types';

describe('Operation Filter', () => {
  const transformer = new Transformer();
  
  const mockOpenApiSpec = {
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {
      '/users': {
        get: {
          operationId: 'getUsers',
          tags: ['users'],
          responses: { '200': { description: 'Success' } }
        },
        post: {
          operationId: 'createUser',
          tags: ['users'],
          responses: { '201': { description: 'Created' } }
        }
      },
      '/admin/users': {
        delete: {
          operationId: 'deleteUser',
          tags: ['admin'],
          responses: { '204': { description: 'Deleted' } }
        }
      }
    }
  };
  
  it('should filter by HTTP methods', async () => {
    const filter: OperationFilter = {
      methods: {
        include: ['GET', 'POST']
      }
    };
    
    const result = await transformer.transformFromOpenAPI(mockOpenApiSpec, {
      operationFilter: filter
    });
    
    expect(result).toHaveLength(2);
    expect(result.map(tool => tool.name)).toEqual(['getUsers', 'createUser']);
  });
  
  it('should filter by path patterns', async () => {
    const filter: OperationFilter = {
      paths: {
        exclude: ['/admin/*']
      }
    };
    
    const result = await transformer.transformFromOpenAPI(mockOpenApiSpec, {
      operationFilter: filter
    });
    
    expect(result).toHaveLength(2);
    expect(result.every(tool => !tool.name.includes('delete'))).toBe(true);
  });
  
  it('should filter by status codes', async () => {
    const filter: OperationFilter = {
      statusCodes: {
        include: [200, 201]
      }
    };
    
    const result = await transformer.transformFromOpenAPI(mockOpenApiSpec, {
      operationFilter: filter
    });
    
    expect(result).toHaveLength(2);
    expect(result.map(tool => tool.name)).toEqual(['getUsers', 'createUser']);
  });
});
```

### 5.2 集成测试示例

**文件：** `packages/mcp-swagger-server/tests/integration/cli-filtering.test.ts`（新建）

```typescript
import { describe, it, expect } from 'jest';
import { execSync } from 'child_process';
import path from 'path';

describe('CLI Filtering Integration', () => {
  const cliPath = path.join(__dirname, '../../dist/cli.js');
  const testSpecPath = path.join(__dirname, '../fixtures/test-api.json');
  
  it('should filter operations via CLI parameters', () => {
    const command = [
      `node ${cliPath}`,
      `--openapi-file ${testSpecPath}`,
      '--include-methods GET,POST',
      '--exclude-paths "/admin/*"',
      '--dry-run' // 假设添加了 dry-run 模式用于测试
    ].join(' ');
    
    const output = execSync(command, { encoding: 'utf-8' });
    const result = JSON.parse(output);
    
    expect(result.tools).toBeDefined();
    expect(result.tools.length).toBeGreaterThan(0);
    
    // 验证只包含 GET 和 POST 方法
    const methods = result.tools.map((tool: any) => tool.method);
    expect(methods.every((method: string) => ['GET', 'POST'].includes(method))).toBe(true);
    
    // 验证排除了 admin 路径
    const paths = result.tools.map((tool: any) => tool.path);
    expect(paths.every((path: string) => !path.startsWith('/admin'))).toBe(true);
  });
});
```

## 6. 迁移指南

### 6.1 现有用户迁移

对于现有用户，所有现有配置都将继续工作，因为我们保持了向后兼容性：

```json
// 现有配置（继续有效）
{
  "transform": {
    "tagFilter": {
      "include": ["public"],
      "exclude": ["internal"]
    }
  }
}

// 新配置（推荐）
{
  "transform": {
    "operationFilter": {
      "methods": {
        "include": ["GET", "POST"]
      },
      "paths": {
        "exclude": ["/admin/*"]
      }
    }
  }
}
```

### 6.2 升级步骤

1. **更新依赖**：升级到新版本的包
2. **测试现有配置**：确保现有配置仍然工作
3. **逐步迁移**：根据需要添加新的过滤配置
4. **验证结果**：确保过滤结果符合预期

## 7. 部署检查清单

- [ ] 所有类型定义已更新
- [ ] 过滤逻辑已实现并测试
- [ ] CLI 参数已添加并测试
- [ ] 配置文件支持已实现
- [ ] 向后兼容性已验证
- [ ] 单元测试已通过
- [ ] 集成测试已通过
- [ ] 文档已更新
- [ ] 示例配置已提供

## 8. 总结

通过以上实现步骤，我们可以确保：

1. **完全兼容性**：`mcp-swagger-parser` 和 `mcp-swagger-server` 包之间完全兼容
2. **向后兼容**：现有配置继续有效
3. **功能完整**：支持多维度的操作过滤
4. **易于使用**：提供 CLI 参数和配置文件两种配置方式
5. **可扩展性**：架构设计支持未来的功能扩展

这样就能避免修改 `mcp-swagger-parser` 包后，`mcp-swagger-server` 包不适配的问题。