# Endpoint 语义层改造需求（MCP Tools 发布前）

## 1. 背景

当前系统将 OpenAPI endpoint 的原始描述直接转换为 MCP Tools。该方式能快速发布，但存在明显问题：

- endpoint 的 `summary/description` 偏接口视角，不够“任务语义化”，LLM 工具选择准确率有限
- 参数名称和业务意图经常不一致，缺少可读别名与约束提示
- endpoint 变更会直接影响 tools 语义稳定性，缺乏独立版本管理

需要在 `OpenAPI -> MCP Tools` 之间增加一个轻量、可编辑、可版本化的语义层。

## 2. 目标与范围

### 2.1 目标

- 在工具发布前，支持定义/修改 endpoint 语义，提升 LLM 可理解性与调用正确率
- 支持自动生成语义草稿 + 人工覆盖，兼顾效率与可控性
- 支持语义版本化与发布状态管理，降低接口变更带来的行为漂移

### 2.2 本期范围（MVP）

- 新增 Endpoint 级 `semantic_profile`
- 增加语义草稿生成器（基于 OpenAPI 元数据）
- 提供语义编辑与发布开关
- MCP Tools 发布时应用语义覆盖规则

### 2.3 非目标（本期不做）

- 不引入复杂 NLP 流水线或训练系统
- 不做跨租户复杂策略引擎
- 不改造为重型 API 网关

## 3. 关键用户故事

1. 作为 API 管理员，我希望将 `operationId=getPetById` 改为“查询宠物详情”，并补充“何时应调用该工具”的说明。
2. 作为平台运营，我希望某 endpoint 语义未审核时不能对外发布为 Tool。
3. 作为研发，我希望接口字段 `petId` 可配置 LLM 友好别名 `id`，减少模型参数映射错误。

## 4. 功能需求

### 4.1 语义档案（Semantic Profile）

每个 endpoint 对应一个当前有效语义档案，核心字段如下：

- `intent_name`：工具能力名称（面向任务语义）
- `description_for_llm`：模型决策提示，描述“何时调用”
- `input_aliases`：参数别名映射（如 `petId -> id`）
- `constraints`：调用约束（必填、枚举、速率、前置条件）
- `examples`：1-2 个示例（自然语言意图 + 参数示例）
- `visibility`：`internal/public`
- `status`：`draft/reviewed/published/offline`
- `version`：语义版本号，独立于 API 版本

### 4.2 自动草稿生成

导入 OpenAPI 后自动生成语义草稿，来源优先为：

1. endpoint 的 `summary/description/tags`
2. request schema 字段和枚举
3. operationId 命名分词补全

生成结果默认状态为 `draft`。

### 4.3 人工编辑与审核

- 支持在 UI 编辑上述字段
- 提供“预览发布后的 Tool 元数据”功能
- 仅 `reviewed/published` 可进入发布流

### 4.4 发布覆盖规则

发布 Tool 时字段来源优先级：

1. 人工维护语义字段
2. 自动草稿字段
3. OpenAPI 原始字段

### 4.5 版本与追溯

- 每次发布保存快照到 `semantic_profile_history`
- Tool 元数据记录 `semantic_version`
- 支持回滚到历史语义版本并重新发布

## 5. 数据模型（SQLite）

建议新增三张表：

- `semantic_profile`：当前生效语义
- `semantic_profile_history`：发布快照历史
- `endpoint_publish_binding`：endpoint 与 tool 发布绑定（记录 endpoint 版本、semantic 版本、发布时间）

## 6. 状态机

建议状态流：

- `draft -> reviewed -> published -> offline`
- `published -> reviewed`（允许继续迭代）
- `offline -> reviewed/published`（恢复上线）

发布条件：

- endpoint 可用状态为 online
- 语义状态为 `published`
- 权限策略通过（若已启用）

## 7. 实现步骤（分阶段）

### 阶段 1：数据与服务底座

- 建表与迁移脚本
- 新增 `SemanticProfileService`（CRUD + 状态流校验）
- 在转换流水线加入 `SemanticEnricher`

### 阶段 2：发布链路改造

- Tool 发布改为读取语义覆盖
- Tool 元数据加 `semantic_version`
- 发布快照落库

### 阶段 3：管理端能力

- 语义编辑页面（列表、详情、状态切换、预览）
- 审核与发布动作按钮
- 历史版本回滚入口

### 阶段 4：质量验证

- 单元测试：覆盖优先级、状态流、回滚
- 集成测试：OpenAPI 导入 -> 语义编辑 -> 发布 -> MCP 调用验证

## 8. 验收标准

- 至少 80% endpoint 可自动生成可用语义草稿
- 语义发布后，Tool 元数据可见 `semantic_version`
- 对同一 endpoint 回滚语义版本后，新请求命中回滚版本
- 未发布语义不得出现在对外 Tool 列表

## 9. 风险与应对

- 风险：人工维护成本上升  
  应对：默认自动生成 + 差异化编辑，仅编辑必要字段

- 风险：语义与实际接口能力偏离  
  应对：发布前执行 schema 对齐检查与示例参数校验

- 风险：历史版本过多  
  应对：保留策略（如最近 N 版 + 关键发布永久保留）

## 10. 交付物

- 后端：语义层数据模型、服务、发布链路改造
- 前端：语义编辑与发布页
- 测试：单元/集成测试用例
- 文档：发布流程图、字段定义、操作手册

## 11. 平台与数据库兼容性要求（补充）

本需求为硬性约束：

1. 数据库必须同时支持 `SQLite` 与 `PostgreSQL`。
2. 部署与运行必须同时支持 `Linux` 与 `Windows`。
3. 语义层相关迁移、查询、发布、回滚能力需在双数据库与双平台一致可用。
4. 验收时必须提供四象限验证结果（Linux/Windows x SQLite/PostgreSQL）。
