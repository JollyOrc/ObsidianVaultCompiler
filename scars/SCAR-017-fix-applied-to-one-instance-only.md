# SCAR-017 — A defect is fixed where it was seen, and the same pattern stays broken everywhere else

**Area:** Process / Verification
**Severity:** Medium — each time the user found the same defect again, one build later, on a sibling control

---

## What went wrong

Three times in one week the user found a defect, it was fixed on the control
where it showed, and the identical defect was found next on a sibling:

1. M5 (`0.1.0-m5.1`): the Fonts rows did not redraw after a change. The fix
   went into the Fonts rows only; the same stale-screen pattern was found again
   in the reset icon of the Defaults rows (M2, `0.1.0-m5.3`; SCAR-016).
2. The reset question (SCAR-014) was built for the Fonts rows and reached the
   older Defaults rows only because the user asked for it.
3. M2 step 14 (`0.1.0-m5.5`): half-typed numbers raised notices for every
   preset. The fix guarded the lone width and height in the two trim rows; every
   other text field of the tab (the Defaults rows, the Fonts rows, the presets
   folder, which even creates a folder per typed character) still saved on every
   key and was found one build later (`0.1.0-m5.6`).

## Root cause

A fix was written for the instance in the bug report, not for the class of the
bug. The code had no single place for the pattern (five copies of "save on every
key"), so nothing pointed at the siblings, and the tests named the instance
(`Trim width`), not the rule ("no field is saved on a half-typed value"). No
step in the fix asked "where else does this exist?".

## Prevention

- Every fix starts with a search for the pattern, not the instance: `grep` for
  the call, the control type or the shape of the code that caused the defect
  (here `addText(`, `onChange(`), and the list of hits goes into the ticket
  with the decision for each: fixed, or why it is not affected.
- The rule is stated for the class in the user story ("every text field …"), not
  for the control that was reported, and the AC names every member of the class.
- Put the pattern in one function (here `commitOnChange`) and make the test a
  text check over the whole file that fails when a new instance bypasses it
  (count of `addText(` equals count of `commitOnChange(`; no `onChange(` on a
  text component). A new control then breaks the test, not the user's afternoon.
- A bug report from a manual check is answered with "the same defect may be on:
  <list>" in the handover, and the manual check step covers one more member of
  the class than the one that failed.
- A story that adds a way to change a value lists, in its inventory of today's
  behaviour, every place that writes that value, found by a grep for the value
  itself (`activePreset:`), not only by looking for commands and buttons.
  Example (2026-10-21, US-020): the story's inventory missed the style
  panel's preset dropdown; the class grep found it only at coding time.
- Moved on 2026-10-22 to SCAR-023 (items 6 and 7 of this list before that
  date): a text check matches the whole statement, and a drawing a fake can
  carry is drawn; before tickets, the tests are searched for guards that
  forbid a new call.
- The documents written for the fix (story, tests, tickets) are part of the
  class and go through the same check. Example (2026-10-27, US-024): the story
  that removes private words from the published files named two of them, and
  an example in it quoted a removed heading; the story's own scan found both.
- When a defect is a value missing from a table that several screens read
  (built-in values, labels, defaults), every reader of that table is listed
  at G0 — a search for the table's name and for the values it should hold —
  not only the screen where the defect was seen. Example (2026-10-31,
  US-029): the toggles' missing built-ins were found at G0; the details
  table read the same incomplete table (16 rows showed `—`) and was found
  only at G3.
- A check that only classifies an input (is this a wrapper, a list of
  links, an embed on its own line?) reads it through the same function as
  the step that then uses it, never through its own copy of the syntax. A
  copied pattern drifts: it misses the forms the main reader learnt later
  (escapes, other spellings), and the classifier then hands the user step a
  different reading than the user step would have made. When a fix touches a
  reader, search for every regex of the same syntax, not only for calls of
  the reader. Example (2026-11-10, Vault Compiler US-6.5, #123): a note that
  is only `![x](Rules%20Book.md#Duel%20Checks)` was classified by two copied
  regexes that took the heading undecoded and knew no `<…>` or paths without
  `.md`; the main embed reader decoded it. The section was dropped with a
  false *Missing heading anchor* in exactly the notes the classifier claimed.
  Both copies now call one `readWrapper`, with a text check that no copy of
  the old pattern is left.
- An operation that can be started by several input routes (typed, picked in a dialog,
  pasted, dragged) is a class: the story lists every route and gives the refusal example for
  each, and the tests and the manual check run the refusal through each route, not only the
  first. Example (2026-11-12, Game Card Creator US-007, M04): the output folder could be typed
  or chosen in the system's folder dialog; the refusal of the vault's own folder was tested for
  the typed route (the message under the field), but the dialog route committed the same value,
  showed the message and then redrew the page at once, which erased it: the author saw the old
  value come back with no warning. The route's handling moved into one function
  (`pickOutputFolder`) with a test per outcome.
- A value added to an enumeration (a kind, a mode, a list of settings or fields)
  is a class: at G2 every place that enumerates it is searched (`'skill'`, the
  field list, the kind check, an `else` branch that means "the other one"), and
  the **whole** suite is run against the enumeration as implemented, not only
  the new tests. A test that pins the old size or membership, and a branch that
  silently takes the new value for an old one, show up in that run, not in the
  user's output. Example (2026-11-13, Game Card Creator US-004 #21): the new
  rule kind `creature` turned five older tests red (the field count, the page
  groups, the unknown kind used in two examples, the defaults) and an `else`
  in the run that meant "not a skill, so a spell" would have made spell cards
  from creature notes; both were found when the code of the ticket ran, not
  when its tests were written.
- Applies next to: every defect found in M-checks (stale screens SCAR-016,
  confirmations SCAR-014, Enter key SCAR-013, validation, number formats), and to
  every refactor that copies a block between rows.
