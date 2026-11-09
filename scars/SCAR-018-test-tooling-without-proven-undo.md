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
- Applies next to: every mutation run, every scripted refactor, probe setups
  that write into the project, install scripts, manual-check fixtures,
  commits and publishes after a manual check, new files written by a tool.
