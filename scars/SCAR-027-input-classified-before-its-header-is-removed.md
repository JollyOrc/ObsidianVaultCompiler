# SCAR-027 — A file is classified by its first line before its metadata header is removed

**Area:** Specification / Verification
**Severity:** Medium — every note with a metadata header was misclassified, and the header leaked into the output as content

---

## What went wrong

The compiler decides how to treat a note by its first non-empty line: a
heading makes it heading-first, anything else makes it a preamble file, and
a lone embed makes it a pass-through. Notes in Obsidian can start with a YAML
frontmatter block between two `---` lines. The compiler did not know about it,
so a spell note `---` / `tags:` / `  - LeafCraft` / `---` / `Spell text.`
counted as a preamble file, its title went above the `---`, and the YAML went
into the rulebook as a rule, a line of text and a list (93 blocks in the example
vault). Other rules read the same raw text: a YAML comment `# …` looked like a
heading or a section anchor, and a list item `- [[Note]]` looked like a ToC
entry to expand.

## Root cause

The stories described a note's content but not the format of the file: which
parts of the file are not content (a metadata header, a byte-order mark,
line-ending differences). Each rule that looks at "the start of the file" or
"every line" read the raw file text. No single step turned the file into
content before the rules ran, and no test had a note whose first line was
anything but content.

## Prevention

- When a story classifies or rewrites input by its position ("first line",
  "first heading", "whole file is one embed"), list the parts of the file format
  that are not content and say where each is removed. The removal happens once,
  at read time, before every rule.
- Put the read in one function and add a text check that it is the only place
  the raw text is read (SCAR-017). A new rule then cannot see the header by
  accident.
- Test every classification with a header in front of it, using inputs where
  keeping the header changes the result (SCAR-023): a header comment that looks
  like a heading, a header list that looks like a ToC, a wrapper whose header
  is its only other text.
- Test the look-alike that must stay: the same delimiter in the middle of the
  file, or without its closing line, is content.
- When a removal changes line numbers, say whether reported locations count
  source lines, and test that.
- Applies next to: byte-order marks, `%% comments %%`, HTML comments at the top
  of a note, Typst or LaTeX preambles, CSV header rows, any format with a
  metadata block.
