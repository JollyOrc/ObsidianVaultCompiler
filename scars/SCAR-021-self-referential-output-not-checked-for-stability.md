# SCAR-021 — Output that depends on its own layout is not checked for stability

**Area:** Verification
**Severity:** Medium — wrong output with no error; found only by a sweep across a page edge

---

## What went wrong

Generated output asked where something lands on the page ("print the page
number unless the target is on this page") and the answer changed the layout
it had read: printing the number pushed the text to the next page, where the
number was no longer needed, and so on. The layout engine stopped after a few
passes and kept whatever state it had reached. Nothing reported the
non-convergence.

In Obsidian2Typst: US-018, the same-page variant of `page-ref` with Typst's
`locate` and `here`: at one filler length the links stayed on page 1, the
target moved to page 2, and no number was printed (moved from SCAR-008 on
2026-10-22).

## Root cause

A rule that reads its own effect is a fixed-point problem. It was tested at
lengths where the fixed point exists and is reached at once; the lengths
where it does not exist were never tried, and the compile path used gives
no warning (corrected 2026-11-03: Typst does warn, "layout did not converge
within 5 attempts", through `runWithWorld` diagnostics; `compiler.compile`
drops it — SCAR-032).

## Prevention

- Output that depends on its own layout (Typst `context`, `locate`, `here`,
  or any "unless it is on this page" rule) is swept across a page edge, step
  by step, and every result is checked for being stable and correct.
- Prefer a rule that does not read its own effect when a sweep shows an
  oscillation, and say so before the user chooses (SCAR-020).
- A decision whose result moves the place it reads (a float placed above
  its own probe) can settle on a second, wrong fixed point that confirms
  itself. Check such a decision against the output with the rule off, on the
  real composed document as well as by sweeps. Example (2026-10-29,
  TICKET-097): `figure-10.png` fits after its text at 100, but at 70 it was
  floated to the top of its own page, which pushed the probe down so that
  the float looked needed; 3,216 synthetic cases did not reach it, the
  sample's `Book.md` did.
- Stability depends on how many self-referential decisions chain, not
  only on a page edge: each decision moves the next. It is checked on
  generated inputs of growing size, and Typst's own convergence warning is
  read, not inferred from the output. Example (2026-11-03, #116): image fit
  settled on the sample's `Book.md` (M18) and on generated notes of a few
  images, but not at 10+ images in one flow; in a long book the padding
  pages and back notes that appear only in the last pass printed folio `1`
  and the last chapter's header.
- Applies next to: running headers, "continued" markers, keep-together rules,
  anything that reads a page number or a position.
