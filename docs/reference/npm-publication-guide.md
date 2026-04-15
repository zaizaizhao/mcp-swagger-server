# MCP Swagger Server NPM 发布指南

## 🎯 发布状态分析

### ✅ 当前具备条件
- ✓ 完整的 TypeScript 项目结构
- ✓ 丰富的 CLI 功能实现
- ✓ 多种传输协议支持 (stdio, http, sse, streamable)  
- ✓ 构建系统完善
- ✓ 依赖关系清晰
- ✓ 核心功能完备

### ❌ 需要补充的关键配置

#### 1. 缺少 `bin` 字段配置 (必需)

**问题**: `package.json` 中缺少 `bin` 字段，用户无法通过全局命令直接使用。

**解决方案**: 在 `packages/mcp-swagger-server/package.json` 中添加：

```json
{
  "bin": {
    "mcp-swagger-server": "./dist/cli.js",
    "mcp-swagger": "./dist/cli.js"
  }
}
```

#### 2. CLI 文件缺少 Shebang (必需)

**问题**: 编译后的 `dist/cli.js` 需要 shebang 以支持直接执行。

**解决方案**: 确保编译后的文件顶部包含：
```javascript
#!/usr/bin/env node
```

#### 3. 发布配置优化

**当前配置需要调整**:
- `private: false` (当前可能设置为 private)
- 完善 `repository` URL
- 添加 `engines` 字段指定 Node.js 版本要求

---

## 🚀 发布准备清单

### 1. Package.json 配置修改

```json
{
  "name": "mcp-swagger-server",
  "version": "1.0.0",
  "description": "A Model Context Protocol (MCP) server for Swagger/OpenAPI documentation",
  "main": "dist/index.js",
  "types": "dist/types/index.d.ts",
  "bin": {
    "mcp-swagger-server": "./dist/cli.js",
    "mcp-swagger": "./dist/cli.js"
  },
  "engines": {
    "node": ">=16.0.0"
  },
  "files": [
    "dist/**/*",
    "!dist/**/*.map",
    "README.md",
    "LICENSE"
  ],
  "publishConfig": {
    "access": "public"
  }
}
```

### 2. 构建验证

```bash
# 1. 清理并重新构建
pnpm run build

# 2. 验证构建产物
ls -la packages/mcp-swagger-server/dist/

# 3. 测试 CLI 功能
node packages/mcp-swagger-server/dist/cli.js --help
```

### 3. 本地测试安装

```bash
# 在项目根目录执行
cd packages/mcp-swagger-server
npm pack

# 在临时目录测试全局安装
mkdir /tmp/test-install
cd /tmp/test-install
npm install -g /path/to/mcp-swagger-server-1.0.0.tgz

# 测试全局命令
mcp-swagger-server --help
mcp-swagger --help
```

### 4. 发布步骤

```bash
# 1. 登录 NPM
npm login

# 2. 发布到测试环境 (可选)
npm publish --tag beta

# 3. 正式发布
npm publish

# 4. 验证发布成功
npm info mcp-swagger-server
```

---

## 📖 使用文档

### 全局安装

```bash
npm install -g mcp-swagger-server
```

### 基本使用

```bash
# 查看帮助
mcp-swagger-server --help

# 从 URL 启动 HTTP 服务器
mcp-swagger-server --transport streamable --port 3322 --openapi https://api.github.com/openapi.json

# 从本地文件启动并监控变化
mcp-swagger-server --transport streamable --openapi ./api.json --watch

# STDIO 模式 (适合 AI 客户端)
mcp-swagger-server --transport stdio --openapi https://petstore.swagger.io/v2/swagger.json

# SSE 模式 (适合 Web 前端)
mcp-swagger-server --transport sse --port 3323 --openapi ./openapi.yaml
```

### 编程式使用

```javascript
const { createMcpServer, runStreamableServer } = require('mcp-swagger-server');

// 创建 MCP 服务器实例
const server = createMcpServer(openApiSpec);

// 运行 Streamable 服务器
runStreamableServer(server, { port: 3322 });
```

---

## 🔧 改进建议

### 短期优化 (发布前必须)

1. **添加 bin 配置** - 支持全局命令
2. **完善 README** - 添加安装和使用说明
3. **添加 LICENSE 文件**
4. **测试 CLI 功能** - 确保所有命令正常工作

### 中期改进 (后续版本)

1. **配置文件支持** - 支持 `.mcprc.json` 配置文件
2. **插件系统** - 支持自定义转换插件
3. **缓存机制** - 缓存解析结果提升性能
4. **健康检查** - 添加服务健康状态检查

### 长期规划

1. **Docker 镜像** - 提供官方 Docker 镜像
2. **监控集成** - 集成 Prometheus/Grafana 监控
3. **多语言支持** - 支持更多 OpenAPI 规范变体
4. **Web 管理界面** - 提供 Web 管理控制台

---

## 🎯 结论

**当前状态**: ✅ **基本可以发布**

项目已经具备了发布到 NPM 的基本条件，主要缺少的是 `bin` 字段配置。添加这个配置后，用户就可以通过以下方式使用：

```bash
# 全局安装
npm install -g mcp-swagger-server

# 直接使用
mcp-swagger-server --transport streamable --openapi https://api.example.com/openapi.json
```

**推荐发布流程**:
1. 先添加 `bin` 配置
2. 本地测试验证
3. 发布 beta 版本
4. 收集反馈后发布正式版

这个项目的架构设计很好，功能完善，发布后将为 MCP 生态系统提供重要的 OpenAPI 集成能力。
