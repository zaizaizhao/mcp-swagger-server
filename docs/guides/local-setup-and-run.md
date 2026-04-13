# Local Setup And Run

This document is the current source of truth for local installation, database setup, build, and startup commands.

Supported environments:

- Windows PowerShell
- Linux, especially Ubuntu

Main runtime paths in this repository:

- `packages/mcp-swagger-api`
- `packages/mcp-swagger-ui`
- `packages/mcp-swagger-server`

## 1. Prerequisites

Required:

- Node.js `>= 20`
- `pnpm >= 8`

Optional:

- PostgreSQL `>= 14` when using heavy-load or production-oriented mode
- GitHub CLI (`gh`) when you need to create PRs/releases from command line

### 1.1 Install Node.js and pnpm (if missing)

Windows PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS
corepack enable
corepack prepare pnpm@latest --activate
```

### 1.2 Install GitHub CLI (optional, for PR/release workflow)

Windows PowerShell:

```powershell
winget install --id GitHub.cli -e
gh --version
gh auth login
```

Ubuntu:

```bash
sudo apt update
sudo apt install -y gh
gh --version
gh auth login
```

Notes:

- `gh auth login` should be completed with an account that has repo push/PR permissions.
- If `gh` is unavailable in apt source, follow the official package repo guide:
  [https://cli.github.com/manual/installation](https://cli.github.com/manual/installation)

Ubuntu:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
corepack enable
corepack prepare pnpm@latest --activate
```

Check versions first.

Windows PowerShell:

```powershell
node -v
pnpm -v
```

Ubuntu:

```bash
node -v
pnpm -v
```

If you plan to use PostgreSQL:

Windows PowerShell:

```powershell
psql --version
```

Ubuntu:

```bash
psql --version
```

## 2. Install Dependencies

Run from repository root.

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

## 3. Choose Database Mode

The project now supports two product modes:

- `SQLite`: default, single-machine, light-load, easiest to use
- `PostgreSQL`: heavier deployment, multi-user, higher write volume, long-running production recommendation

### 3.1 Recommended default: SQLite

Use SQLite when you want the fastest path to a working local environment.

Copy the API env template:

Windows PowerShell:

```powershell
Copy-Item packages\mcp-swagger-api\.env.example packages\mcp-swagger-api\.env
```

Ubuntu:

```bash
cp packages/mcp-swagger-api/.env.example packages/mcp-swagger-api/.env
```

Edit `packages/mcp-swagger-api/.env` and keep at least:

```env
NODE_ENV=development
PORT=3001
MCP_PORT=3322

DB_TYPE=sqlite
DB_SQLITE_PATH=data/mcp-swagger.db

JWT_SECRET=change-this-jwt-secret
API_KEY=change-this-api-key

SUPER_ADMIN_USERNAME=admin
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=Admin@123456
```

Notes:

- `DB_TYPE=sqlite` is the default path
- `DB_SQLITE_PATH` is relative to the workspace unless you provide an absolute path
- API startup now performs a writability check for the SQLite parent directory and database file
- this mode does not require PostgreSQL

### 3.2 How to confirm the active database mode

If you do not set `DB_TYPE`, the API defaults to `sqlite`.

Current confirmation rules:

- `packages/mcp-swagger-api/.env` does not need `DB_TYPE` for SQLite mode
- API startup logs will print `Database mode: sqlite` or `Database mode: postgres`
- in SQLite mode, startup logs also print the resolved SQLite file path

Recommended quick checks:

Windows PowerShell:

```powershell
Select-String -Path packages\mcp-swagger-api\.env -Pattern '^DB_TYPE='
pnpm --filter mcp-swagger-api run start:dev
```

Ubuntu:

```bash
grep '^DB_TYPE=' packages/mcp-swagger-api/.env
pnpm --filter mcp-swagger-api run start:dev
```

If no `DB_TYPE=` line is present, the runtime default is SQLite.

### 3.3 Optional: PostgreSQL

Use PostgreSQL when you need a stronger production posture.

Create the database first.

Windows PowerShell:

```powershell
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE mcp_swagger_api;"
```

Ubuntu:

```bash
sudo -u postgres psql -c "CREATE DATABASE mcp_swagger_api;"
```

Then edit `packages/mcp-swagger-api/.env`:

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
API_KEY=change-this-api-key

SUPER_ADMIN_USERNAME=admin
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=Admin@123456
```

Notes:

- `DB_PASSWORD` must match your actual PostgreSQL password
- `DB_DATABASE` must match the created database name
- PostgreSQL remains the recommended path for heavier and longer-running production use

## 4. Build Commands

Run from repository root.

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

If you only want to build one package:

```bash
pnpm --filter mcp-swagger-parser run build
pnpm --filter mcp-swagger-server run build
pnpm --filter mcp-swagger-api run build
pnpm --filter mcp-swagger-ui run build
```

### 4.1 Required flow after parser changes

If you change anything under `packages/mcp-swagger-parser`, do not stop at rebuilding the parser alone.

Run the fixed downstream rebuild and verification flow from repository root:

```bash
pnpm run verify:parser-chain
```

This is the stable default verification path:

- parser build
- server build
- parser type-check
- server type-check
- api type-check
- ui type-check

If you only need downstream rebuild without the full type-check pass:

```bash
pnpm run build:parser-chain
```

If you also need consumer build verification for release work:

```bash
pnpm run verify:parser-chain:full
```

This is the required baseline for parser compatibility fixes and export/type changes.

## 5. Start Commands

### 5.1 Start API

Run from repository root.

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

Development mode:

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

After startup:

- Swagger docs: `http://localhost:3001/api/docs`
- health endpoint: `http://localhost:3001/health`
- startup logs show the effective database mode and resolved SQLite path or PostgreSQL target

### 5.2 Start UI

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

Default addresses:

- UI: `http://localhost:3000`
- API proxy target: `http://localhost:3001`

### 5.3 Start MCP Server CLI

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

After startup:

- MCP endpoint: `http://127.0.0.1:3322/mcp`
- CLI health endpoint: `http://127.0.0.1:3322/health`
- Streamable HTTP clients may open more than one MCP session against the same server process
- direct browser access to `/mcp` without MCP headers remains invalid by design

## 6. Minimal Run Order

### SQLite path

1. `pnpm install`
2. copy `packages/mcp-swagger-api/.env.example` to `packages/mcp-swagger-api/.env`
3. keep `DB_TYPE=sqlite` or leave it unset
4. build API
5. start API
6. visit `http://localhost:3001/api/docs`
7. start UI if needed
8. start `mcp-swagger-server` separately if MCP endpoint testing is needed

### PostgreSQL path

1. start PostgreSQL
2. create database `mcp_swagger_api`
3. configure `packages/mcp-swagger-api/.env`
4. set `DB_TYPE=postgres`
5. run `pnpm install`
6. build API
7. start API
8. visit `http://localhost:3001/api/docs`
9. start UI if needed

## 7. Common Problems

### 7.1 PostgreSQL authentication failure

Symptoms:

- API logs show `password authentication failed for user "postgres"` or similar errors

Check:

- `packages/mcp-swagger-api/.env`
- `DB_HOST`
- `DB_PORT`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_DATABASE`

Manual test:

Windows PowerShell:

```powershell
psql -U postgres -h localhost -p 5432 -d mcp_swagger_api
```

Ubuntu:

```bash
psql -U postgres -h localhost -p 5432 -d mcp_swagger_api
```

### 7.2 UI cannot reach API

Check:

- API is running on `3001`
- UI is running on `3000`
- `http://localhost:3001/health` responds

### 7.3 SQLite mode starts but data path is wrong

Check:

- `DB_SQLITE_PATH` exists or can be created
- the current user has write permission to the parent directory
- use an absolute path if you want the database file outside the workspace

### 7.4 Only verify CLI availability

Windows PowerShell:

```powershell
pnpm --filter mcp-swagger-server run cli:help
```

### 7.5 PowerShell blocks npm script execution

Symptoms:

- `npm.ps1` cannot be loaded because running scripts is disabled

Use one of these:

```powershell
npm.cmd -v
npm.cmd test
```

or:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Ubuntu:

```bash
pnpm --filter mcp-swagger-server run cli:help
```

### 7.6 Verify streamable multi-session behavior

Use this when validating the regression that previously blocked a second Streamable HTTP session.

From repository root:

```bash
pnpm --filter mcp-swagger-server run test:streamable-session
```

This smoke test verifies:

- first `initialize` succeeds
- second independent `initialize` also succeeds
- both sessions receive different `Mcp-Session-Id` values
- both sessions can complete `tools/list`

## 8. Current Baseline

Currently verified:

- API build passes
- UI build passes
- API can initialize with `DB_TYPE=sqlite`
- API defaults to SQLite when `DB_TYPE` is unset
- API can still be configured for PostgreSQL
- API docs path is `http://localhost:3001/api/docs`
- CLI can be built and started from the local workspace
- `pnpm --filter mcp-swagger-server run test:cli` passes
- `pnpm --filter mcp-swagger-server run test:smoke` passes
- `pnpm --filter mcp-swagger-server run test:streamable-session` passes
- parser propagation can be re-verified with `pnpm run verify:parser-chain`

If other documents conflict with this file, use this file as the active setup baseline.
