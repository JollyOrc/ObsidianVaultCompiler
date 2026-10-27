# ADR-008: Obsidian control command removal

## Status
Accepted

## Context
Plugin directives are not portable content.

## Decision
Remove only Obsidian plugin control code fences and expand SerializedQuery
sections into embedded content. Leave other markdown syntax intact.

## Consequences
- Avoids stripping legitimate content.
- Requires explicit list of control directives.
