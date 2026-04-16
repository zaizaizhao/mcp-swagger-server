# Documentation Index

## Purpose

This directory separates current-use documentation from archived historical material.

Use this index as the documentation entry point. Do not treat archived plans, old implementation notes, or completion summaries as the current project baseline.

The current top-level governance documents remain at repository root:

- [README](../README.md)
- [PRODUCT_CONSTRAINTS](../PRODUCT_CONSTRAINTS.md)
- [PROJECT_BASELINE](../PROJECT_BASELINE.md)
- [RELEASE_BASELINE_V1](../RELEASE_BASELINE_V1.md)
- [PROJECT_ANALYSIS_AND_V1_PLAN](../PROJECT_ANALYSIS_AND_V1_PLAN.md)

## Current Active Documents

### Baseline and setup

- [Database Mode Quickstart](./guides/database-mode-quickstart.md)
- [Database Strategy](./guides/database-strategy.md)
- [Local Setup And Run](./guides/local-setup-and-run.md)
- [Parser Change Verification](./guides/parser-change-verification.md)
- [Release Readiness Checklist](./guides/release-readiness-checklist.md)

### Planning and governance

- [Current Convergence Plan](./guides/current-convergence-plan.md)
- [Fork Origin And Independence](./guides/fork-origin-and-independence.md)
- [Next Phase Development Plan](./guides/next-phase-development-plan.md)
- [Endpoint Semantic Layer Requirements](./guides/endpoint-semantic-layer-requirements.md)
- [Lightweight API Access Management Requirements](./guides/lightweight-api-access-management-requirements.md)
- [Open Items](./reference/open-items.md)
- [Versioning Policy](./reference/versioning-policy.md)
- [GitHub Collaboration Workflow](./guides/github-collaboration-workflow.md)

## Archive

Historical documents live under:

- [archive](./archive/README.md)

Use archive for:

- superseded plans
- historical release notes
- obsolete guides
- exploratory design material
- prototypes and implementation history

Examples now treated as archive material:

- release-specific notes
- troubleshooting deep dives that do not define the current baseline
- feature-specific implementation guides that are no longer part of the active operator path

## Reading Order

For current product work, start here:

1. repository root governance documents
2. `docs/guides`
3. `docs/reference`
4. package-level README files when working within a specific package

Only use `docs/archive` when you need implementation history or decision background.
