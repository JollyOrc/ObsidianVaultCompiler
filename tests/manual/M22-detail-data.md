# M22 — Detail data from note properties (Epic 9, US-9.5, #118)

**Covers:** US-9.5 AC-1 to AC-15; tickets #120, #121, #122.
**Build under test:** Vault Compiler `0.23.0-m22.1` (branch `118-detail-data`),
with Obsidian2Typst `0.14.0` (release) in the same vault.
**Where:** the fixture vault `tests/fixtures/basic-vault/`, opened in Obsidian.
No step edits a note. The automated twin of this check is
`tests/integration/detail-fixture.test.ts`, which pins the compiled book in
`tests/fixtures/detail-book.expected.md`.

## Before (done for you, check it)

1. Settings → Community plugins lists **Obsidian Vault Compiler 0.23.0-m22.1**
   and **Obsidian2Typst 0.14.0**, both enabled.

## Settings (US-9.5, SCAR-016)

2. Vault Compiler settings show a new row *Detail marker keys*, empty.
3. Set: starting file `Details/Detail book.md`, output folder `Export`,
   output filename `detailbook.md`, "Normalise headings" **on**,
   *Entry marker keys* `vigour`, *Detail marker keys*
   `pace, kind, needs, starter`, *Expect compiled folders* empty. Close the
   settings window and open it again: the values are kept.

## Compile (US-9.5 AC-2 to AC-11)

4. Compile (command or file menu). The Notice has no repeat or
   not-compiled counts.
5. Open `Export/detailbook.md` in **source mode**. It matches
   `tests/fixtures/detail-book.expected.md` (the repository copy):
   - under `### Reed Weaving` an `o2t-details` block with `pace`, `kind`,
     `needs: "[[#Basket Knots|Basket Knots]]"` and `starter: true`, in that
     order, and no `tags`;
   - under `### Basket Knots`: `pace`, `kind`, `starter: false`;
   - under `### Rope Laying`: `needs` holding `**Basket Knots**` and
     `[[#Tight|tight knots]]`;
   - under `### Net Mending`: `pace` and `kind: Missing Craft` only (the list
     `needs` is left out);
   - under `### Tide Tables`: an **`o2t-entry`** block (`vigour`, `pace`) and
     **no** `o2t-details` block;
   - no `dataviewjs` code and no `dv.view` anywhere, no blank line between a
     heading and its block; `Moon Notes` is not in the book.
6. The warnings file holds exactly three rows: `Detail value is not text:
   needs` (`Details/Crafts/Net Mending.md`, line 4), `Entry keys and detail
   keys in one note: only the entry block is written`
   (`Details/Crafts/Tide Tables.md`, line 3), `Missing wiki link`
   (`Details/Crafts/Net Mending.md`, line 3).

## Read by Obsidian2Typst (SCAR-024, SCAR-045)

7. Set Obsidian2Typst's active preset to **Details**
   (`Obsidian2Typst/presets/Details.md`).
8. Open `Export/detailbook.md` in **reading view**. Under each of the four
   craft headings one row of badges, each with its icon:
   - Reed Weaving: *Brisk*, *Craft*, *Basket Knots* (a link: clicking it goes
     to the Basket Knots heading), *Known from the start*;
   - Basket Knots: *Slow*, *Craft* (no "Known from the start": the flag is
     false);
   - Rope Laying: *Swift*, *Craft*, then **Basket Knots**: *tight knots* (bold
     and a link);
   - Net Mending: *Brisk*, then *Missing Craft* printed as written, and a
     notice line `DETAIL_VALUE_UNMAPPED` under the row.
   Tide Tables shows a statblock (a Pace entry and a Vigour box of 3), not a
   row.
9. Export `Export/detailbook.md` to PDF with the preset **Details**. In the PDF:
   the same four rows directly under their headings, each heading and its row
   and the first text lines on one page; the links in the rows are links
   (clicking jumps; a page number after it only if the preset or the
   plugin's settings ask for it); Tide Tables is an entry. Obsidian2Typst's own
   warnings, if any, are reported.

## Off and on (SCAR-019)

10. Clear *Detail marker keys* and compile again: `Export/detailbook.md` has
    no `o2t-details` block, Tide Tables still has its `o2t-entry` block, and
    the warnings file has no row (nothing is read from the properties of the
    other notes).
11. Put the keys back, clear *Entry marker keys* instead, and compile: Tide
    Tables now has an `o2t-details` block (`pace`) and no entry block, and
    the warnings file has the two rows `Detail value is not text: needs` and
    `Missing wiki link`, but no `Entry keys and detail keys` row.

## Anything else

12. Is anything missing, odd or ugly that this list did not ask about? Report
    it even if it seems unrelated.

## Result

- 2026-11-09, test build `0.23.0-m22.1` (sha256 47b250fc…75ef) with Obsidian2Typst 0.14.0 in `tests/fixtures/basic-vault`: **passed** (the user's report "pass"). The four choices the contract left open are confirmed by the user: list or map values left out with `Detail value is not text`, no block when nothing is left; a `tags` list writes nothing; a link without a target becomes its plain text; case-twin keys write the first with a warning, and a note embedded twice gets a block each time.
Obsidian2Typst's export warnings for step 9 (its file, left in the vault root
by the export and set aside before the release commit):
`DETAIL_VALUE_UNMAPPED` ×1 (Net Mending, `kind: Missing Craft`, the value
step 8 expects to print as written), `ENTRY_LEDE_SHORT` ×1 and `ENTRY_AUTO` ×1
(Tide Tables, a five-word entry body, page-text). None is a defect of this
plugin.
