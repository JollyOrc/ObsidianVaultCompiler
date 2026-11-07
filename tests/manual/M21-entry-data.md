# M21 — Entry data from note properties (Epic 9, #108)

**Covers:** US-9.1 to US-9.4, US-3.1 "Output folder", US-5.1 AC-F; ticket #115.
**Build under test:** Vault Compiler `0.22.0-m21.1` (branch `108-entry-data`),
with Obsidian2Typst `0.12.0` (release) in the same vault.
**Where:** the fixture vault `tests/fixtures/basic-vault/`, opened in Obsidian.
No step edits a note. The automated twin of this check is
`tests/integration/entry-fixture.test.ts`, which pins the compiled book in
`tests/fixtures/entry-book.expected.md`.

## Before (done for you, check it)

1. Settings → Community plugins lists **Obsidian Vault Compiler 0.22.0-m21.1**
   and **Obsidian2Typst 0.12.0**, both enabled.

## Settings (US-9.1, US-9.4; SCAR-016)

2. Vault Compiler settings show four new rows: *Entry marker keys*, *Entry
   exclude keys* (`aliases, cssclasses, publish`), *Entry image keys*
   (`illustration`), *Expect compiled folders* (empty).
3. Set: starting file `Entries/Entry book.md`, output folder `Export`,
   output filename `entrybook.md`, "Normalise headings" **on**,
   *Entry marker keys* `vigour, attacks, illustration, layout`,
   *Expect compiled folders* `Entries/Creatures`. Close the settings window and
   open it again: the values are kept.

## Compile (US-9.1 to US-9.4)

4. Compile (command or file menu). The Notice ends with
   `1 duplicate entry omitted, 1 note not compiled: see warnings_….md.`
5. Open `Export/entrybook.md` in **source mode**. It matches
   `tests/fixtures/entry-book.expected.md` (the repository copy):
   - under `### Fen Hare` an `o2t-entry` block with `skills` `Quick Step`,
     `Keen Nose` (no link) and
     `illustration: "![Drawn by A. Nobody](assets/hare.png)"`; no `aliases`;
     no `dataviewjs` code anywhere;
   - under `### Marsh Owl`: `illustration: assets/owl.png` (the size `300`
     dropped);
   - under `## Marsh`: `<!-- repeat of "Fen Hare" omitted -->`, then
     `### Reed Toad` with a block and no `illustration`.
6. `Export/assets/` holds `hare.png` and `owl.png` (a square and a tall
   picture).
7. The warnings file holds exactly three rows: `Duplicate entry omitted`
   (`Entries/Entry book.md`, line 10), `Entry image is not a local image
   (note)` (`Entries/Creatures/Reed Toad.md`, line 8), `Not compiled`
   (`Entries/Creatures/Bog Rat.md`).

## The output folder is ignored, with Obsidian's own lookup (US-3.1)

8. Compile a second time (confirm the overwrite). `Export/assets/hare.png`
   from step 6 now exists next to `Entries/images/hare.png`, and Obsidian's
   link lookup can see both. The new warnings file still holds exactly the
   three rows of step 7: **no** `Ambiguous filename hare.png`.

## Read by Obsidian2Typst (SCAR-024, SCAR-045)

9. Set Obsidian2Typst's active preset to **Entries**
   (`Obsidian2Typst/presets/Entries.md`).
10. Open `Export/entrybook.md` in **reading view**. Fen Hare, Marsh Owl and
    Reed Toad each show a statblock (Might, Wits, Speed, Vigour boxes) instead
    of a code block; Fen Hare's lists *Quick Step*, *Keen Nose*; no notice line
    under any statblock.
11. Export `Export/entrybook.md` to PDF with the preset **Entries**. In the PDF:
    *Beasts* and *Marsh* are entries chapters; Fen Hare and Marsh Owl each
    have their picture with Fen Hare's caption *Drawn by A. Nobody*; Reed
    Toad has no picture; no entry appears twice; a quick reference follows
    each chapter. Obsidian2Typst's own warnings, if any, are reported.

## Off and on (SCAR-019)

12. Clear *Entry marker keys* and compile again: `Export/entrybook.md` has no
    `o2t-entry` block, Fen Hare appears twice, and the warnings file holds only
    the `Not compiled` row.

## Anything else

13. Is anything missing, odd or ugly that this list did not ask about? Report
    it even if it seems unrelated.

## Result

2026-11-07 with `0.22.0-m21.1` and Obsidian2Typst `0.12.0`: **passed**
(reported by the user; no findings reported for step 13).
Obsidian2Typst's export warnings for step 11 (its file, left in the vault
root by the export and set aside before the release commit): `ENTRY_AUTO` ×3
(Fen Hare page-landscape, Marsh Owl page-portrait, Reed Toad page-text),
`IMAGE_LOW_DPI` ×2 (the synthetic pictures, 240 and 146 dpi), and
`COMMENT_DROPPED` ×1 (the repeat comment, dropped as designed, Obsidian2Typst
US-001 AC-15). None is a defect of this plugin.
