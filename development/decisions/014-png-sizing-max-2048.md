# ADR-014: Max-2048 px PNG sizing with aspect-ratio preservation

## Status
Accepted

## Context
The previous implementation rendered every map at a fixed 1024×1024 pixels,
which distorted non-square maps and was too small for large, detailed diagrams.
Text-mapper SVGs carry a `viewBox` attribute (or explicit `width`/`height`)
that encodes the natural aspect ratio.

## Decision
Before rasterizing, the renderer parses the SVG's `viewBox` (or `width`/`height`
attributes) with `parseSvgDimensions()` to obtain natural pixel dimensions.
`computePngDimensions()` then scales those dimensions so the longer side is at
most 2048 px while preserving the exact aspect ratio. If the SVG carries no
dimension information a square 1024×1024 fallback is used.

## Consequences
- Portrait and landscape maps render at correct proportions.
- Very large maps are capped at 2048 px on the long side to avoid enormous
  files.
- Both helper functions are pure and exported so they can be unit-tested
  independently of the DOM.
