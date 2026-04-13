# Documentation Index

## Purpose

This directory now separates current-use documentation from archived historical material.

Use this index as the entry point. Do not treat archived plans, old implementation notes, or completion summaries as the current project baseline.

The current top-level governance documents remain at repository root:

- [README](../README.md)
- [PRODUCT_CONSTRAINTS](../PRODUCT_CONSTRAINTS.md)
- [PROJECT_BASELINE](../PROJECT_BASELINE.md)
- [RELEASE_BASELINE_V1](../RELEASE_BASELINE_V1.md)
- [PROJECT_ANALYSIS_AND_V1_PLAN](../PROJECT_ANALYSIS_AND_V1_PLAN.md)
- [Database Mode Quickstart](./guides/database-mode-quickstart.md)
- [Database Strategy](./guides/database-strategy.md)
- [Local Setup And Run](./guides/local-setup-and-run.md)
- [GitHub Collaboration Workflow](./guides/github-collaboration-workflow.md)
- [Release v0.2.14](./guides/release-v0.2.14.md)

## Setup First

Before running package-level commands, complete environment bootstrap:

1. Install Node.js `>=20`
2. Enable Corepack and activate pnpm
3. Run `pnpm install` at repository root

Primary setup guide:

- [Local Setup And Run](./guides/local-setup-and-run.md)

## Structure

### Current guides

Location:

- [guides](./guides/README.md)

Use for:

- setup
- usage
- deployment
- auth-related operation guides
- troubleshooting on active product paths

### Current reference

Location:

- [reference](./reference/README.md)

Use for:

- release and versioning reference
- module-system notes
- MCP protocol-related reference
- publication and packaging reference

### Archive

Location:

- [archive](./archive/README.md)

Use for:

- historical plans
- superseded proposals
- stage summaries
- old UI design docs
- prototypes and exploratory material

Archived content is kept for traceability, not as the current implementation source of truth.

## Reading Order

For current product work, start here:

1. repository root governance documents
2. `docs/guides`
3. `docs/reference`
4. package-level README files when working within a specific package

Only use `docs/archive` when you need implementation history or decision background.
