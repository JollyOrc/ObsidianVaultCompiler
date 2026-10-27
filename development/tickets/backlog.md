# Implementation Tickets — Obsidian Vault Compiler

This backlog converts `docs/user-stories/userstories.md` and the technical
documentation into actionable implementation tickets. Ticket IDs mirror user
story IDs where possible.

## Test-first tickets (prioritized above implementation)

### TT-0.1 — Test harness and fixture vault
- **Source:** `docs/technical/tests.md` sections 2, 5, 7
- **Description:** Create unit/integration harness, fake Obsidian APIs, fixture
  vault, cross-reference index and mutation guard utilities.
- **Must be done before:** all implementation tickets.

### TT-0.2 — Link resolution unit tests
- **Source:** US-0.4, US-3.1, Epic 3
- **Description:** Implement tests for absolute, relative, magic, encoded, anchor,
  external and ambiguous links.

### TT-0.3 — Core compilation tests
- **Source:** US-1.1, US-1.2, US-1.3, US-6.1
- **Description:** Implement tests for ToC ordering, recursive embedding, circular
  dependencies, nested ToCs, and auto-headings.

### TT-1.2 — Syntax-parity tests for heading-anchored embeds
- **Source:** US-1.2 (amended), global requirement "both embed syntaxes treated identically"
- **Description:** Every heading-anchored-embed behaviour must be tested for both
  `![[file.md#Heading]]` (wiki) and `![alt](file.md#Heading)` (markdown) syntax.
  Tests for the wiki syntax exist in `tests/integration/heading-embed.test.ts`.
  Tests for the markdown syntax are in `tests/integration/syntax-parity.test.ts`.
- **Scope:** section extraction, boundary detection, case-insensitive matching,
  auto-heading suppression, missing-anchor warning + WarningDetail attribution,
  mixed-syntax integration.
- **Status:** Implemented in v0.6.1.

### TT-0.4 — Asset deduplication tests
- **Source:** US-2.1, US-2.2, US-2.3
- **Description:** Implement tests for copying, rewriting, reuse, collision
  suffixes, and missing assets.

### TT-0.5 — TextMapper tests
- **Source:** US-4.1
- **Description:** Implement tests for block detection, rendering, caching,
  invalid dependency handling, placeholders and metadata.

### TT-0.6 — Control command and safety tests
- **Source:** US-5.1, US-8.1, US-8.2
- **Description:** Implement tests for removing control directives, SerializedQuery
  expansion, missing/unreadable inputs, and vault mutation checks.

### T-2.4 — Prevent false "Missing asset" warnings for generated asset paths
- **Issue:** Compiled output contains warnings such as
  `<!-- Warning: Missing asset: assets/Planning_1.png -->` even though the
  asset exists in `assets/`.
- **Root cause:** Running-text link conversion attempts to resolve generated
  asset destination paths as source vault files. Generated asset names are not
  source paths, so they are incorrectly reported as missing.
- **Proposed fix:** Detect asset-folder paths and generated asset basenames in
  `convertLinks`; leave valid asset references unchanged instead of emitting a
  missing-asset warning.
- **Tests:** Add cases covering asset-like running-text links.

### TT-0.9 — Asset path encoding tests
- **Source:** US-2.4
- **Description:** Test spaces and special characters in asset filenames,
  ensuring compiled references use `%20` and stable encodings.
- **Must be done before:** release.

### TT-0.8 — Output sanity checks
- **Source:** `tests/sanity-checks.md`, `docs/technical/tests.md` section 10
- **Description:** Implement size, asset-count, asset-reference, heading,
  internal-link, media no-loss, control-command, and vault mutation sanity
  checks.
- **Must be done with:** integration tests.

### TT-0.7 — Quality gates and performance tests
- **Source:** `docs/technical/tests.md` sections 1, 9
- **Description:** Configure typecheck, build, lint, coverage, integration and
  performance checks in CI.

## Implementation tickets

## T-0.1 — Obsidian plugin skeleton and settings
- **Source:** US-0.1, US-0.2, US-0.3, US-7.1
- **Description:** Create the Obsidian plugin scaffold, settings tab, command
  palette commands, progress notices, and read/write path validation.
- **Deliverables:** `manifest.json`, `package.json`, build config, `src/main.ts`,
  settings tab, compile command.
- **Tests:** US-7.1, vault mutation guard.

## T-0.2 — Vault context and file access
- **Source:** US-0.1, US-8.1
- **Description:** Bind the plugin to the active Obsidian vault and expose
  read-only file access helpers.
- **Deliverables:** vault service module.
- **Tests:** US-8.1, US-8.2.

## T-0.3 — Starting file and output selection
- **Source:** US-0.2, US-0.3
- **Description:** Implement settings/file picker flows for selecting the starting
  markdown file and output path, including defaults and overwrite confirmation.
- **Deliverables:** settings UI, path validation, confirmation modal.
- **Tests:** US-0.2, US-0.3, US-8.1.

## T-0.4 — Obsidian link resolution adapter
- **Source:** US-0.4, US-3.1
- **Description:** Resolve links through Obsidian metadata/cache first, with a
  deterministic fallback search and magic-link handling.
- **Deliverables:** resolver module and fallback search utilities.
- **Tests:** US-0.4, US-3.1, Epic 3 integration tests.

## T-1.1 — Recursive markdown compilation
- **Source:** US-1.1, US-1.2
- **Description:** Implement the compiler service that reads the starting file
  and embeds markdown includes inline in source order.
- **Deliverables:** compiler service, embedding processor, circular dependency
  detection.
- **Tests:** US-1.1, US-1.2, US-6.1, US-8.2.

## T-1.2 — Nested ToC expansion
- **Source:** US-1.3
- **Description:** Detect bullet/numbered lists of markdown links and expand them
  as embed lists recursively.
- **Deliverables:** ToC detector and recursive expansion logic.
- **Tests:** US-1.3, integration fixture assertions.

## T-2.1 — Asset copy and deduplication
- **Source:** US-2.1, US-2.2
- **Description:** Copy non-markdown files to `assets/`, rewrite references, and
  deduplicate by resolved absolute source path.
- **Deliverables:** asset manager, unique filename strategy, reuse logging.
- **Tests:** US-2.1, US-2.2, collision fuzz tests.

## T-2.2 — Anchor link conversion
- **Source:** US-2.3
- **Description:** Convert in-text markdown/wiki links to anchors using generated
  heading slugs.
- **Deliverables:** link converter, slugifier.
- **Tests:** US-2.3, US-6.1, edge-case fuzz tests.

## T-2.3 — Asset path normalization and encoding
- **Source:** US-2.4, US-2.5
- **Description:** Implement `normalizeAssetFilename` and `encodeAssetPath`; normalize
  copied asset names to lowercase with `_` separators and lowercase extensions,
  then encode references safely.
- **Deliverables:** utility and compiler changes.
- **Tests:** TT-0.9.

## T-3.1 — Absolute, relative, and magic link challenge cases
- **Source:** US-3.1
- **Description:** Validate all documented link formats, including URL-encoded
  paths and non-unique bare filenames.
- **Deliverables:** test fixtures and resolver hardening.
- **Tests:** US-3.1, integration fixture assertions.

## T-4.1 — TextMapper rendering core feature
- **Source:** US-4.1
- **Description:** Detect TextMapper blocks and render them through the installed
  `obsidian-text-mapper` plugin, cache results, and store PNGs under
  `assets/textmapper/`.
- **Deliverables:** renderer module, cache service, SVG-to-PNG strategy,
  placeholder fallback.
- **Tests:** US-4.1, US-8.2, performance gate.

## T-4.2-GAP — Renderer does not follow US-4.2 to US-4.4 (open)
- **Source:** US-4.2, US-4.3, US-4.4, ADR-010, ADR-011; found 2026-10-27 while
  correcting `docs/technical/dependencies.md` §4 ("Current state").
- **Measured at v0.10.0:**
  - `plugin/src/textmapper.ts` renders with the npm package `text-mapper`
    0.1.10, not the installed Text Mapper plugin (US-4.2) nor a bundled copy of
    its parser (US-4.3).
  - The installed plugin is looked up under `plugins/obsidian-text-mapper`;
    its real folder is `plugins/text-mapper`.
  - Rendering uses `fs`, `os` and `path` through `window.require` and writes
    temp files (US-4.4, ADR-011); it throws on mobile while the manifest says
    `isDesktopOnly: false`; the temp resource folder is never removed.
  - The npm package is AGPL-3.0-or-later (with CC-BY-SA-4.0 and CC0-1.0 parts)
    and is bundled into `main.js` of an `Unlicense` plugin.
- **Needs before code:** a licence decision, and a decision whether US-4.2 to
  US-4.4 stand as written or are amended to the npm-package design. Then tests
  per AC (the current unit tests cover only the pure helpers).
- **Status:** Superseded 2026-10-27 by T-4.2-B (the licence question goes away
  with the npm package; US-4.3 withdrawn, US-4.6 rewritten).

## T-4.2-B — Draw maps with the installed Text Mapper plugin (v0.14.0)
- **Source:** US-4.2 (rewritten), US-4.3 (withdrawn), US-4.4, US-4.6, US-4.8 (new).
- **Why:** the user wants compiled maps to look like Obsidian's: transparent
  background, black hex outlines, the same font. The npm package gave a cream
  background, no outlines, a serif font and `A|B` labels; the installed plugin
  (MIT) draws outlines from its Gnomeyland defaults and splits `A|B` labels.
- **Changes:**
  - `plugin/src/textmapper.ts`: `getTextMapperPlugin(app)`; `renderMapSvg(plugin,
    code, deps)` calls `processMarkdown` on a detached div and serialises the
    `<svg>` with `XMLSerializer`; `prepareMapSvg(svg, font)` removes the
    background rect and sets the font; `resolveMapFont(setting, reader)`;
    `renderTextMapperBlock(app, code, destination, writer, mapFont)` ties them
    together. Remove the Node `fs`/`os`/`path` path, `isDesktopRuntime`, the
    `text-mapper` import and the `.txt` terrain imports.
  - `plugin/src/main.ts`: setting `mapFont` (default `''`, "Map font" text
    field); pass it to the renderer; drop the desktop-only refusal; one notice
    per compile when the plugin is missing.
  - `plugin/package.json`: remove the `text-mapper` dependency;
    delete `plugin/resources/` and `plugin/src/text-files.d.ts` if unused.
  - Docs: `dependencies.md` §0 and §4, `tests.md`.
- **Class search (SCAR-017):** every place that reaches the renderer or its
  inputs — `renderTextMapperBlock` (1 call in `main.ts`), `isDesktopRuntime`
  (2 uses in `main.ts`), `RESOURCE_FILES` and the four `.txt` imports.
- **Guard search (SCAR-023):** first recorded as "none" without searching; the
  run found three guards in `tests/unit/output-writer.test.ts` that allowed
  exactly the five TextMapper temp-folder writes this ticket removes. They were
  narrowed to the criterion "no write call outside `output-writer.ts`" (total
  7, none outside). New guards are in `tests/unit/textmapper-plugin.test.ts`.
- **Tests:** `tests/unit/textmapper-plugin.test.ts` (red 2026-10-27).
- **Not measured here:** the plugin's behaviour inside Obsidian and the font of
  the PNG (US-4.2, US-4.8 AC-5) — manual check M14 after the build.

## T-4.8-B — Embed Obsidian's map fonts; font key in PNG names (v0.14.1)
- **Source:** US-4.8 AC-2 to AC-6 (rewritten after M14), US-4.1.
- **Found in M14 (v0.14.0):** with "Map font" empty the PNG was in Times:
  Obsidian's list `"??", its-Bookerly, Bookerly, Inter` names no installed
  font and has no generic family; Inter exists only as Obsidian's own
  `@font-face`. And a second compile into the same folder with `Georgia` kept
  all 10 PNGs from the first compile (names depended only on the map text).
- **Changes (`plugin/src/textmapper.ts`):** `parseFontList`; `resolveMapFont`
  appends `sans-serif` when no generic family is listed; `collectFontFaces`
  (DOM) and `embedFontFaces(list, faces, fetchBytes)`; `prepareMapFont(setting)`
  once per compile → `{ family, css, key, failed }`; `prepareMapSvg(svg, font,
  css)` adds `<style><![CDATA[…]]></style>`; `mapFontKey`, `mapAssetName`,
  `parseMapAssetRef` as the only builder and parser of map PNG names.
- **`compiler.ts`:** option `mapFontKey`; names through `mapAssetName`;
  `compileAsync` parses through `parseMapAssetRef`.
- **`main.ts`:** `prepareMapFont` before the compiler is created; notice for
  failed families; refs parsed through `parseMapAssetRef`; renderer gets the
  prepared font.
- **Class search (SCAR-017):** map names are built at `compiler.ts:442` and
  parsed at `compiler.ts:160`, `main.ts:193` and `main.ts:211`; all four go
  through the new helpers. Test files that use `_0001` names
  (`output-writer.test.ts`) only pass paths to the writer and stay valid.
- **Guard search (SCAR-023, done this time):** `grep _0001` over the tests
  found only the writer tests above; no guard forbids `fetch`.
- **Tests:** `tests/unit/textmapper-plugin.test.ts`,
  `tests/integration/textmapper-compiler.test.ts` (red 2026-10-27).
- **Not measured here:** whether `fetch` may read `public/fonts/*.woff2` inside
  Obsidian — M14 retest.

## T-4.9-A — Tidy map labels: no hex numbers, centred and wrapped labels (v0.15.0)
- **Source:** US-4.9 AC-1 to AC-9 (decisions OD-L1 to OD-L3, 2026-10-27).
- **Changes (`plugin/src/textmapper.ts`):** `isHorizontalMap`, `fontSizeToUnits`,
  `breakLabel(label, width, measure)` (spaces, then `-`/`&`, then hyphen;
  at least 2 characters on each side), `tidyMapLabels(svg, docId, measure,
  horizontal)` working on the plugin's SVG text (removes the coordinates
  group; rebuilds each glow/label pair with centred `<tspan>` lines; reports
  skipped steps and unbreakable words), `mapDocId(code)` shared with
  `renderMapSvg`, `mapImageKey(fontKey, tidy)`, a canvas-based measure with the
  map font; `renderTextMapperBlock(…, mapFont, tidyLabels)` tidies before
  `prepareMapSvg` and returns what it skipped.
- **`plugin/src/main.ts`:** setting `tidyMapLabels` (default `true`, toggle
  "Tidy map labels"); passed to the renderer; PNG key from `mapImageKey`;
  one notice per compile for skipped steps, one per map for unbreakable words.
- **Class search (SCAR-017):** places that decide whether an existing map PNG
  is reused — the PNG name (`mapAssetName` with the key from `main.ts`) and
  `writePngFromSvg` (keeps existing files). Every input that changes the
  drawing must be in the key: font (US-4.8 AC-6) and now tidying (US-4.9 AC-9).
- **Guard search (SCAR-023):** `tests/unit/textmapper-plugin.test.ts` lines
  317–318 pin `mapFontKey: mapFont.key` and the five-argument render call;
  both are updated to the new key and call in this ticket.
- **Tests:** `tests/unit/map-labels.test.ts` (red 2026-10-27).
- **Not measured here:** the plugin's SVG inside Obsidian, real text widths,
  and how the result looks — manual check M15.

## T-1.3-B — ToC lists: [text](path) items, whole-list rule (v0.15.1)
- **Source:** US-1.3 (rewritten 2026-10-27), global rule "both embed syntaxes
  are treated identically".
- **Defect:** `index2compile.md` lists `[4 Glossary](…)` and `[5 Back notes](…)`;
  only `[[…]]` items were turned into embeds, so both chapters were missing
  from the book (reproduced on the real vault). Also, lists were judged line by
  line, not as a whole, and `[[A|alias]]` items never expanded (the alias was
  resolved as part of the name).
- **Change (`plugin/src/compiler.ts`, ToC expansion in `processMarkdown`):**
  split the file into runs of list-item lines; classify each item (embed /
  note link in either syntax / other) with the resolver; expand all link items
  of a run only when every item is an embed or a note link; embed items always
  lose their bullet; the explicit-embed exception (AC-5) for both syntaxes.
- **Class search (SCAR-017):** the expansion is the only place that turns list
  links into embeds; `processWikiEmbeds`/`processMarkdownEmbeds` only see
  `!`-prefixed embeds. The explicit-embed pre-scan already covers both syntaxes.
- **Guard search (SCAR-023):** `tests/integration/compile-basic.test.ts`
  "a bullet list of markdown links becomes anchor links (not embeds)" pinned
  the defect; turned around (now asserts the embeds). `output-links.test.ts`
  has a mixed list of embeds and website links — embed items keep losing their
  bullet, so it is unaffected. Missed by the search and found by the first run:
  `output-links.test.ts` "resolves URL-encoded vault links into anchors" wrote
  its link as a one-item list, which is now a ToC; the link moved into a
  sentence, keeping the test's purpose.
- **Measured on the vault (2026-10-27):** 11 link-only lists use `[text](…)`
  (13 with mixed syntax); in the book they add 4 Glossary and 5 Back notes and
  expand the glossary entries `Skilltree Branch` (chapters 1.4.1, 1.4.2 a
  second time) and `Reflex Skills` (two skills a second time) until the user
  rewrites them as sentences (decision of 2026-10-27). Mixed lists exist only
  in `News/` (not in the book).
- **Tests:** `tests/integration/toc-lists.test.ts` (red 2026-10-27).

## T-5.1 — Obsidian control command removal
- **Source:** US-5.1
- **Description:** Remove plugin control command fences and expand
  SerializedQuery sections.
- **Deliverables:** directive preprocessor, SerializedQuery handler.
- **Tests:** US-5.1, integration fixture assertions.

## T-6.1 — Auto-generated headings
- **Source:** US-6.1
- **Description:** Generate headings from filenames, replace leading heading
  lines, and preserve slug mappings.
- **Deliverables:** heading generator, heading map.
- **Tests:** US-6.1, US-2.3.

## T-6.2 — Reporting and statistics
- **Source:** US-6.2
- **Description:** Collect and present compile statistics and warnings.
- **Deliverables:** statistics tracker and summary notice/UI.
- **Tests:** US-6.2.

## T-6.6-A — Tidy empty lines in the compiled output (v0.16.0)
- **Source:** US-6.6 AC-1 to AC-7 (decision 2026-10-27: no empty line after a
  heading whatever follows, except another heading).
- **Change:** `tidyBlankLines(text)` in `plugin/src/utils.ts` (transforms
  listed in its doc comment, SCAR-001), applied as the last step of
  `compile()` and `compileAsync()` in `plugin/src/compiler.ts`.
- **Class search (SCAR-017):** the compiled text leaves the compiler through
  `compile()` and `compileAsync()` only; `main.ts` afterwards replaces single
  image lines with failure comments (one line for one line), which keeps the
  spacing.
- **Guard search (SCAR-023):** the first full run found no existing test that
  depends on the old spacing (all 635 green).
- **Found while testing:** KD-3 in US-6.6 — section extraction and heading
  normalisation do not know code blocks; not fixed here (the book has none).
- **Tests:** `tests/unit/blank-lines.test.ts`,
  `tests/integration/blank-lines.test.ts` (red 2026-10-27).
- **Status:** Done 2026-10-27; mutation check 10/10; example book: 211/169
  double empty lines, 283/566 empty lines after headings and 66/13 headings
  without one before → 0, same headings and blocks.

## T-6.6-B — Heading rules skip code blocks (KD-3, v0.16.1)
- **Source:** US-6.6 "KD-3 — fixed in v0.16.1", examples K-1 to K-7.
- **Change:** `codeBlockMask(lines)` and `matchHeading(line)` in
  `plugin/src/utils.ts` as the only definitions of "inside a code block" and
  "heading"; `tidyBlankLines` uses them; in `compiler.ts` the scanning sites
  skip masked lines and the first-line sites use `matchHeading`.
- **Class search (SCAR-017), every heading check in `plugin/src`:**
  | Site | Scans | Decision |
  |---|---|---|
  | `processMarkdown` last-original-heading tracker (`:564`) | all lines | fix: skip code |
  | `applyHeadingNormalisation` (`:905`–`:929`) | all lines | fix: skip code |
  | `shiftSectionTo` (`:943`–`:950`) | all lines | fix: skip code |
  | `extractSection` (`:1126`) | all lines | fix: skip code |
  | `startsWithHeading`, `stripLeadingHeading` (utils) | first line | not affected; use `matchHeading` |
  | `isEffectivelyHeadingFirst` (`:1045`) | first non-empty line | not affected; use `matchHeading` |
  | `expandPassThrough` shown heading (`:1012`) | first line of a section | not affected; use `matchHeading` |
  | `tidyBlankLines` (utils) | all lines | already correct; use the helpers |
  Same class outside headings, not fixed: ToC lists, embeds and link
  conversion inside code blocks — KD-4.
- **Guard search (SCAR-023):** no test asserts the old behaviour inside code.
- **Tests:** `tests/integration/code-blocks.test.ts` (K-1 to K-7 and a text
  check that `#{1,6}` and the fence pattern occur only in `utils.ts`),
  `tests/unit/code-block-mask.test.ts` (red 2026-10-27).
- **Status:** Done 2026-10-27; 652/652 tests, mutation check 10/10, example
  book byte-identical to v0.16.0.

## T-7.1 — Plugin packaging and release
- **Source:** US-7.1, AGENTS.md
- **Description:** Configure TypeScript, esbuild, manifest, versions, linting,
  and release scripts.
- **Deliverables:** build configuration and release documentation.
- **Tests:** quality gates in `docs/technical/tests.md`.

### T-7.1-B — Gate the build on typecheck, lint and tests (v0.10.1)
- **Source:** US-7.1, `docs/technical/tests.md` §1 and §8, SCAR-006.
- **Found 2026-10-27:** `npm run build` ran typecheck, bundle, deploy and release
  but no lint and no tests, although SCAR-006 recorded that it ran the tests.
  `npm run lint` failed with 11 errors, all `no-undef` for Node globals in
  `release.mjs` (the config gave Node globals to `*.ts` only). The scripts
  `typecheck`, `test:unit` and `test:integration` named in `CLAUDE.md` and
  `tests.md` did not exist, and `npm run version` called a missing
  `version-bump.mjs`.
- **Changes:**
  - `eslint.config.mjs`: Node globals for `*.mjs`.
  - `package.json`: `typecheck`; `test:unit` (`tests/unit`, `tests/fuzz`);
    `test:integration` (`tests/integration`, `tests/sanity`); `test` runs both;
    `build` = typecheck → lint → test → bundle → deploy → release, stopping at
    the first failure.
  - `version-bump.mjs`: sets `manifest.json` and `versions.json` from the
    `package.json` version.
  - `deploy` also copies `styles.css` (`plugin/manifest.json` is a symlink to
    the deployed manifest, so it is never copied).
  - `tests.md` §8 describes the real scripts.
- **Acceptance criteria:**
  - `npm run lint` exits 0.
  - `npm run test:unit` + `npm run test:integration` run the same tests as
    `npm test` (360 at v0.10.1), each file once.
  - A failing test, lint error or type error stops `npm run build` before
    `main.js` is bundled, deployed or released (checked by mutation: one test
    made to fail, build exits non-zero and `main.js` is unchanged).
- **Status:** Done 2026-10-27.

### T-7.1-C — Example vault renamed to `Example Vault` (v0.14.2)
- **Source:** US-7.1, `CLAUDE.md` (local development workflow).
- **Found 2026-10-27:** the example vault folder was renamed from
  `Example Vault` to `Example Vault`. `npm run deploy` copied into
  the old path, and `plugin/manifest.json` — a symlink to the deployed
  manifest — pointed into the old folder and was broken, which also breaks
  `npm version` (`version-bump.mjs`) and `release.mjs`.
- **Class search (SCAR-017):** `grep "Example Vault"` outside the
  vault, `releases/` and `project-template/`: `plugin/package.json` (deploy),
  the `plugin/manifest.json` symlink, `tests/manual-compile.mjs`, `README.md`,
  `CLAUDE.md`, `AGENTS.md`, `docs/technical/tests.md` — all updated. Two
  finished tickets below and the release notes keep the old name as history.
- **Acceptance:** `npm run build` deploys `main.js` and `styles.css` into
  `Example Vault/.obsidian/plugins/obsidian-vault-compiler/`, and the
  manifest there shows the new version.
- **Status:** Done 2026-10-27.

## T-7.2 — Context-menu compilation
- **Source:** US-7.2
- **Description:** Register an Obsidian file-menu item for markdown files that
  starts compilation from the selected file.
- **Deliverables:** file-menu handler and settings update.
- **Tests:** manual smoke test.

## T-8.1 — Read-only safety and failsafes
- **Source:** US-8.1, US-8.2
- **Description:** Implement hash guards, preflight validation, graceful missing
  file handling, and no-write guarantees for source files.
- **Deliverables:** safety middleware and tests.
- **Tests:** US-8.1, US-8.2, vault mutation guard.

## T-9.1 — Test infrastructure and fixtures
- **Source:** `docs/technical/tests.md`
- **Description:** Create unit/integration fixtures, test harnesses, mutation
  guards, and CI commands.
- **Deliverables:** `tests/` structure, sample vault, automated tests.
- **Tests:** all stories.

## T-9.2 — Documentation and audits
- **Source:** all
- **Description:** Maintain documentation coherence, decision records, tickets,
  and audit notes under `development/`.
- **Deliverables:** ADRs, audit reports, test results.
- **Tests:** documentation review.

---

## Missing test tickets (from coverage audit, 2026-10-15)

These tickets were created after cross-referencing all existing test files against
`docs/technical/tests.md`. Each ticket lists the exact test cases that must be
written; the TT-0.x tickets above described the intent but the tests were never
implemented.

### TT-1.1 — Link resolution unit tests
- **Source:** `docs/technical/tests.md` §3 Epic 0
- **File:** `tests/unit/link-resolution.test.ts` (create)
- **Depends on:** resolver functions to be implemented in T-0.4
- **Test cases to implement:**
  - `resolveAbsoluteLink` resolves a vault-root-relative path (`/folder/file.md`) to the correct `TFile`.
  - `resolveAbsoluteLink` returns `null` for a path that does not exist in the vault.
  - `resolveRelativeLink` resolves `../sibling/file.md` relative to the calling file's folder.
  - `resolveRelativeLink` normalizes `%20` encoding: `my%20file.md` and `my file.md` resolve to the same file.
  - `resolveMagicLink` returns the unique `TFile` when exactly one file matches the bare filename.
  - `resolveMagicLink` returns the lexicographically smallest path and records a warning when multiple files share the same basename.
  - `resolveMagicLink` returns `null` and records a warning when no file matches.
  - `resolveLinkWithObsidianCache` delegates to the Obsidian `MetadataCache` and returns its result without fallback when the cache resolves the link.
  - `resolveLinkWithObsidianCache` falls back to `resolveMagicLink` when the cache returns `null`.

### TT-1.2 — Core compilation unit tests
- **Source:** `docs/technical/tests.md` §3 Epic 1
- **File:** `tests/integration/compile-basic.test.ts` (extend) and/or `tests/unit/compiler.test.ts` (create)
- **Depends on:** TT-1.1, T-1.1
- **Test cases to implement:**
  - `![alt](file.md)` image-embed syntax embeds the file content just as `![[file.md]]` wiki syntax does (one test per syntax, same assertion).
  - A circular include (`A.md` → `B.md` → `A.md`) emits exactly one `<!-- Circular dependency avoided: B.md -->` comment at the point of the second visit and does not recurse infinitely.
  - A file that appears in two separate ToC entries is embedded in full **at each occurrence**; each ToC reference produces a complete embed of the file's content at that position in the document. (Deduplication via `processedStack` applies only to circular-reference prevention, not to non-circular repeated entries.) See TT-2.1 for the canonical repeated-embed test cases.
  - A bullet list of markdown links in a file is detected as a nested ToC and each entry is recursively expanded in order.
  - Nested ToC expansion descends at least two levels deep: a ToC entry that itself contains a ToC is also expanded.

### TT-1.3 — Asset deduplication unit tests
- **Source:** `docs/technical/tests.md` §3 Epic 2
- **File:** `tests/unit/asset-manager.test.ts` (create) and `tests/integration/compile-basic.test.ts` (extend)
- **Depends on:** T-2.1
- **Test cases to implement:**
  - A PDF file referenced in a markdown source is copied to `assets/` and its reference rewritten.
  - An audio file (`.mp3`) referenced in markdown is copied and its reference rewritten.
  - A video file (`.mp4`) referenced in markdown is copied and its reference rewritten.
  - A generic binary file (e.g. `.zip`) referenced in markdown is copied and its reference rewritten.
  - A second reference to the same resolved source path reuses the first destination path — no second copy is made and no second `assets/` entry is created.
  - Two distinct source files with the same basename (`folder-a/map.png` and `folder-b/map.png`) are copied as `assets/map.png` and `assets/map_1.png` respectively.
  - Copying the same source path twice produces exactly one file in `assets/` (idempotent).
  - When asset reuse occurs, a log or warning entry records which source was reused and which destination it maps to.

### TT-1.4 — Link challenge unit tests
- **Source:** `docs/technical/tests.md` §3 Epic 3
- **File:** `tests/integration/output-links.test.ts` (extend)
- **Depends on:** TT-1.1, T-2.2
- **Test cases to implement:**
  - A relative markdown link (`[text](../other/file.md)`) is converted to an anchor (`[text](#slug-for-file)`) in the compiled output.
  - A bare wiki-style magic link (`[[filename]]` without path) is converted to an anchor referencing the unique matching file's slug.
  - When a bare filename matches multiple vault files, the link resolves to the lexicographically smallest path, is converted to an anchor, and a warning entry is recorded in `result.warnings`.

### TT-1.5 — Control command unit tests
- **Source:** `docs/technical/tests.md` §3 Epic 5
- **File:** `tests/unit/control-commands.test.ts` (create) and/or `tests/integration/control-commands.test.ts` (create)
- **Depends on:** T-5.1
- **Test cases to implement:**
  - A fenced block with language tag `meta-bind-embed` is absent from compiled output (no fence, no content).
  - A fenced block with language tag `leaflet` is absent from compiled output.
  - A fenced block with language tag `calendarium` is absent from compiled output.
  - A fenced block with language tag `compressed-json` is absent from compiled output.
  - A `SerializedQuery` section is replaced by the content it references rather than left as-is.
  - After compilation, no known control-fence language tag (`meta-bind-embed`, `leaflet`, `calendarium`, `compressed-json`, `query`, `SerializedQuery`) appears in the output.

### TT-1.6 — Output quality unit tests
- **Source:** `docs/technical/tests.md` §3 Epic 6
- **File:** `tests/integration/compile-basic.test.ts` (extend) and `tests/unit/heading-gen.test.ts` (create)
- **Depends on:** T-6.1, T-6.2
- **Test cases to implement:**
  - A source file whose first line is a markdown heading (`# Existing Heading`) has that line replaced by the autogenerated filename-derived heading in the compiled output; the original heading text does not appear.
  - A reference to a missing file produces the exact comment `<!-- Warning: Missing include: filename.md -->` at the include site (not just any warning string).
  - A reference to an unreadable file produces the exact comment `<!-- Warning: Unreadable file: filename.md -->` at the include site.
  - `result.stats` after a compilation contains all required fields with correct values: total file count, asset count, `mapsRendered`, `mapsDeduplicated`, warning count, and missing-reference count.

### TT-1.7 — Data safety unit tests
- **Source:** `docs/technical/tests.md` §3 Epic 8
- **File:** `tests/integration/vault-safety.test.ts` (create)
- **Depends on:** T-8.1
- **Test cases to implement:**
  - Source vault file SHA-256 hashes are unchanged after a full compilation that processes markdown files, assets and TextMapper blocks (not just the TextMapper-specific case already covered).
  - No file is created inside the source vault directory tree except under the configured output and assets paths.
  - A compilation that fails preflight (e.g. output path is inside the source directory and no override is set) does not write any output file; the output path does not exist after the failed run.
  - A TextMapper renderer that takes longer than the configured timeout is cancelled; the block is replaced with a placeholder warning comment and the compilation continues with the remaining content.

### TT-1.8 — Property-based and fuzz tests
- **Source:** `docs/technical/tests.md` §4
- **File:** `tests/fuzz/` (create directory and four files)
- **Note:** Use `node:test` + randomised inputs or a property-testing micro-library. No external fuzz framework required; 1,000 random samples per run is sufficient.
- **Test cases to implement:**
  - Fuzz `slugify` with 1,000 random strings containing Unicode, spaces, underscores, punctuation and numeric prefixes: assert the result is non-empty, contains no path separator characters, and is stable (same input → same output).
  - Fuzz `resolveMagicLink` / `resolveLinkWithObsidianCache` with random combinations of absolute, relative, `%20`-encoded, and bare filenames against a randomised vault of 10–50 files: assert the resolver never throws and always returns either a valid `TFile` or `null`.
  - Fuzz asset collision handling: generate 50–200 random filenames where many share the same basename and assert that every output path is unique, no file is silently overwritten, and all collision-suffix filenames follow the `name_N.ext` convention.
  - Fuzz TextMapper block parsing (`altForTextMapper`, `extractIncludes`, `buildPlaceholder`) with empty blocks, comment-only blocks, blocks with 0–10 random terrain labels and random `include` lines: assert no exception is thrown and the return type matches the declared signature.

### TT-1.9 — Fixture vault integration assertions
- **Source:** `docs/technical/tests.md` §5 assertions 5, 7, 8
- **File:** `tests/integration/fixture-vault.test.ts` (create); extend fixture vault with circular-include and control-command fixtures
- **Depends on:** TT-1.1, TT-1.2, TT-1.5, fixture files described below
- **Fixture additions required:**
  - Add a circular reference: have `A.md` embed `B.md` via `![[B.md]]` and `B.md` embed `A.md` via `![[A.md]]`.
  - Add an unreadable file reference: add a `![[missing.md]]` line to `index2compile.md`.
  - Add a control-command fence: add a `leaflet` fenced block to `A.md`.
- **Test cases to implement:**
  - Compiled output contains warning comments for the circular include, the missing file and the unreadable reference (assertion 5).
  - No `leaflet`, `meta-bind-embed`, `calendarium`, `compressed-json` or `SerializedQuery` fence tag appears anywhere in the compiled output (assertion 7).
  - Every embedded file whose first content line is a heading has that heading replaced by the filename-derived heading in the output; the original heading text does not appear as a top-level heading (assertion 8).

---

## Missing test tickets (from coverage audit, 2026-10-15 — round 2)

These seven tickets address the remaining gaps found after TT-1.1 through TT-1.9 were implemented.

### TT-2.1 — Repeated non-circular files are re-embedded per ToC order

- **Source:** `docs/technical/tests.md` §3 Epic 1 — "Repeated files are embedded only when required by source/ToC order."
- **File:** `tests/integration/compile-basic.test.ts` (extend)
- **Depends on:** T-1.1 (core compiler implementation)
- **Context:** The compiler uses `processedStack` (a call-stack, not a visited set) for circular detection.  A file that appears in the ToC twice via *different, non-circular paths* must be fully embedded on each occurrence; this is distinct from the circular case where the second visit is skipped.  No test currently asserts this behaviour.
- **Test cases to implement:**
  - A ToC that lists `A.md` twice (e.g. `![[A.md]]` on lines 1 and 3 of the index, with unrelated content between them) embeds `A.md`'s full content at both positions in the output.
  - After a circular include is resolved (`A → B → A` is broken at the second `A`), returning to the index and re-embedding `A` via a fresh ToC entry does embed `A` again (the stack has unwound, so `A` is no longer in `processedStack`).
  - A three-level chain (`index → A → B`) where `B` also appears as a direct ToC entry in `index` embeds `B`'s content twice: once inside `A` and once directly, in document order.

---

### TT-2.2 — External HTTP(S) links survive compilation unchanged

- **Source:** `docs/technical/tests.md` §3 Epic 3 — "External HTTP(S) links remain unchanged."
- **File:** `tests/integration/output-links.test.ts` (extend)
- **Depends on:** T-2.2 (link rewriting pass)
- **Context:** The existing "only contains portable link targets" test accepts `https://` URLs in the link-portability scan but never asserts that a specific external URL passes through verbatim.  A regression in the link rewriter could mangle or drop external links without any current test catching it.
- **Test cases to implement:**
  - A markdown link `[text](https://example.com/path?q=1)` in a compiled file appears in the output with exactly the same href — `https://example.com/path?q=1` — not rewritten to an anchor or stripped.
  - A markdown link `[text](http://insecure.example.com)` (plain HTTP) appears in the output with exactly the same href.
  - A `mailto:` link `[contact](mailto:user@example.com)` appears in the output unchanged.
  - An external link to a URL that happens to share a filename component with a vault file (e.g. `https://cdn.example.com/A.md`) is not rewritten to an anchor; it passes through as-is.

---

### TT-2.3 — `computePngDimensions` preserves aspect ratio within 1 px rounding

- **Source:** `docs/technical/tests.md` §3 Epic 4 — "`computePngDimensions` preserves aspect ratio within 1 px rounding."
- **File:** `tests/unit/textmapper.test.ts` (extend, add inside the existing `computePngDimensions` describe block)
- **Depends on:** T-4.3 (PNG dimension computation implementation)
- **Context:** The existing `computePngDimensions` tests cover landscape/portrait/square scaling to 2048 and the "no upscale" case, but none of them verify that the *aspect ratio* is maintained after integer rounding.  A broken implementation could scale width to 2048 but round height in a way that distorts the image.
- **Test cases to implement:**
  - Given a landscape SVG of 3000 × 1800 (ratio 5:3), `computePngDimensions` returns width 2048 and height in the range [1227, 1229] (2048 × 1800 / 3000 = 1228.8).
  - Given a portrait SVG of 600 × 1000 (ratio 3:5), `computePngDimensions` returns height 2048 and width in the range [1227, 1229] (2048 × 600 / 1000 = 1228.8).
  - Given an irregular SVG of 1920 × 1080, `computePngDimensions` returns width 2048 and height 1152 (2048 × 1080 / 1920 = 1152.0 exactly — no rounding needed).
  - The ratio `width / height` of the output differs from the ratio `width / height` of the input by less than `1 / max(outputWidth, outputHeight)` (i.e. at most one pixel of distortion on the long edge).

---

### TT-2.4 — Fixture vault: compiled output contains all files in index order

- **Source:** `docs/technical/tests.md` §5 assertion 1 — "The compiled output contains all included files in order."
- **File:** `tests/integration/fixture-vault.test.ts` (extend, add inside the existing describe block)
- **Depends on:** TT-1.9 (fixture vault test infrastructure already set up)
- **Context:** The fixture vault integration test currently checks warnings, fence removal, and heading replacement but does not assert that the index's ToC entries appear in document order.  A bug that re-ordered or dropped a non-circular, non-missing entry would go undetected.
- **Test cases to implement:**
  - The compiled output from `index2compile.md` contains a section derived from `A.md` before a section derived from `B.md` (i.e. the first occurrence of "Hello from B." follows the first content unique to A, reflecting ToC order).
  - The position of `region-map.md`'s content in the output comes after the content of both `A.md` and `B.md`, matching its position as the third entry in the index.
  - `result.stats.filesProcessed` equals the number of successfully embedded files (A, B, region-map, and the index itself, minus the missing `missing.md`) — confirming no silent drop.

---

### TT-2.5 — Fixture vault: assets are copied once and referenced correctly

- **Source:** `docs/technical/tests.md` §5 assertion 3 — "Assets are copied once and referenced correctly."
- **File:** `tests/integration/fixture-vault.test.ts` (extend)
- **Depends on:** TT-1.9
- **Context:** `media.png` is referenced in the fixture vault and is a deduplicated asset case (same file referenced from multiple places).  No fixture-vault assertion currently checks the `stats.assetsCopied` count or that the output contains an `assets/` reference for `media.png`.
- **Test cases to implement:**
  - `result.stats.assetsCopied` is at least 1 after compiling the fixture vault (one unique asset source was processed).
  - The compiled output contains at least one `assets/media.png` reference (or `assets/media_N.png` if a collision suffix was applied), confirming the asset path rewrite is in effect.
  - `result.stats.assetsDeduplicated` is 0 or greater and does not exceed the number of times `media.png` is referenced minus 1 (i.e. deduplication count is consistent with reference count).

---

### TT-2.6 — Fixture vault: in-vault links become anchor links

- **Source:** `docs/technical/tests.md` §5 assertion 4 — "Anchor links point to generated slugs."
- **File:** `tests/integration/fixture-vault.test.ts` (extend)
- **Depends on:** TT-1.9
- **Context:** `A.md` contains `- [[B]]`, a bare wiki link that should become an anchor pointing to B's slug.  No fixture-vault test currently verifies that internal links are converted to anchors.
- **Test cases to implement:**
  - The compiled output does not contain any `[[...]]` wiki link syntax (all wiki links have been rewritten).
  - The compiled output contains an anchor link matching `[B](#b)` or `[B](#b-<slug>)` (the exact slug depends on the heading generator), confirming the `[[B]]` link in `A.md` was rewritten.
  - The compiled output contains no markdown link whose `href` is a `.md` filename (e.g. `[text](A.md)` must not appear); all internal `.md` hrefs have been converted to `#slug` anchors.

---

### TT-2.7 — Fixture vault: TextMapper block produces a PNG ref or placeholder

- **Source:** `docs/technical/tests.md` §5 assertion 6 — "TextMapper output contains either a PNG reference or placeholder warning."
- **File:** `tests/integration/fixture-vault.test.ts` (extend)
- **Depends on:** TT-1.9; the `region-map.md` fixture file already contains a `text-mapper` block
- **Context:** `region-map.md` has a `text-mapper` fenced block.  The fixture-vault test must confirm this block was processed — either rendered to a PNG (if a renderer is available) or replaced by a placeholder warning comment.  Currently no assertion touches the TextMapper outcome at all, so a regression that left the raw fence in place would go undetected.
- **Test cases to implement:**
  - The compiled output does not contain a raw ` ```text-mapper ``` ` fence from `region-map.md` (the block has been processed regardless of renderer availability).
  - The compiled output contains *either* a markdown image reference `![...](assets/textmapper/...)` *or* a warning comment matching `<!--.*Warning.*TextMapper.*-->` (placeholder path), but not both and not neither.
  - If the test environment has no `TextMapperRenderer` configured (i.e. the compiler is constructed without a `renderer` option), the output contains the placeholder warning comment and `stats.mapsRendered` equals 0.

---

### T-8.4 — Track link/embed provenance through the full compilation pipeline

- **Source:** US-8.4 (amended — source location must always refer to the original vault file)
- **Files:** `plugin/src/compiler.ts`
- **Depends on:** T-2.1, T-5.1

- **Problem:** `convertLinks` and `verifyOutputLinks` run on the already-assembled compiled output. When they detect a broken or unresolvable link they emit a `WarningDetail` with `file: 'compiled-output'` and a line number within the merged document. That is not useful to the user — they need to know which vault file the bad link came from, not where it landed in the output.

- **Root cause:** By the time `convertLinks` runs, the content from all source files has been concatenated. There is no in-band marker left that links a character position in the merged string back to the source file that contributed it.

- **Required change:** Introduce a provenance-tracking mechanism so that every link or embed processed in post-assembly passes can be attributed to its original vault source file and line.

  Possible approaches (choose one):
  1. **Inline sentinel comments** — after assembling each file's content block, prefix it with a hidden HTML comment `<!-- source: path/to/file.md -->`. Post-processing passes can scan backwards from the warning position to find the nearest sentinel and extract the vault path and recompute the line offset within that block.
  2. **Offset map** — after assembly, build a sorted array of `{ startOffset, endOffset, vaultPath }` entries. Post-processing passes look up the character offset of any warning in this map to retrieve the originating vault path and line.
  3. **Pre-pass before assembly** — move all link validation into the per-file `processMarkdown` stage (before assembly), where the current vault path is already known. This eliminates the need for provenance tracking at the cost of detecting only links that are invalid at parse time, not links that become invalid because a referenced heading doesn't exist in the final assembled output.

- **Acceptance criteria:**
  - No `WarningDetail` entry in any `CompileResult` has `file === 'compiled-output'`.
  - Every `WarningDetail` entry has a `file` that is a valid vault-relative path of a file that exists in the vault, and a `line` that is the 1-based line number within that source file where the offending link appears.
  - The existing warning-detail tests continue to pass.
  - A new unit test: a vault containing `A.md` (with a broken `[[missing]]` link) and `index.md` (embedding `A.md`) produces a `WarningDetail` with `file === 'A.md'` and `line === <correct line>`, not `file === 'compiled-output'`.

---

> **Renumbered 2026-10-27.** The heading tickets below were filed as TT-7.1-*,
> T-7.2-* and T-7.3-* against US-7.1/7.2/7.3. They now belong to US-6.3, US-6.4
> and US-6.5 in `docs/user-stories/userstories.md`, which is authoritative. Where
> a ticket disagrees with the story, the story wins; in particular, anchor embeds
> **are** pass-throughs (US-6.5 AC-6, changed in v0.10.0), unlike T-6.5-A/B/C below.

## TT-6.3-A — Prefix parser (`parsePrefixDepth`)

- **Source:** US-6.3
- **Branch:** feature/heading-normalisation
- **Description:** Implement a pure function `parsePrefixDepth(filename: string): number | null` that extracts the numeric prefix from a filename and returns the number of segments (depth), or `null` if no valid prefix is present.
  - Strip leading zeros from each segment before counting: `01.03.02 Title.md` → depth 3.
  - Only an all-numeric dot-separated prefix at the start of the basename qualifies.
  - Return `null` for filenames with no such prefix.
- **Acceptance criteria:**
  - `parsePrefixDepth('1 Title.md')` → 1
  - `parsePrefixDepth('1.3 Title.md')` → 2
  - `parsePrefixDepth('1.3.2 Title.md')` → 3
  - `parsePrefixDepth('01.03.02 Title.md')` → 3
  - `parsePrefixDepth('Overview.md')` → null
  - `parsePrefixDepth('Magic.md')` → null

---

## TT-6.3-B — Heading offset algorithm (`normaliseHeadings`)

- **Source:** US-6.3
- **Branch:** feature/heading-normalisation
- **Description:** Implement `normaliseHeadings(content: string, targetDepth: number, parentDepth: number): { content: string; clamped: boolean }` that:
  1. Finds the first heading in `content` and removes it (option b — replaced by the caller with a filename-derived heading at `targetDepth`).
  2. Computes `offset = targetDepth − firstHeadingLevel` and applies it to all remaining headings.
  3. Clamps any resulting heading level to [1, 6]; sets `clamped = true` if any clamping occurred.
  4. Inversion clamping: if `targetDepth < parentDepth + 1`, use `parentDepth + 1` instead and set `clamped = true`.
  5. If `content` contains no headings, returns it unchanged with `clamped = false`.
- **Acceptance criteria:** covered by TT-6.3-A/B unit tests and the integration test suite.

---

## TT-6.3-C — Compiler integration (toggle + option)

- **Source:** US-6.3
- **Branch:** feature/heading-normalisation
- **Description:** Wire the normalisation into `InMemoryVaultCompiler`:
  - Add `normaliseHeadings?: boolean` to `CompilerOptions`. Default `false`.
  - Add `parentDepth: number` parameter to `processMarkdown()` (internal); root call passes 0.
  - When `normaliseHeadings` is on, after processing a file's raw content and before returning from `processMarkdown()`:
    1. Determine `targetDepth` from `parsePrefixDepth(basename)` or `parentDepth + 1` if null.
    2. Apply inversion floor: `effectiveDepth = max(targetDepth, parentDepth + 1)`.
    3. Call `normaliseHeadings(content, effectiveDepth, parentDepth)`.
    4. Prepend the filename-derived heading at `effectiveDepth`.
    5. If `clamped`, push a `WarningDetail`.
  - Pass `effectiveDepth` as the `parentDepth` for any recursive embeds within the file.
- **Acceptance criteria:** all 25 heading-normalisation integration tests pass; all 289 prior tests remain green.

---

## TT-6.3-D — Section embed normalisation

- **Source:** US-6.3
- **Branch:** feature/heading-normalisation
- **Description:** When `normaliseHeadings` is on and a heading-anchored embed (`![[file.md#Heading]]`) is processed, the extracted section's headings must be shifted so the shallowest maps to `embeddingFileDepth + 1`. The target file's own prefix is not consulted for section embeds.
- **Acceptance criteria:** the two section-embed normalisation integration tests pass.

---

## TT-6.3-E — Settings UI toggle

- **Source:** US-6.3
- **Branch:** feature/heading-normalisation
- **Description:** Add a "Normalise headings" toggle to the Obsidian plugin settings panel (`plugin/src/main.ts`). The setting is stored in `VaultCompilerSettings` as `normaliseHeadings: boolean` (default `false`) and passed to `InMemoryVaultCompiler` as `options.normaliseHeadings`.
- **Acceptance criteria:** toggle appears in plugin settings; toggling it persists across Obsidian restarts; compiling with it on/off produces the expected output.

---

## US-6.4 — Preamble heading injection

These tickets implement US-6.4: when `normaliseHeadings` is on and an embedded file
does not start with a heading, a filename-derived title is injected before its content.
They must be implemented in order; each ticket's AC references the test suite added in
the test-writing pass.

### T-6.4-A — Extend `applyHeadingNormalisation` to handle preamble files

- **Source:** US-6.4 | AC-1, AC-4, AC-5, AC-6, AC-7
- **Branch:** `feature/preamble-heading-injection`
- **File:** `plugin/src/compiler.ts` — `applyHeadingNormalisation`
- **Depends on:** T-6.4-B (needs `lastOriginalHeadingLevel` parameter available before this can fully work for no-prefix files; prefix-only cases can be implemented first)

**Description:**

Extend `applyHeadingNormalisation` to accept a new parameter `titleDepth: number`
representing the level at which the injected title should appear.  The caller
(T-6.4-D) is responsible for computing `titleDepth`; this method is responsible
only for injecting the title and shifting internal headings consistently.

New signature:

```typescript
/**
 * US-6.4 | AC-1, AC-4, AC-5, AC-6, AC-7.
 *
 * Normalises the headings in `content` for the given `targetDepth` (existing
 * US-6.3 behaviour for files that start with a heading) and, when the file
 * starts with non-heading content (preamble), injects a filename-derived title
 * at `titleDepth` before the preamble (US-6.4 extension).
 *
 * Internal headings always shift uniformly so the first internal heading maps
 * to titleDepth + 1.  Headings that exceed h6 after shifting are clamped to h6
 * and `clamped` is set true.
 */
private applyHeadingNormalisation(
  content: string,
  targetDepth: number,
  filePath: string,
  titleDepth: number,   // ← new: injected title level for preamble files
): { content: string; clamped: boolean }
```

**Algorithm change (preamble branch):**

When `content`'s first non-empty line is NOT a heading (`startsWithHeading` returns
false, or there are no headings at all):

1. Derive the title text from `filePath` using the existing `titleFromFilename` helper.
2. Clamp `titleDepth` to [1, 6]; set `clamped = true` if `titleDepth > 6`.
3. Prepend `'#'.repeat(clampedTitleDepth) + ' ' + title + '\n'` to `content`.
4. Shift all internal headings uniformly so the first internal heading maps to
   `clampedTitleDepth + 1`:
   - If there are no internal headings, the content is appended after the title unchanged.
   - Otherwise: `shift = (clampedTitleDepth + 1) - firstInternalHeadingLevel`.
     Apply `shift` to every internal heading; clamp results to [1, 6].

The existing heading-first branch (US-6.3 behaviour) is unchanged.

**Acceptance criteria:**
- AC-1: prefix preamble file gets title at prefix depth (verified by T-6.4-D passing
  the prefix depth as `titleDepth`).
- AC-4: internal headings shift so first → `titleDepth + 1`.
- AC-5: preamble text is preserved between the injected title and the first internal heading.
- AC-6: headingless file (no internal headings at all) gets a title; its text follows verbatim.
- AC-7: headings exceeding h6 are clamped; a `WarningDetail` is emitted by the caller.

---

### T-6.4-B — Add `lastOriginalHeadingLevel` context to `processMarkdown`

- **Source:** US-6.4 | AC-2, AC-3, AC-10
- **Branch:** `feature/preamble-heading-injection`
- **File:** `plugin/src/compiler.ts` — `processMarkdown`, `processWikiEmbeds`,
  `processMarkdownEmbeds`
- **Depends on:** nothing (pure parameter threading)

**Description:**

No-prefix preamble files need to know the output level of the last heading that
appeared *literally* in the embedding file above the embed point, so their title can
be placed at `lastOriginalHeadingLevel + 1`.  This requires threading a new parameter
through the call chain and updating it as the embedding file's own headings are
encountered, before each embed expansion.

**Changes required:**

1. Add `lastOriginalHeadingLevel = 0` to `processMarkdown`'s parameter list.
   `0` is the sentinel meaning "no prior heading" (yields title at h1 = 0 + 1).

2. Refactor the embed-expansion loop inside `processMarkdown` from a single
   regex-replace pass to a **sequential scan**:

   - Split the (already heading-normalised) content on embed markers.
   - For each segment *between* embed markers, scan for the last heading in that
     segment (these are original headings already shifted to their output level).
   - Update a running `currentLastHeading: number` tracker.
   - When an embed marker is reached, call `processMarkdown(embeddedPath, true,
     effectiveDepth, currentLastHeading)` so the embedded file knows what heading
     level last appeared.

   Note: `currentLastHeading` must only be updated by headings from the *current
   file's own content*, not from headings returned by recursive `processMarkdown`
   calls (those are "imported" headings and must not update the tracker — AC-10).

3. The root call in `compile()` passes `lastOriginalHeadingLevel = 0`.

**Acceptance criteria:**
- AC-2: no-prefix preamble gets title at (last original heading, output level) + 1.
- AC-3: when no heading precedes the embed in the parent file, title defaults to h1.
- AC-10: headings imported by a prior embed do not update `currentLastHeading` and
  do not affect the title level of subsequent no-prefix preamble embeds.

---

### T-6.4-C — Compute `titleDepth` in `processMarkdown` and wire to T-6.4-A

- **Source:** US-6.4 | AC-1, AC-2, AC-3, AC-8, AC-9
- **Branch:** `feature/preamble-heading-injection`
- **File:** `plugin/src/compiler.ts` — `processMarkdown` (heading normalisation block)
- **Depends on:** T-6.4-A (extended `applyHeadingNormalisation`), T-6.4-B
  (`lastOriginalHeadingLevel` parameter available)

**Description:**

In the heading normalisation block of `processMarkdown` (currently guarded by
`this.options.normaliseHeadings === true && autoHeading`), add the preamble
detection and `titleDepth` calculation before calling `applyHeadingNormalisation`.

**Algorithm:**

```typescript
// US-6.4 | AC-1, AC-2, AC-3: compute titleDepth for preamble files.
const isPreamble = !startsWithHeading(content);

let titleDepth: number;
if (isPreamble) {
  if (prefixDepth !== null) {
    // AC-1: prefix file — title at prefix depth (same as targetDepth after floor-clamp).
    titleDepth = effectiveDepth;
  } else {
    // AC-2 / AC-3: no-prefix file — one below last original heading, or h1.
    titleDepth = lastOriginalHeadingLevel + 1;
  }
} else {
  // US-6.3 path: file starts with a heading; title is handled inside
  // applyHeadingNormalisation as before.
  titleDepth = effectiveDepth;
}

const { content: normContent, clamped } = this.applyHeadingNormalisation(
  content, targetDepth, path, titleDepth,
);
```

Emit a `WarningDetail` when `clamped` is true (unchanged from US-6.3).

After injection, `effectiveDepth` for the purposes of child embed calls is:
- For preamble files: `titleDepth` (the injected title is the section anchor for children).
- For heading-first files: unchanged (`effectiveDepth = targetDepth` as today).

**Acceptance criteria:**
- AC-1: prefix preamble title appears at prefix depth.
- AC-2: no-prefix preamble title appears at last output heading + 1.
- AC-3: no-prefix preamble with no prior heading gets title at h1.
- AC-8: when `normaliseHeadings` is false, `isPreamble` detection is never reached;
  no title is injected.
- AC-9: child embeds inside a preamble file receive `titleDepth` as their
  `parentDepth`, so their normalisation is anchored correctly.

---

### T-6.4-D — Update `effectiveDepth` for child embeds of preamble files

- **Source:** US-6.4 | AC-9
- **Branch:** `feature/preamble-heading-injection`
- **File:** `plugin/src/compiler.ts` — `processMarkdown` (post-normalisation block)
- **Depends on:** T-6.4-C

**Description:**

After `applyHeadingNormalisation` returns for a preamble file, `effectiveDepth` must
be updated to `titleDepth` before being passed to `processWikiEmbeds` and
`processMarkdownEmbeds`.  This ensures that child files embedded within a preamble
file treat the injected title as their parent heading context.

```typescript
// US-6.4 | AC-9: for preamble files the effective parent depth for children
// is the injected title's depth, not the prefix-derived targetDepth.
if (isPreamble) {
  effectiveDepth = titleDepth;
}

content = this.processWikiEmbeds(content, path, effectiveDepth);
content = this.processMarkdownEmbeds(content, path, effectiveDepth);
```

**Acceptance criteria:**
- AC-9 (canonical example): `2.2.2 Third-Level.md` title h3 → internal `# Heading`
  → h4; `Detailbit.md` title h5 (last output heading h4 + 1) → internal
  `# Heading inside Detail` → h6.

---

### T-6.4-E — Update heading-normalisation tests for US-6.4 behaviour

- **Source:** US-6.4 | AC-6 (headingless), AC-5 (preamble with heading)
- **Branch:** `feature/preamble-heading-injection`
- **File:** `tests/integration/heading-normalisation.test.ts`
- **Status:** ✅ Already done during the test-writing pass (2026-10-16).
  Tests 5 and 6 in the `heading normalisation: heading replacement` suite have
  been renamed and updated.  No further changes needed.

**Summary of changes made:**
- Test 5 ("file with no headings includes text as-is, no heading injected") →
  renamed "headingless prefix file gets title injected at prefix depth (updated by
  US-6.4)" and now asserts `### Magic` is injected.
- Test 6 ("text before the first heading is preserved and not affected by
  normalisation") → renamed "preamble prefix file: title injected at prefix depth,
  text preserved, internal heading below title (updated by US-6.4)" and now asserts
  the title at h2, preamble text preserved, internal heading at h3, and ordering.

---

### T-6.4-F — Run full test suite and verify 338 tests pass

- **Source:** US-6.4 | All ACs
- **Branch:** `feature/preamble-heading-injection`
- **Depends on:** T-6.4-A, T-6.4-B, T-6.4-C, T-6.4-D, T-6.4-E

**Description:**

After implementing T-6.4-A through T-6.4-D, run the full test suite and confirm:

```bash
cd plugin && npm test
# tests 338
# pass 338
# fail 0
```

If any test outside the new 24 fails, investigate regressions before proceeding.
If any of the 24 new US-6.4 tests still fail, the corresponding ticket's AC was not
met.

Once green:
1. Bump the version by `0.1` (new feature): update `manifest.json`, `package.json`,
   `versions.json`.
2. Build and lint: `npm run build && npm run lint`.
3. Deploy to the example vault (`Example Vault`).
4. Write `claude/v0.8.0-release.md` in the project.

---

## US-6.5 — Pass-through embed

---

### T-6.5-A — Add `isEffectivelyHeadingFirst` helper

- **Source:** US-6.5 | recursive definition
- **Branch:** `feature/pass-through-embed`
- **File:** `plugin/src/compiler.ts` — new private method, before `parsePrefixDepth`
- **Depends on:** T-6.4-F (US-6.4 complete)

**Description:**

Add a new private helper that answers whether a file, when expanded, produces a
heading at its own top level — either because it directly starts with a heading,
or because it is itself a pass-through wrapper to something that does (recursive).

```typescript
private isEffectivelyHeadingFirst(path: string, visited: Set<string>): boolean {
  if (visited.has(path)) return false;
  if (!this.files.has(path)) return false;
  const content = this.files.get(path)!;
  if (startsWithHeading(content)) return true;
  // Check for single-embed pass-through (strip whitespace, match one non-anchor embed)
  const stripped = content.replace(/\s/g, '');
  const wikiMatch = stripped.match(/^!\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]$/);
  let rawLink: string | null = wikiMatch ? wikiMatch[1] : null;
  if (!rawLink) {
    const mdMatch = stripped.match(/^!\[[^\]]*\]\(([^)#]+\.md)\)$/);
    rawLink = mdMatch ? mdMatch[1] : null;
  }
  if (!rawLink) return false;
  const resolved = this.resolve(rawLink.trim(), path);
  if (resolved.missing || !this.isMarkdownPath(resolved.path)) return false;
  visited.add(path);
  return this.isEffectivelyHeadingFirst(resolved.path, visited);
}
```

The `visited` set prevents infinite loops through circular chains. The caller
passes a `new Set([currentFile])` so the file currently being processed is also
in the guard.

**Acceptance criteria:**
- Returns `true` for a heading-first file.
- Returns `true` for a file that is a single-embed pass-through to a heading-first file.
- Returns `true` for a chain A → B → C where all links are pass-throughs and C starts with a heading.
- Returns `false` for a preamble-starting file, a headingless file, a file with ≥ 2 embeds, or an anchor embed.
- Returns `false` (not infinite-loops) for a circular chain.

---

### T-6.5-B — Add `tryPassThrough` helper

- **Source:** US-6.5 | trigger condition and expansion rule
- **Branch:** `feature/pass-through-embed`
- **File:** `plugin/src/compiler.ts` — new private method, before `parsePrefixDepth`
- **Depends on:** T-6.5-A

**Description:**

Add a helper that checks whether the current file's content qualifies as a
pass-through and, if so, produces the expanded result directly.

```typescript
private tryPassThrough(
  content: string,
  currentFile: string,
  targetDepth: number,
  lastOriginalHeadingLevel: number,
): string | null {
  const stripped = content.replace(/\s/g, '');
  const wikiMatch = stripped.match(/^!\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]$/);
  let rawLink: string | null = wikiMatch ? wikiMatch[1] : null;
  if (!rawLink) {
    const mdMatch = stripped.match(/^!\[[^\]]*\]\(([^)#]+\.md)\)$/);
    rawLink = mdMatch ? mdMatch[1] : null;
  }
  if (!rawLink) return null;
  const resolved = this.resolve(rawLink.trim(), currentFile);
  if (resolved.missing || !this.isMarkdownPath(resolved.path)) return null;
  if (!this.isEffectivelyHeadingFirst(resolved.path, new Set([currentFile]))) return null;
  // Expand target at this file's assigned depth.
  // parentDepth = targetDepth - 1 so that target's own heading computation
  // places the first heading at targetDepth.
  return this.processMarkdown(
    resolved.path,
    true,
    Math.max(0, targetDepth - 1),
    lastOriginalHeadingLevel,
  );
}
```

**Acceptance criteria:**
- Returns `null` when content has any non-whitespace besides one embed, has multiple embeds, has an anchor embed, or the target is not effectively heading-first.
- Returns the target's processed content (with headings at `targetDepth`) when the pass-through condition is met.

---

### T-6.5-C — Wire pass-through check into `processMarkdown`

- **Source:** US-6.5 | AC-1 through AC-9
- **Branch:** `feature/pass-through-embed`
- **File:** `plugin/src/compiler.ts` — `processMarkdown`, inside the `normaliseHeadings` block
- **Depends on:** T-6.5-A, T-6.5-B

**Description:**

After computing `targetDepth` / `effectiveDepth` (including any floor clamping)
but before the `isPreamble` check and `applyHeadingNormalisation`, insert the
pass-through detection:

```typescript
effectiveDepth = targetDepth;

// US-6.5: detect pass-through wrapper — single-embed file whose target
// is effectively heading-first. Skip preamble injection for this file
// and expand the target directly at this file's assigned depth.
const passThroughResult = this.tryPassThrough(content, path, targetDepth, lastOriginalHeadingLevel);
if (passThroughResult !== null) {
  this.processedStack.pop();
  return passThroughResult;
}

// US-6.4: rest of preamble injection...
const isPreamble = !startsWithHeading(content);
```

The `this.processedStack.pop()` before the early return mirrors the existing
pattern for other early exits (e.g. the binary-file guard) to keep the stack
consistent.

**Acceptance criteria:**
- AC-1: whitespace-only + single embed + heading-first target → no title for A, B's heading at A's depth.
- AC-2: own content + embed → A gets preamble title (unchanged US-6.4 behaviour).
- AC-3: multiple embeds → A gets preamble title (unchanged).
- AC-4/5: preamble-starting or headingless target → A gets preamble title (unchanged).
- AC-6: anchor embed → A gets preamble title (unchanged).
- AC-7: prefix depth preserved — B's heading at A's prefix depth.
- AC-8: recursive chain A → B → C collapses correctly.
- AC-9: pass-through result does not update `lastOriginalHeadingLevel` in the embedding file.
- AC-10: no pass-through when `normaliseHeadings` is false.

---

### T-6.5-D — Write US-6.5 tests (TDD)

- **Source:** US-6.5 | all ACs
- **Branch:** `feature/pass-through-embed`
- **File:** `tests/integration/pass-through-embed.test.ts`
- **Status:** ✅ Written 2026-10-16 (19 tests across 10 describe blocks).

**Summary:** One describe block per AC (AC-1 through AC-10). Tests for AC-1, AC-7,
and AC-8 (positive cases) were failing before implementation; all 19 pass after.

---

### T-6.5-E — Run full test suite and verify 357 tests pass

- **Source:** US-6.5 | All ACs
- **Branch:** `feature/pass-through-embed`
- **Depends on:** T-6.5-A, T-6.5-B, T-6.5-C, T-6.5-D
- **Status:** ✅ Complete 2026-10-16 (357/357, 0 failures).

**Description:**

After implementing T-6.5-A through T-6.5-C, run the full test suite and confirm:

```bash
cd plugin && node --loader ../txt-loader.mjs --experimental-strip-types --test '../tests/**/*.test.ts'
# tests 357
# pass 357
# fail 0
```

Once green:
1. Build and lint: `npm run build && npm run lint`.
2. Deploy to the example vault (`Example Vault`).
3. Write `claude/v0.9.0-release.md` in the project.

---

## Heading decisions of 2026-10-27 (v0.11.0)

Implements OD-1 to OD-6 and fixes KD-1 (US-6.1, US-6.3 to US-6.5, US-2.3).
Tests written first and red on 2026-10-27 (49 integration tests plus
`tests/unit/title.test.ts`). Class search (SCAR-017): every place that derives
a title or a heading depth in `plugin/src/compiler.ts` —
`titleFromFilename` (5 call sites: pass-through `headingMap`, the three
auto-heading branches, `convertLinks` label/slug), the inline title in
`applyHeadingNormalisation`, the three `targetDepth` branches, the
pass-through `ptTargetDepth`, `shiftSectionHeadings` (two callers) and the
inline section shift of the anchor pass-through.

### T-6.4-G — One title rule
- **Source:** US-6.4 title rule, US-6.1 AC-1, US-2.3, KD-1.
- **Change:** add `titleFromBasename` to `utils.ts` with its transforms listed
  (SCAR-001); use it for every injected or replaced heading, US-6.1 headings,
  `headingMap`, and link labels and slugs. Remove `titleFromFilename`.
- **Tests:** `tests/unit/title.test.ts`, `tests/integration/heading-anchors.test.ts`.
- **Status:** Done 2026-10-27 (v0.11.0).

### T-6.1-B — "Off" means US-6.1
- **Source:** US-6.1, US-6.3 AC-1 (OD-4).
- **Change:** normalise only when `normaliseHeadings === true`; otherwise apply
  US-6.1 (also for `false`, which the plugin passes).
- **Tests:** `tests/integration/auto-heading.test.ts` (both `false` and absent).
- **Status:** Done 2026-10-27 (v0.11.0).

### T-6.3-F — The title replaces the first heading
- **Source:** US-6.3 AC-6 (OD-1).
- **Change:** in `applyHeadingNormalisation`, the heading-first branch replaces
  the first heading line with the title at the depth and shifts the rest.
- **Tests:** heading-normalisation AC-1, AC-6, "multiple headings".
- **Status:** Done 2026-10-27 (v0.11.0).

### T-6.3-G — One depth rule for unprefixed files, per embed position
- **Source:** US-6.3 AC-4 (OD-2), US-6.4 AC-2/AC-3/AC-10, US-6.5 depth.
- **Change:** depth = last original heading + 1, else parent depth + 1, for
  heading-first, preamble and pass-through files. The heading context is
  taken at each embed's own line: embeds are expanded line by line while the
  original headings are tracked, instead of by index into a list that image
  and section embeds did not consume (they shifted later embeds' context).
- **Tests:** heading-normalisation AC-4 (six tests), AC-11.
- **Status:** Done 2026-10-27 (v0.11.0).

### T-6.3-H — Section embeds at the AC-4 depth, both ways
- **Source:** US-6.3 AC-7 (OD-3), US-6.5 AC-6.
- **Change:** one helper shifts a section so its shallowest heading lands at a
  given depth (up or down, h1–h6 clamp with a warning); used by wiki and
  markdown section embeds and by the anchor pass-through. Remove
  `shiftSectionHeadings`.
- **Tests:** heading-normalisation AC-4 section tests, section embed (root).
- **Status:** Done 2026-10-27 (v0.11.0).

### T-6.5-F — A pass-through shows the target as if embedded at the wrapper depth
- **Source:** US-6.5 "What the pass-through produces" (OD-6).
- **Change:** expand a whole-file target with a forced depth (its own prefix
  and the floor are not consulted); the target's title replaces its first
  heading; `headingMap` of the wrapper is the heading the pass-through shows.
- **Tests:** pass-through AC-1 to AC-9 and the three OD-6 tests.
- **Status:** Done 2026-10-27 (v0.11.0).

## Output location (v0.12.0, found 2026-10-27)

### T-0.3-A — Absolute output folder wrote into the vault; one output writer for every write
- **Source:** US-0.3 AC-OL-1 to AC-OL-7, US-8.1 AC-8.1-W and AC-8.1-V, US-7.1.
- **Issue:** With the output folder `/Users/user/Desktop` (chosen with
  `Browse`), a compile in v0.10.0 wrote `Users/user/Desktop/Vault of
  Book.md`, `Users/user/Desktop/assets/…` and
  `Users/user/Desktop/warnings_20261027_1106.md` **into the vault**. That
  folder is still in the example vault; it is the user's to remove.
- **Root cause:** `getOutputPath()` joined the folder and filename as text and
  every `ensureFolder` split on `/` and dropped empty segments, so the leading
  `/` vanished. No write checked its path against the configured location.
- **Decision (user, 2026-10-27):** an absolute folder outside the vault is
  written there with Node.js `fs` on the desktop app (new feature, so v0.12.0);
  `..`, `~`, backslashes in vault paths, path-like filenames, the config folder
  and the starting file are refused before anything is read or written.
- **Write-call inventory (SCAR-017, grep for `create(`, `createBinary(`,
  `modify(`, `createFolder(`, `fs.` writes in `plugin/src/`):**
  | File | Call | Decision |
  |---|---|---|
  | `main.ts` `ensureFolder` | `vault.createFolder` (output folder, `assets/`) | moved to `OutputWriter.ensureFolder` |
  | `main.ts` `writeText` | `vault.modify` / `vault.create` (output file, warnings logfile) | moved to `OutputWriter.writeText` |
  | `assets.ts` `ensureFolder`, `copy` | `vault.createFolder`, `vault.createBinary` (copied assets) | `copy` now calls `OutputWriter.writeBinaryIfAbsent`; own `ensureFolder` removed |
  | `textmapper.ts` `writePngFromSvg`, `ensureFolder` | `vault.createBinary`, `vault.createFolder` (rendered PNGs) | now `OutputWriter.writeBinaryIfAbsent`; own `ensureFolder` removed |
  | `textmapper.ts` `renderTextMapperBlock` | `fs.mkdirSync`, `fs.writeFileSync`, `fs.unlinkSync` under `os.tmpdir()` | not affected: temp folder, never the vault or the output folder |
  | `main.ts` `chooseOutputFolder` | stores the picked folder; prefix test `startsWith(vaultRoot)` without a separator | uses `vaultRelativeFromAbsolute` (AC-OL-3) |
- **Change:** new `plugin/src/output-location.ts` (`resolveOutputLocation`,
  `vaultRelativeFromAbsolute`, `joinOutputPath`) and
  `plugin/src/output-writer.ts` (`OutputWriter`, which runs `assertAllowed`
  before every write). `compileVault` resolves the location first and refuses
  with `Compilation not started: <reason>`; the overwrite question uses
  `OutputWriter.exists`, so it also covers a file outside the vault; the vault
  check after the compile ignores only `OutputWriter.isOutputPath` paths.
  `Browse` also updates the folder field it belongs to, so the export prompt no
  longer saves its old field text over the picked folder.
- **Tests:** `tests/unit/output-location.test.ts` (every AC-OL row),
  `tests/unit/output-writer.test.ts` (every AC-8.1-W row with a fake vault and
  with real `fs` in a temp folder; the write-call guard over `plugin/src/`).
- **Not measured (SCAR-024):** whether Obsidian's vault API resolves a `..`
  segment out of the vault (it is refused before it gets there); Windows
  paths are tested as strings only, not on Windows.
- **Not in this ticket (follow-ups):** the export prompt and the context menu
  still save the folder, filename and starting file to the settings, against
  US-7.2 and US-7.3; the settings text fields save on every key.

## Frontmatter (v0.13.0, found 2026-10-27)

### T-5.2-A — YAML frontmatter leaks into the compiled document
- **Source:** US-5.2 AC-1 to AC-13; touches US-1.3, US-6.1, US-6.3 AC-6/AC-7,
  US-6.4, US-6.5, US-8.4.
- **Issue:** The compiler did not recognise frontmatter. In v0.12.0 an embedded
  note `---` / `tags:` / `  - ElementalMagic` / `---` / `Spell text.`
  compiled to `# Ice Crystal` followed by the raw YAML; the note counted as a
  preamble file because its first line was `---`. In the example vault, 93
  frontmatter blocks (all `tags:` on spell notes) reached the compiled
  rulebook with either toggle value, adding 186 `---` lines.
- **Decision (user, 2026-10-27):** drop all frontmatter; no field goes into
  the output. A `#tag` line and an italic `Tags:` line under the title were
  measured on the real vault and declined.
- **Read inventory (SCAR-017, grep for `this.files.get(` in
  `plugin/src/compiler.ts`):**
  | Place | Use | Decision |
  |---|---|---|
  | `processMarkdown` | every note's text, before all rules | now `readNote` |
  | `isEffectivelyHeadingFirst` | first non-empty line and wrapper shape (US-6.5) | now `readNote` |
  | `resolve`, `compile`, `compileAsync` | `this.files.has(` only, no text | not affected |
  | `main.ts`, `tests/manual-compile.mjs` | build the file map from the vault | not affected: the compiler strips on read, so every caller gets the rule |
- **Change:** `splitFrontmatter` in `utils.ts` (documented transforms,
  SCAR-001); `InMemoryVaultCompiler.readNote` is the only place that reads note
  text. `processMarkdown` adds the removed line count (and subtracts an
  injected title line) when it records embed warnings, so their line numbers
  are source lines (AC-12).
- **Tests:** `tests/unit/frontmatter.test.ts` (the rule),
  `tests/integration/frontmatter.test.ts` (AC-1 to AC-13, every AC with both
  toggle values, and a text check that `this.files.get(` occurs once, in
  `readNote`).
- **Guards searched (SCAR-023):** the change adds no write, network or vault
  call; no existing guard forbids it.
- **Not measured (SCAR-024):** Obsidian's own handling of a closing `...`, a
  byte-order mark or a first line `---` with trailing whitespace.
- **Not in this ticket:** warnings from the passes over the assembled output
  (`convertLinks`) keep their approximate line numbers, as before.
- **Status:** Done 2026-10-27 (v0.13.0).
