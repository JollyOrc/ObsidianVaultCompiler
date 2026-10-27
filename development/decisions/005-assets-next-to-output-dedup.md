# ADR-005: Asset location and deduplication

## Status
Accepted

## Context
Compiled documents should be portable without duplicating media.

## Decision
Create `assets/` next to the compiled output. Deduplicate by resolved absolute
source path. Use `_1`, `_2`, ... suffixes for different files with the same
basename.

## Consequences
- Portable output.
- Requires careful path and collision handling.
