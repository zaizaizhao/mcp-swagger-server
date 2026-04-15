# Database Mode Quickstart

This project supports two database modes:

- `SQLite`: default, simplest local path
- `PostgreSQL`: optional, stronger operational path for heavier deployment

They are complementary modes, not replacement relationships.

## SQLite

Use SQLite when you want the fastest single-machine setup.

Example `packages/mcp-swagger-api/.env`:

```env
NODE_ENV=development
PORT=3001
MCP_PORT=3322

DB_TYPE=sqlite
DB_SQLITE_PATH=data/mcp-swagger.db

JWT_SECRET=change-this-jwt-secret
JWT_REFRESH_SECRET=change-this-refresh-secret
API_KEY=change-this-api-key
```

Start:

```bash
pnpm --filter mcp-swagger-api run build
node packages/mcp-swagger-api/dist/src/main.js
```

Notes:

- if `DB_TYPE` is omitted, the API still defaults to SQLite
- startup logs should print `Database mode: sqlite`
- this is the recommended baseline for local development and light-load use

## PostgreSQL

Use PostgreSQL when you need a stronger long-running deployment posture.

Create the database:

Windows PowerShell:

```powershell
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE mcp_swagger_api;"
```

Ubuntu:

```bash
sudo -u postgres psql -c "CREATE DATABASE mcp_swagger_api;"
```

Example `packages/mcp-swagger-api/.env`:

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
```

Notes:

- startup logs should print `Database mode: postgres`
- PostgreSQL is recommended for heavier write volume and multi-user operation

## Product Guidance

Choose SQLite when:

- the service is deployed on a single machine
- write volume is light
- simplicity matters more than shared concurrency

Choose PostgreSQL when:

- the service is expected to run long term
- multiple operators or higher write concurrency are expected
- stronger operational isolation and recovery behavior are needed

## Concurrency Position

SQLite is acceptable for the current small-scale single-machine path, especially when simplicity is the priority.

PostgreSQL remains the better choice when concurrency, operational durability, and heavier background activity become more important.
