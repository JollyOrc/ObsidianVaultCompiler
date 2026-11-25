# Warnings and messages

[Back to the manual](manual.md)

When something in a note cannot be compiled as written (a link without a
target, a missing picture, a map that cannot be drawn), the plugin does not
stop and does not hide it: it compiles what it can, leaves a hidden note at
that place in the document, and lists the problem with the note and line
where you wrote it.

## Contents

- [The warnings file](#the-warnings-file)
- [Hidden notes in the document](#hidden-notes-in-the-document)
- [Every warning](#every-warning)
- [Messages in the corner of the screen](#messages-in-the-corner-of-the-screen)

## The warnings file

When something needs your attention, the plugin writes a file
`warnings_YYYYMMDD_HHMM.md` next to your document, for example
`warnings_20261029_1430.md`. Without warnings, no file is written. It is a
table with four columns:

| Column | Meaning |
| --- | --- |
| **warning** | what went wrong |
| **original link** | the link or embed as you wrote it |
| **filename** | the note where you wrote it |
| **line number** | the line in that note |

Open the named note, go to that line, and fix it. Every warning names a note
and a line, and each problem is listed once, where it was written:

- a map's warnings name the line where the map starts (` ```text-mapper `);
- *Heading depth clamped* names the heading, or the line of the embed when
  the note's title or a section is what would go too deep.

## Hidden notes in the document

At the place where something went wrong, the document contains a hidden note
such as `<!-- Warning: Missing include -->`. It is invisible when the
document is displayed (Obsidian's reading view, or after converting to PDF),
but you can see it in Obsidian's source mode or in a text editor.

## Every warning

### Notes and embeds

| Warning | What it means | How to fix it |
| --- | --- | --- |
| Missing include | A listed or embedded note does not exist. | Check the spelling of the link, or create the note. |
| Unreadable file | A note could not be read. | Check that the note opens normally in Obsidian. |
| Circular dependency avoided | Notes embed each other in a circle. | Remove one of the embeds. |
| Note embedded in a sentence is not one paragraph; embedded as a block | An embed inside a sentence names a note with several paragraphs, a list, a table or code. | Put the embed on a line of its own, or shorten the note to one paragraph. See [The starting note](starting-note.md#embedding-a-note-inside-a-sentence). |
| Code block not closed; closed at the end of the note | A note opens a code block (` ``` `) and never closes it. | Add the closing ` ``` ` line in the note. |
| Ambiguous filename | Two notes have the same name; the plugin used the one Obsidian picks. | Use a link with the folder path, or rename one of the notes. |

### Links

| Warning | What it means | How to fix it |
| --- | --- | --- |
| link target … not embedded in compiled output | You link to a note that exists but is not part of the document. | Add the note to a table of contents, or remove the link. |
| Missing wiki link, Missing markdown link | A link (not an embed) names a note that does not exist. | Check the spelling, or create the note. |
| Missing heading anchor | `![[Note#Heading]]` or a link to a heading names a heading that is not in the note. | Check the heading's spelling in the note. |
| heading … not embedded in compiled output | A link points at a heading of a note, but only another part of that note is in the document. | Embed the whole note, or link to the part that is in it. |
| Heading "…" occurs … times and no heading path tells them apart | Two headings have the same text and nothing above them differs. | Rename one of the headings or notes. |
| Invalid markdown link, Invalid output link | A link would not work outside your vault (for example an `obsidian://` link or a path on your computer); *output link* is an HTML `<a href>`. | Link to a note in the document, a web page or an e-mail address. |

See [Links and assets](links-and-assets.md).

### Pictures and files

| Warning | What it means | How to fix it |
| --- | --- | --- |
| Missing asset | A picture or file could not be found. | Check the file name in the embed. |

### Headings

| Warning | What it means | How to fix it |
| --- | --- | --- |
| Heading depth clamped | A heading would be deeper than level 6, or a note was placed below its parent. | Usually fine; otherwise check the file-name numbering. See [Headings](headings.md). |

### Maps

| Warning | What it means | How to fix it |
| --- | --- | --- |
| TextMapper render failed: … | A map could not be drawn; a placeholder stands in its place. | Check the map in Obsidian. |
| TextMapper renderer not available | The Text Mapper plugin is not installed or switched on. | Install or switch it on. |
| Map directive "…" is unknown and was ignored | A word in a `# vault-compiler:` line is misspelt. | Use `no-outlines`, `no-glow` or `caption`. |
| Map caption contains "\|"; Obsidian2Typst ends the caption there | A map's caption holds a `\|`. | Use another character. |
| Map caption is given more than once; the first is used | A map has two `caption` lines. | Remove one. |

With **Enable TextMapper rendering** off, each map stays a text block followed
by the hidden note `<!-- Warning: TextMapper rendering is disabled -->`; this
is your choice, so it is not listed in the warnings file. See
[Hex maps](maps.md).

### Entries and details

| Warning | What it means | How to fix it |
| --- | --- | --- |
| Duplicate entry omitted | An entry note is listed a second time. | Usually fine. |
| Not compiled (also *section embed only*, *quoted only*) | A note in an *Expect compiled folders* folder is not in the document as a whole note. | List or embed it. |
| Folder not found in the vault: … | A folder in *Expect compiled folders* does not exist. | Check the spelling; names are case-sensitive. |
| Entry image is not a local image (…) | An entry's picture property does not name one local picture. | Write one picture link, e.g. `[[picture.png\|Credit]]`. |
| Entry keys differ only in case: … / … | An entry note has two properties such as `Might` and `might`. | Keep one of them; the first one is used. |
| Frontmatter is not valid YAML | A note's properties block cannot be read. | Fix the line named in the note's properties. |
| Detail value is not text: … | A detail property holds a list or a map. | Make it one text, or take it out of *Detail marker keys*. |
| Detail keys differ only in case: … / … | A detail note has two properties such as `Pace` and `pace`. | Keep one of them; the first one is used. |
| Entry keys and detail keys in one note: only the entry block is written | A note has both kinds of marker key. | Usually fine; the note is an entry. |
| Encounter list: no rows | An encounter callout has no creature line. | Write lines like `2 × [[Creature]]`. |
| Encounter list: … lines not read (lines …) | Lines of an encounter callout that are not creature lines. | Make them creature lines or move them out. |
| Encounter list: no note "…" | A creature link names no note. | Fix the link. |

See [Entries](entries.md), [Details](details.md) and [Encounters](encounters.md).

## Messages in the corner of the screen

| Message | Meaning |
| --- | --- |
| *✅ Compiled …: … files, … assets, … deduplicated.* | Finished; names the document and counts notes, copied files and extra uses of copied files. When entries were left out as repeats or expected notes were missing, it adds how many, e.g. *1 duplicate entry omitted, 2 notes not compiled: see warnings_….md.* |
| *Starting file not found.* | The starting note does not exist. Check the path. |
| *Compilation not started: …* | The output folder or file name was refused; the message says why. See [Output location](output-location.md#choices-that-are-refused). |
| *❌ Compilation failed: …* | Something went wrong; the message gives the reason, for example that a note was changed during the run. |
| *Debug info copied.* | **Copy debug info** in the settings worked; paste the text into your bug report. |
| *Vault Compiler: the Text Mapper plugin is not installed or enabled, so maps are left as placeholders.* | Install or switch on Text Mapper to get map pictures. |
| *Vault Compiler: map font "…" could not be embedded; maps use the next font in the list.* | That font was not available. |
| *Vault Compiler: a label in map "…" has a word too wide for its hex.* | Shorten the word, or use a narrower map font. |
| *Vault Compiler: some maps were not tidied (…) …* | Text Mapper drew a map differently than expected; that map is not tidied. |
| *Vault Compiler: map directive "…" could not be applied; the map is drawn as the plugin made it.* | Text Mapper drew a map differently than expected (perhaps a new version); that map keeps its outlines or glow. |
