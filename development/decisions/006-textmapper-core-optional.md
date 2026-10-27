# ADR-006: TextMapper as core but toggleable

## Status
Accepted

## Context
TextMapper diagrams are important, but rendering depends on another community
plugin.

## Decision
TextMapper rendering is a core feature using the installed
`obsidian-text-mapper` plugin. It may be disabled in settings. Failed, missing
or disabled rendering preserves the original block with a warning, while
successful replacement targets `assets/textmapper/`.

## Consequences
- Core behavior is documented.
- Plugin dependency must be checked gracefully.
