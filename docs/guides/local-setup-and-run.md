# Local Setup And Run

本文件作为当前项目本地开发、数据库配置、编译与启动命令的单一事实来源。

适用范围：

- Windows PowerShell
- Linux，尤其是 Ubuntu
- 本仓库当前主路径：
  - `packages/mcp-swagger-api`
  - `packages/mcp-swagger-ui`
  - `packages/mcp-swagger-server`

## 1. 前置要求

- Node.js `>= 20`
- `pnpm >= 8`
- PostgreSQL `>= 14`

建议先检查版本：

Windows PowerShell:

```powershell
node -v
pnpm -v
psql --version
```

Ubuntu:

```bash
node -v
pnpm -v
psql --version
```

## 2. 安装依赖

在仓库根目录执行。

Windows PowerShell:

```powershell
cd E:\CodexDev\mcp-swagger-server
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
```

Ubuntu:

```bash
cd /path/to/mcp-swagger-server
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
```

## 3. PostgreSQL 数据库配置

### 3.1 创建数据库

默认数据库名使用 `mcp_swagger_api`。

Windows PowerShell:

```powershell
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE mcp_swagger_api;"
```

Ubuntu:

```bash
sudo -u postgres psql -c "CREATE DATABASE mcp_swagger_api;"
```

如果数据库已存在，PostgreSQL 会提示重复，可忽略。

### 3.2 API 环境变量文件

API 包使用以下优先级加载环境文件：

1. `packages/mcp-swagger-api/.env.local`
2. `packages/mcp-swagger-api/.env.development`
3. `packages/mcp-swagger-api/.env.production`
4. `packages/mcp-swagger-api/.env`

建议先复制模板：

Windows PowerShell:

```powershell
Copy-Item packages\mcp-swagger-api\.env.example packages\mcp-swagger-api\.env
```

Ubuntu:

```bash
cp packages/mcp-swagger-api/.env.example packages/mcp-swagger-api/.env
```

然后编辑 `packages/mcp-swagger-api/.env`，至少确认以下字段：

```env
NODE_ENV=development
PORT=3001
MCP_PORT=3322

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your-postgres-password
DB_DATABASE=mcp_swagger_api
DB_LOGGING=false

JWT_SECRET=change-this-jwt-secret
API_KEY=change-this-api-key

SUPER_ADMIN_USERNAME=admin
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=Admin@123456
```

说明：

- `DB_PASSWORD` 必须与你本机 PostgreSQL 实际密码一致。
- `DB_DATABASE` 需要与创建出的数据库名一致。
- 首次启动时会自动做初始化与种子数据写入。

## 4. 编译命令

在仓库根目录执行。

Windows PowerShell:

```powershell
cd E:\CodexDev\mcp-swagger-server
pnpm build
```

Ubuntu:

```bash
cd /path/to/mcp-swagger-server
pnpm build
```

如果只想编译单个包：

```bash
pnpm --filter mcp-swagger-parser run build
pnpm --filter mcp-swagger-server run build
pnpm --filter mcp-swagger-api run build
pnpm --filter mcp-swagger-ui run build
```

## 5. 启动运行

### 5.1 启动 API

推荐先编译，再直接运行产物。当前已经实际核对：从仓库根目录启动可正常读取 `packages/mcp-swagger-api/.env`。

Windows PowerShell:

```powershell
cd E:\CodexDev\mcp-swagger-server
pnpm --filter mcp-swagger-api run build
node packages\mcp-swagger-api\dist\src\main.js
```

Ubuntu:

```bash
cd /path/to/mcp-swagger-server
pnpm --filter mcp-swagger-api run build
node packages/mcp-swagger-api/dist/src/main.js
```

开发模式：

Windows PowerShell:

```powershell
cd E:\CodexDev\mcp-swagger-server
pnpm --filter mcp-swagger-api run start:dev
```

Ubuntu:

```bash
cd /path/to/mcp-swagger-server
pnpm --filter mcp-swagger-api run start:dev
```

启动成功后：

- Swagger 文档：`http://localhost:3001/api/docs`
- 健康检查：`http://localhost:3001/health`

### 5.2 启动 UI

Windows PowerShell:

```powershell
cd E:\CodexDev\mcp-swagger-server
pnpm --filter mcp-swagger-ui run dev
```

Ubuntu:

```bash
cd /path/to/mcp-swagger-server
pnpm --filter mcp-swagger-ui run dev
```

默认访问地址：

- UI：`http://localhost:3000` 或 Vite 实际输出端口
- API 代理目标：`http://localhost:3001`

建议先启动 API，再启动 UI。

### 5.3 启动 MCP Server CLI

Windows PowerShell:

```powershell
cd E:\CodexDev\mcp-swagger-server
pnpm --filter mcp-swagger-server run build
node packages\mcp-swagger-server\dist\cli.js --openapi .\examples\minimal-openapi.json --transport streamable --port 3322
```

Ubuntu:

```bash
cd /path/to/mcp-swagger-server
pnpm --filter mcp-swagger-server run build
node packages/mcp-swagger-server/dist/cli.js --openapi ./examples/minimal-openapi.json --transport streamable --port 3322
```

启动成功后：

- MCP 入口：`http://127.0.0.1:3322/mcp`
- CLI 健康检查：`http://127.0.0.1:3322/health`

## 6. 最小运行顺序

如果你的目标是本地跑通完整主路径，按这个顺序：

1. 启动 PostgreSQL
2. 配置 `packages/mcp-swagger-api/.env`
3. 执行 `pnpm install`
4. 执行 `pnpm --filter mcp-swagger-api run build`
5. 启动 API
6. 访问 `http://localhost:3001/api/docs`
7. 启动 UI
8. 如需 MCP 接入，再单独启动 `mcp-swagger-server`

## 7. 常见问题

### 7.1 PostgreSQL 密码认证失败

症状：

- API 启动日志出现 `password authentication failed for user "postgres"` 或同类报错

处理方式：

- 检查 `packages/mcp-swagger-api/.env` 中的 `DB_PASSWORD`
- 确认 `DB_HOST`、`DB_PORT`、`DB_USERNAME`、`DB_DATABASE` 是否正确
- 用 `psql` 先手工验证数据库连接

Windows PowerShell:

```powershell
psql -U postgres -h localhost -p 5432 -d mcp_swagger_api
```

Ubuntu:

```bash
psql -U postgres -h localhost -p 5432 -d mcp_swagger_api
```

### 7.2 API 启动了，但 UI 无法访问后端

检查：

- API 是否已经启动在 `3001`
- UI 的代理是否仍指向 `http://localhost:3001`
- 浏览器访问 `http://localhost:3001/health` 是否返回成功

### 7.3 只想验证 CLI 是否可用

Windows PowerShell:

```powershell
pnpm --filter mcp-swagger-server run cli:help
```

Ubuntu:

```bash
pnpm --filter mcp-swagger-server run cli:help
```

## 8. 当前结论

当前已实际核对：

- API 编译通过
- API 可从仓库根目录启动
- API 可连接已配置的 PostgreSQL 并完成初始化
- API 文档入口为 `http://localhost:3001/api/docs`
- CLI 可从本地最小 OpenAPI 文件启动

后续若其它文档与本文件冲突，以本文件为准。
