# Dependencies for the Obsidian Vault Compiler Plugin

This file lists the dependencies, build tools and runtime support needed to
implement the `userstories.md` compiler as an **Obsidian community plugin**.

## 0. Obsidian plugin prerequisite for TextMapper support

| Plugin | Purpose | Required |
|---|---|---|
| Text Mapper (plugin id `text-mapper`, by Michael Hansen, github.com/modality, MIT; v1.1.0 in the example vault) | Draws every TextMapper map of the compiled document (US-4.2) | Yes for maps; without it, maps become placeholders (US-4.2 AC-5) |

Since v0.14.0 the compiler calls this plugin's code-block processor; it
bundles no TextMapper code and no terrain files of its own.

## 1. Core Obsidian plugin dependencies

| Dependency | Purpose | Required |
|---|---|---|
| `obsidian` | Obsidian plugin API: vault/file access, metadata/cache, commands, settings, notices, modal file pickers | Yes |
| Plugin manifest (`manifest.json`) | Declares plugin id, name, version, minimum Obsidian version and mobile compatibility | Yes |
| `obsidian` API styles (`styles.css`, optional) | Plugin styling and progress notices | No |

## 2. Build and development tools

| Tool | Purpose | Required |
|---|---|---|
| Node.js 16+ | Build, bundle and test the plugin | Yes |
| npm or yarn | Package management | Yes |
| TypeScript | Type-safe plugin source code | Recommended |
| esbuild | Standard Obsidian plugin bundler (produces `main.js`) | Recommended |
| Git | Version control and plugin release workflow | Recommended |
| ESLint / Prettier | Code quality and formatting | Optional |

### Example install (development)
```bash
npm install --save-dev typescript esbuild obsidian
npm install --save-dev @types/node
```

## 3. Plugin source/runtime modules

The compiler itself should be implemented in TypeScript/JavaScript and bundled
into `main.js`. It should avoid external runtime dependencies where possible.

<|constrain|> Module/API | Purpose | Required |
|---|---|---|
| Obsidian `Vault` / `TFile` / `TFolder` | Read source files and write output/assets | Yes |
| Obsidian `MetadataCache` / link resolution APIs | Resolve absolute, relative, alias and "magic" filenames consistently with Obsidian | Yes |
| Node `crypto` (via Electron) | SHA-256 hashing for asset and TextMapper deduplication | Recommended on desktop |
| Node `path` (via Electron) | Path normalization for asset filenames | Recommended on desktop |
| Web `URL` / `fetch` | Reserved for external links (left untouched) | No |

## 4. TextMapper diagram support (core feature)

### How maps are drawn (v0.14.0, decided 2026-10-27)

| Step | What happens |
|---|---|
| Engine | `app.plugins.plugins['text-mapper']` (installed and enabled). Missing → placeholder per map and one notice (US-4.2 AC-5). |
| Drawing | `processMarkdown(source, div, { docId, addChild })` on a `div` that is never attached; the plugin draws one `<svg>` into it at once. Read from the plugin's v1.1.0 `main.js`; to be confirmed in Obsidian by M14. |
| Terrain | The plugin always adds its built-in Gnomeyland and Apocalypse definitions; `include` lines are ignored (US-4.6). They come *after* the map source and the last definition wins, so a map's own `default attributes`, `glow` and `label` lines, and types named like built-in ones (`red`), have no effect (measured 2026-10-31 in Node, SCAR-030). |
| Changes to the plugin's SVG | Background `rect` removed (transparent PNG); `font-family` from the "Map font" setting or Obsidian's note font list (plus `sans-serif` when no generic family is listed) set on the root; the `@font-face` rules Obsidian defines for those families embedded as `data:` URLs in a `<style>` (US-4.2 AC-4, US-4.8). |
| Tidy labels (US-4.9) | With "Tidy map labels" on, the compiler also removes the plugin's coordinates group and rewrites its label groups (centred, wrapped lines) in the returned SVG; it relies on the shape of Text Mapper v1.1.0's output and skips a map with a notice when that shape differs. |
| Map directives (US-4.10, v0.17.0) | A map line `# vault-compiler: no-outlines no-glow` (a comment, which the plugin skips) makes the compiler remove the plugin's `regions-` group and the glow texts of `labels-` and `path-labels-` from the returned SVG; the same shape check and notice as for tidy labels. |
| Fonts | Read once per compile from Obsidian's style sheets; files such as Inter's `public/fonts/*.woff2` are read with `fetch` (works inside Obsidian: M14 retest, 2026-10-27). PNG names carry a font key (US-4.8 AC-6). |
| PNG | `XMLSerializer` → `<img>` → canvas → PNG, longer side 2048 px (US-4.4, US-4.5). No Node.js file access, no temp files; works on mobile. |
| Licence | Nothing from the plugin is copied or bundled. |

### History
- Until v0.13.0 the compiler bundled the npm package `text-mapper` 0.1.10
  (`codeberg.org/devurandom/text-mapper.js`; AGPL-3.0-or-later with CC-BY-SA-4.0
  and CC0-1.0 parts) and four terrain files, and rendered through Node's `fs`
  with temp files (desktop only). Its maps had a cream background, no hex
  outlines, a serif font and labels like `Fog Mantle|Fog Mantle`. Removed in
  v0.14.0 (T-4.2-B); US-4.3 (bundled fallback parser) was withdrawn.
  The release zips v0.10.0 to v0.13.0, which carried that package, were
  withdrawn on 2026-10-30 (#89, SCAR-029): the Unlicense cannot carry AGPL
  or CC-BY-SA code. Since v0.14.0 `main.js` is built from `plugin/src` only.
- Option B of ADR-011 (external Node rendering) stays rejected.

## 5. Cache and state

| Dependency/API | Purpose | Required |
|---|---|---|
| JSON file in the vault (e.g. `.vault_compiler_cache.json`) | Persist TextMapper render cache and hashes | Recommended |
| `localStorage` or plugin settings data | Store user preferences and temporary state | Optional |

## 6. Testing and quality tools

| Tool | Purpose | Required |
|---|---|---|
| Node.js `node:test` (built-in) | Unit and integration tests — no additional test runner needed | Yes |
| Obsidian plugin test harness / manual vault smoke tests | Validate vault API calls and file output | Recommended |
| Playwright or manual browser checks | Optional visual validation of generated PNGs | Optional |

## 7. Summary

Minimum plugin build:
- Node.js 16+
- TypeScript + esbuild
- `obsidian` package

Maps additionally need the Text Mapper community plugin installed and enabled
in the vault. The plugin has no runtime npm dependencies.
