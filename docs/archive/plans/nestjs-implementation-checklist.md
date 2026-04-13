# NestJS 后端实施检查清单

## 🎯 项目目标
将现有的 Express 基础后端升级为企业级的 NestJS 架构，提供稳定、可扩展的 OpenAPI 到 MCP 转换服务。

---

## ✅ 第一阶段：项目搭建与基础配置 (预计：4-6小时)

### 🏗️ 项目初始化 (1小时)
- [ ] **运行自动化脚本**
  ```bash
  .\scripts\setup-nestjs.ps1
  ```
- [ ] **验证项目结构**
  ```
  packages/mcp-swagger-server-nestjs/
  ├── src/
  ├── test/
  ├── package.json
  └── tsconfig.json
  ```

### 📦 依赖安装验证 (30分钟)
- [ ] **核心 NestJS 依赖**
  - `@nestjs/core` - 核心框架
  - `@nestjs/common` - 通用装饰器和工具
  - `@nestjs/platform-express` - Express 适配器

- [ ] **API 和文档依赖**
  - `@nestjs/swagger` - Swagger 集成
  - `@nestjs/config` - 配置管理

- [ ] **业务逻辑依赖**
  - `swagger-parser` - OpenAPI 解析
  - `@modelcontextprotocol/sdk` - MCP 协议
  - `class-validator` & `class-transformer` - 验证和转换

- [ ] **开发工具依赖**
  - `@nestjs/testing` - 测试框架
  - `jest` - 单元测试
  - TypeScript 类型定义

### ⚙️ 基础配置 (2.5小时)

#### 应用入口配置 (45分钟)
- [ ] **修改 `src/main.ts`**
  - 端口配置 (3322)
  - CORS 设置
  - 全局验证管道
  - Swagger 文档配置

- [ ] **验证启动**
  ```bash
  npm run start:dev
  # 应该在 http://localhost:3322 启动
  # Swagger 文档在 http://localhost:3322/docs
  ```

#### 配置模块设置 (45分钟)
- [ ] **创建 `src/config/configuration.ts`**
  - 端口和 CORS 配置
  - API 超时和文件大小限制
  - Swagger 文档配置

- [ ] **创建 `src/config/validation.schema.ts`**
  - 环境变量验证规则
  - 配置值类型检查

#### 应用模块架构 (45分钟)
- [ ] **设计 `src/app.module.ts`**
  - ConfigModule 导入
  - 各业务模块导入
  - 全局提供者配置

---

## ✅ 第二阶段：核心模块开发 (预计：2-3天)

### 📋 DTO 和类型定义 (4小时)

#### 共享 DTO 创建
- [ ] **`src/common/dto/api.dto.ts`**
  - `InputSourceDto` - 输入源定义
  - `AuthDto` - 认证信息
  - `ConvertConfigDto` - 转换配置
  - `FilterConfigDto` - 过滤选项
  - `ApiResponseDto` - 统一响应格式

#### API 请求 DTO
- [ ] **`src/common/dto/request.dto.ts`**
  - `ValidateRequestDto` - 验证请求
  - `PreviewRequestDto` - 预览请求
  - `ConvertRequestDto` - 转换请求

#### API 响应 DTO
- [ ] **`src/common/dto/response.dto.ts`**
  - `ValidationResultDto` - 验证结果
  - `ApiPreviewDto` - API 预览
  - `McpConfigDto` - MCP 配置结果

### 🔧 OpenAPI 处理模块 (8小时)

#### 模块结构创建
- [ ] **`src/modules/openapi/openapi.module.ts`**
  - 服务提供者配置
  - 控制器注册

#### 核心服务实现
- [ ] **`src/modules/openapi/openapi.service.ts`**
  - `validateSpec()` - OpenAPI 规范验证
  - `parseSpecContent()` - 内容解析
  - `extractEndpoints()` - 端点提取
  - `previewApi()` - API 预览生成

#### API 控制器
- [ ] **`src/modules/openapi/openapi.controller.ts`**
  - `POST /api/validate` - 验证端点
  - `POST /api/preview` - 预览端点
  - Swagger 文档注解

#### 单元测试
- [ ] **`src/modules/openapi/openapi.service.spec.ts`**
  - 验证功能测试
  - 解析功能测试
  - 错误处理测试

### 🔄 转换服务模块 (6小时)

#### 转换服务实现
- [ ] **`src/modules/conversion/conversion.service.ts`**
  - `convertToMcp()` - 主转换方法
  - `applyFilters()` - 过滤器应用
  - `optimizeEndpoints()` - 端点优化
  - `generateMcpTools()` - MCP 工具生成

#### 控制器实现
- [ ] **`src/modules/conversion/conversion.controller.ts`**
  - `POST /api/convert` - 转换端点
  - 参数验证和错误处理

#### 转换策略
- [ ] **`src/modules/conversion/strategies/`**
  - `default.strategy.ts` - 默认转换策略
  - `optimized.strategy.ts` - 优化转换策略

### 🔌 MCP 协议模块 (4小时)

#### MCP 服务实现
- [ ] **`src/modules/mcp/mcp.service.ts`**
  - `generateMcpConfig()` - 配置生成
  - `validateMcpConfig()` - 配置验证
  - 传输协议支持 (stdio, sse, streamable)

#### 工具生成器
- [ ] **`src/modules/mcp/tools/`**
  - `tool-generator.service.ts` - 工具生成逻辑
  - `validation.helper.ts` - 验证辅助函数

---

## ✅ 第三阶段：API 集成和测试 (预计：1-2天)

### 🔗 API 端点完整实现 (4小时)

#### 端点功能验证
- [ ] **验证端点 (`POST /api/validate`)**
  - URL 输入支持
  - 文件输入支持
  - 文本输入支持
  - 认证头处理

- [ ] **预览端点 (`POST /api/preview`)**
  - API 信息提取
  - 端点列表生成
  - 统计信息计算

- [ ] **转换端点 (`POST /api/convert`)**
  - 完整转换流程
  - 配置选项应用
  - MCP 格式输出

#### 错误处理和验证
- [ ] **全局异常过滤器**
  - `src/common/filters/http-exception.filter.ts`
  - 统一错误响应格式

- [ ] **验证管道配置**
  - 请求参数验证
  - 类型转换
  - 错误消息国际化

### 🧪 测试套件实现 (4小时)

#### 单元测试
- [ ] **服务层测试**
  - OpenAPI 服务测试
  - 转换服务测试
  - MCP 服务测试

- [ ] **控制器测试**
  - API 端点测试
  - 参数验证测试
  - 错误处理测试

#### 集成测试
- [ ] **端到端测试**
  - `test/openapi.e2e-spec.ts`
  - 完整请求流程测试
  - 真实 API 规范测试

#### 测试覆盖率
- [ ] **运行测试套件**
  ```bash
  npm run test         # 单元测试
  npm run test:e2e     # 集成测试
  npm run test:cov     # 覆盖率报告
  ```
- [ ] **目标覆盖率 > 80%**

---

## ✅ 第四阶段：前后端集成 (预计：1天)

### 🔌 前端集成 (4小时)

#### API 客户端更新
- [ ] **修改 `packages/mcp-swagger-ui/src/utils/api.ts`**
  - 更新 API 基础 URL (localhost:3322)
  - 移除 demo 模式
  - 添加真实 API 调用

#### 类型定义同步
- [ ] **共享类型定义**
  - 复制 DTO 类型到前端
  - 确保前后端类型一致性

#### 错误处理
- [ ] **前端错误处理**
  - API 错误捕获
  - 用户友好的错误消息
  - 网络错误重试机制

### ✅ 集成测试 (2小时)

#### 完整流程测试
- [ ] **上传 → 验证 → 预览 → 转换**
  - 测试完整用户流程
  - 验证数据传递正确性

- [ ] **边界情况测试**
  - 大文件处理
  - 无效输入处理
  - 网络中断恢复

---

## ✅ 第五阶段：部署和文档 (预计：半天)

### 📦 部署准备 (2小时)

#### Docker 配置
- [ ] **创建 `Dockerfile`**
  - Node.js 基础镜像
  - 依赖安装
  - 应用构建

- [ ] **`docker-compose.yml` 更新**
  - 后端服务配置
  - 环境变量设置
  - 端口映射

#### 生产配置
- [ ] **环境变量配置**
  - `.env.production`
  - 日志级别配置
  - 性能优化设置

### 📚 文档更新 (1小时)

#### API 文档
- [ ] **Swagger 文档完善**
  - 端点描述完整
  - 示例请求/响应
  - 错误代码说明

#### 开发文档
- [ ] **更新开发指南**
  - NestJS 项目说明
  - 本地开发指引
  - 部署说明

---

## 🎯 验收标准

### 功能验收
- [ ] ✅ 所有 API 端点正常工作
- [ ] ✅ 前后端完整集成
- [ ] ✅ 错误处理完善
- [ ] ✅ 测试覆盖率 > 80%

### 性能验收
- [ ] ✅ API 响应时间 < 3秒
- [ ] ✅ 支持 10MB 以上文件
- [ ] ✅ 并发处理能力 > 10 用户

### 代码质量验收
- [ ] ✅ TypeScript 严格模式通过
- [ ] ✅ ESLint 检查通过
- [ ] ✅ 代码注释覆盖 > 70%

---

## 🚀 立即开始

**第一步：运行搭建脚本**
```bash
.\scripts\setup-nestjs.ps1
```

**第二步：验证环境**
```bash
cd packages\mcp-swagger-server-nestjs
npm run start:dev
```

**第三步：开始开发**
按照此检查清单逐步完成各个模块的开发和测试。

预计总开发时间：**5-7 个工作日**
预计代码质量：**企业级标准**
预计维护成本：**低**
