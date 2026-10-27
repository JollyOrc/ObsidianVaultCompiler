# CLAUDE.md — Obsidian Vault Compiler

## Project context

This repository contains an Obsidian.md vault and planning documents for a
compiler that converts a vault into one portable markdown file.

Important files:

- `docs/user-stories/userstories.md` — authoritative user stories and acceptance criteria.
- `docs/technical/dependencies.md` — dependencies and build requirements.
- `docs/technical/tests.md` — quality gates and required tests.
- `Example Vault/` — the Obsidian vault used for development and
  smoke testing.
- `Example Vault/index2compile.md` — default compilation starting point.
- `Example Vault/Compilation/` — reference material only; the intended
  implementation is the new Obsidian community plugin, not any prior Python scripts.

The intended product is an **Obsidian community plugin**, not a standalone CLI or Python script.

---

## Development process

Follow this order strictly — do not skip ahead:

0. **SCAR review** — before touching any user story, test, or code, read
   `scars/README.md` and every SCAR file under `scars/`. Check the new
   instructions or user story against each documented failure pattern:
   - Are all ACs stated with concrete input/output examples? (SCAR-007)
   - Do the ACs cover nested/composed usage, not just the top-level case? (SCAR-002)
   - Is there a test stub for every AC before any code is written? (SCAR-003)
   - Does any shared utility get a new call site? If so, are all its transforms
     documented and verified as appropriate for this use? (SCAR-001)
   - Is the test suite required to be fully green before this work ships? (SCAR-006)
   Flag any gap to the user before proceeding; do not paper over it with a
   guess or a TODO.

   **After** a problem is resolved or a requirement is refined, ask: can the
   root cause be generalised beyond this specific case? If yes, add a new SCAR
   to `scars/` (following the existing format) and update `scars/README.md`.
   A SCAR is warranted when the same underlying failure mode could recur on
   any future feature, not just the one just fixed.

1. **User story** — write or amend the story and acceptance criteria first.
2. **Tests** — specify and implement tests against the acceptance criteria.
3. **Tickets** — create the necessary work items.
4. **Code** — write the implementation against the tests and tickets.

---

## Code style

All code must adhere to the **Google Style Guides**: <https://google.github.io/styleguide/>

Relevant guides for this project:

- **TypeScript/JavaScript:** <https://google.github.io/styleguide/tsguide.html>
- **Shell scripts:** <https://google.github.io/styleguide/shellguide.html>

Additional TypeScript requirements:

- Use TypeScript with strict checking.
- Add TSDoc comments for public APIs.
- Use `eslint-plugin-obsidianmd` and resolve all lint findings before release.

---

## Function documentation

Every function and method must carry a comment header that states:

1. **User story** — which US it supports (e.g. `US-7.1`, `US-7.2`).
2. **Technical requirement / acceptance criterion** — the specific AC it implements
   (e.g. `AC-3: Internal headings shift under the injected title`).

### TypeScript example

```typescript
/**
 * US-7.2 | AC-4: Internal headings of a prefix preamble file are normalised
 * by embedding context.
 *
 * Shifts all headings in `content` uniformly so that the first heading lands
 * at `targetDepth`. Heading text is always preserved; only the level changes.
 * Headings that would exceed h6 are clamped to h6 (see AC-7).
 */
private applyHeadingNormalisation(
  content: string,
  targetDepth: number,
  _filePath: string,
): { content: string; clamped: boolean } { … }
```

---

## Agent rules

1. Treat `userstories.md` as the source of truth for behavior.
2. Preserve the existing vault. Never modify files under
   `Example Vault/` except configured compiler output and assets.
3. Keep generated compiler code in `plugin/`.
4. Prefer TypeScript and the Obsidian plugin API.
5. Do not add a separate `--vault` option. The active Obsidian vault is the only vault context.
6. Use Obsidian's metadata/link database before fallback filesystem search.
7. Use Obsidian vault and file APIs for all read/write operations.
8. Run the quality gates from `tests.md` before declaring work complete.
9. Do not edit Obsidian source files while testing. Always compare hashes.

---

## Implementation priorities

1. Plugin skeleton, settings, commands and safety guards.
2. Vault read-only access and file enumeration.
3. Link resolution using Obsidian metadata/cache plus fallback search.
4. Recursive compilation and embed handling.
5. Nested ToC expansion.
6. Asset copying and deduplication.
7. Anchor link conversion.
8. Auto-generated headings.
9. TextMapper rendering through installed `obsidian-text-mapper`.
10. Control-command stripping.
11. Reporting and statistics.
12. Tests, fixtures and quality gates.

---

## Architecture expectations

- Plugin source lives under `plugin/`; main entry point is `plugin/src/main.ts`,
  builds to `plugin/main.js`.
- Compilation isolated in a compiler service/class.
- Link resolution isolated in a resolver module.
- Asset handling isolated in an asset manager.
- TextMapper rendering isolated in a renderer module.
- Long-running operations report progress through Obsidian notices.
- Source files must only be read; compiler output and assets are the only write targets.

---

## Important behavior details

- Default starting file: `index2compile.md`.
- Assets directory is next to the compiled output file.
- Deduplicate assets by resolved absolute source path.
- Different files with the same basename receive `_1`, `_2`, … suffixes.
- Absolute, relative and bare "magic" links are all supported.
- In-text markdown links become anchor links.
- Any bullet or numbered list of markdown links is a ToC to expand.
- The original ToC list is removed from compiled output after its entries are embedded.
- Dataview Serializer plugin commands and markers are removed from output.
- Files beginning with a heading have that heading replaced by a filename-derived heading.
- Plugin control fences are removed only.
- Failed TextMapper renders become placeholders plus warnings.
- Original files must never be modified.

---

## Obsidian community plugin development

### Required project structure

```text
plugin/
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── versions.json
├── styles.css
└── src/
    └── main.ts
```

The build must produce `main.js` in the plugin root.

### Build and development commands

```bash
npm install
npm run dev        # watch mode: compile src/main.ts → main.js
npm run build      # type check + production bundle
npm run lint       # ESLint with eslint-plugin-obsidianmd
npm run version    # bump version and update versions.json
```

Use `npm run build` before every release. Use `npm run dev` during local development.
Do not manually edit generated `main.js`; change TypeScript source and rebuild.

### Local development workflow

1. Symlink or copy the plugin folder to:
   `Example Vault/.obsidian/plugins/obsidian-vault-compiler/`
2. Run `npm run dev` in the plugin project.
3. In Obsidian: Settings → Community plugins → enable the plugin.
4. Reload Obsidian after changing plugin code.
5. Use the developer console and notices for diagnostics.

### Manifest rules

- `id`: stable, e.g. `obsidian-vault-compiler`.
- `name`: user-friendly.
- `version`: semantic versioning.
- `minAppVersion`: lowest Obsidian version actually tested.
- `isDesktopOnly`: `false` unless Node-only or desktop-only APIs are required.

### External dependencies and bundling

Do **not** bundle these — they are external:

```
obsidian
electron
@codemirror/*
@lezer/*
Node.js built-in modules
```

All other runtime dependencies must be bundled into `main.js` by esbuild.
Prefer implementing parsing and asset logic directly in TypeScript to avoid runtime npm deps.

The plugin may depend on `obsidian-text-mapper` being installed in the same vault;
check via Obsidian APIs and fail gracefully if absent.

### Mobile and safety

- Never use desktop-only APIs on mobile unless `isDesktopOnly` is `true`.
- Do not write to the vault except to configured output and assets paths.
- Validate paths before all writes.
- Avoid network requests unless explicitly required and documented.

### Obsidian plugin patterns

- Register commands in `onload()`.
- Clean up registrations in `onunload()`.
- Use `PluginSettingTab` for user settings.
- Use `Notice` for progress and errors.

---

## Testing expectations

Before finalizing any change, run:

```bash
npm run typecheck
npm run build
npm run lint
npm run test:unit
npm run test:integration
```

Also run the manual smoke tests in `docs/technical/tests.md` §6 against the provided vault.
Vault file hashes must be unchanged except for configured outputs.

---

## Documentation maintenance

When behavior changes, update:

- `docs/user-stories/userstories.md`
- `docs/technical/dependencies.md`
- `docs/technical/tests.md`

Keep all three documents coherent with the implementation.

---

## Versioning

- Any ticket-driven change: bump by at least `0.0.1`.
- New features: bump by `0.1`.
- Update `manifest.json`, `package.json`, and `versions.json` together.

### Release checklist

1. In `plugin/`, run `npm version <x.y.z> --no-git-tag-version`. This sets
   `package.json` and, through `version-bump.mjs`, `manifest.json` and
   `versions.json`.
2. Write `releases/v<version>.md` containing:
   - Version number and release date.
   - Summary of new features, changed behaviour, and bug fixes.
   - Breaking changes and migration steps.
   - Tickets and user stories addressed.
   - Test count from the build (e.g. "360/360 tests passing").
3. Run `npm run build`. It stops on any type, lint or test failure; otherwise it
   bundles, deploys to the example vault, writes
   `releases/obsidian-vault-compiler-v<version>.zip` and updates
   `releases/RELEASES.md` (hand-written notes are kept).
4. Create a GitHub release tagged with the exact version number.
5. Attach `manifest.json`, `main.js`, and `styles.css` to the release.
6. Copy the release notes from step 2 into the GitHub release description.
7. Submit or update the Obsidian community plugin list PR when appropriate.
