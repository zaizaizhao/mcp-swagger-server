# 基于 AI + MCP Tools 的 OpenAPI 接口自动化测试 — 实施方案

本方案基于现有三包架构（a- 工具来源改为：

* 路由若携带 serverId，则从 serverAPI.getServerDetails(serverId) 读取 tools 列表；

* 否则维持现有基于 OpenAPI 的本地转换列表（作为兜底）。

* 执行逻辑：

  * 调用后端 executeServerTool，显示真实结果；

  * 保留现有参数校验与表单渲染逻辑；

  * 历史记录沿用 testingStore，但 result 取后端返回。

1. ServerDetail.vue 交互

* 工具表点击"测试"时，跳转到 /tester?serverId={id}\&toolId={toolId}，APITester 接管并自动选中该工具。

1. AI 智能测试界面（新增）

* 新建 AITester.vue 组件，提供 AI 驱动的批量测试功能：

  * 选择 MCP Server 和要测试的 Tools 子集

  * AI 自动生成测试参数和执行计划

  * 展示测试执行进度和结果分析

  * 生成智能测试报告

## 三、AI 智能体集成

1. AI 服务接口设计

* POST /v1/ai/generate-test-plan：基于 Tools Schema 生成测试计划

* POST /v1/ai/execute-test-plan：执行 AI 生成的测试计划

* GET /v1/ai/test-reports/:id：获取 AI 生成的测试报告

1. AI 核心能力

* **工具理解**：读取 MCP Tools 的 schema 信息，理解参数类型、约束、依赖关系

* **参数生成**：基于 schema 约束，生成正常值、边界值、异常值测试数据

* **执行编排**：分析 Tools 间的依赖关系（如需要先登录再访问用户信息），规划执行顺序

* **结果分析**：解析 Tool 执行结果，判断成功/失败，识别业务逻辑问题

1. MCP Tools 作为执行引擎

* AI 不直接调用 HTTP 接口，而是通过现有的 MCP Client 调用 Tools

* 充分利用 mcp-swagger-server 的转换成果

* 保持与现有架构的一致性

## 四、数据与安全），以 mcp-swagger-server 已转换的 MCP Tools 为基础，构建 AI 智能测试系统。核心思路是让 AI 通过 MCP Client 调用现成的 Tools，而非重新解析 API 文档。

## 架构概览

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   AI 智能体      │    │   MCP Client     │    │  MCP Tools      │
│  (测试编排)      │───▶│  (工具执行)      │───▶│ (已转换接口)     │
│                │    │                  │    │                │
│ • 策略规划       │    │ • stdio/stream   │    │ • GET /users    │
│ • 参数生成       │    │ • JSON-RPC       │    │ • POST /login   │
│ • 结果分析       │    │ • 错误处理       │    │ • PUT /profile  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 一、后端改造（packages/mcp-swagger-api）MCP 自动进行 OpenAPI 接口测试 — 实施方案

本方案依托现有三包架构（api / ui / server），补齐“执行 MCP Tool”的后端能力，并将 UI 测试器接入真实执行流。

## 一、后端改造（packages/mcp-swagger-api）

1. 新增服务 MCPExecutionService

* 作用：根据服务器传输类型与子进程句柄，代表 UI 执行指定 Tool。

* 核心职责：

  * 构造 MCP 初始化请求（initialize、tools/list 可选）、tools/call 调用。

  * 适配不同传输：

    * STDIO：通过 ProcessManagerService 获取 ChildProcess，使用其 stdin/stdout 建立 JSON-RPC 通道，发送/接收消息。

    * STREAMABLE：向 /mcp 端点（server.config.endpoint）发起 HTTP POST，维护 sessionId，按协议发送 initialize -> tools/call。

    * SSE/WS：暂不在首版支持，预留扩展接口。

  * 超时/重试、错误归一化与审计日志写入（可借助现有 log 实体）。

1. 新增控制器路由 ServersController.executeTool

* 路由：POST /v1/servers/:id/tools/:toolId/execute

* 入参：parameters:any，headers?，timeout?（ms）

* 返回：{ success:boolean; data?:any; error?:string; executionTime:number; timestamp:Date }

* 流程：

  * 校验 server 存在且运行中，读取其 transport 与 endpoint。

  * 调用 MCPExecutionService.execute(serverId, toolId, parameters)。

  * 记录一次操作日志（level=info/error）。

1. ProcessManagerService 小改

* 暴露一个 getChildProcess(serverId) 安全方法，供 STDIO 模式读取 stdio 流。

* 若已有等价接口可复用，直接复用。

1. WebSocket 无需改动

* 继续负责 process:info 与 process:logs 推送，UI 可同步看到测试执行时的日志。

1. 类型与错误

* 在 src/modules/servers/interfaces/process.interface.ts 中补充 ToolResult 类型定义，或在 DTO 中定义统一返回。

## 二、前端改造（packages/mcp-swagger-ui）

1. API 封装

* 在 services/api.ts 新增 testingAPI.executeServerTool(serverId, toolId, parameters) -> 调用 /v1/servers/:id/tools/:toolId/execute。

* 或直接在现有 serverAPI 下新增 executeServerTool 方法，便于按服务器维度组织。

1. APITester.vue 调整

* 工具来源改为：

  * 路由若携带 serverId，则从 serverAPI.getServerDetails(serverId) 读取 tools 列表；

  * 否则维持现有基于 OpenAPI 的本地转换列表（作为兜底）。

* 执行逻辑：

  * 调用后端 executeServerTool，显示真实结果；

  * 保留现有参数校验与表单渲染逻辑；

  * 历史记录沿用 testingStore，但 result 取后端返回。

1. ServerDetail.vue 交互

* 工具表点击“测试”时，跳转到 /tester?serverId={id}\&toolId={toolId}，APITester 接管并自动选中该工具。

1. 体验

* 显示执行耗时、错误详情；

* 可选：在结果面板显示本次调用的 requestId 以便问题排查。

## 三、数据与安全

* 认证：后端端点走现有 JWT 拦截（api.interceptors 已带 Bearer），控制器可按需加 @UseGuards。

* 限流：为执行端点设置速率限制与并发阈值（如每 serverId 同时最多 3 个）。

* 超时：默认 30s，可在请求体自定义，服务层统一执行 Promise.race(timeout)。

## 五、阶段性交付

阶段1（MCP 基础执行）：

* 后端：STDIO 与 STREAMABLE 适配、执行端点；

* 前端：APITester 对接后端执行；ServerDetail 跳转联动；

* 验证：手动调用 MCP Tools 能够正常执行并返回结果。

阶段2（AI 智能测试）：

* 后端：AI 服务集成、测试计划生成与执行；

* 前端：AITester 界面、测试报告展示；

* 验证：AI 能够理解 Tools Schema，自动生成并执行测试。

阶段3（高级功能）：

* 增加 WS/SSE 适配；

* 历史/用例落库；

* 测试覆盖率分析；

* 性能测试集成。

* 报告与断言（对比 expectedResult）。

## 五、实施清单

* api

  * services/mcp-execution.service.ts（新）

  * controllers/servers.controller.ts 新增 POST /v1/servers/:id/tools/:toolId/execute

  * services/process-manager.service.ts 暴露 getChildProcess(serverId)

  * dto/server.dto.ts 新增 ExecuteToolDto 与返回类型

* ui

  * services/api.ts 新增 serverAPI.executeServerTool

  * modules/testing/APITester.vue 接入 executeServerTool

  * modules/servers/ServerDetail.vue 的工具行加测试跳转

## 六、回退方案

* 若后端执行不可用，APITester 退回本地模拟（stores/testing.ts 现状），并在 UI 提示“当前为模拟模式”。

