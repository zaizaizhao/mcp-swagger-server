# 基于 AI + MCP 的 OpenAPI 接口自动化测试 — 可行性评估

## 目标
在现有「服务器管理 + OpenAPI 文档管理」的基础上，构建一套基于 MCP Tools 的 AI 智能测试系统：
- 复用 mcp-swagger-server 已转换的 MCP Tools（无需重新解析 OpenAPI）。
- AI 智能体通过 MCP Client 调用这些 Tools 执行接口测试。
- AI 负责测试策略规划、参数生成、执行编排和结果分析。
- 在 UI 提供测试任务管理、实时监控和智能报告。

## 核心创新点
- **基于 MCP Tools 的测试执行**：直接调用已转换的 MCP Tools，避免重复解析 API 文档。
- **AI 智能参数生成**：基于 Tool Schema 信息，AI 生成有效、边界和异常测试数据。
- **智能测试编排**：AI 分析 Tools 间依赖关系，自动规划测试执行顺序。
- **结果智能分析**：AI 分析 Tool 执行结果，判断测试成功/失败，生成洞察报告。

## 现状综述（仓库内已有能力）
- server 包（packages/mcp-swagger-server）
  - 可根据 OpenAPI 生成并注册 MCP Tools（Transformer/ToolManager）。
  - 支持多传输（stdio、sse、streamable、websocket）启动 MCP Server。
- api 包（packages/mcp-swagger-api）
  - 已有 Server CRUD、子进程管理（ProcessManagerService.spawn）与资源/日志监控（ProcessResourceMonitorService、ProcessLogMonitorService）。
  - 已提供 WebSocket 网关，将进程信息与日志以 process:info、process:logs 推到前端。
  - 缺口：尚无面向 UI 的「执行 MCP Tool」HTTP API。
- ui 包（packages/mcp-swagger-ui）
  - 已有服务器详情页与工具列表（ServerDetail.vue 中 tools Tab）。
  - 已有“API 测试器”页面 APITester.vue，但当前使用前端本地转换 + 模拟执行（stores/testing.ts）并未走真实 MCP 调用。
  - 已有 WebSocket 订阅，支持实时展示进程信息与日志。

## 差距与风险点
- 缺少后端执行端点：/v1/servers/:id/tools/:toolId/execute（必须补齐）。
- 缺少后端 MCP 客户端能力：根据传输方式（stdio/streamable/sse/ws）与子进程进行协议交互。
- UI 需要切换为“服务端执行”模式（替换模拟逻辑），并支持从 Server 选择工具。
- 认证/超时/重试/并发控制需要在后端妥善处理。

## 技术可行性结论
- 可行。现有后端已管理 MCP 子进程并暴露监控流，补充一个「Tool 执行」服务与控制器即可；前端已有测试器 UI，只需将执行逻辑切到新 API，保留现有用例与历史模型。
- 建议分阶段落地：优先支持 stdio 与 streamable 两类传输，后续再扩展 sse/ws。

## 关键设计要点
- 后端新增 MCPExecutionService：
  - stdio：复用 childProcess.stdin/stdout 作为 JSON-RPC 通道（已在 ProcessManagerService 中持有 ChildProcess）。
  - streamable：对 MCP HTTP endpoint 发送 initialize 与 tools/call 请求（server 包已有 stream transport 实现，可参考协议）。
- 新增控制器路由：POST /v1/servers/:id/tools/:toolId/execute，返回 ToolResult。
- UI：APITester.vue 读取 query 中的 serverId/toolId，从 serverAPI.getServerDetails 获取 tools，调用新端点执行；stores/testing.ts 去掉随机模拟。

## 兼容与扩展
- 不改变现有服务器管理与监控能力。
- 后续可将测试用例存储从前端内存迁移到后端 API（新增 /v1/test-cases 等），但非本期强制。

## 风险与对策
- 传输差异：先落地 stdio/streamable，抽象出传输适配层，逐步补全。
- 超时与资源：控制工具执行超时（如 30s），避免队列阻塞；提供取消/中止能力。
- 安全：端点需要鉴权（JWT），并限定仅能对自己创建的 server 执行。
- 并发：限制单服务器并发执行数，避免压垮后端或被测服务。

## 验收标准（第一阶段）
- UI 选择某服务器的一个工具，输入参数，点击执行，返回真实响应。
- 错误链路完整（参数错误、后端错误、超时、目标接口 4xx/5xx）。
- 执行历史可在 UI 查看（来源于前端 store，后续可落 DB）。
