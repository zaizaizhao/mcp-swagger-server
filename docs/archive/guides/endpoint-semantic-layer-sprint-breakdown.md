# Endpoint 语义层改造 Sprint 拆解

## 1. 目标

将 `OpenAPI -> MCP Tool` 发布流程升级为“语义先行”模式：

- endpoint 先生成/编辑语义档案
- 仅发布已审核语义
- Tool 元数据携带语义版本，可追溯可回滚

## 2. Sprint 建议（4 个 Sprint）

### Sprint 1：数据底座与领域模型

后端任务：

1. 新建表 `semantic_profile`（当前生效语义）
2. 新建表 `semantic_profile_history`（发布快照）
3. 新建表 `endpoint_publish_binding`（endpoint 与 tool 绑定）
4. 增加迁移脚本与回滚脚本
5. `SemanticProfileService`：CRUD + 状态流校验（`draft/reviewed/published/offline`）

测试任务：

1. Repository 层 CRUD 测试
2. 状态机流转测试（非法流转必须失败）
3. 迁移脚本冒烟测试（SQLite）

交付标准：

1. 三张表在默认 SQLite 模式可正常创建
2. Service 层可完成语义档案增删改查与状态流转

### Sprint 2：自动语义生成与发布覆盖

后端任务：

1. 增加 `SemanticDraftGenerator`（基于 summary/description/tags/schema）
2. 改造发布流水线，接入 `SemanticEnricher`
3. 实现发布字段优先级：
   - 人工语义
   - 自动草稿
   - OpenAPI 原文
4. Tool 元数据新增 `semantic_version`
5. 发布动作自动写入 `semantic_profile_history`

测试任务：

1. 语义优先级覆盖测试
2. 发布后 `semantic_version` 校验
3. 历史快照正确性测试

交付标准：

1. 导入 endpoint 后可自动生成 `draft` 语义
2. 发布 Tool 时语义覆盖生效，且可追溯语义版本

### Sprint 3：管理端语义编辑与审核

前端任务：

1. 新增语义列表页（按来源、状态筛选）
2. 新增语义详情页：
   - `intent_name`
   - `description_for_llm`
   - `input_aliases`
   - `constraints`
   - `examples`
3. 增加“预览发布后 Tool JSON”
4. 增加状态动作：提交审核、发布、下线、回滚

后端任务：

1. 提供语义 CRUD API
2. 提供历史版本查询与回滚 API
3. 增加发布前校验 API（状态、字段完整度）

测试任务：

1. 前端表单校验与交互测试
2. 端到端测试：编辑 -> 审核 -> 发布 -> 回滚

交付标准：

1. 管理员可完成语义从 `draft` 到 `published` 全流程
2. 回滚后发布结果可见版本变化

### Sprint 4：稳定性与灰度上线

后端任务：

1. 增加语义变更审计日志
2. 增加发布失败回滚保护（事务）
3. 增加兼容策略：缺语义时降级旧逻辑（开关控制）

测试任务：

1. 回归测试（既有 OpenAPI 导入/发布链路）
2. 压测（批量 endpoint 发布）
3. 异常注入测试（发布中断、回滚）

运维任务：

1. 增加发布成功率、语义覆盖率指标
2. 增加日志字段 `semantic_version`

交付标准：

1. 线上灰度组运行稳定
2. 核心发布链路无回归

## 3. 工作分解（按角色）

后端：

1. 领域模型与迁移
2. 语义生成器与发布管道改造
3. API 与权限校验

前端：

1. 语义列表与详情
2. 预览、审核、回滚交互
3. 发布前校验提示

测试：

1. 单元测试覆盖状态机与优先级
2. 集成测试覆盖导入到发布
3. E2E 覆盖关键操作路径

产品/运营：

1. 语义字段规范与审核标准
2. 发布准入规则定义
3. 验收样例库维护

## 4. 里程碑与验收

里程碑 M1：

1. 数据与服务可用（Sprint 1）

里程碑 M2：

1. 语义覆盖发布可用（Sprint 2）

里程碑 M3：

1. 管理端全流程可用（Sprint 3）

里程碑 M4：

1. 灰度上线与监控闭环（Sprint 4）

总体验收口径：

1. 80% 以上 endpoint 有可用语义草稿
2. 所有外发 Tool 均可追溯语义版本
3. 未发布语义不会进入 Tool 列表

## 6. 平台与数据库兼容性基线（新增硬性约束）

必须同时满足以下要求：

1. 数据库：`SQLite` 与 `PostgreSQL` 双支持，功能行为一致。
2. 操作系统：`Linux` 与 `Windows` 双支持，运行与测试流程一致。

实施要求：

1. 所有新表迁移脚本需提供跨数据库适配（类型、默认值、索引语法差异处理）。
2. Repository/Query 层禁止写死 SQLite 方言。
3. 定时任务、路径处理、进程命令必须避免系统相关写法。
4. CI 至少包含四组矩阵验证：
   - Linux + SQLite
   - Linux + PostgreSQL
   - Windows + SQLite
   - Windows + PostgreSQL

补充验收口径：

1. 两种数据库下关键流程（导入、语义编辑、发布、回滚）均通过。
2. Linux/Windows 下关键流程均通过，且无路径分隔符、编码、命令兼容问题。
