# M25 — The starting note's compile target and carried preset in Obsidian (US-7.5, #140)

**Covers:** US-7.5 AC-1, AC-3 to AC-5 in Obsidian; ticket #140.
**Build under test:** Vault Compiler `0.27.0-m25.1`, with Obsidian2Typst `0.19.0-m36.1`.
**Where:** Obsidian2Typst's scratch vault, in one run with Obsidian2Typst's check M36 (its file
`docs/technical/manual-checks/M36.md` holds the steps and the preparation; one run, two records). Steps 2 and 4 of
M36 are this plugin's: `Compile target…` writes `compile-folder` and `compile-file` into the invented note
`M36/Lantern Sheets.md`; the compile from that note goes to `M36/Out/lantern-sheets.md`, shows `Output from the
note's properties`, carries `typst-preset` as the compiled note's only property, and leaves the settings' output
(`M36/Book Out` / `book.md`) unchanged.

**Decided before the run (SCAR-032):** as M36. The compiled text was rehearsed with this plugin's core in Node
(`spikes/m36/rehearsal/lantern-sheets.md` in the Obsidian2Typst repository): the one property, then the text, no
warnings.

## Record

Date, build, passed or the differences by step (M36's numbering).

## Result

**Passed 2026-11-26** with Obsidian2Typst M36 (the owner: "all ran fine"), build `0.27.0-m25.1`. Read from the disk:
the note's two keys as typed (`M36/Out/`, `lantern-sheets.md`); the compiled note equal to the Node rehearsal (one
property `typst-preset: A4 digital`, no warnings); the settings' output unchanged (`M36/Book Out` / `book.md`).
Vault restored (M36).
