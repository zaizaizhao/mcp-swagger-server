# Guides

This directory contains active operational and usage-oriented documentation for the current product baseline.

## Active Guides

- [database-mode-quickstart](./database-mode-quickstart.md)
- [database-strategy](./database-strategy.md)
- [local-setup-and-run](./local-setup-and-run.md)
- [parser-change-verification](./parser-change-verification.md)
- [release-readiness-checklist](./release-readiness-checklist.md)
- [current-convergence-plan](./current-convergence-plan.md)
- [next-phase-development-plan](./next-phase-development-plan.md)
- [github-collaboration-workflow](./github-collaboration-workflow.md)
- [endpoint-semantic-layer-requirements](./endpoint-semantic-layer-requirements.md)
- [lightweight-api-access-management-requirements](./lightweight-api-access-management-requirements.md)

## Guide Inclusion Rule

A guide belongs here only if it describes a currently supported product path or a currently required engineering workflow.

If a guide becomes stale, historical, or too drifted from the current baseline, move it into `docs/archive` instead of leaving it in the active set.

## Current Narrow Baseline

The active guide set is intentionally narrow during product convergence.

It should primarily cover:

- setup and run
- database mode selection
- parser-change verification
- release verification
- current planning and engineering workflow

Feature-specific experiments, release notes, troubleshooting deep dives, and historical implementation guides should live in `docs/archive/guides`.
