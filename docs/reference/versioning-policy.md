# Versioning Policy

## Purpose

This document defines the current versioning rule for the repository, package releases, and release tags.

The project already contains historical version identifiers from different stages. This policy is intended to stop further drift before the next product increment.

## Current Reality

The repository currently contains multiple version lines:

- repository-level release tags such as `v0.2.x`
- package versions such as `1.7.0`
- package versions such as `1.0.0`
- historical tag `v1.7.1`

This means version values are not yet governed by a single rule.

## Effective Rule From Now On

Until a full changeset-based release flow is enforced, use this rule:

1. Repository release tags are the product release identifier.
2. Package `version` fields are package-internal publication identifiers.
3. Product release notes, operator docs, and release announcements must use the repository release tag as the primary displayed version.
4. Package README files should avoid implying that package `version` fields are the same thing as the product release version.

## Product Version Source of Truth

For product-facing communication, use:

- Git tag

Examples:

- `v0.2.14`
- future product releases such as `v0.2.15`

When writing:

- root release notes
- release summaries
- deployment notes
- upgrade notes

the Git tag is the source of truth.

## Package Version Source of Truth

For package publishing and package artifact metadata, use:

- each package `package.json` `version`

This applies to:

- npm publication metadata
- package tarball metadata
- downstream package consumers

## Required Documentation Behavior

When a document is product-facing:

- prefer the Git tag
- do not mix Git tag and package version on the same heading line unless both are explicitly explained

When a document is package-facing:

- package version may be shown
- product release tag may be referenced separately if relevant

## Release Checklist Requirement

Before each product release:

1. confirm the intended Git tag
2. confirm whether any package version changes are required
3. ensure release notes use the Git tag consistently
4. ensure package README files do not introduce conflicting version wording

## Follow-Up Work

This policy is transitional.

A later release phase should decide one of these directions:

- fully align package versions with product release versions
- keep separate package versions, but automate the mapping in the release workflow

Until then, do not introduce new ad hoc version naming rules.
