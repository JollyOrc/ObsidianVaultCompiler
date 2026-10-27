# ADR-001: Plugin-only delivery

## Status
Accepted

## Context
The tool can run inside Obsidian and has access to its vault and link database.

## Decision
Deliver the compiler as an Obsidian community plugin only. Do not provide a
standalone CLI or Python implementation.

## Consequences
- Simpler vault integration and consistent file APIs.
- Obsidian installation is required.
