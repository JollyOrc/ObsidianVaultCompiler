# SCAR-046 — An output that ships in two forms is checked only in the one the checker looks at

**Area:** Verification / Acceptance
**Severity:** Low — the printed sheets were right; the editable document shipped beside them was awkward to work in

---

## What went wrong

The RoA character sheets ship as a PDF and as an editable DesignCraft document (ADR 0005 chose DesignCraft partly *because* the owner can edit the result by hand). Every automated test and the manual check M01 looked at the PDF. Opening the editable document, the owner found its text frames overlapping each other and reaching past the page — a frame 360 pt wide holding three words. The PDF could not show it: a text frame has no visible edge. Example (2026-11-22, roa-character-sheets US-001 M01 → #7).

## Root cause

The acceptance criteria and the tests were written for the form the reader of the product sees (the printed page) and silently assumed the second form (the source document someone edits) would be as good, because both come from one build. The generous frame sizes were a shortcut that was invisible in the checked form.

## Prevention

- When a build ships more than one form of its output (a PDF and the editable document, a site and its Markdown, a bundle and its source map), the story names each form and its reader, and states what "good" means for each — for an editable document: frames inside the page, no overlaps, sizes that fit their content.
- The tests check each form by program, not only the one a viewer opens. Example check: every text frame of the document inside its page, no two overlapping (roa-character-sheets `sheet.test.ts`, AC-17).
- A manual check that hands over more than one form asks the tester to open each of them, with the program its reader uses.
- An output that is also imposed for printing (a booklet spread, n-up, a fold) is inspected in that imposition too, not only page by page: what meets at the fold or the seam is part of the output. Example (2026-11-23, roa-character-sheets US-003): two worn paper edges met as a dark stripe on the booklet's fold; each page alone looked right.
