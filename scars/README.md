# SCARs — Situation, Cause, Action, Resolution

This folder contains **SCAR documents**: post-incident writeups for things
that went wrong during development. Each SCAR is written to be project-
independent — the lesson should apply to any software project, not just this
one. Project-specific implementation bugs live in the git history; SCARs are
for patterns that will recur if not consciously addressed.

## Format

Each SCAR covers:

- **What went wrong** — the observable symptom, with a brief project example
- **Root cause** — the underlying reason it happened
- **Prevention** — concrete changes to process or practice

## Index

| ID | Title | Area | Severity |
|----|-------|------|----------|
| [SCAR-001](SCAR-001-shared-utility-undocumented-transforms.md) | Shared utilities reused without documenting their transforms | Documentation | Medium |
| [SCAR-002](SCAR-002-spec-happy-path-only.md) | Specifications written only for the top-level happy path | Requirements | High |
| [SCAR-003](SCAR-003-ac-not-fully-checked-before-shipping.md) | Acceptance criteria not fully checked before shipping | Process | High |
| [SCAR-006](SCAR-006-no-ci-gate-before-release.md) | No automated test gate before release | Process / CI | High |
| [SCAR-007](SCAR-007-ac-without-concrete-examples.md) | Acceptance criteria stated without concrete examples | Requirements | Medium |
| [SCAR-008](SCAR-008-silent-misuse-of-drawing-api.md) | Drawing API used with guessed arguments; blank output misread as a verdict on the library | Integration / Verification | Medium |
| [SCAR-009](SCAR-009-rules-verified-only-in-isolation.md) | Rules derived from isolated examples miss what surrounds the input | Verification / Specification | Medium |
| [SCAR-010](SCAR-010-join-hazards-between-generated-pieces.md) | Each generated piece is valid; the join between two pieces is not | Verification / Specification | Medium |
| [SCAR-011](SCAR-011-generated-names-clash-with-natural-names.md) | A generated name is unique against its own kind, not against the names the source already has | Specification / Verification | Low |
| [SCAR-012](SCAR-012-test-environment-not-ready-for-handover.md) | A manual test is handed over with a stale or incomplete environment, and the build cannot be told apart from an older one | Process / Verification | Medium |
| [SCAR-013](SCAR-013-dialog-ignores-enter-key.md) | An input dialog can only be confirmed with the mouse | Usability / Specification | Low |
| [SCAR-014](SCAR-014-destructive-action-without-confirmation.md) | A destructive action runs on one click, without asking | Usability / Data safety | Medium |
| [SCAR-015](SCAR-015-output-checked-for-success-not-for-content.md) | Every check passes on an output that is missing its main content | Verification / Acceptance | High |
| [SCAR-016](SCAR-016-ui-acts-on-stale-snapshot.md) | A control shows or acts on the state of the moment it was drawn, not the state of now | Usability / Specification / Verification | Medium |
| [SCAR-017](SCAR-017-fix-applied-to-one-instance-only.md) | A defect is fixed where it was seen, and the same pattern stays broken everywhere else | Process / Verification | Medium |
| [SCAR-018](SCAR-018-test-tooling-without-proven-undo.md) | Test tooling changes the sources and does not prove that it put them back | Process / Verification | Medium |
| [SCAR-019](SCAR-019-rule-specified-only-at-default.md) | A configurable rule is specified and tested only at its default value | Requirements / Verification | Medium |
| [SCAR-020](SCAR-020-options-offered-without-measurement.md) | An option is offered to the user without being measured | Requirements / Decision making | Medium |
| [SCAR-021](SCAR-021-self-referential-output-not-checked-for-stability.md) | Output that depends on its own layout is not checked for stability | Verification | Medium |
| [SCAR-022](SCAR-022-callback-data-availability-not-listed.md) | A design assumes data that a callback does not have when it runs | Requirements / Integration | Medium |
| [SCAR-023](SCAR-023-guard-not-matched-to-its-criterion.md) | A guard or test does not check what its criterion says | Verification | Medium |
| [SCAR-024](SCAR-024-dependency-behaviour-stated-not-measured.md) | A story states what a dependency does without measuring it | Requirements / Integration | Medium |
| [SCAR-025](SCAR-025-rendered-output-inspected-too-small.md) | Rendered output is inspected too small to see its defects | Verification | Low |
| [SCAR-026](SCAR-026-path-setting-not-classified-before-write.md) | A path from the user is joined as text, and the write lands somewhere nobody chose | Data safety / Specification | High |
| [SCAR-027](SCAR-027-input-classified-before-its-header-is-removed.md) | A file is classified by its first line before its metadata header is removed | Specification / Verification | Medium |
| [SCAR-028](SCAR-028-real-data-as-test-data.md) | Real user data serves as the development and test data | Process / Data protection | High |

## Recurring themes

**Requirements too vague** (SCAR-002, SCAR-007)
Specs describe intent but not mechanics. Any AC involving a structural,
numeric, or positional outcome needs a concrete example with exact values.
"The heading appears at the right level" is intent; `## Foo` at depth 2
is a requirement. Every example is run through the whole converter, with all
stories' rules on, before it goes into a story, and the composed cases name
inline wrappers (bold, links) as well as block containers (SCAR-002).

**Process gaps let failures accumulate** (SCAR-003, SCAR-006)
Without a gate that enforces "all ACs ticked" before merge and "tests green"
before release, gaps and regressions compound silently across releases.
Automation is the only reliable enforcement.

**Silent failures misread** (SCAR-008)
An API that accepts the wrong argument without complaint produces empty
output. Treat empty output as our bug first, and verify results by program,
not only by eye.

**Choices and contracts not measured** (SCAR-020, SCAR-021, SCAR-022)
Measure every alternative before offering it (SCAR-020). Output that depends
on its own layout is swept across a page edge; non-convergence is not
reported (SCAR-021). For every callback, read from its type whether it runs
synchronously and list what data it has at that moment; what needs an
asynchronous read moves into the action after the click (SCAR-022).

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
that adds a way to change a value finds every writer by grepping the value.

**Guards that miss their criterion** (SCAR-023)
A guard checks exactly its criterion, not less and not more: it counts the
places it checked, matches the whole statement, uses inputs the real producer
gives (every option value the real caller passes) and inputs on which the rule
and its rivals give different output, and is proven by a mutation check; a test that one side wins also
shows the other side was in effect; before tickets, the tests are searched
for guards that forbid a call the ticket adds.

**Statements about tools are measured** (SCAR-024)
Every sentence in a story about what a dependency does is split into its
parts, and each part has a test with the real tool, or is marked as not
measured.

**Visual output at reading size** (SCAR-025)
A result judged by looking at it is inspected at its printed or reading size,
with the joins of separately drawn parts zoomed in on.

**Rules at non-default values** (SCAR-019)
A rule that reads a setting gets examples and tests at the default, at both
ends of the range and at one non-default value; a decision asked in terms of
the default is also asked for the other values.

**Test tooling must prove its undo** (SCAR-018)
Back up by full path with a checksum list, check it after every restore, stop
the run on a failed check, and count a mutant only on a tree verified before
and after it. A survivor is a finding about the tests (SCAR-023). The backup
holds the state to return to: for a manual check, the state as handed over.

**Paths from the user** (SCAR-026)
Classify every user-given path before use, with a table of example values in
the story; test "inside" as root + separator; route every write through one
checking writer, guarded by a text check over the sources.

**Headers before content** (SCAR-027)
List the parts of a file format that are not content (frontmatter, BOM),
remove them once at read time before every rule, keep one reader guarded by a
text check, and test each classification with a header whose look-alikes would
change the result.

**Synthetic data only** (SCAR-028)
Measure on real data, keep only the numbers; build fixtures and story
examples with invented words of the same shape; no build file points into a
data folder; a forbidden-word check guards anything published.

**Shared code underdocumented** (SCAR-001)
A utility's secondary transforms (not just its primary purpose) must be
documented so callers can judge whether reuse is safe. Undocumented transforms
are silent bugs waiting for the next call site.
