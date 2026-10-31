# SCAR-023 — A guard or test does not check what its criterion says

**Area:** Verification
**Severity:** Medium — tests passed with the rule broken, or failed on legitimate work; each time found only by a mutation run or a red baseline

---

## What went wrong

Six times a test did not match the criterion it named:

1. A guard over generated output read "the character after the call" with a
   pattern that does not match a line end; it checked 124 of 139 calls and
   passed (US-018).
2. A text check looked for a call by name; a mutant that wrapped the call in
   `if (false)` passed it (US-021).
3. Two mutants survived because the test inputs were ones the real producer
   never gives (a list out of the store's order, a file name without its
   extension), so the inputs never reached the rule under test (US-020).
4. A guard over the vault port forbade every `vault.process(` call although its
   criterion only said that export and preview never write presets; a later
   story's legitimate write turned the baseline red (US-022).
5. A fixture wrote an empty SVG group as `<g id="labels-…"></g>`; the browser's
   serialiser writes `<g id="labels-…"/>`, and the code reported every map
   without labels as "not tidied" while the test passed (US-4.9, #91).
6. A text check asserted that a call came after another and was not inside an
   `if` block; a mutant that made the call's argument depend on the same
   condition passed it (US-4.10, #92).

Items 1 to 3, 5 and 6 pass when the rule is broken; item 4 fails when nothing
is wrong. (Items 1 to 4 gathered from SCAR-010, SCAR-017 and SCAR-018 on
2026-10-22; 5 and 6 added 2026-10-31.)

## Root cause

A guard was written from what was easy to match (a name, a pattern, an input
at hand), not from the criterion it protects, and nothing compared the two.
A guard that checks less than its criterion cannot fail; a guard that checks
more blocks the next correct change.

## Prevention

- A guard checks exactly its criterion: not less, not more. Write the
  criterion next to the guard and read both together.
- A guard over generated output asserts how many places it checked, against
  an independent count (the number of pieces written, a count from the
  source). A pattern that silently skips some places still passes.
- A text check matches the whole statement it guards — the condition and the
  call (`if (group.heading !== null) { …setHeading() }`), not a name — and a
  drawing that a test fake can carry is tested by drawing it; when the fake
  cannot carry it, the fake is extended to follow the measured behaviour of
  the real consumer. Checking where a call is (after X, outside block Y) is
  not checking the statement: match it whole, with its arguments, at the
  nesting level the criterion asks for. Example (2026-10-31, US-4.10): the
  check now matches `\n  const directives = applyMapDirectives(svg,
  mapDocId(code), parseMapDirectives(code));` at function level.
- Every test input is one the real producer can give (a list the store always
  sorts stays sorted) and is named for the branch it reaches. A surviving
  mutant is read first as a test input that cannot reach the mutated rule.
  Example (2026-10-27, Vault Compiler US-6.1/US-6.3): the tests built the
  compiler with the heading option left out; the plugin always passes `true`
  or `false`, and with `false` the auto-headings of US-6.1 never ran for any
  user. For an option, test every value the real caller can pass, not the
  value the test helper defaults to.
- A fixture that stands in for a dependency's output is taken from that
  output, in the exact form the real path produces it (after serialisation,
  encoding, normalisation), not written by hand. Hand-written fixtures pick
  the readable form, which may be one the producer never emits — empty
  elements self-closed, attribute order, escaping, line endings. Example
  (2026-10-31, US-4.10): the new fixtures are the plugin's own output, run
  outside the app, serialised with self-closed empty elements; that is how
  the defect of item 5 was found.
- A test input must be able to tell the rule from its rivals. Example
  (2026-10-27, US-6.3): "the first heading is replaced by the filename" was
  tested only with notes whose first heading already equalled the filename
  (`1.3.2 Magic.md` = `# Magic`), so keeping the heading passed too; 19 of 33
  heading-first notes in the real vault differ. Choose inputs where the
  competing behaviours give different output.
- Before tickets are written, search the tests for every new call a ticket
  adds (a write, a delete, a network request) and list each guard test that
  forbids it. Search for the calls a ticket removes as well: a guard can also
  pin an exception that the change takes away. Example (2026-10-27, Vault
  Compiler T-4.2-B): the ticket said "no guard affected" without a search;
  three write-call guards allowed exactly the five temp-folder writes the
  ticket removed, and failed on the first run. A guard that is wider than the acceptance criterion it names is
  narrowed to that criterion, with the reason, in the ticket.
- A test that one side wins over another also asserts that the losing side
  was in effect (a mark it leaves elsewhere); otherwise "it wins" cannot be
  told from "it was never applied". Example (2026-10-22, US-023): three
  tests "the preset wins over the template" passed before any code existed,
  because the template was not applied at all; each conflict template now
  also sets the page fill, and each test asserts it.
- Prove a guard with a mutation check: switch the rule off and see the guard
  fail.
- A test can protect a defect: when it describes what the code did instead of
  what its story says, fixing the code turns it red. Read every test against
  the criterion it names, and when the two disagree, the story wins. Example
  (2026-10-27, Vault Compiler US-1.3): "a bullet list of markdown links becomes
  anchor links (not embeds)" asserted the opposite of US-1.3 ("wiki `[[…]]` or
  standard `[text](…)` syntax"), so `index2compile.md` silently lost two
  chapters; a second test wrote a link as a one-item list without meaning a
  ToC.
- Applies next to: text checks over source files, guards over generated
  output, wiring tests, fakes of a framework.
