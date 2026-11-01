# SCAR-034 — A rule that reads the start of a line does not see past a container's marker

**Area:** Specification / Verification
**Severity:** Medium — content inside a container is silently treated as something else, and inserted text breaks the container

---

## What went wrong

Markdown puts blocks inside containers by marking the start of every line:
`> ` for a quote, indentation for a list item. The compiler's rules for code
blocks, headings and indented code all read the start of the raw line, so
inside a quote they saw `>` and nothing else. A `> ~~~` block was not code:
its link was converted and its embed pasted in. A quoted backtick block was
protected only by accident, because its backtick runs paired up as inline
code. And an embed on a quote line, `> ![[Note]]`, put only the first line of
the note in the quote; every other line of the inserted note started without
`> ` and fell out of the container.

## Root cause

Each line-start rule was specified and tested only on top-level lines. The
stories never listed the containers a line can be in, so no rule said whether
it reads the line before or after the container's marker, and no step said
that text inserted into a container must carry the marker on every line.
SCAR-009 ("text moved into a new container starts a new block") covers the
join; this is the reverse: the rule cannot see into the container at all.

## Prevention

- When a story defines a rule by the start of a line (a fence, a heading, a
  list item, indentation, a marker), list the containers a line can be in and
  say whether the rule reads the line after the container's marker. Put the
  reading of the marker in one function, with a text check that it is the
  only one (SCAR-017).
- Say what ends a block when its container ends (a quote that ends closes the
  fenced block inside it).
- Every step that inserts several lines into one line says what happens to
  the container that line is in; the inserted text carries the marker on
  every line, empty lines included.
- Test each line-start rule once inside each container and once inside a
  nested one, with inputs where reading the raw line gives a different result
  (SCAR-023).
- Applies next to: list items and their continuation lines, callouts, footnote
  bodies, table cells, any format with line prefixes (e-mail quoting, comment
  blocks in source code).
