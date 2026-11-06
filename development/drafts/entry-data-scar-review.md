# Step-0 SCAR review — #108 Entry data from note properties

**Date:** 2026-11-05
**Scope:** epic #108; the drafts in `entry-data-tickets.md` (proposed US-9.1 to US-9.4, and an amendment to US-5.1)
**SCARs:** the shared set at `scars/` (45 SCARs; this project's old 026 to 034 are now 033 to 041)
**Result:** 30 gaps (2 conditional: 036, 042), 14 questions for the user. Stories not started.

## Measured (source v0.21.0, `InMemoryVaultCompiler.compile`, synthetic notes)

- Code blocks fenced with ```` ```dataviewjs ```` are removed (`controlLanguages`, `compiler.ts:657-664`). For the shape lede, blank line, `dataviewjs` block, blank line, `### Signs`, one blank line is left.
- Three forms are **not** handled, because the removal regex `'```'+lang+'[\s\S]*?```'` only matches a fence of exactly three backticks:
  - `~~~dataviewjs` stays as code
  - a four-backtick ```` ````dataviewjs ```` fence leaves a stray ```` `` ```` line
  - a `dataviewjs` block inside a quote leaves an empty `> ` line
- A note listed in two ToCs is compiled twice. This is on purpose (US-1.3 AC-6).

## Read in the code

- Frontmatter is dropped only in `readNote` → `splitFrontmatter`, which discards the YAML. A text check pins this (`frontmatter.test.ts:235`).
- No YAML parser is bundled. Obsidian offers `parseYaml` and `stringifyYaml`.
- The note title is written in 4 places:
  - `applyHeadingNormalisation` (toggle on)
  - the `${heading}\n\n${body}` branch (toggle off)
  - `expandPassThrough`
  - the bold title of a quoted note
- `startsWithHeading`, `matchPassThrough`, `codeLines`, `blockCodeShift` and `lineMap` all read the content after frontmatter removal and before the title.
- The "statistics report" is only the Notice at `main.ts:328`, which shows three numbers. "spec 6.3" and "spec 7.4", cited in the drafts, don't exist; the right references are US-1.2 (circular embeds) and US-6.2 / US-8.4 (reports).

## Checklist

| SCAR | Verdict | Evidence / what's missing |
|---|---|---|
| 001 | gap | `splitFrontmatter` would have to return the YAML. `assetTag` returns markdown and URI-encodes the path, so split out a function that returns only the path. |
| 002 | gap | Composed cases missing: toggle on/off, heading-first note, preamble, pass-through, section embed, root, quoted embed or callout, block with a repeat, repeat inside a cycle, US-2.3 AC-3/AC-5. |
| 003 | ok | Stubs per AC at step 2. |
| 006 | ok | `npm run build` runs typecheck, lint and tests. |
| 007 | gap | One example only, and it came from real data (replaced since). Exact examples missing for: trigger vs written keys, YAML types, each image link form, a missing image, a repeat line, the "Not compiled" lines. |
| 008 | n/a | No drawing API. |
| 009 | gap | A value containing ```` ``` ```` or `~~~` ends the block early. Untested: the block followed by a list, table, heading, fence or indented code; the block at the start of the document. |
| 010 | gap | Heading → fence and fence → body joins. The fence must be longer than any backtick run in a value, or use `~~~`, agreed with Obsidian2Typst. |
| 011 | ok | `usedAssetNames` handles clashes. Still needs an example: a body image and a property image with the same basename from different folders. |
| 012 | gap | The joint check needs both build versions named and a synthetic fixture in `basic-vault`. |
| 013 | n/a | No dialog. |
| 014 | n/a | No destructive action. |
| 016 | ok | Settings are read at run time. New fields go through `settingsSaver`. |
| 017 | gap | Class lists incomplete. Heading placement: 4 title paths, section embed, root. Fence readers: see 039. Removed languages: backtick-only, as measured above. |
| 018 | ok | No new tooling. |
| 019 | gap | Each new setting needs examples at its default, both ends and one other value, each with the toggle on and off. |
| 020 | gap | Measure before offering: YAML copied as written vs re-serialised; `parseYaml` vs a library vs a line scan; the form of a repeat; whether the repeat setting defaults on. |
| 021 | n/a | No layout read-back. |
| 022 | gap | Read properties from the text that is already read, not from `metadataCache`, which updates late. |
| 023 | gap | Guard search done (see below). Specify what an absent option means. Add an asset-path stand-in. |
| 024 | gap | Not measured: the form Obsidian's Properties panel writes; how property links resolve; how Obsidian2Typst's `yaml` 2.9.1 reads `yes`, dates, `"9"`, `: ` and `#`. |
| 025 | n/a | Renders nothing. |
| 026 | gap | Only top-level keys may trigger. A YAML comment, a nested key or a multi-line string must not. A repeat means the same resolved path. |
| 027 | gap | US-9.1 replaces the US-5.2 decision; US-9.3 replaces US-1.3 AC-6. List each user of both (the tests below, US-2.3 AC-3/5, US-8.5 AC-4, US-1.4 AC-6, about 18 repeated notes in the author's book, Obsidian2Typst's quick-reference rule). |
| 028 | gap | Tests parse the block with the reader's parser and also compare the exact text. |
| 029 | gap | The joint check M21 goes in a file of its own. |
| 030 | n/a | No heavy test work. |
| 031 | gap | Decisions in tested modules. `main.ts` only passes things on, guarded by a text check. |
| 032 | gap | "dataviewjs is removed" holds for top-level backtick fences only. The alphabetical order comes from Dataview Serializer, not from the compiler. |
| 033 | gap | `expectCompiledFolders` needs a table of path values (empty, `/`, trailing `/`, `..`, absolute, a sibling-prefix folder, case, the other separator, a missing folder). |
| 034 | gap | The block must go in after the title in each title path. Otherwise heading-first and pass-through classification and `lineMap` break. Frontmatter Obsidian shows but this compiler doesn't detect (BOM, `...` closing) is not measured. |
| 035 | gap | The draft and public #108 examples were a light rename of real data. The drafts are fixed (invented `Fen Hare`); #108 still has it. |
| 036 | gap (cond.) | Licence check if a YAML library is bundled. |
| 037 | n/a | User settings win (`Object.assign`). |
| 038 | gap | The "embedded" set is filled only where a note is really embedded. Reports go to a place users read, each problem once, tested as an exact list. |
| 039 | gap | Readers of the block to test with the block present: TextMapper fences, the control-fence regex, the SerializedQuery scan, `codeRanges`/`codeLines`/`codeBlockMask`, `unclosedFence`, `expandTocLists`, `markLinks`, `extractSection`, `quoteLines`, `convertLinks`, `sanitizeOutput`, `tidyBlankLines`, sentinel stripping. |
| 040 | gap | Readers: Obsidian2Typst (`entry-block.md`, not written yet) and Obsidian's reading view, where the block shows as code. Tags conflict: Obsidian2Typst prints tags, but the spec leaves them out of the block. |
| 041 | gap | The draft's quote-embed test contradicts US-1.5. Proposed: no block in quoted content, with examples for a quote, a callout and a nested quote. |
| 042 | gap (cond.) | `main.js` checksum before and after any new dependency. |
| 043 | gap | Not-compiled counts must exclude the output file, warnings files, `assets/`, `.excalidraw.md` and templates. |
| 044 | gap | The settings-writes count test changes with each of T-9.1 to T-9.4. Name the updating ticket each time. |
| 045 | gap | Measure in the user's Obsidian (resolver, YAML as Obsidian writes it, Obsidian2Typst reading the result) before the stories build on it. |

**Guard search for the tickets (SCAR-023):**
- `frontmatter.test.ts:45/118/206/235`
- `settings-writes.test.ts` (count 4)
- `compile-basic.test.ts:234-275`
- `obsidian-anchors.test.ts:239/350`
- `warnings-once.test.ts:155`
- `code-as-written.test.ts:211`

## Proposed changes to the stories

1. Split the keys that turn the block on from the keys written into it, with an exact example.
2. Decide whether tags go in the block, and amend the US-5.2 decision explicitly.
3. Insert the block after the title, once in each title path, with the exact output at both toggle values. Heading-first and pass-through classification ignore the block. State the source lines of the block (US-8.4 AC-5).
4. Fence safety: use a longer fence (or `~~~`) when a value contains backticks, agreed with Obsidian2Typst.
5. YAML form: either copy the lines as written, or use Obsidian's `stringifyYaml`. Round-trip every value type through `yaml` 2.9.1.
6. US-9.1 waits for Obsidian2Typst's `entry-block.md`. Name both readers and list what isn't measured.
7. Synthetic examples everywhere, plus a synthetic entry chapter in `basic-vault`.
8. Property images: a path-only asset function, and exact examples for each link form, a URL, a `.md` target, a list, a missing image and a basename clash.
9. Repeated embeds:
   - amend US-1.3 AC-6
   - emit a note link (US-2.3 AC-3), not `[[#Heading]]`
   - give the exact wording
   - cover section vs whole note, pass-through, a quoted occurrence and a cycle
   - say what an absent option means
   - update the TT-2.1 tests
10. Name where the duplicate and not-compiled lists appear, with exact lines in a fixed order.
11. Not-compiled: the path table and the exclusions; name notes by vault path; say what counts as compiled.
12. US-5.1 amendment: one rule for every fence form and for every control language (the three failures above as examples).
13. Key matching: top-level keys only; decide case sensitivity.
14. Settings matrix, decisions in tested modules, and the planned changes to the count test.
15. Read properties from the note text. Measure in the user's Obsidian. M21 in its own file with both versions.
16. Put the guard list in the tickets. Two invariants: with the setting empty, the output is byte-identical; with the setting set but no note having the keys, the fixture books are byte-identical.
17. Replace the "spec 6.3 / 7.4" references.
