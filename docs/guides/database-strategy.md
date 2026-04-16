# ?????

## ??

This project will support two database modes as first-class product paths:

- `SQLite`: default mode for single-machine, light-load, low-friction deployment
- `PostgreSQL`: recommended mode for production, multi-user, higher write volume, and long-running operation

These two modes are not replacements for each other. They serve different operating scenarios under one product architecture.

## ????

### SQLite ??

Use `SQLite` when the goal is:

- zero external database dependency
- fast local setup on Windows and Ubuntu
- demo, evaluation, personal use, or single-team low-load deployment
- single-instance API deployment

SQLite mode should be the default out-of-box experience.

### PostgreSQL ??

Use `PostgreSQL` when the goal is:

- long-running stable production deployment
- multi-user operation
- higher background write volume
- richer operational safety margin
- future horizontal expansion

PostgreSQL remains the primary heavy-duty deployment option.

## ????

The following constraints are project-level rules for all future database work:

1. Database support must be configuration-driven, not hard-coded to a single engine.
2. Default installation must run without requiring an external database service.
3. Long-running stability and reliability take precedence over short-term implementation convenience.
4. High-frequency runtime data writes must be controlled through retention, throttling, sampling, batching, or feature flags.
5. SQLite mode is a supported product path, not a temporary dev-only hack.
6. PostgreSQL mode must retain full production viability and must not be degraded to fit SQLite.
7. Any database-specific capability must be isolated behind explicit compatibility rules.

## ?????

This project is not a short-lived test harness. It manages MCP server configuration, startup, health checking, logs, and operational state over long runtimes.

That means database strategy must be evaluated against:

- service continuity
- crash recovery
- write amplification
- long-term file growth
- data retention
- operational observability
- upgrade safety

Database simplification is acceptable only if it does not undermine those qualities.

## ????????

The current system stores both low-frequency configuration data and higher-frequency operational data.

### ????

Examples:

- users, roles, permissions
- OpenAPI documents
- MCP server definitions
- auth configuration
- AI assistant templates and configuration

This category is a good fit for either SQLite or PostgreSQL.

### Higher-frequency data

Examples:

- process logs
- system logs
- health check history
- process runtime metrics
- audit logs

This category is where database-mode tradeoffs become important.

## SQLite Capability Assessment

SQLite is viable for this project under controlled assumptions.

### What SQLite does well

- simple installation and backup
- single-file persistence
- good read performance
- acceptable performance for light concurrent access
- strong fit for single-node product packaging

### What SQLite does not do well

- sustained concurrent write-heavy workloads
- multi-instance shared-database deployment
- uncontrolled log/event ingestion
- large operational history without cleanup policies

### Practical judgment for this project

SQLite is appropriate when:

- one API instance is running
- the number of managed MCP servers is small
- runtime logs are moderate
- health checks are not extremely frequent
- retention and cleanup are enabled

SQLite becomes risky when:

- many MCP servers are managed at once
- stdout/stderr logs are continuously persisted
- multiple users are operating the UI heavily
- monitoring and audit data are stored at high frequency
- the system is expected to scale beyond a single host

## Impact on MCP Server Service Capability

The MCP servers themselves are not directly limited by SQLite in the same way a request-processing database-backed application would be.

The main database pressure comes from the management plane:

- metadata persistence
- process status updates
- health check records
- log persistence
- audit and monitoring records

So the main risk is not that MCP tools stop existing. The risk is that the management platform becomes slower, more fragile, or more lock-prone under write-heavy runtime conditions.

## Recommended Product Policy

The recommended product policy is:

- default database: `SQLite`
- production recommendation: `PostgreSQL`
- deployment guidance must clearly state the boundary between the two

This should be documented in installation, deployment, and release materials, not left implicit.

## Required Compatibility Strategy

The current codebase is PostgreSQL-oriented. Supporting both engines requires deliberate compatibility work.

### Areas that require change

- database bootstrap configuration
- TypeORM datasource setup
- environment schema and examples
- migrations
- entity column types
- runtime write policies
- setup and deployment documentation

### Current PostgreSQL coupling that must be addressed

Examples already present in the codebase include:

- `type: 'postgres'` hard-coded in datasource setup
- `jsonb` column usage
- PostgreSQL UUID defaults and enum definitions in migrations
- PostgreSQL-oriented migration SQL
- operational data patterns that assume stronger concurrent write handling

## Compatibility Rules

To keep the design product-grade, the following compatibility rules should be adopted:

1. Introduce `DB_TYPE=sqlite|postgres`.
2. Default `DB_TYPE` to `sqlite`.
3. Use a dedicated SQLite file path such as `data/app.sqlite`.
4. Treat SQLite as single-instance only.
5. Avoid database-specific SQL in shared service logic.
6. Restrict database-specific behavior to datasource, migration, and compatibility helpers.

Note:

- WAL and busy-timeout tuning are valid SQLite concerns, but they are not currently active in the `sql.js` implementation path and must not be documented as effective runtime switches until a driver path actually supports them.

## Reliability Requirements for SQLite Mode

SQLite mode is only acceptable if the following runtime protections are added:

- log retention limits
- health check history cleanup
- optional sampling or throttling for process log persistence
- optional reduction of metrics write frequency
- bounded audit/history growth
- startup self-check for database file path and writability
- corruption-aware backup and recovery guidance

The current implementation has already added startup validation for the SQLite file path and parent directory writability.

Without those protections, SQLite will make installation easier but operation less reliable over time.

## Reliability Requirements for PostgreSQL Mode

PostgreSQL mode should remain the reference path for heavier use and should preserve:

- stronger concurrent write tolerance
- better operational headroom
- clearer multi-user production posture
- easier future multi-instance evolution

The SQLite path must not force PostgreSQL down to the lowest common denominator in areas where production robustness matters.

## Proposed Rollout

### Phase 1: design and compatibility inventory

- identify PostgreSQL-specific entity fields and migrations
- define cross-database type mappings
- define runtime behavior differences by database mode

### Phase 2: configuration abstraction

- add `DB_TYPE`
- add `DB_SQLITE_PATH`
- keep PostgreSQL variables active for `postgres` mode
- update env validation and examples

### Phase 3: datasource and migration support

- make datasource selection conditional
- add SQLite-capable initialization path
- separate or rebuild migrations to support both engines cleanly

### Phase 4: runtime write hardening

- reduce unnecessary write frequency
- add cleanup and retention defaults
- make high-volume persistence configurable

### Phase 5: product documentation

- default install path uses SQLite
- production install path recommends PostgreSQL
- explicitly document operating boundaries

## Acceptance Criteria

This feature should be considered product-ready only when:

- a fresh install can start with SQLite without external services
- PostgreSQL mode still works as a supported production path
- the API can run stably for extended periods in SQLite mode under light load
- log and health-check growth are bounded
- Windows and Ubuntu setup paths are both documented and verified

## Non-Goals

The following are not goals of this change:

- replacing PostgreSQL as the production recommendation
- treating SQLite and PostgreSQL as identical in scaling behavior
- supporting multi-node shared deployment on SQLite
- preserving every PostgreSQL-specific optimization unchanged

## Decision

Proceed with dual database support.

Adopt `SQLite` as the default packaging and low-friction deployment mode.

Retain `PostgreSQL` as the recommended production mode for heavier operational scenarios.

## Current Validation Snapshot

Verified on April 16, 2026 against the pulled current baseline:

- runtime defaults to `SQLite` when `DB_TYPE` is omitted
- PostgreSQL mode activates only when `DB_TYPE=postgres` is set explicitly
- a clean PostgreSQL rebuild of `mcp_swagger_api` completed successfully
- API startup in PostgreSQL mode completed with automatic schema creation and seed initialization
- recreated PostgreSQL schema contains 19 public tables, including `endpoint_probe_logs`
- recreated seed data includes 27 permissions, 5 roles, and 1 super admin user
- `pnpm type-check` passed under PostgreSQL mode
- `pnpm test` passed under PostgreSQL mode
