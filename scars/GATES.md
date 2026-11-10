# SCAR gates — shared by the three plugins

Which SCARs are checked again at which gate (agent rule 9 of
[`AGENT-RULES.md`](AGENT-RULES.md)). One table for all three projects since
2026-11-10; until then each project kept its own (Obsidian2Typst in
`docs/process/state-directory.md`, obsidian-webpage-export in
`docs/process/scar-gates.md`, before 2026-11-05 a column of this
repository's index).

Every SCAR is checked at **G0** (story review) and **G3** (each ticket's
SCAR check, item by item). The Gates column names the further gates at which
it is checked again: **G1** story written, **G2** tests written, **G4** ticket
done or manual-test handover. **G5** (closing a story) asks whether anything
found generalises into a SCAR, and assigns a new SCAR's gates here.

The Basis column says where an assignment came from: `both` (the two former
tables agreed), `Obsidian2Typst` or `webpage-export` (only that table had
it; the union was taken, as nothing contradicted), or `confirmed 2026-11-10`
(no table had it; derived from the SCAR's Prevention list and confirmed by
the user).

A new SCAR adds its row here in the same commit.

| ID | Title | Gates | Basis |
|----|-------|-------|-------|
| SCAR-001 | Shared utilities reused without documenting their transforms | G2 | both |
| SCAR-002 | Specifications written only for the top-level happy path | G1 | both |
| SCAR-003 | Acceptance criteria not fully checked before shipping | G2 | both |
| SCAR-006 | No automated test gate before release; test failures accumulated silently | G4 | both |
| SCAR-007 | Acceptance criteria stated without concrete input/output examples | G1 | both |
| SCAR-008 | Third-party drawing API used with guessed arguments; blank output misread as a verdict on the library | G2 | both |
| SCAR-009 | Rules derived from isolated examples miss what surrounds the input | G2 | webpage-export |
| SCAR-010 | Each generated piece is valid; the join between two pieces is not | G2 | webpage-export |
| SCAR-011 | A generated name is unique against its own kind, not against the names the source already has | G2 | both |
| SCAR-012 | A manual test is handed over with a stale or incomplete environment, and the build cannot be told apart from an older one | G4 | both |
| SCAR-013 | An input dialog can only be confirmed with the mouse | G1 | both |
| SCAR-014 | A destructive action runs on one click, without asking | G1 | both |
| SCAR-015 | Every check passes on an output that is missing its main content | G1, G2, G4 | both |
| SCAR-016 | A control shows or acts on the state of the moment it was drawn, not the state of now | G1, G4 | both |
| SCAR-017 | A defect is fixed where it was seen, and the same pattern stays broken everywhere else | G1 | both |
| SCAR-018 | Test tooling changes the sources and does not prove that it put them back | G4 | both |
| SCAR-019 | A configurable rule is specified and tested only at its default value | G1, G2 | both |
| SCAR-020 | An option is offered to the user without being measured | G1 | both |
| SCAR-021 | Output that depends on its own layout is not checked for stability | G2 | both |
| SCAR-022 | A design assumes data that a callback does not have when it runs | G1 | both |
| SCAR-023 | A guard or test does not check what its criterion says | G2, G4 | both |
| SCAR-024 | A story states what a dependency does without measuring it | G1, G2 | both |
| SCAR-025 | Rendered output is inspected too small to see its defects | G4 | both |
| SCAR-026 | A pattern match is taken for an instance of the class it is meant to find | G1, G4 | both |
| SCAR-027 | A replacement is specified from the thing it replaces, not from what its users rely on | G1 | both |
| SCAR-028 | A test reader is trusted without a check of its own | G2, G4 | both |
| SCAR-029 | Procedures a human runs are kept as sections of one large file | G1, G4 | both |
| SCAR-030 | A test's time limit is left at the default for heavy work | G2, G4 | both |
| SCAR-031 | Decisions left in the plugin's entry point, where no test reaches them | G2, G4 | Obsidian2Typst |
| SCAR-032 | A finding is claimed wider than what was measured | G1 | Obsidian2Typst |
| SCAR-033 | A path from the user is joined as text, and the write lands somewhere nobody chose | G1, G2 | confirmed 2026-11-10 |
| SCAR-034 | A file is classified by its first line before its metadata header is removed | G1, G2 | confirmed 2026-11-10 |
| SCAR-035 | Real user data serves as the development and test data | G1, G2, G4 | confirmed 2026-11-10 |
| SCAR-036 | A licence conflict is fixed in the build, but the artifacts already shipped keep it | G4 | confirmed 2026-11-10 |
| SCAR-037 | A dependency applies its defaults after the user's input, and the user's settings silently do nothing | G1, G2 | confirmed 2026-11-10 |
| SCAR-038 | A lookup also reports, so every caller that only looks fills the report | G2 | confirmed 2026-11-10 |
| SCAR-039 | Invisible markers written into the text are read by steps they were not meant for | G1, G2 | confirmed 2026-11-10 |
| SCAR-040 | An output format is specified without naming the program that reads it | G1, G2 | confirmed 2026-11-10 |
| SCAR-041 | A rule that reads the start of a line does not see past a container's marker | G1, G2 | confirmed 2026-11-10 |
| SCAR-042 | Adding a development tool changes the artefact that ships | G2, G4 | webpage-export |
| SCAR-043 | A count over a folder includes generated output | G2, G4 | webpage-export |
| SCAR-044 | A whole-tree check is assigned to a ticket that cannot make it green | G2 | webpage-export |
| SCAR-045 | A fix is measured only in the test environment and fails where the user runs it | G1, G4 | webpage-export |
