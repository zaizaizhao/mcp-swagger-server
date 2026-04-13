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

Ubuntu:

```bash
pnpm --filter mcp-swagger-server run cli:help
```

## 8. Current Baseline

Currently verified:

- API build passes
- UI build passes
- API can initialize with `DB_TYPE=sqlite`
- API defaults to SQLite when `DB_TYPE` is unset
- API can still be configured for PostgreSQL
- API docs path is `http://localhost:3001/api/docs`
- CLI can be built and started from the local workspace

If other documents conflict with this file, use this file as the active setup baseline.
