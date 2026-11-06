# SCAR-039 — Invisible markers written into the text are read by steps they were not meant for

**Area:** Design / Verification
**Severity:** Medium — a working feature broke in the change that added the markers; found only by a mutation run

---

## What went wrong

To carry information through a pipeline that only passes text along, the
code wrote invisible markers into the text itself (an HTML comment in front
of every link, holding the note and the source line) and removed them at the
end. The step it was meant for read them correctly. But other steps read the
same text: one of them compared an embed's anchor with a heading, and the
marker had also been written inside the anchor. That section embed was no
longer found, a regression against the previous release.

The tests written for the new feature all passed. The regression showed
only because a mutation run asked for a test of "headings are read without
markers", and the input written for it happened to put a link inside an
anchor.

In the Obsidian Vault Compiler: location markers for warning lines, US-8.4 AC-5 (#97,
v0.18.0); fixed before release by leaving embeds unmarked.

## Root cause

A marker written into shared text is input for every step that reads that
text after it, not only for the step it is addressed to. The design listed
the reader it served and the place it is removed, but not the other readers
between the two, and none of their tests ran with markers present.

## Prevention

- Prefer side channels (a map from position or id to data) over markers in
  the text. When markers are needed, write the list of every step that reads
  the text between insertion and removal into the ticket, with what each one
  does with a marker (passes it on, compares text, counts lines, matches a
  pattern) — the class search of SCAR-017 applied to readers.
- Insert markers only where the target reader looks, and nowhere it does not
  (here: in front of links, never inside embeds or anchors), and state that
  rule with an example of each excluded place.
- Run the existing tests of every listed reader with markers present: a
  guard that the compiled output is byte-identical to the previous release is
  necessary but not enough, because a broken reader may change only a
  warning, or a case the fixture does not contain.
- Remove markers in one place, before anything that formats the final text,
  and keep a guard that no marker reaches the output.
- Applies next to: provenance sentinels, placeholder tokens for protected
  regions, escape sequences added for one parser, tracking ids in generated
  markup.
