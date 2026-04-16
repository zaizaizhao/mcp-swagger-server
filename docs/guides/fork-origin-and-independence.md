# Fork Origin And Independence

## Purpose

This document records the origin of this repository, the product-positioning shift that has already happened, and the working rule for the relationship with the original upstream repository.

It exists to prevent collaboration drift, positioning drift, and confusion about whether this repository is still trying to stay functionally aligned with the original project.

## Origin

This repository started from the original `mcp-swagger-server` upstream project.

The original repository provided a strong initial design for:

- OpenAPI / Swagger parsing
- MCP tool generation
- runnable MCP server exposure
- a fast path for turning API specifications into MCP-compatible tooling

That upstream work created the technical foundation from which this repository evolved.

This repository explicitly acknowledges that origin and thanks the original author and contributors for the quality of the initial design and implementation direction.

## Current Position

This repository is no longer positioned only as a fast OpenAPI-to-MCP conversion demo or a lightweight technical showcase.

It is now positioned as a product-oriented API Gateway and API-to-MCP platform, with the goal of providing an operable MCP Gateway application form.

That means the working focus has shifted toward:

- stable operator workflows
- long-running service reliability
- CLI / API / UI consistency
- persistence and environment strategy
- management and monitoring surfaces
- release readiness
- Windows and Ubuntu operational compatibility

## Why Independent Development Starts Here

The current repository has already accumulated substantial divergence from the original upstream in:

- product scope
- runtime management expectations
- database strategy
- operator-facing backend and UI surfaces
- release and documentation baseline

Because of that divergence, keeping this repository tightly coupled to the upstream project would now create more confusion than value.

This repository will therefore continue as an independently developed product line.

## Relationship With Upstream

The upstream repository remains important as:

- the original project source
- a design reference
- a possible source of selective ideas or reusable fixes

But upstream is no longer treated as the controlling baseline for this repository.

Working rule:

- `origin/main` is the only active product baseline
- upstream is reference-only
- upstream changes are adopted only by explicit review and selective integration
- this repository does not aim to remain behaviorally identical to upstream

## Practical Git Policy

This repository uses the following fork policy:

- keep `origin` as the active development remote
- keep `main` as the primary product branch
- treat upstream as a read-only reference remote
- do not routinely merge or rebase from upstream
- only import upstream work intentionally, case by case

Recommended usage:

```powershell
git fetch upstream --prune
git log --oneline main..upstream/main
git cherry-pick <commit-id>
```

Avoid as routine workflow:

```powershell
git pull upstream main
git merge upstream/main
git rebase upstream/main
```

## Documentation Rule

Project documentation must continue to:

- acknowledge the original project source
- clearly describe the current independent product direction
- avoid implying that this repository is still only a thin mirror of upstream
- keep open items and deferred features visible instead of hiding divergence

## Product Rule

For planning and release decisions, this repository should now be judged by its own product constraints and release baseline, not by whether it remains close to upstream.
