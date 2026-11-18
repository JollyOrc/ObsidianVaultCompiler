# SCAR-024 — A story states what a dependency does without measuring it

**Area:** Requirements / Integration
**Severity:** Medium — a false statement stood in a story marked Done for five days; a whole feature (template rules) silently did nothing

---

## What went wrong

An acceptance criterion described what a third-party tool would do with the
plugin's output, as a fact: the generated document imports the template "so
the template's functions and rules are available". The tests covered the
functions, which the code used. Nobody tested the rules. The tool's import
brings in definitions only, so no template rule ever applied. It was found
when a real template with styling rules was tried.

In Obsidian2Typst: US-008 AC-9 (Done 2026-10-17); Typst's `#import` does not
carry `#set` and `#show` rules; found 2026-10-22 with the preset
"A5 MU Print", corrected by US-023.

## Root cause

A sentence about a dependency read like part of the specification, so it was
treated as settled. Only the part that the implementation exercised got a
test; the rest was taken from expectation, not from the tool.

## Prevention

- Every statement in a story about what a dependency does is split into its
  parts ("functions are available", "rules apply"), and each part has a test
  with the real tool before the story is Ready.
- A part that cannot be measured in time is written as an assumption
  ("not measured: …"), not as a fact, and stays an open item.
- When a story builds on another story's statement about a tool, the test
  that backs it is named; without one, it is measured first.
- An explanation of an observed failure is marked unverified until a test
  shows it; a change that makes the symptom go away does not prove the
  explanation. Example (2026-10-27, TICKET-072): a ligature was named as the
  cause of a failing PDF text search and withdrawn; the same search had passed
  in an earlier run, and the cause is not established.
- When the tool can produce the thing in question itself (an editor's link
  autocomplete, an export, a "copy" command), take its own output as the
  first measurement instead of guessing candidate forms and trying each
  (added 2026-11-01, Vault Compiler: three rounds of guessed link forms left
  headings with `#` and `:` unreachable; the fourth, Obsidian's own
  autocomplete, showed the rule at once — SCAR-040).
- A statement about where a dependency fails names the code path the run
  actually takes, checked against the configuration. Example (2026-10-30,
  webpage-export US-001 G0): the review cited the timeouts of the fallback renderer for an
  export that uses the main renderer (`useFallbackRenderer: false`);
  corrected while writing the diagnostic build.
- An outcome that varies between runs is reported with every measured
  count, not the first or the best one. Example (2026-10-30, webpage-export US-001 AC-14):
  3/3 in one run, 2/3 in the next; both recorded.
- The review lists the **premises that carry a decision**, not only the
  facts used in the examples, and each is measured or written as "not
  measured". Example (2026-11-17, Game Card Creator US-010): the coverage call
  and the behaviour for a missing character were measured at G0 and the review
  said "measured"; decision D2 ("a character that some other font of the
  compile has is drawn: Typst falls back to any font it has") was written as a
  fact and measured only at the code stage, after a rehearsal picture showed
  boxes where characters should have been (a harness that left out the extra
  fonts). It held: without the extra fonts `✓ 😀 漢 ⌘` were the font's empty
  glyph, with them `✓ 😀 ⌘` were drawn. Ask of each decision: what must the
  dependency do for this to be right, and was that measured?
- A test that compares a dependency's output byte for byte first measures
  which bytes the dependency takes from the clock, chance or the machine
  (produce it twice across a second boundary), sets those aside by name, and
  makes the case that failed by chance happen in every run. Example
  (2026-11-18, Obsidian2Typst #183): Typst writes the dates, to the second,
  and a document ID derived from them into every PDF; a "same bytes twice"
  test failed whenever its two compiles fell on two sides of a second. The
  test now compiles 1.1 s apart and compares with those seven fields blanked.
- Applies next to: compiler and renderer behaviour, Obsidian API timing and
  events, file formats, library defaults.
