# Database Mode Quickstart

## Default mode: SQLite

The API now defaults to `DB_TYPE=sqlite`.

Use this for:

- local development
- single-machine deployment
- light operational load
- low-friction evaluation

Example `packages/mcp-swagger-api/.env`:

```env
NODE_ENV=development
PORT=3001
MCP_PORT=3322

DB_TYPE=sqlite
DB_SQLITE_PATH=data/mcp-swagger.db

JWT_SECRET=change-this-jwt-secret
API_KEY=change-this-api-key
```

Build and run:

```bash
pnpm --filter mcp-swagger-api run build
node packages/mcp-swagger-api/dist/src/main.js
```

## Production-capable mode: PostgreSQL

Use this for:

- long-running production deployment
- multi-user operation
- higher write volume
- heavier log and monitoring load

Example `packages/mcp-swagger-api/.env`:

```env
NODE_ENV=production
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
```

Create the database if needed:

Windows PowerShell:

```powershell
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE mcp_swagger_api;"
```

Ubuntu:

```bash
sudo -u postgres psql -c "CREATE DATABASE mcp_swagger_api;"
```

## Current implementation note

The current SQLite path is implemented with TypeORM `sql.js` persistence, still exposed as product-level `sqlite` mode.

This is suitable for the single-machine default path. PostgreSQL remains the recommended option for heavier and longer-running production use.

SQLite path validation is active at startup. WAL and busy-timeout tuning are not exposed as active runtime switches in the current `sql.js` path and should not be assumed to be in effect.
