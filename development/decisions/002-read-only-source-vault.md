# ADR-002: Read-only source vault

## Status
Accepted

## Context
Compilation must never damage original notes.

## Decision
Treat source vault files as read-only. Write only to the configured compiled
master file and adjacent `assets/` directory. Require confirmation before
overwriting existing configured output.

## Consequences
- Source hashes can be used as a safety guard.
- Output location must be validated carefully.
