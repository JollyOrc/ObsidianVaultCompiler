# SCAR-040 — An output format is specified without naming the program that reads it

**Area:** Requirements / Integration
**Severity:** High — every converted link to a heading of more than one word was broken for the real reader from the first build (2026-10-14) to v0.18.0; found only when the decision for two other issues forced a click-through

---

## What went wrong

The product writes one document with internal links. The story for those
links specified their form as "slugs" (`#the-brawling-and-fortune-pools`,
`#1.3.1-combat`) — the convention of one family of markdown renderers. It
never said which program the document is read in. The tests checked that
every link matched a slug of a heading in the output, and they passed: the
format was consistent with itself.

The document is read in a program that finds headings by their text, not by
slug. There, every link to a heading of more than one word led nowhere.
Single-word headings worked by coincidence (their slug equals the text in
lower case), which hid the problem in small examples. It surfaced when two
issues about heading links asked "which viewer?", and the answer was
measured by clicking links in that viewer.

In the Obsidian Vault Compiler: US-2.3 (slug anchors since the first releases), found
2026-11-01 while deciding #83 and #85; replaced by Obsidian's own heading
form, #99.

## Root cause

A format was chosen by habit (the most common convention) instead of by the
consumer, because the consumer was never named. Every test compared the
output with the rule that produced it, so none of them could tell that the
rule was wrong for the reader. Tests that compare the output with the
specification check consistency, not fitness.

## Prevention

- Every story that defines an output format names the program (and version)
  that reads it, in the story's text. If there are several, each is named,
  and a conflict between them is a decision for the user, not a default.
- The format is measured in that program before the story is Ready: one
  example of each kind (here: one link per kind of heading — one word, many
  words, numbers, brackets, accents, punctuation, duplicates) is opened and
  used there. Coincidences (a one-word example that works under any rule) do
  not count as a measurement; each example must tell the rules apart.
- When the reader can produce the format itself (an editor's autocomplete,
  an export, a "copy link" command), its own output is the first measurement
  — it shows the rule without guessing candidate forms (SCAR-024).
- The measured behaviour is kept as a model in the tests, with a guard test
  that replays the measurement against the model; the product's output is
  then checked against the model, not only against its own rule.
- Applies next to: link and anchor forms, file names and paths written into
  documents, image and table syntax, front matter fields, export formats
  read by other tools.
