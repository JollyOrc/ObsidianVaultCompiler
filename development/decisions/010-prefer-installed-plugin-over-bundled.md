# ADR-010: Prefer installed text-mapper plugin over bundled fallback

## Status
Accepted

## Context
The `text-mapper` Obsidian community plugin contains a pure-TypeScript parser
(`TextMapperParser`) that works in-process without Node.js. Bundling a copy of
this parser into the Vault Compiler would duplicate maintenance and could drift
out of sync with the version the user already has installed.

## Decision
At runtime the compiler checks `app.plugins.plugins['text-mapper']` first. If
the plugin is loaded it uses that instance's `TextMapperParser` directly. Only
when the installed plugin is absent does it fall back to the bundled copy of
the parser. The compiler never monkey-patches or modifies the community plugin.

## Consequences
- Users who already have `text-mapper` installed get rendering results
  identical to the plugin's own previews.
- The bundled fallback is a maintenance obligation that must be updated when
  breaking changes land in the upstream parser.
- Version of the bundled parser must be recorded in `dependencies.md`.
