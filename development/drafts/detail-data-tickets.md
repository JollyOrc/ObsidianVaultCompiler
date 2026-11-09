# Tickets — Detail data from note properties (epic #118)

**Status (2026-11-09):** G0 to G3 done on the branch `118-detail-data`; code in progress. Resume here if a run is cut off.

| Gate | Done | Commit |
|---|---|---|
| G0 step-0 SCAR review | yes | `e451720` (`detail-data-scar-review.md`) |
| `scars/` pointer to shared `95f35b0` | yes | `6e8f51b` |
| G1 stories: US-9.5 (Epic 9) | yes | see `git log` |
| G2 tests (107 integration + 17 unit, written before the code) | yes | `fcc197f` |
| G3 tickets | yes: #120, #121, #122 | listed on #118 |

Order of work: #120 (block, setting, placement), #121 (links), #122 (fixture chapter, M22, test build `0.23.0-m22.1`). Each is committed after the full gate (typecheck, lint, unit, integration) is green, with a mutation check.

Next action: see the last line of this file.

Done: #120, #121 and #122 committed (suite 382 unit + 934 integration green). Test build `0.23.0-m22.1` installed 2026-11-09 in the fixture vault with Obsidian2Typst 0.14.0 (Obsidian was not running; the vault was not open). sha256 of the installed `main.js`: `47b250fc7d2b63cac1d61cd5a208d10d6adc157d8fdd13d6e57254f39fa675ef`. The replaced files and checksums of the vault before and after are in the session scratchpad (`vault-set-aside-20261109/`).

Next action: STOP for the user's manual check M22 (`tests/manual/M22-detail-data.md`). After a pass: record the result in M22 and `docs/technical/tests.md`, write manual section and release notes, version `0.23.0` (`npm version 0.23.0 --no-git-tag-version`), `npm run build`, merge `118-detail-data` to `main`, publish, close #120 to #122 and #118 with the version and commit. No publish, release or push without the user's go.

2026-11-09: M22 passed; the four open choices confirmed by the user. Next action: on the user's go, the release steps above (manual section, release notes, version 0.23.0, build, merge, publish, close #120 to #122 and #118).

2026-11-09 (release run): manual section 15, release notes `releases/v0.23.0.md`, version 0.23.0 and `npm run build` done (382 unit + 934 integration green; main.js sha256 `47b250fc…75ef`, the same bundle as the test build). The M22 export-warnings file was set aside from the vault root. Next action: commit the release on the branch, merge `118-detail-data` into `main`, full gate on `main`, publish dry run, publish, GitHub release 0.23.0, close #120 to #122 and #118.

2026-11-09 (release run, SCAR-035): the view name in the story, four fixture notes and the tests was a view name from the real vault; renamed to `Templates/views/craft-details` (the line is removed from the output, so the compiled text is unchanged). Gate green again (382 + 934). Next action: publish.
