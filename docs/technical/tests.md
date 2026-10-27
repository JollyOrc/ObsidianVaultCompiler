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

### Epic 2 — Asset handling and deduplication
- Images, PDFs, audio, video and generic files are copied to `assets/`.
- Asset reference is rewritten to `assets/filename.ext`.
- A second reference to the same resolved path reuses the destination path.
- Distinct files with the same basename receive `_1`, `_2`, etc.
- Copying the same source twice does not create a second file.
- A log/notice records reuse of an existing asset copy.

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
- Slugification preserves numeric prefixes, e.g.
  `1.3.1 Combat` -> `1.3.1-combat`.

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

## 4. Property-based and fuzz tests

- Fuzz slugification with Unicode, spaces, underscores, punctuation and numeric
  prefixes.
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
4. Anchor links point to generated slugs.
5. Warnings for missing/unreadable/circular files are present.
6. TextMapper output contains either a PNG reference or placeholder warning.
7. Control command fences are absent.
8. Leading headings are replaced by filename-derived headings.

## 6. Manual smoke tests in Obsidian

1. Install the plugin in a test vault with the Text Mapper plugin (id
   `text-mapper`) enabled.
2. Choose `index2compile.md` and run compilation.
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
   then off. In each output, search for `tags:` and for a line that is only
   `---`: neither may come from a note's frontmatter. Check that a spell note,
   e.g. *Bonesetter*, shows its title and then its text, with no tag list
   between them.

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
T-7.1-B). `deploy` copies `main.js` and `styles.css` into
`Example Vault/.obsidian/plugins/obsidian-vault-compiler/`;
`plugin/manifest.json` is a symlink to the manifest in that folder, so the
version Obsidian shows is always the one just built (SCAR-012).

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

Example vault `Example Vault`, Text Mapper v1.1.0 enabled.

1. Settings → Community plugins: Vault Compiler shows **0.14.0**. If not,
   stop: the old build is loaded (reload Obsidian).
2. Settings → Vault Compiler: "Map font" is empty. Output folder inside the
   vault. Compile.
3. Open `assets/textmapper/` next to the output and open the PNG of the
   Elemental Magic map (the one with `Ice Armour`, `Fireball`). Compare it with
   the same map in `Elemental Magic Spells.md` in reading view. Expected:
   - transparent background (in Finder/Preview it shows the checkerboard or
     the window colour, not cream or white);
   - a black outline around every hex;
   - coordinates written `0402`, not `04.02`;
   - labels `Ice Armour`, not `Ice Armour|Ice Armour`;
   - the green, pink and orange path outlines;
   - the text in Inter, the font Obsidian draws the map in (same letter
     shapes as the map in reading view). If instead a notice says
     `map font "Inter" could not be embedded`, Obsidian did not let the
     compiler read the font file (US-4.8 AC-4); report it.
4. Set "Map font" to `Georgia, serif`, compile into the same output folder,
   and confirm the labels are now in Georgia (old-style digits in `0402`) and
   `assets/textmapper/` has new files ending `_2cb44a0b.png`. Clear the field
   again.
5. Look at two other maps (e.g. Body Magic, Combat Skill Branches) at full size.
6. Is anything missing, odd or ugly that this list did not ask about? Report
   it even if it seems unrelated.

### M15 — Tidy map labels (v0.15.0)

Result 2026-10-27: all steps passed (reported by the user).

Vault `Example Vault`, Text Mapper v1.1.0 enabled, "Map font" empty.

1. The plugin list shows **0.15.0**.
2. Settings: "Tidy map labels" is on. Compile into `Export`.
3. Open the Body Magic map PNG (the one with `Limb Regeneration`). Expected:
   - no hex numbers (`0402` etc.) anywhere;
   - every label in the middle of its hex, with the white glow behind it;
   - `Limb Regeneration` on two lines, both inside the hex;
   - no label wider than its hex; long single words split with a hyphen.
4. Look at two more maps (e.g. Elemental Magic, Combat Skill Branches) at
   full size; note any label that touches the hex edge or overlaps another.
5. Turn "Tidy map labels" off, compile again into `Export`: the maps look as
   in v0.14 (numbers on top, labels at the bottom), and `assets/textmapper/`
   has new files whose names do not end in `t.png`.
6. Is anything missing, odd or ugly that this list did not ask about? Report
   it even if it seems unrelated.
