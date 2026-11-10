# Vault Compiler — User Stories and Specifications

## Context

The compiler is delivered as an **Obsidian community plugin** that runs against the
vault currently open in Obsidian.

Its input is a starting markdown file. By default this is
`index2compile.md` at the vault root, whose contents form a Table of Contents
(ToC). The compiler produces one portable compiled markdown document plus an
`assets/` directory containing all referenced non-markdown files exactly once.

The plugin operates read-only with respect to the source vault: it reads vault
files and writes only the configured compiled master file and its `assets/`
folder, inside the vault or in an absolute folder outside it
(US-0.3, US-8.1).

## Resolved decisions

- The active Obsidian vault is implicit; no separate vault path is configured.
- Link resolution prefers Obsidian's metadata and file index before using plugin
  fallback search.
- The `assets/` directory is created next to the compiled output file.
- A bare "magic" filename is assumed to be unique across the vault; if it is
  not, the lexicographically smallest matching path is used and a warning is
  logged.
- TextMapper render failures replace the original code block with a placeholder
  line plus a warning comment.
- TextMapper maps are drawn by the Text Mapper community plugin (id
  `text-mapper`) installed and enabled in the same vault; without it, maps
  become placeholders (US-4.2, decided 2026-10-27).
- TextMapper rendering is a core feature, but it can be disabled in plugin
  settings; when disabled or unavailable, original TextMapper blocks are
  preserved with a warning comment.
- Overwriting an existing configured output file or assets requires explicit
  user confirmation.
- Only Obsidian plugin control code fences (`meta-bind-embed`, `leaflet`,
  `calendarium`, `compressed-json`, and similar) are removed.
- Any bullet or numbered list whose items are markdown links is treated as a
  Table of Contents to expand.
- Original vault files are never modified by the compilation process.
- A heading-anchored embed (`![[File#Heading]]`) embeds only the named section
  and everything beneath it until the next heading of equal or higher level; it
  does not embed the whole file.
- **Both embed syntaxes are treated identically throughout the compiler.** Every
  embedding behaviour — recursive inclusion, heading-anchored section extraction,
  auto-heading injection, circular-dependency detection, and missing-reference
  warnings — applies equally to `![[file.md]]` (wiki syntax) and
  `![alt](file.md)` (standard markdown syntax). No behaviour may be implemented
  for one syntax without being implemented for the other.

## Story ID changes

On 2026-10-27 the heading stories moved from Epic 7 (plugin delivery) to
Epic 6 (output quality), because `US-7.1` was used twice and the preamble and
pass-through stories existed only in the ticket backlog. Release notes up to
v0.10.0 use the old IDs.

| Old ID | New ID | Story |
|---|---|---|
| US-7.1 (second use) | US-6.3 | Heading normalisation |
| US-7.2 (backlog only) | US-6.4 | Preamble heading injection |
| US-7.3 (backlog only) | US-6.5 | Pass-through embed |

US-7.1 (plugin delivery), US-7.2 (context-menu compilation) and US-7.3 (export
path prompt) keep their IDs.

## Epic 0 — Vault context and link resolution

### US-0.1 Use the current Obsidian vault
**As an** Obsidian user  
**I want** the compiler to operate on the vault that is currently open  
**So that** no separate vault path needs to be configured.

**Acceptance criteria**
- The plugin operates exclusively on the active Obsidian vault.
- All file searches stay within the active vault boundaries.
- No vault-root configuration is required.

### US-0.2 Select the starting file
**As an** Obsidian user  
**I want** to choose any markdown file in the current vault as the compilation
entry point  
**So that** the tool is not hard-coded to one document.

**Acceptance criteria**
- A plugin setting or command-palette action selects the starting markdown file.
- The default starting file is `index2compile.md` at the vault root when present.
- The starting file is selected through Obsidian's native quick-switcher
  file-picker modal (identical to Obsidian's own "Open file" command);
  the user types or picks a vault note, and the path is saved to plugin settings.
- If the selected file does not exist, the plugin shows an in-app error notice
  and does not compile.

### US-0.3 Select output location and name
**As an** Obsidian user  
**I want** to choose the output folder and output filename separately  
**So that** outputs from different runs do not overwrite each other.

**Acceptance criteria**
- Plugin settings provide separate output folder and filename fields.
- A system or Obsidian folder picker can choose the output folder.
- The `assets/` directory is created next to the chosen output file.
- The plugin uses Obsidian vault and file APIs for all reads and for all writes
  inside the vault. A folder outside the vault (AC-OL-2) is written with the
  Node.js file system of the desktop app, because the vault API cannot reach it.
- Before overwriting an existing configured output file or assets, the plugin
  asks for explicit confirmation.

**Output location rules (added 2026-10-27, v0.12.0)**

Found 2026-10-27: the output folder `/Users/user/Desktop`, chosen with
`Browse`, was taken as a vault-relative path. The compile wrote
`<vault>/Users/user/Desktop/Rovers of Emberdale.md`, its `assets/` and a
warnings file **into the vault**. The rules below apply to every way a folder
or filename reaches a compile: the settings fields, `Browse`, and the
export-path prompt (US-7.3). They are checked when `Compile` runs, before
anything is read, confirmed or written. A refusal shows the notice
`Compilation not started: <reason>` and writes nothing.

- **AC-OL-1 Vault-relative folder.** A folder that is not absolute is a path
  inside the vault, with `/` between folders. Empty segments and `.` segments
  are dropped.
  | Folder | Filename | Output file | Assets folder |
  |---|---|---|---|
  | (empty) | `Book.md` | `Book.md` | `assets/` |
  | `Exports` | `Book.md` | `Exports/Book.md` | `Exports/assets/` |
  | `Exports/` | `Book.md` | `Exports/Book.md` | `Exports/assets/` |
  | `./Exports//2026` | `Book.md` | `Exports/2026/Book.md` | `Exports/2026/assets/` |
- **AC-OL-2 Absolute folder outside the vault (desktop app only).** An absolute
  folder (`/…`, `C:\…`, `C:/…`, `\\server\share\…`) outside the vault is
  used as it is. The output file, `assets/` and the warnings logfile are
  written there with Node.js `fs`, and **nothing** is created in the vault.
  The folder must already exist; it is never created.
  | Folder | Filename | Writes |
  |---|---|---|
  | `/Users/user/Desktop` | `Rovers of Emberdale.md` | `/Users/user/Desktop/Rovers of Emberdale.md`, `/Users/user/Desktop/assets/…`, `/Users/user/Desktop/warnings_20261027_1106.md` |
  | `/Users/user/Desktp` (does not exist) | `Book.md` | nothing; reason `Output folder "/Users/user/Desktp" does not exist.` |
  | `/Users/user/Desktop` on Obsidian mobile | `Book.md` | nothing; reason `Output folder "/Users/user/Desktop" is outside the vault; writing outside the vault needs the desktop app.` |
- **AC-OL-3 Absolute folder inside the vault.** An absolute folder that is the
  vault root or lies under it is turned into the vault-relative folder and
  then follows AC-OL-1. "Under" means the vault root followed by a path
  separator: a sibling folder whose name only starts with the vault's name is
  outside. Example with the vault root `/Users/user/Rovers`:
  | Folder | Treated as |
  |---|---|
  | `/Users/user/Rovers` | vault-relative (empty, the vault root) |
  | `/Users/user/Rovers/Exports` | vault-relative `Exports` |
  | `/Users/user/Rovers Backup/out` | outside the vault (AC-OL-2), not ` Backup/out` |
- **AC-OL-4 Refused folders.** These folders are refused with the reason shown:
  | Folder | Reason |
  |---|---|
  | `../Exports`, `Exports/../../x`, `/Users/user/../x` | `Output folder "<folder>" must not contain "..".` |
  | `~/Desktop` | `Output folder "~/Desktop" starts with "~". Use the full path, e.g. /Users/<name>/Desktop.` |
  | `Exports\Sub` (vault-relative with a backslash) | `Output folder "Exports\Sub" uses "\"; use "/" between vault folders.` |
  | `.obsidian`, `.obsidian/plugins/obsidian-vault-compiler` | `Output folder "<folder>" is inside the Obsidian config folder .obsidian.` |
- **AC-OL-5 Refused filenames.** The filename is a name, not a path:
  | Filename | Reason |
  |---|---|
  | (empty) | `Output filename is empty.` |
  | `sub/Book.md`, `/tmp/Book.md`, `..\Book.md` | `Output filename "<name>" must be a file name without "/" or "\". Put folders into the output folder.` |
  | `.`, `..` | `Output filename "<name>" is not a file name.` |
- **AC-OL-6 The starting file is never the output.** Folder (empty) and filename
  `index2compile.md` with the starting file `index2compile.md` is refused:
  `Output path "index2compile.md" is the starting file.`
- **AC-OL-7 Browse.** The folder picker stores a folder inside the vault as its
  vault-relative path (AC-OL-3) and a folder outside the vault as its absolute
  path (AC-OL-2). On mobile, where there is no picker, the typed folder is
  stored as typed and checked at compile time.

### US-0.4 Use Obsidian's link database for resolution
**As an** Obsidian user  
**I want** link resolution to use Obsidian's metadata and file index  
**So that** absolute, relative, alias, anchor and bare "magic" links resolve the
same way they do in Obsidian.

**Acceptance criteria**
- The plugin queries Obsidian's link cache/metadata before falling back to its
  own search.
- Absolute and relative markdown links are resolved through Obsidian's path
  resolution rules first.
- Bare filenames are resolved as Obsidian resolves them; only if Obsidian cannot
  resolve does the plugin perform a deterministic fallback search with a
  warning.
- Link targets that Obsidian reports as unresolved are reported as missing in
  the compiled output.
- A target in the output folder counts as not found, even when Obsidian
  returns it (US-3.1, "Output folder", 2026-11-07).

## Epic 1 — Core compilation

### US-1.1 Single master file from ToC
**As a** vault owner  
**I want** the compiler to read the starting file and copy the contents of each
linked file into one master markdown file, in ToC order  
**So that** the whole vault export can be read as one document.

**Acceptance criteria**
- The input defaults to `index2compile.md` but can be overridden.
- Markdown includes are inserted inline, in source order.
- The original Table of Contents list itself is removed from the compiled
  output; only the embedded contents of its listed files remain.
- The master file is written to the configured output path.
- Original vault files are never modified.

### US-1.2 Recursive embedding
**As a** vault owner  
**I want** any markdown file embedded inside another included file to be copied
into the master file at the correct location  
**So that** nested content is preserved automatically.

**Acceptance criteria**
- `![[file.md]]` and `![alt](file.md)` both trigger recursive embedding.
- A heading-anchored embed — `![[file.md#Heading]]` (wiki syntax) or
  `![alt](file.md#Heading)` (markdown syntax) — embeds **only the named
  section**: the heading line itself and all content beneath it up to (but not
  including) the next heading of equal or higher level. The rest of the file is
  not included. This mirrors Obsidian's native section-embed behaviour, and
  applies equally regardless of which embed syntax is used.
  - Heading anchors are matched after URL-decoding. Obsidian writes
    percent-encoded anchors (e.g. `#Leaf%20Craft` for a heading named
    `Leaf Craft`); the compiler decodes these before comparing against heading
    text, so encoded and unencoded anchors resolve to the same section.
  - If the named heading exists, the auto-heading injection (US-6.1) for that
    file is **suppressed**, because the embed already begins with the target
    heading rather than the file's top-level heading.
  - If the named heading does not exist in the target file, the embed is treated
    as a missing reference: a warning comment
    `<!-- Warning: Missing heading anchor: File#Heading -->` is emitted and a
    `WarningDetail` is recorded.
- Circular references are detected and recorded as HTML comments:
  `<!-- Circular dependency avoided: file.md -->`.
- A file is embedded again only when required by the source/ToC order.

### US-1.3 Nested ToC expansion
**As a** vault owner  
**I want** a list of markdown links inside a file to be treated as a new Table
of Contents and imported in order  
**So that** section-level indexes are expanded automatically.

*(Rewritten 2026-10-27 after a defect: `index2compile.md` lists
`- [4 Glossary](Rulebook/Texts/4%20Glossary.md)` and
`- [5 Back notes](Rulebook/Texts/5%20Back%20notes.md)` were not imported,
because only `[[…]]` items were expanded. Decisions of the same day: both
syntaxes expand alike; a list is a ToC only when every item is a note link.)*

Definitions:
- A **list** is a run of consecutive lines that are list items
  (`- `, `* ` or `1. ` etc., with any indentation); a line that is not a list
  item, including a blank line, ends it.
- A **ToC item** is a list item whose whole text (trimmed) is exactly one of
  `[[target]]`, `[[target|alias]]`, `[text](target)`, `![[target]]` or
  `![alt](target)`, where the target (with any `#Heading`) resolves to a
  markdown note in the vault. Links to websites (`https:`, `mailto:`), to
  other files (images, PDFs) and to notes that do not exist are not ToC items.

**Acceptance criteria**
- **AC-1 Both syntaxes.** In a list made only of ToC items, every item becomes
  an embed in place, keeping its indentation and dropping the bullet:
  `[[t]]` → `![[t]]`, `[[t|a]]` → `![[t|a]]`, `[x](t)` → `![x](t)`; embed
  items stay embeds.
  - `index2compile.md` (2026-10-27):
    `- [[3 Bestiary]]` → `![[3 Bestiary]]` and
    `- [4 Glossary](Rulebook/Texts/4%20Glossary.md)` →
    `![4 Glossary](Rulebook/Texts/4%20Glossary.md)`; 4 Glossary and 5 Back
    notes appear in the book after 3 Bestiary.
  - `1. [[A]]` / `2. [B](B.md)` (numbered, mixed syntax) → `![[A]]` / `![B](B.md)`.
  - `- [[A]]` / `  - [B](B.md)` (nested) → `![[A]]` / `  ![B](B.md)`.
- **AC-2 Every item must be a ToC item.** A list with any other item is left
  exactly as written, including its link items.
  - `- [[A]]` / `- some text` → unchanged.
  - `- [[A]] is the first` / `- [[B]]` → unchanged (the first item has more
    than a link).
  - `- [Inter](https://fonts.google.com/specimen/Inter)` / `- [[A]]` →
    unchanged.
  - `- [[Missing Note]]` / `- [[A]]` → unchanged (no note `Missing Note`);
    the link warnings of US-8.3 report the missing target.
  - Embed items are the exception: `- ![[A]]` and `- ![x](A.md)` lose their
    bullet in any list, as before, so the embedded note does not start on a
    list marker. `- ![[A]]` / `- some text` → `![[A]]` / `- some text`.
    (Measured 2026-10-27: no list in the book mixes embed items with other
    items.)
  - This holds only for embeds of notes. An item that embeds a file that is
    not a note — a target with an extension other than `.md`, or a web address
    (US-2.6) — stays a list item, exactly as written before embedding
    (decided 2026-10-31; before, it lost its bullet and a wiki alias, so
    `- ![[pic.png|200]]` became `![](assets/pic.png)`):
    - `- ![a](pic.png)` / `- ![b](pic.png)` → `- ![a](assets/pic.png)` /
      `- ![b](assets/pic.png)`;
    - `- ![[pic.png|200]]` → `- ![200](assets/pic.png)`;
    - `- ![logo](https://example.com/x.png)` → unchanged; also a web image
      without an extension, `- ![chart](https://example.com/render?id=3)`;
    - `- ![](gone.png)` → `- <!-- Warning: Missing asset -->`;
    - `- ![[A]]` / `- ![a](pic.png)` → the note `A`, then `- ![a](assets/pic.png)`;
    - a missing note keeps today's form: `- ![[Gone]]` →
      `<!-- Warning: Missing include -->` (no bullet).
- **AC-3 Order.** Items are embedded in listed order.
- **AC-4 Nesting.** Nested ToCs expand recursively (an embedded note's own
  ToC lists expand when that note is processed).
- **AC-5 Already embedded.** An item whose note this file already embeds
  explicitly (`![[…]]` or `![…](…)` anywhere in the file) stays a link, for
  both syntaxes alike (existing rule for `[[…]]`, now also for `[x](t)`).
- **AC-6 Same note twice.** A note listed in two ToCs is imported twice, as
  today (e.g. spells of two schools). Notes that only want to point at other
  notes write the links in a sentence, not as a list (the user rewrites the
  glossary entries `Talentweb Strand` and `Swift Talents`, decided
  2026-10-27). *Exception (2026-11-07):* an **entry note** (US-9.1) is
  compiled once; later embeds become a comment (US-9.3).

### US-1.4 Code is copied as written
*(Written 2026-11-01 from [#84](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/84),
KD-4; decisions of the same day: inline code counts, a broken link in code
is not reported, indented code as measured in Obsidian, an unclosed block
ends with its note — #102.)*

**As a** vault owner whose notes show markdown or Obsidian syntax as examples
**I want** everything inside code to reach the compiled document exactly as I
wrote it
**So that** an example such as `` `![[Chapter 1]]` `` is shown, not carried
out — as Obsidian shows it.

Measured with v0.19.0 (2026-11-01, `A.md` = `# A` / `AAA text`, `B.md`
embedded below each case): a fenced ToC list `- [[A]]` / `- [[B]]` pastes
note A into the code block; ```` ``` ```` / `![[A]]` / ```` ``` ```` pastes
note A into the block (also with `~~~`); `![x](pic.png)` in a fence is copied
and rewritten; `See [[A]].`, `[[Nope]]` and `[x](#Gone)` in a fence become
warning comments with warnings; inline `` `[[A]]` `` becomes a warning
comment inside the backticks, and inline `` `![[A]]` `` pastes note A between
the backticks; a ```` ```dataview ```` example shown inside a ```` ````md ````
fence is deleted.

**Acceptance criteria**

- **AC-1 What is code.**
  - *A fenced block:* the KD-3 definition (US-6.6), with one correction: a
    fence of three or more backticks or tildes is closed only by a line that
    starts with at least as many of the same character. ```` ````md ```` /
    ```` ```dataview ```` / `LIST` / ```` ``` ```` / ```` ```` ```` is one block
    of five lines; the inner ```` ``` ```` does not close it. *(v0.19.0: the
    inner fence closed it.)*
  - *Inline code:* a run of backticks opens it, the next run of exactly as
    many backticks closes it: `` `[[A]]` ``, ``` ``a `[[A]]` b`` ```. It may
    continue on the next lines of the same paragraph (measured H7:
    `` A sentence with `code that starts here `` / `` [[Code target]] and ends
    here` in it. `` shows the brackets as text); a blank line ends the
    paragraph. A backtick that is never closed in its paragraph is plain
    text: with A embedded, ``Write ` then [[A]].`` → ``Write ` then [A](#A).``
  - *Indented code* (measured in Obsidian 2026-11-01, the code check): a
    line indented by four or more spaces (a tab counts as four) whose line
    before is blank or indented code. Outside a list:

    | Note | Code? |
    | --- | --- |
    | `A paragraph.` / `` / `    [[X]]` (H1) | yes |
    | `A paragraph.` / `    [[X]]` (H2, no blank line) | no — the paragraph goes on |
    | `A paragraph.` / `` / tab `[[X]]` (H3) | yes |

    Inside a list — from a list item to the first non-blank line indented
    less than that item's text — a line needs four spaces *more* than the
    item's text (`- ` → six, `1. ` → seven):

    | Note | Code? |
    | --- | --- |
    | `- [[X]]` / `    - [[X]]` (H4, a nested item) | no |
    | `- an item` / `` / `    [[X]]` (H5) | no — the item goes on |
    | `- an item` / `` / `        [[X]]` (H6, eight spaces) | yes |
    | `- an item` / `` / `Text.` / `` / `    [[X]]` (a paragraph ended the list) | yes |

    So a nested ToC (`- [[1 Basics]]` / `    - [[1.1 Moving]]`, also with blank
    lines between the items) is never code. A heading or a fenced block is
    no paragraph, so four spaces right under one are code, as in standard
    markdown (not measured in Obsidian). This matters because the compiler
    writes each note's title directly above its first line: `G.md` =
    `    See [[A]].` (code: the note starts with it) → `## G` /
    `    See [[A]].`, still code, and stays as written — with "Normalise
    headings" off too, where the indentation used to be trimmed away.
    Observed in M18 (2026-11-01): Obsidian draws an indented line that holds
    only a wiki link or embed oddly, in the source note as in the compiled
    book; the compiler copies it as written either way. A note
    starts fresh, so the root note may start with indented code; after an
    embed line, four spaces continue the paragraph as they do in the note
    (`![[A]]` / `    See [[B]].` → `See [B](#B).`).
- **AC-2 Nothing happens inside code.** No step changes text inside code or
  reports anything for it: no embed, no ToC expansion, no link conversion, no
  copied asset, no map or Dataview block removed or drawn, no Dataview
  Serializer marker removed (`<!-- SerializedQuery: LIST -->` in a fence),
  no warning. Each
  case of the measurement above comes out exactly as written, with no
  warning and no copied file. The map and control rules (US-4, US-5) apply to
  their own fences, not to fences shown inside another code block:
  ```` ````md ```` / ```` ```text-mapper ```` / `0101 grass` / ```` ``` ```` /
  ```` ```` ```` stays as written, without a map picture.
- **AC-3 Outside code nothing changes.** Text before and after code on the
  same line is handled as before: ``Write `[[A]]`, see [[B]].`` →
  ``Write `[[A]]`, see [B](#B).`` The compiled fixture books are
  byte-identical to v0.19.0 (they hold no code).
- **AC-4 Composed cases.**
  - An embed inside code does not count as "already embedded" for a ToC
    (US-1.3 AC-5): ```` ``` ```` / `![[A]]` / ```` ``` ```` / `- [[A]]` /
    `- [[B]]` → the code block unchanged, then notes A and B.
  - A ToC list item holding inline code is not a link item, so the list is
    not a ToC (US-1.3, as today): `` - `[[A]]` `` / `- [[B]]` stays a list;
    the first item is copied as written, the second stays a link (here
    with the `not embedded` comment, since B is embedded nowhere).
  - Code in an embedded note, in a section embed (US-1.2) and in a
    pass-through target (US-6.5) is copied as written; with "Normalise
    headings" on and off.
  - Headings in code stay as in KD-3.
- **AC-5 Location markers** (US-8.4 AC-5) are never written inside code, so
  none reaches the output there (SCAR-039).

- **AC-6 An unclosed code block ends with its note** *(decided 2026-11-01,
  [#102](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/102))*. As
  in Obsidian, where an unclosed fence ends with its note, the compiler adds
  the closing fence — the opening fence's character, as many times — on its
  own line at the end of the part of the note it copies, so the block cannot
  reach what follows. v0.19.0: `U.md` = `# U` / `` / ```` ``` ```` /
  `![[A]]` (never closed; the fence is line 3), embedded in `index.md` = `# Book` / `![[U]]` / `See [[B]].`
  / `![[B]]` → everything from U's fence to the end of the book is one code
  block. Now:
  - → `## U` / ```` ``` ```` / `![[A]]` / ```` ``` ```` / `See [B](#B).` /
    `## B` …; `![[A]]` is code and stays as written (AC-2).
  - A ```` ````md ```` block is closed with ```` ```` ````, a `~~~` block with
    `~~~`.
  - A section embed (`![[U#U]]`) and a pass-through target are closed at the
    end of the copied part; the root note at the end of the document.
  - A note whose fences are all closed is unchanged (the fixture books are
    byte-identical).
  - Each unclosed block is reported once:
    `Code block not closed; closed at the end of the note`, with the note
    and the line of its opening fence (`U.md`, line 3).

- **AC-7 Code inside a quote** *(found 2026-11-01 in the class search of
  US-1.5; [#105](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/105))*. A line with a quote prefix (US-1.5 definitions) is read for code
  by what follows its prefix: `> ~~~` opens a fenced block, `>` alone is an
  empty line. A change of quote depth ends an open block and a paragraph (the
  quote ends the block, as in standard markdown); such a block is never
  "unclosed" (AC-6). Measured with v0.20.1, root `# Book` / … and note A
  existing but embedded nowhere:
  - `> ~~~` / `> [[A]]` / `> ![[A]]` / `> ~~~` → as written, no warning.
    *(v0.20.1: `> [A](#A)`, then note A pasted, which ended the quote.)*
  - `> ```` ```` / `> [[A]]` / `>` / ``> x ``` y`` / `> [[A]]` / `> ```` ```` →
    as written, no warning. *(v0.20.1: the second `[[A]]` became a warning
    comment; the first block was protected only because its backticks paired
    up as inline code.)*
  - `> > ```` ```` / `> > [[A]]` / `> > ```` ```` and a callout
    `> [!example]` / `> ```` ```` / `> [[A]]` / `> ```` ```` → as written.
  - The quote ends the block: `> ```` ```` / `> code` / `` / `See [[A]].` →
    `See` becomes the US-8.3 comment as for any link outside code; no
    `Code block not closed` warning.
  - Inline code in a quote, `` > `[[A]]` ``, stays as written (guard; already
    so in v0.20.1); also when it runs over three quote lines and the middle
    one is an embed: `` > Write `start `` / `> ![[A]]` / `` > end` here. ``
  - Indented code in a quote: `> Text.` / `>` / `>     [[A]]` (four spaces
    after the marker's space) → as written.
  - A deeper quote starts a new paragraph: `` > Write `[[A]] `` /
    `` > > and` [[A]]. `` → both links are converted (the backticks do not
    pair across the two paragraphs). A line with fewer markers is not
    specified here (standard markdown may continue the paragraph lazily).

**Not in scope:** math blocks and HTML comments.

### US-1.5 Embed a note as a quote
*(Written 2026-11-01 from the author's request; decisions of the same day:
a bold filename title opens the quote, headings as written, inner embeds
quoted, ToC lists not expanded, links treated as to a note not in the book,
mid-line embeds out of scope. Tracked in
[#106](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/106).)*

**As an** author
**I want** to embed a note inside a quote (`> ![[Sage]]`)
**So that** the whole note is shown as one quotation, without its headings
becoming part of the book's heading structure — it is a quote, not a part of
the text that builds the book.

Measured with v0.20.1 (2026-11-01): root `# Book` / `## Chapter` /
`As the sage said:` / `> ![[Sage]]` / `After.`; `Sage.md` = `# Wisdom` / `` /
`First line.` / `Second line.` / `` / `## Detail` / `` / `More.`. With
"Normalise headings" on:
```
> ### Sage
First line.
Second line.

#### Detail
More.
```
Only the injected title is inside the quote; the rest of the note falls out
of it and is normalised. Off: `> ## Sage`, the rest out of the quote, `##
Detail` unshifted. The same with `> ![s](Sage.md)`, inside a callout
(`> [!quote] The sage` / `> ![[Sage]]`) and for notes Sage embeds. A
section embed `> ![[Sage#Detail]]` leaves an empty `> ` line and puts
`## Detail` / `More.` after it, outside the quote.

Definitions:
- A **quote prefix** is the run of quote markers at the start of a line; a
  marker is at most three spaces, `>` and one optional space or tab:
  `> `, `>`, `> > `, `>> `. Its **depth** is the number of markers. A callout (`> [!quote] Title`) is a quote
  with the same prefix.
- A **quoted embed** is a line that is its quote prefix followed by exactly
  one note embed (either syntax, with or without `#Heading`, trailing spaces
  allowed): `> ![[Sage]]`, `>![[Sage]]`, `> > ![s](Sage.md)`,
  `> ![[Sage#Detail]]`. Embeds of files that are not notes (images, web
  addresses) are not quoted embeds; they keep today's rules (US-2.1, US-2.6).
- The **quoted content** is everything a quoted embed brings in, including
  the notes that note embeds, at any depth.
- The **quote title** is `**` + the title (title rule of US-6.4) + `**`,
  with every `*` and `_` in the title escaped by a backslash.

Examples use the root and `Sage.md` of the measurement unless said
otherwise; `` stands for an empty line. Every AC holds with "Normalise
headings" on and off (SCAR-019).

**Acceptance criteria**

- **AC-1 One quote container.** Every line of the quoted content is written
  with the quote prefix of the quoted embed line. An empty line becomes the
  prefix without trailing spaces (`>`, `> >`), so the quote does not break.
  Runs of two or more empty quote lines become one; the quoted content does
  not start or end with an empty quote line.
  - Root as measured → `## Chapter` / `As the sage said:` / `` /
    `> **Sage**` / `>` / `> # Wisdom` / `>` / `> First line.` /
    `> Second line.` / `>` / `> ## Detail` / `>` / `> More.` / `` / `After.`
  - `> ![s](Sage.md)` gives the same quote.
  - `> > ![[Sage]]` → each line starts with `> > `, empty lines are `> >`;
    `>![[Sage]]` → `>**Sage**` / `>` / `># Wisdom` / … (the prefix as
    written).
  - A line in Sage that is already a quote, `> x`, becomes `> > x`.
- **AC-2 Text around the embed stays in the quote.** Quote lines written
  before and after the quoted embed keep their place in the same container.
  - `> [!quote] The sage` / `> ![[Sage]]` / `> — said at dawn` →
    `> [!quote] The sage` / `> **Sage**` / `>` / `> # Wisdom` / … /
    `> More.` / `> — said at dawn`.
- **AC-3 Quote title.** A whole-note quoted embed opens with the quote title,
  then an empty quote line; the note's first heading is kept, not replaced.
  - `1.2 Sage.md` (same text) → `> **Sage**` / `>` / `> # Wisdom` / …
  - `My *notes*.md` → `> **My \*notes\***`; `snake_case_rules.md` →
    `> **Snake\_case\_rules**`.
  - A headingless note `Sage.md` = `Wise words.` → `> **Sage**` / `>` /
    `> Wise words.`
- **AC-4 Headings as written.** Headings in the quoted content keep their
  level and text: no filename title as a heading (US-6.1, US-6.4), no shift
  (US-6.3), no clamp warning. They do not count as the last original heading
  for later embeds (US-6.3 AC-4).
  - Toggle on, root `# Book` / `## Chapter` / `> ![[Sage]]` / `![[X]]`,
    `X.md` = `X text.` → the quote as in AC-1, then `### X` (the heading
    above is `## Chapter`, not Sage's `## Detail`).
  - Toggle off, the same root → the same quote, then `## X` (US-6.1).
  - A quote line in the root is not a heading either: root `# Book` /
    `> ## Aside` / `![[X]]` → `## X` with the toggle on.
- **AC-5 Section embed.** `> ![[Sage#Detail]]` (or `> ![d](Sage.md#Detail)`)
  quotes the section (US-1.2) with no quote title, its heading as written:
  root `## Chapter` / `> ![[Sage#Detail]]` → `## Chapter` / `> ## Detail` /
  `>` / `> More.` (no empty line after the heading, US-6.6 AC-3). A missing heading gives the US-1.2 warning
  inside the quote:
  `> <!-- Warning: Missing heading anchor: Sage.md#Gone -->`. Only the
  note's own headings end the section; headings of notes it embeds do not
  (they are not shifted below it): `Sage.md` = `## Detail` / `![[Inner]]` /
  `## Next` / `x`, `Inner.md` = `# Inner` / `text` → `> ## Detail` / `>` /
  `> **Inner**` / `>` / `> # Inner` / `>` / `> text`, without `Next`.
- **AC-6 Embeds inside the quoted note.** They are expanded into the same
  container, by the same rules (AC-1 to AC-5); each whole note gets its own
  quote title.
  - `Sage.md` = `Intro.` / `![[Inner]]`; `Inner.md` = `# Inner` / `text` →
    `> **Sage**` / `>` / `> Intro.` / `>` / `> **Inner**` / `>` /
    `> # Inner` / `>` / `> text`.
  - A pass-through wrapper (US-6.5) adds no quote title and shows its
    target's: `Sage.md` = `![[Real]]`, `Real.md` = `# R` / `text` →
    `> **Real**` / `>` / `> # R` / `>` / `> text`. A wrapper around a section
    embed shows the section without a quote title (AC-5). A wrapper that is
    no pass-through (its target is a preamble note) keeps its title:
    `Real.md` = `text` → `> **Sage**` / `>` / `> **Real**` / `>` / `> text`.
  - A circular embed and a missing note give today's comments inside the
    quote: `> <!-- Circular dependency avoided: Sage.md -->`,
    `> <!-- Warning: Missing include -->`.
- **AC-7 ToC lists are not expanded in a quote.** A list of note links in
  the quoted content stays a list (US-1.3 does not apply); its links follow
  AC-8.
  - `Sage.md` = `- [[A]]` / `- [[B]]`, A and B embedded elsewhere →
    `> **Sage**` / `>` / `> - [A](#A)` / `> - [B](#B)`.
  - An embed item in the quoted content is still an embed and is quoted
    (AC-6), as in US-1.3 AC-2: `Sage.md` = `Intro.` / `- ![[A]]`, `A.md` =
    `# A` / `AAA` → `> **Sage**` / `>` / `> Intro.` / `>` / `> **A**` / `>` /
    `> # A` / `>` / `> AAA`. (`Sage.md` = `- ![[A]]` alone is a pass-through
    wrapper, AC-6, as outside quotes.)
- **AC-8 Links.** A note counts as embedded in the book (US-8.3, US-2.3)
  only where it is embedded outside a quote; headings inside a quote are no
  link targets.
  - Sage only quoted: `See [[Sage]].` elsewhere →
    `See <!-- Warning: link target 'Sage' not embedded in compiled output -->.`
    and `See [[Sage#Detail]].` →
    `See <!-- Warning: link target 'Sage#Detail' not embedded in compiled output -->.`,
    each with its warning — exactly as for a note embedded nowhere (measured
    with v0.20.1).
  - Links inside the quoted content are converted as anywhere else.
  - A file that quotes a note and also lists it in a ToC embeds it from the
    ToC: `> ![[A]]` / `` / `- [[A]]` / `- [[B]]` → the quote of A, then A
    and B in full (a quoted embed does not count for US-1.3 AC-5).
    Links to it go to the copy in full: `See [[Sage]] and [[Sage#Detail]].`
    with Sage quoted and listed → `See [Sage](#Sage) and [Detail](#Detail).`,
    no warning.
  - A heading inside a quote makes no duplicate (US-2.3 AC-6): `# Book` /
    `> ![[Q]]` / `## Chapter` / `See [[#Chapter]].`, `Q.md` = `## Chapter` →
    `See [Chapter](#Chapter).`, no warning.
- **AC-9 Everything else applies inside the quote.** Frontmatter (US-5.2)
  and control commands (US-5.1) are removed; images are copied and their
  links rewritten (`> ![](assets/pic.png)`); maps are drawn (US-4.1); code is
  copied as written (US-1.4), fence lines carrying the prefix, and an
  unclosed block is closed with `> ` + the fence (US-1.4 AC-6). Each warning
  is reported once with the note and line where it is written (US-8.5).
- **AC-10 Nothing internal reaches the output.** No sentinel or location
  marker (US-8.4 AC-5) is left in or around the quote (SCAR-039); the quote
  prefix is never added to a marker line.
- **AC-11 Empty lines (US-6.6).** A quote line is not an empty line and not a
  heading for US-6.6, so its rules do not change the quote; AC-1 decides the
  empty quote lines.

**Measured in Obsidian (2026-11-01, v0.21.0, reading view):** headings,
fenced code, a nested `> >` quote, a quote line inside the quoted note, a
callout continued over `>` lines, an escaped title, a list and an image all
show inside one quote container; an unquoted line after an empty line is
outside it. A heading inside a quote is no link target: `[link](#Detail)` to
a quoted `## Detail` gives "Unable to find" — hence AC-8. In a quote, a `~~~`
block and indented code show as code, and a quote that ends closes its
` ``` ` block (US-1.4 AC-7). Not measured: whether the outline lists quoted
headings.

**Not in scope:** an embed in a list item inside a quote (`> - ![[Sage]]`),
and KD-5.

**Known defect KD-5 (found 2026-11-01): an embed in the middle of a line.**
`He said ![[Sage]] and left`, `Sage.md` = `Wise words.` → `He said ## Sage` /
`Wise words.` / ` and left` (toggle off), inside and outside a quote; the
title lands in the middle of the sentence. Not part of US-1.5; decided
2026-11-10 as US-1.6
([#107](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/107)).

### US-1.6 Embed a note in a sentence
*(Written 2026-11-10 from
[#107](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/107);
decisions of the same day: a note goes into the sentence only when it is one
paragraph once its headings are dropped, its text kept exactly, full stop
included; any other note keeps the block output of v0.23.0, with a warning.)*

**As an** author
**I want** an embed written inside a sentence (`He said ![[Sage]] and left.`)
to put the note's words into that sentence
**So that** short notes (a phrase, a definition) can be reused in running
text without a heading or line breaks landing in the middle of it.

Measured with v0.23.0 (2026-11-10), `Sage.md` = `Wise words.`, root
`# Book` / `` / `He said ![[Sage]] and left.`: toggle on →
`# Book` / `He said ## Sage` / `Wise words.` / ` and left.`; toggle off the
same with an empty line after `## Sage`. The same with `![s](Sage.md)`, in a
quote (`> He said ## Sage` / `Wise words.` / ` and left.` — the rest falls
out of the quote) and in a list item. A section embed
`He said ![[Sage#Detail]] and left.` gives `He said ` / `` / `## Detail` /
`More words.` / `` / ` and left.`

Definitions:
- An **embed in a sentence** is a note embed (either syntax, whole note or
  section) on a line that holds other text besides embeds, read after the
  line's quote prefix and list marker (SCAR-041). `He said ![[Sage]].`,
  `> He said ![[Sage]] and left.`, `- See ![[Sage]] here`,
  `![[Sage]] said so.`, `He said: ![[Sage]]`, `## About ![[Sage]]` are
  embeds in a sentence; `![[Sage]]`, `> ![[Sage]]` (US-1.5), `- ![[Sage]]`
  (US-1.3), `> - ![[Sage]]` (unchanged, out of scope of US-1.5) and
  `![[A]] ![[B]]` (only embeds) are not. Images and other
  files are not note embeds (US-2.1, US-2.6).
- The **sentence text** of a note is read from the note as stored, after its
  frontmatter (US-5.2), or from the named section (US-1.2): its heading
  lines are dropped and the empty lines at both ends. The note **is one
  paragraph** when what is left has no empty line and no line that starts a
  block: a list item (`- `, `* `, `+ `, `1. `, `1) `), a quote (`>`), a code
  fence (` ``` `, `~~~`), indented code on the first line (four spaces or a
  tab), a table row (a line starting with `|`, or a delimiter row
  `--- | ---`), a thematic break or setext underline (`---`, `***`, `===`),
  an HTML block (a line starting with `<`, except one that is a single
  `<!-- … -->` comment), a line that is only an embed, a math block (`$$`),
  a footnote or link definition (`[^1]:`, `[x]: `). A note with nothing
  left is one (empty) paragraph.

Every AC holds with "Normalise headings" on and off (SCAR-019). Root
`# Book` / `` / `He said ![[Sage]] and left.` unless said otherwise.

**Acceptance criteria**

- **AC-1 One paragraph goes into the sentence.** The embed is replaced by the
  note's lines, without headings, title and line breaks, joined by single
  spaces; the text is kept exactly as written, full stop included. No
  heading, empty line or line break is added before or after.
  - `Sage.md` = `Wise words.` → `# Book` / `He said Wise words. and left.`
  - `![s](Sage.md)` → the same.
  - `Sage.md` = `# Wisdom` / `` / `Wise words.` (heading-first) → the same.
  - `Sage.md` = `Wise` / `words.` (two lines, one paragraph) → the same.
  - `He said: ![[Sage]]` → `He said: Wise words.`;
    `![[Sage]] he said.` → `Wise words. he said.`
  - Two in one line: `![[Sage]] and ![[Fool]]`, `Fool.md` = `Silly words.`
    → `Wise words. and Silly words.`
  - An empty note (or only headings) → `He said  and left.` (the two spaces
    as written), no warning.
- **AC-2 Section embed.** `He said ![[Sage#Detail]] and left.`, `Sage.md` =
  `# Wisdom` / `` / `First.` / `` / `## Detail` / `` / `More words.` →
  `He said More words. and left.` The section's own heading is dropped. A
  missing heading gives the US-1.2 comment in the sentence:
  `He said <!-- Warning: Missing heading anchor: Sage.md#Gone --> and left.`
  with its warning (US-6.5 AC-12 detail form, the root and line 3).
- **AC-3 Containers.** The sentence stays in its container (SCAR-041):
  `> He said ![[Sage]] and left.` → `> He said Wise words. and left.`;
  `- He said ![[Sage]] and left.` → `- He said Wise words. and left.`;
  `## About ![[Sage]]` → `## About Wise words.` (a heading of the root,
  normalised like any). Inside a quoted note (US-1.5) the same: `Q.md` =
  `He said ![[Sage]] and left.`, root `> ![[Q]]` →
  `> **Q**` / `>` / `> He said Wise words. and left.`
- **AC-4 Inside the inlined text.** Links are converted as anywhere else
  (`Sage.md` = `Read [[Other]] now.`, Other embedded below →
  `He said Read [Other](#Other) now. and left.`), with their warnings at
  Sage's lines (US-8.4). An embed in a sentence inside Sage is put in by
  the same rule (`Sage.md` = `Wise ![[Fool]] words.` →
  `He said Wise Silly words. words. and left.`). Images are copied and
  rewritten (US-2.1). A circular embed gives today's comment in the
  sentence (`<!-- Circular dependency avoided: Sage.md -->`).
- **AC-5 Not a place in the book.** A note put into a sentence adds no
  heading, no anchor, no entry or detail block (US-9.1, US-9.5); links to
  it are treated as to a note not in the book, unless it is embedded
  elsewhere as a block (as for quotes, US-1.5 AC-8): Sage only in the
  sentence, `See [[Sage]].` elsewhere →
  `See <!-- Warning: link target 'Sage' not embedded in compiled output -->.`
- **AC-6 More than one paragraph: block, with a warning.** A note that is
  not one paragraph keeps the output of v0.23.0 (title and block in the
  middle of the line) and adds one warning
  `{ message: 'Note embedded in a sentence is not one paragraph; embedded as a block', link: 'Sage', file: 'index.md', line: 3 }`
  (the link as written, the note and line of the embed). `Sage.md` =
  `# Wisdom` / `` / `First.` / `` / `- a` / `- b` → toggle on
  `He said ## Sage` / `` / `First.` / `` / `- a` / `- b` / ` and left.`
  and the warning. The same for `First.` / `` / `Second.` (two
  paragraphs) and for each block start of the definition. Nothing inside
  the note is reported twice.

## Epic 2 — Asset handling and deduplication
### US-2.1 Copy embedded media to `assets/`
**As a** vault owner  
**I want** every embedded non-markdown file to be copied into an `/assets`
folder next to the compiled output  
**So that** the compiled document remains portable.

**Acceptance criteria**
- Images, PDFs, audio, video and other supported binary files are copied.
- Each copied file is referenced with a relative path such as
  `assets/filename.png`.
- Media references in the master file are rewritten to point to `assets/`.

### US-2.2 Deduplicate identical assets
**As a** vault owner  
**I want** the same physical file referenced many times to be copied only once  
**So that** the assets folder does not grow with duplicates.

**Acceptance criteria**
- Deduplication is by resolved absolute source path.
- The first reference creates the copy; later references reuse the destination
  path.
- Different files that share a basename receive `_1`, `_2`, ... suffixes.
- A log entry records when an existing copy is reused.

### US-2.3 Link conversion to anchors
**As a** reader of the compiled document  
**I want** in-text links to other markdown files to become anchor links in the
master file  
**So that** navigation still works inside the single file.

The compiled document is read in Obsidian (decided 2026-11-01; #83, #85; work
item [#99](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/99)). Anchors are
written the way Obsidian finds headings, not as GitHub or Pandoc slugs.

**Measured in Obsidian (2026-11-01, reading view; three check notes):**

| Link | Lands on |
| --- | --- |
| `(#Zeal)`, `(#zeal)`, `[[#Zeal]]` | `# Zeal` |
| `(#The%20Brawling%20and%20Fortune%20Pools)`, the same in lower case | `# The Brawling and Fortune Pools` |
| `(#the-brawling-and-fortune-pools)`, `(#1.3-grit-zeal)` (slugs) | not found |
| `(#1.3%20Grit%20&%20Zeal)` | `# 1.3 Grit & Zeal` |
| `(#intro-1)` (numbered duplicate) | not found |
| `(#Two#Intro)`, `[[#Two#Intro]]` | `## Intro` under `# Two`, not the one under `# One` |
| `(#Chapter%20Two#Intro)` | `## Intro` under `# Chapter Two` |
| `(#Part%20B#Intro)`, `(#Chapter%20Four#Intro)`, `(#Part%20B#Chapter%20Four#Intro)` | `### Intro` under `# Part B` / `## Chapter Four` (a path may skip levels) |
| `(#Rules%20(optional))`, `(#Rules%20%28optional%29)`, `(<#Rules (optional)>)` | `# Rules (optional)` |
| `(#Café%20Rules)`, `(#Caf%C3%A9%20Rules)` | `# Café Rules` |
| `(#Why?%20Because,%20it's%20fine)` | `# Why? Because, it's fine` |
| `(#The%20bold%20rule)`, `(#The%20**bold**%20rule)` | `# The **bold** rule` |
| `(#Notes%20on%20Other)`, `(#Notes%20on%20[[Other]])` | `# Notes on [[Other]]` |
| `(#50%25%20off)` | `# 50% off` |
| `(#50%%20off)` | "cannot open location" |
| `(#Book#Intro)`, where `# Book` has two `## Intro` | the first Intro |
| `(#chapter%20two#intro)` | `## Intro` under `# Chapter Two` (path parts ignore case) |
| `(#C%23%20basics)`, `(#C#%20basics)` | not found (`# C# basics`) |
| `(#See%20Pools)`, `(#See%20[Pools]%28#Pools%29)` | not found (`## See [Pools](#Pools)`) |
| `(#Done%20:%29)` | "cannot open location" (`# Done :)`) |
| Obsidian's own `[[#` completion for `C# basics`, `Done :)`, `Time: noon`, `See [Pools](#Pools)`, `A \| B`, `Up ^ down` | inserts `[[#C basics]]`, `[[#Done )]]`, `[[#Time noon]]`, `[[#See [Pools]( Pools)]]`, `[[#A B]]`, `[[#Up down]]`; each lands on its heading |
| `(#C%20basics)`, `(#C%20%20basics)` | `# C# basics` |
| `(#Done%20%29)`, `(#Done%20%20%29)` | `# Done :)` |
| `(#Time%20noon)`, `(#Time%20%20noon)` | `# Time: noon` |
| `(#Time%3A%20noon)` | not found |
| `(#See%20[Pools]%28%20Pools%29)` | `## See [Pools](#Pools)` |
| `(#See%20Pools)` | not found |

Obsidian's own PDF export has no clickable links, so the anchor form does not
matter there.

**Acceptance criteria**

- **AC-1 Which links.** Links to a note, to a heading in a note, and to a
  heading in the same note become `[label](#anchor)`, in both syntaxes:
  `[[Note]]`, `[text](Note.md)`, `[[Note#Heading]]`,
  `[text](Note.md#Heading)`, `[[#Heading]]`, `[text](#Heading)`. Spaces in a
  markdown target may be written `%20` (`Note.md#Fighting%20Pools`), brackets
  as they are (`[r](#Rules%20(optional))`, measured D1). Warnings of one
  note come in the order of its links.
- **AC-2 Anchor form.** The anchor is the text of the target heading as it
  stands in the compiled output, written the way Obsidian writes it itself
  (check 4): `#`, `:`, `|` and `^` become a space, runs of spaces become one,
  and the ends are trimmed. Then four characters are encoded: space →
  `%20`, `(` → `%28`, `)` → `%29` (so that a `)` in a heading cannot end the
  link), `%` → `%25`. Everything else is written as it is, case included:

  | Heading in the output | Anchor |
  | --- | --- |
  | `## Zeal` | `#Zeal` |
  | `## The Brawling and Fortune Pools` | `#The%20Brawling%20and%20Fortune%20Pools` |
  | `### 1.3.1 Combat` (a heading inside a note keeps its number) | `#1.3.1%20Combat` |
  | `## Grit & Zeal` | `#Grit%20&%20Zeal` |
  | `## Rules (optional)` | `#Rules%20%28optional%29` |
  | `## Café Rules` | `#Café%20Rules` |
  | `## The **bold** rule` | `#The%20**bold**%20rule` |
  | `## 50% off` | `#50%25%20off` |
  | `## C# basics` | `#C%20basics` |
  | `## Done :)` | `#Done%20%29` |
  | `## Time: noon` | `#Time%20noon` |
  | `## A \| B`, `## Up ^ down` | `#A%20B`, `#Up%20down` |
  | `## See [[Pools]]` in a note, `## See [Pools](#Pools)` in the output | `#See%20[Pools]%28%20Pools%29` |

  Two headings that differ only in these characters (`C# basics`,
  `C basics`) have the same text for Obsidian and count as duplicates
  (AC-6). Not measured: a heading whose converted link has a `%20` in its
  own anchor, and `%%` in a heading.

  This replaces the slug form (`#the-brawling-and-fortune-pools`,
  `#1.3.1-combat`), which Obsidian does not find (breaking change,
  2026-11-01).
- **AC-3 Links to a note** point at the note's title in the output (the title
  rule of US-6.4, KD-1): `[[1.2 Third-Level]]` →
  `[Third-Level](#Third-Level)`; `[[1.3 Grit & Zeal]]` →
  `[Grit & Zeal](#Grit%20&%20Zeal)`. The label is the link's own text, else
  the title. A note embedded more than once: the first place (US-8.3); the
  second title is a duplicate the first match already finds (AC-6), so no
  path and no warning. A note of which only a section is in the output: the
  heading that section shows — `index.md` embeds only `![[Pools#Other]]`, so
  `[[Pools]]` → `[Pools](#Other)` (today `(#pools)`, a heading that is not
  in the output).
- **AC-4 Links to a heading in another note** point at that heading where the
  note is embedded first. The heading is looked up in the note as US-3.1 says
  (case-insensitive, whitespace collapsed). The label is the link's own text,
  else the heading's text as written in the note.
  - `[[Pools#Fighting Pools]]`, `[x](Pools.md#Fighting%20Pools)`,
    `[[Pools#fighting pools]]` → `[Fighting Pools](#Fighting%20Pools)`,
    `[x](#Fighting%20Pools)`, `[Fighting Pools](#Fighting%20Pools)` (no text
    of its own, so the heading as written in the note);
    `[[Pools#Fighting Pools|the pools]]` → `[the pools](#Fighting%20Pools)`.
    Today all of them become `(#pools)`.
  - A link to the note's first heading, which the title rule replaced
    (`Pools.md` starts with `# The Fighting Pools`, shown as `## Pools`):
    `[[Pools#The Fighting Pools]]` → `[The Fighting Pools](#Pools)`.
  - The heading is not in the note: `[[Pools#Nope]]` → `[Nope](#Pools)`,
    the note's title, and the warning
    `Missing heading anchor: Pools#Nope` with the link's note and line.
    Today: `(#pools)`, no warning.
  - The heading is in the note but not in the output (only `![[Pools#Other]]`
    is embedded): `[[Pools#Fighting Pools]]` → `[Fighting Pools](#Other)`,
    where the note starts in the output (AC-3), and the warning
    `heading 'Pools#Fighting Pools' not embedded in compiled output`. A link
    to the section that is embedded, `[[Pools#Other]]`, →
    `[Other](#Other)`, no warning.
  - The note is not in the output at all: US-8.3 as today (the
    `not embedded in compiled output` comment).
- **AC-5 Links to a heading in the same note** (#83) point at that heading in
  the part of the output that came from the note the link is written in — for
  a section embed, the note the section came from.
  - `Grit.md` has `## Rolling`: `[[#Rolling]]` → `[Rolling](#Rolling)`;
    `[r](#Rolling)`, `[r](#rolling)` → `[r](#Rolling)`. Today `[[#Rolling]]`
    is dropped as `Missing wiki link`.
  - `[r](#The%20Fighting%20Pools)` where the note's `# The Fighting Pools`
    was shown as `## Pools` → `[r](#Pools)`.
  - The same heading text in an earlier note: the link stays in its own
    note. `A.md` = `# A` / `## Rolling`, `B.md` = `# B` / `[[#Rolling]]` /
    `## Rolling`, both embedded, "Normalise headings" on → in B,
    `[Rolling](#B#Rolling)` (AC-6).
  - The heading is in the note but not in the output: as AC-4. `index.md` =
    `# Book` / `## Rolling` / `![[Grit#Part]]`, `Grit.md` = `# Grit` /
    `## Part` / `See [[#Rolling]].` / `## Rolling` → `[Rolling](#Part)`, not
    the book's own Rolling, and the warning
    `heading 'Grit#Rolling' not embedded in compiled output` (Grit.md, line 5).
  - A note embedded twice: each copy's links stay in that copy. `index.md` =
    `# Book` / `## One` / `![[G]]` / `## Two` / `![[G]]`, `G.md` = `# G` /
    `See [[#Rolling]].` / `## Rolling`, "Normalise headings" on → the first
    copy `[Rolling](#Rolling)`, the second `[Rolling](#Two#G#Rolling)`.
  - No such heading in the note: `[p](#Gone)` and `[p](#Gone%20Away)` stay as written,
    `[[#Gone]]` → `[Gone](#Gone)`; both with the warning
    `Missing heading anchor: #Gone` and the link's note and line.
  - A heading path written by the author (`[[#Two#Intro]]`, `[x](#Two#Intro)`,
    measured B3/B4) is looked up the way Obsidian does (AC-6) and written as
    AC-6 says: in `Grit.md` = `# Grit` / `## One` / `### Intro` / `## Two` /
    `### Intro`, `[[#Two#Intro]]` → `[Intro](#Two#Intro)`. Today it is
    dropped as `Missing wiki link`.
  - Block links (`[[#^id]]`, `(#^id)`) are not in scope and keep today's
    behaviour: the markdown form stays as written, the wiki form is dropped as
    `Missing wiki link`. Tracked in [#100](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/100).
- **AC-6 Headings with the same text** (#85). Obsidian treats heading text
  case-insensitively and does not number duplicates. A path `#A#B#C` finds
  the first heading `C` (in output order) that has a heading `B` and above
  that a heading `A` among its *parents* — the headings before it with a
  smaller level, nearest first; parents may be skipped (measured C2–C4). A
  heading at the same level is not a parent. When the target heading's text
  occurs more than once in the output, the anchor gets the target's parents,
  nearest first, until the path finds the target. Examples, each the output
  of the notes named (`index.md` = `# Book` and the embeds, then the link):

  | Notes | Normalise | Output | Link | Anchor |
  | --- | --- | --- | --- | --- |
  | `One.md` = `# One` / `## Intro`, `Two.md` = `# Two` / `## Intro` | on | `# Book` / `## One` / `### Intro` / `## Two` / `### Intro` | `[[One#Intro]]` | `[Intro](#Intro)` |
  | same | on | same | `[[Two#Intro]]` | `[Intro](#Two#Intro)` |
  | same | off | `# Book` / `## One` / `## Intro` / `## Two` / `## Intro` (Two is no parent) | `[[Two#Intro]]` | `[Intro](#Intro)` and warning W |
  | `Chapter One.md`, `Chapter Two.md` as above | on | `## Chapter One` / `### Intro` / `## Chapter Two` / `### Intro` | `[[Chapter Two#Intro]]` | `[Intro](#Chapter%20Two#Intro)` |
  | `Part A.md` = `# Part A` / `## Ch` / `### Intro`, `Part B.md` likewise | on | `## Part A` / `### Ch` / `#### Intro` / `## Part B` / `### Ch` / `#### Intro` | `[[Part B#Intro]]` | `[Intro](#Part%20B#Ch#Intro)` |
  | `1 Intro.md` = `one`, `2 Intro.md` = `two` | on and off | `# Book` / `# Intro` / `# Intro` | `[[2 Intro]]` | `[Intro](#Intro)` and warning W |

  Warning W: `Heading "Intro" occurs 2 times and no heading path tells them
  apart; the link goes to the first`, with the link's note and line. A path
  is never written when the plain text already finds the target. A path
  that fits several headings opens the first (measured E7); path parts
  ignore case (E8), so parents that differ only in case do not tell headings
  apart.
- **AC-7 Which headings count.** The headings of the compiled output, after
  normalisation and title injection (US-6.3, US-6.4), at any level. Lines
  inside code fences and frontmatter are not headings. The same notes give
  the same anchors with "Normalise headings" on and off, except where the
  title rule changes a heading's text.
- **AC-8 Missing link targets** are reported as HTML comments (unchanged).

**Migration:** links in the compiled output change from
`(#the-brawling-and-fortune-pools)` to
`(#The%20Brawling%20and%20Fortune%20Pools)`. Anything outside Obsidian that
followed the old slugs (GitHub, Pandoc) no longer finds them.

### US-2.4 Handle spaces and special characters in asset paths
**As a** vault owner  
**I want** asset references with spaces or non-standard characters to be
written safely in the compiled markdown  
**So that** links remain valid in the exported document.

**Acceptance criteria**
- Asset filenames containing spaces or non-standard characters are handled by
  the normalization defined in US-2.5 (spaces → `_`, lowercased) before the file
  is copied to disk.
- The compiled markdown reference uses the normalized filename produced by US-2.5;
  `%20` percent-encoding is **not** used in compiled references when normalization
  is applied.
- Any character that cannot be represented as a valid cross-platform filename
  character is replaced with `_`.

### US-2.5 Normalize copied asset filenames
**As a** vault owner  
**I want** copied asset filenames to be normalized and predictable  
**So that** links and filesystem assets remain consistent across platforms.

**Acceptance criteria**
- Copied asset basenames are lowercased.
- Spaces and other non-standard characters are replaced with `_`.
- File extensions are lowercased.
- Compiled markdown links use the normalized filename.
- Original source filenames are preserved by deduplication tracking.

### US-2.6 Images from the web, and image titles
**As a** vault owner  
**I want** images embedded from a web address to stay in the compiled
document, and image titles to be kept  
**So that** no picture disappears from the document.

*(Written 2026-10-31 from [#94](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/94);
decisions OD-I1 to OD-I3 the same day. Measured with v0.17.1: every form below
was replaced by `<!-- Warning: Missing asset -->` and reported as a missing
asset; `![[https://…]]` by `<!-- Warning: Missing include -->`.)*

Definitions:
- A **web address** starts with `http://` or `https://`, in any case.
- The **destination** of `![alt](…)` is either `<…>` (angle brackets, may
  contain spaces) or the text up to the first space; it may be followed by a
  **title** in `"…"` or `'…'`.

**Acceptance criteria**
- **AC-1 Web images stay as written (OD-I1).** `![alt](destination)` with a
  web address is kept exactly as written, without a warning and without
  copying anything:
  - `![logo](https://example.com/x.png)`, `![logo](http://example.com/x.png)`,
    `![logo](HTTPS://example.com/x.png)`, `![](https://example.com/x.png)`;
  - `![logo](https://example.com/x.png?size=2&v=1)`,
    `![logo](https://example.com/a%20b.png)`,
    `![logo](<https://example.com/a b.png>)`,
    `![logo](https://example.com/x.png "Logo")`;
  - inside a sentence: `Look: ![logo](https://example.com/x.png) here.` stays.
- **AC-2 Wiki embeds of a web address (OD-I2).** `![[https://example.com/x.png]]`
  becomes `![](https://example.com/x.png)`; an alias becomes the alt text, as
  for local images (`![[pic.png|200]]` → `![200](assets/pic.png)`):
  `![[https://example.com/x.png|200]]` → `![200](https://example.com/x.png)`.
  No warning.
- **AC-3 Titles are kept (OD-I3).** A local image with a title is copied like
  one without, and the title is kept as written after the new path:
  - `![logo](pic.png "Logo")` → `![logo](assets/pic.png "Logo")`;
  - `![logo](pic.png 'Logo')` → `![logo](assets/pic.png 'Logo')`;
  - `![x](<my pic.png>)` → `![x](assets/my_pic.png)` (US-2.5 names);
  - missing: `![x](gone.png "T")` → `<!-- Warning: Missing asset -->`, reported
    with link `gone.png`.
- **AC-4 One parser.** Every step that reads an image's destination — the
  scan for explicit embeds, the ToC classification (US-1.3) and the embedding —
  uses the same rule, so a title or angle brackets never make a note or file
  unrecognised in one step and recognised in another.
  - `![A](A.md "the note")` embeds note `A`.
  - The same embed above the list `- [[A]]` / `- [[B]]`: `A` counts as
    already embedded (US-1.3 AC-5), so it appears once and the item stays a
    link.
- **AC-5 In lists** see US-1.3 AC-2: a list item that embeds an image keeps
  its bullet.

**Decisions (2026-10-31)**
- **OD-I1:** web images are kept as written, without a warning (not with a
  warning, not removed).
- **OD-I2:** `![[url]]` becomes `![](url)` (not kept as written, not removed).
  Not measured: whether Obsidian itself shows `![[url]]` as an image.
- **OD-I3:** the title of a local image is kept (not dropped).

## Epic 3 — Link resolution challenge

### US-3.1 Resolve absolute, relative and magic links
**As a** vault owner  
**I want** the compiler to handle absolute paths, relative paths and bare
filenames  
**So that** every vault link style resolves correctly.

**Acceptance criteria**
- Absolute links are resolved from the vault root.
- Relative links (`../../folder/file.md`, spaces encoded as `%20`) are
  normalized.
- A "magic" bare filename resolves to the unique file with that name anywhere
  in the vault tree.
- When more than one file shares a name, the lexicographically smallest full
  path wins, with a warning logged.
- Heading anchors (`File#Heading` and `#Heading`) are resolved within the
  target file by matching the heading text case-insensitively after stripping
  leading `#` characters and collapsing whitespace. A heading anchor that does
  not match any heading in the target file is reported as a missing reference.
  How links to a heading are written in the output: US-2.3 AC-4 and AC-5.
- A `%` in a link or embed is decoded only where it starts an escape
  (`%20`, `%25`, `%C3%A9`); any other `%` is taken as written *(added
  2026-11-01, [#101](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/101); v0.18.0 aborted the whole compilation with
  "URI malformed")*:
  `[[50% off]]`, `![[50% off]]` and `[x](50%25%20off.md)` find `50% off.md`;
  `[[Note#50% off]]` finds `## 50% off`; `[x](50%%20off.md)` (a lone `%`
  before an escape) finds `50% off.md`; `![x](50%.png)` finds `50%.png`
  and becomes `![x](assets/50.png)` (the name rule of US-2.5).
- **Output folder** *(added 2026-11-07 for
  [#108](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/108);
  measured: compiled output inside a vault made every exported image name
  ambiguous)*. The output folder is output only. Files in the vault folder
  named by the `outputFolder` setting, and in its subfolders, don't exist for
  link resolution: all files, not only images. The same holds for the folder
  the export prompt sets for one run (US-7.3 AC-3). A link that finds its
  file only there is reported as missing; when Obsidian's lookup (US-0.4)
  returns a file there, the compiler resolves again among the other files.
  An empty `outputFolder` (the vault root) excludes nothing, and neither does
  a folder outside the vault. The folder comes from the setting, never from
  its name. Examples (`outputFolder: Out`):
  - `images/hare.png` and `Out/assets/hare.png` → `![[hare.png]]` gives
    `![](assets/hare.png)` from `images/hare.png`, with no ambiguity warning.
  - only `Out/assets/hare.png` → `Missing include`.
  - `[[compiledtext]]` with only `Out/compiledtext.md` → missing.
  - `Out/Run/assets/x.png` → ignored too.
  - the prompt sets `Drafts` for one run → `Drafts/` and `Out/` are both
    ignored in that run.
  - `outputFolder` empty → nothing is ignored; output unchanged.

## Epic 4 — TextMapper diagrams

### US-4.1 Render text-mapper blocks as images
**As a** vault owner  
**I want** text-mapper code blocks to be rendered to PNG and embedded as images  
**So that** hex-map diagrams survive the compilation process intact.

**Acceptance criteria**
- Blocks fenced as ` ```text-mapper ` are detected throughout the compiled
  document tree.
- Each unique block (identified by content hash) is rendered once; identical
  blocks in different files reuse the same output image.
- Rendered images are stored under `assets/textmapper/`, named from the
  content hash and the font key (US-4.8 AC-6).
- The fenced block is replaced by a standard markdown image reference pointing
  to the rendered file, with the alt text of US-4.11 (empty unless the map
  sets a caption).
- If rendering is disabled in plugin settings, or if the block cannot be
  rendered for any reason, the original fenced block is preserved in the output
  together with a warning comment.

### US-4.2 Use the installed text-mapper plugin as the rendering engine
**As a** vault owner  
**I want** the compiler to use the Text Mapper community plugin that is
already installed in my vault as its rendering engine  
**So that** compiled maps look like what I see while editing in Obsidian.

*(Rewritten 2026-10-27: the compiler used the npm package `text-mapper`
0.1.10, whose maps had a cream background, no hex outlines, a serif font and
labels like `Fog Mantle|Fog Mantle`.)*

Behaviour of the plugin (Text Mapper v1.1.0, plugin id `text-mapper`, MIT) read
from its `main.js` and `src/` on 2026-10-27; **not yet measured in Obsidian**
(M-check of v0.14.0):
- `processMarkdown(source, el, ctx)` creates a render child whose constructor
  draws one `<svg>` into a new `div.textmapper` inside `el`, at once; on a parse
  error it adds an error element instead of an `<svg>`.
- It always appends its built-in Gnomeyland and Apocalypse definitions to the
  source. Gnomeyland's `default attributes fill="none" stroke="black"
  stroke-width="3"` draws the black hex outlines.
- The first child of the `<svg>` after its header is a background
  `<rect … fill="white">` covering the whole `viewBox`.
- A label `"A|B"` is split on `|`; the map shows `B` and links to `A`
  (corrected 2026-10-27; it said "shows `A`" before, which only looked right
  because the vault's labels repeat the same text on both sides).
- No `font-family` is set anywhere; in Obsidian the text inherits the note font.

**Acceptance criteria**
- **AC-1 Engine.** At compile time the compiler takes
  `app.plugins.plugins['text-mapper']`, which is present only when the plugin is
  installed and enabled.
- **AC-2 Call.** For each map it creates a `div` that is never attached to the
  document, calls `processMarkdown(source, div, ctx)` with
  `ctx = { docId: 'vault-compiler-<content hash>', addChild() {} }`, awaits it,
  and takes the first `<svg>` inside the `div`. No `<svg>` means a render
  failure (US-4.1 placeholder plus warning).
- **AC-3 Same drawing as in Obsidian.** Everything the plugin draws is kept:
  hex fills, black outlines, path outlines, coordinates as `0402`, labels.
  Example — the Seasonal Charms map (`0403 seasonalcharms "Fog Mantle|Fog Mantle "`)
  shows hex `0403` with a black outline, the label `Fog Mantle` (not
  `Fog Mantle|Fog Mantle`) and the green, pink and orange path outlines.
- **AC-4 Two changes on purpose.** Before drawing the PNG:
  - the plugin's background `<rect>` (the first `rect` child of the `<svg>`
    whose `fill` is `white` and whose `x`, `y`, `width`, `height` equal the
    `viewBox`) is removed, so the PNG background is transparent; no other
    `rect` is touched;
  - the root `<svg>` gets `style="font-family: <map font>"` (US-4.8).
- **AC-5 Plugin missing or disabled.** No map is drawn: each block becomes the
  US-4.1 placeholder with the warning
  `TextMapper plugin is not installed or enabled`, and one notice per compile
  says so. There is no fallback renderer (decided 2026-10-27; US-4.3 withdrawn).
- **AC-6** The compiler never modifies, patches or copies the plugin.

### US-4.3 Bundle a fallback copy of the TextMapper parser — withdrawn
*(Withdrawn 2026-10-27: without the installed plugin, maps become placeholders
(US-4.2 AC-5). The npm package `text-mapper` and the bundled terrain files
`plugin/resources/*.txt` are removed.)*

### US-4.4 Render SVG in-memory without Node.js filesystem access
**As a** developer  
**I want** the TextMapper rendering pipeline to operate entirely in memory
using DOM APIs  
**So that** the compiler works on mobile Obsidian and does not leave temporary
files on disk.

**Acceptance criteria**
- **AC-1** The rendering module does not use `require`, `window.require`,
  `fs`, `os` or `path`, and writes no temporary files.
- **AC-2** The `<svg>` is turned into text with `XMLSerializer`, so the text
  carries `xmlns="http://www.w3.org/2000/svg"` and loads as an image.
- **AC-3** The `div` the plugin draws into and the canvas are never attached
  to the document.
- **AC-4** Rendering works on mobile; `isDesktopOnly` stays `false`.

### US-4.5 Convert rendered SVG to PNG with correct dimensions
**As a** vault owner  
**I want** rendered text-mapper PNGs to have the correct aspect ratio and
resolution  
**So that** maps are not distorted or cropped when embedded in the compiled
document.

**Acceptance criteria**
- Before rasterising, the compiler reads the `viewBox` or `width`/`height`
  attributes from the generated SVG element to determine the natural aspect
  ratio of the map.
- The output PNG is sized so that its longer dimension is at most 2048 px and
  the aspect ratio matches the SVG exactly; neither dimension is fixed at a
  constant (e.g. 1024 x 1024).
- Rasterisation uses the browser canvas API (`drawImage` on a `<canvas>`);
  no external image-conversion library is required.
- The canvas is created and discarded in memory; it is never appended to the
  visible document.

### US-4.6 `include` lines and terrain with the plugin engine
*(Rewritten 2026-10-27.)*

**Acceptance criteria**
- **AC-1** The block source is passed to the plugin unchanged, `include`
  lines included.
- **AC-2** The plugin ignores `include` lines and always provides Gnomeyland and
  Apocalypse; the `traveller` and `default` libraries are not available.
  Measured 2026-10-27: none of the 30 text-mapper blocks in the example vault
  has an `include` line.

### US-4.7 Deduplicate identical text-mapper renders across files
**As a** vault owner  
**I want** a text-mapper block that appears in more than one source file to
produce only one PNG in the output  
**So that** the assets directory is not filled with duplicate images.

**Acceptance criteria**
- The content hash of each block's source text is used as the deduplication
  key, consistent with the general asset deduplication described in the asset
  handling user stories.
- A second occurrence of the same block in the compilation tree reuses the
  image reference produced for the first occurrence and does not trigger a
  second render call.
- The final report (US-6.2) includes the count of deduplicated text-mapper
  renders.

### US-4.8 Map font
**As a** vault owner  
**I want** to choose the font of the text in compiled maps, defaulting to the
font Obsidian draws my maps in  
**So that** compiled maps match what I see, or my print layout.

*(Added 2026-10-27 in v0.14.0; AC-2 to AC-6 rewritten the same day after
M14: v0.14.0 put Obsidian's font list `"??", its-Bookerly, Bookerly, Inter` in
the map, but none of those fonts is installed on the system, so the PNG fell
back to Times. Inter is defined only inside Obsidian (`@font-face` with
`url("public/fonts/….woff2")`), and Bookerly has no `@font-face` at all, so
Obsidian itself draws the maps in Inter. Measured in Obsidian's console.)*

**Acceptance criteria**
- **AC-1 Setting.** The settings tab has a text field "Map font", empty by
  default. Its value is read when a compile starts.
- **AC-2 The font list.** A value is used as written (trimmed); an empty field
  means the computed `font-family` of a `.markdown-rendered` element, the list
  the plugin's maps inherit in Obsidian. If the list has no generic family
  (`serif`, `sans-serif`, `monospace`, `cursive`, `fantasy`, `system-ui`,
  `ui-serif`, `ui-sans-serif`, `ui-monospace`, `ui-rounded`, `math`, `emoji`,
  `fangsong`), `, sans-serif` is appended. Nothing readable gives `sans-serif`.
  - Empty, Obsidian list `"??", its-Bookerly, Bookerly, Inter` →
    `"??", its-Bookerly, Bookerly, Inter, sans-serif`.
  - `Georgia, serif` → `Georgia, serif` (has a generic family).
  - `Georgia` → `Georgia, sans-serif`.
- **AC-3 Fonts Obsidian defines are embedded.** For every family in the list,
  every `@font-face` rule in Obsidian's style sheets with that family name
  (compared without quotes, ignoring case) and a non-empty `src` is copied
  into a `<style>` element that becomes the first child of the map's root
  `<svg>`. Its `font-weight`, `font-style`, `font-stretch` and
  `unicode-range` are kept; each `url(…)` is replaced by a `data:` URL:
  `data:` sources as they are, other sources read with `fetch` relative to
  their style sheet (or the document) and encoded as base64 with the type from
  the file extension (`woff2` → `font/woff2`, `woff` → `font/woff`, `ttf` →
  `font/ttf`, `otf` → `font/otf`).
  - Empty field in the example vault: the two `Inter` faces
    (`public/fonts/c504db5c06caaf7cdfba.woff2`, `public/fonts/01dcbad1bac635f9c9cd.woff2`)
    are embedded; the PNG shows Inter, like Obsidian. *(Measured 2026-10-27, M14
    retest of v0.14.1: same sans-serif as in Obsidian, no notice.)*
  - `Georgia, serif`: no rule has these names, nothing is embedded, and the
    system's Georgia is used (measured 2026-10-27 with v0.14.0).
  - The `"??"` rule (empty `src`) is never embedded.
- **AC-4 A font that cannot be read.** A face whose file cannot be fetched is
  left out; the map is still drawn with the rest of the list, and one notice
  per compile names the family:
  `Vault Compiler: map font "Inter" could not be embedded; maps use the next font in the list.`
- **AC-5 Once per compile.** The list and the embedded fonts are worked out
  once when the compile starts and used for every map of that compile.
- **AC-6 The font is part of the PNG name.** A map PNG is named
  `<content hash>_<font key>.png`, where the font key is the content hash of
  the font list of AC-2, so a different font gives new files and an existing
  PNG is never shown with an old font.
  - `Georgia, serif` → key `2cb44a0b`, e.g. `assets/textmapper/4df49e48_2cb44a0b.png`.
  - Empty field in the example vault → key `4c39c34`.
  - Identical maps in one compile still share one PNG (US-4.7).
  - Without a font key (the compiler used outside the plugin, e.g. in tests)
    the name stays `<content hash>_0001.png`.
  *(Measured 2026-10-27, v0.14.0: a second compile into the same folder with
  a new font kept all 10 PNGs from the first compile, so the change did not
  show.)*

### US-4.9 Tidy map labels in compiled maps
**As a** vault owner  
**I want** compiled maps without hex numbers, with each label centred in its
hex and broken into lines where it would not fit  
**So that** labels like "Moss Germinations" stay inside their hex in print.

*(Written 2026-10-27; decisions OD-L1 to OD-L3 taken the same day, see the
end of the story.)*

Only the compiled PNG changes; maps inside Obsidian stay as the plugin draws
them. The plugin is not modified, forked or copied: the compiler changes the
SVG the plugin returns, before it becomes a PNG (like US-4.2 AC-4).

What the plugin draws (Text Mapper v1.1.0, read from its source on 2026-10-27;
confirmed in Obsidian by M15 the same day):
- Hex centre of hex `XXYY`, default (flat-top) maps: `x = XX × 150`,
  `y = YY × 173.2 − (XX odd ? 86.6 : 0)`. Hex 0402 → (600, 346.4); hex 0503 →
  (750, 433.0). The hex is 200 wide at its centre and 173.2 high; its corners
  are (±100, 0) and (±50, ±86.6) around the centre.
- With `option horizontal` (pointy-top) the offsets are 58 instead of 69.3 and
  the hex is 173.2 wide.
- Hex numbers: one `<g id="coordinates-<map id>">` with one `<text>` per hex at
  `y = centre − 69.3` (flat-top), e.g. `<text … x="600.0" y="277.1">0402</text>`.
- Labels: one `<g id="labels-<map id>">`; per labelled hex a `<g>` with two
  `<text>` elements at `x = centre`, `y = centre + 69.3`: first the glow
  (`stroke="white" stroke-width="5pt"`), then the label; a label written
  `"Link|Label"` has its second `<text>` inside an `<a href="Link">`. Both
  carry `font-size="20pt"` (26.7 units) and `dy="5px"` unless the label has
  its own size (`"Moss" 14`). *(Corrected 2026-10-31, SCAR-037: it said "unless
  the map sets its own label attributes or a size per label"; a map's own
  `label …` line has no effect, because the plugin's Gnomeyland `label` line
  comes after it — measured with the plugin's code in Node, see US-4.10.)*

**Acceptance criteria**
- **AC-1 Hex numbers removed.** The `coordinates-<map id>` group is removed
  with everything in it; nothing else changes.
  - Hex 0402: `<text … y="277.1">0402</text>` is gone; the hex, its fill, its
    outline and its label stay.
- **AC-2 Labels centred.** Each label group (glow and label alike) is moved so
  its block of lines is centred on the hex centre: with `n` lines of line
  height `L`, line `k` (from 1) gets `y = centre + (k − (n + 1) / 2) × L`;
  `x` stays the centre. `dy`, font and size attributes are kept.
  - One line, hex 0402: `y` 415.7 → 346.4.
  - Two lines, `L` = 1.2 × font size = 32 at 20pt (OD-L3): `y` 330.4 and 362.4.
- **AC-3 Line breaks at spaces.** A label wider than the line width `W` is
  split at spaces: words are added to a line while the line, measured with the
  map font (US-4.8) and the label's own size, is at most `W`; the next word
  starts a new line. Lines are written as `<tspan x="<centre>" y="…">` inside
  both the glow and the label text, so the white glow stays behind every line.
  - `W` = 80 % of the hex width at its centre: 160 for flat-top hexes, 138.6
    for pointy-top (OD-L3).
  - Measured widths (example, at 20pt) `Moss` 55, `Germinations` 150,
    `Moss Germinations` 212: two lines, `Moss` / `Germinations`.
  - `Fog Lantern`, 135 wide: one line, unchanged apart from AC-2.
  - `Under the Brambles` with `Under the` 120 and `Under the Brambles` 230:
    `Under the` / `Brambles`.
- **AC-4 A word wider than `W` is hyphenated** (OD-L2). Its first part is the
  longest prefix that fits on a line of its own — measured with the hyphen it
  gets — keeping at least 2 characters on each side; the rest of the word
  carries on as the next word (and is split again if still too wide).
  - If the word already contains `-` or `&` and the part up to and including
    it fits, it breaks there instead, without adding a hyphen.
  - `Unpredictable` with widths `Unpredict-` 150 and `Unpredicta-` 162 →
    `Unpredict-` / `able`.
  - `Polish&Transplant` with `Polish&` 105 → `Polish&` / `Transplant`.
  - `Germinations` at 150 fits whole and is not hyphenated.
  - A word whose first 2 characters plus a hyphen are already wider than `W`
    (only possible with a huge label size) is left whole, and the compile
    warns once per map.
  - Text is measured unescaped and written escaped (`&` → `&amp;`).
- **AC-5 Linked labels.** For `"Link|Label"` the `<a href="Link">` stays
  around the label's `<text>`; only the text inside is split into lines.
- **AC-6 Unknown structure.** If a map has no `coordinates-` or `labels-` group
  of the shape above (a different plugin version), that step is skipped for the
  map and one notice per compile says so; the map is never drawn half-changed.
  - An empty group is the right shape, also as `XMLSerializer` writes it,
    self-closed: a map without labels has `<g id="labels-<map id>"/>`;
    nothing is tidied and nothing is reported. *(Added 2026-10-31: the
    unit test used `<g id="labels-…"></g>`, which the serialiser never
    writes, and the code reported such maps as "not tidied" — SCAR-023;
    found while writing the tests for US-4.10. The serialiser's form comes
    from the DOM serialisation rules and the plugin's code run in Node, not
    measured in Obsidian.)*
- **AC-7 Setting.** One toggle "Tidy map labels", on by default, switches
  AC-1 to AC-6 together; off gives the maps of v0.14.2 (OD-L1). Tests and the
  manual check cover both values.
- **AC-8** The map in Obsidian (reading and editing view) is unchanged.
- **AC-9 The PNG name records tidying.** With "Tidy map labels" on, the key in
  the PNG name (US-4.8 AC-6) gets a `t` appended: `Georgia, serif` →
  `4df49e48_2cb44a0bt.png`; off → `4df49e48_2cb44a0b.png`, as in v0.14. So a
  compile never shows an untidied PNG from an earlier compile, or the other
  way round. *(Added 2026-10-27 while coding: the same kind of stale PNG as
  the font finding of M14.)*

**Decisions (2026-10-27)**
- **OD-L1:** one toggle "Tidy map labels", on by default (not three toggles,
  not always on).
- **OD-L2:** a word wider than a line is hyphenated (not left as is, not
  shrunk). The break after an existing `-` or `&` is a refinement added when
  writing the rule; the vault's longest map words are `Polish&Transplant`,
  `Unpredictable`, `Exasperating`, `Overgenerous`, `Germinations`.
- **OD-L3:** `W` = 80 % of the hex width at its centre, line height 1.2 × font
  size, fixed (not settings); to be checked by eye in M15.

**Not measured yet:** the plugin's SVG structure inside Obsidian, and text
widths, which depend on the map font — measured with the canvas in Obsidian at
compile time. The examples' widths are illustrations for the rule, not
measurements.

### US-4.10 Map directives: no hex outlines, no label glow
**As a** vault owner  
**I want** to switch off, per map, the black hex outlines and the white glow
behind labels in the compiled PNG  
**So that** maps drawn in my own style (coloured outlines, symbols, a paper
page behind them) — for example a skill tree of hex clusters — print without
the plugin's black grid and white halos.

*(Written 2026-10-31 after a prototype, see "Measured" below. Decisions OD-D1
to OD-D3 taken the same day.)*

Only the compiled PNG changes; the plugin is not modified, and the map in
Obsidian stays as the plugin draws it (like US-4.9).

What the plugin does (Text Mapper v1.1.0). **Measured 2026-10-31** by running
the plugin's own `main.js` in Node with a minimal DOM stand-in, not in
Obsidian:
- The plugin appends Gnomeyland and Apocalypse *after* the map source, and the
  last definition wins. So the map's own `default attributes …`, `glow …` and
  `label …` lines have no effect: source
  `default attributes fill="none" stroke="red" stroke-width="9"` /
  `glow stroke="blue" stroke-width="1pt"` / `0101 "Moss"` still gives
  `stroke="black" stroke-width="3"` outlines and a
  `stroke="white" stroke-width="5pt"` glow. The same holds for a type the map
  defines under a Gnomeyland name: `red attributes stroke="#c4574f"` is
  replaced by Gnomeyland's debug type `red` (`fill="red" … scale(0.5)`).
- Hex outlines: one `<g id="regions-<map id>">` with one
  `<polygon fill="none" stroke="black" stroke-width="3" id="hex.X.Y-<map id>" points="…">`
  per hex that has at least one type or label, drawn after the hex fills
  (`backgrounds-`), paths (`paths-`) and symbols (`things-`), so it lies on top
  of them.
- Glow: every entry of `labels-<map id>` and of `path-labels-<map id>` is a
  `<g>` holding first the glow `<text … stroke="white" stroke-width="5pt">`,
  then the label `<text>`; a hex label written `"Link|Label"` has the label
  `<text>` inside `<a href="Link">`, the glow outside it. A path label's two
  texts each hold a `<textPath href="#path-N-<map id>">`.
- A line that begins with `#` is skipped: the SVG for
  `# vault-compiler: no-glow` / `0101 "Fog Lantern|Lantern"` equals the SVG
  without the first line.

**Acceptance criteria**
- **AC-1 Directive line.** A line of the map source whose first character is
  `#`, followed by optional spaces, `vault-compiler:` (letters in any case) and
  a list of words separated by spaces, is a directive line. Words are compared
  ignoring case. A map may have several directive lines anywhere in its
  source; their words add up.
  - `# vault-compiler: no-outlines no-glow` → both switches.
  - `# vault-compiler: no-outlines` and, three lines later,
    `#Vault-Compiler: NO-GLOW` → both switches.
  - `  # vault-compiler: no-glow` (leading spaces) is not a directive line:
    nothing is switched and nothing is reported.
  - `# vault compiler: no-glow` (no hyphen) is an ordinary comment.
  - The word `caption` ends the list: the rest of the line is the map's
    caption, not words (US-4.11, added 2026-11-10).
- **AC-2 Unknown word.** A word other than `no-outlines` and `no-glow` is
  ignored; the compile warns once per map block and word, in the report
  (US-6.2) as `{ message: 'Map directive "no-outline" is unknown and was ignored',
  link: 'no-outline', file: <note path>, line: 0 }` (line 0 like the other
  map warnings). `no-outlines,no-glow` is one unknown word.
  - `# vault-compiler: no-outline` / `# vault-compiler: no-outline` in one
    block of `index2compile.md` → one warning.
  - The same block in `a.md` and `b.md` → two warnings, one per file; the map
    is still drawn once (US-4.7).
  - `# vault-compiler:` with no words → nothing switched, no warning.
- **AC-3 `no-outlines`.** The `regions-<map id>` group is removed with
  everything in it; nothing else changes.
  - Map `# vault-compiler: no-outlines` / `0101 skill-moss "Moss"` /
    `0102 skill-moss "Fern"`: both `<polygon … stroke="black" stroke-width="3" id="hex.1.1-…">`
    and `id="hex.1.2-…"` are gone; the `skill-moss` hex polygons in
    `backgrounds-`, any symbols in `things-` and both labels stay.
- **AC-4 `no-glow`.** In every entry of `labels-<map id>` and
  `path-labels-<map id>`, the first `<text>` (the glow) is removed; the label
  `<text>`, its `<a>` and its `<textPath>` stay.
  - Hex `0101 "Moss"`: `<g><text … stroke="white" stroke-width="5pt">Moss</text><text …>Moss</text></g>`
    → `<g><text …>Moss</text></g>`.
  - Linked `0101 "Fog Lantern|Lantern"`: the glow `<text>` before the `<a>`
    is removed; `<a href="Fog Lantern"><text …>Lantern</text></a>` stays.
  - Path label `0101-0103 trail "Old Road"`: the `<text>` with
    `stroke="white"` is removed; the second `<text><textPath href="#path-1-…">Old Road</textPath></text>`
    stays.
- **AC-5 Each switch alone.** The four combinations, map `0101 forest "Peak"`
  plus a directive line:
  - none → outline and glow (the PNG of today);
  - `no-outlines` → glow kept, no outline;
  - `no-glow` → outline kept, no glow;
  - `no-outlines no-glow` → neither.
- **AC-6 With "Tidy map labels" (US-4.9).** Tidying runs first, then
  `no-glow`, so the label keeps its lines, position and `<tspan>`s.
  - Tidy on, `no-glow`, label `"Moss Germinations"` (two lines, US-4.9 AC-3):
    one `<text>` with `<tspan>Moss</tspan><tspan>Germinations</tspan>`, centred
    on the hex; no glow `<text>`.
  - Tidy off, `no-glow`: one `<text>` at the plugin's position
    (`y = centre + 69.3`), one line.
  - `no-outlines` does not depend on tidying: tidy on and off both lose the
    `regions-` group.
- **AC-7 Unknown structure.** If a switched-on step finds no group of the
  shape above (a different plugin version): for `no-outlines`, no
  `regions-<map id>` group; for `no-glow`, a `labels-`/`path-labels-` group
  missing, or an entry whose first child is not a `<text>` with
  `stroke="white"` — that step is skipped for the whole map (no glow removed
  in that map, not some), and one notice per compile says
  `Vault Compiler: map directive "no-glow" could not be applied; the map is drawn as the plugin made it.`
  An empty group (a map without labels) is the right shape: nothing to remove,
  no notice.
- **AC-8 What stays.** The changes of US-4.2 AC-4 (background `<rect>`
  removed, map font) and US-4.9 apply as before; a map without a directive
  line gives the same PNG, byte for byte, as before this story.
- **AC-9 PNG name.** No new key letter: the directive line is part of the map
  source, so its content hash (US-4.1, US-4.8 AC-6) already differs from the
  same map without it.
  - `0101 forest "Peak"` and `# vault-compiler: no-glow` / `0101 forest "Peak"`
    give two different PNG names; two maps with the same directive and
    source share one PNG (US-4.7).
- **AC-10 Map not drawn.** When TextMapper rendering is off or the plugin is
  missing (US-4.1, US-4.2 AC-5), the block is kept with its directive line, as
  every other line.
- **AC-11** The map in Obsidian (reading and editing view) is unchanged
  (measured in Node; to be confirmed in Obsidian by the manual check).

**Fixture.** A new fixture note with a skill-tree map in invented words — one
cluster of seven hexes in a custom type with a coloured outline, a checkbox
and checkmark symbol, one linked label, one path label, and the directive
`# vault-compiler: no-outlines no-glow` — and the existing `region-map.md`
without directives, compiled together. Custom type names do not collide with
Gnomeyland or Apocalypse names (see above).

**Decisions (2026-10-31)**
- **OD-D1:** a line in the map switches the edits on, per map — not a plugin
  setting and not both. Measured before the choice: with both edits applied
  to every map, the fixture's `region-map.md` loses its hex grid and the label
  `Peak` is hard to read over the mountain symbol.
- **OD-D2:** two switches, `no-outlines` and `no-glow`, not one "plain style".
  The glow is what keeps a label readable over a symbol.
- **OD-D3:** written as a `#` comment, `# vault-compiler: …`, not as
  `option no-outlines`: the plugin skips comments, while a later plugin
  version could give an `option` name a meaning of its own.

**Measured (2026-10-31, prototype, in the scratchpad, not in the
repository).** A cluster of seven hexes in a custom type with a filtered
coloured outline, symbols for a checkbox, a checkmark, a watercolour splash and
a small sub-label, rendered through the plugin's `main.js` in Node and drawn
with `rsvg-convert`. With the plugin's outlines and glow it showed a black grid
next to the coloured one and white halos; with both removed it matched the
target design. Filters in the map need `option global`, because the plugin
renames ids (`rough` → `rough-<map id>`) but not `url(#rough)` references.

**Not measured yet:** all of the above inside Obsidian (SVG structure, the
directive line in reading view), and SVG filters drawn through Obsidian's
canvas (US-4.5).

### US-4.11 Map caption: none unless the map sets one
*(Written 2026-11-10 from
[#119](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/119);
decided the same day: no label by default; the caption is set by a
directive line, `# vault-compiler: caption …`.)*

**As a** vault owner
**I want** a compiled map to carry no label unless I give it one in the map
**So that** a typesetter downstream does not print an arbitrary hex label as
the map's caption.

The reader of the label is Obsidian2Typst (SCAR-040). Its US-003 AC-1 (read
there, 2026-11-10, not measured here): an image with alt text becomes a
figure with that caption; an image without alt text gets no caption. Its
AC-1b: a `|` in the alt text ends the caption (the part after it is a size
or ignored).

Today (v0.23.0, `altForTextMapper`, specified in no story): the alt text is
the label of the first labelled hex (`0402 grass "Fog Lantern|Fog Lantern "`
→ `![Fog Lantern|Fog Lantern ](assets/textmapper/<hash>_0001.png)`, so
Obsidian2Typst prints `Fog Lantern` under the map); else `<file> Map` from an
`include <file>.txt` line; else `TextMapper Map`.

What the plugin does with a caption line (Text Mapper v1.1.0): both passes
of `TextMapperParser.process` in its `main.js` skip every line for which
`line.startsWith("#")` (read 2026-11-10); measured for
`# vault-compiler: no-glow` in US-4.10 (the SVG equals the one without the
line). A caption line has the same first character, so the map in Obsidian
does not change.

**Acceptance criteria**

- **AC-1 No label by default.** Every map without a caption line is written
  as `![](assets/textmapper/<hash>_<key>.png)`, whatever its source holds:
  - `0402 grass "Fog Lantern|Fog Lantern "` → `![](…)` (was
    `![Fog Lantern|Fog Lantern ](…)`).
  - `include gnomeyland.txt` / `0101 forest` → `![](…)` (was
    `![gnomeyland Map](…)`).
  - `0101 forest` → `![](…)` (was `![TextMapper Map](…)`).
- **AC-2 Caption line.** In a directive line (US-4.10 AC-1: `#` in the first
  column, optional spaces, `vault-compiler:` in any case), the word
  `caption` (any case) ends the list of words; the rest of the line,
  trimmed, is the caption, written as given:
  - `# vault-compiler: caption Branches of the fighting skills` /
    `0101 forest "Moss"` → `![Branches of the fighting skills](…)`.
  - `#Vault-Compiler: CAPTION Mixed Case Kept` → `![Mixed Case Kept](…)`.
  - `# vault-compiler: no-glow caption Moss and Stone` → no glow (US-4.10)
    and `![Moss and Stone](…)`; no unknown-word warning for `Moss`, `and`,
    `Stone`.
  - `# vault-compiler: caption` (nothing after it) → `![](…)`, no warning.
  - `  # vault-compiler: caption X` (leading spaces) is not a directive
    line → `![](…)`.
- **AC-3 Characters of the caption.** `\`, `[` and `]` are escaped with a
  backslash so the image stays one image:
  `caption Tree [old] \ path` → `![Tree \[old\] \\ path](…)`. A `|` is
  written as given and reported once per map block, at the opening fence
  (US-8.4 AC-6):
  `{ message: 'Map caption contains "|"; Obsidian2Typst ends the caption there', link: 'Moss | Stone', file, line }`
  for `caption Moss | Stone`.
- **AC-4 One caption per map.** The first caption line counts; a later one
  is ignored and reported once per map block, at the opening fence:
  `{ message: 'Map caption is given more than once; the first is used', link: '<the ignored caption>', file, line }`.
- **AC-5 Composed.** The caption line is part of the source, so the PNG name
  (content hash, US-4.1, US-4.10 AC-9) differs from the same map without it;
  the same map in two notes is drawn once and both places carry the same
  caption (US-4.7). In a quote (US-1.5 AC-9) the line is
  `> ![Caption](…)`. With maps off (US-4.1) the fence is kept as written,
  caption line included. A render failure gives the US-4.1 placeholder,
  without caption.

**Not measured here (SCAR-024):** how Obsidian2Typst prints `\[`, `\]` and
`\\` in a caption; that the plugin in Obsidian draws a map with a caption
line unchanged (manual check).

## Epic 5 — Obsidian control commands

### US-5.1 Remove Obsidian tool control commands
**As a** vault owner  
**I want** Obsidian plugin control blocks and commands to be stripped from the
compiled output  
**So that** the exported document contains only content.

**Acceptance criteria**
- Blocks such as `meta-bind-embed`, `leaflet`, `calendarium`,
  `compressed-json` and similar tool directives are removed.
- Dataview and SerializedQuery fenced code blocks are **stripped entirely** from
  the compiled output. Because the compiler cannot execute Dataview queries at
  compile time, no expansion is attempted and no replacement content is inserted.
- Dataview Serializer plugin commands and generated markers are removed from
  the compiled output rather than emitted as content.
- No plugin-specific markup remains in visible output.
- **AC-F Every fence form** *(added 2026-11-07, G0-B8; measured with v0.21.0
  in the #108 step-0 review)*. The removed languages are one table:
  `dataview`, `dataviewjs`, `meta-bind-embed`, `leaflet`, `calendarium`,
  `compressed-json`. One fence parser (CommonMark) finds each of them, and the
  code copy of US-1.4 uses the same parser:
  - a `~~~dataviewjs` fence → removed (v0.21.0: kept as code);
  - a four-backtick fence holding a three-backtick line → removed whole,
    closed only by a fence of at least four (v0.21.0: a stray ```` `` ````
    line was left);
  - a fence inside a quote, `> ```dataviewjs` … `> ```` → removed with its
    `> ` prefixes, and no empty `>` line is left (v0.21.0: one was);
  - Lede, blank, ```` ```dataviewjs ```` block, blank, `### Signs` → lede,
    one blank line, `### Signs`;
  - with US-9.1 on: title heading, `o2t-entry` block, first body line, in that
    order, wherever the removed block stood.
  - the language is the first word after the fence, compared exactly (in
    lower case): ```` ```dataviewish ```` is kept (v0.21.0 removed it, as a
    prefix match);
  - a block outside a quote leaves one empty line, so `Text.` / block /
    `More.` stay two paragraphs; a block in a quote leaves nothing, and one
    closed by the end of its quote is removed up to that end;
  - an unclosed control block is kept and reported as unclosed (AC-6 of
    US-1.4), so a missing fence never deletes the rest of a note.

### US-5.2 Remove YAML frontmatter
*(Added 2026-10-27, v0.13.0.)*

**As a** vault owner  
**I want** the YAML frontmatter of every note left out of the compiled document  
**So that** note metadata (tags, plugin settings) never shows up as text, list
items or `---` rules in the rulebook.

Measured on 2026-10-27 with v0.12.0: an embedded note
`---` / `tags:` / `  - SeasonalCharms` / `  - Wizardry` / `---` / `Spell text.`
compiled (toggle on) to `# Fog Lantern` followed by the raw YAML lines. The note
counted as a preamble file, so its title went above the `---`. In the example
vault 93 frontmatter blocks (all `tags:` on spell notes) leaked into the
compiled rulebook with either toggle value, adding 186 `---` lines.

**Decision (user, 2026-10-27, measured before it was offered, SCAR-020):** all
frontmatter is dropped; no field (not even `tags`) is carried into the output.
*Amended 2026-11-07:* an **entry note** (US-9.1) keeps its properties,
`tags` included, as an `o2t-entry` block under its title. *Amended 2026-11-09:*
a **detail note** (US-9.5) keeps the properties named in `detailMarkerKeys`, and
only those, as an `o2t-details` block. Every other note is
unchanged, and the frontmatter text itself is never output.
Two other options were measured and declined: a `#LeafCraft #LifeMagic` tag line
under the title, and an italic `*Tags: LeafCraft, LifeMagic*` line.

**Definition.** A note has frontmatter when its **first line** is `---`
(trailing spaces or tabs allowed) and a later line is `---` (trailing spaces or
tabs allowed). The frontmatter is everything from the first line up to and
including the first such closing line and its line break. `\n` and `\r\n` line
breaks are both accepted. A `---` anywhere else is not frontmatter, and a
first-line `---` without a closing line is not frontmatter either.
*Not measured (SCAR-024):* whether Obsidian accepts the same edge cases (a
closing `...`, a byte-order mark, trailing whitespace). The plugin's
`minAppVersion` (1.0.0) is older than Obsidian's own `getFrontMatterInfo`
(1.5.7), so the compiler uses its own rule.

**Acceptance criteria**

- **AC-1 Removed first.** The frontmatter is removed when a note is read,
  before every other rule: TextMapper and control fences (US-4.1, US-5.1), ToC
  expansion (US-1.3), heading-first / preamble / pass-through detection
  (US-6.1, US-6.3 to US-6.5) and section extraction (US-6.3 AC-7). Applies to
  the root file and to every embedded note, with "Normalise headings" on and
  off.
- **AC-2 Preamble note.** Root `![[Fog Lantern.md]]`; `Fog Lantern.md` =
  `---` / `tags:` / `  - SeasonalCharms` / `  - Wizardry` / `---` /
  `Spell text.`
  - On → `# Fog Lantern`, `Spell text.`
  - Off → `## Fog Lantern`, `Spell text.`
  - Neither output contains `tags:`, `SeasonalCharms` or `---`.
- **AC-3 Heading-first note after its frontmatter (US-6.3 AC-6, US-6.1 AC-4).**
  The first heading *after* the frontmatter is the one the title replaces.
  Root `![[1.2 Combat.md]]`; `1.2 Combat.md` = `---` / `tags: [rules]` /
  `---` / `# Fighting` / `## Rounds`.
  - On → `## Combat`, `### Rounds` (no `# Fighting`).
  - Off → `## Combat`, `## Rounds` (no `# Fighting`).
- **AC-4 A YAML comment is not a heading.** `X.md` = `---` /
  `# reviewed 2026` / `tags: [a]` / `---` / `Text.` is a preamble file, and the
  comment is not output. Root `![[X.md]]`: on → `# X`, `Text.`; off → `## X`,
  `Text.`
- **AC-5 Pass-through wrapper (US-6.5).** Frontmatter does not count as the
  wrapper's own content. Root `![[A.md]]`; `A.md` = `---` /
  `tags: [wrapper]` / `---` / `![[B.md]]`; `B.md` = `---` / `tags: [b]` /
  `---` / `# Real Heading` / `Content`.
  - On → `# B`, `Content`; no `# A`. (Without AC-1, `A.md` was a preamble
    file: `# A`, `## B`.)
  - Off → `## A`, `## B`, `Content`.
- **AC-6 Section embed (US-6.3 AC-7).** Root `![[M.md#Leaf Craft]]`; `M.md` =
  `---` / `tags: [magic]` / `---` / `# Magic` / `## Leaf Craft` / `### Spells`.
  - On → `# Leaf Craft`, `## Spells`.
  - Off → `## Leaf Craft`, `### Spells` (as written).
  - A YAML comment with the anchor's text is not the section: with `M.md` =
    `---` / `# Leaf Craft` / `tags: [magic]` / `---` / `# Magic` /
    `## Leaf Craft` / `### Spells`, the output is the same as above and has no
    `tags:`. (Without AC-1 the section started at the comment and took the
    YAML lines with it.)
- **AC-7 Root file (US-6.3 AC-5).** `index.md` = `---` / `title: Rulebook` /
  `---` / `# Rulebook` / `![[1.3.2 Magic.md]]`; `1.3.2 Magic.md` = `# Magic`.
  Output, both toggle values: `# Rulebook`, `### Magic`; the output starts with
  `# Rulebook`.
- **AC-8 Nested.** Root `![[1.2 Sec.md]]`; `1.2 Sec.md` = `---` /
  `tags: [s]` / `---` / `Intro.` / `![[Spell.md]]`; `Spell.md` = `---` /
  `tags: [x]` / `---` / `# Spell heading` / `Text.`
  - On → `## Sec`, `Intro.`, `### Spell`, `Text.`
  - Off → `## Sec`, `Intro.`, `## Spell`, `Text.`
- **AC-9 A list in the frontmatter is not a ToC (US-1.3).** `Y.md` = `---` /
  `up:` / `  - [[Parent]]` / `---` / `Body.`; `Parent.md` = `Parent text.`
  Root `![[Y.md]]` gives `Body.` and no `Parent text.`, with both toggle values.
- **AC-10 Horizontal rules stay.** A `---` that is not frontmatter is kept as
  written, with both toggle values.
  - `Notes.md` = `Intro.` / *(blank)* / `---` / *(blank)* / `More.` → the
    `---` line is in the output.
  - `Notes.md` = `---` / `tags: [x]` / `---` / `Intro.` / *(blank)* / `---` /
    *(blank)* / `More.` → exactly one `---` line in the output, between
    `Intro.` and `More.`
  - `Rule.md` = `---` / `Text after a rule.` (no closing line) → unchanged;
    the `---` is in the output.
  - `Late.md` = *(blank)* / `---` / `tags: x` / `---` / `Text.` (the `---` is
    not on the first line) → not frontmatter; both `---` lines are in the
    output.
- **AC-11 Line endings.** `---\r\ntags: a\r\n---\r\nText.` → `Text.` and no
  `tags:`.
- **AC-12 Warning lines count from the source file (US-8.4).** A warning
  raised for an embed counts the removed frontmatter lines. `Z.md` = `---` /
  `tags: [a]` / `---` / `![[Missing.md]]` → the `Missing include` warning
  names `Z.md`, line 4, with both toggle values. *(v0.12.0 gave line 4 with
  the toggle off and line 5 with it on, because the injected title counted as
  a line.) (Warnings from the passes over the assembled output
  keep their approximate line, as before this story.)*
- **AC-13 Source untouched.** Removal happens on the in-memory copy only; the
  note's file is byte-identical after a compile (US-8.1).

## Epic 6 — Output quality

### US-6.1 Auto-generated headings
**As a** reader  
**I want** each included file to receive a sensible heading derived from its
filename  
**So that** the structure of the original vault is visible.

Applies when "Normalise headings" (US-6.3) is **off**. When it is on, US-6.3
to US-6.5 decide the headings instead (decided 2026-10-27, OD-4).

**Acceptance criteria**
- **AC-1** Every embedded markdown file (not the root file) gets one heading from its
  filename. Its text follows the **title rule** of US-6.4 (prefix and extension
  removed, first letter upper-cased, everything else as written):
  `2.2.2 Third-Level.md` → `Third-Level`; `notes.md` → `Notes`.
- **AC-2** The heading level is the **count of dot-separated segments** in the numeric
  prefix, after trailing `.0` segments are dropped, capped at h6 (decided
  2026-10-27): `1 X.md`, `1.0 X.md`, `10.0 X.md` → h1; `1.1 X.md`, `3.2 X.md` →
  h2; `1.1.1 X.md` → h3; `1.1.1.1 Detail.md` → `#### Detail`.
- **AC-3** An unnumbered filename receives a level-2 heading.
- **AC-4** If the first non-empty line of an included file is itself a heading, that line
  is removed and replaced by the filename heading; otherwise the filename heading
  is put before the content.
  - `1.2 Combat.md` = `# Fighting` / `text` → `## Combat` / `text`.
- **AC-5** The plugin's "off" setting gives this result, exactly as when the
  option is absent. *(Until v0.11.0 it did not: `false` kept every heading as
  written and US-6.1 ran only when the option was absent, which only the tests
  did.)*

### US-6.2 Reporting and statistics
**As a** vault owner  
**I want** a summary after compilation  
**So that** I can verify success and diagnose missing files.

**Acceptance criteria**
- Reports totals for processed files, copied assets, deduplicated references,
  missing files, rendered maps and deduplicated maps.

### US-6.3 Heading normalisation
*(Numbered US-7.1 until 2026-10-27; see "Story ID changes".)*

**As a** vault owner  
**I want** an optional "Normalise headings" toggle in the plugin settings  
**So that** the compiled document has a properly nested heading hierarchy derived
from the filename-based numbering of each embedded file, not from the arbitrary
heading levels authors used inside individual files.

Terms used in US-6.3 to US-6.5:

- **Depth** of a file: the heading level of its title in the output.
  The root (starting) file has depth 0.
- **Parent depth**: the depth of the file that contains the embed.
- **Prefix depth**: the number of dot-separated segments in a numeric filename
  prefix (AC-2).
- **Title**: the heading made from a filename by the title rule of US-6.4.
- **Heading-first file**: its first non-empty line is a heading.
- **Preamble file**: its first non-empty line is not a heading, or it has no
  headings at all (US-6.4).
- **Last original heading**: the output level of the last heading written
  literally in the embedding file above the embed point. Headings brought in by
  earlier embeds and the embedding file's own title do not count. 0 when there
  is none.

Every example below is checked by the integration tests and was produced by
the compiler at v0.11.0 (2026-10-27).

**Acceptance criteria**

- **AC-1 Toggle.** The setting is off by default. When it is on, AC-2 to AC-11,
  US-6.4 and US-6.5 apply to every embedded file and US-6.1 does not. When it is
  off, US-6.1 applies and none of US-6.3 to US-6.5 do (OD-4).
- **AC-2 Prefix depth.** A prefix is a run of digits and dots at the start of
  the basename, followed by a space or the end of the name. Its depth is the
  number of segments; leading zeros do not matter.
  - `1 Title.md` → 1; `1.3 Title.md` → 2; `1.3.2 Title.md` → 3;
    `01.03.02 Title.md` → 3; `Overview.md` → no prefix.
- **AC-3 Prefixed files: depth is absolute.** A prefixed file is placed at its
  prefix depth whichever file embeds it, and whatever headings stand above the
  embed (subject to the floor of AC-9).
  - `1 Overview.md` = `# Overview` + `![[1.3.2 Magic.md]]`;
    `1.3.2 Magic.md` = `# Magic`. Output: `# Overview`, then `### Magic`.
  - Root `# The Rulebook` / `![[1 Player Section.md]]` → `# The Rulebook`,
    `# Player Section` (siblings; the root's heading does not count for
    prefixed files).
- **AC-4 Unprefixed files: one rule for every kind.** Heading-first files,
  preamble files (US-6.4), pass-throughs (US-6.5) and section embeds (AC-7) are
  placed at **last original heading + 1**; when there is no original heading
  above the embed, at **parent depth + 1** (OD-2).
  - Root `# Book` / `## Chapter` / `![[X.md]]` → `### X` for heading-first,
    preamble and wrapper `X.md`, and `### Sec` for `![[X.md#Sec]]`.
  - `1 Overview.md` = `# Overview` + `![[Details.md]]`; `Details.md` =
    `# Details` → `# Overview`, `## Details`.
  - The same `Details.md` embedded from `1.3.2 Magic.md` (no other heading above
    the embed) → `#### Details`.
  - Root `![[X.md]]` with no heading above it → `# X`.
- **AC-5 Root file.** The root file is not normalised: its headings stay as
  written, and its embeds see parent depth 0.
  - Root `# Rulebook` + `![[1.3.2 Magic.md]]` → `# Rulebook`, `### Magic`.
- **AC-6 Title replaces the first heading.** In a heading-first file the first
  heading is replaced by the file's title at the file's depth; every other
  heading shifts by `depth − level of the replaced heading`, keeping their
  relative levels (OD-1).
  - `1.2 Combat.md` = `# Fighting` / `## Rounds` → `## Combat` / `### Rounds`
   .
  - `1.3.2 Magic.md` = `# Magic` / `## Leaf Craft` / `### Spells` → `### Magic` /
    `#### Leaf Craft` / `##### Spells`.
  - `1.2 Multi.md` = `# First` / `# Second` → `## Multi` / `## Second`.
- **AC-7 Section embeds.** For `![[file.md#Heading]]` and
  `![alt](file.md#Heading)` the target's prefix is not consulted and the
  section's heading text is kept. The section's shallowest heading lands at the
  AC-4 depth, moving up or down; the others keep their distance to it (OD-3).
  - `1.2 Rules.md` = `# Rules` + `![[1.3.2 Magic.md#Leaf Craft]]` →
    `## Rules`, `### Leaf Craft`, `#### Spells`.
  - Root `![[M.md#Leaf Craft]]`, `M.md` = `# Magic` / `## Leaf Craft` /
    `### Spells` → `# Leaf Craft`, `## Spells`.
- **AC-8 Ceiling.** A heading that would go past h6 becomes h6, and a
  `WarningDetail` whose message contains `clamped` is recorded. No comment is
  written into the compiled output; the warning list and the warnings logfile
  carry it (OD-5).
  - `1.2.3.4.5.6 Deep.md` = `# Deep` / `## Deeper` → `###### Deep` /
    `###### Deeper`, warning `Heading depth clamped to h6 in 1.2.3.4.5.6 Deep.md`.
- **AC-9 Floor (heading inversion).** A prefixed file whose prefix depth is less
  than parent depth + 1 is placed at parent depth + 1, with a `WarningDetail`
  and no comment in the output.
  - `1.3.2 Magic.md` = `# Magic` + `![[1 Overview.md]]`; `1 Overview.md` =
    `# Overview` → `### Magic`, `#### Overview`, warning
    `Heading depth clamped: 1 Overview.md prefix depth 1 < parent depth 4, clamped to 4`.
- **AC-10 One heading per file.** `1.3.2 Magic.md` = `# Magic` + `Content.`
  gives exactly one `### Magic`.
- **AC-11 Composed nesting.** Each level uses its own rule.
  - Root `![[1 Chapter.md]]`; `1 Chapter.md` = `# Chapter` +
    `![[1.2 Section.md]]`; `1.2 Section.md` = `## Section` +
    `![[1.2.3 Subsection.md]]`; `1.2.3 Subsection.md` = `# Subsection` →
    `# Chapter`, `## Section`, `### Subsection`.
  - `1.2 Sec.md` = `Intro.` / `# Inner` / `![[X.md]]`; `X.md` = `# X head` →
    `## Sec`, `### Inner`, `#### X`.

**Out of scope (for now)**
- Renumbering or rewriting the numeric prefix text in headings.
- Changing the filename-based numbering convention itself.
- Making anchors unique when two embedded files have the same title (OD-7);
  links to such headings follow US-2.3 AC-6.

### US-6.4 Preamble heading injection
*(Specified only in the ticket backlog as "US-7.2" until 2026-10-27.)*

**As a** vault owner  
**I want** an embedded file that does not start with a heading to get a heading
from its filename when headings are normalised  
**So that** every embedded file opens its own section in the compiled document.

Applies only when US-6.3 is on. Not applied to the root file.

**Title rule** (used by US-6.1, US-6.3, US-6.4, US-6.5 and by link labels and
anchors, US-2.3): the basename with the numeric prefix (and its space) and the
extension removed, first letter upper-cased, everything else kept as written.
`2.2.2 Third-Level.md` → `Third-Level`; `1.2 my-file_name.md` → `My-file_name`;
`notes.md` → `Notes`; `The Songbook (music spells).md` →
`The Songbook (music spells)`.

**Acceptance criteria**

- **AC-1 Prefixed preamble file.** The title goes at the prefix depth (after
  the US-6.3 AC-9 floor).
  - `1 Chapter.md` = `Chapter introduction.` → `# Chapter`.
  - `2.2.2 Third-Level.md` = `Some introductory text.` → `### Third-Level`.
- **AC-2 Unprefixed preamble file.** The title goes at the US-6.3 AC-4 depth:
  last original heading + 1.
  - Root `# Root` + `![[Details.md]]`; `Details.md` = `Preamble text.` →
    `# Root`, `## Details`.
  - Output levels count, not source levels: root `![[1.2 Section.md]]`;
    `1.2 Section.md` = `Intro.` / `# Details` / `![[Appendix.md]]`;
    `Appendix.md` = `Appendix text only.` → `## Section`, `### Details`,
    `#### Appendix`.
- **AC-3 No original heading above the embed.** The title goes at parent
  depth + 1, which is h1 when embedded from the root.
  - Root `![[Overview.md]]`; `Overview.md` = `Some overview text.` → `# Overview`.
  - Root `Some root prose.` + `![[Details.md]]` → `# Details`.
  - Root `![[1.2 Sec.md]]`; `1.2 Sec.md` = `Intro.` + `![[Notes.md]]`;
    `Notes.md` = `Some notes.` → `## Sec`, `### Notes`.
- **AC-4 Internal headings.** They shift uniformly so the first one lands at
  title level + 1.
  - `2.2.2 Third-Level.md` = `Some text` / `# Heading` → `### Third-Level`,
    `#### Heading`.
  - `1.2 Rules.md` = `Intro.` / `# First` / `## Second` / `# Third` →
    `## Rules`, `### First`, `#### Second`, `### Third`.
- **AC-5 Order.** Title, then the preamble text, then the first internal
  heading. Multi-paragraph preambles are kept whole.
- **AC-6 Headingless file.** It gets a title too, and its text follows unchanged.
  - `1.3.2 Magic.md` = `Just some prose.` → `### Magic`, `Just some prose.`
  - Root `## Section` + `![[Notes.md]]`, headingless `Notes.md` → `### Notes`.
- **AC-7 Ceiling.** The title and internal headings stop at h6, with a
  `WarningDetail` containing `clamp` and no comment in the output.
  - `1.2.3.4.5 Deep.md` = `Intro.` / `# First` / `## Second` → `##### Deep`,
    `###### First`, `###### Second`.
  - `1.2.3.4.5.6.7 TooDeep.md` = `Intro text.` → `###### TooDeep`.
- **AC-8 Toggle off.** No title from this story; US-6.1 applies instead.
- **AC-9 Nested preamble files (canonical example).** Root
  `![[2.2.2 Third-Level.md]]`; `2.2.2 Third-Level.md` = `Some text` /
  `# Heading` / `![[Detailbit.md]]` / `Some more text`; `Detailbit.md` =
  `Some text inside` / `Some more text inside` / `# Heading inside Detail` /
  `last text`. Output:
  ```
  ### Third-Level
  Some text
  #### Heading
  ##### Detailbit
  Some text inside
  Some more text inside
  ###### Heading inside Detail
  last text
  Some more text
  ```
- **AC-10 Only original headings count.** Root `![[1.2.3 Deep.md]]` /
  `![[Notes.md]]`; `1.2.3 Deep.md` = `# Deep` / `## Section`; `Notes.md` =
  `Just notes.` → `### Deep`, `#### Section`, then `# Notes` (Deep's headings
  are not original to the root). With root `# First` / `## Second` /
  `![[Notes.md]]` the last one wins → `### Notes`.

### US-6.5 Pass-through embed
*(Specified only in the ticket backlog as "US-7.3" until 2026-10-27.)*

**As a** vault owner  
**I want** a file that only wraps one embed of a heading-first file to add no
heading of its own  
**So that** wrapper notes do not add an empty extra level to the compiled document.

Applies only when US-6.3 is on.

**Definitions**
- **Wrapper**: a file whose content, ignoring all whitespace (spaces, tabs,
  newlines), is exactly one markdown embed in either syntax: `![[B.md]]`,
  `![alt](B.md)`, `![[B.md#Section]]` or `![alt](B.md#Section)`, in every
  form an ordinary embed may take (AC-11).
- **Effectively heading-first**: a heading-first file, or a wrapper whose
  embed is an anchor embed, or a wrapper whose target is effectively
  heading-first (followed recursively; a circular chain is not).
- A wrapper is a **pass-through** when its embed is an anchor embed, or its
  target is effectively heading-first.

**Depth of a pass-through**: its prefix depth (with the US-6.3 AC-9 floor);
without a prefix, the US-6.3 AC-4 depth (last original heading + 1, else parent
depth + 1).

**What the pass-through produces**: the target as if it were embedded directly
at the wrapper's depth. For a whole-file target that means the target's own
title (US-6.3 AC-6) — not the wrapper's — in place of its first heading (OD-6
of 2026-10-27, "target's filename"). For an anchor target it means the section
with its heading text kept (US-6.3 AC-7).

**Acceptance criteria**

- **AC-1 Pass-through.** The wrapper gets no title; the target appears at the
  wrapper's depth with the target's title.
  - Root `![[A.md]]`; `A.md` = `![[B.md]]` (also with blank lines, tabs or the
    `![](B.md)` syntax); `B.md` = `# Real Heading` / `Content` → `# B`,
    `Content`, no `# A`.
- **AC-2 Own content.** Any other non-whitespace text in the wrapper makes it a
  preamble file (US-6.4). `A.md` = `Some intro text.` / `![[B.md]]`, `B.md` =
  `# B Heading` → `# A`, `## B`.
- **AC-3 Two or more embeds.** Not a pass-through. `A.md` = `![[B.md]]` /
  `![[C.md]]`, `B.md` = `# B Heading`, `C.md` = `# C Heading` → `# A`, `## B`,
  `## C`.
- **AC-4 Preamble target.** Not a pass-through. `B.md` = `Not a heading.` /
  `# Internal Heading` → `# A`, `## B`, `### Internal Heading`.
- **AC-5 Headingless target.** Not a pass-through. `B.md` = `Just some text.`
  → `# A`, `## B`, `Just some text.`
- **AC-6 Anchor embeds are pass-throughs.** The section's shallowest heading
  lands at the wrapper's depth, moving up or down, and keeps its text.
  - `A.md` = `![[B.md#Section]]` (or `![Section Title](B.md#Section)`);
    `B.md` = `# Intro` / `## Section` / `Content` → `# Section`, `Content`, no `# A`.
  - `B.md` = `# Top` / `## Middle` / `### DeepSection` / `Content` with
    `A.md` = `![[B.md#DeepSection]]` → `# DeepSection`.
  - Root `# Book` / `## Chapter` / `![[A.md]]`, `A.md` = `![[B.md#Section]]` →
    `### Section` *(was `## Section` before v0.11.0)*.
- **AC-7 Prefix depth is kept.** `2.3 Overview.md` = `![[B.md]]`; `B.md` =
  `# My Heading` / `## Sub-section` → `## B`, `### Sub-section`, no
  `## Overview`. `1.2.3 Deep.md` = `![[Target.md]]` → `### Target`;
  `1 Wrapper.md` → `# Target`.
- **AC-8 Chains.** Root `![[A.md]]`, `A.md` = `![[B.md]]`, `B.md` =
  `   ![[C.md]]   `, `C.md` = `# Deep Heading` / `## Sub` → `# C`, `## Sub`, no
  title for A or B. With `2.1 Chapter.md` in place of `A.md` → `## C`,
  `### Section`. The chain stops (and the first file gets a title) when
  a link in it has two embeds or ends in a preamble file.
- **AC-9 Not an original heading.** Root `# Own Heading` / `![[A.md]]` /
  `![[NoPrefixPreamble.md]]`, `A.md` = `![[B.md]]`, `B.md` = `# B Heading`,
  `NoPrefixPreamble.md` = `Preamble text.` → `# Own Heading`, `## B`,
  `## NoPrefixPreamble` *(B was `# B Heading` before v0.11.0)*.
- **AC-10 Toggle off.** No pass-through; US-6.1 applies to A and B.
- **AC-11 The wrapper's embed is read like every embed** *(added 2026-11-10
  from [#123](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/123))*.
  Whether a file is a wrapper, and which note and heading its embed names, is
  read by the same rules as an ordinary embed: percent escapes decoded in the
  path and the heading (US-1.2, US-3.1 `decodeLink`), a path relative to the
  wrapper, a `<…>` destination and a title after it (US-2.6 AC-3), a path
  without `.md` (US-3.1). Each markdown form gives exactly the output of the
  wiki form `![[Duel Rules#Duel Checks]]`, which v0.23.0 already handles.
  Root `# Book` / `` / `![[A]]`; `Duel Rules.md` = `# Intro` / `` / `Intro.` /
  `` / `## Duel Checks` / `` / `Roll both.` / `` / `## Other` / `` / `X.`;
  "Normalise headings" on. Measured with v0.23.0 (before → after):

  | `A.md` | v0.23.0 | after |
  |---|---|---|
  | `![x](Duel%20Rules.md#Duel%20Checks)` | `# Book` only; warning `Missing heading anchor: Duel Rules.md#Duel%20Checks` | `# Book` / `` / `## Duel Checks` / `Roll both.`, no warning |
  | `Bits/A.md` = `![x](../Duel%20Rules.md#Duel%20Checks)` (root `![[Bits/A]]`) | the same warning | the same as the row above |
  | `![x](<Duel Rules.md#Duel Checks>)` | `## A` / `` / `### Duel Checks` / `Roll both.` | the same as the first row |
  | `![x](Duel%20Rules#Duel%20Checks)` | `## A` / `` / `### Duel Checks` / `Roll both.` | the same as the first row |
  | `![x](Duel%20Rules)` (whole note) | `## A` / `` / `### Duel Rules` / `Intro.` / `` / `#### Duel Checks` / … | `## Duel Rules` / `Intro.` / `` / `### Duel Checks` / `Roll both.` / `` / `### Other` / `X.` |

  Composed cases, with `A.md` = `![x](Duel%20Rules.md#Duel%20Checks)`:
  - A chain: root `# Book` / `` / `![[W]]`, `W.md` = `![[A]]` → `# Book` /
    `` / `## Duel Checks` / `Roll both.` (AC-8).
  - In a quote (US-1.5 AC-6), toggle on **and** off: root `# Book` / `` /
    `> ![[A]]` → `# Book` / `> ## Duel Checks` / `>` / `> Roll both.`, no
    warning. v0.23.0 gives `> <!-- Warning: Missing heading anchor: Duel Rules.md#Duel%20Checks -->`
    with the toggle on and off, because the quote reads every wrapper.
  - Toggle off: unchanged (`## A` / `` / `## Duel Checks` / `Roll both.`).
- **AC-12 A missing heading in a pass-through is reported like any missing
  heading** *(added 2026-11-10 from #123)*. The output gets the US-1.2
  comment and the warning has the same detail as for an ordinary section
  embed: the note's link with the heading decoded, the wrapper, and the
  wrapper's line of the embed in the note as stored (US-8.4 AC-5, US-8.5
  AC-2). `A.md` = `` / `![[Duel Rules#Gone Now]]` (embed on line 2), or
  `` / `![x](Duel%20Rules.md#Gone%20Now)`, toggle on → `# Book` /
  `<!-- Warning: Missing heading anchor: Duel Rules.md#Gone Now -->` (no
  empty line after a heading, US-6.6) and one
  detail `{ message: 'Missing heading anchor: Duel Rules.md#Gone Now',
  link: 'Duel Rules.md#Gone Now', file: 'A.md', line: 2 }`. v0.23.0: no
  comment, `line: 0`, `link: 'Duel Rules'`. With frontmatter `---` /
  `tags: [x]` / `---` above the embed, line 5. The wrapper still gets no
  title (it is a pass-through); with the toggle off nothing changes
  (`## A` / the comment, line 2).

### Decisions on US-6.1 and US-6.3 to US-6.5 (2026-10-27)

Asked with the output the compiler gave at v0.10.0; options not built yet were
marked as not measured.

| ID | Question | Decision |
|---|---|---|
| OD-1 | First heading of a heading-first file: keep the author's text, or use the filename? (`1.2 Combat.md` = `# Fighting`; 19 of the vault's 33 heading-first notes differ from their filename.) | Replace it with the title (US-6.3 AC-6). |
| OD-2 | One depth rule for unprefixed files? After `## Chapter` in the root they landed at h1, h3, h2 or h2 depending on how they started. | Last original heading + 1, else parent depth + 1, for every kind (US-6.3 AC-4). |
| OD-3 | Section embeds shifted only deeper. | Both ways (US-6.3 AC-7). |
| OD-4 | The plugin's "off" kept headings as written; US-6.1 ran only in tests. | Off means US-6.1. Also: US-6.1 uses the same title rule, and its cap is h6, not h3. |
| OD-5 | Clamped headings: comment in the output as well? | No; warning list and logfile only. |
| OD-6 | Which title does a whole-file pass-through show? | The target's title (US-6.5). |

### Open items

- **OD-7 Duplicate titles.** Two embedded files with the same title (`1 Intro.md`,
  `2 Intro.md`) give two headings with the same anchor, so a link to the second
  goes to the first. Measured 2026-10-27: no two prefixed notes in the vault
  share a title after the prefix is removed. Decided 2026-11-01: US-2.3
  AC-6 (heading paths; a warning where no path separates them). Tracked in
  [#85](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/85).

### Known defects (found 2026-10-27)

- **KD-1 (fixed in v0.11.0) Links to normalised files pointed at anchors that did not exist.** With
  the toggle on, `[[1.2 Third-Level]]` becomes `[1.2 Third Level](#1.2-third-level)`
  while the heading is `## Third-Level`; `[[1.2 Combat]]` to a file starting with
  `# Fighting` becomes `#1.2-combat` while the heading is `## Fighting`. Link
  labels and anchors use `titleFromFilename` (hyphens to spaces, prefix kept,
  words title-cased); the injected titles use a different derivation
  (SCAR-001). Violated US-8.3. Fixed by the single title rule (US-6.4), which
  link labels and anchors now also use. Measured on the example vault: anchor
  links without a matching heading went from 68 to 23 (toggle on) and from 146
  to 22 (toggle off); the rest are KD-2.
- **KD-2 Links written to a heading inside a note keep their raw target.**
  Authors' links such as `[Zeal](#Zeal)` or
  `[Brawling pool](#The%20Brawling%20and%20Fortune%20Pools)` are left as
  written, so they do not match the slugified anchor of the heading
  (`#zeal`). 23 such links in the example vault (2026-10-27). Decided
  2026-11-01: US-2.3 AC-2 and AC-5 (Obsidian anchors; Obsidian finds these
  links as written, the compiler checks and normalises them). Tracked in [#83](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/83).

### US-6.6 Tidy empty lines in the compiled output
**As a** reader  
**I want** the compiled document to have one consistent spacing  
**So that** there are no gaps of several empty lines and every heading sits
directly on its content.

*(Added 2026-10-27. Measured in the example book the same day, toggle
"Normalise headings" on/off: 211/169 runs of two or more empty lines, 283/566
headings with an empty line before their content, 66/13 headings without an
empty line before them. After a heading come text 537×, lists 63×, tables
37×, images 11×, callouts 3×, headings 22×; no code blocks.)*

Definitions:
- A **heading** is a line starting with 1 to 6 `#` followed by a space or tab
  (`## Combat`), outside code blocks. `#monster` (a tag) is not a heading.
- An **empty line** is a line that is empty or holds only spaces or tabs.
- A **code block** runs from a line starting with ` ``` ` or `~~~` (after
  optional spaces) to the next line starting with the same fence.

**Acceptance criteria**
- **AC-1 At most one empty line.** Outside code blocks, a run of two or more
  empty lines becomes one empty line; a line with only spaces or tabs becomes
  empty.
  - `Text.` / `` / `` / `` / `More text.` → `Text.` / `` / `More text.`
- **AC-2 An empty line before every heading.** A heading that follows any other
  line gets exactly one empty line before it.
  - `- last item` / `## Next` → `- last item` / `` / `## Next`
- **AC-3 No empty line after a heading,** whatever follows (text, list, table,
  image, callout, comment), unless it is a heading (decided 2026-10-27).
  - `## Combat` / `` / `Fights are…` → `## Combat` / `Fights are…`
  - `### Spells` / `` / `| Time | Type |` → `### Spells` / `| Time | Type |`
- **AC-4 Two headings.** Exactly one empty line between them.
  - `# Part` / `## Chapter` → `# Part` / `` / `## Chapter`
  - `# Part` / `` / `` / `## Chapter` → `# Part` / `` / `## Chapter`
- **AC-5 Code blocks are left alone.** Lines inside a code block, including
  empty lines and lines starting with `#`, stay as they are; the fence lines
  themselves follow AC-1 to AC-4 like text.
  - `## Example` / `` / ` ``` ` / `# not a heading` / `` / `` / `x` / ` ``` ` →
    `## Example` / ` ``` ` / `# not a heading` / `` / `` / `x` / ` ``` `
- **AC-6 Start and end.** The document starts with its first non-empty line
  and ends with that line's text and one line break.
- **AC-7 Where.** Applied last, to the whole compiled document, with both
  values of "Normalise headings" and "Tidy map labels"; the source notes are
  not changed.

**KD-3 — fixed in v0.16.1: heading rules skip code blocks** *(found
2026-10-27 while testing US-6.6: a section embed ended at a `# …` line inside
a code block and left an unclosed fence; heading normalisation turned
`# code` into `### code`.)*

Rule for every step that looks for headings: **a line inside a code block is
never a heading.** "Inside" means after a line that opens a code block
(` ``` ` or `~~~` after optional spaces) up to and including the line that
closes it (the next line starting with the same fence); an unclosed block runs
to the end of the note. The opening line is not inside. One shared helper
decides this for all steps, the same one `tidyBlankLines` uses.

Examples (toggle "Normalise headings" on unless said otherwise; ` ``` ` lines
are shown as ```` ``` ````):
- **K-1 Section embed (US-1.2).** `Notes.md` = `# Bit` / `- one` / ```` ``` ````
  / `# code` / ```` ``` ```` / `# Next` / `after`. `![[Notes#Bit]]` embeds
  `# Bit` / `- one` / ```` ``` ```` / `# code` / ```` ``` ```` and stops before
  `# Next`. *(Before: it stopped before `# code`, leaving ```` ``` ```` open.)*
- **K-2 Heading-first note (US-6.3 AC-6).** `1.2 X.md` = `# X` / ```` ``` ````
  / `# code` / ```` ``` ```` / `## Sub` → `## X` / ```` ``` ```` / `# code` /
  ```` ``` ```` / `### Sub`. *(Before: `### code`.)*
- **K-3 Preamble note (US-6.4).** `1.2 Y.md` = `Intro.` / ```` ``` ```` /
  `# code` / ```` ``` ```` / `# Real` → `## Y`, `Intro.`, the code block
  unchanged, `### Real`.
- **K-4 Headingless note.** `1.3.2 H.md` = ```` ``` ```` / `# code` /
  ```` ``` ```` → `### H` before the unchanged code block.
- **K-5 Last original heading (US-6.3 AC-4).** Root `# Book` / ```` ``` ```` /
  `###### not a heading` / ```` ``` ```` / `![[Z]]`, `Z.md` = `Z text.` → `## Z`.
  *(Before: the code line counted as an h6 above the embed.)*
- **K-6 Section moved (US-6.3 AC-7).** Root `![[M#Sec]]`, `M.md` = `# M` /
  `## Sec` / ```` ``` ```` / `# code` / ```` ``` ```` → `# Sec` and the code
  block with `# code` unchanged.
- **K-7 Toggle off (US-6.1).** The section embed of K-1 is the same with the
  toggle off; code blocks are never shifted.

**Known defect KD-4 (found 2026-10-27, class search of KD-3):** other steps do
not know code blocks either — a list of links inside a code block can be
expanded as a ToC (US-1.3), `![[…]]` inside a code block is embedded, and
links inside code are converted (US-2.3). The book has no code blocks
(measured 2026-10-27). Specified 2026-11-01 as US-1.4; tracked in [#84](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/84).

## Epic 7 — Obsidian plugin delivery

### US-7.1 Deliver the compiler as an Obsidian.md plugin
**As an** Obsidian user  
**I want** the vault compiler to be available as an Obsidian.md community
plugin  
**So that** I can compile the current vault without leaving Obsidian.

**Acceptance criteria**
- The compiler is packaged as a standard Obsidian plugin with `main.js`,
  `manifest.json`, and plugin settings.
- Plugin commands are available from the command palette to run a compilation.
- Plugin settings let the user choose the vault-relative starting file and output
  file paths.
- **AC-S1 Saving settings** *(decided 2026-11-01,
  [#82](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/82))*. A text
  field in the settings (starting file, output folder, output filename, map
  font) is saved half a second after the last key press, not on every key
  press; switches and Browse save at once. Whatever was typed is saved at the
  latest when the settings window closes or the plugin is switched off, also
  within that half second. Example: typing `/Users/me/Exports` in one go
  writes `data.json` once, with the whole value; typing `Ex`, closing the
  settings window at once → `Ex` is saved. *(v0.20.0: one write per key
  press, 17 for that example.)*
- **AC-S2 The resolved output path follows typing** (SCAR-016). Both places
  that show it — the end of the output folder's description and the row
  `Resolved output path` — are updated on every change of the starting
  file, folder or filename field, before saving:
  settings `Exports`, `compiledtext.md`; type `/Drafts` in the folder field →
  the line shows the result for `/Drafts` at once. *(v0.20.0: only after
  Browse or reopening the settings.)*
- Plugin settings include an option to disable TextMapper rendering.
- Compiled output and the `assets/` folder are written using Obsidian's vault
  and file APIs when the output folder is in the vault; a folder outside the
  vault is written with Node.js `fs` on the desktop app (US-0.3 AC-OL-2).
- Long-running compilation and TextMapper rendering show progress or status
  messages inside Obsidian.

### US-7.2 Context-menu compilation
**As an** Obsidian user  
**I want** to right-click a markdown file and compile starting from that file  
**So that** I can avoid manually configuring the starting file first.

**Acceptance criteria**
- **AC-1** A file explorer context-menu item is available for markdown files.
- **AC-2** Selecting it opens the export-path prompt (US-7.3) with the chosen
  file pre-set as the starting file and the configured output path
  pre-filled.
- **AC-3 One-shot** *(examples added 2026-11-01,
  [#81](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/81))*. The
  selected starting file is **not** saved to plugin settings, whether the
  prompt is confirmed or cancelled. Example: settings `index2compile.md`,
  `Exports`, `compiledtext.md`; right-click `Chapter 2.md` → Compile (or
  Cancel). Afterwards the settings still show `index2compile.md`, `Exports`,
  `compiledtext.md`, `data.json` is unchanged, and the command-palette
  `Compile vault` starts from `index2compile.md` into
  `Exports/compiledtext.md`. *(v0.20.0: the starting file was saved as soon
  as the menu item was chosen, even before Cancel.)*

### US-7.3 Prompt for export path on context-menu compilation
**As an** Obsidian user  
**I want** context-menu compilation to ask for the export folder and filename
before running  
**So that** each compile can choose its destination without changing global
settings first.

**Acceptance criteria** *(AC-3 to AC-6 made concrete 2026-11-01, #81; AC-5
and AC-6 decided the same day)*
- **AC-1** Starting from the context menu opens a prompt with output folder
  and filename fields.
- **AC-2** Fields default to the preset output folder and filename.
- **AC-3 This run only.** Confirming the prompt starts compilation using
  those values for this run only; the values are **not** persisted to plugin
  settings. Example: settings `Exports`, `compiledtext.md`; in the prompt
  type `Drafts` and `ch2.md`, Compile → writes `Drafts/ch2.md` (and
  `Drafts/assets/`); the settings still show `Exports`, `compiledtext.md`.
  *(v0.20.0: both were saved.)*
- **AC-4 Browse** in the prompt puts the chosen folder into the prompt's
  folder field only; it is not saved. *(v0.20.0: it was saved.)*
- **AC-5 Cancelling** — the Cancel button or Escape — does not start
  compilation and saves nothing. **Enter** in either field does what Compile
  does; Enter while an input method is still composing a character (IME)
  does not (SCAR-013).
- **AC-6 The resolved output path follows the fields** (SCAR-016). The line
  `Resolved output path: …` under the folder field is computed from the
  prompt's own values — the chosen starting file, the folder and filename
  fields — after every change to a field and after Browse: open the prompt
  (`Exports/compiledtext.md`), type `Drafts` → `Drafts/compiledtext.md`, then
  `ch2.md` as filename → `Drafts/ch2.md`. Values that are refused show
  `not usable: <reason>` as today (US-0.3). *(v0.20.0: computed once from
  the settings when the prompt opened.)*

## Epic 8 — Data safety and failsafes

### US-8.1 Never alter source vault files
**As a** vault owner  
**I want** compilation to be strictly read-only with respect to the source vault  
**So that** running the plugin can never damage or modify my original files.

**Acceptance criteria**
- The plugin only reads vault files during compilation.
- The plugin writes only to the configured compiled master file and its
  `assets/` directory.
- A preflight validation fails compilation rather than writing partial output if
  a source file cannot be read safely.
- No temporary or generated file is written into the source vault unless it is
  the explicitly configured output or assets path.
- **AC-8.1-W Every write is checked against the output location (added
  2026-10-27, v0.12.0).** Every write of a compile (a vault `create`,
  `createBinary`, `modify` or `createFolder`, or a Node.js `fs` write for an
  outside folder) goes through one output writer. Before each write it checks
  the path and refuses, with `Compilation failed: Refused to write "<path>":
  not part of the output location.`, anything other than:
  - the output file;
  - `warnings_YYYYMMDD_HHMM.md` directly in the output folder;
  - a file or folder under `<output folder>/assets/` without a `..` segment;
  - for a vault folder: the output folder and its parent folders (to create
    them).

  Example for folder `Exports`, filename `Book.md`:
  | Path | Write |
  |---|---|
  | `Exports/Book.md` | allowed |
  | `Exports/warnings_20261027_1106.md` | allowed |
  | `Exports/assets/map.png`, `Exports/assets/textmapper/1a2b_0001.png` | allowed |
  | `Exports` (folder) | allowed |
  | `Book.md`, `Exports/other.md`, `Exports/warnings.md` | refused |
  | `Exports/assets/../index2compile.md` | refused |
  | `Users/user/Desktop/Book.md` | refused |

  TextMapper's temporary `.txt` and `.svg` files go to the operating system's
  temporary folder (`os.tmpdir()`), never to the vault or the output folder.
- **AC-8.1-V The vault check sees outside output.** After a compile to a folder
  outside the vault, any new file in the vault fails the compile with
  `Unexpected new vault file created during compilation: <path>`.

### US-8.3 Output contains only portable links
**As an** Obsidian user
**I want** every link in the compiled file to point only to copied assets,
external websites, or anchor targets in the compiled output
**So that** the compiled document remains portable after being moved or shared.

**Acceptance criteria**
- Links that point at other vault files are rewritten to anchors pointing at
  the first embedded instance of the target file.
- A link whose target file exists in the vault but is **not embedded anywhere**
  in the compiled document is replaced with an HTML comment
  `<!-- Warning: link target 'X' not embedded in compiled output -->` and a
  `WarningDetail` is recorded (file + line of the originating source file).
- Missing links (target file does not exist at all) are reported as warnings
  rather than left as vault links.
- A sanity test asserts every remaining markdown link uses `#`, `assets/`,
  `http://`, `https://`, or `mailto:` destinations.

### US-8.4 Write warnings to a timestamped logfile
**As an** Obsidian user
**I want** compiler warnings collected in a separate timestamped file
**So that** I can review unresolved references after compilation.

**Acceptance criteria**
- The logfile is named `warnings_YYYYMMDD_HHMM.md`.
- Each entry contains the warning, original link, and source location.
- The source location **always refers to the original vault file** in which the
  link or embed was written — never to the compiled output document.  The
  filename is the vault-relative path of that source file (e.g.
  `Calendar/session-01.md`), and the line number is the 1-based line within
  that source file.
- Because some warnings are detected in a post-processing pass that runs over
  the already-assembled output (e.g. `convertLinks`, `verifyOutputLinks`), the
  compiler must preserve provenance — the originating vault file and line —
  throughout the pipeline so it is available when those passes emit warnings.
  A warning entry must never record `compiled-output` or a line number that
  refers to a position in the merged document.
- **AC-5 Source lines in every case** *(added 2026-10-31 from
  [#95](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/95))*. The
  line is the line of the link or embed in the note as stored, frontmatter
  included, whatever the compiler did around it: notes embedded above it,
  ToC lists expanded above it, map blocks turned into one image line, removed
  control blocks (Dataview, Meta Bind …), a title injected by "Normalise
  headings", and a section embed that brings the link along. In each example
  the warning is for the last line shown; measured with v0.17.1 (before → after):

  | Note (`index.md` unless named) | before | after |
  |---|---|---|
  | `# Index` / `` / `text` / `` / `See [[Gone]].` | 5 | 5 |
  | `# Index` / `` / `![[Here]]` / `` / `See [[Gone]].` | 10 | 5 |
  | the same with `See [x](Gone.md).` | 10 | 5 |
  | the same with `See [[Other]].` (exists, not embedded) | 10 | 5 |
  | two embeds above (`![[Here]]`, `![[Here2]]`), link on line 7 | 18 | 7 |
  | ToC list `- [[Here]]` / `- [[Here2]]` above, link on line 6 | 16 | 6 |
  | section embed `![[Here#Here]]` above, link on line 5 | 11 | 5 |
  | frontmatter `---` / `tags: [x]` / `---` above `# Index` / `` / `text` / ``, link on line 8 | 5 | 8 |
  | ` ```text-mapper ` block of 4 lines above, link on line 8 | 5 | 8 |
  | ` ```dataview ` block of 4 lines above, link on line 8 | 5 | 8 |
  | the same two with `![[Gone]]` (embed warning) on line 8 | 5 | 8 |
  | `Part.md` = `# Part` / `` / `See [[Gone]].`, embedded | 3 | 3 |
  | `Part.md` = `# Part` / `` / `![[Here]]` / `` / `See [[Gone]].` | 10 | 5 |
  | `Part.md` = `Intro.` / `` / `![[Here]]` / `` / `See [[Gone]].`, "Normalise headings" on / off | 11 / 12 | 5 / 5 |

  A link brought along by a section embed is reported in the note it is
  written in: `Here.md` = `# Here` / `` / `from here [[Gone]]`, embedded as
  `![[Here#Here]]` → `Here.md`, line 3. A link inside a heading reports the
  heading's line: `## See [[Gone]]` on line 3 → line 3. The markers that carry
  the location never change which section a section embed finds:
  `![x](Here.md#Notes on [[Other]])` with `Here.md` = `# Here` / `` /
  `## Notes on [[Other]]` / `` / `body` embeds that section.

  Several links on one line each report their own note and line *(added
  2026-11-01; found with v0.18.0, [#98](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/98))*: `Grit.md` line 3 =
  `See [[Gone]], [[Lost]], [x](Away.md).`, embedded → three warnings, each
  with file `Grit.md` and line 3. v0.18.0 gives the second and third a file
  name that contains marker text (`Grit.md -->[[Gone]], <!-- __vl__:3:Grit.md`).
- **AC-6 Warnings that are not about a link** *(added 2026-11-10 from
  [#56](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/56);
  decided the same day)*. They too name a vault note and a line of it as
  stored (frontmatter included, AC-5); no warning names `compiled-output` or
  line 0:
  - **Map warnings** (`TextMapper renderer not available`, `TextMapper render
    failed: …`, `Map directive "…" is unknown and was ignored`): the note and
    the line of the map's opening fence. A map drawn once for several places
    (US-4.7) is reported once, at its first place in the document.
  - **`Heading depth clamped to h6 in <note>`** for a heading the note
    writes itself: that note and the line of its first clamped heading.
  - **The title, a prefix depth and a section embed**: the title (injected,
    or replacing the first heading), `Heading depth clamped: <note> prefix
    depth …` and a section shifted past h6 have no heading line of their
    own; their depth is set by where the note is embedded, so they name the
    embedding note and the line of the embed. Through a pass-through
    wrapper (US-6.5), that is the wrapper and its embed's line.
  - **`Invalid output link`** (`<a href>`): the note and its line, like a
    markdown link (it carries a location marker as well).

  `Part.md` = `# Part` / `` / `Text.` / `` / ` ```text-mapper ` /
  `0101 grass "Vale"` / ` ``` ` (fence on line 5), embedded from
  `index.md` = `# Book` / `` / `![[Part]]`; measured with v0.23.0,
  `compileAsync` (before → after):

  | Case | v0.23.0 | after |
  |---|---|---|
  | 1. maps on, no renderer | `compiled-output`, 0 | `Part.md`, 5 (with `---` / `tags: [x]` / `---` above: 8) |
  | 2. the renderer throws `boom` | `compiled-output`, 0 | `Part.md`, 5 |
  | 3. the same map also on line 3 of `index.md`, above the embed | `compiled-output`, 0 (one warning) | `index.md`, 3 (one warning) |
  | 3b. the same map on line 5 of `index.md`, below the embed on line 3 | `compiled-output`, 0 | `Part.md`, 5 (first in the document, though `index.md`'s own fence is read first) |
  | 4. `# vault-compiler: no-glw` as the map's first line | `Part.md`, 0 | `Part.md`, 5 |
  | 5. "Normalise headings" on; `index.md` = `# Book` / `## A` / `### B` / `#### C` / `##### D` / `![[Deep]]` (blank lines between, embed on line 11); `Deep.md` = `Intro.` / `` / `# One` / `` / `## Two` | `Deep.md`, 0 | `Deep.md`, 3 (`# One` would be h7) |
  | 6. as 5, `Deep.md` = `# Top` / `` / `## Two` | `Deep.md`, 0 | `Deep.md`, 3 |
  | 7. `index.md` = `# Book` / `` / `###### Deepest` / `` / `![[Deep]]`; `Deep.md` = `Flat text.`, or `# Top` / `` / `Text.` (the title would be h7) | `Deep.md`, 0 | `index.md`, 5 |
  | 8. `index.md` = `# Book` / `` / `- [[2 Chapter]]`; `2 Chapter.md` = `Chapter text.` / `` / `![[2.1 Sub]]` / `` / `![[3 Wrong]]` | `3 Wrong.md`, 0 | `2 Chapter.md`, 5 |
  | 9. `index.md` = `# Book` / `` / `###### Deep` / `` / `![[Rules#Combat]]`; `Rules.md` = `# Rules` / `` / `## Combat` / `` / `### Moves` / `` / `x` | `index.md`, 0 | `index.md`, 5; through `W.md` = `` / `![[Rules#Combat]]`: `W.md`, 2 |
  | 10. `Part.md` = `---` / `tags: [x]` / `---` / `# Part` / `` / `![[Inner]]` / `` / `See <a href="file:///x">x</a>.`, `Inner.md` of five lines | `Part.md`, 14 | `Part.md`, 8 |

  Messages and links are unchanged. With "Normalise headings" off there is
  no clamp (US-6.1 caps at h6 without a warning).

### US-8.5 Each problem is reported once, where it was written
**As a** vault owner  
**I want** every problem with a link reported exactly once, by the step that
uses the link, with the note and line it is in  
**So that** the warnings file and the warning list name real problems only,
and a name that matches several notes never picks one silently.

*(Written 2026-10-31 from [#88](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/88);
decisions OD-W1 and OD-W2 taken the same day.)*

Today (measured 2026-10-31 with v0.17.0, `InMemoryVaultCompiler.compile`):
looking up a link (`resolve`) adds `Warning: Missing include` to
`result.warnings` and counts a missing reference whenever the target is not
found, and adds `Warning: Ambiguous filename …` whenever a bare name matches
several files. Lookups that only classify — the scan for explicit embeds
before ToC expansion, the pass-through check (US-6.5) and the heading-first
check (US-6.3) — run it too; the scan puts the counter back but not the
warnings. So:

| Note `index.md` (and other files) | `result.warnings` today | warnings file today |
|---|---|---|
| A: ` ```text-mapper ` / `0101 grass "Vale"` / ` ``` ` | `Missing include` (false: the generated `assets/textmapper/….png`) | — |
| B: `![[Gone]]` | `Missing include` ×3 | `Missing include` |
| C: `See [[Gone]] here.` | `Missing include`, `Missing wiki link` | `Missing wiki link` |
| F: `![](gone.png)` | `Missing include` ×2, `Missing asset` | `Missing asset` |
| E: `![[dup]]` and `See [[dup]].`; `a/dup.md`, `b/dup.md` | `Ambiguous filename dup.md; using a/dup.md` ×3 | — |
| E2: `- [[Wrapper]]`; `Wrapper.md` = `![[dup]]` (pass-through) | `Ambiguous filename …` ×2 | — |
| E3: `![](logo.png)`; `x/logo.png`, `y/logo.png` | `Ambiguous filename logo.png; using x/logo.png` ×2 | — |

The warnings file (US-8.4) is written from `warningDetails` only, so A is
invisible to users, while B, C and F are right there; the ambiguous name is
never shown (US-3.1 promises "a warning logged").

**Acceptance criteria**
- **AC-1 Looking up reports nothing.** Finding a link's target never adds a
  warning or counts a missing reference by itself, in any step. Only the step
  that uses the link — embedding (`![[…]]`, `![…](…)`, a ToC item, a
  pass-through), copying an asset, converting a link — reports what it
  found, once.
- **AC-2 One problem, one entry.** Each reported problem adds exactly one
  `result.warnings` entry (`Warning: <message>`) and one `warningDetails`
  entry with the same message, the link as written, the note and the line.
  `stats.missingReferences` counts each missing target once. With the
  examples above:
  - A: no warning, no detail, `missingReferences` 0.
  - B: `Warning: Missing include` once; detail `Missing include`, link
    `Gone`, `index.md`, line 3; count 1.
  - C: `Warning: Missing wiki link` once; detail as today; count 1.
  - F: `Warning: Missing asset` once; detail as today; count 1.
- **AC-3 Ambiguous names are reported per link (OD-W2).** When a bare name
  matches several files, the lexicographically smallest path is used, as
  before (US-3.1), and each link or embed that met the ambiguity reports
  `Ambiguous filename <name>; using <path>` with the link as written, its
  note and line:
  - E: two entries, `{ link: 'dup', file: 'index.md', line: 3 }` (the embed)
    and `{ link: 'dup', file: 'index.md', line: 5 }` (the wiki link).
  - E2: one entry `{ link: 'dup', file: 'Wrapper.md', line: 1 }`, with
    "Normalise headings" on (pass-through) and off (ordinary embed). With
    frontmatter `---` / `tags: [x]` / `---` above the embed, line 4 (source
    lines, US-5.2 AC-12), on and off.
  - E3: one entry `{ link: 'logo.png', file: 'index.md', line: 3 }`.
  The output text is unchanged (`a/dup.md` and `x/logo.png` are used).
  - **Ambiguous** means: no file exists at the path as written (absolute, or
    relative to the note, with or without `.md`), and the bare name matches
    more than one file of the vault. `![[dup]]` in `a/index.md` with
    `a/dup.md` and `b/dup.md` finds `a/dup.md` relative to the note: not
    ambiguous, nothing reported.
  - **In Obsidian** the file is chosen by Obsidian's link lookup
    (`getFirstLinkpathDest`), which the plugin consults first; the
    compiler's own name search never runs there. The ambiguity is therefore
    checked against the compiler's list of vault files whoever chose, and the
    message names the path actually used: a lookup that returns `b/dup.md`
    gives `Ambiguous filename dup.md; using b/dup.md`. A lookup that returns
    `a/dup.md` for `![[dup]]` in `a/index.md` reports nothing: the name is
    found next to the note. *(Added 2026-10-31
    while coding; which file Obsidian picks for an ambiguous name is not
    measured.)*
- **AC-4 Composed cases.**
  - A ToC item `- [[dup]]` reports once, from the embed it becomes; the ToC
    classification is a lookup (AC-1).
  - A note embedded twice in the document reports its problems twice, once
    per place in the compiled document, as for every other warning today
    (measured: `Part.md` with `![[Gone]]`, embedded twice from `index.md`,
    gives two identical `Missing include` details and a count of 2).
  - A link that is both missing and ambiguous cannot occur (a match is not
    missing).
- **AC-5 Nothing else changes.** The compiled text of the smoke book and of
  `index2compile.md` is byte-identical before and after; only
  `result.warnings`, `warningDetails` and the count change as above.

**Decisions (2026-10-31)**
- **OD-W1:** the false warning of #88 is fixed for the whole class (every
  lookup that only classifies), not only for generated map paths; the
  ambiguous-name report comes with it, because it moves out of the lookup
  anyway. External image embeds (`![logo](https://…)` is removed today and
  reported as `Missing asset`) are a separate issue,
  [#94](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/94): they are
  to be kept as written, without a warning.
- **OD-W2:** an ambiguous name is reported once per link, with its place (not
  once per name, and not left out of the warnings file).

### US-8.2 Handle missing or unreadable inputs safely
**As a** vault owner  
**I want** missing or unreadable files to be reported without aborting the whole
compilation  
**So that** one bad reference cannot destroy the output.

**Acceptance criteria**
- Missing includes produce `<!-- Warning: Missing include: filename.md -->`.
- Unreadable files produce `<!-- Warning: Unreadable file: filename.md -->`.
- Compilation continues after these warnings.
- The final report lists all missing and unreadable references.

## Epic 9 — Entry data from note properties

*(Written 2026-11-07 for [#108](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/108).
Decisions G0-A1 to A9 and B1 to B8 taken 2026-11-05; spikes 2026-11-06 and
2026-11-07; step-0 review: `development/drafts/entry-data-scar-review.md`.)*

A book can lay out some notes as **entries**: a creature, a spell or an item
with a statblock and an illustration. Their data lives in the note's
properties, which US-5.2 removes. This epic keeps the properties of such notes
as a data block for the typesetter, copies the images named in them, lists
each entry once and reports entry notes that never reached the book.
US-9.5 (2026-11-09) adds a second, smaller block, `o2t-details`, for notes
that only keep a few facts.

**The block's reader owns its format (SCAR-040).** The `o2t-entry` block is
specified by its reader, Obsidian2Typst:
[`docs/technical/entry-block.md`](https://github.com/JollyOrc/Obsidian2Typst/blob/main/docs/technical/entry-block.md)
(release 0.12.0). These stories say what this compiler writes and do not
restate the reader's rules. Readers of the compiled file: Obsidian2Typst (PDF
and its statblock preview in Obsidian) and Obsidian itself, which shows the
block as that preview when Obsidian2Typst is installed and as a code block
otherwise.

**Definitions**

- **Whole-note embed:** a note brought in whole, without a heading anchor:
  `![[Fen Hare]]`, `![x](Fen%20Hare.md)`, a ToC list item `- [[Fen Hare]]`
  (US-1.3), and the target of a pass-through wrapper (US-6.5), which is
  processed as if embedded directly. **Not** whole-note embeds: the starting
  file, a section embed `![[Fen Hare#Signs]]`, a pass-through wrapper itself,
  and an embed inside a quote or callout (US-1.5).
- **Entry note:** a note brought in by a whole-note embed whose frontmatter
  has at least one **top-level** key named in `entryMarkerKeys` (compared
  without case).
- **The note's title heading:** the heading the compiler writes for the note:
  the injected or replacing title (US-6.1, US-6.3 to US-6.5).

**Settings** (all text fields, comma-separated; read when a compile starts;
written through `settingsSaver`, US-7.1 AC-S1). Items are trimmed and empty
items dropped; key lists are compared without case.

| Setting | Default | Story |
|---|---|---|
| `entryMarkerKeys` | *(empty: off)* | US-9.1 |
| `entryExcludeKeys` | `aliases, cssclasses, publish` | US-9.1 |
| `entryAssetKeys` | `illustration` | US-9.2 |
| `expectCompiledFolders` | *(empty: off)* | US-9.4 |
| `detailMarkerKeys` | *(empty: off)* | US-9.5 |

Examples (SCAR-019): `entryMarkerKeys` `""` → off; `might` → one key;
` Might , attacks,,` → `might`, `attacks`. `entryExcludeKeys` `""` → nothing
excluded (an `aliases` key is written); `aliases, tags` → `tags` is left out
too. `entryAssetKeys` `""` → no key is treated as an image (an
`illustration` value is written as text, links flattened by US-9.1 AC-9);
`illustration, portrait` → both. With `entryMarkerKeys` empty the other three
entry settings have no effect; `expectCompiledFolders` works on its own.

**Decisions live in tested modules (SCAR-031).** `main.ts` passes the settings
and writes the report; a text check over `main.ts` fails if it decides
anything about entries.

**Two invariants for every story of this epic:**
1. `entryMarkerKeys` and `expectCompiledFolders` empty → the compiled text of
   `basic-vault`, the smoke book and every existing test is byte-identical to
   v0.21.0.
2. `entryMarkerKeys` set, but no note has any of its keys → the same.
3. *(2026-11-09, US-9.5)* `detailMarkerKeys` empty → the compiled text of
   `basic-vault`, the smoke book and every existing test is byte-identical to
   v0.22.0.
4. `detailMarkerKeys` set, but no note has any of its keys → the same.

**Not measured here (SCAR-024):** how Obsidian2Typst lays the entries out
(its US-030 to US-036).

### US-9.1 Keep an entry note's properties as an `o2t-entry` block
**As a** book author
**I want** the properties of my entry notes carried into the compiled file
**So that** the typesetter can print each entry's statblock.

**Acceptance criteria**

- **AC-1 Off by default.** With `entryMarkerKeys` empty every frontmatter is
  removed as in US-5.2 (invariant 1).
- **AC-2 Which notes.** `entryMarkerKeys: might`; `Fen Hare.md` =
  `---` / `might: 3` / `---` / `Fen hares are shy.`

  | Root holds | Block? |
  |---|---|
  | `![[Fen Hare]]` | yes |
  | `![x](Fen%20Hare.md)` | yes |
  | `- [[Fen Hare]]` (ToC list) | yes |
  | `![[W]]`, `W.md` = `![[Fen Hare]]` (pass-through) | yes, under `Fen Hare`'s heading; none for `W` |
  | `![[Fen Hare#Signs]]` | no |
  | `> ![[Fen Hare]]`, `> [!note]` / `> ![[Fen Hare]]` | no |
  | `Fen Hare.md` is the starting file | no |
  | a note with `stats:` / `  might: 3` (nested key) | no |
  | a note with `# might: 3` (YAML comment) / `tags: [a]` | no |
  | a note with `text: \|` / `  might: 3` (inside a multi-line string) | no |

  A note without a block has its frontmatter removed as in US-5.2.
- **AC-3 Place: directly under the note's title heading**, with no blank
  line between, in every title path, and before the note's first body line
  (SCAR-034: heading-first, preamble and pass-through classification read the
  note as if there were no block). Measured title placement with v0.21.0 at
  `5b8e166`; `Fen Hare.md` = `---` / `might: 3` / `attacks:` /
  `  - "Kick: 2d6"` / `---` / *body*:
  - Root `# Book` / `## Beasts` / `![[Fen Hare]]`, body `Fen hares are shy.`:
    - on → `### Fen Hare` / ```` ```o2t-entry ```` / `might: 3` / `attacks:` /
      `  - "Kick: 2d6"` / ```` ``` ```` / `Fen hares are shy.`
    - off → the same with `## Fen Hare`.
  - Heading-first body `# Fen Hare` / `Fen hares are shy.` / `## Signs` /
    `Tracks.`: on → `### Fen Hare`, the block, `Fen hares are shy.`,
    `#### Signs`, `Tracks.`; off → `## Fen Hare`, the block, …, `## Signs`.
  - Pass-through `![[W]]`, `W.md` = `![[Fen Hare]]`, body `# Fen Hare` /
    `Shy.`: on → `### Fen Hare`, the block, `Shy.`; off → `## W`, *(blank)*,
    `## Fen Hare`, the block, `Shy.` (no block under `## W`).
  - Nested: `Section.md` = `Intro.` / `![[Fen Hare]]` embedded from the root
    → the block follows `Fen Hare`'s own heading at whatever depth it has.
  - A body that starts with a list, a table, a fence, an indented code line,
    a quote or a `dataviewjs` block (removed, US-5.1): the block is followed
    by that line, unchanged (SCAR-009). A body that starts with a heading is
    heading-first (above): the title takes that heading's place.
- **AC-4 Content.** Every top-level property of the note except the keys in
  `entryExcludeKeys`, **`tags` included**, in the note's order, keys in lower
  case. `entryExcludeKeys` default: `Fen Hare.md` with `aliases: [Hare]`,
  `might: 3`, `tags: [beast]` → block `might: 3` / `tags:` / `  - beast`.
  This amends US-5.2 for entry notes only.
- **AC-5 Key case.** Two keys that differ only in case: the first one is
  written, in lower case (as the reader does), and the warnings file gets
  `Entry keys differ only in case: Might / might` with the second key as the
  link, the note and the line of the second key. Example: `Might: 3` / `might: 4` → `might: 3`. *(Only YAML
  typed in source mode can do this; the Properties panel refuses it.)*
- **AC-6 Fixed YAML form (G0-A4).** The block is the note's mapping
  serialised by `yaml` 2.9.1 `stringify(value, {nullStr: ''})`, which equals
  what the Properties panel writes (spike 2026-11-06). The library is bundled
  (ISC licence; SCAR-036 licence check; SCAR-042 `main.js` compared before and
  after). Examples (note → block):

  | In the note | In the block |
  |---|---|
  | `might: 3` | `might: 3` |
  | `vigour: "11"` | `vigour: "11"` |
  | `flag: yes` | `flag: yes` (a string, YAML 1.2) |
  | `empty:` | `empty:` |
  | `attacks: ['A: 1d6']` | `attacks:` / `  - "A: 1d6"` |
  | `motto: "Run first: ask later"` | `motto: "Run first: ask later"` |
  | `note: Bite 1d6 #fire` (quoted in the note) | `note: "Bite 1d6 #fire"` |
  | `born: 2026-11-07` | `born: 2026-11-07` |
  | `- B: 2d6` in a list (unquoted, a map) | `  - B: 2d6`, written as is, **no warning** |

  Two notes that hold the same values in different quoting or list style give
  the same block. A value that is a map is written as it is and not reported:
  this compiler doesn't know which keys are printed, and Obsidian2Typst warns
  for the keys it uses (decided 2026-11-07).
- **AC-7 Fence (G0-A5).** The fence is backticks, one more than the longest
  backtick run in the block, at least three: a value holding
  ```` ``` ```` → a four-backtick fence; ``Uses `code` here`` → three.
- **AC-8 Links flattened (G0-A7), by the reader's rule.** In every string of
  every non-asset key (lists included), link markup becomes its display text,
  exactly as Obsidian2Typst's reader shows it: a wikilink or embed its alias,
  else its target as written; with a heading anchor `File > Heading`, or
  `Heading` for `[[#Heading]]`; a Markdown link its text; an image its alt
  text. Bold and italic stay.

  | Value | Written |
  |---|---|
  | `"[[Quick Step]]"` | `Quick Step` |
  | `"[[Skills/Keen Nose\|Keen Nose]]"` | `Keen Nose` |
  | `"[[Skills/Keen Nose]]"` | `Skills/Keen Nose` |
  | `"[[Rules#Grappling]]"` | `Rules > Grappling` |
  | `"[x](https://example.com)"` | `x` |
  | `"**Bite** [[Teeth]]: 1d6"` | `"**Bite** Teeth: 1d6"` |

  An asset key (US-9.2) is not flattened. The `o2t-details` block of US-9.5
  is exempt: it keeps links as in-book links (US-9.5 AC-8).
- **AC-9 Frontmatter that isn't valid YAML.** With `entryMarkerKeys` set, a
  note whose frontmatter does not parse gets no block, its frontmatter is
  removed as in US-5.2, and the warnings file gets
  `Frontmatter is not valid YAML` with the note and the line `yaml` reports.
  Example: `---` / `might: [3` / `---`.
- **AC-10 Read from the note text (SCAR-022).** Properties are parsed from
  the text the compiler already read (US-5.2's frontmatter), never from
  Obsidian's metadata cache, which can lag behind a save.
- **AC-11 Other steps leave the block alone (SCAR-039).** No other step
  changes the block's text or reads it: ToC expansion, embeds of either
  syntax, link conversion (US-2.3), TextMapper, control-fence removal, code
  ranges (US-1.4), section extraction, quoting (US-1.5), blank-line tidying
  (US-6.6), sentinel and marker stripping, output link checks (US-8.3). Test
  for each: a block holding `illustration: "![c](assets/hare.png)"`, a
  value `"- [[A]]"` that looks like a ToC item, `"%20"`, `"<!-- x -->"` and
  `"# Not a heading"` is in the output byte for byte, and no warning names it.
- **AC-12 Warnings name the note.** Every warning of this epic names the
  note's vault path and the line of the key in the note as stored, frontmatter
  included (US-8.4 AC-5).
- **AC-13 The reader reads it back (SCAR-028).** Every block in the tests is
  compared as exact text **and** parsed with `yaml` 2.9.1 to the expected
  values.

### US-9.2 Copy images named in entry properties
**As a** book author
**I want** an image named in a property such as `illustration` to be copied
like an embedded image
**So that** an entry's illustration doesn't have to be an embed in its text.

Measured with v0.21.0 (spike 2026-11-07): the compiler's link resolution and
asset naming already handle every form below when they are reached; the
property route needs its own rules for the alias, invalid values and the
warning.

**Acceptance criteria**

- **AC-1 Forms.** For each key in `entryAssetKeys`, the value is one image
  link. All of these give the same file, `images/hare.png`, copied once with
  US-2.2 deduplication and US-2.5 names:
  `"[[hare.png|Drawn by A. Nobody]]"` (the form a vault should write: Obsidian
  updates it when the image moves, and it shows as a backlink),
  `"[[images/hare.png]]"`, `"[Drawn by A. Nobody](images/hare.png)"`,
  `images/hare.png`, `hare.png`, `"![[hare.png|Drawn by A. Nobody]]"`,
  `"![Drawn by A. Nobody](images/hare.png)"`, `"![](<images/hare.png>)"`.
  Embed forms are read without a warning, though Obsidian doesn't track them
  in properties (decided 2026-11-07). The path is taken out of the value with
  the patterns the embed steps use (`parseEmbedDestination`) and resolved by
  the same `resolve()` (US-0.4, US-3.1), with spaces, `%20`, `<…>`, `../`,
  case and anchors as for body embeds.
- **AC-2 Written as an image with its credit.** In the block the value is
  `"![Drawn by A. Nobody](assets/hare.png)"`, or `assets/hare.png` when there
  is no credit. The credit is the alias or link text. An alias of digits
  only, or digits `x` digits, is not a credit in any form: `[[hare.png|300]]`,
  `![[hare.png|300x200]]` → `assets/hare.png`; `[[hare.png|A. Nobody|300]]`
  and `![A. Nobody|300](images/hare.png)` → `"![A. Nobody](assets/hare.png)"`.
  A link with no alias and no link text has no credit. *Unlike a body embed:*
  `![[pic.png|200]]` in the text still gives `![200](assets/pic.png)`
  (US-2.6 AC-2; guard test).
- **AC-3 Shared with body embeds.** The same image as a body embed and as a
  property gives one file in `assets/` (measured: 1 copied, 1 deduplicated).
  Two different `owl.png` (one in the body, one in a property) give
  `assets/owl.png` and `assets/owl_1.png`.
- **AC-4 Missing image.** The key is left out of the block, nothing else is
  written in its place, and the warnings file gets `Missing asset` with the
  value, the note and the key's line, whatever the form (a body wiki embed
  says `Missing include`).
- **AC-5 Not one local image (G0-B7).** The key is left out and the warnings
  file gets `Entry image is not a local image (<reason>)` with the value:

  | Value | Reason |
  |---|---|
  | a list `["[[a.png]]", "[[b.png]]"]` | `list` |
  | `https://example.com/x.png`, `[[https://example.com/x.png]]` | `web address` |
  | `[[Quick Step]]` (a note) | `note` |
  | `[[sheet.pdf]]` | `not an image` |

  Images are the extensions US-2.1 copies as images. (Measured: without
  these checks a note link put the note's text into the block, a PDF became
  a link and a web address became a local path.)
- **AC-6 Ambiguous name.** Reported as for body embeds (US-8.5), with the
  note and the key's line; the file chosen is the one US-3.1 chooses.

### US-9.3 List each entry once
**As a** book author
**I want** an entry note that two lists bring in to be compiled only once
**So that** the book has no duplicate entries.

**Acceptance criteria**

- **AC-1 Scope.** Only entry notes are deduplicated (`entryMarkerKeys` set).
  Any other note listed twice is compiled twice, as US-1.3 AC-6 says
  (spells of two schools).
- **AC-2 The repeat becomes a comment.** The second and every later
  whole-note embed of the same entry note (same resolved vault path) writes
  one line `<!-- repeat of "Fen Hare" omitted -->` instead of the note,
  where the embed or list item was. The name is the note's file name without
  `.md`; a `--` in it is written `- -`. Root `## Beasts` / `- [[Fen Hare]]` /
  `## Marsh` / `- [[Fen Hare]]` → under `## Marsh` only the comment.
  Obsidian2Typst drops HTML comments (its US-001 AC-15).
- **AC-3 What doesn't count.** Section embeds never count, before or after
  the whole note. Embeds in quotes and callouts neither count nor are
  replaced. A pass-through wrapper whose target was already compiled keeps
  what the wrapper itself writes (toggle off: `## W`), and the target becomes
  the comment.
- **AC-4 Circular embeds come first.** A note that embeds itself (directly
  or through others) is reported as circular (US-1.2) as today, not as a
  repeat.
- **AC-5 Report.** Each repeat adds `Duplicate entry omitted` to the warnings
  file, with the embed as written, the file and the line it is written on.
- **AC-6 Nested repeat.** A repeat inside a note that is itself embedded is
  found the same way, and its line names the note it is written in.

### US-9.4 Report entry notes that were never compiled
**As a** book author
**I want** a list of the notes in my entry folders that didn't reach the
book
**So that** a note with a missing tag doesn't drop out unnoticed.

**Acceptance criteria**

- **AC-1 Folders.** `expectCompiledFolders` names vault folders; every `.md`
  note in them and their subfolders is expected. Values (SCAR-033):

  | Value | Means |
  |---|---|
  | *(empty)* | off |
  | `Creatures` | `Creatures/` and below |
  | `Creatures/`, `/Creatures` | the same |
  | `Lore\Creatures` | `Lore/Creatures` |
  | `Creature` (and `Creatures` exists) | only `Creature/`: whole path segments |
  | `creatures` (the folder is `Creatures`) | not found: names are compared with case, as Obsidian does |
  | `/` | the whole vault |
  | `../x`, `C:\x`, a folder that doesn't exist | ignored, with `Folder not found in the vault: <value>` in the warnings file (link: the value; no file; line 0) |

- **AC-2 What is left out.** The starting file, every file under the output
  folder (US-3.1 AC "output folder"), and `*.excalidraw.md`.
- **AC-3 What counts as compiled (G0-B5).** Only a whole-note embed. A note
  that was brought in only as a section, or only inside a quote or callout,
  is listed with how: `Not compiled (section embed only)`,
  `Not compiled (quoted only)`. Otherwise `Not compiled`.
- **AC-4 Report.** One row per note in the warnings file, sorted by vault
  path, after all other warnings: the message, the note's vault path as the
  link and as the file, line 0.
- **AC-5 Notice (G0-B6).** When any repeat (US-9.3) or uncompiled note was
  found, the completion Notice adds the counts and the warnings file, e.g.
  `Compilation complete: 12 files, 3 assets, 0 deduplicated. 1 duplicate
  entry omitted, 2 notes not compiled: see warnings_20261107_1530.md.`
  A count of zero is not shown; with both zero the Notice is unchanged.

### US-9.5 Keep a note's detail properties as an `o2t-details` block
*(Written 2026-11-09 for [#118](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/118);
step-0 review: `development/drafts/detail-data-scar-review.md`; decisions
taken 2026-11-09. Reader: Obsidian2Typst 0.14.0.)*

**As a** book author
**I want** a few facts of a note (a duration, a kind, a requirement, a flag)
carried into the compiled file as data
**So that** the typesetter can print them as one row under the note's heading,
without the note becoming an entry.

**The block's reader owns its format (SCAR-040).** The `o2t-details` block is
specified by its reader, Obsidian2Typst:
[`docs/technical/details-block.md`](https://github.com/JollyOrc/Obsidian2Typst/blob/main/docs/technical/details-block.md)
(release 0.14.0). This story says what this compiler writes and does not
restate the reader's rules. Readers of the compiled file: Obsidian2Typst (PDF
and its preview in Obsidian) and Obsidian itself, which shows the block as that
preview when Obsidian2Typst is installed and as a code block otherwise.

**Why not `o2t-entry`.** Measured with v0.22.0 (`InMemoryVaultCompiler`,
synthetic notes, `entryMarkerKeys` = the four keys of the example below): the
entry block holds **every** property, `tags` included, and flattens a link
(`[[Quick Step]]` → `Quick Step`); the reader treats the note as an entry (a
page of its own, or `ENTRY_OUTSIDE_CHAPTER`). In the body, a link in a table
cell reaches the book as an in-book link, `[Quick Step](#Quick%20Step)`.

**Setting** (text field, comma-separated; read when a compile starts; written
through `settingsSaver`, US-7.1 AC-S1; items trimmed, empty items dropped, keys
compared without case): `detailMarkerKeys`, default *(empty: off)*. It does two
things: **a note with at least one of these top-level keys is a detail note**,
and **only these keys are written, in this order**.

Examples (SCAR-019): `""` → off; `pace` → one key; ` Pace , kind,,` → `pace`,
`kind`; `kind, pace` → `kind` is written before `pace` whatever the note's
order; `pace, Pace` → `pace` once.

**Measured for the view line.** A `dataviewjs` fence holding
`dv.view("Templates/views/craft-details")` is removed by US-5.1 (all fence
forms, #116) without leaving a blank line, with the note's title directly
followed by the next body line or, with US-9.1 or this story on, by the block
(`# R` / fence / `Text.` → `## R` / `Text.`; a note that is only the fence →
the title alone; a block followed by nothing but the next note's heading is
followed by it directly, as US-9.1 AC-3 says: the empty lines after a block go).
Nothing new is specified for it: AC-11 pins it. The same
text in single backticks is inline code (US-1.4) and stays.

**Definitions.** *Whole-note embed* and *the note's title heading*: as in the
Epic 9 introduction. A **detail note** is a note brought in by a whole-note
embed that has at least one top-level key of `detailMarkerKeys` and no key of
`entryMarkerKeys`.

**Acceptance criteria**

- **AC-1 Off by default.** `detailMarkerKeys` empty → no `o2t-details` block
  and the compiled text of every existing test, `basic-vault` and the smoke book
  is byte-identical to v0.22.0 (invariant 3). Keys set but no note has any of
  them → the same (invariant 4).
- **AC-2 Which notes.** `detailMarkerKeys: pace, kind`; `Reed Weaving.md` =
  `---` / `pace: Brisk` / `---` / `You weave reeds.`

  | Root holds | Block? |
  |---|---|
  | `![[Reed Weaving]]` | yes |
  | `![x](Reed%20Weaving.md)` | yes |
  | `- [[Reed Weaving]]` (ToC list) | yes |
  | `![[W]]`, `W.md` = `![[Reed Weaving]]` (pass-through) | yes, under `Reed Weaving`'s heading; none for `W` |
  | `![[Reed Weaving#Knots]]` | no |
  | `> ![[Reed Weaving]]`, `> [!note]` / `> ![[Reed Weaving]]` | no |
  | `Reed Weaving.md` is the starting file | no |
  | a note with `stats:` / `  pace: Brisk` (nested key) | no |
  | a note with `# pace: Brisk` (YAML comment) / `tags: [a]` / `other: 1` | no |
  | a note with `text: \|` / `  pace: Brisk` (inside a multi-line string) | no |
  | a note with `pace:` (empty) | yes: `pace:` |
  | a note embedded twice | a block each time (no repeat rule: that is US-9.3 for entries only) |

  A note without a block has its frontmatter removed as in US-5.2.
- **AC-3 Place: directly under the note's title heading**, with no blank line
  between, in every title path, before the note's first body line, exactly as
  US-9.1 AC-3 (the same placement code serves both blocks; SCAR-034: heading
  first, preamble and pass-through classification read the note without the
  block). Examples with `Reed Weaving.md` = `---` / `pace: Brisk` / `---` /
  *body*: root `# Book` / `## Crafts` / `![[Reed Weaving]]`, body `You weave
  reeds.`: on → `### Reed Weaving` / ```` ```o2t-details ```` / `pace: Brisk` /
  ```` ``` ```` / `You weave reeds.`; off → `## Reed Weaving` / `You weave
  reeds.`. Heading-first body `# Reed Weaving` / `Text.` / `## Knots` /
  `Tight.`: on → `### Reed Weaving`, the block, `Text.`, `#### Knots`. A body
  that starts with a list, table, fence, indented code line, quote, callout or
  a `dataviewjs` block (removed): the block is followed by that line,
  unchanged (SCAR-009). With this story on, the block follows the title also
  when the first body line is the `dataviewjs` view line (AC-11).
- **AC-4 Content: the listed keys only.** Exactly the keys of
  `detailMarkerKeys` that the note has set, **in the setting's order**, keys in
  lower case; every other property is left out, `tags` too unless listed. A
  listed key the note does not have is left out. Example: setting
  `kind, pace`; note `pace: Brisk` / `kind: craft` / `tags: [x]` / `other: 1`
  → `kind: craft` / `pace: Brisk`. Two keys of one note that differ only in
  case: the first is written and the warnings file gets `Detail keys differ
  only in case: Pace / pace` (second key as the link, its line). *(Only YAML
  typed in source mode can do this.)*
- **AC-5 Values: text, number, flag, empty.** Text and numbers as they are; a
  Checkbox property as `true` or `false` (written as it is); an empty property
  as `key:`. **A list or a map is left out** (the reader would drop it with
  `DETAIL_VALUE_NOT_TEXT`) and the warnings file gets `Detail value is not
  text: <key>` with the key as the link, the note and the key's line. When
  nothing is left to write, the note gets no block (the warning stays).
  Example: `pace: Brisk` / `needs:` / `  - A` / `  - B` → block `pace: Brisk`
  and one warning for `needs`. Obsidian writes `tags` as a list, so listing
  `tags` in the setting gives only that warning; a `tags` value that is one
  text is written.
- **AC-6 Fixed YAML form.** As US-9.1 AC-6: `yaml` 2.9.1
  `stringify(value, {nullStr: ''})`, one key per line:

  | In the note | In the block |
  |---|---|
  | `pace: Brisk` | `pace: Brisk` |
  | `cost: 3` | `cost: 3` |
  | `cost: "3"` | `cost: "3"` |
  | `starter: true` | `starter: true` |
  | `starter: false` | `starter: false` |
  | `pace:` | `pace:` |
  | `motto: "Run first: ask later"` | `motto: "Run first: ask later"` |
  | `note: Bite #fire` (quoted in the note) | `note: "Bite #fire"` |
  | `when: 2026-11-07` | `when: 2026-11-07` |

- **AC-7 Fence.** Backticks, one more than the longest backtick run in the
  block, at least three: a value holding ```` ``` ```` → four.
- **AC-8 Links stay links (G0 answer 4a; exempt from US-9.1 AC-8).** A link
  in a value is converted to the same in-book link as in body text (US-2.3,
  same targets, same warnings), written in Obsidian's heading form, which the
  reader prints as a link: `[[#<heading anchor>|<text>]]`. The text is the
  link's alias or text, else the one body text shows. Measured with v0.22.0, a
  body link `[[Basket Knots]]` gives `[Basket Knots](#Basket%20Knots)`, the
  form this rule converts. `Basket Knots.md` has a section `## Tight` and is
  in the book:

  | Value | Written |
  |---|---|
  | `"[[Basket Knots]]"` | `"[[#Basket Knots\|Basket Knots]]"` |
  | `"[[Basket Knots\|Knots]]"` | `"[[#Basket Knots\|Knots]]"` |
  | `"[[Basket Knots#Tight]]"` | `"[[#Tight\|Tight]]"` |
  | `"[[Basket Knots#Tight\|tight ones]]"` | `"[[#Tight\|tight ones]]"` |
  | `"[Knots](Basket%20Knots.md)"` | `"[[#Basket Knots\|Knots]]"` |
  | `"[[#Tight]]"` (written in `Basket Knots.md` itself) | `"[[#Tight\|Tight]]"` |
  | `"**Needs** [[Basket Knots]]"` | `"**Needs** [[#Basket Knots\|Basket Knots]]"` |
  | `"[x](https://example.com)"` | `"[x](https://example.com)"` (an external link as written) |
  | `"![x](a.png)"`, `"![[a.png]]"` (image or embed) | as written, not copied as an asset (the reader prints the alt text or the name) |
  | `"[[Missing Note]]"` | `Missing Note`, plus the body warning `Missing wiki link` |
  | `"[[Unused Note]]"` (exists, not in the book) | `Unused Note`, plus `link target 'Unused Note' not embedded in compiled output` |

  A converted link whose heading anchor needs a path (the same heading text
  twice) is written `[[#Parent#Heading\|text]]` and gives the body warning.
  Warnings name the note and the line of the key (AC-13). Link conversion
  happens in the link step (US-2.3), when every heading's final text is known;
  the block itself stays out of every other step (AC-12).
- **AC-9 Entry keys and detail keys (G0 answer 2).** A note that has a key of
  `entryMarkerKeys` and a key of `detailMarkerKeys` gets **only the entry
  block**, and the warnings file gets one `Entry keys and detail keys in one
  note: only the entry block is written` with the first detail key as the link
  and its line. Example: `entryMarkerKeys: might`, `detailMarkerKeys: pace`;
  `might: 3` / `pace: Brisk` → `o2t-entry` with `might`, `pace` per US-9.1
  (the entry block's own rules), no `o2t-details`.
- **AC-10 Frontmatter that isn't valid YAML.** With only `detailMarkerKeys`
  set: no block, frontmatter removed, `Frontmatter is not valid YAML` with the
  line `yaml` reports (as US-9.1 AC-9). With both settings set the warning is
  given once.
- **AC-11 The view line is removed without a gap (G0 answer 8).** A note that
  has a `dataviewjs` fence holding `dv.view("Templates/views/craft-details")`
  before its text, or after the properties, or alone: the fence is gone, no
  blank line remains, with the setting on and off; a four-backtick or tilde
  fence of it too (US-5.1 AC-F). No new rule: the tests pin it (SCAR-023).
- **AC-12 Other steps leave the block alone (SCAR-039).** As US-9.1 AC-11:
  ToC expansion, embeds, TextMapper, control-fence removal, code ranges,
  section extraction, quoting, blank-line tidying, sentinel and marker
  stripping, output link checks (US-8.3). Test: a block with `note: "![c](assets/x.png)"`, `needs: "- [[A]]"`, `x: "%20"`,
  `y: "<!-- x -->"`, `z: "# Not a heading"` is in the output byte for byte
  (the one link rule of AC-8 excepted) and no warning names it.
- **AC-13 Warnings name the note.** Each warning of this story names the
  note's vault path and the line of the key in the note as stored,
  frontmatter included (US-8.4 AC-5); a link warning names the line of the
  key whose value holds the link.
- **AC-14 The reader reads it back (SCAR-028).** Every block in the tests is
  compared as exact text and parsed with `yaml` 2.9.1 to the expected values;
  the example block of the reader's page (`pace: Brisk` / `kind: craft` /
  `needs: "[[#Basket Knots|Basket Knots]]"` / `starter: true`) is written
  exactly.
- **AC-15 A long value reaches the block whole (SCAR-015).** A value of 400
  words (more than a page holds) is written in full, in order, in one line of
  the block; nothing is cut and no warning is given.
