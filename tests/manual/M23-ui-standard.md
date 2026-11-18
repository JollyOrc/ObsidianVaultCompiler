# M23 — The preferred UI standard: the compile dialog, settings in sections, notices (US-7.4, #127)

**Covers:** US-7.4 AC-1 to AC-4, AC-6, AC-10 to AC-15; tickets #128 to #133.
**Build under test:** Vault Compiler `0.25.0-m23.1` (branch `us-7.4-ui-standard`).
**Where:** part C in the fixture vault `tests/fixtures/basic-vault/`, opened in Obsidian (desktop); parts A and B in
the author's book vault, read only: a throwaway helper plugin outside the repository compiles the book through the
installed Vault Compiler into a folder outside the vault and records hashes. Mobile is not checked (owner, VC-6).

**Decided before the run (SCAR-032):** each step names what is expected; the check passes when every step shows it.
A difference is written down with its step number and what was seen; nothing is changed during the run. After it,
each difference is a bug (a ticket, fixed and re-checked before the release) or a point the owner decides. A step that
cannot be done is recorded as not run. **AC-6 holds** if the book, every asset and the warnings file's text compiled
by `0.25.0-m23.1` have the same SHA-256 as those compiled by 0.24.0 from the same vault and settings.

## A. The book with 0.24.0 (before the swap)

1. Open the book vault (0.24.0 installed). Command palette: `Vault Compiler S3 compare: compile the book outside the
   vault`. Wait for the notice `S3 done with 0.24.0: … files.` Close the vault.

## B. The book with the test build (after the developer swapped the build)

2. Open the book vault again (now `0.25.0-m23.1`). The same command. Wait for `S3 done with 0.25.0-m23.1: … files.`
   Close the vault. The developer compares the two results and undoes the vault.

## C. The UI in the fixture vault

3. Settings → Community plugins lists **Obsidian Vault Compiler 0.25.0-m23.1**, enabled.
4. Settings → Vault Compiler. The first line reads **`Vault Compiler 0.25.0-m23.1`** with a **bug icon** at its right
   (tooltip `Copy debug info`); no heading with the plugin's name. Sections: **Compile** (open), **Maps**, **Headings**,
   **Entry data** (closed). *Compile* holds `Starting file`, `Output folder` with `Choose folder…`, `Output filename`,
   `Resolved output path`, and ends with `Reset this section to defaults`; so does every section. *Setup:* the fixture
   vault still holds M22's values (`Details/Detail book.md`, `Export`, `detailbook.md`); click *Compile*'s reset button
   and `Reset`, so the steps below start from the defaults (`index2compile.md`, an empty folder, `compiledtext.md`).
5. Click the bug icon: the notice **`Debug info copied.`** Paste the clipboard into a text editor outside the vault
   (the developer names the file): `Vault Compiler 0.25.0-m23.1`, `Obsidian <version>`, `Enabled plugins:` with
   `- obsidian-vault-compiler 0.25.0-m23.1` among them, `Settings file:` and the plugin's `data.json`.
6. In `Output folder` type `Export` letter by letter: `Resolved output path` follows each letter. Press **Tab**. Close
   the settings and open them again: `Export` is kept. In `Output filename` type `ch.md` and close the settings at once
   with **Escape** (no Tab): opened again, `ch.md` is kept.
7. *Maps*: the row `Enable TextMapper rendering` has a toggle and a **gear**; the gear opens `Settings of the maps` with
   `Map font` and `Tidy map labels`. Turn `Tidy map labels` **off**, close the window.
8. *Compile* → `Reset this section to defaults`: the question **`Reset "Compile" to its defaults?`** with the line `The
   settings of this section go back to their defaults.` and the buttons **`Cancel`** (first, focused) and `Reset`.
   Press **Enter**: nothing changes (`Export`, `ch.md` still there). Click the button again and **`Reset`**: the folder
   is empty, the filename `compiledtext.md`; *Maps*: `Tidy map labels` is still **off**. Reset *Maps*: it is on again.
9. Close the settings. The ribbon icon (**combine**, tooltip `Compile vault…`) opens the dialog: **`Compile vault`** as
   the modal's title (no heading inside), `Starting file` `index2compile.md`, `Output folder` empty with `Choose
   folder…`, `Output filename` `compiledtext.md` with **`Compile`** at the end of its row, a grey line (`compiledtext.md
   will be written.` or `… exists (from <date time>) and will be replaced.`), and `More options` with a gear.
10. Type `../x` as the folder: the red line **`Output folder "../x" must not contain "..".`**, `Compile` disabled, Enter
    does nothing. Change it to `Export`: the grey line names `Export/compiledtext.md`. Press **Escape**: the dialog
    closes; nothing was compiled, and the settings' folder is still empty.
11. Command palette **`Compile vault…`**: the same dialog. Folder `Export`, press **Enter**: it compiles; the notice
    **`✅ Compiled Export/compiledtext.md: … files, … assets, … deduplicated.`** (with the warnings' additions, if any)
    for about 5 s; no `Vault compilation started.` notice. Settings: `Output folder` is now `Export`.
12. Ribbon icon again: the grey line **`Export/compiledtext.md exists (from <today> <time>) and will be replaced.`** Click
    the gear of `More options`: the settings open on the Vault Compiler tab. Close them.
13. File explorer: right-click `A.md` → **`Compile vault from this file`**: the dialog with `Starting file` `A.md`.
    `Compile`: the ✅ notice. Settings: `Starting file` is still `index2compile.md`, `Output folder` `Export`.
14. Command palette **`Compile vault`**: it compiles at once — no dialog, no question although the file exists — and
    shows the ✅ notice.
15. In the settings set `Output filename` to empty (Tab), then run **`Compile vault`**: the notice **`Compilation not
    started: Output filename is empty.`** Reset *Compile*.
16. Write down anything that surprised you, then close the fixture vault.

## Results

Run on 2026-11-18 by the owner (macOS, Obsidian desktop).

- **Part A** (0.24.0): passed. Whole run 1075 ms; the book, 57 assets and the warnings file hashed (68 files).
- **Part B** (`0.25.0-m23.1`): passed. Whole run 3109 ms; 68 files hashed.
- **AC-6 holds:** 68 of 68 files have the same SHA-256 in both runs, the same set of files (book, every asset, the
  warnings file's text). The plugin's settings file in the book vault was not changed by the test build.
- **Part C** (steps 3 to 16): all steps passed (owner).
- Not a criterion of this check: part B's whole run took 3.1 s against part A's 1.1 s and the spike's 1.0 to 1.2 s.
  The story dropped the progress tab on the spike's figures; the difference is reported to the owner.
