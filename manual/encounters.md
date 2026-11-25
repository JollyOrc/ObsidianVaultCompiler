# Encounters

An **encounter list** names the creatures of a room or a scene. When the
document is compiled, each list becomes an `o2t-encounter` block that carries
every creature's properties, so that Obsidian2Typst (0.17.0 or later) can
print the room's encounter rows already filled in.

## Writing a list

In any note that is compiled, write a callout of the type `encounter`:

```markdown
> [!encounter] Night watch
> - 2 × [[Fen Hare]] — nibbling reeds
> - 1d4 × [[Bog Wight|wights]]
> - 1 × Lost Pilgrim — no stats
```

- One line per creature: a count, `×` (or `x`), the creature, and after ` — `
  an optional note. The count is a number (`2`) or dice (`1d4`, `d6`).
- The creature is a link to its note (`[[Fen Hare]]`, `[[Fen Hare#Habits]]`,
  `[text](Fen%20Hare.md)`) or plain text. A linked note with one of your
  **Entry marker keys** gives its properties to the row (images left out);
  plain text, or a note without those keys, gives a row with the name only.
- The creature's note is only read, not compiled: it does not appear in the
  document. With **Expect compiled folders** set, it is still listed as not
  compiled.
- The callout's title (`Night watch`) is kept. Only a callout at the start of
  a line counts; one inside a quote, a list or a code block stays as written.

## The setting

**Encounter callout type** (settings tab, section **Entry data**), default
`encounter`. Another word (`foes`) makes `> [!foes]` the list instead. Empty:
off, every callout stays as written.

## Warnings

| Warning | What it means | How to fix it |
| --- | --- | --- |
| Encounter list: no rows | The callout has no line of the form `2 × Creature`. It is left out of the document. | Write the creatures as list lines with a count and `×`. |
| Encounter list: … lines not read (lines …) | These lines of the callout are not creature lines (a blank `>`, text, a code block). They are left out. | Make them creature lines or move them out of the callout. |
| Encounter list: no note "…" | The link names no note in the vault. The row keeps the name, without properties. | Fix the link. |
