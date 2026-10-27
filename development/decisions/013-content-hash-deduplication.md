# ADR-013: Content hash as TextMapper deduplication key

## Status
Accepted

## Context
A vault may contain many notes that embed the same text-mapper block (e.g. a
shared region map). Rendering the same map multiple times wastes time and
produces identical asset files with different names, bloating the output folder.

## Decision
Before calling the renderer, the compiler computes a content hash of the
trimmed source text using `computeContentHash()` from `utils.ts`. If that hash
has already been rendered during the current compile run the compiler reuses the
existing asset path and skips the render call. Deduplication is tracked in
`stats.mapsDeduplicated`. The hash is also used as the filename stem so
identical blocks across different files resolve to the same asset.

## Consequences
- Identical maps render exactly once per compile run regardless of how many
  files reference them.
- Trailing-whitespace differences in source do not produce duplicate renders.
- `stats.mapsRendered` and `stats.mapsDeduplicated` are added to `CompileResult`
  to make this visible to the user.
