# SCAR-029 — A licence conflict is fixed in the build, but the artifacts already shipped keep it

**Area:** Process / Licensing
**Severity:** High — five published release archives carried copyleft code under a public-domain licence for days after the build itself was clean

---

## What went wrong

The plugin bundled an npm package licensed AGPL-3.0-or-later with
CC-BY-SA-4.0 parts into `main.js`, while the project is released under the
Unlicense. A ticket recorded the conflict, and v0.14.0 replaced the package,
so every later build was clean. But the release archives v0.10.0 to v0.13.0
stayed in `releases/`, were uploaded to the public repository, and a publish
script was later changed to copy every archive, so each publish shipped them
again. A licence check on 2026-10-30 found the bundled code by searching the
archives for the upstream's copyright notice.

## Root cause

The fix was scoped to "what the next build contains", not to "everything we
distribute". Built archives were treated as history, like release notes,
although they are copies of the code that are handed out. No step listed the
licence of what goes into a bundle when a dependency is added, so the
conflict was only noticed late and by accident.

## Prevention

- Before a runtime dependency is added, record its licence (from the package
  registry, not from memory) and check it against the project licence. A
  copyleft or attribution licence in a permissively licensed bundle is a
  blocker, not a follow-up.
- When a dependency is removed for licence reasons, the same ticket lists
  every artifact that already contains it — release archives, uploaded
  release assets, published copies, caches — and withdraws or relicenses
  each one. The ticket is not done while one of them is still distributed.
- Check what a build really bundles (for esbuild: the metafile's inputs), not
  what `package.json` says; check shipped archives by their contents
  (copyright notices, licence headers).
- A copied file, however small, keeps its licence notice, or it is not copied.
- Applies next to: vendored code, fonts, icons, map or image sets, copied
  snippets and skills, generated files that embed third-party data.
