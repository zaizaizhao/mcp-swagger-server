# MCP Swagger UI

`mcp-swagger-ui` 是本项目的前端操作界面，基于 Vue 3、Vite 与 TypeScript。

核心使用场景包括：

- 导入 OpenAPI / Swagger 文档
- 校验、标准化与预览文档
- 查看接口路径与生成工具
- 管理 MCP Server

## 当前定位

这是产品操作界面，不是独立的静态演示站点。

默认开发联调端口：

- UI: `3000`
- API 目标：`http://127.0.0.1:3001`

## 当前支持基线

### 文档管理

- 从 URL 导入
- 从文本导入
- 从文件导入
- 规范校验
- 标准化预览
- 工具预览

### 服务管理

- 从已选文档创建 MCP Server
- 查看服务列表、详情、工具与日志
- 管理启动与停止状态

说明：

- 历史占位页面或未完成操作不应视为发布承诺。
- UI 中的 websocket 仅用于管理与监控实时更新。
- websocket 不属于 MCP transport 矩阵。

## 本地开发

```bash
node -v
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
pnpm install
pnpm --filter mcp-swagger-ui run dev
```

访问：

```text
http://127.0.0.1:3000
```

## 构建命令

```bash
pnpm --filter mcp-swagger-ui run build
pnpm --filter mcp-swagger-ui run preview
pnpm --filter mcp-swagger-ui run type-check
pnpm --filter mcp-swagger-ui run lint
```

## 环境覆盖

如需覆盖默认 API 目标，可使用 `.env.local`：

```env
VITE_API_BASE_URL=http://127.0.0.1:3001/api
VITE_APP_TITLE=MCP Swagger Server
```

详见：

- [Local Setup And Run](../../docs/guides/local-setup-and-run.md)

## 当前重点

- 保持 UI 与实际产品主路径一致
- 优先保证“导入 -> 校验 -> 转换 -> 管理”链路稳定
- 不应让视觉占位页或扩展页面优先于主链路稳定性

## 相关文档

- [Project README](../../README.md)
- [Documentation Index](../../docs/README.md)
- [Local Setup And Run](../../docs/guides/local-setup-and-run.md)
- [Current Convergence Plan](../../docs/guides/current-convergence-plan.md)
