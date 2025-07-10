# 自定义请求头功能实现总结

## 📋 功能概述

MCP Swagger Server 现已支持自定义请求头功能，使其在代理 OpenAPI 接口时，除了认证 Bearer Token 外，还能灵活配置和传递常见的自定义 HTTP 请求头。

## 🎯 核心特性

### ✅ 已实现的功能

1. **多种请求头类型支持**
   - 静态请求头：固定值的请求头
   - 环境变量请求头：从环境变量获取值的请求头
   - 动态请求头：基于请求上下文动态生成的请求头
   - 条件请求头：根据条件决定是否添加的请求头

2. **多种配置方式**
   - 命令行参数：`--custom-header`、`--custom-header-env`
   - 配置文件：`--custom-headers-config`
   - MCP 配置：在 MCP 配置文件中定义
   - 环境变量：支持从环境变量读取值

3. **调试和安全机制**
   - 调试模式：`--debug-headers` 显示请求头合并过程
   - 受保护的请求头：防止覆盖关键系统请求头
   - 优先级机制：CLI > 配置文件 > 环境变量

## 🏗️ 架构实现

### 核心组件

```
packages/
├── mcp-swagger-parser/
│   ├── src/
│   │   ├── headers/
│   │   │   ├── CustomHeadersManager.ts    # 自定义请求头管理器
│   │   │   ├── generators.ts              # 预定义动态头生成器
│   │   │   └── index.ts                   # 导出接口
│   │   ├── transformer/
│   │   │   ├── types.ts                   # 类型定义
│   │   │   └── index.ts                   # 集成到转换器
│   │   └── index.ts                       # 对外导出
│   └── tests/
│       └── unit/
│           └── auth.test.ts               # 单元测试
└── mcp-swagger-server/
    ├── src/
    │   ├── cli.ts                         # CLI 参数解析
    │   ├── server.ts                      # 服务器启动
    │   ├── tools/
    │   │   └── initTools.ts               # 工具初始化
    │   └── transform/
    │       └── transformOpenApiToMcpTools.ts  # OpenAPI 转换
    └── dist/                              # 编译输出
```

### 类型定义

```typescript
// 自定义请求头配置
interface CustomHeaders {
  static?: Record<string, string>;
  env?: Record<string, string>;
  dynamic?: Record<string, string>;
  conditional?: Record<string, {
    condition: string | ((context: RequestContext) => boolean);
    value: string;
  }>;
}

// 请求上下文
interface RequestContext {
  method: string;
  path: string;
  args: any;
  operation?: OperationObject;
}
```

## 🔧 使用方式

### 1. 命令行参数

```bash
# 基本用法
mcp-swagger-server \
  --openapi ./api.json \
  --custom-header "X-Client-ID=my-client" \
  --custom-header "X-Version=1.0.0" \
  --custom-header-env "X-API-Key=API_KEY" \
  --debug-headers

# 完整示例
mcp-swagger-server \
  --openapi https://petstore.swagger.io/v2/swagger.json \
  --custom-header "X-Client-ID=mcp-client" \
  --custom-header "X-Request-Source=cli" \
  --custom-header-env "X-API-Key=PETSTORE_API_KEY" \
  --custom-header-env "X-User-Agent=USER_AGENT" \
  --debug-headers
```

### 2. 配置文件

```json
{
  "static": {
    "X-Custom-Client": "mcp-swagger-client",
    "X-Version": "1.0.0",
    "X-Request-Source": "config"
  },
  "env": {
    "X-API-Key": "API_KEY",
    "X-User-Agent": "USER_AGENT",
    "X-Environment": "NODE_ENV"
  }
}
```

```bash
mcp-swagger-server \
  --openapi ./api.json \
  --custom-headers-config ./headers.json \
  --debug-headers
```

### 3. MCP 配置

```json
{
  "name": "my-api-server",
  "version": "1.0.0",
  "openapi": "./api.json",
  "customHeaders": {
    "static": {
      "X-MCP-Client": "mcp-swagger-server",
      "X-Request-ID": "auto-generated"
    },
    "env": {
      "X-API-Key": "API_KEY",
      "X-Client-ID": "CLIENT_ID"
    }
  },
  "debugHeaders": true
}
```

```bash
mcp-swagger-server --config ./mcp-config.json
```

## 📊 测试结果

### 单元测试

```
✅ CustomHeadersManager
  ✅ getHeaders
    ✅ should handle static headers
    ✅ should handle environment variable headers  
    ✅ should return empty object for no config

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

### 功能测试

```
✅ 静态请求头处理
✅ 环境变量请求头处理
✅ 配置文件加载
✅ 命令行参数解析
✅ 调试模式输出
✅ 优先级机制
✅ 受保护请求头机制
```

## 🚀 快速上手

### 1. 安装依赖

```bash
cd /path/to/mcp-swagger-server
pnpm install
```

### 2. 构建项目

```bash
npm run build
```

### 3. 基本使用

```bash
# 设置环境变量
export API_KEY="your-api-key"
export CLIENT_ID="your-client-id"

# 启动服务器
node packages/mcp-swagger-server/dist/cli.js \
  --openapi https://petstore.swagger.io/v2/swagger.json \
  --custom-header "X-Client-ID=mcp-client" \
  --custom-header-env "X-API-Key=API_KEY" \
  --debug-headers
```

### 4. 测试环境

```bash
# 创建测试环境
node create-test-environment.js

# 运行测试
cd test-custom-headers
bash run-tests.sh
```

## 📝 配置示例

### 完整配置文件示例

```json
{
  "name": "production-api-server",
  "version": "1.0.0",
  "transport": "stdio",
  "openapi": "https://api.example.com/openapi.json",
  "auth": {
    "type": "bearer",
    "token": "$API_TOKEN"
  },
  "customHeaders": {
    "static": {
      "X-Client-Name": "mcp-swagger-server",
      "X-Client-Version": "1.2.2",
      "X-Request-Source": "mcp",
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    "env": {
      "X-API-Key": "API_KEY",
      "X-Client-ID": "CLIENT_ID",
      "X-Environment": "NODE_ENV",
      "X-User-Agent": "USER_AGENT"
    }
  },
  "debugHeaders": false
}
```

## 🔍 调试和故障排除

### 启用调试模式

```bash
# 命令行
--debug-headers

# 配置文件
"debugHeaders": true
```

### 常见问题

1. **环境变量未找到**
   - 检查环境变量是否正确设置
   - 使用 `--debug-headers` 查看实际值

2. **请求头被覆盖**
   - 检查优先级：CLI > 配置文件 > 环境变量
   - 查看受保护请求头列表

3. **配置文件未加载**
   - 检查文件路径是否正确
   - 检查 JSON 格式是否有效

## 🎯 最佳实践

1. **安全性**
   - 敏感信息使用环境变量
   - 避免在配置文件中硬编码密钥
   - 使用 `.env` 文件管理环境变量

2. **性能**
   - 避免过多的动态请求头
   - 优先使用静态请求头
   - 合理使用条件请求头

3. **维护性**
   - 使用配置文件管理复杂配置
   - 为不同环境创建不同配置
   - 使用有意义的请求头名称

## 📚 相关文档

- [自定义请求头设计文档](./docs/custom-headers-design.md)
- [实现指南](./docs/custom-headers-implementation.md)
- [快速上手指南](./docs/custom-headers-quickstart.md)
- [API 认证指南](./docs/api-authentication-guide.md)

## 🤝 贡献

如果您发现问题或有改进建议，请：

1. 查看 [GitHub Issues](https://github.com/zaizaizhao/mcp-swagger-server/issues)
2. 创建新的 Issue 或 Pull Request
3. 遵循项目的贡献指南

## 📄 许可证

本项目采用 MIT 许可证。详情请参阅 [LICENSE](./LICENSE) 文件。

---

**实现完成日期**: 2025年7月10日  
**实现者**: GitHub Copilot  
**版本**: mcp-swagger-server v1.2.2
