# Local Setup And Run

This is the active setup and run baseline for the current product path.

It covers:

- Windows PowerShell
- Linux, especially Ubuntu
- API, UI, and runtime CLI startup
- SQLite default mode and PostgreSQL optional mode

## 1. Prerequisites

Required:

- Node.js `>= 20`
- `pnpm >= 8`

Optional:

- PostgreSQL `>= 14` when using the heavier deployment mode
- GitHub CLI `gh` when creating PRs or releases from the command line

Windows PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS
corepack enable
corepack prepare pnpm@latest --activate
```

Ubuntu:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
corepack enable
corepack prepare pnpm@latest --activate
```

Verify:

```bash
node -v
pnpm -v
```

## 2. Install Dependencies

Run from repository root.

Windows PowerShell:

```powershell
cd E:\CodexDev\mcp-swagger-server
pnpm install
```

Ubuntu:

```bash
cd /path/to/mcp-swagger-server
pnpm install
```

## 3. Choose Database Mode

Two product modes are supported:

- `SQLite`: default, single-machine, light-load, easiest to use
- `PostgreSQL`: optional, heavier deployment, higher concurrency, better fit for long-running multi-user operation

### 3.1 SQLite default mode

Copy the API env template:

Windows PowerShell:

```powershell
Copy-Item packages\mcp-swagger-api\.env.example packages\mcp-swagger-api\.env
```

Ubuntu:

```bash
cp packages/mcp-swagger-api/.env.example packages/mcp-swagger-api/.env
```

Recommended minimum env:

```env
NODE_ENV=development
PORT=3001
MCP_PORT=3322

DB_TYPE=sqlite
DB_SQLITE_PATH=data/mcp-swagger.db

JWT_SECRET=change-this-jwt-secret
JWT_REFRESH_SECRET=change-this-refresh-secret
API_KEY=change-this-api-key

SUPER_ADMIN_USERNAME=admin
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=Admin@123456
```

Notes:

- if `DB_TYPE` is omitted, the API defaults to `sqlite`
- if `packages/mcp-swagger-api/.env` only contains `DB_HOST` / `DB_PORT` / `DB_DATABASE` but omits `DB_TYPE`, runtime still uses SQLite instead of PostgreSQL
- `DB_SQLITE_PATH` may be relative to the workspace or absolute
- startup logs should report `Database mode: sqlite`

### 3.2 PostgreSQL optional mode

Create the database first.

Windows PowerShell:

```powershell
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE mcp_swagger_api;"
```

Ubuntu:

```bash
sudo -u postgres psql -c "CREATE DATABASE mcp_swagger_api;"
```

Then configure `packages/mcp-swagger-api/.env`:

```env
NODE_ENV=development
PORT=3001
MCP_PORT=3322

DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your-postgres-password
DB_DATABASE=mcp_swagger_api

JWT_SECRET=change-this-jwt-secret
JWT_REFRESH_SECRET=change-this-refresh-secret
API_KEY=change-this-api-key

SUPER_ADMIN_USERNAME=admin
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=Admin@123456
```

Notes:

- startup logs should report `Database mode: postgres`
- PostgreSQL mode is enabled only when `DB_TYPE=postgres` is set explicitly
- PostgreSQL remains the recommended mode for heavier and longer-running deployments

Clean reinitialization path:

Windows PowerShell:

```powershell
psql -U postgres -h localhost -p 5432 -d postgres -c "DROP DATABASE IF EXISTS mcp_swagger_api;"
psql -U postgres -h localhost -p 5432 -d postgres -c "CREATE DATABASE mcp_swagger_api;"
```

Ubuntu:

```bash
sudo -u postgres psql -d postgres -c "DROP DATABASE IF EXISTS mcp_swagger_api;"
sudo -u postgres psql -d postgres -c "CREATE DATABASE mcp_swagger_api;"
```

Recommended validation after switching to PostgreSQL:

Windows PowerShell:

```powershell
cd E:\CodexDev\mcp-swagger-server
pnpm --filter mcp-swagger-api run build
$env:DB_TYPE="postgres"
pnpm --filter mcp-swagger-api run test -- --runInBand
node packages\mcp-swagger-api\dist\src\main.js
```

Ubuntu:

```bash
cd /path/to/mcp-swagger-server
pnpm --filter mcp-swagger-api run build
DB_TYPE=postgres pnpm --filter mcp-swagger-api run test -- --runInBand
DB_TYPE=postgres node packages/mcp-swagger-api/dist/src/main.js
```

Validation points:

- startup log prints `Database mode: postgres`
- startup log prints the target PostgreSQL host, port, and database
- `GET http://localhost:3001/api/health/live` returns `200`
- `GET http://localhost:3001/api/api/system/initialization` returns initialized status

Current verified baseline:

- SQLite default path: build + test + startup
- PostgreSQL path: database recreation, schema initialization, seed initialization, health endpoint, initialization endpoint, and full package test pass

## 4. Build Commands

From repository root:

```bash
pnpm build
```

Per-package build:

```bash
pnpm --filter mcp-swagger-parser run build
pnpm --filter mcp-swagger-server run build
pnpm --filter mcp-swagger-api run build
pnpm --filter mcp-swagger-ui run build
```

If parser behavior changed, run:

```bash
pnpm run verify:parser-chain
```

For broader downstream verification:

```bash
pnpm run verify:parser-chain:full
```

## 5. Start Commands

### 5.1 Start API

Development mode:

```bash
pnpm --filter mcp-swagger-api run start:dev
```

Built mode:

Windows PowerShell:

```powershell
pnpm --filter mcp-swagger-api run build
node packages\mcp-swagger-api\dist\src\main.js
```

Ubuntu:

```bash
pnpm --filter mcp-swagger-api run build
node packages/mcp-swagger-api/dist/src/main.js
```

Main addresses:

- API base: `http://127.0.0.1:3001/api`
- API docs: `http://127.0.0.1:3001/api/docs`
- health: `http://127.0.0.1:3001/health`

### 5.2 Start UI

```bash
pnpm --filter mcp-swagger-ui run dev
```

Main address:

- UI: `http://127.0.0.1:3000/`

The default dev proxy target is:

- `http://127.0.0.1:3001`

### 5.3 Start Runtime CLI

Windows PowerShell:

```powershell
pnpm --filter mcp-swagger-server run build
node packages\mcp-swagger-server\dist\cli.js --openapi .\examples\minimal-openapi.json --transport streamable --port 3322
```

Ubuntu:

```bash
pnpm --filter mcp-swagger-server run build
node packages/mcp-swagger-server/dist/cli.js --openapi ./examples/minimal-openapi.json --transport streamable --port 3322
```

Main addresses:

- MCP endpoint: `http://127.0.0.1:3322/mcp`
- CLI health: `http://127.0.0.1:3322/health`

Notes:

- `/mcp` is an MCP protocol endpoint, not a browser page
- direct browser access without MCP headers is expected to fail
- concurrent Streamable HTTP sessions are part of the current baseline

## 6. Minimal Run Order

### SQLite path

1. `pnpm install`
2. Copy `.env.example` to `packages/mcp-swagger-api/.env`
3. Keep `DB_TYPE=sqlite` or omit it
4. Start API
5. Open `http://127.0.0.1:3001/api/docs`
6. Start UI if needed
7. Start runtime CLI if MCP endpoint testing is needed

### PostgreSQL path

1. Start PostgreSQL
2. Create database `mcp_swagger_api`
3. Configure `packages/mcp-swagger-api/.env`
4. Set `DB_TYPE=postgres`
5. Start API
6. Open `http://127.0.0.1:3001/api/docs`
7. Start UI if needed

## 7. Verification Commands

Core checks:

```bash
pnpm build
pnpm type-check
pnpm --filter mcp-swagger-server run test
```

Targeted runtime checks:

```bash
pnpm --filter mcp-swagger-server run test:transform-spec
pnpm --filter mcp-swagger-server run test:streamable-session
```

## 8. Common Problems

### 8.1 PostgreSQL authentication failure

Check:

- `DB_HOST`
- `DB_PORT`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_DATABASE`

Manual test:

```bash
psql -U postgres -h localhost -p 5432 -d mcp_swagger_api
```

### 8.2 UI cannot reach API

Check:

- API is running on `3001`
- UI is running on `3000`
- `http://127.0.0.1:3001/health` responds

### 8.3 PostgreSQL startup fails after database creation

Symptoms:

- database credentials are correct
- PostgreSQL is reachable
- API still fails during TypeORM metadata validation or schema initialization

Check:

- use the latest codebase after the dual-database enum compatibility fix
- rebuild the API package before restart:

```bash
pnpm --filter mcp-swagger-api run build
```

If startup succeeds, logs should include:

- `Database mode: postgres`
- `PostgreSQL database: <host>:<port>/<database>`

### 8.4 SQLite path is wrong or not writable

Check:

- `DB_SQLITE_PATH`
- write permission on the parent directory
- whether an absolute path would be clearer for your environment

### 8.5 PowerShell blocks npm script execution

Use:

```powershell
npm.cmd -v
pnpm.cmd -v
```

If needed:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## 9. Current Baseline Summary

Currently verified in the active baseline:

- supported MCP transports are `stdio`, `streamable`, and `sse`
- SQLite is the default database mode
- PostgreSQL remains supported
- API docs are exposed at `http://127.0.0.1:3001/api/docs`
- runtime direct-spec transformation smoke passes
- Streamable multi-session smoke passes

If another document conflicts with this one, use this file as the active local-run baseline.
