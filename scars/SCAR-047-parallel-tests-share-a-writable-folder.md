# SCAR-047 — Test files that run in parallel write the same folder

**Area:** Verification / Test tooling
**Severity:** Low — no wrong product shipped; tests were skipped or flaky, and a green run could hide that

---

## What went wrong

The test runner starts test files in parallel by default. Twice in one story, several files wrote the same folder at the same time: first each file regenerated the shared fixture vault in its own `beforeAll`, and one run reported 4 tests skipped; later two end-to-end files both ran the command, which writes the repo's `build/` (documents, icons, `warnings.txt`), and one run skipped 10 tests. Each time a second run was green, which made the failure look like chance. Example (2026-11-23, roa-character-sheets US-002 #11 and #13).

## Root cause

A shared writable location (a generated fixture, an output folder, a cache) was treated as private to each test file. Nothing in the tests said who owns it, and the runner's parallelism was never considered when the second writer was added.

## Prevention

- Every folder a test writes is either private to that test (a temporary directory) or written once before all tests (the runner's global setup) and only read afterwards.
- When the product under test itself writes a fixed folder (its build output), the test files that run it are serialised (a separate runner project without file parallelism), and the reason is written beside that setting.
- A test run that reports skipped tests nobody skipped on purpose is a failure to investigate, not noise; two green runs in a row are not the proof.
