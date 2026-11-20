# The starting note: tables of contents and embeds

[Back to the manual](manual.md)

The compilation always begins with one note, the **starting note**. Think of
it as the front page and table of contents of your book. By default it is
`index2compile.md` at the top level of the vault; set another one under
**Starting file** in the settings or the compile window, or right-click a note
and choose **Compile vault from this file**.

The starting note's own text and headings stay as you wrote them; it gets no
extra heading.

## Contents

- [A simple starting note](#a-simple-starting-note)
- [Which lists count as a table of contents](#which-lists-count-as-a-table-of-contents)
- [Tables of contents inside other notes](#tables-of-contents-inside-other-notes)
- [Embeds](#embeds)
- [Quoting a note](#quoting-a-note)
- [Embedding a note inside a sentence](#embedding-a-note-inside-a-sentence)
- [How links are found](#how-links-are-found)
- [Numbered file names](#numbered-file-names)

## A simple starting note

```markdown
# My Rulebook

Welcome to the rules of our game.

- [[1 Introduction]]
- [[2 Characters]]
- [[3 Combat]]
- [[4 Glossary]]
```

The document begins with "My Rulebook" and the welcome sentence, followed by
the full content of *1 Introduction*, then *2 Characters*, and so on. The list
of links disappears; the notes take its place.

## Which lists count as a table of contents

A bullet or numbered list is a table of contents when **every item in it is
nothing but a link to a note** in your vault. Both link styles work, and you
can mix them:

```markdown
- [[Introduction]]
- [[Characters|The Characters]]
- [Glossary](Rulebook/Glossary.md)
1. [[Appendix A]]
```

A list is **left exactly as you wrote it** when any item has something else
in it:

```markdown
- [[Introduction]] is where you should begin     ← extra words
- some plain text                                ← not a link
- [Our website](https://example.com)             ← a website, not a note
- [[A note that does not exist]]                 ← no such note
```

An empty line in the middle of a list splits it into two lists, each judged
on its own.

> **Tip:** To only *point to* other notes without pulling them in, write the
> links in a sentence instead of a list: "See also [[Combat]] and [[Magic]]."

Lists that the **Dataview Serializer** plugin wrote into a note are kept, and
when they are lists of note links they are expanded like any other table of
contents. This is a handy way to build a table of contents automatically, for
example from tags.

## Tables of contents inside other notes

Any note that is pulled in can have its own list of links, and that list is
expanded too. This lets you build a book in layers:

- `index2compile.md` lists the chapters;
- each chapter note lists its sections;
- each section note lists its sub-sections.

If a note is listed twice in different places, it appears twice (except an
[entry](entries.md#each-entry-once), which appears once). If notes embed each
other in a circle, the circle is stopped; see
[How a compilation works](compilation.md#step-4-expand-tables-of-contents-and-embeds).

## Embeds

Obsidian's embeds work anywhere in a note, not only in lists:

| You write | What appears in the document |
| --- | --- |
| `![[Combat]]` | the whole note *Combat* |
| `![[Combat#Rounds]]` | only the section *Rounds* of *Combat*: that heading and everything under it, up to the next heading of the same or a higher level |
| `![[map.png]]` | the picture, copied into `assets` |
| `![Logo](logo.png "Company logo")` | the picture, copied into `assets`, with its title kept |
| `![Logo](https://example.com/logo.png)` | left as written: the picture is shown from the web, nothing is copied |
| `![[https://example.com/logo.png]]` | turned into `![](https://example.com/logo.png)`, so it shows as a picture |

The markdown style `![Combat](Combat.md)` works exactly like `![[Combat]]`.

In a list, an item that embeds a **note** loses its bullet, so the note does
not start on a list marker. An item that embeds a **picture or other file**
keeps it, so a list of pictures stays a list:

```markdown
- ![Front](front.png)        →   - ![Front](assets/front.png)
- ![Back](back.png)          →   - ![Back](assets/back.png)
```

How pictures and files are copied is described in
[Links and assets](links-and-assets.md).

## Quoting a note

Put an embed on a quote line to show a whole note as a quotation:

```markdown
As the sage said:

> ![[Sage sayings]]
```

- The whole note goes into that one quote. It opens with the note's name in
  bold (**Sage sayings**).
- Its headings stay exactly as you wrote them, inside the quote: they are not
  renumbered and do not become part of the document's structure, whatever the
  **Normalise headings** setting.
- Notes that the quoted note embeds go into the same quote, each with its name
  in bold.
- It works in nested quotes (`> > ![[Sage sayings]]`) and in callouts:

  ```markdown
  > [!quote] On fog
  > ![[Sage sayings#Fog]]
  > — the Vale almanac
  ```

- A section embed (`#Fog`) shows just that section, without the bold name.
- Lists of links inside a quoted note stay lists; they are not expanded.
- A note that appears only as a quote is not part of the document, so a link
  to it elsewhere gives the warning *link target … not embedded*.
- The embed must be the only thing on its quote line; for an embed inside a
  sentence, see the next section.

## Embedding a note inside a sentence

An embed with other text on the same line puts the note's words into that
sentence, without its heading and without line breaks:

```markdown
He said ![[Sage]] and left.      →   He said Wise words. and left.
```

(`Sage.md` holds `Wise words.`)

- It works in quotes, list items and headings, with `![[Sage#Section]]` for
  one section, and with **Normalise headings** on or off.
- The note's text is kept exactly, full stop included; its headings are left
  out, and the lines of one paragraph are joined by a space. Links and
  pictures in it work as anywhere else.
- A note put into a sentence is not a part of the document of its own: a link
  to it elsewhere gives *link target … not embedded*, unless the note is also
  embedded on a line of its own.

This works only for a note that is **one paragraph** once its headings are
left out. A note with several paragraphs, a list, a table, a code block or a
quote is embedded as a block (its heading lands in the middle of your line),
and the warnings file says *Note embedded in a sentence is not one
paragraph*. Put such an embed on a line of its own.

## How links are found

Short links (`[[Combat]]`), full paths (`[[Rules/Chapters/Combat]]`) and
relative paths (`[Combat](../Chapters/Combat.md)`) are found the way Obsidian
finds them. If two notes in different folders have the same name and the
link does not say which one, Obsidian decides, as when you click the link,
and the warnings file names the note used and where the link is.

Notes and pictures inside the output folder are never used as sources; see
[Output location](output-location.md#the-output-folder-is-never-read).

## Numbered file names

The plugin understands numbers at the start of a file name, such as
`1 Introduction.md`, `1.2 Characters.md` or `1.2.3 Skills.md`. These numbers
decide the heading level of the note in the document, and they are removed
from the heading text: `1.2.3 Skills.md` becomes a heading called **Skills**.
Numbering is optional, but it gives you the most control over the structure.
See [Headings](headings.md).
