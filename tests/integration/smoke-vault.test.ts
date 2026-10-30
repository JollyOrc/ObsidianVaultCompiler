/**
 * Smoke-book fixture tests (#86).
 *
 * `tests/fixtures/basic-vault/Smoke/` holds the synthetic notes the manual
 * smoke tests (docs/technical/tests.md §6, M14, M15) are run on in Obsidian.
 * These tests compile `Smoke/Smoke book.md` without Obsidian and check that
 * the fixture still shows every case those checks rely on, so a change to the
 * notes cannot silently remove one:
 *   - US-1.3 ToC lists in `[[…]]`, `[text](path)` and mixed syntax
 *   - US-1.2 a section embed
 *   - US-5.2 frontmatter, also in front of a heading
 *   - US-6.3 to US-6.5 numbered notes, a renamed first heading, a preamble
 *     note, a headingless note and a pass-through wrapper
 *   - US-4.x two maps (one `option horizontal`) become two PNG references
 *
 * The fixture notes sit in a subfolder so the top-level fixture test
 * (fixture-vault.test.ts) is unaffected. Warnings are not asserted: every map
 * currently adds a false "Missing include" warning (#88).
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';

const VAULT_DIR = resolve(new URL('../../', import.meta.url).pathname, 'tests/fixtures/basic-vault');
const START = 'Smoke/Smoke book.md';

/**
 * #86 | Loads the whole fixture vault, subfolders included, as Obsidian sees
 * it; dot folders (the deployed plugin in `.obsidian/`) are skipped.
 */
function loadVault(dir: string, files: Record<string, string> = {}): Record<string, string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) loadVault(path, files);
    else files[relative(VAULT_DIR, path)] = entry.name.endsWith('.md') ? readFileSync(path, 'utf8') : '';
  }
  return files;
}

/** #86 | The heading lines of the compiled text, in order. */
function headings(content: string): string[] {
  return content.split('\n').filter(line => /^#{1,6} /.test(line));
}

/** #86 | Compiles the smoke book with "Normalise headings" on or off. */
function compileSmokeBook(normaliseHeadings: boolean): CompileResult {
  return new InMemoryVaultCompiler(loadVault(VAULT_DIR), {
    enableTextMapper: true,
    assetFolder: 'assets',
    normaliseHeadings,
  }).compile(START);
}

describe('smoke book — "Normalise headings" on', () => {
  let result: CompileResult;
  before(() => { result = compileSmokeBook(true); });

  it('US-6.3 to US-6.5, US-1.2, US-1.3: every heading at its level, in ToC order', () => {
    assert.deepEqual(headings(result.content), [
      '# Smoke book',
      '# Basics',              // prefix 1
      '## Moving',             // prefix 1.1
      '### Climbing',
      '## Dueling',            // US-6.3 AC-6: replaces "# Brawling"
      '### Zeal',
      '## Leaf Craft',         // US-6.4: preamble note, title injected
      '### Spells',
      '#### Rootbinder',       // no prefix: last original heading (h3) + 1
      '#### Fog Lantern',
      '# Seasonal Charms',     // US-6.5: "2 Charms" passes through at depth 1
      '## Appendix',           // headingless, `[text](path)` item of a mixed list
      '### Glossary of the Vale', // `[text](path)` ToC list
      '### Map key',
      '### Climbing',          // US-1.2 section embed
    ]);
  });

  it('US-6.3 AC-6: the renamed first heading does not survive', () => {
    assert.doesNotMatch(result.content, /Brawling/);
  });
});

describe('smoke book — "Normalise headings" off', () => {
  let result: CompileResult;
  before(() => { result = compileSmokeBook(false); });

  it('US-6.1: the wrapper gets its own heading instead of passing through', () => {
    const lines = headings(result.content);
    assert.ok(lines.includes('# Charms'), lines.join(' | '));
    assert.ok(lines.includes('## Seasonal Charms'), lines.join(' | '));
  });
});

for (const normaliseHeadings of [true, false]) {
  describe(`smoke book — both values ("Normalise headings" ${normaliseHeadings ? 'on' : 'off'})`, () => {
    let result: CompileResult;
    before(() => { result = compileSmokeBook(normaliseHeadings); });

    it('US-5.2: no frontmatter reaches the output', () => {
      assert.doesNotMatch(result.content, /^tags:/m);
      assert.doesNotMatch(result.content, /^---$/m);
      assert.doesNotMatch(result.content, /LeafCraft|SeasonalCharms/);
    });

    it('US-5.2: a note with frontmatter shows its title and then its text', () => {
      assert.match(result.content, /^#+ Rootbinder\nMends a broken bone overnight\./m);
    });

    it('US-1.3: no ToC link is left as a link', () => {
      assert.doesNotMatch(result.content, /\[\[|\]\((?:Appendix|Glossary|Map%20key)/);
    });

    it('US-4.x: both maps become distinct PNG references, no fence is left', () => {
      const maps = [...result.content.matchAll(/\]\((assets\/textmapper\/[^)]+\.png)\)/g)].map(m => m[1]);
      assert.equal(maps.length, 2, maps.join(', '));
      assert.notEqual(maps[0], maps[1]);
      assert.doesNotMatch(result.content, /```text-mapper/);
    });

    it('US-2.1: the image from the vault root is copied as an asset', () => {
      assert.match(result.content, /!\[\]\(assets\/media\.png\)/);
    });
  });
}
