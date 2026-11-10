# Agent rules shared by the three plugins

The common development directives of Obsidian2Typst, the Obsidian Vault
Compiler and obsidian-webpage-export. Each project's `CLAUDE.md` imports this
file with the line `@scars/AGENT-RULES.md` and adds only what is its own: the
project context, where things are, its quality gate commands, its
architecture, the meaning of rules 1, 2 and 5 to 8 for
its output, and its release steps. Where a project file and this file
disagree, the project file wins for that project, and the difference is
reported to the user.

The rule numbers 1 to 13 are cited from stories, tests, ledgers and commits
in the projects; they are never renumbered. A new rule takes the next free
number.

Edit this file like a SCAR: only in the scars repository, never in a
project's `scars/` folder; then update the submodule pointer in every
project (rule 14).

---

## Development process

Follow this order strictly — do not skip ahead:

0. **SCAR review** — before touching any user story, test or code, read
   `scars/README.md` and every SCAR file under `scars/`, and check the new
   instructions, issue or user story against the Prevention list of every
   SCAR, using the shared gate table [`GATES.md`](GATES.md). Flag
   any gap to the user before proceeding; do not paper over it with a guess
   or a TODO.

   **After** a problem is resolved or a requirement is refined, ask: can the
   root cause be generalised beyond this specific case? A SCAR is warranted
   when the same underlying failure mode could recur on any future feature,
   not just the one just fixed. A process mistake of the agent itself (the
   user points it out, or the agent notices it) is asked the same question.
   If yes: first check whether an existing SCAR covers the pattern — a new
   prevention point goes into that SCAR, not a new one. Otherwise add a new
   SCAR (next free number, existing format, project named in its example)
   with its line in the index of `scars/README.md` and its row in
   `scars/GATES.md`, in the same commit.
1. **User story** — write or amend the story and acceptance criteria first.
2. **Tests** — specify and implement tests against the acceptance criteria.
3. **Tickets** — create the work items as GitHub issues of the project
   (ticket format and labels: the project's `CLAUDE.md`); a ticket is closed
   as completed when it is done.
4. **Code** — write the implementation against the tests and tickets.

Working pattern: the user says "go", one step is done and reported.

---

## Code style

All code follows the **Google Style Guides**
(<https://google.github.io/styleguide/>): TypeScript
(<https://google.github.io/styleguide/tsguide.html>), Markdown
(<https://google.github.io/styleguide/docguide/style.html>), shell
(<https://google.github.io/styleguide/shellguide.html>).

- Strict type checking (`"strict": true`); no `any` without a justifying
  comment.
- ESLint (`typescript-eslint`, plus the project's own plugins) and Prettier;
  no lint findings at release.
- Documentation comments on all public APIs.

### Function documentation

Every function and method carries a comment header that names its user
story and acceptance criterion and says what it does, what it assumes, and
any non-obvious constraint (clamping, ordering, side effects):

```
/**
 * US-3 | AC-4: Output records are normalised before writing.
 *
 * Applies [transformation] to [input] so that [postcondition].
 * Assumes [precondition]. Values exceeding [limit] are clamped to [limit].
 */
```

---

## Agent rules

1. **Stories are the source of truth for behaviour.** When a story changes,
   update the story index and the ticket issues (ticket ids are issue
   numbers, `#NNN`). An issue, backlog topic or feature request becomes a
   story only through steps 0 and 1, and the story links it. Archived ticket
   files are not changed.
2. **Never modify source or fixture files.** The plugin never changes the
   user's notes, attachments or plugin data; a fixture vault changes only
   through its generator; generated files go only to the configured output
   location. **No real data** (notes, books, vaults, names from real use)
   goes into a repository, its fixtures, tests or public text, not even
   temporarily; measurements on a real vault are kept as numbers (SCAR-035).
   What a project may do with a private working copy of a vault is stated in
   its `CLAUDE.md`, and every such change can be undone from a checked
   snapshot (SCAR-018).
3. **Run the full quality gate** of the project before declaring any task
   complete. A step that did not run is never reported as passed; a test is
   skipped only with a `skip` marker and a linked issue.
4. **When behaviour is ambiguous, ask** instead of guessing. A wrong
   assumption costs more to fix than a clarifying question.
5. **Keep generated and derived files separate** from source files.
6. **Generated output is valid** in its target format; every piece of user
   text passes through the one escaping or text-setting function for that
   format, and a code path that emits user text without it is a bug.
7. **Our own transformations are deterministic:** same input and settings,
   same output, with no clock, random value or global state.
8. **Problems are warnings with a source location.** Never a silent abort,
   never a hang, never silently wrong output; one failing piece does not
   stop the rest.
9. **State directory `docs/state/`** (the `init.d` of the project;
   git-ignored, local working state). It holds what must survive a context
   compaction. Files, in lexical order:
   - `00_governance.md` (write-once; amended only when the user changes the
     process): the workflow, the approval airlocks and the user's decisions,
     with dates.
   - `10_ticket.md` (replaced at each ticket selection): story and ticket
     ids, the ACs addressed, the SCARs the ticket names.
   - `20_plan_approved.md` (written after the user's "go" for the ticket):
     the approved file list and the invariants that must hold.
   - `30_scar_checks.md` (**append-only**): the SCAR ledger. One entry per
     SCAR gate: date, gate, story or ticket, and every SCAR as `ok`, `gap`
     (where it was fixed) or `n/a` (reason), each with its evidence (file,
     test name, command output). A gate that found gaps is followed by an
     entry that shows them closed.
   - `99_next_action.md` (overwritten at each target): the checklist,
     `Current Target`, `Last Completed Step`, `Next Permitted Action` and
     `SCAR gate due`.

   **SCAR gates.** The review of step 0 is repeated at every handover
   between steps; no step starts or ends without its entry in
   `30_scar_checks.md`. G0 story review, before a story or an amendment is
   written (every SCAR); G1 story written, before tests; G2 tests written,
   before tickets; G3 tickets written, before code (each ticket's "SCAR
   check" section goes through the Prevention list of every SCAR, item by
   item); G4 before a ticket is declared done and before every manual-test
   handover (with the gate and the pass counts); G5 closing a story — does
   anything found generalise into a SCAR? Which SCARs are checked again at
   G1, G2 and G4 is the shared table `scars/GATES.md`.
10. **Bootloader.** On the first turn of every session and after every
    compaction, read all of `docs/state/*.md` in lexical order before any
    other action and reconcile `99_next_action.md` with the user's latest
    directive. The compaction summary never overrides these files. A missing
    file is reported (`?Assert`, rule 13) and recreated from the repository,
    not guessed.
11. **Update discipline.** Update `99_next_action.md` at every change of
    target and at every user directive, not while a long background run
    (test suite, build, mutation run) is going. Read only the last 15 lines
    of a running job's log.
12. **A question is not a directive.** "Did you …?", "Is X checked …?",
    "Why …?" are answered truthfully and the turn ends. The answer may name
    a gap and offer a fix (a `?Counter-Offer`), but nothing changes until a
    directive ("do", "fix", "go", "add") arrives.
13. **Committed speech (Fernando Flores): the user is the `Customer`, Claude
    is the `Performer`.** A request has the form `[DO X] by [BY-WHEN]`; when
    no `BY-WHEN` is given it is this turn, and Claude says so. Before any
    `?Promise`:
    - `?Assert` — check the physical facts the request depends on (files,
      directories, tool and API output, code, versions, git state) with a
      tool call. Do not answer from memory or from the compaction summary.
    - If every premise is true and the request is sensible and doable by the
      `BY-WHEN`, issue the `?Promise` in one or two lines: what will be done
      and the conditions of satisfaction (what the user will be able to see
      or run).
    - If a premise is false, ill-advised, or the `BY-WHEN` is not realistic,
      issue a witnessed `?Counter-Offer` (what is false, with the evidence;
      what is offered instead) or a `?Decline` (what cannot or should not be
      done, and why). Then wait. Do not start a changed version of the work
      and do not silently do something else. Do the unaffected parts only if
      they stand alone, and say which.
    - "Witnessed" means in writing in the chat (`AskUserQuestion` when the
      answer is a choice). A promise, counter-offer or decline that is only
      in a file or in thinking has not been made.
    - When the work is done, report it as a declaration against the stated
      conditions of satisfaction, with the evidence (command output, counts,
      file names), and let the user accept it. Never report more than the
      evidence shows. When a promise cannot be kept, say so before the
      `BY-WHEN` and renegotiate; do not let it lapse.
14. **Git only on the user's word.** No commit, push, tag or release unless
    the user asks. Commits stage files by name. A change to the shared scars
    repository is pushed first (on the user's go); then each project runs
    `git submodule update --remote scars` and commits the new pointer.
15. **Subagents.** Subagents run on the default model set in the user's
    settings. Do not choose a larger model on your own; for a long gated run
    (stories → tests → tickets → code → release), say that it is one and let
    the user decide which model it gets.

---

## Documentation maintenance

When behaviour changes, update every affected document: the story and the
story index, the ticket issue, the project's dependencies document and its
tests document (AC-to-test map). Keep them coherent with each other and with
the implementation; stale documentation is a bug.

## Versioning

Semantic versioning: bug fixes and ticket-driven changes bump at least the
patch, new features the minor, breaking changes the major. The version is
the same in every manifest (`package.json`, `manifest.json`,
`versions.json`). Each release has its notes in `releases/vX.Y.Z.md`
(version and date; features, changed behaviour, fixes; breaking changes and
migration; stories and issues addressed; the test count) and a line in
`releases/RELEASES.md`. The project's release steps are in its own
documents.
