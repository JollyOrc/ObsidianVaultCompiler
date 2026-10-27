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

In this project: US-018, the same-page variant of `page-ref` with Typst's
`locate` and `here`: at one filler length the links stayed on page 1, the
target moved to page 2, and no number was printed (moved from SCAR-008 on
2026-10-22).

## Root cause

A rule that reads its own effect is a fixed-point problem. It was tested at
lengths where the fixed point exists and is reached at once; the lengths
where it does not exist were never tried, and the compile path gives no
warning.

## Prevention

- Output that depends on its own layout (Typst `context`, `locate`, `here`,
  or any "unless it is on this page" rule) is swept across a page edge, step
  by step, and every result is checked for being stable and correct.
- Prefer a rule that does not read its own effect when a sweep shows an
  oscillation, and say so before the user chooses (SCAR-020).
- Applies next to: running headers, "continued" markers, keep-together rules,
  anything that reads a page number or a position.
