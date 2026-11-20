# Obsidian Vault Compiler manual

Obsidian Vault Compiler turns a set of linked notes into **one markdown
document** with an `assets` folder beside it, without leaving Obsidian. You
start from a note whose list of links works as a table of contents; the plugin
puts every listed note into the document in that order, gives each one a
heading, copies the pictures and files once, turns links between notes into
jump links inside the document, and draws hex maps of the Text Mapper plugin
as pictures. Your notes are only read, never changed.

This manual describes version 0.25.0.

## Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Ways to run the plugin](#ways-to-run-the-plugin)
- [What a compilation produces](#what-a-compilation-produces)
- [The starting note in short](#the-starting-note-in-short)
- [The settings tab](#the-settings-tab)
- [What the compiler does](#what-the-compiler-does)
- [Guides for advanced topics](#guides-for-advanced-topics)

## Installation

The plugin needs Obsidian 1.6.6 or later. It runs in the desktop app and on
phones and tablets; only the desktop app can save the document to a folder
outside the vault. For hex maps, the community plugin **Text Mapper** must be
installed and switched on in the same vault; without it, everything else
still works and maps are left out.

1.  Download `main.js`, `manifest.json` and `styles.css` from the
    [releases page](https://github.com/JollyOrc/ObsidianVaultCompiler/releases).
2.  Create the folder `<your vault>/.obsidian/plugins/obsidian-vault-compiler/`
    and copy the three files into it. (`.obsidian` is hidden: on a Mac, press
    **Cmd + Shift + .** in Finder; on Windows, tick **View → Hidden items** in
    File Explorer.)
3.  In Obsidian, open **Settings → Community plugins**, turn off *Restricted
    mode* if asked, reload the list and switch **Obsidian Vault Compiler** on.

## Quick start

1.  Create a note `index2compile.md` at the top level of your vault with a
    list of links to the notes you want in the document:

    ```markdown
    # My Rulebook

    Welcome to the rules of our game.

    - [[1 Introduction]]
    - [[2 Characters]]
    - [[3 Combat]]
    ```

2.  Click the **Compile vault…** icon in the left ribbon, or run **Compile
    vault…** from the command palette.
3.  In the compile window, check the output folder and file name, then click
    **Compile** (or press **Enter**).
4.  The document and its `assets` folder are written; a notice names the
    document and counts the notes and files.

The list of links disappears from the document; the notes take its place. See
[The starting note](starting-note.md) for which lists count and how embeds
work.

## Ways to run the plugin

### Commands

Open the command palette (`Ctrl/Cmd + P`) and type `Compile vault`.

| Command | What it does |
| --- | --- |
| Compile vault… | Opens the compile window with the values from the settings. |
| Compile vault | Compiles at once with the starting file, output folder and file name from the settings; no window, no question. |

### The ribbon

The **Compile vault…** icon in the left ribbon opens the compile window, as
the command does.

### The note menu

Right-click a markdown note in the file explorer (or use the **⋯** menu of an
open note) and choose **Compile vault from this file**. The compile window
opens with that note as the starting file. The note is used for this run
only; the starting file in the settings stays as it is.

### The compile window

The window **Compile vault** shows:

- **Starting file**: the note the compilation begins with.
- **Output folder**: where the document is saved. Empty means the top level
  of the vault; type a folder such as `Exports`, or click **Choose folder…**.
- **Output filename**: the name of the document, for example
  `My Rulebook.md`, with the **Compile** button at the end of its row.
- A grey line that says what will happen and follows your typing:
  *Exports/My Rulebook.md will be written.*, or, when the document is already
  there, *Exports/My Rulebook.md exists (from 2026-11-17 14:02) and will be
  replaced.*
- When the folder or file name cannot be used, a red line says why instead and
  **Compile** is greyed out. See [Output location](output-location.md).
- **More options**: the gear opens the plugin's settings.

**Compile** or **Enter** starts the run. **Escape**, the **×** or a click
outside closes the window without compiling and without saving anything.
When you click **Compile**, the folder and file name are saved to the
settings, and so is the starting file unless the window came from the note
menu. Picking a folder with **Choose folder…** alone saves nothing.

### While it runs

An existing document with the same name is replaced without a question,
together with its `assets` folder: they are the plugin's own output, and the
compile window tells you beforehand. When the run ends, a notice such as

*✅ Compiled Exports/My Rulebook.md: 142 files, 37 assets, 12 deduplicated.*

says that 142 notes were processed, 37 files were copied into `assets`, and
12 more uses of files already copied were found (they were not copied
again). Other notices are listed in [Warnings and messages](warnings.md#messages-in-the-corner-of-the-screen).

## What a compilation produces

In the output folder:

| File | Content |
| --- | --- |
| `My Rulebook.md` (your file name) | The whole compiled text, as one markdown file. |
| `assets/…` | Every picture, PDF, audio, video or other file the document uses, each copied once. Maps are in `assets/textmapper/`. |
| `warnings_YYYYMMDD_HHMM.md` | Only when something needs your attention, for example `warnings_20261029_1430.md` for 29 October 2026, 14:30. See [Warnings and messages](warnings.md). |

**Keep the document and the `assets` folder together.** The document refers
to its pictures as `assets/…`; when you move or send it, move or send the
folder with it (for example both in one zip file).

The result is ordinary markdown: it opens in Obsidian or any markdown editor,
and tools such as Pandoc or the plugin Obsidian2Typst can turn it into PDF,
Word or an e-book. The jump links are written the way Obsidian writes them;
other programs (GitHub, Pandoc) may not find all of them.

### Your notes are safe

- The plugin **only reads** your notes. Every change (leaving out properties,
  adding headings, rewriting links) happens on a copy in memory.
- It **only writes** the document, the `assets` folder next to it and the
  warnings file; any other write is blocked.
- It **replaces only its own output**: the document of the name you chose and
  its `assets` folder.
- It **refuses** output locations that could do harm, such as Obsidian's
  settings folder or the starting note itself. See
  [Output location](output-location.md).
- After every run it **checks that no note was changed or added**. If one
  was, the run reports *Compilation failed*.

## The starting note in short

The compilation begins with one note, by default `index2compile.md` at the
top level of the vault.

- A list in which **every item is only a link to a note** is a table of
  contents: the notes replace the list, in order. A list with any other item
  stays as written.
- Every note pulled in may have its own such list, so a book can be built in
  layers (chapters, sections, sub-sections).
- Embeds (`![[Note]]`, `![[Note#Section]]`, `![[picture.png]]`) work anywhere
  in a note. An embed on a quote line shows the note as a quotation; an embed
  inside a sentence puts a one-paragraph note's words into that sentence.
- Numbers at the start of a file name (`1.2.3 Skills.md`) set the heading
  level of the note and are left out of its heading.

The details are in [The starting note](starting-note.md).

## The settings tab

Open **Settings → Obsidian Vault Compiler**, or click the gear of **More
options** in the compile window.

The first line shows the installed version, for example `Vault Compiler
0.25.0`, with a bug icon at its right: **Copy debug info**. It copies the
plugin's and Obsidian's versions, your enabled plugins and the plugin's
settings as plain text for a bug report; nothing is sent anywhere.

Below are four sections: **Compile**, **Maps**, **Headings** and **Entry
data**. Click a section's heading to open or close it; Compile is open when
you first open the tab, and a section stays open or closed until you close
Obsidian. Each section ends with **Reset this section to defaults**, which
asks first (**Reset** or **Cancel**) and then puts only that section's
settings back.

A text field is saved when you press **Enter** or leave the field (Tab, or a
click elsewhere), not while you type; what you typed just before closing the
settings is saved too. Switches are saved at once.

### Compile

| Row | Default | Meaning | Guide |
| --- | --- | --- | --- |
| Starting file | `index2compile.md` | The note the compilation begins with: its path in the vault, with folders and `.md`, e.g. `Books/Rulebook index.md`. | [The starting note](starting-note.md) |
| Output folder | empty (vault root) | A folder in the vault such as `Exports/2026` (use `/` between folders), or with **Choose folder…**. In the desktop app also a folder outside the vault. | [Output location](output-location.md) |
| Output filename | `compiledtext.md` | The name of the document, without folders. | [Output location](output-location.md) |
| Resolved output path | — | Not a setting: where the document will be saved, or why the choice cannot be used. It follows your typing. | [Output location](output-location.md) |

### Maps

One feature row, **Enable TextMapper rendering**, with a switch and a gear.
The gear opens the window **Settings of the maps**.

| Row | Default | Meaning | Guide |
| --- | --- | --- | --- |
| Enable TextMapper rendering | on | On: hex maps become pictures. Off: maps stay as text blocks. | [Hex maps](maps.md) |
| Map font (gear) | empty | Font for text on compiled maps, e.g. `Georgia, serif`. Empty: the font Obsidian shows your notes in. | [Hex maps](maps.md#map-font-and-tidy-labels) |
| Tidy map labels (gear) | on | No hex numbers; names centred in their hex and wrapped. | [Hex maps](maps.md#map-font-and-tidy-labels) |

### Headings

| Row | Default | Meaning | Guide |
| --- | --- | --- | --- |
| Normalise headings | off | On: every heading is re-levelled so the document nests correctly. Off: levels from file-name numbers, headings inside notes as written. | [Headings](headings.md) |

### Entry data

All five rows are lists of names separated by commas.

| Row | Default | Meaning | Guide |
| --- | --- | --- | --- |
| Entry marker keys | empty (off) | A note with one of these properties becomes an entry: its properties go into the document as an `o2t-entry` block. | [Entries](entries.md) |
| Entry exclude keys | `aliases, cssclasses, publish` | Properties never written into an entry block. | [Entries](entries.md) |
| Entry image keys | `illustration` | Entry properties that name a picture to copy. | [Entries](entries.md#the-picture) |
| Expect compiled folders | empty (off) | Every note in these folders (and their subfolders) that is not in the document is listed in the warnings file. | [Entries](entries.md#notes-that-never-made-it-into-the-book) |
| Detail marker keys | empty (off) | A note with one of these properties gets an `o2t-details` block with only these properties, in this order. | [Details](details.md) |

## What the compiler does

In short, for every run:

1.  Code blocks and inline code are copied exactly as written; nothing below
    touches them.
2.  Note properties (frontmatter) are left out, except the data of entry and
    detail notes.
3.  Blocks that only work inside Obsidian (Dataview, Meta Bind, Leaflet,
    Calendarium, compressed JSON) and Dataview Serializer markers are removed.
4.  Tables of contents and embeds are replaced by the notes they name, as
    deep as the notes go; circles are stopped.
5.  Every pulled-in note gets a heading made from its file name.
6.  Pictures and files are copied into `assets`, each once.
7.  Links between notes become jump links inside the document.
8.  Hex maps become pictures.
9.  Blank lines are tidied, and everything is saved.

The details are in [How a compilation works](compilation.md).

## Guides for advanced topics

| Guide | Topics |
| --- | --- |
| [The starting note](starting-note.md) | Which lists are tables of contents, nested tables of contents, embeds, quoting a note, a note inside a sentence, how links are found, numbered file names. |
| [How a compilation works](compilation.md) | The steps of a run: code, properties, Obsidian-only blocks, expansion, circles, spacing. |
| [Links and assets](links-and-assets.md) | How pictures and files are copied and named, web pictures, jump links to notes and headings, links that lead nowhere. |
| [Headings](headings.md) | Headings from file names, Normalise headings off and on, wrapper notes, the six-level limit. |
| [Hex maps](maps.md) | Text Mapper maps as pictures, map font, tidy labels, map directives (no outlines, no glow, caption), boxes and ticks. |
| [Output location](output-location.md) | The output folder and file name, which choices are refused, folders outside the vault, the output folder is never read. |
| [Entries](entries.md) | Creatures, spells and items with data: `o2t-entry` blocks, pictures, each entry once, notes that were never compiled. |
| [Details](details.md) | A few facts under a heading: `o2t-details` blocks. |
| [Warnings and messages](warnings.md) | The warnings file, hidden notes in the document, a list of every warning and every notice. |
| [Tips and questions](tips.md) | Old pictures, several books from one vault, lists that were not expanded, Dataview, headings, phones and synced folders. |
