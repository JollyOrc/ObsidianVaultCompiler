# ADR-012: PNG output via canvas rasterization

## Status
Accepted

## Context
Compiled documents need images as portable binary assets, not inline SVG
strings. Inline SVG would also require escaping and would break in output
formats that do not support SVG (e.g. PDF export). The canvas API is available
in both Obsidian desktop and mobile environments.

## Decision
After capturing SVG from the parser the renderer creates an off-screen
`<canvas>`, draws the SVG via an `<img>` element, and calls `toDataURL('image/png')`
to get the PNG bytes. The PNG is written to the asset folder via the Obsidian
Vault adapter. No external image libraries are used.

## Consequences
- Output is a self-contained PNG compatible with all downstream formats.
- Canvas rasterization is synchronous-looking but requires a browser paint
  cycle; the renderer must be async.
- SVG features not supported by the canvas implementation (e.g. some filters)
  may render differently from the live preview.
