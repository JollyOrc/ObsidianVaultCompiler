# Links and assets

[Back to the manual](manual.md)

The compiled document must still work after you move it or send it to
someone. So every picture and file it uses is copied next to it, and every
link points either into the document, to the `assets` folder, or to the web.

## Contents

- [Pictures and files](#pictures-and-files)
- [Pictures from the web](#pictures-from-the-web)
- [Links between notes](#links-between-notes)
- [Links to headings](#links-to-headings)
- [Links that would lead nowhere](#links-that-would-lead-nowhere)

## Pictures and files

Every embedded file is copied into the `assets` folder next to the document:

- **Each file is copied only once**, even if it is used fifty times. The
  notice at the end counts the extra uses as *deduplicated*.
- File names are tidied: lower case, with spaces and unusual characters
  replaced by `_`. `Dragon Map.PNG` becomes `assets/dragon_map.png`.
- Two *different* files with the same name are numbered: `map.png`,
  `map_1.png`, `map_2.png`.
- Pictures stay pictures. Audio and video become players. A PDF becomes an
  **Open PDF** link, and other files become a **Download …** link.
- A picture's title (`![Logo](logo.png "Company logo")`) is kept.
- Pictures named in an entry's properties are copied the same way; see
  [Entries](entries.md#the-picture).

Pictures that are already in `assets` are not replaced. If you change a
picture, delete it (or the whole `assets` folder) in the output folder and
compile again.

## Pictures from the web

- `![Logo](https://example.com/logo.png)` is left as written: the picture is
  shown from the web when the document is read, and nothing is copied.
- `![[https://example.com/logo.png]]` is turned into
  `![](https://example.com/logo.png)`, so it shows as a picture.

## Links between notes

A link to another note becomes a link to that note's heading *inside the
document*, so readers can click to jump there. For example, `[[1.2 Combat]]`
becomes a link labelled **Combat** that jumps to the *Combat* heading. The
jump links are written the way Obsidian writes them itself, so they work when
you read the document in Obsidian; other programs that show markdown (GitHub,
Pandoc) may not find all of them.

Links to websites and e-mail addresses stay as they are.

## Links to headings

- A link to a heading, in another note (`[[Combat#Rounds]]`) or in the same
  note (`[[#Rounds]]`, `[Rounds](#Rounds)`), jumps to that heading in the
  document.
- If the heading is not in the note, or is not part of the document, the link
  jumps to the start of the note instead, with a warning.
- If two headings have the same text, the link names the heading above it
  (`#Chapter Two#Intro`), as Obsidian does. If nothing tells them apart (two
  notes with the same title side by side), the link goes to the first, with a
  warning.
- Links to a block (`[[#^id]]`) are not converted yet.

## Links that would lead nowhere

A link that would not work once the document is shared is replaced by a
hidden note and listed in the warnings file:

| The link points to | In the document |
| --- | --- |
| a note that exists but is **not part of the document** (never listed or embedded, or only quoted or put into a sentence) | `<!-- Warning: link target '…' not embedded in compiled output -->` |
| a note that does not exist | `<!-- Warning: Missing wiki link -->` or `<!-- Warning: Missing markdown link -->` |
| anything else that is not a heading in the document, an asset, a web page or an e-mail address (for example an `obsidian://` link or a path on your computer) | `<!-- Warning: Invalid markdown link -->`, or `Invalid output link` for an HTML `<a href>` |

See [Warnings and messages](warnings.md).
