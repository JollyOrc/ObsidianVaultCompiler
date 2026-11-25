# M24 — Encounter lists in Obsidian: the setting's row, the compile, the warnings (US-9.6, #136)

**Covers:** US-9.6 AC-1 to AC-4, AC-9, AC-12 in Obsidian; ticket #136.
**Build under test:** Vault Compiler `0.26.0-m24.1`, with Obsidian2Typst `0.17.0-m34.1`.
**Where:** Obsidian2Typst's scratch vault, in one run with Obsidian2Typst's check M34 (its file
`docs/technical/manual-checks/M34.md` holds the steps and the preparation; one run, two records). Steps 1 to 3 of
M34 are this plugin's: the row `Encounter callout type` in **Entry data**, the compile of an invented adventure
(`Encounters/Bog Encounters.md`, three rooms, three creatures) into `Encounters/Out/bog-encounters.md`, three
`o2t-encounter` blocks, the ordinary callout kept, and the three warnings of the warnings file.

**Decided before the run (SCAR-032):** as M34. The rehearsal with this plugin's core in Node gave the compiled text
and the warnings named there (`spikes/m34/rehearsal/` in the Obsidian2Typst repository).

## Record

Date, build, passed or the differences by step (M34's numbering).

## Result

**Passed 2026-11-25** with Obsidian2Typst M34 (the owner: "tests all pass"), build `0.26.0-m24.1`. The compiled note equal to the Node rehearsal; the warnings file the three rows of M34 step 3. Vault restored (M34).
