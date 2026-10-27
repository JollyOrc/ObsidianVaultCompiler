# ADR-003: Obsidian-first link resolution

## Status
Accepted

## Context
Obsidian has richer path, alias and metadata resolution than a custom search.

## Decision
Resolve links through Obsidian's metadata/cache first. Use deterministic
fallback search only when Obsidian cannot resolve.

## Consequences
- Behavior matches Obsidian for most links.
- Fallback remains necessary for edge cases.
