# Entries: creatures, spells and items with data

[Back to the manual](manual.md)

Some books describe many things of one kind (creatures, spells, items), each
with numbers: a creature's strength, its attacks, its picture. You keep these
numbers as the note's **properties**, and the typesetting plugin
**Obsidian2Typst** (0.12.0 or later) prints them as a statblock. This plugin
carries the properties into the document for it.

## Contents

- [Turning it on](#turning-it-on)
- [What an entry looks like in the document](#what-an-entry-looks-like-in-the-document)
- [The picture](#the-picture)
- [Which notes get the block](#which-notes-get-the-block)
- [Each entry once](#each-entry-once)
- [Notes that never made it into the book](#notes-that-never-made-it-into-the-book)
- [Warnings](#warnings)

## Turning it on

In the settings (section **Entry data**), put the property names that mark an
entry into **Entry marker keys**, for example
`vigour, attacks, illustration, layout`. A note that has at least one of them
is an entry. With the setting empty (the default), nothing changes: all
properties are left out.

| Setting | Default | Meaning |
| --- | --- | --- |
| Entry marker keys | empty | Properties that make a note an entry. |
| Entry exclude keys | `aliases, cssclasses, publish` | Properties never written into the block. |
| Entry image keys | `illustration` | Properties that name a picture to copy. |
| Expect compiled folders | empty | Folders whose notes must all be in the document. |

## What an entry looks like in the document

A note `Fen Hare.md` with these properties:

```yaml
vigour: 11
might: 4
attacks:
  - "Kick: 2d6"
skills:
  - "[[Quick Step]]"
tags:
  - beast
illustration: "[[hare.png|Drawn by A. Nobody]]"
aliases:
  - Hare
```

becomes, right under its heading:

````markdown
### Fen Hare
```o2t-entry
vigour: 11
might: 4
attacks:
  - "Kick: 2d6"
skills:
  - Quick Step
tags:
  - beast
illustration: "![Drawn by A. Nobody](assets/hare.png)"
```
Fen hares are quick and shy. …
````

- **Every property is kept**, `tags` included, except those in **Entry
  exclude keys** (`aliases` above). Names are written in lower case, in your
  order.
- **Links become plain text** (`[[Quick Step]]` → `Quick Step`): the
  statblock never has links. Bold and italic stay.

In Obsidian, the block shows as a statblock when Obsidian2Typst is installed,
and as a code block otherwise.

## The picture

The picture named in an **Entry image key** (`illustration`) is copied into
`assets/` like an embedded picture, and its credit is kept.

- Write it as `[[picture.png|Credit]]`: Obsidian then updates the property
  when you rename or move the picture.
- Other forms (`![[…]]`, `![Credit](path)`, a plain path) work too, but
  Obsidian does not update them.
- A number such as `|300` is a size, never a credit.

## Which notes get the block

- Only notes brought in **whole** (listed or embedded) get the block; a
  section embed (`![[Fen Hare#Signs]]`), a quote and the starting note do not.
- Turn **Normalise headings** on (or give the entry notes headings deeper than
  their chapter), so the entries sit inside their chapter's heading. See
  [Headings](headings.md).
- A note that has both an entry marker key and a
  [detail](details.md) marker key is an entry; it gets only the entry block.

## Each entry once

When two lists bring in the same entry note (a creature tagged into two
groups), it appears only the first time. The second place holds a hidden
note, `<!-- repeat of "Fen Hare" omitted -->`, and the warnings file lists
*Duplicate entry omitted*. Notes that are not entries still appear as often
as they are listed.

## Notes that never made it into the book

Put the folders that hold your entries into **Expect compiled folders**, for
example `Notes/Creatures`. After each compilation, every note in them (and in
their subfolders) that is not in the document as a whole note is listed in
the warnings file: *Not compiled*, or *Not compiled (section embed only)* /
*(quoted only)* when it appears only that way. The notice at the end says how
many, for example *… 1 duplicate entry omitted, 2 notes not compiled: see
warnings_….md.*

Folder names are case-sensitive; a folder that does not exist gives
*Folder not found in the vault: …*.

## Warnings

| Warning | What it means | How to fix it |
| --- | --- | --- |
| Duplicate entry omitted | An entry note is listed a second time. | Usually fine; remove the second listing if you do not want the warning. |
| Not compiled (also *section embed only*, *quoted only*) | A note in an *Expect compiled folders* folder is not in the document as a whole note. | List or embed it, or check the tags that should bring it into a list. |
| Folder not found in the vault: … | A folder in *Expect compiled folders* does not exist. | Check the spelling, and use `/` between folders. |
| Entry image is not a local image (…) | The picture property holds a list, a web address, a note or a file that is not a picture. | Write one picture link, e.g. `[[picture.png\|Credit]]`. |
| Entry keys differ only in case: … / … | The note has two properties such as `Might` and `might`. | Keep one of them; the first one is used. |
| Frontmatter is not valid YAML | The properties block cannot be read, so the note cannot be an entry. | Open the note's properties in source mode and fix the line named. |
