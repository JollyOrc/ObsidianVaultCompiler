# SCAR-035 — Real user data serves as the development and test data

**Area:** Process / Data protection
**Severity:** High — the whole example vault had to be removed from the working tree; every published document needs a name-replacing step, and the private history still holds the data

---

## What went wrong

The example vault used for development and manual checks was a copy of the
author's real working vault: a book in progress, its title, names of people
and of its content. It was convenient — real notes showed real problems
(frontmatter on 93 notes, `[text](…)` ToC lists, maps with long labels). But
the content spread: test names, acceptance-criterion examples, tickets and
release notes quoted it, and the plugin manifest was a symlink into the
vault. When the code was published, a script had to replace names in every
file and stop on a list of forbidden words. When the vault was finally
removed (2026-10-30), the build broke because the manifest lived inside it.

## Root cause

No rule separated "data we measure on" from "data we keep". The real vault
was both the place where problems were found and the fixture that
specifications, tests and tooling pointed at, so copying from it never felt
like a decision. Build files reached into the data folder, which made it
part of the build.

## Prevention

- Development, test and example data is synthetic from the start. Real data
  may be measured (counts, sizes, shapes, timings), and only the measurement
  goes into the repository: "93 notes with `tags:` frontmatter", not the
  notes.
- When real data shows a problem, write a synthetic fixture that has the
  same shape (same structure, invented words) before writing the story's
  examples or the test. The example in the story uses the invented words.
- No build file, symlink or script points into a data folder. The build must
  work with every data folder deleted; check it by building in a clean clone.
- A published copy is built by a script that stops on a list of forbidden
  words (names, titles, local user names, e-mail addresses), including inside
  archives. The list is a safety net, not the method.
- A name that is no person or title can still come from real use: a view, a
  template, a folder, a property or a preset name. Invent every such name for
  a story, fixture or test example; do not copy it from a measurement or from
  the private spec. The forbidden-word list cannot see these names. Before a
  first publish of a story or fixture, grep the new public text for the
  names found in the private working copies (file, folder, template and
  property names), not only for the fixed list. Example (2026-11-09, Vault
  Compiler #118): a story, four fixture notes and three tests named a view
  `skill-details` taken from the author's own vault. The publish script
  passed; a grep against the private folder names found it before the
  publish, and it was renamed everywhere.
- Applies next to: any project tested against a user's own documents, mail,
  photos, databases or logs.
