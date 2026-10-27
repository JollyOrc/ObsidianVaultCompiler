# Obsidian Vault Compiler

An [Obsidian](https://obsidian.md) community plugin that compiles notes of the
open vault into **one portable markdown document** plus an `assets/` folder.
It starts from a note whose list of links works as a table of contents,
imports every linked note in order (recursively), copies images and other
files once, turns links between notes into anchor links, and draws hex maps
of the Text Mapper community plugin as PNG images.

This plugin was created as an excercise to learn how to use AI agents for 
coding. None of the code was written by hand. I am not a developer - use this
at your own discretion.

## Features

- **Table-of-contents compilation:** any list made only of links to notes
  (`[[Note]]` or `[text](Note.md)`) is replaced by the notes themselves;
  `![[Note]]` and `![[Note#Heading]]` embeds are expanded the same way.
- **Headings:** every imported note gets a heading from its file name; with
  "Normalise headings" on, numbered file names (`1.3.2 Magic.md`) set the
  heading level and all headings nest correctly.
- **Assets:** embedded images, PDFs and other files are copied once into
  `assets/` (duplicates are shared, name clashes get `_1`, `_2` …).
- **Links:** links to compiled notes become anchors in the document; missing
  targets are reported in a warnings file.
- **Clean output:** YAML frontmatter and plugin control blocks (Dataview,
  Meta Bind, Leaflet …) are removed; empty lines are tidied.
- **Hex maps:** `text-mapper` code blocks are drawn by the installed Text
  Mapper plugin and saved as transparent PNGs, optionally with centred,
  wrapped labels and without hex numbers.
- **Safe:** the plugin only reads your notes; it writes only the output file,
  its `assets/` folder and a warnings file, and asks before overwriting.

## Requirements

- Obsidian 1.0 or later (desktop or mobile; writing outside the vault needs
  the desktop app).
- For hex maps: the community plugin **Text Mapper** (id `text-mapper`),
  installed and enabled. It is used at run time and not bundled; without it,
  maps are left as placeholders.

## Installation

### From a release

1. Download `main.js`, `manifest.json` and `styles.css` from a release.
2. Put them into `<your vault>/.obsidian/plugins/obsidian-vault-compiler/`.
3. In Obsidian: *Settings → Community plugins*, enable **Obsidian Vault
   Compiler**.

### Build it yourself

Requires Node.js 18 or later.

```bash
cd plugin
npm ci
npm run build
```

`npm run build` type-checks, lints and runs the whole test suite before it
bundles `plugin/main.js`; it stops at the first failure. To copy the build
straight into a vault, set `OBSIDIAN_PLUGIN_DIR`:

```bash
OBSIDIAN_PLUGIN_DIR="/path/to/vault/.obsidian/plugins/obsidian-vault-compiler" npm run build
```

Other commands (run in `plugin/`): `npm test`, `npm run test:unit`,
`npm run test:integration`, `npm run lint`, `npm run typecheck`, and
`npm run dev` (watch mode).

## Usage

- Command palette: **Compile vault** compiles from the configured starting
  file (default `index2compile.md`).
- File menu: **Compile vault from this file** on any note, with a prompt for
  the output folder and file name.

### Settings

| Setting | Meaning |
|---|---|
| Starting file | The note whose link list is the table of contents. |
| Output folder / Output filename | Where the compiled document goes; `assets/` is created next to it. A folder outside the vault works on desktop. |
| Enable TextMapper rendering | Draw `text-mapper` blocks as PNGs. |
| Map font | Font for map labels; empty uses the font Obsidian shows your notes in. |
| Tidy map labels | Leave out hex numbers, centre labels and break long labels into lines. |
| Normalise headings | Set heading levels from numbered file names and nest all headings. |

## Project documents

- `docs/user-stories/userstories.md` — the specification: every behaviour as a
  user story with acceptance criteria and examples.
- `docs/technical/tests.md` — quality gates and what each test file covers.
- `docs/technical/dependencies.md` — build and run-time dependencies.
- `scars/` — lessons learned during development, written to be reusable.
- `development/` — tickets and architecture decisions.
- `releases/` — release notes per version.
- `CLAUDE.md`, `AGENTS.md` — the working rules this project was developed
  with, including AI-assisted development.

Examples in the documents refer to an example vault and book that are not
part of this repository.

## License

Released into the public domain under the [Unlicense](LICENSE).
