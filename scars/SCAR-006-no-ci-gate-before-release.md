# SCAR-006 — No automated test gate before release; test failures accumulated silently

**Area:** Process / CI
**Severity:** High — multiple releases shipped with substantially broken behaviour

---

## What went wrong

Two consecutive releases shipped with failing tests. The failures were not
caught before tagging because there was no automated enforcement of "tests
green before release". At the start of the next work session 44 tests were
failing — covering features that were considered delivered.

The same gap, at the size of one commit (2026-11-07, Vault Compiler #113): on
a branch whose tests were written before the code, a test run and the commit
were chained in one command. The run's output went through `grep`, so its
exit code was lost, and the commit ran whatever the result. The output showed
one failure: a guard (only `readNote` may read note text) that the new code
broke. It was seen only after the commit; the code was fixed and the
unpushed commit amended.

## Root cause

- Tests existed but were not all run (or all passing) at release time.
- The release process was manual and did not include a test step.
- Some failing tests were silently known but treated as "will fix next
  iteration", without being tracked or skipped explicitly. This makes it
  impossible to distinguish "known acceptable red" from "new regression".

## Prevention

- On a branch where tests come before the code, the full suite is red by
  design, so "the suite is green" cannot gate anything. Name the set that
  must be green at each step (every test outside the tickets still to do)
  and keep it in a file; the gate is that set's exit code. Example
  (2026-11-07, Vault Compiler #113): the list of test files outside Epic 9's
  open tickets, run before each commit.
- A commit depends on the gate's exit code (`gate && git commit`), never on
  reading its output, and the gate's output is not piped through a filter
  (`grep`, `tail`) that replaces its exit code. Run the gate and the commit as
  two steps when the result has to be read first.
- The build/release command must run the full test suite and **block on any
  failure**. A release that skips this step is not a release; it is a gamble.
  (Obsidian2Typst: fixed in v0.10.0, `npm run build` now runs tests first.
  Vault Compiler: recorded as fixed in v0.10.0, but on 2026-10-27
  `npm run build` still ran no tests and no lint; the gate was really added
  in v0.10.1 and proven with a deliberately failing test.)
- A fix to the process is checked like a fix to the code: run it once with a
  failure that it must stop, and note that run where the fix is recorded. A
  gate that was only written down is not a gate.
- A test that is intentionally deferred must be marked `skip` with a linked
  issue. A silently-red test is indistinguishable from a regression and erodes
  trust in the suite.
- Record the pass count in release notes ("360/360 tests passing"). This
  creates an auditable baseline and makes regressions immediately visible.
- Do not accumulate "will fix later" without a ticket (in every project: a
  GitHub issue). If it is worth fixing,
  it is worth tracking. If it is not worth tracking, it is not worth deferring.
