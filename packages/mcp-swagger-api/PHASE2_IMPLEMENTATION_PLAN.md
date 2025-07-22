# Phase 2: mcp-swagger-api 功能完善实施计划

## 项目现状分析

### 已实现功能
- ✅ 基础NestJS架构搭建
- ✅ 单个MCP服务器管理（创建、启动、停止、状态查询）
- ✅ OpenAPI规范解析和验证
- ✅ 基础的健康检查和监控
- ✅ API文档和Swagger集成
- ✅ 安全中间件（CORS、Helmet、限流）

### 待完善功能（按优先级排序）

## 🎯 Phase 2.1: 多服务器管理功能 (Task 15)

### 15.1 实现多服务器管理功能
**目标**: 扩展现有MCPService支持多个服务器实例管理

#### 当前限制
- 只能管理单个MCP服务器实例
- 缺少服务器配置持久化
- 没有服务器生命周期管理
- 缺少状态监控和健康检查

#### 实施步骤
1. **创建服务器管理器服务**
   - 设计多服务器管理架构
   - 实现服务器实例池管理
   - 添加服务器配置持久化（PostgreSQL）
   - 实现服务器生命周期管理

2. **扩展API端点**
   - POST `/api/v1/servers` - 创建新服务器
   - GET `/api/v1/servers` - 获取所有服务器列表
   - GET `/api/v1/servers/:id` - 获取特定服务器详情
   - PUT `/api/v1/servers/:id` - 更新服务器配置
   - DELETE `/api/v1/servers/:id` - 删除服务器
   - POST `/api/v1/servers/:id/start` - 启动服务器
   - POST `/api/v1/servers/:id/stop` - 停止服务器
   - GET `/api/v1/servers/:id/status` - 获取服务器状态

3. **数据库集成**
   - 集成TypeORM和PostgreSQL
   - 设计服务器配置表结构
   - 实现配置的CRUD操作
   - 添加数据迁移脚本

### 15.2 完善OpenAPI管理API
**目标**: 扩展现有OpenAPIService支持文件上传和URL获取

#### 实施步骤
1. **文件上传支持**
   - 集成multer中间件
   - 支持YAML/JSON文件上传
   - 添加文件大小和类型验证
   - 实现临时文件清理

2. **URL获取支持**
   - 实现远程OpenAPI规范获取
   - 添加URL验证和安全检查
   - 实现缓存机制
   - 添加超时和重试逻辑

3. **版本转换支持**
   - 集成swagger2openapi库
   - 实现Swagger 2.0到OpenAPI 3.0转换
   - 添加转换结果验证
   - 提供转换预览功能

## 🎯 Phase 2.2: WebSocket实时功能 (Task 16)

### 16.1 创建WebSocket Gateway模块
**目标**: 实现WebSocket Gateway用于实时通信

#### 实施步骤
1. **WebSocket Gateway基础**
   - 集成@nestjs/websockets
   - 创建WebSocket Gateway类
   - 实现客户端连接管理
   - 添加房间机制支持

2. **实时状态推送**
   - 服务器状态变化推送
   - 工具更新通知
   - 错误和警告推送
   - 连接状态管理

### 16.2 实现实时监控数据推送
**目标**: 添加系统指标收集和推送

#### 实施步骤
1. **系统监控**
   - 集成系统监控库（如prom-client）
   - 收集CPU、内存、网络指标
   - 实现性能数据推送
   - 添加告警机制

## 🎯 Phase 2.3: API测试工具后端 (Task 17)

### 17.1 创建工具执行API
**目标**: 实现MCP工具的动态调用和执行

#### 实施步骤
1. **工具执行引擎**
   - 实现工具动态调用
   - 添加参数验证和类型转换
   - 实现执行结果格式化
   - 添加超时和取消机制

### 17.2 实现测试用例管理API
**目标**: 创建测试用例的CRUD操作API

## 🎯 Phase 2.4: 认证配置管理 (Task 18)

### 18.1 创建认证管理服务
**目标**: 实现多种认证类型的配置管理

#### 支持的认证类型
- Bearer Token
- API Key
- Basic Authentication
- OAuth2

## 🎯 Phase 2.5: 配置导入导出 (Task 19)

### 19.1 创建配置管理服务
**目标**: 实现系统配置的导出功能

## 🎯 Phase 2.6: 日志管理 (Task 20)

### 20.1 创建日志收集和存储系统
**目标**: 实现结构化日志收集和存储

## 🎯 Phase 2.7: AI助手集成 (Task 21)

### 21.1 创建AI助手配置生成服务
**目标**: 实现多种AI助手类型的配置模板管理

## 🎯 Phase 2.8: 系统监控和性能优化 (Task 22)

### 22.1 实现系统监控API
**目标**: 创建系统资源监控

## 🎯 Phase 2.9: 安全和权限管理 (Task 23)

### 23.1 实现安全认证和授权
**目标**: 完善API Key认证机制和权限控制

## 🎯 Phase 2.10: 测试和文档 (Task 24)

### 24.1 创建API测试套件
**目标**: 使用Jest和Supertest编写API端点测试

## 实施时间线

### Week 1-2: 多服务器管理 (Task 15)
- 数据库集成和表结构设计
- 多服务器管理服务实现
- API端点扩展
- OpenAPI管理功能完善

### Week 3: WebSocket实时功能 (Task 16)
- WebSocket Gateway实现
- 实时监控数据推送

### Week 4: API测试工具 (Task 17)
- 工具执行API实现
- 测试用例管理

### Week 5-6: 认证和配置管理 (Task 18-19)
- 认证配置管理
- 配置导入导出

### Week 7-8: 日志和AI助手 (Task 20-21)
- 日志管理系统
- AI助手集成

### Week 9-10: 监控和安全 (Task 22-23)
- 系统监控优化
- 安全权限管理

### Week 11-12: 测试和文档 (Task 24)
- 测试套件完善
- 文档和部署

## 技术栈扩展

### 新增依赖
- **数据库**: TypeORM + PostgreSQL
- **WebSocket**: @nestjs/websockets + socket.io
- **文件上传**: multer
- **监控**: prom-client
- **YAML解析**: js-yaml
- **版本转换**: swagger2openapi
- **测试**: Jest + Supertest

### 架构改进
- 模块化设计增强
- 服务层抽象
- 数据持久化
- 实时通信支持
- 监控和日志系统

## 下一步行动

1. **立即开始**: Task 15.1 - 多服务器管理功能
2. **准备工作**: 数据库环境搭建
3. **代码重构**: 现有MCP服务重构为多实例支持
4. **API设计**: 新增端点的详细设计
5. **测试计划**: 单元测试和集成测试准备