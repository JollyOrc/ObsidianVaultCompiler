# Step-0 SCAR review (G0) — #118 Detail data from note properties

**Date:** 2026-11-09
**Scope:** epic #118 (a few note properties drawn as a row under a heading); its reader is Obsidian2Typst, epic JollyOrc/Obsidian2Typst#152
**SCARs:** the shared set at `scars/` (pointer `943745c`; the shared repository is at `57efd7b`: SCAR-015, SCAR-018 and SCAR-025 gained prevention points since, read from the shared repository). The checklist in `CLAUDE.md` and the README index read in full; SCAR bodies read only where a verdict needed them (035, 039).
**Result:** 26 gaps; questions for the user are in the report of 2026-11-09. Stories not started.
**Precedent:** `entry-data-scar-review.md` (#108). Written generic: this file is published.

## Wanted

Notes of one kind keep a few small facts (a duration, a kind, a requirement, a flag) in a table in the body. They move into properties. US-5.2 removes properties, so the typesetter would never see them. They must reach it without the note becoming an entry (Epic 9).

## Measured (v0.22.0, `InMemoryVaultCompiler.compile`, synthetic notes)

- With `entryMarkerKeys` = the four keys, a note gets an `o2t-entry` block with **every** property (`tags` included) and a wikilink value flattened to its text (`[[Quick Step]]` → `Quick Step`). The reader treats it as an entry: inside an entries chapter it gets a page layout; outside, `ENTRY_OUTSIDE_CHAPTER`. So the entry block cannot mark these notes.
- Placement is already right: the block follows the title heading directly, also with a `dataviewjs` line at the top of the note (removed; no blank line left between heading and block).
- An embed inside a quote gets no block (US-9.1 AC-2), so a note quoted in the book loses its facts.
- Today a wikilink in the table reaches the book as an in-book anchor link `[Quick Step](#Quick%20Step)`; a flattened block value would lose that link.
- The reader at 0.13.1 prints an unknown `o2t-details` fence as a code block, without a warning: the reader must ship before the writer is switched on.
- Not measured: the published site; how the reader prints an in-book link inside a block value.

## Checklist

| SCAR | Verdict | Evidence / what's missing |
|---|---|---|
| 001 | gap | New call sites: `entryBlock`'s YAML read and key matching (`entries.ts`), `flattenLinks`, `placeEntryBlock` / `insertEntryBlocks`. Each transform listed at G1; the flatten rule may differ for this block (link kept). |
| 002 | gap | Composed cases: toggle on/off, heading-first, preamble, pass-through, section embed, root, quoted embed, repeat (US-9.3), a note with both kinds of keys, a ToC list item, a `dataviewjs` line first, a flag value, a list value. |
| 003 | ok | Stubs per AC at step 2. |
| 006 | ok | `npm run build` gates; the pointer-behind finding below. |
| 007 | gap | Exact examples: trigger vs written keys, key order, a missing key, a flag, a wikilink value, each YAML type, an empty value. |
| 008 | n/a | No drawing API. |
| 009 | gap | The block is followed by a list, table, fence, quote, heading, callout; a value that holds backticks (fence length). Placement at the start of the document. |
| 010 | gap | Heading → fence and fence → body joins reused from US-9.1; the new placeholder must not collide with the entry placeholder when a note has both. |
| 011 | ok | No generated names. |
| 012 | gap | The joint check needs both build versions named and a synthetic fixture in `basic-vault` (as M21). |
| 013, 014, 021, 025, 030, 037 | n/a | No dialog, no destructive action, no layout read-back, no rendering, no heavy test, user settings win. |
| 016 | ok | Settings are read when a compile starts; the new field goes through `settingsSaver`. |
| 017 | gap | Class lists: every place that reads `entryMarkerKeys` (grep) and every fence reader; the placeholder and its removal; the settings-writes count test. |
| 018 | ok | Probes wrote to the session scratchpad only. |
| 019 | gap | The new setting at its default (off), with one key, with several (order), with an empty item, with case differences; each with the toggle on and off. |
| 020 | gap | Options to measure before they are offered: block language; allowlist vs everything-but-excluded; link kept vs flattened (the reader's printing of a link is not measured). |
| 022 | gap | Read properties from the text already read (US-9.1 AC-10), not from `metadataCache`. |
| 023 | gap | Guards that would forbid the new block: `entry-block.test.ts`, `entry-fixture.test.ts`, `frontmatter.test.ts` (frontmatter always removed), `settings-writes.test.ts` (count), the byte-identical invariants. Listed at G2. |
| 024 | gap | Not measured: how Obsidian's Properties panel writes a link property (a quoted string); the reader's `yaml` version on the block. |
| 026 | gap | Only top-level keys trigger (as US-9.1 AC-2); a comment, nested key or multi-line string must not. |
| 027 | gap | A new block kind next to the entry block: users of "a note's keys" are the entry stories (US-9.1 to 9.4), `expectCompiledFolders` (works on folders, independent of keys), the repeat comment (US-9.3). List what each does for a details note. |
| 028 | gap | Tests parse the block with the reader's YAML parser and compare the exact text. |
| 029 | gap | The joint check in its own M-file. |
| 031 | gap | Decisions in tested modules; `main.ts` passes the setting and is guarded by a text check. |
| 032 | gap | Each measurement above names version and inputs; lengths of real values are one book's. |
| 033 | n/a | No path setting added. |
| 034 | gap | The block goes in after the title in each title path (heading-first, preamble, pass-through classification read the note without it). |
| 035 | ok | This file, the epic and the examples are generic; invented keys and names; a measurement on a real vault is a number only. |
| 036, 042 | n/a | No new dependency (`yaml` is already bundled). |
| 038 | gap | Warnings (unknown key shape, both kinds of keys) are reported where the compile reports them, once, with note and line. |
| 039 | gap | The readers between insertion and removal of the placeholder, as for #108 (control-fence regex, code ranges, `expandTocLists`, `markLinks`, `extractSection`, `quoteLines`, `convertLinks`, `sanitizeOutput`, `tidyBlankLines`); each tested with a details block present. |
| 040 | gap | Reader named: Obsidian2Typst (its page `docs/technical/details-block.md`, not written yet; epic #152) and Obsidian's reading view. Format owned by the reader. |
| 041 | gap | A block inside a quote or callout: none written, with examples. |
| 043 | gap | Counts exclude the output file, warnings files and `assets/`. |
| 044 | gap | The settings-writes count test changes with the ticket that adds the field: name it. |
| 045 | gap | Measure in the author's Obsidian (properties as written, the reader on the result) before the stories build on it. |

## Proposed changes to the stories (for the user's answers)

1. A new fence language for the block (proposed `o2t-details`), a setting `detailMarkerKeys` (default empty = off) that both triggers and selects: only the listed keys are written, in the setting's order, `tags` never unless listed.
2. Same place, fence and YAML rules as US-9.1; one block per heading; not in quotes.
3. A note with both kinds of keys: the entry block only, plus one warning.
4. Link values: decision open (kept as the in-book link of US-2.3, or flattened as in US-9.1 AC-8).
5. Invariants: setting empty → byte-identical to v0.22.0; setting set but no note has its keys → the same.
6. Order: the reader ships first; this setting stays empty until the reader's version is installed; this compiler's stories wait for the reader's contract page.
7. Housekeeping found: this project's `scars/` pointer (`943745c`) is behind the shared repository (`57efd7b`); update the pointer in its own commit.
