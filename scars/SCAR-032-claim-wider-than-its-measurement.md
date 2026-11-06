# SCAR-032 — A finding is claimed wider than what was measured

**Area:** Requirements / Decision making
**Severity:** Medium — a false fact about the compiler stood for 13 days and hid a layout failure; an option the user chose had to be reopened

---

## What went wrong

A measurement was made, and its result was stated for more than it covered.
The statement looked measured, so nobody checked its scope.

In Obsidian2Typst:
- US-018 (2026-10-21): "the compile path returns no warnings at all (an
  unknown font gives `[]`)" was measured on `compiler.compile` of typst.ts
  and written as a fact about Typst. Through `runWithWorld` →
  `world.compile({diagnostics})` the same compiler gives every warning,
  including "layout did not converge". The false fact meant nobody looked
  for non-convergence until #116 (2026-11-03).
- #116 (2026-11-03): "pinned, at most 4 compiles" was offered after it was
  measured on one input, the user's book, and the user accepted it. On
  generated notes the pinned loop then needed 3 to 23 compiles, and the
  decision was reopened (it became the hybrid, decision 17).

## Root cause

A measurement records its result but not its scope: which interface, which
inputs, which sizes. Without the scope, the result reads as a property of the
whole class, and the gap between "measured here" and "true everywhere" stays
invisible. A negative finding ("there are none") is the most exposed, since
one path that shows nothing proves nothing about the others.

## Prevention

- Every finding states its scope: the interface or call, the inputs, and
  their range. A finding used for a story, a decision or an option is checked
  for whether its scope covers the claim.
- A negative finding about a tool ("gives no warnings", "never happens")
  names the path measured and the paths not tried, and is searched for in
  the tool's other interfaces before it is relied on.
- An option is measured across the kinds of input it is offered for (short
  and long, sample and generated), not on the one at hand; otherwise the
  question says which inputs were measured.
- Applies next to: compiler and renderer APIs with several entry points,
  limits and counts offered as choices, performance and size findings.
