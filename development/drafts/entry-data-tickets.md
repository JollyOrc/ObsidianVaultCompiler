# Draft tickets — Entry data from note properties (epic #108)

**Status:** filed 2026-11-07 as #109 to #116 (see each ticket). Drafted 2026-11-05. Amended 2026-11-05 with the answers to the step-0 questions (A1 to A9 for the shared block contract, B1 to B8 for this plugin). Each amended draft cites its answer as G0-xx. The behaviour spec is "Bestiary Layout User Stories" in the private spec repository (BL-B1 to BL-B5); the stories written at step 1 restate it in generic terms.

These drafts are filed as GitHub issues (template "Ticket (maintainers)") only after:
1. the step-0 SCAR review (done: `entry-data-scar-review.md`, 30 gaps; questions answered)
2. the stories in `docs/user-stories/userstories.md`, proposed as Epic 9, US-9.1 to US-9.4, plus amendments to US-5.1 and US-5.2
3. their tests

Each draft follows the ticket template. The fields that only the later steps can fill are marked *(at step 3)*. Examples are synthetic (no real vault data).

The **block format** is owned by its reader, Obsidian2Typst (its story "Entry data and statblock", `docs/technical/entry-block.md` there). US-9.1 links that specification and does not restate it, so there is one contract with one owner. This follows SCAR-040 (an output format specified without naming the program that reads it).

## Decisions applied (2026-11-05)

- **Trigger setting (G0-B1):** `entryMarkerKeys`, default **empty (off)**. A vault that uses it sets its own keys, e.g. `vigour, attacks, illustration, layout`.
- **Which notes (G0-B2):** only **whole-note embeds** get a block. The root file, section embeds, pass-through wrappers, quoted embeds and callouts get none.
- **What is written (G0-A1, A2, A3):** every property **except** the keys in `entryExcludeKeys` (default: Obsidian housekeeping keys such as `aliases`, `cssclasses`, `publish`), **`tags` included**. This plugin doesn't know which keys are printed; that list lives only in the Obsidian2Typst preset. This amends US-5.2 ("no field, not even tags") for marked notes.
- **Key case (G0-A8):** keys are matched case-insensitively and written in lowercase.
- **YAML form (G0-A4):** re-serialised in a fixed form. Tentative until the YAML spike.
- **Fence (G0-A5):** one backtick longer than the longest backtick run in the block (CommonMark).
- **Credit (G0-A6, amended 2026-11-07):** no credit key; the credit is the alias (or link text) of the `illustration` link and is kept. Vaults are expected to write `[[hare.png|Credit]]`, the form Obsidian tracks in properties; embed forms are read too, without a warning.
- **Links (G0-A7):** links in property values are flattened to their display text; bold and italic are kept.
- **Repeats (G0-B3, B4):** only entry notes are deduplicated; a repeat becomes an HTML comment; section embeds never count as repeats.
- **Not compiled (G0-B5):** only whole embeds count as compiled.
- **Reports (G0-B6):** lists go into the warnings file; the Notice gives only the count.
- **Illustrations (G0-B7):** a single local vault image only.
- **Fences (G0-B8):** one fence parser for all control languages.

## Open points for step 1

- ~~**Key order in the fixed form**~~: the note's property order (US-9.1 AC-4, 2026-11-07).
- ~~**In-band markers (SCAR-039)**~~: listed in US-9.1 AC-11 (2026-11-07).

## Spikes before step 1

- the YAML form Obsidian's Properties panel writes
- ~~how property links resolve in the user's Obsidian~~ (done 2026-11-07: only link forms without `!` are indexed; the compiler's `resolve()` and `assetTag()` handle every form; see T-9.2-A)
- how Obsidian2Typst's `yaml` 2.9.1 parses this compiler's output

---

## Tickets (step 3, rewritten 2026-11-07 from the stories)

Order of work: T-5.1-A and T-3.1-A first (both stand alone and change existing behaviour), then T-9.1-A, T-9.1-B, T-9.2-A, T-9.3-A, T-9.4-A, and T-9.1-C last (fixture and manual check). All on the branch `108-entry-data`; the epic merges to `main` once every test is green (SCAR-006). Red counts measured on the branch at `21cf0f4`.

### T-5.1-A (#116) — Control blocks of every fence form are removed

- **Source:** US-5.1 AC-F (G0-B8); epic #108
- **Defect / Why:** the removal regex `'```'+lang+'[\s\S]*?```'` only matches a fence of exactly three backticks. Measured with v0.21.0: `~~~dataviewjs` stays as code; a four-backtick `dataviewjs` fence leaves a stray two-backtick line; a `dataviewjs` block inside a quote leaves an empty `> ` line.
- **Change:** `compiler.ts` — one table of removed languages (`dataview`, `dataviewjs`, `meta-bind-embed`, `leaflet`, `calendarium`, `compressed-json`) and one CommonMark fence parser for removal: backtick and tilde fences, a closing fence at least as long as the opening one, fences inside quotes with their prefix. The code copy of US-1.4 uses the same parser.
- **Class search (SCAR-017):** every reader of fences: control removal, TextMapper fences (US-4.1), the SerializedQuery scan, `codeRanges` / `codeLines` / `codeBlockMask`, `unclosedFence`. Each moves to the shared parser or is listed here with why it stays.
- **Guard search (SCAR-023):** `control-commands.test.ts`, `code-blocks.test.ts`, `code-as-written.test.ts:211` (pins today's code output); the text check that `dataviewjs` is named once.
- **Tests:** `tests/integration/control-fences.test.ts`: 34 tests, 25 red, 9 guards green (three-backtick fences, other languages kept, one table).
- **Not measured here (SCAR-024):** —
- **Status:** filed

### T-3.1-A (#109) — The output folder is not searched when links resolve

- **Source:** US-3.1 "Output folder", US-0.4 (2026-11-07); epic #108
- **Defect / Why:** a compile into a vault folder copies images to `<output folder>/assets/`; the next compile finds those copies too. Measured in a real vault: every image name that had been exported was ambiguous between the source and its copies.
- **Change:** `output-location.ts` — `foldersToIgnore(locations)`: the vault folders of the settings location and this run's location, without the vault root and without folders outside the vault. `compiler.ts` — option `ignoredFolders`; `directMatch`, `basenameMatches` and the result of `options.resolve` skip every file under those folders (whole path segments). `main.ts` passes `ignoredFolders: foldersToIgnore([...])`.
- **Class search (SCAR-017):** every caller of `resolve()`: wiki and Markdown embeds, links (US-2.3), pass-through wrappers, quoted embeds, ToC items, TextMapper assets, and the entry images of T-9.2-A.
- **Guard search (SCAR-023):** the US-0.3 output-location tests; `vault-safety.test.ts` (US-8.1); `link-resolution.test.ts`.
- **Tests:** `tests/integration/output-folder.test.ts`: 10 tests, 8 red, 2 guards green; `tests/unit/entry-settings.test.ts`, "foldersToIgnore": 5 tests.
- **Not measured here (SCAR-024):** Obsidian's own lookup returning a file in the output folder (tested with a stand-in resolver; checked by hand in T-9.1-C).
- **Status:** filed

### T-9.1-A (#110) — Write an entry note's properties as an `o2t-entry` block

- **Source:** US-9.1 AC-1 to AC-7, AC-9 to AC-13; the settings table of Epic 9; amends US-5.2; the format is Obsidian2Typst's `docs/technical/entry-block.md` (SCAR-040)
- **Defect / Why:** US-5.2 removes all frontmatter, so an entry's data never reaches the typesetter. Example: `Fen Hare.md` with `might: 3`, `attacks: ["Kick: 2d6"]` compiles to `## Fen Hare` / `Fen hares are shy.`
- **Change:**
  - bundle `yaml` 2.9.1 (ISC): licence check (SCAR-036), `main.js` compared before and after (SCAR-042)
  - `entries.ts` (new): `parseListSetting`; the block writer: top-level keys only, exclusions, keys in lower case, the note's order, first of two case-twins wins with a warning, `stringify(value, {nullStr: ''})`, the fence one backtick longer than the longest run
  - `compiler.ts`: `splitFrontmatter` returns the YAML text too (SCAR-001); a whole-note embed of an entry note writes the block directly under its title heading in each title path (US-6.1, US-6.3 to US-6.5; four places, listed in the step-0 review); heading-first and pass-through classification read the note without the block (SCAR-034); no other step reads or changes the block (SCAR-039)
  - `main.ts`: four settings rows and defaults, passed with `parseListSetting`; no decision in `main.ts` (SCAR-031)
- **Class search (SCAR-017):** title placement: `applyHeadingNormalisation`, the `${heading}\n\n${body}` branch, `expandPassThrough`, the quoted title (no block). Fence and text readers that must leave the block alone: the list in US-9.1 AC-11.
- **Guard search (SCAR-023):** `frontmatter.test.ts:45/118/206/235` (the text check that frontmatter is discarded must allow the block only when the setting is set); `settings-writes.test.ts` (its count of settings writes changes with the new rows: this ticket updates it, SCAR-044); `compile-basic.test.ts:234-275`; `obsidian-anchors.test.ts:239/350`; `warnings-once.test.ts:155`.
- **Tests:** `tests/integration/entry-block.test.ts` except AC-8: 49 tests, 36 red, 13 guards green; `tests/unit/entry-settings.test.ts`, "parseListSetting" and the `main.ts` text checks: 9 tests.
- **Not measured here (SCAR-024):** what Obsidian2Typst does with the block (T-9.1-C).
- **Status:** filed

### T-9.1-B (#111) — Links in entry values become their display text

- **Source:** US-9.1 AC-8 (G0-A7)
- **Defect / Why:** a link in a value would reach the statblock, which is always link-free. `skills: ["[[Skills/Keen Nose|Keen Nose]]"]` must be written `Keen Nose`.
- **Change:** `entries.ts` — flatten every string of every non-asset key, lists included, by the reader's rule (Obsidian2Typst `flattenLinks`): a wikilink or embed its alias, else its target as written; `File > Heading` with an anchor, `Heading` for `[[#Heading]]`; a Markdown link its text; an image its alt text; bold and italic stay. Uses the link patterns of US-2.3, not a parser of its own.
- **Class search (SCAR-017):** the link patterns in `compiler.ts` (`LINK`, the embed patterns); the flattening uses them.
- **Guard search (SCAR-023):** —
- **Tests:** `tests/integration/entry-block.test.ts`, "AC-8": 9 tests, 9 red.
- **Not measured here (SCAR-024):** —
- **Status:** filed

### T-9.2-A (#112) — Images named in entry properties are copied as assets

- **Source:** US-9.2 AC-1 to AC-6; the link spike of 2026-11-07
- **Defect / Why:** an image only in `illustration:` is never copied. Measured with v0.21.0: the forms resolve when they reach `resolve()`, but a size alias was kept as alt text, a note link put the note's text in, a PDF became a link and a web address became a local path.
- **Change:** `entries.ts` / `compiler.ts` — for keys in `entryAssetKeys`: reject a list, a web address, a note and a non-image (`png jpg jpeg gif svg webp bmp ico`) with `Entry image is not a local image (<reason>)`; take the path out with `parseEmbedDestination` and the wikilink pattern; `resolve()`, then a path-only split of `assetTag` (it returns Markdown and encodes the path, SCAR-001); credit = alias or link text unless it is a size (`300`, `300x200`, a `|300` suffix); a missing image → `Missing asset` and the key left out.
- **Class search (SCAR-017):** all asset paths: body embeds, web images (US-2.6), TextMapper renders (US-4.7); the new caller uses the same dedupe map.
- **Guard search (SCAR-023):** US-2.2 dedupe tests; `web-images.test.ts` (US-2.6 AC-2 keeps a body size as alt text: guard in the new file).
- **Tests:** `tests/integration/entry-assets.test.ts`: 44 tests, 43 red, 1 guard green.
- **Not measured here (SCAR-024):** how large the image prints (Obsidian2Typst).
- **Status:** filed

### T-9.3-A (#113) — A repeated entry note becomes a comment

- **Source:** US-9.3 AC-1 to AC-6; amends US-1.3 AC-6 for entry notes
- **Defect / Why:** an entry note listed in two lists is compiled twice, so the book has the entry twice.
- **Change:** `compiler.ts` — a set of the resolved paths of entry notes already compiled by a whole-note embed; a later whole-note embed writes `<!-- repeat of "<name>" omitted -->` (`--` written `- -`) and a `Duplicate entry omitted` row. Section embeds and quoted embeds neither count nor are replaced; the circular check runs first.
- **Class search (SCAR-017):** every whole-note embed path: wiki and Markdown embeds, ToC items, pass-through targets. The "embedded" set of US-1.3 AC-5 is filled only where a note is really embedded (SCAR-038).
- **Guard search (SCAR-023):** the US-1.3 nested ToC tests (`toc-lists.test.ts`) that rely on a note appearing twice; they stay green, only entry notes are affected.
- **Tests:** `tests/integration/entry-repeats.test.ts`: 13 tests, 8 red, 5 guards green.
- **Not measured here (SCAR-024):** that Obsidian2Typst drops the comment (its US-001 AC-15).
- **Status:** filed

### T-9.4-A (#114) — Report notes that were expected but never compiled

- **Source:** US-9.4 AC-1 to AC-5
- **Defect / Why:** a note whose tags put it in no generated list drops out of the book without a word.
- **Change:** `compiler.ts` — option `expectCompiledFolders`: normalise each value (slashes, `\`), refuse `..`, absolute paths and folders not in the vault with `Folder not found in the vault: <value>`; after compiling, one row per `.md` note in those folders (whole segments, case as stored) that no whole-note embed brought in, sorted by path, after all other rows; the starting file, the output folder and `*.excalidraw.md` left out. `entries.ts` — `completionNotice`; `main.ts` shows it.
- **Class search (SCAR-017):** the warnings file is the only place for the list; the Notice gives only counts.
- **Guard search (SCAR-023):** the Notice text check in `entry-settings.test.ts` (the wording moves out of `main.ts`).
- **Tests:** `tests/integration/entry-not-compiled.test.ts`: 15 tests, 14 red, 1 guard green; `tests/unit/entry-settings.test.ts`, "completion Notice": 4 tests.
- **Not measured here (SCAR-024):** —
- **Status:** filed

### T-9.1-C (#115) — A synthetic entry chapter, and the manual check in Obsidian

- **Source:** Epic 9; SCAR-012, SCAR-029, SCAR-035, SCAR-045
- **Why:** the epic's output is read by another plugin and by Obsidian's own link index; only a run in Obsidian shows both.
- **Change:** `tests/fixtures/basic-vault/Entries/` (invented notes: two entries in two lists, one repeat, one note in no list, an image in a property, a size alias, a note link as `illustration`); its section in `index2compile.md`; manual check M21 in a file of its own (`tests/manual/M21-entry-data.md`): settings rows, the output folder ignored with Obsidian's lookup, the compiled book opened in Obsidian with Obsidian2Typst 0.12.0 (the statblock preview), a PDF export of the chapter. Both build versions named.
- **Class search (SCAR-017):** —
- **Guard search (SCAR-023):** `fixture-vault.test.ts` and the smoke-book tests pin the compiled fixture; they gain the chapter here.
- **Tests:** the fixture tests, updated; M21.
- **Not measured here (SCAR-024):** —
- **Status:** filed

---

## Next steps (2026-11-05)

1. Step 0 is done: see `entry-data-scar-review.md` (30 gaps). The drafts' real-data examples were replaced, and so was the example in public #108.
2. The answers to the step-0 questions are in ("Bestiary G0 Questions" in the private spec repository), and these drafts now follow them.
3. Measure first: the three spikes above.
4. ~~Step 1~~: done 2026-11-07. Epic 9 (US-9.1 to US-9.4) and the amendments to US-0.4, US-1.3 AC-6, US-3.1 (output folder), US-5.1 (AC-F) and US-5.2 are in `userstories.md`. Decided on the way: a map value is written as is, with no warning (Obsidian2Typst warns for the keys it prints); link flattening follows the reader's rule; `ENTRY_*` codes became plain warning messages in this compiler's warnings table.
6. ~~Step 2~~: done 2026-11-07, seven test files (175 tests, 144 red, 31 guards green; listed in `docs/technical/tests.md`). The options the tests pass: `entryMarkerKeys`, `entryExcludeKeys`, `entryAssetKeys`, `expectCompiledFolders`, `ignoredFolders`; new functions `parseListSetting`, `completionNotice` (`entries.ts`) and `foldersToIgnore` (`output-location.ts`).
7. ~~Step 3~~: done 2026-11-07. Eight tickets filed as #109 to #116 and listed on #108 in the order of work: #116, #109, #110, #111, #112, #113, #114, #115.
8. Next: the code, ticket by ticket on `108-entry-data`, starting with #116 (T-5.1-A).
5. Committed in `3e705c0` on `main`, not pushed: the `scars` submodule, the renumbered references, the publish script (`--exclude .git`) and the first version of these drafts. The 2026-11-05 amendment of this file is committed separately, also not pushed. Run the full gate and a publish dry run before pushing. Commit and push only on the user's go.
