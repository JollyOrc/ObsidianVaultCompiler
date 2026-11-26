# Output location

[Back to the manual](manual.md)

The document is saved as **Output filename** in **Output folder**, and its
`assets` folder is created next to it. Both are set in the compile window or
in the settings tab (section **Compile**); the **Resolved output path** row
and the grey line of the compile window show where the document will go, or
why the choice cannot be used.

## Contents

- [The output folder](#the-output-folder)
- [The file name](#the-file-name)
- [Choices that are refused](#choices-that-are-refused)
- [The output folder is never read](#the-output-folder-is-never-read)
- [A compile target in the starting note](#a-compile-target-in-the-starting-note)

## The output folder

- **Empty** (the default): the top level of the vault.
- **A folder in the vault**, such as `Exports` or `Exports/2026` (use `/`
  between folders). A folder that does not exist yet is created.
- **A folder outside the vault**, such as your Desktop or a synced Dropbox,
  iCloud or OneDrive folder: desktop app only. Pick it with **Choose
  folder…**, or type its full path. Folders outside the vault are never
  created, so it must exist already.

Give each book its own folder, so their `assets` folders stay apart.

## The file name

Just the name, without folders, for example `My Rulebook.md`. The default is
`compiledtext.md`. An existing document of that name and its `assets` folder
are replaced; the compile window says so beforehand.

## Choices that are refused

To protect your vault, some choices are refused. The compile window shows the
reason in red and greys out **Compile**; the command **Compile vault** shows
*Compilation not started: …* with the reason. Nothing is written.

| What you entered | Why it is refused | What to do instead |
| --- | --- | --- |
| A folder starting with `~` (e.g. `~/Desktop`) | `~` shortcuts are not understood | Use **Choose folder…**, or type the full path, e.g. `/Users/yourname/Desktop` |
| A folder containing `..` | it could point anywhere | Use **Choose folder…** |
| `Exports\Sub` (backslash, inside the vault) | vault folders use `/` | Write `Exports/Sub` |
| `.obsidian` or a folder inside it | that is Obsidian's own settings folder | Choose a normal folder |
| A folder outside the vault that does not exist | folders outside the vault are never created | Create the folder first, or use **Choose folder…** |
| A folder outside the vault on a phone or tablet | only the desktop app can write outside the vault | Use a folder inside the vault |
| A file name containing `/` or `\` | the file name must be just a name | Put folders into **Output folder** |
| An empty file name | — | Type a name such as `Book.md` |
| The same path as the starting note | it would overwrite your starting note | Choose a different name or folder |

## The output folder is never read

Files in the output folder (and its subfolders) are left out when the plugin
looks for linked notes and pictures: they are earlier results, not sources.
So a picture copied to `Exports/assets/` by an earlier run is never mistaken
for the original, and never makes a picture name ambiguous. This holds for
the folder in the settings and for a folder you type for one run. When the
output folder is the top level of the vault (empty), nothing is left out.

## A compile target in the starting note

A starting note can say where its own compile goes, in two properties:

```yaml
---
compile-folder: Sheets
compile-file: keep-sheets.md
---
```

When you compile from that note (from the file menu, the compile dialog or
**Compile vault**), the output goes there, and your settings' output folder
and file name stay as they are, so a rulebook and an adventure's sheets can
each keep their own target. A property you leave out falls back to the
setting. The same rules as above apply; a refusal names the property, for
example `Property compile-folder: Output folder "../out" must not contain "..".`
The compile dialog shows the note's values and says `Output from the note's
properties`; a change there applies to that compile only.

Set or clear the two properties with **Compile target…** in the file menu of
a note: a small dialog with the folder (and **Choose folder…**) and the file
name; **Save** checks them first, an empty field removes its property,
**Clear** removes both. Only these two properties are written; the note's
other properties and text stay as they are. This is the one change the plugin
makes to a note of yours, and only when you ask for it; a compile still only
reads your vault.

If the starting note has the property `typst-preset`, the compiled file starts
with that one property, so Obsidian2Typst (0.19.0 or newer) exports it with
that preset.

