# SCAR-023 — A guard or test does not check what its criterion says

**Area:** Verification
**Severity:** Medium — tests passed with the rule broken, or failed on legitimate work; each time found only by a mutation run or a red baseline

---

## What went wrong

Seven times a test did not match the criterion it named:

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
   without labels as "not tidied" while the test passed (Vault Compiler US-4.9, #91).
6. A text check asserted that a call came after another and was not inside an
   `if` block; a mutant that made the call's argument depend on the same
   condition passed it (Vault Compiler US-4.10, #92).
7. Two tests written for one ticket could not both be true: a text check
   required the entry point to contain `confirmReplace: confirmReplaceWith(Modal)`,
   while the behaviour test called the same function with the app as its first
   argument, which the entry point had no way to supply; and a fake of the
   host's link lookup matched a link by base name and path but not by file name,
   as the real one does. Both were found only when the code was written, after
   the tests had been accepted as complete (Game Card Creator US-008 #14).

Items 1 to 3, 5 and 6 pass when the rule is broken; items 4 and 7 fail when
nothing is wrong. (Items 1 to 4 gathered from SCAR-010, SCAR-017 and SCAR-018 on
2026-10-22, Obsidian2Typst; 5 and 6 added 2026-10-31, Vault Compiler.)

## Root cause

A guard was written from what was easy to match (a name, a pattern, an input
at hand), not from the criterion it protects, and nothing compared the two.
A guard that checks less than its criterion cannot fail; a guard that checks
more blocks the next correct change.

## Prevention

- A guard checks exactly its criterion: not less, not more. Write the
  criterion next to the guard and read both together.
  Recurrence (2026-11-17, Game Card Creator US-013 #56): a G2 text check pinned
  *where* the rename handling lives (`followRename` in `main.ts`) instead of the
  criterion (the saved selection follows renames); it collided with the guard
  that keeps `main.ts` at most 120 lines and was amended to the criterion.
- A guard over generated output asserts how many places it checked, against
  an independent count (the number of pieces written, a count from the
  source). A pattern that silently skips some places still passes.
- A text check matches the whole statement it guards — the condition and the
  call (`if (group.heading !== null) { …setHeading() }`), not a name — and a
  drawing that a test fake can carry is tested by drawing it; when the fake
  cannot carry it, the fake is extended to follow the measured behaviour of
  the real consumer. Checking where a call is (after X, outside block Y) is
  not checking the statement: match it whole, with its arguments, at the
  nesting level the criterion asks for. Example (2026-10-31, Vault Compiler
  US-4.10): the check now matches `\n  const directives = applyMapDirectives(svg,
  mapDocId(code), parseMapDirectives(code));` at function level.
- Every test input is one the real producer can give (a list the store always
  sorts stays sorted) and is named for the branch it reaches. A surviving
  mutant is read first as a test input that cannot reach the mutated rule.
  Example (2026-10-27, Vault Compiler US-6.1/US-6.3): the tests built the
  compiler with the heading option left out; the plugin always passes `true`
  or `false`, and with `false` the auto-headings of US-6.1 never ran for any
  user. For an option, test every value the real caller can pass, not the
  value the test helper defaults to. The same holds for an injected
  collaborator: when the real caller always passes one (a lookup, a clock, a
  file reader), at least one test passes a stand-in that behaves like it.
  Example (2026-10-31, Vault Compiler US-8.5, #93): every test built the
  compiler without the link lookup the plugin always passes (Obsidian's), so
  the compiler's own name search ran in all tests and never in Obsidian; the
  ambiguous-name report, as first written, could only work in tests.
- A fixture that stands in for a dependency's output is taken from that
  output, in the exact form the real path produces it (after serialisation,
  encoding, normalisation), not written by hand. Hand-written fixtures pick
  the readable form, which may be one the producer never emits — empty
  elements self-closed, attribute order, escaping, line endings. Example
  (2026-10-31, Vault Compiler US-4.10): the new fixtures are the plugin's own output, run
  outside the app, serialised with self-closed empty elements; that is how
  the defect of item 5 was found (Vault Compiler).
- A test input must be able to tell the rule from its rivals. Example
  (2026-10-27, US-6.3): "the first heading is replaced by the filename" was
  tested only with notes whose first heading already equalled the filename
  (`1.3.2 Magic.md` = `# Magic`), so keeping the heading passed too; 19 of 33
  heading-first notes in the real vault differ. Choose inputs where the
  competing behaviours give different output.
  Recurrence (2026-11-17, Game Card Creator US-010): the mutation rounds of
  four tickets found six tests whose inputs could not tell the rule from its
  rival, each closed by a test: a "sorted" result tested with text whose
  insertion order was already sorted; a merge of coverage ranges tested only
  with disjoint ranges (a range inside another one shortened it, unnoticed);
  an empty list of fonts tested never, only `undefined` (a `fonts` key was sent
  for none); a worker that fails during a request, never provoked; a runner
  never given a creature sheet (its extra fonts were not passed on). For each
  rule, name the input that its nearest wrong version would also pass, and add
  the input that it would fail.
- Before tickets are written, search the tests for every new call a ticket
  adds (a write, a delete, a network request) and list each guard test that
  forbids it. Search for the calls a ticket removes as well: a guard can also
  pin an exception that the change takes away. Example (2026-10-27, Vault
  Compiler T-4.2-B): the ticket said "no guard affected" without a search;
  three write-call guards allowed exactly the five temp-folder writes the
  ticket removed, and failed on the first run. The search also lists the tests
  that call a function or export the ticket removes or renames: they fail to
  compile, not on a guard. Example (2026-11-17, Game Card Creator US-013 #55):
  the ticket removed `resetPage` and listed three tests as "unchanged and
  green"; all three called it. A guard that is wider than the
  acceptance criterion it names is
  narrowed to that criterion, with the reason, in the ticket.
- A test that one side wins over another also asserts that the losing side
  was in effect (a mark it leaves elsewhere); otherwise "it wins" cannot be
  told from "it was never applied". Example (2026-10-22, US-023): three
  tests "the preset wins over the template" passed before any code existed,
  because the template was not applied at all; each conflict template now
  also sets the page fill, and each test asserts it.
- Prove a guard with a mutation check: switch the rule off and see the guard
  fail.
- A test that output is the same on every run runs the code from two fresh
  starts (separate processes), so state taken at load time (a clock, a
  random seed) differs between the runs. Example (2026-10-27, TICKET-069): two
  generations inside one import could not see a seed taken from the clock; a
  mutant showed it.
- The search before tickets also lists every test that pins the whole
  membership of a list or object the ticket grows (the keys of the effective
  settings, the plugin's names, the rows); each is extended or narrowed in the
  ticket. Example (2026-10-28, TICKET-075): two tests of the effective
  settings were missed and went red with the new setting.
- That search is run by the names of the functions whose result the ticket
  widens (every `toEqual` over their return value), not only by the keys of
  the data. Example (2026-10-29, TICKET-086): the search looked for the new
  `toc` keys and missed a test that pinned the whole view `activePresetView`
  returns; it went red when the view gained the Defaults.
- When a criterion allows an exception at an edge, the guard checks that the
  exception occurs only there (for example only at the last case of a run of
  a sweep), never as an allowance granted to every case. Example (2026-10-29,
  TICKET-096): the float check accepted "the text after it is on the next
  page" for every float because AC-8 allows it at the tightest edge; a helper
  under which no float ever filled its gap passed all 35 PDF tests.
- When code or rows move (into another file, a modal, a new module), the
  search also runs by the moved text: the labels, call sequences, file paths
  and statements that text checks pin, not only by function names; every
  test that reads the old place is listed in the ticket with what it pins.
  Example (2026-10-31, US-029 #112, #113): the search ran by `detailRows`,
  `pageRows`, `setButtonText`; seven text checks went red later — the
  `showGlobals`/`restoreScroll` sequence, `addDefaultRows(` in each screen,
  the Bleed row of the panel (moved into a modal), the panel's order, the
  name dialog's keys and the delete path (both moved out of the tab).
- A test can protect a defect: when it describes what the code did instead of
  what its story says, fixing the code turns it red. Read every test against
  the criterion it names, and when the two disagree, the story wins. Example
  (2026-10-27, Vault Compiler US-1.3): "a bullet list of markdown links becomes
  anchor links (not embeds)" asserted the opposite of US-1.3 ("wiki `[[…]]` or
  standard `[text](…)` syntax"), so `index2compile.md` silently lost two
  chapters; a second test wrote a link as a one-item list without meaning a
  ToC.
- A test sample of a producer's output is taken from or checked against the
  real output, not written from memory. Example (2026-10-30, webpage-export
  US-001 #3): the HTML reader's script sample had no `<`, so a mutant that read
  script content as markup survived; 4 of 7 inline scripts of a real exported
  page contain `<`; a test with that shape was added.
- A DOM test input built from an HTML string goes through the parser,
  which reshapes some markup (a block closes an open `<p>`); when the real
  producer builds the DOM without parsing, the test builds it the same way.
  Example (2026-10-31, webpage-export #8): 7 unit tests failed on inputs the
  parser had emptied, not on the code; `tests/support/dom.ts` builds the
  render's shape.
- A stand-in for a dependency in a test (a fixture plugin, a fake service)
  copies the dependency's mechanism that the rule depends on, above all its
  timing (when it returns, what runs later), not only the visible result;
  and the test is shown to fail under the old rule before the code is
  written. Example (2026-11-11, webpage-export US-004): the fixture plugin
  awaited its drawing inside the code-block processor, while Dataview
  starts its script without awaiting it; the test passed under the broken
  rule. Rewritten to return at once and draw later, it failed as on the
  user's desktop.
  Recurrence (2026-11-17, Game Card Creator US-013, #58): the fake modal of the
  dialog tests opened by calling `onOpen` only; Obsidian also focuses the first
  focusable element afterwards, so no test could see that the replace question
  opened on Replace. The new fake copies the measured behaviour; the test was
  red on the old code before the fix.
- Tests written for one interface are proven against a throwaway reference
  of that interface before the tickets, **all of them together**, not only the
  group that is easy to reference: a text check over the entry point, a
  behaviour test of the function it wires, and the fakes of the host. A text
  check that pins how a function is called and a test that calls it are read
  side by side, and the entry point is written on paper (what it passes where)
  to see that both hold; a fake of a host function lists how the real one
  finds its target (by path, by name, by base name) and carries each way the
  tests use. Example (2026-11-12, Game Card Creator US-008): the worker's tests
  were proven against a reference at G2 and held; the adapters, the wiring
  checks and their fakes were left to "read at the first green run", and the
  two slips of item 7 appeared there. The prevention is a reference for the
  whole set, or, when that is too costly, a written sentence in the ticket
  naming which tests were not proven and why.
- The expected list of a test (the warnings, the text, the cards) is written
  after the example has been run through the existing reader of **every**
  acceptance criterion it touches, and what else it produces is read. An
  example that is complete for one AC can trigger another: the expected list
  then misses a warning the other AC requires, or a rule the test cites
  (US-002 AC-4) behaves differently from the way the test remembers it.
  Example (2026-11-13, Game Card Creator US-004, G2): three expectations were
  wrong: a note without a Behaviour section, written for the text rules, also
  gave AC-2's missing-section warning; "a code block is left out" contradicted
  the cited US-002 AC-4 (shown as its plain text lines); a statblock's band
  was expected to show the card's name when it is the API's text. All three
  were found when the code ran, not when the tests were proven red.
- A stand-in for a collaborator returns, for every call the code under test
  makes, what the real one returns for it, not only the part the test is
  about: when the code reads a second result of the same call (the compiler's
  `gcc-fit` facts next to its PDF), the stand-in writes it too, or every
  expectation that says "no warning" fails for a reason that is not the
  rule. Example (2026-11-16, Game Card Creator US-009, G2): the stand-in
  compiler of the run tests returned a PDF and no facts; the run then warned
  `FIT_UNKNOWN` for every card, and ten expectations of "no warnings" were red
  for that reason. Found when the code ran, the ninth wrong test of that story.
- The search before the code for tests that pin a membership the ticket grows also covers object literals typed
  by the widened interface (a settings object written out by hand) and filters by an id prefix (`id.startsWith`),
  not only `toEqual` over a function's result. Example (2026-11-16, Game Card Creator US-012): the creature
  settings gained three keys; six earlier tests were found only when a throwaway reference ran the whole suite:
  four settings literals with only the headings (one only by the type check) and a filter that took every
  `creature.` field for a heading.
- A text guard's pattern is read against what it is meant to catch, and a match outside that (a name in a
  comment, a constant named like the forbidden literal) is reported with the guard, not silently avoided.
  Example (2026-11-16, Game Card Creator US-012 #48): the guard "no literal `CREATURE_` warning code outside the
  code table" matched a doc comment that named the constant `` `CREATURE_EQUAL_PRELUDE` ``; the constants were
  renamed `EQUAL_CREATURE_*` and the guard's width noted in the ticket.
  Recurrence (2026-11-17, Game Card Creator US-013 #55, #56): a tab dependency named `copy` matched the guard
  "only the store copies a file", a handler signature `rename(` the guard against Node file writes; both renamed
  (`toClipboard`, `onRename`), the guards' width noted.
- A mutation round first proves its test set green on the unmutated code; a file
  in the set that is red by design (a later ticket's test) makes every mutant
  count as caught, whatever it does. Example (2026-11-17, Game Card Creator
  US-013 #51): the first round ran a runner test red until #54 and reported 14 of
  14; with the set proven green first, one mutant survived and was a real gap.
- A visual criterion (a gap, an overlap, a distance) is checked on what is
  drawn — the ink from the glyph outlines, the drawn stroke — not on its
  containers (text frames, advance boxes, bounding boxes of neighbours);
  where only a container can be checked, the test says so and the output is
  inspected. Example (2026-11-23, roa-character-sheets US-003): the gap after a
  heading initial was set by advance widths and the visible gap came from the
  side bearings; a title rule measured text frames, about 1.25 em taller than
  the letters, and moved a title that fitted.
- Applies next to: text checks over source files, guards over generated
  output, wiring tests, fakes of a framework.
