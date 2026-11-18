# SCAR-018 — Test tooling changes the sources and does not prove that it put them back

**Area:** Process / Verification
**Severity:** Medium — a source file was silently replaced by another during a mutation run; only a checksum check found it, and every later result of the run was invalid

---

## What went wrong

Tooling that edits files for a test (mutation runs, scripted edits, probe
setups) assumed its own effect instead of checking it. Five times in three
stories:

1. A scripted text replace matched nothing (the formatter had already changed
   the line), so a test import was never added (US-016).
2. A mutation script looped over a space-separated string in zsh, which does
   not split it; no backup was made, and 13 mutants piled up in the sources
   (US-016).
3. A listing piped through `head` hid existing backups, so a file was written
   into a folder believed empty (US-016).
4. Mutation backups were stored by file name only. Two sources had the same
   name (`markers/glossary.ts`, `emit/glossary.ts`); the "restore" copied one
   over the other, and the remaining mutants ran against a broken tree. Only
   `shasum -c` at the end showed it; the file was rebuilt to its recorded
   checksum and the whole run repeated (US-017, TICKET-047).
5. A mutation loop restored each mutant with `git checkout -- <file>`. The
   file also held the ticket's own change, not yet committed, so the
   "restore" returned it to the last commit and threw that change away; the
   next mutants ran against the old code. Nothing was checked after the
   restore; the loss showed only because `git diff --stat` no longer listed
   the file. The change was applied again and the mutation run repeated from
   a backup copy (2026-11-07, Vault Compiler #116).

## Root cause

Each tool step was treated as done when the command ran without an error, not
when its effect was shown. A mutation run in particular trusts its undo: if
the restore is wrong, every later mutant tests something else, and the report
("all caught") is false evidence.

## Prevention

- Back up every file a run may change by its full relative path (mirror the
  tree: `mkdir -p "$S/$(dirname "$f")"; cp "$f" "$S/$f"`), never by its base
  name, and write a checksum list of the originals before the first change.
  Recurrence (2026-11-12, Obsidian2Typst #166): the backups were named
  `bak-<basename>`; `entries/processor.ts` and `details/processor.ts`
  collided, a restore wrote the wrong file back, and the mutants that
  followed ran on a broken tree. The checksum list at the end showed it; the
  run was repeated. The run's `run()` helper now does the restore and
  `shasum -c` of the whole list after every mutant, so a bad restore stops
  the run at the first mutant, not at the end.
- Restore from the run's own backup, never with `git checkout`, `git restore`
  or `git stash`: git returns a file to a commit, not to the state the run
  started from, and the uncommitted work under test is lost with the mutant.
  Git is a valid undo only for a file proven unchanged since the last commit
  (`git diff --quiet -- <file>` before the run). Example (2026-11-07, Vault
  Compiler #116): see item 5 above.
- After every restore, check the whole list (`shasum -a 256 -c`). A failed
  check stops the run at once; the results of the run are void and the run is
  repeated after the sources are proven equal to the checksums.
- A scripted edit asserts its match count before writing (`count == 1`); a
  failed match restores and is reported as "match failed", never as a result.
- Use arrays for file lists in shell scripts, and never cut a listing (`head`)
  that decides whether to write.
- Record the baseline (test counts before any mutant) in the same run, so a
  mutant result is read against measured numbers.
- Report a mutant as caught only when it ran on a tree that was verified
  before and after it.
- Read a surviving mutant as a finding about the tests, not as noise: what
  makes a test input unable to reach a rule is in SCAR-023 (moved there on
  2026-10-22; item 7 of this list before that date).
- The backup that a restore returns to holds the state to return to: for a
  manual check that changes a fixture, the state as handed over (after the
  ticket's own setup), and, when the ticket itself changed the fixture, also
  the state before it — each with its checksum list. Example (2026-10-22,
  M13): the preset note was backed up before the ticket added its
  `template:` line, so the backup could not serve the compare after the
  check; split into `before/` and `handover/`.
- The file list of a scripted edit is checked, before the run, against files
  that change only with the user's approval (`CLAUDE.md`, the state files);
  those are left out and edited by hand on the user's go. Example
  (2026-10-27, TICKET-072): `CLAUDE.md` was in a scan's file list and the
  first run changed it; restored at once from the backup.
- After a manual check, the first step back is `git status`: any change the
  check left in the sources or fixtures (a test note, an added line) is shown
  to the tester and set aside or restored before anything is committed. Stage
  files by name, never with `git add -A` or `git add .`, and read the staged
  list (`git diff --cached --stat`) before each commit. A publish step that
  copies the working tree, not the commit, needs the same check before it
  runs. Example (2026-10-31, Vault Compiler v0.17.1): an embed line and an
  empty note left by the manual check went into a commit through
  `git add -A`; the publish copy showed them, and they were taken out before
  the push.
- Before a tool writes a file meant to be new (a test file, a fixture, a
  generated note), check that its path is free (`test -e`, or a tool that
  refuses to overwrite) and pick another name if it is not. A name that fits
  the topic is the name an earlier file on the same topic already has.
  Example (2026-11-01, Vault Compiler #103): the tests for "code is copied as
  written" were written to `code-blocks.test.ts`, which held the KD-3 tests;
  the overwrite was seen from the tool's "updated" message, the file restored
  from git and proven equal to the commit, and the new tests moved to
  `code-as-written.test.ts` before anything was committed.
- A script that runs an outward step in a loop (closing issues with a
  comment, posting, uploading, publishing) first builds every input it will
  send, checks each one (the file exists, is not empty, holds the value it
  should), and only then makes the first outward call; the outward command
  itself does not stop on an empty input. Word splitting differs between
  shells (zsh does not split an unquoted variable, bash does), so a loop
  over pairs uses an explicit separator or an array, never `set -- $x`.
  Example (2026-11-09, Obsidian2Typst release 0.13.0): a loop meant to write
  six comment files and close six issues with them wrote the files under
  wrong names in zsh; `gh issue close --comment "$(cat missing-file)"` then
  closed all six with an empty comment. The comments were added afterwards
  from corrected files, checked first.
- A scripted edit that places text by a slice (from one phrase to another)
  asserts the match count of both ends and that the slice is not empty, not
  only the count of the text it replaces; and a file that no git history
  protects (a state file, a ledger) is copied away before the edit. Example
  (2026-11-09, Obsidian2Typst #152): a script found its end phrase in an
  earlier entry too, the slice was empty, and `replace('', text)` put the
  text between every character of the ledger (648 MB). The size check of the
  next gate found it; the file was rebuilt by removing every copy of the
  inserted text, which was possible only because that text was known.
- A snapshot of a file that may be restored as it is gets a content
  check (not empty, parses in its format), not only a checksum against its
  source: a checksum proves the copy equals the source, also when the
  source was already empty. Example (2026-11-11, webpage-export M12): the
  plugin's settings file was empty when it was snapshotted; the check
  reported it "unchanged", and the empty copy would have been the undo.
  An older snapshot (with a content check) was used instead.
- A formatter or other tool that rewrites source can change a character
  without changing how the line looks: after an automatic reformat, search the
  changed files by program for characters that cannot be seen (byte-order
  mark, zero-width and bidirectional control characters, non-breaking space)
  and write such a character as a visible escape in a string that the tool
  leaves alone. Example (2026-11-11, Game Card Creator US-002 #3): Prettier
  rewrote the escape `\uFEFF` in a regular expression into the literal
  invisible character; two tests still passed, and only a text check that
  looked for the escape noticed.
- The checksum list is itself checked before it is relied on: its line count
  equals the count of the files it covers and `shasum -c` reports every line
  `OK` before the first change. File names with spaces break `xargs`; write
  the list with null-separated names (`find -print0 | xargs -0`). Example
  (2026-11-16, Game Card Creator US-009, M07): the first list of the scratch
  vault was garbled by names with spaces; `shasum -c` reported errors, the list
  was rebuilt (315 lines, 315 files, all OK) before anything was changed.
- A difference the run did not cause is reported, not explained away or
  guessed, and restored only from a byte-identical backup whose checksums equal
  the list. Example (2026-11-16, same check): after the undo five files of an
  unrelated plugin folder were missing; the cause stayed unknown, a backup of an
  earlier check had all five checksums, the folder was restored from it and the
  whole list then matched.
- The backup of a manual check holds every file the checked program writes
  while it runs, not only the files the installer writes: its settings and
  data files (chosen presets, last folders) and the notes it creates next to
  the notes it reads. The starting checksum list says which files exist; only
  a backup says what was in them. Example (2026-11-16, Obsidian2Typst M30):
  the backup held the installed plugin's three files and the plugin list;
  the plugin rewrote its own `data.json` when the tester chose presets and
  exported, and the export wrote a warnings note into the vault. The original
  `data.json` was recovered only because an earlier check's backup happened
  to hold the same bytes (found by checksum); otherwise the undo would have
  been a reconstruction.
- A mutation or backup script runs in a named shell (`bash script.sh`, or a script in a language with real lists)
  and refuses to start unless its checksum list holds the expected number of files and verifies. Example
  (2026-11-16, Game Card Creator US-011 #40): a backup loop over `FILES="a b c"` in zsh copied nothing (zsh does
  not split the word), so the restores after the mutants restored nothing; found when the file count of the list
  was read.
- For a manual check in a small fixture (a scratch vault of a few hundred
  MB), the backup is a full copy of the fixture, proven against the checksum
  list, rather than a list of the files the checked actions write: the undo
  then does not depend on predicting them. Example (2026-11-18, Obsidian2Typst
  M33, after M32 missed a warnings note): a full copy of 315 files (271 MB);
  the run also wrote a note nobody had predicted (`… export warnings export
  warnings.md`), and the undo held, 315 of 315.
- A build that deploys into a test vault is itself a writer: the snapshot of
  that vault is taken before the first build of the check, not after the
  test build is in place. Example (2026-11-18, Vault Compiler M23): the test
  build was deployed into the fixture vault before its full copy was made, so
  the plugin files that had been there had no backup; the undo restored them
  from the files of the previous GitHub release instead of from the run's own
  backup.
- A tool's hooks can run git: before a release step runs a command with
  lifecycle scripts or hooks (`npm version` runs the package's `version`
  script), read what they run. A hook that stages or commits is switched off
  (`--ignore-scripts`) and its other steps are run one by one, so that the
  git action stays its own command (rule 14). The same goes for git used to
  tidy up: removing a tracked file is a file removal, not `git rm`. Examples
  (2026-11-18, Vault Compiler US-7.4): the release checklist's `npm version`
  runs `node version-bump.mjs && git add manifest.json versions.json` (the
  webpage-export fork has the same script); found while preparing release
  0.25.0, before it ran. In the same story a `git rm --cached` ran while a
  test file was being removed, without the owner's word; it failed on a wrong
  path and changed nothing.
- Applies next to: every mutation run, every scripted refactor, probe setups
  that write into the project, install scripts, manual-check fixtures,
  commits and publishes after a manual check, new files written by a tool.
