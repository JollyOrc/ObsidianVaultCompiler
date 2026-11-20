# Details: a few facts under a heading

[Back to the manual](manual.md)

Some notes carry a few facts that belong in one row under the heading: how
long a craft takes, what kind it is, what it needs, whether you know it from
the start. These are not [entries](entries.md) (no statblock, no page of
their own). You keep the facts as properties, and **Obsidian2Typst** (0.14.0
or later) prints them as a row of badges under the heading. This plugin
carries them into the document.

## Contents

- [Turning it on](#turning-it-on)
- [What a detail note looks like in the document](#what-a-detail-note-looks-like-in-the-document)
- [What is written](#what-is-written)
- [Warnings](#warnings)

## Turning it on

Put the property names into **Detail marker keys** (settings tab, section
**Entry data**), for example `pace, kind, needs, starter`. A note with at
least one of them is a **detail note**, and **only these properties, in the
order you list them,** go into the block. With the setting empty (the
default), nothing changes.

## What a detail note looks like in the document

A note `Rope Laying.md` with these properties:

```yaml
kind: craft
pace: Swift
needs: "[[Basket Knots]]"
tags:
  - craft
```

and the setting `pace, kind, needs, starter` becomes, right under its
heading:

````markdown
### Rope Laying
```o2t-details
pace: Swift
kind: craft
needs: "[[#Basket Knots|Basket Knots]]"
```
You lay rope. …
````

In Obsidian, the block shows as a row of badges when Obsidian2Typst is
installed, and as a code block otherwise.

## What is written

- **Only the listed properties** are written, in the setting's order, names
  in lower case. `tags` and everything else are left out unless you list
  them.
- **Text, numbers and checkboxes** are written as they are (`true` or `false`
  for a checkbox); an empty property is written empty.
- **A list or a map is left out**, with a warning. If nothing is left, the
  note gets no block.
- **Links stay links.** Unlike an entry, a link in a detail value points to
  the heading in the book that the linked note gets, so the printed row can
  jump there. A link to a note that is not in the book becomes plain text,
  with the same warning as in your text.
- Only notes brought in **whole** (listed or embedded) get the block; a
  section embed, a quote and the starting note do not. A note embedded twice
  gets a block each time.
- A note that has both an entry marker key and a detail key is an entry; it
  gets only the entry block, and the warnings file says so.
- A ` ```dataviewjs ` block holding `dv.view(...)` is removed as always, and
  leaves no blank line between the heading and the block.

## Warnings

| Warning | What it means | How to fix it |
| --- | --- | --- |
| Detail value is not text: … | A detail property holds a list or a map, which a detail row cannot show. It is left out of the block. | Make it one text, or take it out of *Detail marker keys*. |
| Detail keys differ only in case: … / … | The note has two properties such as `Pace` and `pace`. | Keep one of them; the first one is used. |
| Entry keys and detail keys in one note: only the entry block is written | The note has a property of *Entry marker keys* and one of *Detail marker keys*. | Usually fine; the note is an entry. |
