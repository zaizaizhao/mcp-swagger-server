# MCP Swagger Parser 抽离实施计划

## 📋 文档信息

**文档标题**: MCP Swagger Parser 抽离实施计划  
**创建日期**: 2025-06-17  
**版本**: v1.0  
**状态**: 实施规划  
**关联文档**: [Monorepo 重构方案](./monorepo-refactoring-proposal.md)

---

## 🎯 实施概览

### 核心目标
将 OpenAPI 解析逻辑从 `mcp-swagger-server` 中抽离，形成独立的 `mcp-swagger-parser` 库，实现：
- 职责分离和代码解耦
- 提高代码复用性
- 改善测试和维护性
- 为未来扩展奠定基础

### 预期收益
```
代码复用性: 0% → 80% (+80%)
测试隔离度: 困难 → 简单 (+200%)
维护复杂度: 高(8/10) → 低(3/10) (-62%)
开发效率: 基准 → +50% 提升
```

---

## 📊 当前状态分析

### 需要抽离的代码文件

#### 主要文件清单
```
packages/mcp-swagger-server/src/transform/
├── openapi-to-mcp.ts                    🔄 需要拆分
│   ├── parseOpenApiFromSource()         ➡️ 移至 parser
│   ├── validateOpenApiSpec()            ➡️ 移至 parser  
│   ├── extractApiEndpoints()            ➡️ 移至 parser
│   └── convertToMcpTools()              ⬅️ 保留在 server
│
├── transformOpenApiToMcpTools.ts        🔄 需要重构
│   ├── 解析相关逻辑                      ➡️ 移至 parser
│   └── MCP 转换逻辑                     ⬅️ 保留在 server
│
└── index.ts                             🔄 需要更新导出
```

#### 代码依赖分析
```typescript
// 当前 openapi-to-mcp.ts 的依赖
import SwaggerParser from '@apidevtools/swagger-parser';  // ➡️ 移至 parser
import { z } from 'zod';                                  // ➡️ 移至 parser
import axios from 'axios';                                // ➡️ 移至 parser
import * as yaml from 'js-yaml';                          // ➡️ 移至 parser

// MCP 相关依赖 (保留在 server)
import { Tool } from '@modelcontextprotocol/sdk/types.js'; // ⬅️ 保留
```

### 功能边界划分

#### 🔍 解析库负责 (mcp-swagger-parser)
```typescript
interface ParserResponsibilities {
  // 输入处理
  parseFromUrl(url: string): Promise<ParsedApiSpec>;
  parseFromFile(filePath: string): Promise<ParsedApiSpec>;  
  parseFromText(content: string): Promise<ParsedApiSpec>;
  
  // 验证和标准化
  validateSpec(spec: any): Promise<ValidationResult>;
  normalizeSpec(spec: any): Promise<NormalizedApiSpec>;
  
  // 信息提取
  extractEndpoints(spec: ParsedApiSpec): ApiEndpoint[];
  extractSchemas(spec: ParsedApiSpec): SchemaDefinition[];
  extractSecuritySchemes(spec: ParsedApiSpec): SecurityScheme[];
  
  // 错误处理
  handleParseErrors(error: any): ParseError;
}
```

#### ⚙️ 服务器负责 (mcp-swagger-server)
```typescript
interface ServerResponsibilities {
  // MCP 转换
  convertToMcpTools(endpoints: ApiEndpoint[]): Tool[];
  applyFilters(endpoints: ApiEndpoint[], filters: FilterConfig): ApiEndpoint[];
  generateMcpConfig(tools: Tool[], config: ConvertConfig): McpConfig;
  
  // 协议处理
  handleMcpProtocol(): void;
  manageTransports(): void;
  
  // 服务器管理
  startServer(): Promise<void>;
  stopServer(): Promise<void>;
}
```

---

## 🏗️ 目标架构设计

### 新包结构设计

#### mcp-swagger-parser 包结构
```
packages/mcp-swagger-parser/
├── src/
│   ├── core/                          # 核心解析器
│   │   ├── parser.ts                  # 主解析器类
│   │   ├── validator.ts               # 规范验证器
│   │   └── normalizer.ts              # 标准化处理器
│   │
│   ├── parsers/                       # 具体解析实现
│   │   ├── url-parser.ts              # URL 输入解析
│   │   ├── file-parser.ts             # 文件输入解析
│   │   ├── text-parser.ts             # 文本输入解析
│   │   └── base-parser.ts             # 解析器基类
│   │
│   ├── extractors/                    # 信息提取器
│   │   ├── endpoint-extractor.ts      # 端点信息提取
│   │   ├── schema-extractor.ts        # 模式定义提取
│   │   ├── security-extractor.ts      # 安全配置提取
│   │   └── metadata-extractor.ts      # 元数据提取
│   │
│   ├── types/                         # TypeScript 类型定义
│   │   ├── input.ts                   # 输入类型
│   │   ├── output.ts                  # 输出类型
│   │   ├── config.ts                  # 配置类型
│   │   └── index.ts                   # 类型导出
│   │
│   ├── utils/                         # 工具函数
│   │   ├── format-detector.ts         # 格式检测
│   │   ├── url-validator.ts           # URL 验证
│   │   ├── error-handler.ts           # 错误处理
│   │   └── logger.ts                  # 日志工具
│   │
│   ├── errors/                        # 错误定义
│   │   ├── parse-error.ts             # 解析错误
│   │   ├── validation-error.ts        # 验证错误
│   │   └── network-error.ts           # 网络错误
│   │
│   └── index.ts                       # 公共 API 导出
│
├── tests/                             # 测试文件
│   ├── unit/                          # 单元测试
│   ├── integration/                   # 集成测试
│   ├── fixtures/                      # 测试数据
│   └── __helpers__/                   # 测试助手
│
├── docs/                              # 文档
│   ├── API.md                         # API 文档
│   ├── examples/                      # 使用示例
│   └── migration.md                   # 迁移指南
│
├── package.json                       # 包配置
├── tsconfig.json                      # TypeScript 配置
├── rollup.config.js                   # 构建配置
└── README.md                          # 包说明
```

### API 设计规范

#### 核心 API 接口
```typescript
// packages/mcp-swagger-parser/src/index.ts

export class OpenApiParser {
  constructor(options?: ParserOptions) {}

  // 主要解析方法
  async parseFromUrl(url: string, options?: ParseFromUrlOptions): Promise<ParsedApiSpec> {}
  async parseFromFile(filePath: string, options?: ParseFromFileOptions): Promise<ParsedApiSpec> {}
  async parseFromText(content: string, format?: 'json' | 'yaml', options?: ParseFromTextOptions): Promise<ParsedApiSpec> {}

  // 验证方法
  async validate(spec: any): Promise<ValidationResult> {}
  
  // 工具方法
  static detectFormat(content: string): 'json' | 'yaml' | 'unknown' {}
  static isValidUrl(url: string): boolean {}
}

// 便捷方法导出
export const parseOpenApiFromUrl = (url: string, options?: ParseFromUrlOptions) => new OpenApiParser().parseFromUrl(url, options);
export const parseOpenApiFromFile = (filePath: string, options?: ParseFromFileOptions) => new OpenApiParser().parseFromFile(filePath, options);
export const parseOpenApiFromText = (content: string, format?: 'json' | 'yaml', options?: ParseFromTextOptions) => new OpenApiParser().parseFromText(content, format, options);
```

#### 类型定义系统
```typescript
// packages/mcp-swagger-parser/src/types/index.ts

export interface ParsedApiSpec {
  // OpenAPI 基础信息
  openapi: string;
  info: ApiInfo;
  servers: ServerInfo[];
  
  // 核心内容
  paths: PathsObject;
  components?: ComponentsObject;
  security?: SecurityRequirement[];
  tags?: TagObject[];
  
  // 解析元数据
  metadata: ParseMetadata;
}

export interface ParseMetadata {
  // 解析信息
  sourceType: 'url' | 'file' | 'text';
  sourceLocation: string;
  parsedAt: Date;
  parsingDuration: number;
  
  // 统计信息
  endpointCount: number;
  schemaCount: number;
  securitySchemeCount: number;
  
  // 版本信息
  openApiVersion: string;
  parserVersion: string;
}

export interface ApiEndpoint {
  // 基础信息
  path: string;
  method: HttpMethod;
  operationId?: string;
  summary?: string;
  description?: string;
  
  // 参数和响应
  parameters: Parameter[];
  requestBody?: RequestBody;
  responses: ResponsesObject;
  
  // 元数据
  tags?: string[];
  deprecated?: boolean;
  security?: SecurityRequirement[];
}
```

---

## 📋 详细实施步骤

### 阶段 1: 准备工作 (1-2 天)

#### 1.1 创建包结构
```bash
# 创建新包目录
mkdir -p packages/mcp-swagger-parser/src/{core,parsers,extractors,types,utils,errors}
mkdir -p packages/mcp-swagger-parser/tests/{unit,integration,fixtures,__helpers__}
mkdir -p packages/mcp-swagger-parser/docs/{examples}

# 创建配置文件
touch packages/mcp-swagger-parser/{package.json,tsconfig.json,rollup.config.js,README.md}
```

#### 1.2 配置包管理
```json
// packages/mcp-swagger-parser/package.json
{
  "name": "mcp-swagger-parser",
  "version": "0.1.0",
  "description": "OpenAPI/Swagger specification parser for MCP projects",
  "main": "dist/index.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.esm.js",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist",
    "README.md"
  ],
  "scripts": {
    "build": "rollup -c",
    "dev": "rollup -c -w",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/**/*.ts",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@apidevtools/swagger-parser": "^10.1.0",
    "axios": "^1.6.0",
    "js-yaml": "^4.1.0",
    "zod": "^3.25.28"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.5",
    "@types/node": "^20.9.0",
    "jest": "^29.7.0",
    "rollup": "^4.0.0",
    "typescript": "^5.2.0"
  },
  "keywords": [
    "openapi",
    "swagger",
    "parser",
    "mcp",
    "api",
    "specification"
  ]
}
```

#### 1.3 TypeScript 配置
```json
// packages/mcp-swagger-parser/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "composite": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "tests", "**/*.test.ts", "**/*.spec.ts"]
}
```

### 阶段 2: 核心代码抽离 (3-4 天)

#### 2.1 抽离解析器核心类
```typescript
// packages/mcp-swagger-parser/src/core/parser.ts

import SwaggerParser from '@apidevtools/swagger-parser';
import { z } from 'zod';
import type { 
  ParsedApiSpec, 
  ParserOptions, 
  ParseFromUrlOptions,
  ParseFromFileOptions,
  ParseFromTextOptions,
  ValidationResult 
} from '../types';

export class OpenApiParser {
  private options: ParserOptions;

  constructor(options: ParserOptions = {}) {
    this.options = {
      validateInput: true,
      resolveRefs: true,
      allowEmpty: false,
      ...options
    };
  }

  async parseFromUrl(url: string, options?: ParseFromUrlOptions): Promise<ParsedApiSpec> {
    const startTime = Date.now();
    
    try {
      // 验证 URL 格式
      if (!this.isValidUrl(url)) {
        throw new Error(`Invalid URL format: ${url}`);
      }

      // 使用 swagger-parser 解析
      const spec = await SwaggerParser.parse(url);
      
      // 标准化和提取信息
      const parsedSpec = await this.processSpec(spec, {
        sourceType: 'url',
        sourceLocation: url,
        parsedAt: new Date(),
        parsingDuration: Date.now() - startTime
      });

      return parsedSpec;
    } catch (error) {
      throw this.handleError(error, 'parseFromUrl', { url });
    }
  }

  // 其他方法实现...
  private async processSpec(spec: any, metadata: Partial<ParseMetadata>): Promise<ParsedApiSpec> {
    // 处理和标准化规范
    // 提取端点信息
    // 生成元数据
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private handleError(error: any, method: string, context: any): Error {
    // 统一错误处理
  }
}
```

#### 2.2 抽离端点提取器
```typescript
// packages/mcp-swagger-parser/src/extractors/endpoint-extractor.ts

import type { ParsedApiSpec, ApiEndpoint, Parameter, ResponsesObject } from '../types';

export class EndpointExtractor {
  static extractEndpoints(spec: ParsedApiSpec): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];

    Object.entries(spec.paths).forEach(([path, pathItem]) => {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const;
      
      methods.forEach(method => {
        const operation = pathItem[method];
        if (!operation) return;

        const endpoint: ApiEndpoint = {
          path,
          method: method.toUpperCase() as HttpMethod,
          operationId: operation.operationId,
          summary: operation.summary,
          description: operation.description,
          parameters: this.extractParameters(operation.parameters || []),
          requestBody: operation.requestBody,
          responses: operation.responses || {},
          tags: operation.tags,
          deprecated: operation.deprecated,
          security: operation.security
        };

        endpoints.push(endpoint);
      });
    });

    return endpoints;
  }

  private static extractParameters(parameters: any[]): Parameter[] {
    // 参数提取逻辑
  }
}
```

#### 2.3 创建类型定义
```typescript
// packages/mcp-swagger-parser/src/types/output.ts

export interface ParsedApiSpec {
  openapi: string;
  info: ApiInfo;
  servers: ServerInfo[];
  paths: PathsObject;
  components?: ComponentsObject;
  security?: SecurityRequirement[];
  tags?: TagObject[];
  metadata: ParseMetadata;
}

export interface ApiInfo {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: ContactObject;
  license?: LicenseObject;
}

export interface ParseMetadata {
  sourceType: 'url' | 'file' | 'text';
  sourceLocation: string;
  parsedAt: Date;
  parsingDuration: number;
  endpointCount: number;
  schemaCount: number;
  securitySchemeCount: number;
  openApiVersion: string;
  parserVersion: string;
}

// 更多类型定义...
```

### 阶段 3: 服务器端重构 (2-3 天)

#### 3.1 更新服务器依赖
```json
// packages/mcp-swagger-server/package.json 添加依赖
{
  "dependencies": {
    "mcp-swagger-parser": "workspace:^0.1.0",
    // 移除原有的解析相关依赖
    // "@apidevtools/swagger-parser": "^10.1.0", // 删除
    // "js-yaml": "^4.1.0", // 删除
    // 保留 MCP 相关依赖
    "@modelcontextprotocol/sdk": "^1.12.0"
  }
}
```

#### 3.2 重构转换逻辑
```typescript
// packages/mcp-swagger-server/src/converters/mcp-converter.ts

import { OpenApiParser, type ParsedApiSpec, type ApiEndpoint } from 'mcp-swagger-parser';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ConvertConfig, McpConfig } from '../types';

export class McpConverter {
  private parser: OpenApiParser;

  constructor(parser?: OpenApiParser) {
    this.parser = parser || new OpenApiParser();
  }

  async convertFromSource(source: InputSource, config: ConvertConfig): Promise<McpConfig> {
    // 1. 使用解析库解析 OpenAPI
    let spec: ParsedApiSpec;
    
    switch (source.type) {
      case 'url':
        spec = await this.parser.parseFromUrl(source.content);
        break;
      case 'file':
        spec = await this.parser.parseFromFile(source.content);
        break;
      case 'text':
        spec = await this.parser.parseFromText(source.content);
        break;
      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }

    // 2. 转换为 MCP 格式
    return this.convertSpecToMcp(spec, config);
  }

  private async convertSpecToMcp(spec: ParsedApiSpec, config: ConvertConfig): Promise<McpConfig> {
    // 提取端点
    const endpoints = EndpointExtractor.extractEndpoints(spec);
    
    // 应用过滤器
    const filteredEndpoints = this.applyFilters(endpoints, config.filters);
    
    // 转换为 MCP 工具
    const tools = this.convertToMcpTools(filteredEndpoints, config);
    
    // 生成 MCP 配置
    return {
      tools,
      metadata: {
        generatedAt: new Date(),
        sourceInfo: spec.info,
        endpointCount: filteredEndpoints.length,
        parserVersion: spec.metadata.parserVersion
      }
    };
  }

  private convertToMcpTools(endpoints: ApiEndpoint[], config: ConvertConfig): Tool[] {
    // MCP 工具转换逻辑 (保留原有逻辑)
  }

  private applyFilters(endpoints: ApiEndpoint[], filters: FilterConfig): ApiEndpoint[] {
    // 过滤逻辑 (保留原有逻辑)
  }
}
```

#### 3.3 更新服务器主逻辑
```typescript
// packages/mcp-swagger-server/src/server.ts

import { McpConverter } from './converters/mcp-converter.js';
import { OpenApiParser } from 'mcp-swagger-parser';

export class McpSwaggerServer {
  private converter: McpConverter;

  constructor() {
    const parser = new OpenApiParser({
      validateInput: true,
      resolveRefs: true
    });
    
    this.converter = new McpConverter(parser);
  }

  async handleConvertRequest(source: InputSource, config: ConvertConfig): Promise<McpConfig> {
    try {
      return await this.converter.convertFromSource(source, config);
    } catch (error) {
      // 错误处理
      throw new ConversionError(`Failed to convert API: ${error.message}`, error);
    }
  }
}
```

### 阶段 4: 测试开发 (2-3 天)

#### 4.1 解析库单元测试
```typescript
// packages/mcp-swagger-parser/tests/unit/parser.test.ts

import { OpenApiParser } from '../../src';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('OpenApiParser', () => {
  let parser: OpenApiParser;

  beforeEach(() => {
    parser = new OpenApiParser();
  });

  describe('parseFromUrl', () => {
    it('should parse valid OpenAPI 3.0 spec from URL', async () => {
      const result = await parser.parseFromUrl('https://petstore.swagger.io/v2/swagger.json');
      
      expect(result.openapi).toBeDefined();
      expect(result.info.title).toBe('Swagger Petstore');
      expect(result.metadata.sourceType).toBe('url');
      expect(result.metadata.endpointCount).toBeGreaterThan(0);
    });

    it('should throw error for invalid URL', async () => {
      await expect(parser.parseFromUrl('invalid-url'))
        .rejects.toThrow('Invalid URL format');
    });

    it('should handle network errors gracefully', async () => {
      await expect(parser.parseFromUrl('https://nonexistent.example.com/api.json'))
        .rejects.toThrow(/network|fetch|request/i);
    });
  });

  describe('parseFromFile', () => {
    it('should parse YAML file correctly', async () => {
      const result = await parser.parseFromFile(join(__dirname, '../fixtures/petstore.yaml'));
      
      expect(result.info.title).toBeDefined();
      expect(result.metadata.sourceType).toBe('file');
    });

    it('should parse JSON file correctly', async () => {
      const result = await parser.parseFromFile(join(__dirname, '../fixtures/petstore.json'));
      
      expect(result.info.title).toBeDefined();
      expect(result.metadata.sourceType).toBe('file');
    });
  });

  describe('parseFromText', () => {
    it('should parse JSON text', async () => {
      const jsonText = readFileSync(join(__dirname, '../fixtures/petstore.json'), 'utf8');
      const result = await parser.parseFromText(jsonText, 'json');
      
      expect(result.info.title).toBeDefined();
      expect(result.metadata.sourceType).toBe('text');
    });

    it('should auto-detect format', async () => {
      const jsonText = readFileSync(join(__dirname, '../fixtures/petstore.json'), 'utf8');
      const result = await parser.parseFromText(jsonText);
      
      expect(result.info.title).toBeDefined();
    });
  });
});
```

#### 4.2 集成测试
```typescript
// packages/mcp-swagger-server/tests/integration/conversion.test.ts

import { McpSwaggerServer } from '../../src/server';
import type { InputSource, ConvertConfig } from '../../src/types';

describe('MCP Conversion Integration', () => {
  let server: McpSwaggerServer;

  beforeEach(() => {
    server = new McpSwaggerServer();
  });

  it('should convert complete OpenAPI spec to MCP format', async () => {
    const source: InputSource = {
      type: 'url',
      content: 'https://petstore.swagger.io/v2/swagger.json'
    };

    const config: ConvertConfig = {
      filters: {
        methods: ['GET', 'POST'],
        includeDeprecated: false
      },
      transport: 'sse',
      optimization: {
        generateValidation: true,
        includeExamples: true
      }
    };

    const result = await server.handleConvertRequest(source, config);

    expect(result.tools).toBeDefined();
    expect(result.tools.length).toBeGreaterThan(0);
    expect(result.metadata.generatedAt).toBeInstanceOf(Date);
    expect(result.metadata.endpointCount).toBeGreaterThan(0);
  });
});
```

### 阶段 5: 文档和发布 (1-2 天)

#### 5.1 API 文档
```markdown
// packages/mcp-swagger-parser/docs/API.md

# MCP Swagger Parser API Documentation

## Installation

```bash
npm install mcp-swagger-parser
```

## Quick Start

```typescript
import { OpenApiParser } from 'mcp-swagger-parser';

const parser = new OpenApiParser();

// Parse from URL
const spec = await parser.parseFromUrl('https://api.example.com/swagger.json');

// Parse from file
const spec = await parser.parseFromFile('./api.yaml');

// Parse from text
const spec = await parser.parseFromText(yamlContent, 'yaml');
```

## API Reference

### Class: OpenApiParser

#### Constructor

```typescript
new OpenApiParser(options?: ParserOptions)
```

#### Methods

##### parseFromUrl(url, options?)

解析远程 URL 的 OpenAPI 规范。

**Parameters:**
- `url` (string): OpenAPI 规范的 URL
- `options` (ParseFromUrlOptions, optional): 解析选项

**Returns:** `Promise<ParsedApiSpec>`

##### parseFromFile(filePath, options?)

解析本地文件的 OpenAPI 规范。

**Parameters:**
- `filePath` (string): 文件路径
- `options` (ParseFromFileOptions, optional): 解析选项

**Returns:** `Promise<ParsedApiSpec>`
```

#### 5.2 使用示例
```typescript
// packages/mcp-swagger-parser/docs/examples/basic-usage.ts

import { OpenApiParser } from 'mcp-swagger-parser';

async function basicExample() {
  const parser = new OpenApiParser({
    validateInput: true,
    resolveRefs: true
  });

  try {
    // 解析 Petstore API
    const spec = await parser.parseFromUrl('https://petstore.swagger.io/v2/swagger.json');
    
    console.log('API Title:', spec.info.title);
    console.log('API Version:', spec.info.version);
    console.log('Endpoint Count:', spec.metadata.endpointCount);
    
    // 提取端点信息
    const endpoints = EndpointExtractor.extractEndpoints(spec);
    endpoints.forEach(endpoint => {
      console.log(`${endpoint.method} ${endpoint.path}: ${endpoint.summary}`);
    });
    
  } catch (error) {
    console.error('Parse failed:', error.message);
  }
}

basicExample();
```

---

## ⚡ 实施时间线

### 总体时间安排

```
阶段 1: 准备工作        (1-2 天)   ██░░░░░░░░
阶段 2: 核心代码抽离    (3-4 天)   ██████░░░░
阶段 3: 服务器端重构    (2-3 天)   ████░░░░░░
阶段 4: 测试开发        (2-3 天)   ████░░░░░░
阶段 5: 文档和发布      (1-2 天)   ██░░░░░░░░
总计:                   (9-14 天)  ██████████
```

### 每日任务分解

#### Day 1-2: 项目搭建
- [ ] 创建 `mcp-swagger-parser` 包结构
- [ ] 配置 TypeScript 和构建工具
- [ ] 设置测试环境
- [ ] 更新 workspace 配置

#### Day 3-4: 类型定义和核心抽离
- [ ] 设计和实现类型定义系统
- [ ] 抽离 `OpenApiParser` 核心类
- [ ] 实现 URL/文件/文本解析器
- [ ] 创建验证和标准化逻辑

#### Day 5-6: 信息提取器开发
- [ ] 实现 `EndpointExtractor`
- [ ] 实现 `SchemaExtractor`
- [ ] 实现 `SecurityExtractor`
- [ ] 添加错误处理机制

#### Day 7-8: 服务器端重构
- [ ] 重构 `mcp-swagger-server` 依赖
- [ ] 实现 `McpConverter` 类
- [ ] 更新服务器主逻辑
- [ ] 测试基本集成

#### Day 9-10: 测试开发
- [ ] 编写解析库单元测试
- [ ] 编写服务器集成测试
- [ ] 准备测试数据和 fixtures
- [ ] 测试覆盖率优化

#### Day 11-12: 文档和优化
- [ ] 编写 API 文档
- [ ] 创建使用示例
- [ ] 性能优化和错误处理改进
- [ ] 准备发布材料

#### Day 13-14: 发布和验证
- [ ] 发布 alpha 版本
- [ ] 端到端测试验证
- [ ] 修复发现的问题
- [ ] 准备正式发布

---

## 🎯 成功标准

### 技术指标

#### 功能完整性
- [ ] ✅ 所有现有解析功能正常工作
- [ ] ✅ 新解析库独立功能测试通过
- [ ] ✅ 服务器集成测试 100% 通过
- [ ] ✅ 性能不降低（解析速度保持或提升）

#### 代码质量
- [ ] ✅ 测试覆盖率 ≥ 85%
- [ ] ✅ TypeScript 严格模式通过
- [ ] ✅ ESLint 检查无错误
- [ ] ✅ 代码重复率 ≤ 5%

#### 文档完整性
- [ ] ✅ API 文档覆盖率 100%
- [ ] ✅ 使用示例完整
- [ ] ✅ 迁移指南清晰
- [ ] ✅ 错误处理文档完善

### 业务指标

#### 开发体验
- [ ] ✅ 新包可以独立开发和测试
- [ ] ✅ 构建时间减少 20%
- [ ] ✅ 包大小优化 15%
- [ ] ✅ 错误信息更加友好

#### 可维护性
- [ ] ✅ 代码职责清晰分离
- [ ] ✅ 依赖关系简化
- [ ] ✅ 新功能开发速度提升
- [ ] ✅ Bug 修复时间减少

---

## 🚨 风险控制

### 风险识别和缓解

#### 高风险项目

1. **破坏性变更风险** 🔴
   ```
   风险: 重构可能导致现有功能异常
   缓解: 
   - 保持 API 兼容性
   - 全面的回归测试
   - 分阶段发布策略
   ```

2. **性能回归风险** 🟡
   ```
   风险: 新架构可能影响解析性能
   缓解:
   - 性能基准测试
   - 关键路径优化
   - 内存使用监控
   ```

#### 中风险项目

3. **依赖冲突风险** 🟡
   ```
   风险: monorepo 中的依赖版本冲突
   缓解:
   - 统一依赖管理策略
   - 使用 workspace 协议
   - 定期依赖更新
   ```

4. **学习成本风险** 🟡
   ```
   风险: 新架构增加团队学习成本
   缓解:
   - 详细的文档和示例
   - 平滑的迁移路径
   - 培训和知识分享
   ```

### 回滚计划

#### 紧急回滚策略
```bash
# 如果新版本出现严重问题，快速回滚步骤：

1. 恢复到重构前的代码版本
   git revert <refactor-commit-hash>

2. 暂时移除新的解析库包
   rm -rf packages/mcp-swagger-parser

3. 恢复服务器的原始依赖
   git checkout HEAD~1 packages/mcp-swagger-server/package.json

4. 重新构建和测试
   pnpm install && pnpm build && pnpm test
```

#### 渐进式回滚
```typescript
// 通过功能开关支持新旧实现并存
const USE_NEW_PARSER = process.env.USE_NEW_PARSER === 'true';

export async function parseOpenApi(source: InputSource): Promise<ParsedApiSpec> {
  if (USE_NEW_PARSER) {
    // 使用新的解析库
    const parser = new OpenApiParser();
    return parser.parseFromUrl(source.url);
  } else {
    // 使用旧的解析逻辑
    return legacyParseOpenApi(source);
  }
}
```

---

## 📝 总结和下一步

### 实施总结

这个重构计划将：

1. **提升架构质量** 📈
   - 实现关注点分离
   - 提高代码复用性
   - 改善可测试性

2. **优化开发体验** 🚀
   - 独立包开发
   - 更快的构建速度
   - 清晰的依赖关系

3. **增强扩展能力** 🔮
   - 为未来功能扩展奠定基础
   - 支持多格式解析
   - 便于社区贡献

### 立即行动项

1. **今天开始** (Day 1)
   - [ ] 创建 `packages/mcp-swagger-parser` 目录结构
   - [ ] 配置基础的 `package.json` 和 `tsconfig.json`
   - [ ] 设置基础构建脚本

2. **本周完成** (Day 1-5)
   - [ ] 完成核心代码抽离
   - [ ] 实现基础的解析功能
   - [ ] 添加必要的测试用例

3. **下周目标** (Day 6-10)
   - [ ] 完成服务器端重构
   - [ ] 全面的测试覆盖
   - [ ] 基础文档编写

### 长期愿景

通过这次重构，我们将建立一个：

- 🎯 **模块化的架构** - 每个包都有清晰的职责
- 🔄 **可复用的生态** - 解析库可服务于多个项目  
- 🧪 **高质量的代码** - 完善的测试和文档
- 🚀 **快速的开发** - 提升团队开发效率

这不仅是一次技术重构，更是为项目长期发展奠定坚实基础的重要投资。

---

**实施状态跟踪**: 本文档将随着实施进展持续更新，确保计划与实际执行保持同步。
