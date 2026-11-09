# SCARs — Situation, Cause, Action, Resolution

This repository holds the **SCAR documents** shared by three projects:
Obsidian2Typst, the Obsidian Vault Compiler and obsidian-webpage-export. A
SCAR is a post-incident writeup for something that went wrong during
development. Each one is written to be project-independent: the lesson should
apply to any software project, not just the one where it happened.
Project-specific implementation bugs live in each project's git history;
SCARs are for patterns that will recur if not consciously addressed.

Each project includes this repository as a git submodule at `scars/`, so all
three read the same files under the same numbers. How and when SCARs are
checked (the gates) is part of each project's own process, in its `CLAUDE.md`.

## Adding or changing a SCAR

- Edit here, in this repository, never inside a project's `scars/` folder.
  Then update the submodule in each project
  (`git submodule update --remote scars`) and commit the new pointer there.
- A new SCAR takes the next free number. Numbers are never reused or changed.
- Name the project in every example: "(2026-11-05, Obsidian2Typst US-030)".
  Examples written before 2026-11-05 without a project name come from the
  project in the Origin column.
- A new prevention point for an existing SCAR is added to that SCAR, not
  written as a new one.

## Format

Each SCAR covers:

- **What went wrong** — the observable symptom, with a brief project example
- **Root cause** — the underlying reason it happened
- **Prevention** — concrete changes to process or practice

## Index

| ID | Title | Area | Severity | Origin |
|----|-------|------|----------|--------|
| [SCAR-001](SCAR-001-shared-utility-undocumented-transforms.md) | Shared utilities reused without documenting their transforms | Documentation / Code design | Medium | all three |
| [SCAR-002](SCAR-002-spec-happy-path-only.md) | Specifications written only for the top-level happy path | Requirements / Specification | High | all three |
| [SCAR-003](SCAR-003-ac-not-fully-checked-before-shipping.md) | Acceptance criteria not fully checked before shipping | Process / Requirements | High | all three |
| [SCAR-006](SCAR-006-no-ci-gate-before-release.md) | No automated test gate before release; test failures accumulated silently | Process / CI | High | all three |
| [SCAR-007](SCAR-007-ac-without-concrete-examples.md) | Acceptance criteria stated without concrete input/output examples | Requirements / Specification | Medium | all three |
| [SCAR-008](SCAR-008-silent-misuse-of-drawing-api.md) | Third-party drawing API used with guessed arguments; blank output misread as a verdict on the library | Integration / Verification | Medium | all three |
| [SCAR-009](SCAR-009-rules-verified-only-in-isolation.md) | Rules derived from isolated examples miss what surrounds the input | Verification / Specification | Medium | all three |
| [SCAR-010](SCAR-010-join-hazards-between-generated-pieces.md) | Each generated piece is valid; the join between two pieces is not | Verification / Specification | Medium | all three |
| [SCAR-011](SCAR-011-generated-names-clash-with-natural-names.md) | A generated name is unique against its own kind, not against the names the source already has | Specification / Verification | Low | all three |
| [SCAR-012](SCAR-012-test-environment-not-ready-for-handover.md) | A manual test is handed over with a stale or incomplete environment, and the build cannot be told apart from an older one | Process / Verification | Medium | all three |
| [SCAR-013](SCAR-013-dialog-ignores-enter-key.md) | An input dialog can only be confirmed with the mouse | Usability / Specification | Low | all three |
| [SCAR-014](SCAR-014-destructive-action-without-confirmation.md) | A destructive action runs on one click, without asking | Usability / Data safety | Medium | all three |
| [SCAR-015](SCAR-015-output-checked-for-success-not-for-content.md) | Every check passes on an output that is missing its main content | Verification / Acceptance | High | all three |
| [SCAR-016](SCAR-016-ui-acts-on-stale-snapshot.md) | A control shows or acts on the state of the moment it was drawn, not the state of now | Usability / Specification / Verification | Medium | all three |
| [SCAR-017](SCAR-017-fix-applied-to-one-instance-only.md) | A defect is fixed where it was seen, and the same pattern stays broken everywhere else | Process / Verification | Medium | all three |
| [SCAR-018](SCAR-018-test-tooling-without-proven-undo.md) | Test tooling changes the sources and does not prove that it put them back | Process / Verification | Medium | all three |
| [SCAR-019](SCAR-019-rule-specified-only-at-default.md) | A configurable rule is specified and tested only at its default value | Requirements / Verification | Medium | all three |
| [SCAR-020](SCAR-020-options-offered-without-measurement.md) | An option is offered to the user without being measured | Requirements / Decision making | Medium | all three |
| [SCAR-021](SCAR-021-self-referential-output-not-checked-for-stability.md) | Output that depends on its own layout is not checked for stability | Verification | Medium | all three |
| [SCAR-022](SCAR-022-callback-data-availability-not-listed.md) | A design assumes data that a callback does not have when it runs | Requirements / Integration | Medium | all three |
| [SCAR-023](SCAR-023-guard-not-matched-to-its-criterion.md) | A guard or test does not check what its criterion says | Verification | Medium | all three |
| [SCAR-024](SCAR-024-dependency-behaviour-stated-not-measured.md) | A story states what a dependency does without measuring it | Requirements / Integration | Medium | all three |
| [SCAR-025](SCAR-025-rendered-output-inspected-too-small.md) | Rendered output is inspected too small to see its defects | Verification | Low | all three |
| [SCAR-026](SCAR-026-pattern-match-taken-for-instance.md) | A pattern match is taken for an instance of the class it is meant to find | Requirements / Verification | Medium | Obsidian2Typst, webpage-export |
| [SCAR-027](SCAR-027-replacement-specified-from-the-replaced-thing.md) | A replacement is specified from the thing it replaces, not from what its users rely on | Requirements | Medium | Obsidian2Typst, webpage-export |
| [SCAR-028](SCAR-028-test-reader-trusted-unchecked.md) | A test reader is trusted without a check of its own | Verification / Test tooling | Medium | Obsidian2Typst, webpage-export |
| [SCAR-029](SCAR-029-human-steps-buried-in-one-file.md) | Procedures a human runs are kept as sections of one large file | Process / Documentation | Low | Obsidian2Typst, webpage-export |
| [SCAR-030](SCAR-030-test-time-limit-left-at-default.md) | A test's time limit is left at the default for heavy work | Verification / Test tooling | Low | Obsidian2Typst, webpage-export |
| [SCAR-031](SCAR-031-decisions-left-in-the-shell-entry-point.md) | Decisions left in the plugin's entry point, where no test reaches them | Architecture / Verification | Medium | Obsidian2Typst |
| [SCAR-032](SCAR-032-claim-wider-than-its-measurement.md) | A finding is claimed wider than what was measured | Requirements / Decision making | Medium | Obsidian2Typst |
| [SCAR-033](SCAR-033-path-setting-not-classified-before-write.md) | A path from the user is joined as text, and the write lands somewhere nobody chose | Data safety / Specification | High | Vault Compiler |
| [SCAR-034](SCAR-034-input-classified-before-its-header-is-removed.md) | A file is classified by its first line before its metadata header is removed | Specification / Verification | Medium | Vault Compiler |
| [SCAR-035](SCAR-035-real-data-as-test-data.md) | Real user data serves as the development and test data | Process / Data protection | High | Vault Compiler |
| [SCAR-036](SCAR-036-licence-fixed-in-the-build-not-in-shipped-artifacts.md) | A licence conflict is fixed in the build, but the artifacts already shipped keep it | Process / Licensing | High | Vault Compiler |
| [SCAR-037](SCAR-037-dependency-defaults-applied-after-user-input.md) | A dependency applies its defaults after the user's input, and the user's settings silently do nothing | Requirements / Integration | Medium | Vault Compiler |
| [SCAR-038](SCAR-038-lookup-with-side-effects.md) | A lookup also reports, so every caller that only looks fills the report | Design / Verification | Medium | Vault Compiler |
| [SCAR-039](SCAR-039-in-band-markers-read-by-other-steps.md) | Invisible markers written into the text are read by steps they were not meant for | Design / Verification | Medium | Vault Compiler |
| [SCAR-040](SCAR-040-output-format-for-an-unnamed-reader.md) | An output format is specified without naming the program that reads it | Requirements / Integration | High | Vault Compiler |
| [SCAR-041](SCAR-041-line-start-rules-blind-to-containers.md) | A rule that reads the start of a line does not see past a container's marker | Specification / Verification | Medium | Vault Compiler |
| [SCAR-042](SCAR-042-dev-dependency-change-alters-shipped-artefact.md) | Adding a development tool changes the artefact that ships | Dependencies / Release | Medium | webpage-export |
| [SCAR-043](SCAR-043-count-over-generated-output.md) | A count over a folder includes generated output | Verification / Tooling | Medium | webpage-export |
| [SCAR-044](SCAR-044-whole-tree-check-before-its-ticket.md) | A whole-tree check is assigned to a ticket that cannot make it green | Process / Specification | Low | webpage-export |
| [SCAR-045](SCAR-045-fix-measured-only-in-the-test-environment.md) | A fix is measured only in the test environment and fails where the user runs it | Verification / Requirements | High | webpage-export |

## Former numbers (before 2026-11-05)

Until 2026-11-05 each project kept its own copy, and the numbers from 026 on
differed. When reading history in a project (append-only ledgers, ticket
archives, closed issues, release notes, older commits), translate the numbers
with this table. SCAR-001 to SCAR-025 kept their numbers everywhere; their
texts were merged, keeping every prevention point from all three copies.

| Project | Old number | Now |
|---|---|---|
| Obsidian2Typst | SCAR-026 to SCAR-032 | unchanged |
| obsidian-webpage-export | SCAR-026 to SCAR-030 | unchanged (same as Obsidian2Typst) |
| obsidian-webpage-export | SCAR-031 dev-dependency change alters shipped artefact | SCAR-042 |
| obsidian-webpage-export | SCAR-032 count over generated output | SCAR-043 |
| obsidian-webpage-export | SCAR-033 whole-tree check before its ticket | SCAR-044 |
| obsidian-webpage-export | SCAR-034 fix measured only in the test environment | SCAR-045 |
| Vault Compiler | SCAR-026 path setting not classified before write | SCAR-033 |
| Vault Compiler | SCAR-027 input classified before its header is removed | SCAR-034 |
| Vault Compiler | SCAR-028 real data as test data | SCAR-035 |
| Vault Compiler | SCAR-029 licence fixed in the build, not in shipped artifacts | SCAR-036 |
| Vault Compiler | SCAR-030 dependency defaults applied after user input | SCAR-037 |
| Vault Compiler | SCAR-031 lookup with side effects | SCAR-038 |
| Vault Compiler | SCAR-032 in-band markers read by other steps | SCAR-039 |
| Vault Compiler | SCAR-033 output format for an unnamed reader | SCAR-040 |
| Vault Compiler | SCAR-034 line-start rules blind to containers | SCAR-041 |

## Recurring themes

**Requirements too vague** (SCAR-002, SCAR-007)
Specs describe intent but not mechanics. Any AC involving a structural,
numeric, or positional outcome needs a concrete example with exact values.
"The heading appears at the right level" is intent; `## Foo` at depth 2
is a requirement. Every example is run through the whole converter, with all
stories' rules on, before it goes into a story, and the composed cases name
inline wrappers (bold, links) as well as block containers (SCAR-002). A story
built on another lists that story's decisions about the shared output, gives
each a composed example, and asks what the other story leaves unstated.

**Process gaps let failures accumulate** (SCAR-003, SCAR-006)
Without a gate that enforces "all ACs ticked" before merge and "tests green"
before release, gaps and regressions compound silently across releases.
Automation is the only reliable enforcement. A test that fails before the code
has only proven the line it failed on; its later assertions are read again
when the code first passes (SCAR-003).

**Silent failures misread** (SCAR-008)
An API that accepts the wrong argument without complaint produces empty
output. Treat empty output as our bug first, and verify results by program,
not only by eye.

**Choices and contracts not measured** (SCAR-020, SCAR-021, SCAR-022)
Measure every alternative before offering it (SCAR-020). Output that depends
on its own layout is swept across a page edge and over inputs of growing
size, and Typst's convergence warning is read (SCAR-021). For every
callback, read from its type whether it runs synchronously and list what
data it has at that moment; what needs an asynchronous read moves into the
action after the click (SCAR-022).

**Rules checked only where they were tried** (SCAR-009)
A rule that holds in the probe may fail where the output is really used.
Test every position (start, middle, end, before and after a line break)
against the real consumer; text moved into a new container starts a new block.

**Joins between generated pieces** (SCAR-010)
When output is built by concatenation, list what a neighbouring character can
do to each piece, measure it with the real consumer, keep guard tests, and
test piece × neighbour as a cross product.

**Generated names clash with natural names** (SCAR-011)
When a rule makes names unique, state the invariant (no two names are equal),
check against every name already handed out, and test a source name that looks
like a generated one.

**Handover to a human tester** (SCAR-012)
Make the test environment complete and current before the handover (build
installed and compared, fixtures in place), name where the test runs, and give
every test build its own visible version so a stale build is spotted at once.
A fixture that names a file uses a name that is unique where it is looked up.

**Interaction rules nobody wrote down** (SCAR-013, SCAR-014)
Specify how a dialog is operated (Enter confirms, Escape cancels, IME
composition does not submit) and put a confirmation in front of every
destructive action, with the safe button as default. Recoverability (trash)
does not replace asking.

**Success without content** (SCAR-015)
State the content the output must have (text, fonts, images) in every
end-to-end criterion and manual check, keep a guard test that shows the blank
result, and ask testers to report anything odd the list did not mention.
Content in a container that cannot break is tested with more than it holds.

**Stale screens** (SCAR-016)
A control must read the state when it is used, not the one captured while it was
drawn. Specify and test the order draw, change the data, use the control, and
run manual checks on a tab that stays open. A new way to change a value lists
every screen that shows it and how each one updates; a screen drawn before its
data is loaded counts, so the loader announces every load.

**Fix the class, not the instance** (SCAR-017)
When a defect is found, search for the pattern, list every instance in the
ticket, state the rule for the whole class in the story, and put the pattern in
one function with a text check over the file that fails for a new copy. A story
that adds a way to change a value finds every writer by grepping the value. The
fix's own story, tests and tickets go through the same check.

**Guards that miss their criterion** (SCAR-023)
A guard checks exactly its criterion, not less and not more: it counts the
places it checked, matches the whole statement, uses inputs the real producer
gives (every option value the real caller passes; fixtures taken from the
producer's real output, in its serialised form; a stand-in for every
collaborator the real caller always injects) and inputs on which the rule
and its rivals give different output, and is proven by a mutation check; a test that one side wins also
shows the other side was in effect; before tickets, the tests are searched
for guards that forbid a call the ticket adds or removes and, by function name, for
tests that pin the whole result the ticket widens; a "same output twice" test
runs from two fresh starts.

**Statements about tools are measured** (SCAR-024)
Every sentence in a story about what a dependency does is split into its
parts, and each part has a test with the real tool, or is marked as not
measured. Where a tool merges the user's input with its own defaults, the
merge order and which definition of a name wins are measured too; a line that
parses may still have no effect (SCAR-037). Where the tool can produce the
form itself (autocomplete, export), its own output is the first measurement.
An explanation of a failure stays unverified until a test shows it.

**Visual output at reading size** (SCAR-025)
A result judged by looking at it is inspected at its printed or reading size,
with the joins of separately drawn parts zoomed in on. A layout drawn into a
pane of varying width is checked at several widths, down to the narrowest,
with its edges compared by program.

**Matches are not instances** (SCAR-026)
A search result is classified by context before it is counted, offered as a
choice or replaced; a choice shows the split; a scripted replace works from a
reviewed keep-list.

**Replacements follow their users** (SCAR-027)
Before a replacement's acceptance criteria are written, every user of the
replaced thing is listed with what it asserts or assumes; each becomes a
criterion or a named change of that user.

**Test readers are checked too** (SCAR-028)
When a reader of output returns less than the source holds, the reader is
checked on a known input first; a reader of a format is tested per syntax rule
of the format.

**One file per human step** (SCAR-029)
What a human runs, answers or approves on its own is a file of its own with an
index that links each file; a test keeps index and files one to one, and tests
read a unit by its id, not by slicing a larger file.

**Time limits are measured** (SCAR-030)
A test that does seconds of work itself states its time limit, measured under
a full parallel run with a margin; a timeout is first run alone before the
code is blamed, and a raised limit goes to every test doing the same work.

**Findings carry their scope** (SCAR-032)
Every measured finding states the interface, inputs and range it covered; a
negative finding names the paths not tried; an option is measured across the
inputs it is offered for.

**Decisions out of the entry point** (SCAR-031)
The plugin's entry point only builds Obsidian objects and hands them over;
every decision lives in a function with tests. A mutant that survives there
is moved out, and the remaining hand-over line gets a text check.

**Rules at non-default values** (SCAR-019)
A rule that reads a setting gets examples and tests at the default, at both
ends of the range and at one non-default value; a decision asked in terms of
the default is also asked for the other values.

**Test tooling must prove its undo** (SCAR-018)
Back up by full path with a checksum list, check it after every restore, stop
the run on a failed check, and count a mutant only on a tree verified before
and after it. A survivor is a finding about the tests (SCAR-023). A file
meant to be new is written only to a path checked to be free. After a manual
check, `git status` comes first; commits stage files by name. The backup
holds the state to return to: for a manual check, the state as handed over.
A scripted edit leaves out files that change only with the user's approval.
A loop of outward steps checks all its inputs before the first call.

**Shared code underdocumented** (SCAR-001)
A utility's secondary transforms (not just its primary purpose) must be
documented so callers can judge whether reuse is safe. Undocumented transforms
are silent bugs waiting for the next call site.

**Paths from the user** (SCAR-033)
Classify every user-given path before use, with a table of example values in
the story; test "inside" as root + separator; route every write through one
checking writer, guarded by a text check over the sources.

**Headers before content** (SCAR-034)
List the parts of a file format that are not content (frontmatter, BOM),
remove them once at read time before every rule, keep one reader guarded by a
text check, and test each classification with a header whose look-alikes would
change the result.

**Synthetic data only** (SCAR-035)
Measure on real data, keep only the numbers; build fixtures and story
examples with invented words of the same shape; no build file points into a
data folder; a forbidden-word check guards anything published.

**Licences of what is shipped** (SCAR-036)
Check a dependency's licence before it is bundled; when one is removed for
licence reasons, withdraw every artifact that already carries it; check
bundles and archives by their contents; a copy keeps its notice.

**Lookups that report** (SCAR-038)
A function that answers a question reports nothing; the step that acts on the
answer reports once, with its place. A caller that has to undo side effects
points at the function, not the caller. Reports are tested as exact lists,
and checked to reach the place users read.

**Markers in the text** (SCAR-039)
Prefer a side channel to markers in the text. Otherwise list every step that
reads the text between insertion and removal, insert markers only where their
reader looks, run each reader's tests with markers present, and remove them
in one place with a guard on the output.

**Name the reader of every output** (SCAR-040)
A story that defines an output format names the program that reads it and
measures the format there, with examples that tell the candidate rules
apart. The measurement becomes a model in the tests, guarded by a replay of
the measurement; output is checked against the model, not only against the
rule that made it.

**Containers** (SCAR-041)
A rule that reads the start of a line reads it after the container's marker
(quote, list item), through one function; a container that ends closes the
blocks inside it; text inserted into a container carries its marker on every
line. Test each rule inside each container and a nested one.

**Development tools reach the product** (SCAR-042)
Compare the release artefact's checksum before and after every dependency
change; classify each difference; pin or decide, never let it pass.

**Counts over the right files** (SCAR-043)
A count or baseline names the files it is over, excludes generated and
third-party files by path, and is measured with and without them present.

**Whole-tree checks and ticket order** (SCAR-044)
When tests are written, name for each whole-tree check the ticket after
which it can be green.

**Fixes measured where the failure happens** (SCAR-045)
A failure seen only in the user's environment is fixed by an approach
measured there before the story builds on it; every claim names the
environment it was measured in.
