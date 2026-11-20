# Tips and questions

[Back to the manual](manual.md)

**I changed a picture, but the compiled document still shows the old one.**
Pictures that are already in the `assets` folder are not replaced. Delete the
`assets` folder (or the single picture) in the output folder and compile
again. The same goes for old maps: delete `assets/textmapper` to clear out
pictures of maps you have changed or removed.

**I want to make several different books from one vault.**
Make one starting note per book, and use **Compile vault from this file**
(right-click) with a different output folder for each. Giving each book its
own folder keeps their `assets` folders apart.

**Some of my lists of links were not expanded.**
A list is only expanded if *every* item is just a link to an existing note.
Check for extra words, an empty line in the middle of the list (which splits
it into two lists), a link to a website, or a misspelt note name. Misspelt
names show up in the warnings file. See
[The starting note](starting-note.md#which-lists-count-as-a-table-of-contents).

**A list of links was expanded, but I only wanted it as a list of
references.**
Write the links in a sentence instead of a list, or add one item that is not
a link.

**My Dataview tables are missing.**
Dataview queries cannot run outside Obsidian, so they are left out. To get
their results into the document, use the **Dataview Serializer** plugin,
which writes the results into the note as normal text; that text is kept.

**The headings are at the wrong levels.**
Switch **Normalise headings** on, and number your file names (`1`, `1.1`,
`1.1.1` …) to match the structure you want. See [Headings](headings.md).

**A link in the document jumps to the wrong place.**
If two notes in the document have the same title and sit side by side (for
example `1 Intro.md` and `2 Intro.md`, both titled *Intro*), links to the
second jump to the first; the warnings file says so. Give the notes different
names. The jump links are made for Obsidian; other programs that show
markdown (GitHub, Pandoc) may not find them.

**Can I use it on my phone or tablet?**
Yes. The only limit is that the document must be saved inside the vault.

**Can I compile into a folder that is synced (Dropbox, iCloud, OneDrive)?**
Yes, in the desktop app. Pick the folder with **Choose folder…**; it must
already exist. See [Output location](output-location.md).

**I want to report a bug.**
Open **Settings → Obsidian Vault Compiler** and click the bug icon (**Copy
debug info**) in the first line. Paste the text into your report on
[GitHub Issues](https://github.com/JollyOrc/ObsidianVaultCompiler/issues),
together with a few short notes that show the problem, the output you
expected and the output you got. Use invented notes, not your own private
ones.
