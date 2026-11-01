# Quality Gates and Tests for the Obsidian Vault Compiler Plugin

This file defines the quality gates and test coverage required before the
implementation of `userstories.md` is considered complete.

## 1. Quality gates

A change is not complete unless all of the following gates pass:

1. **Type safety** — TypeScript compiles with `strict` mode and no errors.
2. **Build** — `npm run build` produces `main.js` and `manifest.json` without
   warnings that affect plugin loading.
3. **Lint** — ESLint reports no errors; warnings are reviewed and documented.
4. **Unit tests** — All tests in sections 3 and 4 pass.
5. **Integration tests** — All tests in section 5 pass against a fixture vault.
6. **Coverage** — Core modules have at least 85% line coverage; link resolution,
   deduplication, ToC expansion and heading generation have 100% branch
   coverage for documented edge cases.
7. **Vault safety** — Read-only checks in section 7 pass; no source vault file
   hash changes during a full compile.
8. **Manual smoke test** — Section 6 passes in a real Obsidian instance.
9. **Performance gate** — A vault with 1,000 markdown files and 200 assets
   compiles without crashing; TextMapper rendering completes within configured
   timeouts or reports a placeholder failure.

## 2. Test environments

- `unit`: pure functions and small classes, no Obsidian API.
- `integration`: in-memory/fake vault using Obsidian-like file and metadata stubs.
- `e2e-manual`: real Obsidian desktop instance with the fixture vault.
- `fixtures`: test data under `tests/fixtures/`.

## 3. Unit tests

### Epic 0 — Vault context and link resolution
- `resolveAbsoluteLink` resolves vault-root-relative paths.
- `resolveRelativeLink` normalizes `../`, spaces and `%20`.
- `resolveMagicLink` returns the unique matching file.
- `resolveMagicLink` falls back to lexicographically smallest path and warns
  when multiple files match.
- `resolveLinkWithObsidianCache` uses metadata first and only searches when
  Obsidian cannot resolve.
- `resolveOutputLocation` (US-0.3 AC-OL-1 to AC-OL-6,
  `tests/unit/output-location.test.ts`): every row of the AC-OL tables, with
  the values the settings tab, `Browse` and the export prompt really pass
  (empty folder, trailing `/`, absolute folder from the picker, mobile with no
  vault root). The 2026-10-27 case `/Users/user/Desktop` gives an outside
  location and never the vault path `Users/user/Desktop`.
- `vaultRelativeFromAbsolute` (AC-OL-3, AC-OL-7): the vault root, a folder
  under it, and a sibling whose name starts with the vault's name.

### Epic 1 — Core compilation
- Compiling a ToC inserts linked markdown files in order.
- `![[file.md]]` and `![alt](file.md)` both embed file content.
- Circular dependencies emit
  `<!-- Circular dependency avoided: file.md -->`.
- Repeated files are embedded only when required by source/ToC order.
- A nested list of markdown links is expanded as a ToC.
- Nested ToC expansion recurses correctly.

ToC lists (US-1.3, v0.15.1; `tests/integration/toc-lists.test.ts`):
- Both syntaxes expand (the `index2compile.md` shape of 2026-10-27, URL-encoded
  paths, numbered and nested lists, aliases); a list with any other item —
  text, a link with more text, a website, a missing note, a non-note file, an
  anchor-only link (also with a resolver that maps `#Heading` to the current
  note, as Obsidian's may) — stays as written; a blank line ends a list; embed
  items always lose their bullet; nested ToCs; explicit embeds stay links.
- Mutation check 2026-10-27: 9 mutants; two first survived (no test for
  anchor-only items, none for the expanded line itself) — tests added, all
  caught.

Empty lines (US-6.6, v0.16.0; `tests/unit/blank-lines.test.ts`,
`tests/integration/blank-lines.test.ts`):
- Unit: runs of empty and whitespace-only lines, headings of all levels and
  with a tab, tag lines, every kind of block after a heading, two headings,
  code blocks (``` and ~~~, indented, a ``` inside ~~~), start and end.
- Integration: a rule checker over the whole compiled document, both
  "Normalise headings" values, `compile()` and `compileAsync()`.
- Mutation check 2026-10-27: 10 mutants, all caught.

Code blocks are never headings (KD-3, v0.16.1; `tests/integration/code-blocks.test.ts`,
`tests/unit/code-block-mask.test.ts`):
- Examples K-1 to K-7 (section embed, heading-first, preamble, headingless,
  last original heading, section move, toggle off), `~~~` and unclosed
  blocks; `codeBlockMask` and `matchHeading` on their own; a text check that
  the heading pattern and the fence pattern exist only in `utils.ts`.
- Mutation check 2026-10-27: 10 mutants (each site's code-block skip removed,
  the helpers loosened), all caught.
- The example book compiles byte-identical to v0.16.0 (it has no code blocks
  that reach this step).

Code is copied as written (US-1.4, #84, #102; `tests/integration/code-as-written.test.ts`,
written 2026-11-01 before the code):
- AC-1/AC-2: each case measured with v0.19.0 inside a fence (ToC list,
  embed with ``` and ~~~, picture, wiki link, missing link, same-note link,
  markdown note link, a Dataview block shown in a ```` fence) comes out as
  written, with nothing embedded, copied or reported; a map shown in a ````
  fence (already right: guard). A ```` fence with an inner ``` holds a
  `# heading` line (KD-3 helper; unit case in `code-block-mask.test.ts`).
- Inline code: single and double backticks, over two lines of a paragraph
  (H7); guards: a backtick never closed, a blank line ending the paragraph.
- Indented code: the measured rows H1–H6 plus numbered items (seven spaces
  code, six not) and a nested ToC with blank lines; each row checks that the
  embed in it happens or not.
- AC-3 text beside inline code; AC-4 an embed in code for a ToC, a list item
  with inline code (guard), code in an embedded note and a section embed with
  both heading settings, a pass-through target.
- AC-6 (#102): the closing fence at the end of the note with its warning,
  ```` and ~~~ closed with their own fence, a section embed, the root note;
  guard: closed fences unchanged.
- Guard search: the KD-3 text check allows the fence pattern only in
  `utils.ts`; the KD-3 test of an unclosed block checks only that the block's
  start is kept, which AC-6 keeps.
- Before the code: 28 `todo` tests (27 here, 1 unit), all failing on v0.19.0.
- Found while coding (v0.20.0): ToC expansion drops a nested item's bullet
  (`    - [[A]]` → `    ![[A]]`), which then looked like indented code; block
  code is now read before the expansion. With "Normalise headings" off the
  title rule trimmed a note's first line, so indented code at the start of a
  note lost its spaces; only empty lines are trimmed now. A heading or fence
  ends a block, so indented code may follow it (standard markdown; the
  compiler writes titles straight above notes). In the assembled document a
  note's start marker counts as a blank line, its end marker not.
- Mutation check 2026-11-01 (#103): 27 mutants (fence length, the unclosed
  fence found / closed / closed with its length / reported once, each step's
  code skip — control and serializer removal, both pre-scans, ToC, embed
  loop for block and inline code, link conversion, both sanitize passes —,
  the block-code snapshot and its shift, the list rule, the blank line
  before indented code, tab width, inline runs, inline code over lines, the
  heading as block end, lists ending, the provenance lines, US-6.1 trimming).
  Seven first survived: a serializer marker in code, a markdown embed in code
  above a ToC, the root note starting with code, an embed line followed by
  four spaces, a list ended by a paragraph, code right under a heading, and
  (a wrong rule) the end marker counted as blank. Tests added, rule fixed,
  all 27 caught.

Code inside a quote (US-1.4 AC-7, #105; `tests/unit/code-block-mask.test.ts`,
`tests/integration/code-as-written.test.ts`, written 2026-11-01 before the code):
- Unit: `codeBlockMask` with `> ~~~`, `>```` and `> > ````; a change of quote
  depth ends a block; `>` lines inside a block opened outside a quote stay
  code; `unclosedFence` never reports a block its quote ends; `codeLines`
  keeps a block across an empty `>` line.
- Integration: a tilde fence, an empty quote line plus a backtick run, a
  nested quote, a callout, indented code in a quote, a quoted embed line
  inside three-line inline code, inline code (guard), a deeper quote ending
  a paragraph, the quote ending a block (no unclosed warning).
- Before the code: 5 red on v0.20.1; the others passed only because quoted
  backtick runs paired up as inline code.

Embed a note as a quote (US-1.5, #106; `tests/integration/quoted-embed.test.ts`,
written 2026-11-01 before the code):
- AC-1 to AC-11 with the story's examples, both "Normalise headings" values
  where the setting could matter: the measured root (both syntaxes, the
  prefix as written, nested `> >`, a quote line in the quoted note, empty-line
  runs), a callout with a line after the embed, the quote title (prefixed,
  escaped `*` and `_`, headingless), headings as written (last original
  heading, US-6.1 off, no clamp warning), section embeds (both syntaxes, a
  missing heading, a section whose embedded note starts with `# Inner`),
  inner embeds (own title, pass-through and preamble wrappers, a wrapped
  section, circular, missing with its line), ToC lists not expanded, an embed
  item, links (only quoted → US-8.3 warning; converted inside; quoted and in
  a ToC → embedded in full, links to it go to that copy; a quoted heading
  makes no duplicate), frontmatter, images, code, an unclosed block, no
  sentinel or marker and no trailing space, `compileAsync`.
- Guards (green on v0.20.1): a quote line in the root is no heading; an
  image on a quote line keeps US-2.1.
- Smoke book: `Smoke/5 Quotes.md` and `Smoke/Sage sayings.md` (M20); the
  smoke book hashes changed once (line diff in `warnings-once.test.ts`).
- Text check: the quote marker is read only in `utils.ts` (`splitQuote`),
  proven by two mutants (`/^>/`, `/^\s*>/` in `compiler.ts`).
- Before the code: 45 of 47 red on v0.20.1.
- After the quote check in Obsidian (AC-8, 4 tests): links to a note quoted
  and in the book, and a quoted heading as no duplicate; they pass on the
  v0.21.0 code, and a mutant that reads headings past the quote marker in
  the output outline fails all 4.
- Mutation check 2026-11-01: 22 mutants over `splitQuote`, the fence walker,
  `unclosedFence`, `scanCode`, the quote title and its escaping, ToC links in
  quotes, the pre-scan, `quoteLines` (collapse, leading and trailing empties,
  the empty prefix, sentinels), quoted pass-throughs and sections, quote mode
  in both embed passes, missing targets, the inline-code guard, normalisation
  and the heading map. Three first survived (a deeper quote ending a
  paragraph, indented code in a quote, a quoted embed inside inline code);
  tests added, all 22 caught.

### Epic 2 — Asset handling and deduplication
- Images, PDFs, audio, video and generic files are copied to `assets/`.
- Asset reference is rewritten to `assets/filename.ext`.
- A second reference to the same resolved path reuses the destination path.
- Distinct files with the same basename receive `_1`, `_2`, etc.
- Copying the same source twice does not create a second file.
- A log/notice records reuse of an existing asset copy.


Images from the web, titles and image lists (US-2.6, US-1.3 AC-2, #94;
`tests/integration/web-images.test.ts`):
- Web images kept exactly as written, without warning or copy, in nine
  forms (both schemes, upper case, no alt, query, encoded space, angle
  brackets, title, inside a sentence); `![[url]]` and `![[url|200]]`; local
  images with double and single quoted titles, angle brackets, a missing image
  with a title; a note embedded with a title; list items with local, wiki-sized,
  web and missing images, a note and an image in one list.
- Guards: a local image without a title, and a missing note in a list, are
  unchanged.
- Mutation check 2026-10-31 (#96): 7 mutants; two first survived for want of
  an input (a web image without an extension; a note embedded with a title
  above a ToC listing it), tests added, all caught.
- The compiled `index2compile.md` changed once on purpose: its
  `- ![[media.png]]` item keeps the bullet; the output-hash guards of US-8.5
  were updated and the line is asserted.

Anchors Obsidian finds (US-2.3 AC-1 to AC-7, #83, #85;
`tests/integration/obsidian-anchors.test.ts`, written 2026-11-01 before the
code):
- `findInObsidian` models the lookup measured in Obsidian (the table in
  US-2.3): heading text compared case-insensitively, `%` escapes decoded, a
  path `A#B#C` matched against the target's parents nearest first, parents
  skippable; in the heading (not in the link) `#`, `:`, `|`, `^` count as
  spaces. A guard test replays the measured rows A1–A9, B1–B4, C1–C4,
  D1–D10, E3, E7, E8, F1–F6 and G1–G9 against the model, so the model cannot
  drift from the measurement. Its first run with G7 (`%3A`) caught the model
  replacing `:` in the link as well; fixed.
- AC-2: one test per row of the anchor table (thirteen rows); each also
  checks that the model finds every anchor. A converted link in a heading;
  headings that differ only in `#`, `:`, `|`, `^` are duplicates.
- AC-3: title rule with and without "Normalise headings", own label, a note
  embedded twice, a note of which only a section is embedded.
- AC-4: five link forms, a missing heading, a heading not embedded (exact
  warning lists); guard: a note not in the output keeps the US-8.3 comment.
- AC-5: heading, case and the author's own path in both heading modes; the
  note's replaced first heading; missing headings in both syntaxes with
  warnings; the same heading text in an earlier note; a link brought along by
  a section embed. Guard: block links unchanged.
- AC-6: the story's table, every row with its warning list and, where a path
  is written, the model's answer compared with the intended heading; the
  row with "Normalise headings" off (no parent, warning W) and the two
  sibling notes with the same title in both modes; parents that differ only
  in case (E8).
- AC-7: a heading-like line in a code fence; the composed book with both
  heading modes, five anchors, all found.
- Existing tests that stated the slug rule were changed to the new
  expectation (`output-links`, `pass-through-embed`, `heading-anchors`: the
  invariant now compares decoded heading text, as Obsidian does).
- Before the code: all 42 `todo` tests fail on v0.18.0.
- Found while coding (v0.19.0): the AC-2 rows first used the raw heading in
  the link (`[[Note#C# basics]]`), which Obsidian reads as a path; they now
  use Obsidian's own form (F1–F6). Warnings of one note now come in the order
  of its links (one scan for both link kinds). Section embeds are wrapped in
  their note's sentinels so links find where a section-only note is.
- `slugify` and its unit and fuzz tests were removed; nothing calls it.
- Mutation check 2026-11-01 (#99, #101): 17 mutants (`%` not encoded,
  `# : | ^` kept, no parent path, only the top parent, `find` ignoring
  parents, alignment plain only / titled only, one phase, same-note links
  in any copy, sections not wrapped — wiki, markdown, pass-through —, no
  warning W, `decodeLink` without its fallback, no balanced brackets, a
  missing same-note markdown link converted). Six first survived for want
  of an input: a link to the only section embedded; a note embedded twice
  with a same-note link; a lone `%` before an escape; a missing heading with
  a space (`#Gone%20Away`); a section embedded in markdown syntax and through
  a pass-through wrapper. Tests and story examples added; all 17 caught.
- Output-hash guards: a line diff of both fixture books against v0.18.0
  showed only `[B](#b)` → `[B](#B)` and the six links of `3 Heading links`;
  hashes updated, the change asserted.

`%` in links (US-3.1, #101; `tests/integration/percent-links.test.ts`,
written before the code):
- The story's five examples (a note and a heading named with `%`, a valid
  escape, a picture, a missing note); each aborted the compilation in
  v0.18.0. A text check keeps `decodeLink` the only decoder.
### Epic 3 — Link resolution challenge
- Absolute markdown links become anchor links.
- Relative markdown links become anchor links.
- Bare magic filename links become anchor links.
- Non-unique bare filenames use the smallest path and warn.
- External HTTP(S) links remain unchanged.
- URL-encoded spaces are decoded before resolution.

### Epic 4 — TextMapper diagrams

Unit tests (`tests/unit/textmapper.test.ts`):
- Alt text extracted from the first quoted hex label.
- Alt text falls back to the `include` stem with " Map" suffix.
- Alt text falls back to "TextMapper Map" when neither label nor include is present.
- Alt text prefers a hex label over an include line.
- `altForTextMapper` handles empty and whitespace-only blocks without throwing.
- `computeContentHash` returns the same hash for identical block sources (deduplication key).
- `computeContentHash` returns different hashes for different sources.
- Hash is stable across trailing-newline normalisation.
- Hash string contains no path separator characters.
- `parseSvgDimensions` extracts width/height from a `viewBox` attribute.
- `parseSvgDimensions` extracts width/height from explicit `width`/`height` attributes.
- `parseSvgDimensions` prefers `viewBox` when both forms are present.
- `parseSvgDimensions` handles non-zero viewBox origins.
- `parseSvgDimensions` returns a positive fallback when no dimension info is present.
- `parseSvgDimensions` handles floating-point viewBox values.
- `parseSvgDimensions` handles single-quoted attribute values.
- `computePngDimensions` scales a landscape SVG so the width reaches 2048 px.
- `computePngDimensions` scales a portrait SVG so the height reaches 2048 px.
- `computePngDimensions` scales a square SVG to 2048 × 2048.
- `computePngDimensions` preserves aspect ratio within 1 px rounding.
- `computePngDimensions` accepts an optional maxLong override.
- `computePngDimensions` returns integer pixel values.
- `computePngDimensions` never produces zero dimensions for small SVGs.
- `extractIncludes` extracts a single include filename.
- `extractIncludes` extracts multiple include filenames in declaration order.
- `extractIncludes` returns an empty array when no includes are present.
- `extractIncludes` is case-insensitive on the `include` keyword.
- `extractIncludes` trims whitespace around the filename.
- `extractIncludes` ignores prose that contains the word "include".
- `extractIncludes` handles all four standard terrain filenames.
- `buildPlaceholder` returns output containing a warning HTML comment.
- `buildPlaceholder` includes the error message in the comment.
- `buildPlaceholder` does not leak raw block source into the output.
- `buildPlaceholder` does not start a code fence in its output.
- `buildPlaceholder` works without an error message argument.

Integration tests (`tests/integration/textmapper-compiler.test.ts`):
- A text-mapper block is replaced by a `![alt](assets/textmapper/…png)` reference.
- The image is placed under `assets/textmapper/`.
- Alt text is correctly derived from the block source.
- The renderer is called exactly once for a single block.
- The raw block source is passed verbatim to the renderer.
- A block at the start of a file is handled correctly.
- A block at the end of a file with no trailing newline is handled correctly.
- Two distinct blocks in one file each produce a render call and a separate image reference.
- A block containing only a comment line does not crash or leave a raw fence.
- `stats.mapsRendered` is incremented for each successful render.
- `enableTextMapper: false` preserves the raw block and emits a warning comment.
- `enableTextMapper: false` does not call the renderer.
- A renderer whose `isAvailable()` returns false produces a placeholder, not a raw fence.
- A renderer whose `isAvailable()` returns false is not called via `render()`.
- A missing renderer option is handled gracefully (no throw, no raw fence).
- A render failure (renderer throws) produces a placeholder with a warning comment.
- A render failure does not abort the rest of the compilation.
- A render failure records a warning in `result.warnings`.
- `stats.mapsRendered` is 0 and `stats.mapsDeduplicated` is unaffected by a render failure.
- Identical blocks appearing twice in one file are rendered only once.
- Both occurrences of a deduplicated block reference the same image path.
- Identical blocks appearing in two different source files are rendered only once.
- Deduplicated maps are reported in `stats.mapsDeduplicated`.
- Two blocks with different sources each produce a separate render call.
- Include lines in the block source are passed unmodified to the renderer.
- The compiler does not strip or rewrite include directives.
- The renderer receives only `(code: string, assetPath: string)` — no Node.js objects.
- A text-mapper block inside an embedded file is rendered correctly.
- CRLF line endings inside a block are handled without leaving a raw fence.
- An empty text-mapper block does not crash.
- Two consecutive blocks with no content between them are both processed.
- A text-mapper block inside a triple-backtick escape fence is not rendered.
- Source vault file content is unchanged after a compilation that includes text-mapper blocks.
- A block whose source is only whitespace does not crash.
- Each distinct block in one compilation produces a unique asset path.

Rendering through the installed plugin (v0.14.0; `tests/unit/textmapper-plugin.test.ts`):
- `prepareMapSvg` removes only the white background `rect` covering the
  `viewBox`, keeps every other `rect`, fills, outlines and labels, and writes
  the map font on the root (quotes escaped, merged into an existing `style`).
- `resolveMapFont`: a setting is used as written; empty asks Obsidian's note
  font; nothing readable gives `sans-serif`.
- `renderMapSvg` passes the source unchanged with a `vault-compiler-<hash>`
  docId; no `<svg>` or no plugin is a render failure with its own message.
- Guards: no `require`, `fs`, temp folder or npm `text-mapper` in the renderer;
  no desktop-only refusal in `main.ts`; `XMLSerializer` is used; the map font
  setting is passed to the renderer.
- Mutation check 2026-10-27: 7 mutants of these rules, all caught.
- Fonts (v0.14.1): `parseFontList`, the `sans-serif` fallback, `embedFontFaces`
  with a fake `fetch` (case-insensitive family match, `"??"` skipped, `data:`
  kept, relative URLs resolved against the style sheet, unreadable faces
  reported once), the `<style>` element, and map PNG names `<hash>_<key>.png`
  built and parsed only in `textmapper.ts` (text check over `compiler.ts` and
  `main.ts`). Mutation check: 7 more mutants, all caught.
- Not testable here: the plugin inside Obsidian, reading Obsidian's font files
  and the font of the PNG — manual check M14.

Tidy map labels (US-4.9, v0.15.0; `tests/unit/map-labels.test.ts`):
- Fixtures reproduce the plugin's SVG (coordinates group, glow + label pairs,
  `<a>` for linked labels, `option global` ids, pointy-top offsets); text
  widths come from a stand-in measure (0.48 × size per character) chosen so
  no example sits on the 160-unit line limit.
- Covered: hex numbers removed; centring (one and two lines, own label size,
  pointy-top); breaks at spaces; hyphenation (longest prefix, `-`/`&` first,
  2 characters each side, repeated splits, unbreakable words reported);
  escaping of `&` on one and several lines; links kept; unknown structure
  skipped and reported; the PNG key records tidying (AC-9); the setting.
- Mutation check 2026-10-27: 16 mutants; two first survived — one was a
  missing test (escaping in one-line labels, added), one an equivalent mutant
  (replaced by one that makes the map-id suffix mandatory); all caught.
- Not testable here: the plugin's SVG inside Obsidian, real text widths and
  the look — manual check M15 (passed 2026-10-27).
- Found 2026-10-31 (SCAR-023): the fixture writes an empty labels group as
  `<g id="labels-…"></g>`; `XMLSerializer` writes `<g id="labels-…"/>`, and
  the code reports such a map as not tidied. Test with the serialiser's form
  in `tests/unit/map-directives.test.ts`; fixed in v0.17.0 (#91).

Map directives (US-4.10, #92, v0.17.0; `tests/unit/map-directives.test.ts`,
`tests/integration/map-directives-compiler.test.ts`):
- Fixtures are the output of Text Mapper v1.1.0's own `main.js`, run in Node
  with a DOM stand-in on 2026-10-31 and written in `XMLSerializer`'s form
  (childless elements self-closed); only the `<defs>` library is cut. One
  map holds a plain label, a linked label, a path label and a hex without a
  label; a second map has no labels (empty, self-closed groups).
- Covered: directive lines (AC-1: words together and on several lines, case,
  spaces, leading spaces and a missing hyphen are no directive, a directive
  inside a label); unknown words (AC-2: listed once per map, the comma case,
  an empty list; the report entry per block and note, none when maps are off);
  `no-outlines` removes exactly the `regions-` group (AC-3); `no-glow` removes
  exactly the three glow texts and keeps `<a>` and `<textPath>` (AC-4); the
  four combinations (AC-5); order with tidying, on and off, and a text check
  that `renderTextMapperBlock` tidies, applies directives, then prepares
  (AC-6); missing groups, a wrong first child, empty self-closed groups,
  `option global` ids, the notice text (AC-7); no directive returns the SVG
  unchanged and leaves the background rect to `prepareMapSvg` (AC-8); PNG
  names (AC-9) and the kept block when maps are off (AC-10) — these two hold
  today and guard it.
- Written before the code: on 2026-10-31 each test that needed new code
  failed for the missing function or warning only. With the code, one test
  turned out wrong (it expected three glows after removing the labels group;
  one is left) and was corrected.
- Mutation check 2026-10-31: 13 mutants (self-closed groups, anchored and
  case-insensitive directive lines, unknown words once, each switch, path
  labels, the glow check, missing groups, outlines kept, directives only with
  tidying, the warning's file, the notice text); one first survived —
  directives applied only with tidying on — because the wiring check matched
  call positions, not the statement (SCAR-023); it now matches the whole
  statement at function level, and all 13 are caught.
- Composed: the smoke book's `Skill tree.md` (see §5) compiles with the two
  other maps into three distinct PNG references.
- Not testable here: the plugin's SVG inside Obsidian, SVG filters through
  Obsidian's canvas, the directive line in reading view (AC-11), and the
  look — manual check M16.

### Epic 5 — Obsidian control commands
- `meta-bind-embed`, `leaflet`, `calendarium` and `compressed-json` fences are
  removed from output.
- SerializedQuery sections are expanded into embedded content.
- No supported plugin directive remains in visible output.

Frontmatter (US-5.2, v0.13.0):
- `tests/unit/frontmatter.test.ts` — every transform of `splitFrontmatter`:
  first-line `---` to the first closing `---`, trailing spaces and tabs, CRLF,
  empty block, later rules kept, no closing line or a block not on line 1
  left unchanged, removed line count.
- `tests/integration/frontmatter.test.ts` — US-5.2 AC-1 to AC-13, each with
  "Normalise headings" on and off: preamble, heading-first, pass-through,
  section embed, root, nested notes, YAML comments and ToC-like list items in
  the frontmatter, horizontal rules that stay, warning line numbers, and a
  text check that `readNote` is the only reader of note text.

### Epic 6 — Output quality
- Numeric prefix `1.0` generates an h1.
- Numeric prefix `1.1` generates an h2.
- Numeric prefix `1.1.1` generates an h3.
- Unnumbered filenames generate an h2.
- A file beginning with a heading has that heading replaced by the
  autogenerated heading.
- Missing links emit `<!-- Warning: Missing include: filename.md -->`.
- Unreadable files emit `<!-- Warning: Unreadable file: filename.md -->`.
- Statistics report all required totals.
- Anchors are the heading text as Obsidian finds it (US-2.3 AC-2, since
  v0.19.0), e.g. `1.3.1 Combat` -> `#1.3.1%20Combat`; see Epic 2.

Heading rules of 2026-10-27 (US-6.1, US-6.3 to US-6.5, US-2.3; v0.11.0):
- `tests/unit/title.test.ts` — every transform of `titleFromBasename`
  (prefix and extension removed, first letter upper-cased, hyphens kept).
- `tests/integration/auto-heading.test.ts` — US-6.1 with `normaliseHeadings:
  false` **and** with the option absent; both must give the same output.
- `tests/integration/heading-normalisation.test.ts` — US-6.3 AC-1 to AC-11,
  including the four kinds of unprefixed file after `## Chapter` (AC-4), the
  title replacing a first heading whose text differs from the filename (AC-6),
  section embeds moving up (AC-7) and clamps without output comments (AC-8/9).
- `tests/integration/preamble-heading-injection.test.ts` — US-6.4 AC-1 to AC-10
  and the title rule.
- `tests/integration/pass-through-embed.test.ts` — US-6.5 AC-1 to AC-10 and
  what a pass-through shows (target's title, wrapper's depth, wrapper's anchor).
- `tests/integration/heading-anchors.test.ts` — every anchor link in a composed
  document has a matching heading, toggle on and off (5 links counted).
- Mutation check (2026-10-27): nine mutants of these rules (old depth rule,
  keeping the first heading, section depth, down-only shift, ignoring the
  forced depth, "off" only when absent, hyphens to spaces, keeping the prefix,
  wrapper anchor) were each caught.

### Epic 7 — Obsidian plugin delivery
- Plugin builds and loads in Obsidian without console errors.
- Command palette contains compile command(s).
- Settings persist starting file and output path.
- Progress/status notices appear during long runs.
- Output and assets are written through Obsidian APIs when the output folder
  is in the vault; an outside folder uses Node.js `fs` (US-0.3 AC-OL-2).

Settings and the export prompt (US-7.1 AC-S1/AC-S2, US-7.2 AC-3, US-7.3
AC-3 to AC-6; #81, #82; written 2026-11-01 before the code):
- `tests/unit/delayed-save.test.ts` (mocked timers): one save for
  `/Users/me/Exports` typed in one go, nothing before half a second, flush at
  once without a second save, no save on an empty flush, a new wait after a
  save.
- `tests/unit/prompt-keys.test.ts`: Enter confirms; not while composing, not
  as keyCode 229; a letter and Escape do not; the resolved-path text for a
  usable and a refused location.
- `tests/unit/settings-writes.test.ts`: text checks over `main.ts` (it needs
  Obsidian to run) — the file-menu handler and the prompt neither assign nor
  save settings, the plugin assigns them only while loading, the prompt
  compiles with its own values, confirms through `isConfirmKey` and shows the
  path from its own values; the four text fields request a delayed save, the
  three switches and Browse save at once, closing the settings window and
  switching the plugin off flush.
- Behaviour in Obsidian: M19.
- Before the code: 19 `todo` tests, all failing on v0.20.0. Added while
  coding: the settings' path-affecting fields refresh both resolved-path
  places (AC-S2), Enter wired to compiling in both prompt fields (the whole
  statement), a compile reads its run, not the stored values — 21 tests.
- Mutation check 2026-11-01 (#104): 17 mutants (the saver keeping its old
  timer, flush keeping it, flush saving with nothing waiting; Enter while
  composing and keyCode 229; the path text; the file menu saving again; the
  prompt compiling from or showing the settings, or without Enter; no flush
  on hide or unload; a field saving directly; no live path; the row not
  refreshed; Browse in the settings not saving; a compile starting from the
  stored file). Two first survived — Enter's wiring and the compile's
  starting file — for want of a check matching the whole statement; checks
  strengthened, all 17 caught.
- The manual described the old behaviour (the prompt's values saved in the
  settings) as intended; corrected with the stories.

### Epic 8 — Data safety and failsafes
- Source vault file hashes are unchanged after compilation.
- Temporary/rendering artifacts are not written into the source vault unless they
  are configured output or assets paths.
- Missing/unreadable includes do not abort the entire compilation.
- Preflight failures stop output writing instead of producing partial output.
- TextMapper rendering timeouts are caught and reported.
- `OutputWriter` (US-8.1 AC-8.1-W, `tests/unit/output-writer.test.ts`): every
  row of the AC-8.1-W table against a fake vault (vault location) and against
  a real temporary folder with Node.js `fs` (outside location); a refused path
  makes no call at all. For an outside location no vault write method is
  called.
- Write-call guard (AC-8.1-W, SCAR-017): a text check over `plugin/src/*.ts`
  finds every vault write call (`.create(`, `.createBinary(`, `.modify(`,
  `.createFolder(`, `.process(`, `.append(`, `.rename(`, `.delete(`,
  `.trash(`, adapter writes) and every `fs` write, and fails unless each one
  is in `output-writer.ts` behind the path check, or is one of the listed
  TextMapper temp-folder writes under `os.tmpdir()`. It asserts how many calls
  it found.

Each problem reported once (US-8.5, #88; `tests/integration/warnings-once.test.ts`):
- Expected values are the story's examples A to F, E2, E3: exact
  `result.warnings`, `warningDetails` (message, link, note, line) and
  `missingReferences` for a map block, a missing embed, wiki link and image,
  an ambiguous embed and wiki link, an ambiguous embed inside a pass-through
  wrapper ("Normalise headings" on and off) and an ambiguous image.
- Composed: a ToC item reports once; a note embedded twice reports twice.
- Text check: the body of `resolve` adds no warning and counts nothing.
- Guard (passes before and after): the compiled text of `index2compile.md`
  and the smoke book, both heading settings, equals its hash from v0.17.0
  (AC-5); the fixture warnings shrink to the real `missing.md`.
- Guard search: the ambiguity and missing-reference tests in
  `link-resolution.test.ts`, `output-links.test.ts`, `fixture-vault.test.ts`
  and `heading-embed.test.ts` need only some warning, which the reporting
  pass still gives; none forbids the change.
- Added while coding (v0.17.1): ambiguity is checked against the vault's file
  list also when Obsidian's lookup chose the file (a stand-in lookup returning
  `b/dup.md`, and one returning the file next to the note); a wrapper with
  frontmatter (line 4, heading setting on and off).
- Checked in Obsidian 2026-10-31 with v0.17.1 (reported by the user): an
  ambiguous name in a scratch vault is listed in the warnings file. Passed.
- Found while coding: lines of warnings from link conversion count the lines
  of notes embedded above (`See [[dup]].` on line 5 reported as 10, same in
  v0.17.0) — one `todo` test, #95.
- Mutation check 2026-10-31: 14 mutants (resolve warns or counts again, each
  pass without its ambiguity report or its count, the pass-through line, the
  ambiguity threshold, the Obsidian path with and without the relative
  check, `report` without its warnings entry); two first survived for want of
  an input (frontmatter in a wrapper; Obsidian's lookup with a file next to
  the note), tests added, all 14 caught.

Source lines in warnings (US-8.4 AC-5, #95; `tests/integration/warning-lines.test.ts`):
- One test per row of the story's table: a link or embed after notes embedded
  above, a ToC list, a section embed, frontmatter, a map block, a Dataview
  block, in an embedded note, with a title injected ("Normalise headings" on
  and off), a link brought along by a section embed, a link in a heading.
  Each asserts the warning's note and line.
- Guard: no location marker reaches the compiled text.
- Guard: a section embed whose heading holds a link is still found. Its first
  run found a regression in the new code (a marker inside the embed's own
  anchor); embeds are now left unmarked.
- One story example was wrong (a link below frontmatter is on line 8, not 7);
  corrected with its test (SCAR-003).
- Mutation check 2026-10-31 (#97): 10 mutants (line map through map and
  control fences and the injected title, links and markdown links marked,
  embeds left unmarked, marker read and stripped, section headings, embed
  lines); one first survived (section headings with markers), test added,
  all caught.
- Several links with warnings on one line (added 2026-11-01, found with
  v0.18.0): every warning names its own note and line; the exact warning
  list is asserted. Before the fix the second and third name a file that
  contains marker text. A second test puts a link with a marker on an earlier
  line of the same note, so that reading any marker but the last one gives
  a wrong line. Mutation check 2026-11-01 (#98): 2 mutants (the old pattern;
  the pattern without its end anchor); the second first survived for want of
  that input, test added, both caught.

## 4. Property-based and fuzz tests

- (Slug fuzzing removed with `slugify` in v0.19.0, #99; anchors are tested
  against the measured Obsidian model in `obsidian-anchors.test.ts`.)
- Fuzz path resolution with absolute, relative, encoded and bare filenames.
- Fuzz asset collision handling with many files of the same basename.
- Fuzz TextMapper block parsing with empty blocks, comments, and invalid
  terrain labels.

## 5. Integration tests on fixture vault

The fixture vault at `tests/fixtures/basic-vault/` contains:

- `index2compile.md` with a ToC listing `A.md`, `B.md`, `region-map.md`, and `media.png`.
- `A.md` and `B.md` — markdown files linked absolutely, relatively and by bare filename.
- `media.png` — an asset referenced more than once to exercise deduplication.
- `region-map.md` — a file containing a ` ```text-mapper ` block with a quoted
  hex label, exercising both rendering and alt-text extraction.
- A list of markdown links that acts as a nested ToC (via `A.md` embedding `B.md`).
- Circular include: `A.md` → `B.md` → `A.md` (to be added as a test case).
- Missing and unreadable file references (to be added as test cases).
- Obsidian control command fences (to be added as test cases).

Required assertions:

1. The compiled output contains all included files in order.
2. Embedded markdown appears inline.
3. Assets are copied once and referenced correctly.
4. Anchor links point to headings Obsidian finds (US-2.3).
5. Warnings for missing/unreadable/circular files are present.
6. TextMapper output contains either a PNG reference or placeholder warning.
7. Control command fences are absent.
8. Leading headings are replaced by filename-derived headings.

### Smoke book (`tests/fixtures/basic-vault/Smoke/`, added 2026-10-30, #86)

Synthetic notes for the manual checks in §6, M14 and M15, in a subfolder so
the assertions above (which read the top-level files only) do not change.
Every note name is unique in the vault (SCAR-012). Start note:
`Smoke/Smoke book.md`.

| Note | Case |
|---|---|
| `Smoke book.md` | root; ToC list mixing `[[…]]` and `[text](path)` items (US-1.3) |
| `1 Basics.md`, `1.1 Moving.md` | numbered notes, heading-first (US-6.3) |
| `1.2 Dueling.md` | first heading `# Brawling` differs from the title (US-6.3 AC-6) |
| `1.3 Leaf Craft.md` | preamble note embedding two spells (US-6.4) |
| `Spells/Rootbinder.md` | frontmatter, then text (US-5.2) |
| `Spells/Fog Lantern.md` | frontmatter in front of a heading (US-5.2, SCAR-027) |
| `2 Charms.md` | pass-through wrapper of `Seasonal Charms` (US-6.5) |
| `Seasonal Charms.md` | flat-top map: long labels, `Polish&Transplant`, linked label `Rootbinder\|Mend a Bone`, green, pink and orange paths (US-4.2, US-4.8, US-4.9) |
| `Appendix.md` | headingless; `[text](path)` ToC list, a section embed `![[1.1 Moving#Climbing]]` (US-1.2), `![[media.png]]` |
| `Glossary of the Vale.md`, `Map key.md` | `Map key` holds a pointy-top map (`option horizontal`) |
| `3 Heading links.md` | links to a note, to a heading of another note, to a heading of its own with spaces and brackets (also written by hand in lower case), to a heading text another note has too, and to the second of two equal headings (`[[#Part Two#Notes]]`); M17 (US-2.3, added 2026-11-01) |
| `4 Code examples.md` | inline code, a ToC list in a fence, indented code after an empty line and right under a heading, a Dataview example in a ```` fence, an unclosed last block; M18 (US-1.4, added 2026-11-01) |
| `Skill tree.md` | map with `# vault-compiler: no-outlines no-glow` and `option global`: seven hexes of a custom type `skill-moss` with a filtered green outline, checkbox, checkmark, watercolour and `Dice` symbols, the linked label `Fog Lantern\|Lantern Lore`, the path label `Old Road`, the hyphenated label `Thorn-weaving Hands` (US-4.10, added 2026-10-31) |

`tests/integration/smoke-vault.test.ts` compiles the smoke book with
"Normalise headings" on and off and asserts the heading list, the
pass-through, the absence of frontmatter and of ToC links, the two map
references and the copied image (mutation-checked 2026-10-30: breaking the
frontmatter or the pass-through in the fixture fails it).

## 6. Manual smoke tests in Obsidian

Vault: `tests/fixtures/basic-vault/` (since 2026-10-30; the former example
vault held real data and was removed, SCAR-028). `npm run build` deploys the
plugin there; set the output folder to `Export` (ignored by git) so no
compiled file lands beside the fixture notes, which the fixture integration
test reads.

1. Open the fixture vault in Obsidian with the plugin and the Text Mapper
   plugin (id `text-mapper`) enabled.
2. Compile `index2compile.md` (the command palette), then
   `Smoke/Smoke book.md` (file menu → **Compile vault from this file**).
   Note: the file menu currently saves the starting file to the settings
   ([#81](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/81));
   set it back to `index2compile.md` afterwards.
3. Verify the master file opens without errors.
4. Verify generated assets are visible to Obsidian.
5. In plugin settings, disable TextMapper rendering and re-run compilation.
   Confirm that text-mapper fenced blocks are preserved verbatim with a warning
   comment (`<!-- Warning: TextMapper rendering disabled -->`), and that the
   renderer is not called.
6. Re-enable TextMapper rendering. Disable the Text Mapper community plugin
   and re-run compilation. Confirm one notice says the plugin is not installed
   or enabled, and every map is a `TextMapper Render Failure` comment instead
   of an image (US-4.2 AC-5; there is no fallback renderer since v0.14.0).
7. Re-run compilation and confirm unchanged source vault files.
8. Change output path and confirm assets move beside the new output.
9. Output location (US-0.3 AC-OL, 2026-10-27): with `Browse`, pick a folder
   outside the vault (e.g. the Desktop) and compile. Confirm the output file,
   `assets/` and any warnings file are in that folder and that no new file or
   folder appears in the vault (in particular no `Users/` folder). Then type
   `../Exports` and `.obsidian` as the folder and confirm each compile is
   refused with its notice and writes nothing.
10. Frontmatter (US-5.2, 2026-10-27): compile with "Normalise headings" on and
   then off, from `Smoke/Smoke book.md`. In each output, search for `tags:`
   and for a line that is only `---`: neither may appear. Check that
   *Rootbinder* shows its title and then `Mends a broken bone overnight.`,
   and *Fog Lantern* one title only, with no tag list in between.

## 7. Vault mutation guard

For every integration and manual test:

- Record SHA-256 hashes of all source vault files before compilation.
- Run compilation.
- Assert no source file hash differs afterward.
- Assert no new file exists under the source vault except configured output and
  assets paths.

## 8. CI commands

Run from `plugin/`:

```bash
npm run typecheck          # tsc -noEmit -skipLibCheck
npm run lint               # eslint . (plugin sources and build scripts)
npm run test:unit          # tests/unit + tests/fuzz
npm run test:integration   # tests/integration + tests/sanity
npm test                   # both test scripts
npm run build              # typecheck → lint → test → bundle → deploy → release
```

`npm run build` stops at the first failing step, so a type error, a lint error
or a failing test leaves `main.js`, the deployed copy in the example vault and
`releases/` unchanged (proven 2026-10-27 with a deliberately failing test,
T-7.1-B). `deploy` (`plugin/deploy.mjs`) copies `main.js`, `manifest.json`
and `styles.css` into
`tests/fixtures/basic-vault/.obsidian/plugins/obsidian-vault-compiler/`, or
into `OBSIDIAN_PLUGIN_DIR` when set, so the version Obsidian shows is always
the one just built (SCAR-012).

Release is blocked if any command exits non-zero or any manual smoke test fails.
Record the test count in the release notes (SCAR-006).

## 9. Sanity checks

After full compilation of a fixture or real vault, run these coarse-grained
checks as fast release gates:

- **Size sanity:** compiled file size is within +/-10% of the sum of reachable
  markdown file sizes.
- **Asset count sanity:** copied asset count is close to the deduplicated
  reference count, allowing `_1`, `_2`, ... collision suffixes.
- **Asset reference sanity:** every `assets/...` reference exists; no dangling
  asset paths remain.
- **Heading sanity:** heading count is within 20% of the expected count after
  auto-heading generation.
- **Media no-loss sanity:** every source media reference is represented by an
  asset or warning comment.
- **Control-command sanity:** no known Obsidian control fence markers remain.
- **Internal link sanity:** every converted source markdown link has a matching
  anchor target in the compiled output; no broken internal anchor remains.
- **Vault mutation sanity:** source file hashes are unchanged.

Detailed sanity scenarios are documented in `tests/sanity-checks.md`.

### M14 — Maps drawn by the installed Text Mapper plugin (v0.14.0, retest v0.14.1)

Results 2026-10-27 with v0.14.0: steps 1, 3 (except the font), 4 (after the
old PNGs were deleted) and 6 passed; the empty field gave Times, and a font
change did not reach existing PNGs. v0.14.1 fixes both.

Retest 2026-10-27 with **0.14.1**: passed. Empty field → the map in the same
sans-serif as in Obsidian, no notice (so Obsidian lets the compiler read
Inter's font file); `Georgia, sans` → Georgia, with 10 new PNGs keyed
`2e33eefc` in the same output folder; no errors.

Run 2026-10-27 on the former example vault (removed 2026-10-30, SCAR-028).
**Rerun** on the fixture vault from `Smoke/Smoke book.md` (two maps, in
`Smoke/Seasonal Charms.md` and `Smoke/Map key.md`); step 1 expects the version
just built, and step 4's key is whatever the new PNG names show.

Text Mapper v1.1.0 enabled.

1. Settings → Community plugins: Vault Compiler shows **0.14.0**. If not,
   stop: the old build is loaded (reload Obsidian).
2. Settings → Vault Compiler: "Map font" is empty. Output folder inside the
   vault. Compile.
3. Open `assets/textmapper/` next to the output and open the PNG of the
   map with `Fog Mantle` and `Moss Germinations`. Compare it with the map in
   `Smoke/Seasonal Charms.md` in reading view. Expected:
   - transparent background (in Finder/Preview it shows the checkerboard or
     the window colour, not cream or white);
   - a black outline around every hex;
   - coordinates written `0402`, not `04.02`;
   - labels `Fog Mantle`, and `Mend a Bone` (not `Rootbinder|Mend a Bone`);
   - the green, pink and orange path outlines;
   - the text in Inter, the font Obsidian draws the map in (same letter
     shapes as the map in reading view). If instead a notice says
     `map font "Inter" could not be embedded`, Obsidian did not let the
     compiler read the font file (US-4.8 AC-4); report it.
4. Set "Map font" to `Georgia, serif`, compile into the same output folder,
   and confirm the labels are now in Georgia (old-style digits in `0402`) and
   `assets/textmapper/` has new files ending `_2cb44a0b.png`. Clear the field
   again.
5. Look at the pointy-top map of `Smoke/Map key.md` at full size.
6. Is anything missing, odd or ugly that this list did not ask about? Report
   it even if it seems unrelated.

### M15 — Tidy map labels (v0.15.0)

Result 2026-10-27: all steps passed (reported by the user).

Run 2026-10-27 on the former example vault (removed 2026-10-30, SCAR-028).
**Rerun** on the fixture vault from `Smoke/Smoke book.md`; step 1 expects the
version just built. Text Mapper v1.1.0 enabled, "Map font" empty.

1. The plugin list shows **0.15.0**.
2. Settings: "Tidy map labels" is on. Compile into `Export`.
3. Open the PNG of `Smoke/Seasonal Charms.md` (the one with
   `Moss Germinations`). Expected:
   - no hex numbers (`0402` etc.) anywhere;
   - every label in the middle of its hex, with the white glow behind it;
   - `Moss Germinations` on two lines, both inside the hex;
   - no label wider than its hex; `Unpredictable` split with a hyphen,
     `Polish&Transplant` after the `&`;
   - `Mend a Bone` still a link label.
4. Look at the pointy-top map of `Smoke/Map key.md` (`Talentweb Strand`) at
   full size; note any label that touches the hex edge or overlaps another.
5. Turn "Tidy map labels" off, compile again into `Export`: the maps look as
   in v0.14 (numbers on top, labels at the bottom), and `assets/textmapper/`
   has new files whose names do not end in `t.png`.
6. Is anything missing, odd or ugly that this list did not ask about? Report
   it even if it seems unrelated.

### M16 — Map directives: no hex outlines, no label glow (v0.17.0)

Result 2026-10-31: passed (reported by the user). One change asked for: the
corner boxes get a white fill (fixture changed, step 4 updated).

No step edits a note (CLAUDE.md agent rule 10); unknown words
are covered by `map-directives-compiler.test.ts`. On the fixture vault from `Smoke/Smoke book.md`, Text Mapper
v1.1.0 enabled, "Map font" empty, "Tidy map labels" on.

1. The plugin list shows **0.17.0**.
2. Open `Smoke/Skill tree.md` in reading view. Expected: the map as the
   plugin draws it — black hex outlines and white glow are still there, and
   the line `# vault-compiler: no-outlines no-glow` is not shown as text
   (AC-11). Note whether the green outlines look rough (filters work in
   Obsidian's view).
3. Compile into `Export`; no notice about map directives.
4. Open the PNG of the skill tree at full size (SCAR-025). Expected:
   - no black hex outlines; seven green, slightly rough hexes with gaps;
   - no white halo behind any label; `Thorn-weaving Hands` on more than one
     line, broken after `Thorn-`; `Lantern Lore` and `Old Road` (along the
     path at the bottom) readable;
   - a small white hex in the top-right corner of every hex, covering the
     green outline where they meet; checkmarks on
     `Root Grip` and `Feats of Moss`, a green wash with drips behind
     `Feats of Moss`, the word `Dice` under it;
   - zoomed in: the edges of the wash and the outlines look rough, not
     straight (filters drawn through the canvas).
5. Open the PNG of `Smoke/Seasonal Charms.md`: black outlines and white
   glow are still there (no directive, AC-8).
6. Is anything missing, odd or ugly that this list did not ask about? Report
   it even if it seems unrelated.

### M17 — Links to headings in Obsidian (US-2.3, #83, #85)

Result 2026-11-01 with v0.19.0: passed (reported by the user).

No step edits a note (CLAUDE.md agent rule 10). On the fixture vault, from
`Smoke/Smoke book.md`, output folder `Export`.

1. The plugin list shows the version under test.
2. Compile with "Normalise headings" on. Open the compiled book in reading
   view and find the section **Heading links**. Click each of its six links
   (scroll back after each); each lands where its line says:
   - Dueling; the Zeal that follows Dueling;
   - Grit and Moss (optional), twice;
   - the Zeal under Heading links, not the one after Dueling;
   - Notes under Part Two, not under Part One.
3. Repeat step 2 with "Normalise headings" off.
4. The warnings file of both compilations has no entry for
   `3 Heading links.md`.
5. Is anything missing, odd or ugly that this list did not ask about? Report
   it even if it seems unrelated.

### M18 — Code in the compiled book (US-1.4, #84, #102)

Result 2026-11-01 with v0.20.0: passed (reported by the user), "Normalise
headings" on and off. Observed: Obsidian draws an indented line that holds
only a wiki link or embed oddly (`![[ 1.1 Moving]]`, `Appendix]]`, the
heading above and the next line restyled) — the same in the source note, so
it is Obsidian's drawing, not the compiler's output, which is the note as
written. The warnings table shows the ```` ``` ```` cell normally.

No step edits a note (CLAUDE.md agent rule 10). On the fixture vault, from
`Smoke/Smoke book.md`, output folder `Export`.

1. The plugin list shows the version under test.
2. Compile with "Normalise headings" on. Open the compiled book in reading
   view and find **Code examples**. Every example shows as code (grey,
   monospace, brackets visible), none is carried out:
   - the inline `![[1.1 Moving]]` and `[[Appendix]]`;
   - the list `- [[1.1 Moving]]` / `- [[1.2 Dueling]]` in a code block;
   - the indented `![[1.1 Moving]]`;
   - the `[[Appendix]]` indented right under the heading **Indented right
     under a heading** (standard markdown; not yet measured in Obsidian);
   - the Dataview example, shown with its ```` ```dataview ```` lines;
   - the last block, `![[1.2 Dueling]]`, closed by the compiler.
3. After that last block, **Appendix** and the rest of the book are normal
   text, not code.
4. The warnings file has one entry: `Code block not closed; closed at the end
   of the note` for `4 Code examples.md`, line 33.
5. Repeat steps 2–3 with "Normalise headings" off.
6. Is anything missing, odd or ugly that this list did not ask about? Report
   it even if it seems unrelated.

### M19 — Settings and the export prompt (US-7.1, US-7.2, US-7.3, #81, #82)

Result 2026-11-01 with v0.20.1: passed (reported by the user).

On the fixture vault. No step edits a note (CLAUDE.md agent rule 10); every
compile writes below `Export/`, which git ignores.

1. The plugin list shows the version under test.
2. Settings: starting file `index2compile.md`, output folder `Export`,
   filename `compiledtext.md`. Close the settings window.
3. Right-click `Smoke/Smoke book.md` → **Compile vault from this file**. The
   prompt shows `Export` and `compiledtext.md`, and the resolved path
   `Export/compiledtext.md`.
4. In the folder field type `Export/Run` — the resolved path follows each
   key press — then filename `ch2.md` → `Export/Run/ch2.md`.
5. Press **Enter** in the filename field (do not click). The book compiles to
   `Export/Run/ch2.md`, starting from the smoke book.
6. Open the settings: still `index2compile.md`, `Export`, `compiledtext.md`.
7. Right-click the smoke book again, press **Escape**: nothing compiles. Again,
   click **Browse**, pick any folder: the prompt's folder field changes; press
   Cancel. The settings are still as in step 6.
8. Run **Compile vault** from the command palette: it starts from
   `index2compile.md` and writes `Export/compiledtext.md`.
9. In the settings, type `Export2` in the folder field: both places that show
   the resolved path follow each key press. Close the settings window at once
   (within a second) and open it again: the field shows `Export2`. Set it back
   to `Export`.
10. Is anything missing, odd or ugly that this list did not ask about? Report
    it even if it seems unrelated.

### M20 — Quoted notes and code in quotes (US-1.5, US-1.4 AC-7, #105, #106)

Result 2026-11-01 with v0.21.0: passed (reported by the user; the outline
question of step 3 was not answered). Before it, the quote check (Q1–Q9 in
`tests/fixtures/basic-vault/Export/Quote check.md`, ignored by git, reading
view) measured how Obsidian shows the forms US-1.5 writes (SCAR-024): all as
written, except that a heading inside a quote is no link target — recorded
in US-1.5 AC-8.

On the fixture vault, from `Smoke/Smoke book.md`, output folder `Export`.
No step edits a note (CLAUDE.md agent rule 10).

1. The plugin list shows the version under test.
2. Compile with "Normalise headings" on. Open the compiled book in reading
   view and find **Quotes**:
   - the first quote is one box from **Sage sayings** (bold) down to *See
     Appendix for the rest.*; inside it the headings *Sayings of the hedge
     sage* and *Fog*, the code block with `[[Appendix]]` as code, and a
     working link *Appendix*;
   - the callout *On fog* holds *Fog*, its text, the code block and the link,
     and ends with *— the Vale almanac*;
   - the last box is a code block showing `![[1.1 Moving]]`, not the note.
3. Does the outline (right sidebar) list *Sayings of the hedge sage* or
   *Fog* under **Quotes**? Report what it shows (not measured yet; US-1.5
   AC-8 makes them no link targets either way).
4. The warnings file holds only the entry for `4 Code examples.md` (M18).
5. Repeat steps 2–4 with "Normalise headings" off.
6. Is anything missing, odd or ugly that this list did not ask about? Report
   it even if it seems unrelated.
