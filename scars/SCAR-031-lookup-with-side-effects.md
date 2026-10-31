# SCAR-031 — A lookup also reports, so every caller that only looks fills the report

**Area:** Design / Verification
**Severity:** Medium — false and repeated warnings in every compile for months; a real warning never reached the user

---

## What went wrong

A function that answers a question ("which file does this link point at?")
also recorded what it found: it added a warning and counted a missing
reference whenever the target was not found, and another warning when a name
was ambiguous. Over time, more callers used it only to look — to classify a
list item, to check whether a note passes through, to collect what is
embedded before expanding a table of contents. Each of them added warnings
nobody asked for. Two callers noticed and put the counter back; neither put
the warnings back, and a third copy of the "look without side effects"
wrapper existed beside them. The callers that really used the link then
reported the same problem again in their own words.

The result: a false warning for every generated path, every missing link
listed two or three times, and the one useful message — "this name matches
several files, I picked one" — produced up to three times but never written
where the user reads warnings.

In this project: `resolve` in the compiler, found through #88 (a false
"Missing include" per map) on 2026-10-31; fixed by US-8.5 (#93, v0.17.1).

## Root cause

The query and the report were one function, so whoever wanted the answer got
the report too. The first callers were the ones that also reported, so the
coupling looked convenient. Each later "only look" caller was written against
the answer and its side effects were patched locally (save and restore one
counter), which hid the coupling instead of removing it. Tests asserted that
*some* warning appeared, never that each problem appeared once.

## Prevention

- Keep lookups free of side effects: a function that answers a question
  returns everything the caller may need to report (missing, ambiguous, the
  candidates) and reports nothing. The step that acts on the answer reports,
  once, with the place it knows.
- When a caller has to undo a function's side effects ("save the counter,
  call, restore"), treat it as a design defect of the function, not of the
  caller: list every caller (SCAR-017) and move the side effect out.
- Test reports by their exact list — each problem once, with its message and
  place — not by "contains a warning". "Contains" passes with duplicates and
  with false entries.
- Keep a text check that the lookup's body contains no reporting call, so a
  new side effect fails a test.
- Check where each report ends up: a message that is produced but never
  reaches the place users read (here the warnings file) is a silent decision.
- Applies next to: resolvers, caches that log misses, validators that both
  answer and record, parsers that emit diagnostics while being used to peek.
