# Headings

[Back to the manual](manual.md)

Every note that is pulled into the document gets **one heading made from its
file name**. How deep each heading goes depends on the setting **Normalise
headings** (settings tab, section **Headings**).

## Contents

- [The heading text](#the-heading-text)
- [Normalise headings off (default)](#normalise-headings-off-default)
- [Normalise headings on](#normalise-headings-on)
- [Which should I use?](#which-should-i-use)

## The heading text

- Numbers at the start are removed: `1.2.3 Skills.md` → **Skills**.
- The first letter becomes a capital: `notes.md` → **Notes**.
- Everything else stays as written: `The Songbook (music spells).md` →
  **The Songbook (music spells)**.

If a note already **begins with a heading**, that first heading is replaced by
the file-name heading, so the heading always matches the file name. If it
starts with normal text, the file-name heading is put in front of it.

The **starting note gets no extra heading**; its own headings stay exactly as
written. Notes shown [as a quote](starting-note.md#quoting-a-note) or
[inside a sentence](starting-note.md#embedding-a-note-inside-a-sentence) get
no heading either.

## Normalise headings off (default)

Simple and predictable:

- The heading level is the **number of parts in the file-name number**:

  | File name | Heading |
  | --- | --- |
  | `1 Introduction.md` | `# Introduction` (level 1) |
  | `1.2 Combat.md` | `## Combat` (level 2) |
  | `1.2.3 Rounds.md` | `### Rounds` (level 3) |
  | `Notes.md` (no number) | `## Notes` (level 2) |

- The headings *inside* each note stay as the author wrote them.

This works well if your notes are already written with sensible heading
levels.

## Normalise headings on

The plugin fits every note into the structure of the whole document, so all
headings nest correctly:

- **Numbered notes** go to the level their number says, wherever they are
  embedded: `1.3.2 Magic.md` is always level 3.
- **Notes without a number** go one level below the heading they are placed
  under. If you embed `Details.md` right under a `## Chapter` heading, it
  becomes `### Details`.
- **Headings inside each note move along with it**, keeping their order and
  relative levels.

Example: `1.2 Combat.md` contains

```markdown
# Fighting
## Rounds
```

With *Normalise headings* on, it becomes:

```markdown
## Combat
### Rounds
```

*Combat* comes from the file name and sits at level 2 because of `1.2`;
*Rounds* stays one level below it.

Some extra rules when the setting is on:

- **Wrapper notes are skipped.** If a note contains nothing but one embed of
  another note (for example `Chapter A.md` contains only `![[Real
  Chapter]]`), the wrapper adds no empty heading of its own; the embedded note
  appears directly in its place.
- **Section embeds keep their heading text.** `![[Magic#Leaf Craft]]` shows
  the heading **Leaf Craft**, moved to the right level.
- **Six levels at most.** Markdown has only six heading levels. Anything
  deeper is kept at level 6 and noted in the warnings file (*Heading depth
  clamped*).
- **Wrong order is corrected.** If a level-1 note is embedded inside a level-3
  note, it is placed below its parent (at level 4) instead of jumping back up,
  and this is noted in the warnings file.

## Which should I use?

If your notes are numbered (`1`, `1.1`, `1.1.1` …), turn **Normalise
headings** on: you get a clean, properly nested document. If your notes are
not numbered and you are happy with their headings, leave it off.
[Entries](entries.md) need it on (or entry notes with headings deeper than
their chapter), so that each entry sits inside its chapter.
