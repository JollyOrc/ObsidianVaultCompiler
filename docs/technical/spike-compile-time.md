# Spike: how long a whole compile takes (UI standard, decision D3 / VC-5)

Measured 2026-11-18 for the UI standard alignment: does a compile take longer than about 2 s, so that it gets a
progress tab that opens after 2 s (the rule of the preferred UI standard, as in Obsidian2Typst 0.16.0)?

> **Corrected 2026-11-18 (spike S1, SCAR-032):** the Node times below call the core **without** the plugin's
> `resolve` callback, so every link goes through the core's own fallback search (a path match, then a file-name
> search over all files). The plugin always passes Obsidian's resolver. Inside Obsidian (spike S1, the same book and
> settings) the core takes **410 ms** on the main thread and 350–407 ms in a worker. The 2.4–2.7 s below belong to
> the fallback path only and say nothing about a compile in the plugin.

**What was timed:** the compiler core, `InMemoryVaultCompiler(...).compile(start)` from `plugin/src/compiler.ts`,
in Node (v22, M1 MacBook, macOS 27.0.1), with `enableTextMapper: true` and `assetFolder: 'assets'`, as
`tests/manual-compile.mjs` calls it; five compiles after one read of the vault's Markdown notes. Read-only: nothing
was written. A whole run inside Obsidian adds the Text Mapper maps, the asset copies, the writes and the check that
the source vault did not change, so these times are a **lower bound** of a run.

| Vault | Markdown notes (characters) | Other files | Notes compiled | Read | Compile, 5 runs |
|---|---|---|---|---|---|
| fixture `tests/fixtures/basic-vault` | 54 (22 671) | 21 | 6 | 12 ms | 8, 3, 2, 3, 3 ms |
| the author's book vault (numbers only, SCAR-035) | 374 (1 063 876) | 204 | 323 | 96 ms | 2560, 2522, 2475, 2437, 2651 ms |

**Result (withdrawn, see the correction above):** a compile of the book takes at least 2.4 to 2.7 s, over the 2 s
line: it gets the progress tab after 2 s. A small vault compiles in milliseconds and keeps the notice only. The whole run's time inside Obsidian is
measured at the story's manual check (not measured here).

## Spike S1 inside Obsidian (2026-11-18)

A throwaway plugin (outside the repository) compiled the vault twice in memory with the plugin's own options: the
core on the main thread with Obsidian's resolver (today), and the core in a Web Worker with the links resolved on the
main thread into a table (US-7.4 AC-6). Numbers only.

| Vault | Read | Core, main thread | Link table | Worker passes (misses) | Worker per pass | Longest main-thread gap during the worker | Equal |
|---|---|---|---|---|---|---|---|
| fixture | 19 ms | 12 ms | 59 entries, 0 ms | 2 (2, then 0) | 10, 2 ms | 20 ms | content, warnings, details, stats: all equal |
| the author's book | 56 ms | **410 ms** | 822 entries, 6 ms | 2 (108, then 0) | 407, 350 ms | 21 ms | content, warnings, details, stats: all equal (same SHA-256) |

Worker start 2 ms; posting the notes 0–1 ms. **Not measured:** a whole run (the maps, the 56 asset copies, the
writes) inside Obsidian.

## Spike S2: a whole run inside Obsidian (2026-11-18)

A throwaway plugin called the installed plugin's own `compileVault` (0.24.0) twice for the author's book, into a
folder outside the vault (nothing written in the vault; the output deleted after counting). Numbers only.

| Run | Whole run | Longest main-thread gap | Files written | Map images |
|---|---|---|---|---|
| 1 | 1181 ms | 459 ms | 68 | 10 |
| 2 | 974 ms | 422 ms | 68 | 10 |

**Result:** a whole compile of the book takes about **1.0–1.2 s**, under the 2 s line: by the rule of US-7.4 AC-7, the
progress tab would not open for it. The longest pause of the main thread is the core (about 0.4–0.46 s).
