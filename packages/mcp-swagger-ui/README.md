# MCP Swagger UI

`mcp-swagger-ui` 是本项目的前端操作界面，基于 Vue 3、Vite、TypeScript 与 Element Plus。

它面向的核心场景是：

- 导入 OpenAPI / Swagger 文档
- 校验、标准化与预览文档
- 查看接口路径与工具映射
- 管理 MCP Server

## 当前定位

这是项目的操作层 UI，而不是一个独立的静态演示站点。

默认开发端口：

- UI: `3000`

默认后端联调目标：

- API: `http://127.0.0.1:3001`

## 当前支持基线

### 文档管理

- 从 URL 导入
- 从文本导入
- 从文件导入
- 规范校验
- 标准化预览
- 工具预览

### 服务器管理

- 选择文档创建 MCP Server
- 查看服务器列表、详情、工具与日志
- 管理启动与停止状态

说明：

- 某些历史占位页面或未完成操作不应视为发布承诺
- MCP `websocket` transport 目前不应被视为当前稳定支持项

## 本地开发

先在仓库根目录完成：

```bash
node -v
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
pnpm install
```

然后启动 UI：

```bash
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

## 环境配置

如需覆盖默认接口地址，可使用 `.env.local`：

```env
VITE_API_BASE_URL=http://127.0.0.1:3001/api
VITE_APP_TITLE=MCP Swagger Server
```

实际联调和启动基线见：

- [Local Setup And Run](../../docs/guides/local-setup-and-run.md)

## 当前重点说明

- UI 是产品主路径的一部分，文档应以当前实现为准
- 当前主要目标是保证“导入 -> 校验 -> 转换 -> 管理”链路稳定
- 视觉、占位页、扩展配置页不应优先于主链路稳定性

## 相关文档

- [Project README](../../README.md)
- [Documentation Index](../../docs/README.md)
- [Local Setup And Run](../../docs/guides/local-setup-and-run.md)
- [Next Phase Development Plan](../../docs/guides/next-phase-development-plan.md)
