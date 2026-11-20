# How a compilation works

[Back to the manual](manual.md)

You do not need to know this to use the plugin, but it helps you understand
the result. The same notes and the same settings always give the same
document.

## Contents

- [Code stays code](#code-stays-code)
- [Step 1: read the starting note](#step-1-read-the-starting-note)
- [Step 2: remove note properties](#step-2-remove-note-properties)
- [Step 3: remove Obsidian-only blocks](#step-3-remove-obsidian-only-blocks)
- [Step 4: expand tables of contents and embeds](#step-4-expand-tables-of-contents-and-embeds)
- [Step 5: add headings](#step-5-add-headings)
- [Step 6: copy pictures and files](#step-6-copy-pictures-and-files)
- [Step 7: turn links into jump links](#step-7-turn-links-into-jump-links)
- [Step 8: draw maps](#step-8-draw-maps)
- [Step 9: tidy the spacing](#step-9-tidy-the-spacing)
- [Step 10: save](#step-10-save)

## Code stays code

Anything that Obsidian shows as code is copied exactly as you wrote it, and
none of the steps below touch it:

- a code block between ` ``` ` or `~~~` lines;
- code indented by four spaces (or a tab) after an empty line;
- inline code between backticks;
- code inside a quote (`> ~~~`).

So a note that explains Obsidian can show `` `![[Chapter 1]]` `` or a whole
table of contents as an example without the plugin carrying it out, and a
broken link inside an example gives no warning.

If a note opens a code block and never closes it, the plugin closes it at the
end of the note (otherwise everything after the note would turn into code)
and says so in the warnings file.

## Step 1: read the starting note

The plugin reads your starting note. Its own text and headings stay as you
wrote them.

## Step 2: remove note properties

The properties block at the very top of each note (between two `---` lines,
also called frontmatter, with things like `tags:` or `aliases:`) is left out.
A `---` line anywhere else in a note is a horizontal divider and is kept.

The exceptions are **entry** and **detail** notes: an entry's properties
become an `o2t-entry` block (see [Entries](entries.md)), and a detail note
keeps the few properties you name as an `o2t-details` block (see
[Details](details.md)).

## Step 3: remove Obsidian-only blocks

Blocks that only work inside Obsidian are removed:

- Dataview and DataviewJS queries (`dataview`, `dataviewjs`): they cannot run
  outside Obsidian;
- Meta Bind, Leaflet, Calendarium and compressed-JSON blocks
  (`meta-bind-embed`, `leaflet`, `calendarium`, `compressed-json`);
- the hidden markers of the **Dataview Serializer** plugin. The lists it wrote
  into your note are **kept**, and lists of note links are expanded like any
  other table of contents.

This holds for every way of writing the block: between ` ``` ` or `~~~`
lines, with four or more backticks, and inside a quote. The language must be
exactly one of these words: a block marked `dataviewish` is kept. A block
whose closing line is missing is kept and reported, so a missing line never
deletes the rest of your note.

## Step 4: expand tables of contents and embeds

Every list of note links and every embed is replaced by the content of the
note (or section) it names, in order. Then the same happens inside *that*
note, and so on, as deep as your notes go.

- A note listed twice in different places appears twice, except an
  [entry](entries.md#each-entry-once), which appears once.
- If notes embed each other in a circle (A embeds B, B embeds A), the plugin
  stops the circle and leaves a hidden note
  `<!-- Circular dependency avoided: … -->` instead of looping forever.
- If a linked note is missing, a hidden warning is left in its place and the
  rest of the compilation carries on.

What counts as a table of contents and how each kind of embed is expanded is
in [The starting note](starting-note.md).

## Step 5: add headings

Every pulled-in note gets a heading made from its file name. See
[Headings](headings.md).

## Step 6: copy pictures and files

Every embedded file is copied into the `assets` folder, each file once, with
a tidy name. See [Links and assets](links-and-assets.md#pictures-and-files).

## Step 7: turn links into jump links

A link to another note becomes a link to that note's heading *inside the
document*. Links to websites and e-mail addresses stay as they are. See
[Links and assets](links-and-assets.md#links-between-notes).

## Step 8: draw maps

Hex maps are turned into pictures. See [Hex maps](maps.md).

## Step 9: tidy the spacing

The plugin cleans up blank lines so the document looks consistent: never more
than one empty line in a row, one empty line before each heading, and no
empty line between a heading and its text. Code blocks are left exactly as
written.

## Step 10: save

The document, the `assets` folder and, if needed, the warnings file are
saved. Finally the plugin checks that none of your notes was changed or added
during the run; if one was, it reports *Compilation failed*.
