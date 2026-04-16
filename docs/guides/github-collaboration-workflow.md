# GitHub Collaboration Workflow

## Purpose

This document defines the recommended Git and GitHub workflow for this repository under the current operating model:

- this repository remains a downstream project of `upstream`
- `origin` is the working fork used for day-to-day delivery
- `upstream` should continue to be tracked and reviewed regularly
- valuable changes should still be split and submitted upstream when appropriate

This is the default collaboration baseline for this repository unless a future governance document replaces it.

## Working Model

Use this model:

- `origin/main` is the working mainline for this downstream repository
- `upstream/main` remains the canonical upstream line that should continue to be tracked
- feature work is always done on feature branches
- releases are always cut from `main`
- upstream PRs should stay small, narrow, and reviewable

Do not use this model:

- do not stack long-running product work directly on `upstream/main`
- do not put experimental architecture work directly on `main`
- do not let waiting for upstream review stall necessary local stabilization work

## Remote Roles

In this repository:

- `origin`: your fork, fully controlled by you
- `upstream`: the original project, used for reference and optional contribution

Check remotes:

```bash
git remote -v
```

Expected meaning:

- `origin` should point to your repository
- `upstream` should point to the source project

## Branch Rules

### Main branches

- `main`
  Your product mainline. Stable, releasable, and taggable.

- optional `integration/upstream-sync`
  Temporary integration branch used only when testing upstream sync or conflict resolution.

### Working branches

- `feature/<topic>`
  New features, refactors, architecture changes, product evolution.

- `fix/<topic>`
  Bug fixes or release blockers.

- `release/<version>`
  Optional release preparation branch when you want final polish before merge to `main`.

### PR branches

If you want to send code upstream, prefer a small dedicated branch:

- `feature/upstream-<topic>`

That branch should contain only the minimal changes intended for upstream review.

## Core Policy

### Policy 1: downstream delivery should stay compatible with upstream collaboration

If upstream is inactive or does not accept a PR:

- continue shipping from `origin/main`
- keep your own tags and releases moving
- treat upstream contribution as optional value, not as a release gate

### Policy 2: upstream PRs must be small

Do not send large mixed product branches upstream.

Upstream PRs should usually contain only one of:

- one bug fix
- one documentation improvement
- one narrow compatibility improvement
- one small refactor with clear value

### Policy 3: main stays releasable

Before merging to `main`:

- build should pass
- key tests should pass
- docs should reflect the actual runtime behavior
- no local `.env`, logs, or temp files should be committed

## Daily Workflow

## 1. Start from product mainline

Update your local `main` from your own remote:

```bash
git checkout main
git pull origin main
```

If you also want the latest upstream reference:

```bash
git fetch upstream
```

Do not merge upstream into `main` automatically. Review first.

## 2. Create a feature branch

Example:

```bash
git checkout -b feature/sqlite-ops-hardening
```

Work only in that branch.

## 3. Commit in small logical chunks

Example:

```bash
git add <files>
git commit -m "feat: harden sqlite runtime behavior"
```

Prefer multiple clean commits over one mixed commit.

## 4. Push to your fork

```bash
git push origin feature/sqlite-ops-hardening
```

## 5. Merge to product mainline

After review and verification:

```bash
git checkout main
git merge --no-ff feature/sqlite-ops-hardening
git push origin main
```

## Release Workflow

Release from `main`.

Example:

```bash
git checkout main
git pull origin main
git tag -a v0.2.15 -m "release: v0.2.15"
git push origin main
git push origin refs/tags/v0.2.15
```

If you use GitHub Release:

```bash
gh release create v0.2.15 --repo <your-org-or-user>/<repo> --title "v0.2.15" --notes "Release notes here"
```

## Upstream Contribution Workflow

Use a separate branch for upstream PR work.

Do not send your long-running product branch directly if it contains unrelated product-only changes.

### 1. Create a minimal upstream branch from current main

```bash
git checkout main
git pull origin main
git checkout -b feature/upstream-openapi-doc-fix
```

### 2. Keep only the intended upstream change

This branch should contain:

- the exact fix or doc change
- no product-only release work
- no unrelated architecture changes

### 3. Push to origin

```bash
git push origin feature/upstream-openapi-doc-fix
```

### 4. Create PR to upstream

Example:

```bash
gh pr create \
  --repo <upstream-owner>/<repo> \
  --base main \
  --head <your-owner>:feature/upstream-openapi-doc-fix \
  --title "fix: narrow title here" \
  --body "Summary and verification"
```

## Upstream Sync Workflow

Because upstream is not your primary delivery dependency, do not sync directly into `main` without review.

Recommended process:

### 1. Fetch upstream

```bash
git fetch upstream
```

### 2. Create a temporary sync branch from your current main

```bash
git checkout main
git pull origin main
git checkout -b integration/upstream-sync-2026-04
```

### 3. Merge upstream main into the sync branch

```bash
git merge upstream/main
```

### 4. Resolve conflicts, build, and test

Typical checks:

```bash
pnpm --filter mcp-swagger-api run type-check
pnpm --filter mcp-swagger-api run build
pnpm --filter mcp-swagger-ui run build
pnpm --filter mcp-swagger-server run build
```

### 5. Decide whether to absorb

If the sync result is good:

```bash
git checkout main
git merge --no-ff integration/upstream-sync-2026-04
git push origin main
```

If the sync result is not worth the cost:

- keep your current `main`
- delete the temporary sync branch
- postpone upstream absorption

## Conflict Handling Rules

When your branch conflicts with upstream:

### Case 1: upstream fixes a real bug in the same area

Preferred approach:

- preserve the upstream bug fix
- re-apply your product-specific logic on top

### Case 2: upstream changes architecture but your product path diverges

Preferred approach:

- do not force immediate convergence
- isolate the upstream sync on a temporary branch
- decide whether the architectural sync is worth the regression risk

### Case 3: your product direction is intentionally different

Preferred approach:

- keep your implementation on `origin/main`
- document the divergence
- avoid pretending the codebases are still identical

## Local Branch Cleanup

You can safely delete a local branch after it is merged into `main`.

Example:

```bash
git branch -d feature/sqlite-ops-hardening
```

This does not affect:

- `origin/main`
- `upstream`
- any open PR

Important:

- deleting a local branch is safe
- deleting the remote branch that backs an open PR can affect that PR

## Required Hygiene

Never commit:

- `.env`
- local development secrets
- runtime logs
- PID files
- temporary generated JSON or scratch files

Before commit:

```bash
git status --short
```

Before release:

```bash
pnpm --filter mcp-swagger-api run type-check
pnpm --filter mcp-swagger-api run build
pnpm --filter mcp-swagger-ui run build
pnpm --filter mcp-swagger-server run build
```

## Recommended Command Set For This Project

### Check remotes

```bash
git remote -v
```

### Sync your product mainline

```bash
git checkout main
git pull origin main
```

### Start a feature

```bash
git checkout -b feature/<topic>
```

### Push a feature branch

```bash
git push origin feature/<topic>
```

### Merge to your mainline

```bash
git checkout main
git merge --no-ff feature/<topic>
git push origin main
```

### Prepare an upstream sync branch

```bash
git fetch upstream
git checkout main
git pull origin main
git checkout -b integration/upstream-sync-<date>
git merge upstream/main
```

### Open an upstream PR

```bash
gh pr create \
  --repo zaizaizhao/mcp-swagger-server \
  --base main \
  --head joe-ieta:feature/<topic> \
  --title "<title>" \
  --body "<body>"
```

### Release from main

```bash
git checkout main
git pull origin main
git tag -a v<version> -m "release: v<version>"
git push origin main
git push origin refs/tags/v<version>
```

## Recommended Operating Pattern For You

Given your current situation, use this pattern:

1. Maintain `origin/main` as the actual product mainline.
2. Use `feature/*` for product work.
3. Use `integration/upstream-sync-*` only when you intentionally evaluate upstream changes.
4. Use dedicated small branches for upstream PRs.
5. Do not let upstream acceptance block your product release rhythm.
6. Keep the ability to contribute upstream, but do not design your whole development flow around that outcome.

This is the most stable balance between:

- independent product delivery
- low-cost upstream compatibility
- manageable Git history
- practical future collaboration
