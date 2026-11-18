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
- A number that a story cites is measured with exactly the layout, settings
  and inputs the story states, and the measurement says which variant it was
  (a spike that differs from the specified layout is named as such). When the
  real implementation first disagrees with a cited number, the number is
  measured again with the story's own layout by an independent run before
  either the story or the code is changed. Example (2026-11-11, Game Card
  Creator US-002 #4): the size for a 200-word card (5.75 pt) was measured in
  a spike with filled tag chips; the story's layout has plain tags and gives
  6 pt, which an independent spike run and the emitter both showed.
- A tester's report is evidence only for what it states. A summary ("passes
  mostly", "all pass") is not an observation of each step's outcome: the
  developer does not state an outcome nobody reported (that a key cancelled,
  that a file was written), but reads it on the disk or asks. Example
  (2026-11-17, Game Card Creator US-013 M12 step 14): from "passes mostly, but
  the focus is on Replace" the developer wrote "Enter cancelled the run"; the
  author had seen Enter replace the cards, which made it a High defect (F1),
  not a cosmetic one.
- A count given to the owner for a decision (how many places, how much
  work) names the search it was counted with and what that search cannot
  see; a count from one narrow search is a lower bound, not the inventory.
  Example (2026-11-18, Obsidian2Typst US-042 T6): "about 68 user-facing
  literals" came from a grep for a few field names; reading every
  sentence-like literal found about 220, and the owner's choice had to be
  asked again.
- A timing that is cited for a decision runs the code path the product runs:
  the product's own entry point in its host (the installed plugin's function,
  called inside the app), with the product's options and callbacks. A timing
  from a harness that calls an inner function is labelled as such and names
  every option and callback it leaves out; it does not decide anything until
  a run of the product's path confirms it. Example (2026-11-18, Vault Compiler
  US-7.4 VC-5, the day after the point on cited numbers was added): a Node
  script timed the compile core at 2.4 to 2.7 s, and the owner decided on a
  progress tab and a worker. The script did not pass the plugin's link
  resolver, so the core ran its fallback search over all files; in Obsidian
  the core took 0.41 s and a whole run 1.0 to 1.2 s. Both decisions were put
  to the owner again and both features were dropped.
- Applies next to: compiler and renderer APIs with several entry points,
  limits and counts offered as choices, performance and size findings.
