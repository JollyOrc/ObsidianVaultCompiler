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
`<vault>/Users/user/Desktop/My Book.md`, its `assets/` and a
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
  | `/Users/user/Desktop` | `My Book.md` | `/Users/user/Desktop/My Book.md`, `/Users/user/Desktop/assets/…`, `/Users/user/Desktop/warnings_20261027_1106.md` |
  | `/Users/user/Desktp` (does not exist) | `Book.md` | nothing; reason `Output folder "/Users/user/Desktp" does not exist.` |
  | `/Users/user/Desktop` on Obsidian mobile | `Book.md` | nothing; reason `Output folder "/Users/user/Desktop" is outside the vault; writing outside the vault needs the desktop app.` |
- **AC-OL-3 Absolute folder inside the vault.** An absolute folder that is the
  vault root or lies under it is turned into the vault-relative folder and
  then follows AC-OL-1. "Under" means the vault root followed by a path
  separator: a sibling folder whose name only starts with the vault's name is
  outside. Example with the vault root `/Users/user/Vault`:
  | Folder | Treated as |
  |---|---|
  | `/Users/user/Vault` | vault-relative (empty, the vault root) |
  | `/Users/user/Vault/Exports` | vault-relative `Exports` |
  | `/Users/user/Vault Backup/out` | outside the vault (AC-OL-2), not ` Backup/out` |
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
    percent-encoded anchors (e.g. `#Body%20Magic` for a heading named
    `Body Magic`); the compiler decodes these before comparing against heading
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
- **AC-3 Order.** Items are embedded in listed order.
- **AC-4 Nesting.** Nested ToCs expand recursively (an embedded note's own
  ToC lists expand when that note is processed).
- **AC-5 Already embedded.** An item whose note this file already embeds
  explicitly (`![[…]]` or `![…](…)` anywhere in the file) stays a link, for
  both syntaxes alike (existing rule for `[[…]]`, now also for `[x](t)`).
- **AC-6 Same note twice.** A note listed in two ToCs is imported twice, as
  today (e.g. spells of two schools). Notes that only want to point at other
  notes write the links in a sentence, not as a list (the user rewrites the
  glossary entries `Skilltree Branch` and `Reflex Skills`, decided
  2026-10-27).

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

**Acceptance criteria**
- `[[file]]` and `[text](file.md)` become `[label](#slug)` where possible.
- The label (when the link has no text of its own) and the slug come from the
  title that the target file's heading has in the output (the title rule of
  US-6.4), so the anchor always exists: `[[1.2 Third-Level]]` →
  `[Third-Level](#third-level)` (decided 2026-10-27; see KD-1).
- Slugification preserves numeric prefixes
  (`1.3.1 Combat` -> `1.3.1-combat`).
- Missing link targets are reported as HTML comments.

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
  to the rendered file.
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
labels like `Ice Armour|Ice Armour`.)*

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
  Example — the Elemental Magic map (`0403 elementalmagic "Ice Armour|Ice Armour "`)
  shows hex `0403` with a black outline, the label `Ice Armour` (not
  `Ice Armour|Ice Armour`) and the green, pink and orange path outlines.
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
**So that** labels like "Limb Regeneration" stay inside their hex in print.

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
  carry `font-size="20pt"` (26.7 units) and `dy="5px"` unless the map sets its
  own label attributes or a size per label.

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
  - Measured widths (example, at 20pt) `Limb` 55, `Regeneration` 150,
    `Limb Regeneration` 212: two lines, `Limb` / `Regeneration`.
  - `Ice Crystal`, 135 wide: one line, unchanged apart from AC-2.
  - `Above the Elements` with `Above the` 120 and `Above the Elements` 230:
    `Above the` / `Elements`.
- **AC-4 A word wider than `W` is hyphenated** (OD-L2). Its first part is the
  longest prefix that fits on a line of its own — measured with the hyphen it
  gets — keeping at least 2 characters on each side; the rest of the word
  carries on as the next word (and is split again if still too wide).
  - If the word already contains `-` or `&` and the part up to and including
    it fits, it breaks there instead, without adding a hyphen.
  - `Inconvenience` with widths `Inconveni-` 150 and `Inconvenie-` 162 →
    `Inconveni-` / `ence`.
  - `Repair&Manipulate` with `Repair&` 105 → `Repair&` / `Manipulate`.
  - `Regeneration` at 150 fits whole and is not hyphenated.
  - A word whose first 2 characters plus a hyphen are already wider than `W`
    (only possible with a huge label size) is left whole, and the compile
    warns once per map.
  - Text is measured unescaped and written escaped (`&` → `&amp;`).
- **AC-5 Linked labels.** For `"Link|Label"` the `<a href="Link">` stays
  around the label's `<text>`; only the text inside is split into lines.
- **AC-6 Unknown structure.** If a map has no `coordinates-` or `labels-` group
  of the shape above (a different plugin version), that step is skipped for the
  map and one notice per compile says so; the map is never drawn half-changed.
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
  writing the rule; the vault's longest map words are `Repair&Manipulate`,
  `Inconvenience`, `Intimidating`, `Amdidextrous`, `Regeneration`.
- **OD-L3:** `W` = 80 % of the hex width at its centre, line height 1.2 × font
  size, fixed (not settings); to be checked by eye in M15.

**Not measured yet:** the plugin's SVG structure inside Obsidian, and text
widths, which depend on the map font — measured with the canvas in Obsidian at
compile time. The examples' widths are illustrations for the rule, not
measurements.

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

### US-5.2 Remove YAML frontmatter
*(Added 2026-10-27, v0.13.0.)*

**As a** vault owner  
**I want** the YAML frontmatter of every note left out of the compiled document  
**So that** note metadata (tags, plugin settings) never shows up as text, list
items or `---` rules in the rulebook.

Measured on 2026-10-27 with v0.12.0: an embedded note
`---` / `tags:` / `  - ElementalMagic` / `  - Wizardry` / `---` / `Spell text.`
compiled (toggle on) to `# Ice Crystal` followed by the raw YAML lines. The note
counted as a preamble file, so its title went above the `---`. In the example
vault 93 frontmatter blocks (all `tags:` on spell notes) leaked into the
compiled rulebook with either toggle value, adding 186 `---` lines.

**Decision (user, 2026-10-27, measured before it was offered, SCAR-020):** all
frontmatter is dropped; no field (not even `tags`) is carried into the output.
Two other options were measured and declined: a `#BodyMagic #LifeMagic` tag line
under the title, and an italic `*Tags: BodyMagic, LifeMagic*` line.

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
- **AC-2 Preamble note.** Root `![[Ice Crystal.md]]`; `Ice Crystal.md` =
  `---` / `tags:` / `  - ElementalMagic` / `  - Wizardry` / `---` /
  `Spell text.`
  - On → `# Ice Crystal`, `Spell text.`
  - Off → `## Ice Crystal`, `Spell text.`
  - Neither output contains `tags:`, `ElementalMagic` or `---`.
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
- **AC-6 Section embed (US-6.3 AC-7).** Root `![[M.md#Body Magic]]`; `M.md` =
  `---` / `tags: [magic]` / `---` / `# Magic` / `## Body Magic` / `### Spells`.
  - On → `# Body Magic`, `## Spells`.
  - Off → `## Body Magic`, `### Spells` (as written).
  - A YAML comment with the anchor's text is not the section: with `M.md` =
    `---` / `# Body Magic` / `tags: [magic]` / `---` / `# Magic` /
    `## Body Magic` / `### Spells`, the output is the same as above and has no
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
  - `1.3.2 Magic.md` = `# Magic` / `## Body Magic` / `### Spells` → `### Magic` /
    `#### Body Magic` / `##### Spells`.
  - `1.2 Multi.md` = `# First` / `# Second` → `## Multi` / `## Second`.
- **AC-7 Section embeds.** For `![[file.md#Heading]]` and
  `![alt](file.md#Heading)` the target's prefix is not consulted and the
  section's heading text is kept. The section's shallowest heading lands at the
  AC-4 depth, moving up or down; the others keep their distance to it (OD-3).
  - `1.2 Rules.md` = `# Rules` + `![[1.3.2 Magic.md#Body Magic]]` →
    `## Rules`, `### Body Magic`, `#### Spells`.
  - Root `![[M.md#Body Magic]]`, `M.md` = `# Magic` / `## Body Magic` /
    `### Spells` → `# Body Magic`, `## Spells`.
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
- Making anchors unique when two embedded files have the same title (OD-7).

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
  `![alt](B.md)`, `![[B.md#Section]]` or `![alt](B.md#Section)`.
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
  share a title after the prefix is removed. Not decided; see SCAR-011.
  Tracked in [#85](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/85).

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
  Authors' links such as `[Grit](#Grit)` or
  `[Fighting pool](#The%20Fighting%20and%20Success%20Pools)` are left as
  written, so they do not match the slugified anchor of the heading
  (`#grit`). 23 such links in the example vault (2026-10-27). Not decided;
  touches US-2.3 and US-3.1. Tracked in [#83](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/83).

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
(measured 2026-10-27). Not fixed; tracked in [#84](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/84).

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
- A file explorer context-menu item is available for markdown files.
- Selecting it opens the export-path prompt (US-7.3) with the chosen file
  pre-set as the starting file and the configured output path pre-filled.
- The selected starting file is **not** saved to plugin settings; the
  context-menu action is a one-shot compile that does not change the
  default starting file stored in settings.

### US-7.3 Prompt for export path on context-menu compilation
**As an** Obsidian user  
**I want** context-menu compilation to ask for the export folder and filename
before running  
**So that** each compile can choose its destination without changing global
settings first.

**Acceptance criteria**
- Starting from the context menu opens a prompt with output folder and
  filename fields.
- Fields default to the preset output folder and filename.
- Confirming the prompt starts compilation using those values for this run
  only; the values are **not** persisted to plugin settings.
- Cancelling the prompt does not start compilation.

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
