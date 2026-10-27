# ADR-004: Magic link handling

## Status
Accepted

## Context
Some links are bare filenames assumed to be unique.

## Decision
A bare filename resolves to the unique matching file. If multiple files share
the name, use the lexicographically smallest full path and log a warning.

## Consequences
- Predictable fallback behavior.
- Ambiguous links are visible to users.
