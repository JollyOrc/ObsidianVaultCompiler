# Draft tickets — Entry data from note properties (epic #108)

**Status:** Draft, 2026-11-05. **Not filed yet.** Amended 2026-11-05 with the answers to the step-0 questions (A1 to A9 for the shared block contract, B1 to B8 for this plugin). Each amended draft cites its answer as G0-xx. The behaviour spec is "Bestiary Layout User Stories" in the private spec repository (BL-B1 to BL-B5); the stories written at step 1 restate it in generic terms.

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
- **Credit (G0-A6):** no credit key; the credit is the alt text of the `illustration` image and is kept.
- **Links (G0-A7):** links in property values are flattened to their display text; bold and italic are kept.
- **Repeats (G0-B3, B4):** only entry notes are deduplicated; a repeat becomes an HTML comment; section embeds never count as repeats.
- **Not compiled (G0-B5):** only whole embeds count as compiled.
- **Reports (G0-B6):** lists go into the warnings file; the Notice gives only the count.
- **Illustrations (G0-B7):** a single local vault image only.
- **Fences (G0-B8):** one fence parser for all control languages.

## Open points for step 1

- **Key order in the fixed form:** the trigger setting no longer lists every key, so the order can't follow it. Proposed: the note's property order (what the author sees in the Properties panel). Alternative: sorted. Decide at step 1, after the YAML spike.
- **In-band markers (SCAR-039):** the block is an in-band marker read by a later program. The class search must list every step that reads fenced blocks (US-1.4 code copy, US-5.1 removal, link rewriting, the TextMapper step) and decide for each that it leaves `o2t-entry` alone.

## Spikes before step 1

- the YAML form Obsidian's Properties panel writes
- how property links resolve in the user's Obsidian
- how Obsidian2Typst's `yaml` 2.9.1 parses this compiler's output

---

## T-9.1-A — Write entry data blocks from note properties

- **Source:** US-9.1 (to be written) AC-1 to AC-4; epic #108; amends US-5.2
- **Defect / Why:** US-5.2 removes all frontmatter, so per-note layout data never reaches the typesetter. Example: `Fen Hare.md` with `might: 3`, `attacks: ["Kick: 2d6"]`, `tags: [beast]` compiles today to `### Fen Hare`, then the body. The data is lost.
- **Change:** in the frontmatter step (where US-5.2 removes the block), a **whole-note embed** whose frontmatter has at least one key of `entryMarkerKeys` keeps every property except those in `entryExcludeKeys` (G0-A2) and emits them directly under the note's heading, at whatever level that heading has:

  ````
  ### Fen Hare
  ```o2t-entry
  might: 3
  attacks:
    - "Kick: 2d6"
  tags:
    - beast
  ```
  ````

  Keys are written in lowercase. Two keys that differ only in case give `ENTRY_KEY_CASE "<note>": Might / might` (G0-A8). Add both settings to the settings tab: `entryMarkerKeys` default empty, `entryExcludeKeys` default `aliases, cssclasses, publish`.
- **Class search (SCAR-017):** every place that places a note's heading (embed, nested ToC expansion US-1.3, quote embed US-1.5, section embed, pass-through wrapper, preamble files from US-5.2, the root file). Each is decided: whole-note embeds get the block, all others don't (G0-B2).
- **Guard search (SCAR-023):** the US-5.2 tests that assert "no frontmatter text in the output" must still hold when the setting is empty, and must allow the block when it is set.
- **Tests:**
  - setting empty → output byte-identical to today
  - one trigger key set → block with all properties except the excluded ones, `tags` included
  - an excluded key (`aliases`) → not in the block
  - `Might` and `might` in one note → one key `might` and `ENTRY_KEY_CASE`
  - a section embed, a quoted embed, a callout embed and the root file → no block
  - a note at depth 3 → block under its own heading
  - a note without any trigger key → no block
  - two notes → two blocks, each under its own heading
- **Not measured here (SCAR-024):** what Obsidian2Typst does with the block.
- **Status:** Draft

## T-9.1-B — Fixed YAML form, fence length and flattened links

- **Source:** US-9.1 AC (determinism, fence, links)
- **Defect / Why:** the same properties written with a different quoting in two notes must give the same block text. Otherwise the output isn't deterministic, and downstream diffs are noisy. A value with backticks would close a three-backtick fence early. A link in a value would reach the statblock, which is always link-free (G0-A7).
- **Change:**
  - serialise in a fixed form: one key per line, lists in block style, two-space indent, strings quoted only when YAML needs it (G0-A4; tentative until the YAML spike). Key order: see the open point.
  - the fence is one backtick longer than the longest backtick run in the content, three at least (G0-A5)
  - links in values are flattened to their display text: `[[Quick Step]]` → `Quick Step`, `[[Skills/Keen Nose|Keen Nose]]` → `Keen Nose`, `[text](url)` → `text`. Bold and italic stay. The `illustration` value is not flattened (T-9.2-A).
- **Class search (SCAR-017):** any other place that writes YAML (none known; to confirm). The link flattening reuses the display-text rules of the link rewriter (US-2.3), not a second parser.
- **Guard search (SCAR-023):** *(at step 3)*
- **Tests:**
  - `attacks: ['A: 1d6']` and `attacks:\n  - "A: 1d6"` give the same block
  - a value holding three backticks → a four-backtick fence
  - a wikilink, an aliased wikilink and a Markdown link in values → their display text; `**bold**` kept
  - Obsidian2Typst's `yaml` parser reads every test block back to the same values
- **Not measured here (SCAR-024):** —
- **Status:** Draft

## T-9.2-A — Images named in properties are copied as assets

- **Source:** US-9.2 (to be written) AC-1 to AC-4
- **Defect / Why:** an image only in `illustration:` is never copied, because only body embeds are (US-2.1).
- **Change:** for keys named in a new setting `entryAssetKeys` (default `illustration`), resolve `[[images/hare.png]]`, `images/hare.png`, `![[hare.png|Credit]]` and `![Credit](images/hare.png)` through the link resolution of US-0.4 / US-3.1. Copy the image with deduplication (US-2.2) and name normalisation (US-2.5), and write it into the block with its **alt text kept as the credit** (G0-A6): `"![Credit](assets/hare.png)"`, or `assets/hare.png` when there is none. A numeric alias (`![[hare.png|300]]`) is a size in Obsidian, not a credit, and is dropped.
  - An image that can't be found gives the missing-file warning, and the key is left out.
  - A list, a web URL or a link to a note gives `ENTRY_ILLUSTRATION_INVALID "<note>": <list|url|note>`, and the key is left out (G0-B7).
- **Class search (SCAR-017):** all asset paths (embeds, web images from US-2.6, TextMapper renders from US-4.7). The new caller must use the same dedupe map.
- **Guard search (SCAR-023):** the dedupe tests from US-2.2. The same image used as a body embed and as a property gives one asset.
- **Tests:**
  - four link forms → same asset path; the two with alt text keep it
  - a numeric alias → no credit
  - a missing image → warning and no key
  - a list, a URL and a note link → each warning and no key
  - the same image in a body and a property → one file in `assets/`
- **Not measured here (SCAR-024):** how large the image prints.
- **Status:** Draft

## T-9.3-A — A repeated entry note becomes a comment

- **Source:** US-9.3 (to be written) AC-1 to AC-4
- **Defect / Why:** an entry note listed in two lists is compiled twice, for example a creature tagged into two categories.
- **Change:** keep a set of entry notes (notes that got a block, T-9.1-A) already embedded in this compilation. A second or later **whole-note** embed of one of them emits `<!-- repeat of "Fen Hare" omitted -->` instead of the content, and adds `Duplicate entry omitted: Fen Hare` to the warnings file (G0-B3, B6). Other notes are never deduplicated, so US-1.3 AC-6 (spells listed under two schools) holds. Section embeds never count: not a section after its whole note, and not the whole note after one of its sections (G0-B4). No setting: the rule only acts when `entryMarkerKeys` is set.
- **Class search (SCAR-017):** circular-dependency prevention (spec 6.3) already tracks a stack. Decide whether that stack and the new set interact (a cycle versus a repeat).
- **Guard search (SCAR-023):** tests that rely on a note appearing twice (for example the US-1.3 nested ToC tests). They must stay green, because only entry notes are affected.
- **Tests:**
  - an entry note embedded twice → the second is the comment, and the warnings file lists it
  - a non-entry note embedded twice → two copies as today
  - a section embed of an entry note before or after its whole embed → both kept
  - a repeat inside a nested embed
  - `entryMarkerKeys` empty → output byte-identical to today
- **Not measured here (SCAR-024):** that Obsidian2Typst drops the comment (its US-001 AC-15).
- **Status:** Draft

## T-9.4-A — Report notes that were expected but never compiled

- **Source:** US-9.4 (to be written) AC-1 to AC-3
- **Defect / Why:** a note whose tags put it in no generated list silently drops out of the book.
- **Change:** add the setting `expectCompiledFolders` (list of folders, default empty). After compiling, the warnings file lists `Not compiled: <note>` for every Markdown note in those folders, at any depth, that never appeared as a **whole-note embed** (G0-B5). A note that appeared only quoted or only as a section embed is listed with how it appeared: `Not compiled (section embed only): <note>`. The Notice gives only the count (G0-B6).
- **Class search (SCAR-017):** the warnings file is the only output place; the statistics report (spec 7.4) gains no lines.
- **Guard search (SCAR-023):** —
- **Tests:**
  - folder with 3 notes, 2 embedded → one line
  - a note only section-embedded, a note only quoted → listed with how they appeared
  - setting empty → no line
  - subfolders count
- **Not measured here (SCAR-024):** —
- **Status:** Draft

## T-5.1-A — Control blocks of every fence form are removed

- **Source:** US-5.1 (amendment) AC "Dataview … fenced code blocks are stripped"; G0-B8
- **Defect / Why:** US-5.1 names `dataview` blocks only. A `dataviewjs` block (used for a preview in the note) must not reach the output, and the entry data block (T-9.1-A) must stay directly under the heading even when such a block comes first in the body. The step-0 review measured that the removal fails for `~~~` fences, fences of four or more backticks and fences inside quotes.
- **Change:** one fence parser for all removed block languages, handling `~~~` fences, fences of four or more backticks (closed only by a fence at least as long) and fences inside quotes (with the quote prefix). Add `dataviewjs` to the list if it isn't there. T-9.1-B's fence length relies on the same parser.
- **Class search (SCAR-017):** all removed block languages (`dataview`, `dataviewjs`, `meta-bind-embed`, `leaflet`, `calendarium`, `compressed-json`). Confirm the list is one table, and that the code copy of US-1.4 uses the same parser.
- **Guard search (SCAR-023):** *(at step 3)*
- **Tests:**
  - `dataviewjs` block → removed, with no extra blank lines left
  - each language in a `~~~` fence, a four-backtick fence and inside a quote → removed
  - a four-backtick block holding a three-backtick line → removed whole
  - with T-9.1-A on: heading, `o2t-entry` block, first paragraph, in that order
- **Not measured here (SCAR-024):** —
- **Status:** Draft

---

## Next steps (2026-11-05)

1. Step 0 is done: see `entry-data-scar-review.md` (30 gaps). The drafts' real-data examples were replaced, and so was the example in public #108.
2. The answers to the step-0 questions are in ("Bestiary G0 Questions" in the private spec repository), and these drafts now follow them.
3. Measure first: the three spikes above.
4. Step 1: write Epic 9 (US-9.1 to US-9.4) and the US-5.1 and US-5.2 amendments in `userstories.md`, closing every gap in the review. US-9.1 waits for Obsidian2Typst's `entry-block.md`.
5. Committed in `3e705c0` on `main`, not pushed: the `scars` submodule, the renumbered references, the publish script (`--exclude .git`) and the first version of these drafts. The 2026-11-05 amendment of this file is committed separately, also not pushed. Run the full gate and a publish dry run before pushing. Commit and push only on the user's go.
