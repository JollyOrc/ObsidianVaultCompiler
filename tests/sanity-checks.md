# Sanity checks for compiled output

These checks validate the overall shape of a compiled vault without testing every
individual transformation. They are expected to run after integration tests and
may be used as smoke-level release gates.

## S-1 Compiled file size sanity

- Discover all markdown files reachable from the starting file.
- Sum their byte sizes.
- Measure the compiled master file size.
- Assert:
  `compiledSize >= 0.9 * sourceMarkdownSize`
  `compiledSize <= 1.1 * sourceMarkdownSize`
- Failure indicates missing includes, excessive expansion, or unresolved
  circular-dependency handling.

## S-2 Asset count sanity

- Count unique referenced non-markdown assets across all reachable markdown files.
- Count files actually present in the output `assets/` directory.
- Calculate the expected asset count after deduplication and filename collision
  handling.
- Assert:
  `assetsCount >= deduplicatedReferenceCount`
  `assetsCount <= deduplicatedReferenceCount + collisionSuffixCount`
- Failure indicates duplicate copies, missed copies, or incorrect collision
  handling.

## S-3 Asset reference sanity

- Parse the compiled master file for `assets/...` references.
- Assert every referenced asset exists on disk.
- Assert no duplicate basename in `assets/` except documented `_1`, `_2`, ...
  collision suffixes.
- Assert no dangling `assets/` path remains.

## S-4 Heading sanity

- Count markdown headings in all source files.
- Count headings in compiled output.
- Assert compiled heading count is within 20% of the expected count after
  auto-heading generation.
- Failure may indicate dropped headings or duplicate auto-headings.

## S-5 Media no-loss sanity

- Count source references to images, PDFs, audio and video.
- Ensure each source reference has either a copied asset or a permitted warning
  comment in the compiled output.
- No media reference should silently disappear.

## S-6 Control-command sanity

- Search compiled output for known Obsidian control fence markers.
- Assert none are present.

## S-7 Internal link sanity

- Parse original markdown files for in-text links to `.md` files.
- Parse compiled output for corresponding `#slug` anchor links.
- Assert every converted source link has a matching anchor target in the compiled
  output.
- Assert no broken internal anchor reference remains.
- Allow expected count differences only for missing-file warnings.

## S-8 Vault mutation sanity

- Hash all source vault files before and after compilation.
- Assert no source file changes.
- Assert no new files exist in the source vault except configured output paths.

## Notes

These checks are intentionally coarse-grained. They should not replace detailed
unit and integration tests, but they quickly detect severe compilation failures.
