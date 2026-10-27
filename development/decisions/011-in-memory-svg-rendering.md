# ADR-011: In-memory DOM-based SVG rendering

## Status
Accepted

## Context
The previous `textmapper.ts` used `require('fs')`, `require('os')`, and
`require('path')` to write temporary files and invoke a Node.js CLI. This made
the feature desktop-only, prevented mobile use, and introduced an implicit
dependency on the npm `text-mapper` package that is separate from the
community plugin.

## Decision
SVG output is produced entirely in memory. `TextMapperParser.svg(element)` is
called with an off-screen `HTMLElement`; the resulting `innerHTML` is captured
as the SVG string. No files are written to disk and no Node.js built-in modules
are used. The plugin manifest must declare `isDesktopOnly: false`.

## Consequences
- Rendering works on iOS and Android Obsidian clients.
- The npm `text-mapper` package is no longer a build dependency.
- Tests can exercise the parser by providing a minimal stub `HTMLElement`
  without needing a real browser.
