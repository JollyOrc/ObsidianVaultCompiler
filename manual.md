# Obsidian Vault Compiler — User Manual

This manual explains how to install the plugin, how to prepare your notes, how
to run a compilation, what every setting does, and what to do when something
does not look right. You do not need any technical knowledge to follow it.

---

## Contents

1. [What the plugin does](#1-what-the-plugin-does)
2. [What you need](#2-what-you-need)
3. [Installing the plugin](#3-installing-the-plugin)
4. [Preparing your notes: the starting note](#4-preparing-your-notes-the-starting-note)
5. [Running a compilation](#5-running-a-compilation)
6. [What you get](#6-what-you-get)
7. [How the compilation works, step by step](#7-how-the-compilation-works-step-by-step)
8. [Headings](#8-headings)
9. [Hex maps (Text Mapper)](#9-hex-maps-text-mapper)
10. [Settings reference](#10-settings-reference)
11. [Warnings and messages](#11-warnings-and-messages)
12. [Your notes are safe](#12-your-notes-are-safe)
13. [Tips and frequently asked questions](#13-tips-and-frequently-asked-questions)
14. [Entries: creatures, spells and items with data](#14-entries-creatures-spells-and-items-with-data)

---

## 1. What the plugin does

In Obsidian you usually write in many small notes that link to each other. That
is great for writing, but hard to share: you can't send someone "the vault" as
one readable document.

The **Obsidian Vault Compiler** turns a set of notes into **one single
document**, like binding loose pages into a book. You tell it where to start (a
note that works like a table of contents), and it:

- puts the content of every listed note into one file, in the order you listed
  them;
- also pulls in notes that are embedded inside those notes, however deep;
- gives every note a proper heading, so the document has chapters and sections;
- copies all pictures, PDFs and other files into one `assets` folder next to
  the document;
- turns links between notes into links that jump to the right place *inside*
  the document;
- draws hex maps from the Text Mapper plugin as pictures;
- leaves out things that only make sense inside Obsidian (note properties,
  plugin commands, Dataview queries);
- writes a list of anything it could not find, so you can fix it.

Your original notes are **never changed**. The plugin only reads them.

---

## 2. What you need

- **Obsidian** version 1.0 or newer. The plugin works on computers and on
  phones/tablets. Saving the result to a folder *outside* your vault only works
  in the desktop app.
- **Optional:** the community plugin **Text Mapper**, installed and switched
  on, if your notes contain hex maps (`text-mapper` blocks). Without it,
  everything else still works; maps are just left out.

---

## 3. Installing the plugin

1. Download these three files from the plugin's release page:
   `main.js`, `manifest.json` and `styles.css`.
2. Open your vault folder on your computer. It contains a hidden folder called
   `.obsidian`. (On a Mac, press **Cmd + Shift + .** in Finder to show hidden
   folders. On Windows, tick **View → Hidden items** in File Explorer.)
3. Inside `.obsidian`, open the `plugins` folder (create it if it isn't there)
   and create a new folder named exactly:
   `obsidian-vault-compiler`
4. Put the three downloaded files into that new folder.
5. In Obsidian, open **Settings → Community plugins**. If asked, turn off
   *Restricted mode*. Click the refresh button next to *Installed plugins*,
   then switch on **Obsidian Vault Compiler**.

The plugin is now ready. Its settings appear under **Settings → Obsidian Vault
Compiler** (at the bottom of the left-hand list).

---

## 4. Preparing your notes: the starting note

The compilation always begins with one note, the **starting note**. Think of it
as the front page and table of contents of your book.

By default the plugin looks for a note called **`index2compile.md`** at the top
level of your vault. You can use any other note instead (see
[section 5](#5-running-a-compilation) and [section 10](#10-settings-reference)).

### A simple starting note

```markdown
# My Rulebook

Welcome to the rules of our game.

- [[1 Introduction]]
- [[2 Characters]]
- [[3 Combat]]
- [[4 Glossary]]
```

The result is one document that begins with "My Rulebook" and the welcome
sentence, followed by the full content of *1 Introduction*, then *2
Characters*, and so on. The list of links itself disappears; the notes take
its place.

### Which lists count as a table of contents

A list is treated as a table of contents when **every single item in it is
nothing but a link to a note** in your vault. Both link styles work, and you can
mix them:

```markdown
- [[Introduction]]
- [[Characters|The Characters]]
- [Glossary](Rulebook/Glossary.md)
1. [[Appendix A]]
```

A list is **left exactly as you wrote it** when any item has something else in
it:

```markdown
- [[Introduction]] is where you should begin     ← extra words
- some plain text                                ← not a link
- [Our website](https://example.com)             ← a website, not a note
- [[A note that does not exist]]                 ← no such note
```

> **Tip:** If you want a list that only *points to* other notes without pulling
> them into the document, write the links in a sentence instead of a list, for
> example: "See also [[Combat]] and [[Magic]]."

### Tables of contents inside other notes

Any note that gets pulled in can have its own list of links, and that list is
expanded too. This lets you build a book in layers:

- `index2compile.md` lists the chapters;
- each chapter note lists its sections;
- each section note lists its sub-sections.

### Embeds

Obsidian's embeds work as well, anywhere in a note (not only in lists):

| You write | What appears in the document |
|---|---|
| `![[Combat]]` | the whole note *Combat* |
| `![[Combat#Rounds]]` | only the section *Rounds* of the note *Combat*: that heading and everything under it, up to the next heading of the same or higher level |
| `![[map.png]]` | the picture, copied into `assets` |
| `![Logo](logo.png "Company logo")` | the picture, copied into `assets`, with its title kept |
| `![Logo](https://example.com/logo.png)` | left exactly as written: the picture is shown from the web when the document is read, nothing is copied |
| `![[https://example.com/logo.png]]` | turned into `![](https://example.com/logo.png)`, so it shows as a picture |

The standard markdown style `![Combat](Combat.md)` works exactly the same.

In a list, an item that embeds a **note** loses its bullet, so the note does
not start on a list marker. An item that embeds a **picture or other file**
keeps it, so a list of pictures stays a list:

```markdown
- ![Front](front.png)        →   - ![Front](assets/front.png)
- ![Back](back.png)          →   - ![Back](assets/back.png)
```

### Quoting a note

Put an embed on a quote line to show a whole note as a quotation:

```markdown
As the sage said:

> ![[Sage sayings]]
```

The whole note goes into that one quote. It opens with the note's name in
bold (**Sage sayings**), and its headings stay exactly as you wrote them,
inside the quote: they are not renumbered and do not become part of the
document's structure, whatever the "Normalise headings" setting. Notes that
the quoted note embeds go into the same quote, each with its name in bold.
This works in nested quotes (`> > ![[Sage sayings]]`) and in callouts:

```markdown
> [!quote] On fog
> ![[Sage sayings#Fog]]
> — the Vale almanac
```

A section embed (`#Fog`) shows just that section, without the bold name.
Lists of links inside a quoted note stay lists; they are not expanded like a
table of contents. A note that appears only as a quote is not part of the
document, so a link to it elsewhere gives the warning *link target … not
embedded*. The embed must be the only thing on its quote line; an embed in
the middle of a sentence is not supported yet.

### Links can be written any way Obsidian understands

Short links (`[[Combat]]`), full paths (`[[Rules/Chapters/Combat]]`) and
relative paths (`[Combat](../Chapters/Combat.md)`) are all found the same way
Obsidian finds them. If two notes in different folders have the same name and
the link doesn't say which one, Obsidian decides which one is used, as when you
click the link, and the warnings file says which note was used and where the
link is.

### Numbered file names (recommended)

The plugin understands numbers at the start of a file name, such as
`1 Introduction.md`, `1.2 Characters.md` or `1.2.3 Skills.md`. These numbers
decide the heading level of the note in the document (see
[section 8](#8-headings)), and they are removed from the heading text. So
`1.2.3 Skills.md` becomes a heading called **Skills**. Numbering is optional,
but it gives you the most control over the structure.

---

## 5. Running a compilation

There are two ways to start.

### Option A: from the command palette

1. Press **Ctrl + P** (Windows/Linux) or **Cmd + P** (Mac) to open the command
   palette.
2. Type **Compile vault** and press Enter.

This uses the starting note, output folder and file name from the settings.

### Option B: from any note (right-click)

1. In the file list on the left, **right-click** the note you want to start
   from. (You can also use the **⋯** menu at the top of an open note.)
2. Choose **Compile vault from this file**.
3. A small window opens, titled *Export compiled markdown*:
   - **Output folder** — where to save the result. Leave it empty for the top
     level of your vault, type a folder name such as `Exports`, or click
     **Browse** to pick a folder.
   - **Output filename** — the name of the document, for example
     `My Rulebook.md`.
   - The line *Resolved output path* shows where the file will actually go,
     and changes as you type.
4. Click **Compile** or press **Enter** (or **Cancel** or **Escape** to stop).

> **Note:** Everything you choose here — the note you right-clicked, the
> folder (also one picked with **Browse**) and the file name — is used for
> this one compilation only. Your settings stay as they are, so **Compile
> vault** from the command palette still uses the starting note, folder and
> file name from the settings.

### While it runs

- If a file with the same name already exists in the output folder, Obsidian
  asks whether to **overwrite** it. Choose *Cancel* to stop without changing
  anything.
- A message *"Vault compilation started."* appears in the top-right corner.
- When it finishes, you see a summary such as:
  *"Compilation complete: 142 files, 37 assets, 12 deduplicated."*
  That means 142 notes were processed, 37 files were copied into `assets`, and
  12 more uses of already-copied files were found (those were not copied a
  second time).

---

## 6. What you get

After a compilation, the output folder contains:

| What | Description |
|---|---|
| **Your document** (e.g. `My Rulebook.md`) | The whole compiled text, as one markdown file. |
| **`assets` folder** | Every picture, PDF, audio, video or other file the document uses, each copied once. Maps are in `assets/textmapper`. |
| **`warnings_YYYYMMDD_HHMM.md`** | Only created if something needed your attention, e.g. `warnings_20261029_1430.md` for 29 October 2026, 14:30. See [section 11](#11-warnings-and-messages). |

**Keep the document and the `assets` folder together.** The document refers to
its pictures as `assets/…`, so if you move or send the document, move or send
the `assets` folder with it (for example, put both in one zip file).

The result is ordinary markdown, so it can be opened in Obsidian, in any
markdown editor, or converted to PDF, Word or an e-book with tools such as
Pandoc.

---

## 7. How the compilation works, step by step

You don't need to know this to use the plugin, but it helps you understand the
result.

**Code stays code.** Anything that Obsidian shows as code is copied exactly as
you wrote it, and none of the steps below touch it: a code block between
` ``` ` or `~~~` lines, code indented by four spaces (or a tab) after an
empty line, and inline code between backticks. So a note that explains
Obsidian can show `` `![[Chapter 1]]` `` or a whole table of contents as an
example without the plugin carrying it out, and a broken link inside an
example gives no warning. Code inside a quote (`> ~~~`) counts too. If a note opens a code block and never closes it,
the plugin closes it at the end of the note — otherwise everything after the
note would turn into code — and tells you in the warnings file.

**Step 1 — Read the starting note.** The plugin reads your starting note. Its
own text and headings stay as you wrote them.

**Step 2 — Remove note properties.** The properties block at the very top of
each note (the part between two `---` lines, also called "frontmatter", with
things like `tags:` or `aliases:`) is left out of the document. A `---` line
anywhere else in a note is a horizontal divider and is kept. The one
exception is an **entry** note: its properties become a data block for the
typesetter (see [section 14](#14-entries-creatures-spells-and-items-with-data)).

**Step 3 — Remove Obsidian-only blocks.** Blocks that only work inside Obsidian
are removed:

- Dataview and DataviewJS queries (`dataview`, `dataviewjs`) — they can't run
  outside Obsidian, so they are left out completely;
- Meta Bind, Leaflet, Calendarium and compressed-JSON blocks
  (`meta-bind-embed`, `leaflet`, `calendarium`, `compressed-json`).
  This holds for every way of writing the block: between ` ``` ` or `~~~`
  lines, with four or more backticks, and inside a quote. The language must
  be exactly one of these words: a block marked `dataviewish` is kept. A
  block whose closing line is missing is kept and reported, so a missing
  line never deletes the rest of your note;
- the hidden markers of the **Dataview Serializer** plugin. The lists that
  Dataview Serializer wrote into your note are **kept**, and if they are lists
  of note links, they are expanded like any other table of contents. This is a
  handy way to build a table of contents automatically.

**Step 4 — Expand tables of contents and embeds.** Every list of note links and
every embed is replaced by the content of the note (or section) it points to,
in order. Then the same happens inside *that* note, and so on, as deep as your
notes go.

- If a note is listed twice in different places, it appears twice — except an
  entry note, which appears once (see [section 14](#14-entries-creatures-spells-and-items-with-data)).
- If notes embed each other in a circle (A embeds B, B embeds A), the plugin
  stops the circle and leaves a hidden note
  `<!-- Circular dependency avoided: … -->` instead of looping forever.
- If a linked note is missing, a hidden warning is left in its place and the
  rest of the compilation carries on.

**Step 5 — Add headings.** Every pulled-in note gets a heading made from its
file name. See [section 8](#8-headings) for the details.

**Step 6 — Copy pictures and files.** Every embedded file is copied into the
`assets` folder:

- **Each file is copied only once**, even if it is used fifty times.
- File names are tidied up: lower-case, with spaces and unusual characters
  replaced by `_`. `Dragon Map.PNG` becomes `assets/dragon_map.png`.
- Two *different* files that happen to have the same name get numbered:
  `map.png`, `map_1.png`, `map_2.png`.
- Pictures stay pictures. Audio and video become players. A PDF becomes an
  **Open PDF** link, and other files become a **Download …** link.

**Step 7 — Turn links into jump links.** A link to another note becomes a link
to that note's heading *inside the document*, so readers can click to jump
there. For example, `[[1.2 Combat]]` becomes a link labelled **Combat** that
jumps to the *Combat* heading. The jump links are written the way Obsidian
writes them itself, so they work when you read the document in Obsidian.

- A link to a heading — in another note (`[[Combat#Rounds]]`) or in the same
  note (`[[#Rounds]]`, `[Rounds](#Rounds)`) — jumps to that heading in the
  document. If the heading isn't in the note, or isn't part of the document,
  the link jumps to the start of the note instead and you get a warning.
- If two headings have the same text, the link jumps to the right one by
  naming the heading above it (`#Chapter Two#Intro`), as Obsidian does. If
  nothing tells them apart — two notes with the same title side by side —
  the link goes to the first and you get a warning.
- Links to a block (`[[#^id]]`) aren't converted yet.

- If the linked note exists but is **not part of the document** (you never
  listed or embedded it), the link is replaced by a hidden warning, because it
  would lead nowhere once the document is shared.
- Links to websites and email addresses stay as they are.

**Step 8 — Draw maps.** Hex maps are turned into pictures (see
[section 9](#9-hex-maps-text-mapper)).

**Step 9 — Tidy the spacing.** The plugin cleans up blank lines so the
document looks consistent: never more than one empty line in a row, one empty
line before each heading, and no empty line between a heading and its text.
Code blocks are left exactly as written.

**Step 10 — Save.** The document, the `assets` folder and (if needed) the
warnings file are saved. Finally, the plugin checks that none of your notes
were changed during the run.

---

## 8. Headings

Every note that is pulled into the document gets **one heading made from its
file name**:

- numbers at the start are removed: `1.2.3 Skills.md` → **Skills**;
- the first letter becomes a capital: `notes.md` → **Notes**;
- everything else stays as written: `The Songbook (music spells).md` → **The
  Songbook (music spells)**.

If a note already **begins with a heading**, that first heading is replaced by
the file-name heading (so the heading always matches the file name). If it
starts with normal text, the file-name heading is put in front of it.

The **starting note does not get an extra heading**; its own headings stay
exactly as written.

How *deep* each heading goes (chapter, section, sub-section…) depends on the
setting **Normalise headings**.

### "Normalise headings" OFF (default)

Simple and predictable:

- The heading level is the **number of parts in the file-name number**:

  | File name | Heading |
  |---|---|
  | `1 Introduction.md` | `# Introduction` (level 1) |
  | `1.2 Combat.md` | `## Combat` (level 2) |
  | `1.2.3 Rounds.md` | `### Rounds` (level 3) |
  | `Notes.md` (no number) | `## Notes` (level 2) |

- The headings *inside* each note stay as the author wrote them.

This works well if your notes are already written with sensible heading levels.

### "Normalise headings" ON

The plugin fits every note neatly into the structure of the whole document, so
all headings nest correctly:

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
  another note (for example `Chapter A.md` contains only `![[Real Chapter]]`),
  the wrapper doesn't add an empty heading of its own; the embedded note
  appears directly in its place.
- **Section embeds keep their heading text.** `![[Magic#Leaf Craft]]` shows
  the heading **Leaf Craft**, moved to the right level.
- **Six levels at most.** Markdown has only six heading levels. Anything deeper
  is kept at level 6 and noted in the warnings file.
- **Wrong order is corrected.** If a level-1 note is embedded inside a level-3
  note, it is placed below its parent (at level 4) instead of jumping back up,
  and this is noted in the warnings file.

> **Which should I use?** If your notes are numbered (`1`, `1.1`, `1.1.1` …),
> turn **Normalise headings on**: you get a clean, properly nested document.
> If your notes are not numbered and you're happy with their headings, leave it
> off.

---

## 9. Hex maps (Text Mapper)

If your notes contain hex maps written for the **Text Mapper** plugin (blocks
that start with ` ```text-mapper `), the compiler turns each map into a picture
(PNG) and puts it in `assets/textmapper`.

- The **Text Mapper** plugin must be installed and switched on in the same
  vault. The compiler asks it to draw the map, so the picture looks like what
  you see in Obsidian.
- The picture has a **transparent background** and is up to 2048 pixels on its
  longest side.
- The same map used in several notes is drawn only once.
- If Text Mapper is not installed or not switched on, you see a message saying
  so, and each map is replaced by a hidden placeholder.
- If you switch off **Enable TextMapper rendering** in the settings, the maps
  are left as text blocks with a hidden warning.

Two settings change how compiled maps look (maps inside Obsidian are never
changed):

- **Map font** — the font for place names on the maps.
- **Tidy map labels** — removes the small hex numbers (like `0402`), centres
  each place name in its hex, and breaks long names onto several lines so they
  stay inside the hex. If one single word is too wide for its hex, a message
  tells you which map it is in.

### Maps in your own style: no black outlines, no white glow

Text Mapper draws a thin black outline around every hex and a white glow
behind every name. For a map drawn in your own colours (a skill tree, for
example) you can leave both out of the compiled picture. Put this line
anywhere in the map:

```
# vault-compiler: no-outlines no-glow
```

- `no-outlines` leaves out the black hex outlines. Your own colours, symbols,
  paths and names stay.
- `no-glow` leaves out the white glow behind names (also names along paths).
- You can use just one of the two words.
- The line starts with `#`, so Text Mapper treats it as a comment: the map
  inside Obsidian still shows the outlines and the glow. Only the compiled
  picture changes. The line must start at the very beginning of the line,
  with no spaces in front.
- A misspelt word (`no-outline`) is ignored, and the warnings file lists it
  with the note it is in.

**Good to know when you style a map yourself:**

- Writing your own `default attributes`, `glow` or `label` lines in the map
  has no effect: Text Mapper adds its own after yours, and its own win. That
  is why the line above exists.
- Give your own hex types names Text Mapper doesn't use already. `red`,
  `green` or `water` are taken; `skill-red` or `my-water` are safe.
- If your map defines SVG filters (for rough, hand-drawn edges), add the line
  `option global`, or the filters are not found.

### Small boxes in the hex corners, with and without a tick

A skill tree often has a small box in each hex to tick off. Add these two
lines to the map, once:

```
<g id="box"><polygon points="74,-70 64,-53 44,-53 34,-70 44,-87 64,-87" fill="white" stroke="#4f7d4a" stroke-width="3"/></g>
<g id="check"><path d="M 36,-80 L 50,-62 L 84,-106" fill="none" stroke="black" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></g>
```

Each one must stay on a single line. The first defines `box`, a small white
hex in the top-right corner; the second defines `check`, a tick over that
corner. Then add the words to the hexes:

```
# vault-compiler: no-outlines no-glow
skill-green attributes fill="none" stroke="#4f7d4a" stroke-width="6"
0101 skill-green box "Climbing"
0201 skill-green box check "Swimming"
0102 skill-green "Running"
```

- `box` gives an empty box: *Climbing*.
- `box check` gives a ticked box: *Swimming*.
- Neither gives no box: *Running*.
- Write `box` **before** `check`. Things are drawn in the order you write
  them, so `check box` puts the white box over most of the tick.
- The box covers the hex outline where they meet, like a label sticking out
  of the corner.
- Colours: `fill="white"` is the inside of the box and `stroke="#4f7d4a"` its
  border; use your page colour (for example `fill="#efe6d6"`) if white stands
  out too much. The tick's colour is its `stroke`.
- These positions are for ordinary maps. Maps with `option horizontal` have
  pointed tops, so the box would sit beside the corner, not on it.

---

## 10. Settings reference

Open **Settings → Obsidian Vault Compiler**.

| Setting | What it does | Default |
|---|---|---|
| **Starting file** | The note the compilation begins with. Write its path inside the vault, including folders and `.md`, e.g. `Books/Rulebook index.md`. | `index2compile.md` |
| **Output folder** | Where the document is saved. Empty means the top level of your vault. Type a folder in the vault such as `Exports` or `Exports/2026` (use `/` between folders), or click **Browse**. In the desktop app you may also choose a folder **outside** the vault, such as your Desktop. | empty |
| **Output filename** | The name of the compiled document, e.g. `My Rulebook.md`. Just the name, no folders. | `compiledtext.md` |
| **Resolved output path** | Not a setting — it shows where the document will actually be saved, or why the current choice won't work. It changes as you type. | — |
| **Enable TextMapper rendering** | On: hex maps become pictures. Off: maps stay as text blocks. | On |
| **Map font** | Font for text on compiled maps, e.g. `Georgia, serif`. Leave empty to use the same font Obsidian shows your notes in. | empty |
| **Tidy map labels** | On: compiled maps have no hex numbers and their names are centred and wrapped. | On |
| **Normalise headings** | On: all headings are re-levelled so they nest correctly (see [section 8](#8-headings)). Off: simple levels from file-name numbers. | Off |
| **Entry marker keys** | Property names, separated by commas. A note with one of them becomes an entry: its properties go into the document as a data block (see [section 14](#14-entries-creatures-spells-and-items-with-data)). Empty: no entries. | empty |
| **Entry exclude keys** | Properties never written into an entry's data block. | `aliases, cssclasses, publish` |
| **Entry image keys** | Entry properties that name a picture, which is copied like an embedded one. | `illustration` |
| **Expect compiled folders** | Folders, separated by commas. Every note in them (and in their subfolders) that doesn't end up in the document is listed in the warnings file. Empty: no list. | empty |

### Output folder rules

To protect your vault, some choices are refused. The compilation then does not
start, nothing is written, and a message explains why:

| What you entered | Why it's refused | What to do instead |
|---|---|---|
| A folder starting with `~` (e.g. `~/Desktop`) | `~` shortcuts aren't understood | Use **Browse**, or type the full path, e.g. `/Users/yourname/Desktop` |
| A folder containing `..` | could point anywhere | Use **Browse** |
| `Exports\Sub` (backslash, inside the vault) | vault folders use `/` | Write `Exports/Sub` |
| `.obsidian` or a folder inside it | that is Obsidian's own settings folder | Choose a normal folder |
| A folder outside the vault that doesn't exist | folders outside the vault are never created | Create the folder first, or use **Browse** |
| A folder outside the vault on a phone or tablet | only the desktop app can write outside the vault | Use a folder inside the vault |
| A file name containing `/` or `\` | the file name must be just a name | Put folders into **Output folder** |
| An empty file name | — | Type a name such as `Book.md` |
| The same path as the starting note | it would overwrite your starting note | Choose a different name or folder |

A folder **inside** the vault that doesn't exist yet is created for you.

**The output folder is never read.** Files in the output folder (and its
subfolders) are left out when the plugin looks for linked notes and pictures:
they are earlier results, not sources. So a picture copied to
`Exports/assets/` by an earlier run is never mistaken for the original, and
never makes a picture name ambiguous. This holds for the folder in the
settings and for a folder you type for one run. When the output folder is
the top level of your vault (empty), nothing is left out.

---

## 11. Warnings and messages

### The warnings file

When something needs your attention, the plugin writes a file
`warnings_YYYYMMDD_HHMM.md` next to your document. It is a table with four
columns:

| Column | Meaning |
|---|---|
| **warning** | what went wrong |
| **original link** | the link or embed as you wrote it |
| **filename** | the note where you wrote it |
| **line number** | the line in that note |

So you can open the named note, go to that line, and fix the link.

### Hidden notes in the document

At the place where something went wrong, the document contains a hidden note
like `<!-- Warning: Missing include: Combat.md -->`. These are invisible when
the document is displayed (in Obsidian's reading view, or after converting to
PDF), but you can see them in Obsidian's source mode or a text editor.

### Common warnings

| Warning | What it means | How to fix it |
|---|---|---|
| **Missing include** | A listed or embedded note doesn't exist. | Check the spelling of the link, or create the note. |
| **Missing heading anchor** | `![[Note#Heading]]` or a link to a heading names a heading that isn't in the note. | Check the heading's spelling in the note. |
| **heading … not embedded in compiled output** | A link points at a heading of a note, but only another part of that note is in the document. | Embed the whole note, or link to the part that is in it. |
| **Heading "…" occurs … times and no heading path tells them apart** | Two headings have the same text and nothing above them differs. | Rename one of the headings or notes. |
| **link target … not embedded in compiled output** | You link to a note that exists but isn't part of the document. | Add the note to a table of contents, or remove the link. |
| **Ambiguous filename** | Two notes have the same name; the plugin picked one. | Use a link with the folder path, or rename one of the notes. |
| **Missing asset** | A picture or file couldn't be found. | Check the file name in the embed. |
| **Unreadable file** | A note couldn't be read. | Check the note opens normally in Obsidian. |
| **Heading depth clamped** | A heading would be deeper than level 6, or a note was placed below its parent. | Usually fine; otherwise check the file-name numbering. |
| **Circular dependency avoided** | Notes embed each other in a circle. | Remove one of the embeds. |
| **TextMapper …** | A map couldn't be drawn. | See [section 9](#9-hex-maps-text-mapper). |
| **Code block not closed; closed at the end of the note** | A note opens a code block (` ``` `) and never closes it. | Add the closing ` ``` ` line in the note. |
| **Map directive "…" is unknown and was ignored** | A word in a `# vault-compiler:` line is misspelt. | Use `no-outlines` or `no-glow` (see [section 9](#9-hex-maps-text-mapper)). |
| **Duplicate entry omitted** | An entry note is listed a second time; the second place holds a hidden note instead. | Usually fine; remove the second listing if you don't want the warning. |
| **Not compiled** (also *section embed only*, *quoted only*) | A note in an *Expect compiled folders* folder isn't in the document as a whole note. | List or embed it, or check the tags that should bring it into a list. |
| **Folder not found in the vault: …** | A folder in *Expect compiled folders* doesn't exist (names are case-sensitive). | Check the spelling, and use `/` between folders. |
| **Entry image is not a local image (…)** | An entry's picture property holds a list, a web address, a note or a file that isn't a picture. | Write one picture link, e.g. `[[picture.png\|Credit]]`. |
| **Entry keys differ only in case: … / …** | An entry note has two properties such as `Might` and `might`. | Keep one of them; the first one is used. |
| **Frontmatter is not valid YAML** | A note's properties block can't be read, so it can't be an entry. | Open the note's properties in source mode and fix the line named. |

### Messages in the corner of the screen

| Message | Meaning |
|---|---|
| *Vault compilation started.* | The run has begun. |
| *Compilation complete: …* | Finished successfully, with a short summary. When entries were left out as repeats or expected notes were missing, it adds how many, e.g. *1 duplicate entry omitted, 2 notes not compiled: see warnings_….md.* |
| *Starting file not found.* | The starting note in the settings doesn't exist. Check the path. |
| *Compilation not started: …* | The output folder or file name was refused; the message says why (see [section 10](#output-folder-rules)). |
| *Compilation cancelled.* | You chose not to overwrite an existing document. |
| *Compilation failed: …* | Something went wrong; the message gives the reason. |
| *… the Text Mapper plugin is not installed or enabled …* | Install or switch on Text Mapper to get map pictures. |
| *… map font "…" could not be embedded …* | That font wasn't available; the next font in your list is used. |
| *… map directive "…" could not be applied …* | Text Mapper drew a map differently than expected (perhaps a new version); that map keeps its outlines or glow. |

---

## 12. Your notes are safe

The plugin is built so that compiling can never damage your vault:

- It **only reads** your notes. All changes (removing properties, adding
  headings, rewriting links) happen on a copy in memory.
- It **only writes** three things: your document, the `assets` folder next to
  it, and the warnings file. Any attempt to write anywhere else is blocked.
- It **asks before overwriting** an existing document of the same name.
- It **refuses** output locations that could cause harm, such as Obsidian's
  settings folder or the starting note itself.
- After every run it **checks that no note was changed or added**. If anything
  was, it reports *Compilation failed* so you know.

---

## 13. Tips and frequently asked questions

**I changed a picture, but the compiled document still shows the old one.**
Pictures that are already in the `assets` folder are not replaced. Delete the
`assets` folder (or the single picture) in the output folder and compile again.
The same goes for old maps: delete `assets/textmapper` to clear out pictures of
maps you've changed or removed.

**I want to make several different books from one vault.**
Make one starting note per book, and use **Compile vault from this file**
(right-click) with a different output folder for each. Giving each book its own
folder keeps their `assets` folders apart.

**Some of my lists of links were not expanded.**
A list is only expanded if *every* item is just a link to an existing note.
Check for extra words, an empty line in the middle of the list (which splits it
into two lists), a link to a website, or a misspelled note name. Misspelled
names show up in the warnings file.

**A list of links was expanded, but I only wanted it as a list of references.**
Write the links in a sentence instead of a list, or add one item that isn't a
link.

**My Dataview tables are missing.**
Dataview queries can't run outside Obsidian, so they are left out. If you want
their results in the document, use the **Dataview Serializer** plugin, which
writes the results into the note as normal text; that text is kept.

**The headings are at the wrong levels.**
Try switching **Normalise headings** on, and number your file names (`1`,
`1.1`, `1.1.1` …) to match the structure you want. See
[section 8](#8-headings).

**A link in the document jumps to the wrong place.**
If two notes in the document have the same title and sit side by side (for
example `1 Intro.md` and `2 Intro.md`, both titled *Intro*), links to the
second jump to the first; the warnings file says so. Give the notes different
names. The jump links are made for Obsidian; other programs that show markdown
(GitHub, Pandoc) may not find them.

**Can I use it on my phone or tablet?**
Yes. The only limit is that the document must be saved inside the vault.

**Can I compile into a folder that's synced (Dropbox, iCloud, OneDrive)?**
Yes, in the desktop app. Pick the folder with **Browse**. The folder must
already exist.

---

## 14. Entries: creatures, spells and items with data

Some books describe many things of one kind — creatures, spells, items — each
with numbers: a creature's strength, its attacks, its picture. You keep these
numbers as the note's **properties**, and the typesetting plugin
**Obsidian2Typst** (0.12.0 or later) prints them as a statblock. This plugin
carries the properties into the document for it.

### Turning it on

In the settings, put the property names that mark an entry into **Entry
marker keys**, e.g. `vigour, attacks, illustration, layout`. A note that has
at least one of them is an entry. With the setting empty (the default),
nothing changes: all properties are left out, as before.

### What an entry looks like in the document

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

- **Every property is kept**, `tags` included, except those in **Entry exclude
  keys** (`aliases` above). Names are written in lower case, in your order.
- **Links become plain text** (`[[Quick Step]]` → `Quick Step`): the
  statblock never has links. Bold and italic stay.
- **The picture** named in an **Entry image key** (`illustration`) is copied
  into `assets/` like an embedded picture, and its credit is kept. Write it
  as `[[picture.png|Credit]]`: Obsidian then updates the property when you
  rename or move the picture. Other forms (`![[…]]`, `![Credit](path)`, a
  plain path) work too, but Obsidian doesn't update them. A number such as
  `|300` is a size, never a credit.
- Only notes brought in **whole** (listed or embedded) get the block; a
  section embed (`![[Fen Hare#Signs]]`), a quote and the starting note
  don't.
- Turn **Normalise headings** on (or give the entry notes headings deeper
  than their chapter), so the entries sit inside their chapter's heading.

In Obsidian, the block shows as a statblock when Obsidian2Typst is installed,
and as a code block otherwise.

### Each entry once

When two lists bring in the same entry note (a creature tagged into two
groups), it appears only the first time. The second place holds a hidden
note, `<!-- repeat of "Fen Hare" omitted -->`, and the warnings file lists
*Duplicate entry omitted*. Notes that aren't entries still appear as often
as they are listed.

### Notes that never made it into the book

Put the folders that hold your entries into **Expect compiled folders**, e.g.
`Notes/Creatures`. After each compilation, every note in them that isn't
in the document as a whole note is listed in the warnings file — *Not
compiled*, or *Not compiled (section embed only)* / *(quoted only)* when it
appears only that way. The message in the corner says how many.

