/**
 * Tests for US-9.6 (Epic 9): invariant 5 (AC-11), the contract page's example
 * (AC-10), the wiring of the setting (AC-12, SCAR-031). Format owned by its
 * reader, Obsidian2Typst (`docs/technical/encounter-block.md`, SCAR-040).
 * Synthetic notes only (SCAR-035).
 *
 * Written before the code (G2, 2026-11-25): red until US-9.6 exists, except
 * the invariant tests that hold today and must keep holding.
 * Placement: integration, like `detail-fixture.test.ts` and `us-7.4-golden.test.ts`
 * (they compile the fixture vault). The AC-12 checks read the sources as
 * `unit/detail-settings.test.ts` does; they stay here because the plan has
 * five files, the fifth being "nothing else changes, the row exists".
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';

const { parse } = createRequire(new URL('../../plugin/package.json', import.meta.url))('yaml') as typeof import('yaml');

const FIXTURES = new URL('../fixtures/', import.meta.url).pathname;
const ROOT = join(FIXTURES, 'basic-vault');
const SRC = new URL('../../plugin/src/', import.meta.url);

/** Every file of the fixture vault except hidden folders, as the plugin passes them (non-notes empty). */
function loadVault(): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else files[relative(ROOT, path)] = /\.md$/i.test(entry.name) ? readFileSync(path, 'utf8') : '';
    }
  };
  walk(ROOT);
  return files;
}

const expected = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');
const shape = (r: CompileResult) => ({ warnings: r.warnings, warningDetails: r.warningDetails, stats: r.stats });
const ENCOUNTER = { encounterCalloutType: 'encounter' };

/** The settings of M21 and M22 as the existing fixture tests pass them. */
const M21 = { ignoredFolders: ['Export'], entryMarkerKeys: ['vigour', 'attacks', 'illustration', 'layout'], expectCompiledFolders: ['Entries/Creatures'] };
const M22 = { ignoredFolders: ['Export'], entryMarkerKeys: ['vigour'], detailMarkerKeys: ['pace', 'kind', 'needs', 'starter'], normaliseHeadings: true };

describe('US-9.6 AC-11: invariant 5 (the setting at encounter, no encounter callout in the book)', () => {
  it('US-9.6 AC-11: no note of the fixture vault has an encounter callout (the test is not vacuous the other way)', () => {
    const hits = Object.entries(loadVault()).filter(([path, text]) => /\.md$/i.test(path) && /\[!encounter\]/i.test(text));
    assert.deepEqual(hits.map(([path]) => path), []);
  });

  it('US-9.6 AC-11: basic-vault compiles byte for byte to the expected file, with the same warnings and stats', () => {
    const r = new InMemoryVaultCompiler(loadVault(), { enableTextMapper: true, assetFolder: 'assets', ...ENCOUNTER }).compile('index2compile.md');
    assert.equal(r.content, expected('basic-vault.compiled.expected.md'));
    assert.deepEqual(shape(r), JSON.parse(expected('basic-vault.warnings.expected.json')));
  });

  for (const normaliseHeadings of [true, false]) {
    it(`US-9.6 AC-11: the smoke book, normaliseHeadings ${normaliseHeadings}, equals the same compile without the setting`, () => {
      // There is no expected file for the smoke book: the compile without the option is what v0.25.0 writes.
      const base = { enableTextMapper: true, assetFolder: 'assets', normaliseHeadings };
      const without = new InMemoryVaultCompiler(loadVault(), base).compile('Smoke/Smoke book.md');
      const withSetting = new InMemoryVaultCompiler(loadVault(), { ...base, ...ENCOUNTER }).compile('Smoke/Smoke book.md');
      assert.ok(without.content.length > 1000, 'the book is not empty');
      assert.equal(withSetting.content, without.content);
      assert.deepEqual(shape(withSetting), shape(without));
    });
  }

  it('US-9.6 AC-11: the entry book (M21) equals the reviewed book and keeps its warnings', () => {
    const compile = (options: Record<string, unknown>) => new InMemoryVaultCompiler(loadVault(), { normaliseHeadings: true, ...M21, ...options }).compile('Entries/Entry book.md');
    const r = compile(ENCOUNTER);
    assert.equal(r.content, expected('entry-book.expected.md'));
    assert.deepEqual(shape(r), shape(compile({})));
  });

  it('US-9.6 AC-11: the detail book (M22) equals the reviewed book and keeps its warnings', () => {
    const compile = (options: Record<string, unknown>) => new InMemoryVaultCompiler(loadVault(), { ...M22, ...options }).compile('Details/Detail book.md');
    const r = compile(ENCOUNTER);
    assert.equal(r.content, expected('detail-book.expected.md'));
    assert.deepEqual(shape(r), shape(compile({})));
  });

  it('US-9.6 AC-11: a book with callouts of other types is unchanged by the setting', () => {
    const files = { 'index.md': '# Book\n\n![[Mire Hollow]]\n', 'Mire Hollow.md': '# Mire Hollow\n\n> [!note]\n> - 1 × Lost Pilgrim\n\n> [!warning] Mud\n> Slippery.\n' };
    const on = new InMemoryVaultCompiler(files, ENCOUNTER).compile('index.md');
    const plain = new InMemoryVaultCompiler(files, {}).compile('index.md');
    assert.equal(on.content, plain.content);
    assert.deepEqual(shape(on), shape(plain));
  });
});

describe('US-9.6 AC-10: the contract page\'s example block (SCAR-028, SCAR-040)', () => {
  // Notes built in memory from the example of `docs/technical/encounter-block.md`
  // (Obsidian2Typst, Draft 2026-11-25). The example shows `states: [Fine, Down, Gone]` in
  // flow style; the writer of US-9.1 writes a list in block style, so the exact
  // text below has the block form for `states` and the parsed values are
  // compared with the page's own text, flow style included.
  const PAGE_EXAMPLE = [
    '```o2t-encounter',
    'title: Night watch',
    'rows:',
    '  - name: Fen Hare',
    '    count: "2"',
    '    note: nibbling reeds',
    '    data:',
    '      vigour: 11',
    '      might: 4',
    '      wits: 1',
    '      speed: 5',
    '      attacks:',
    '        - "Kick: 2d6"',
    '  - name: Bog Wight',
    '    count: "1d4"',
    '    data:',
    '      vigour: 20',
    '      might: 6',
    '      states: [Fine, Down, Gone]',
    '      attacks:',
    '        - "Claw: 3d8"',
    '        - "Wail: Wits check, 2 successes"',
    '  - name: Lost Pilgrim',
    '    count: "1"',
    '    note: no stats',
    '```',
    '',
  ].join('\n');
  const WRITTEN = PAGE_EXAMPLE.replace('      states: [Fine, Down, Gone]\n', '      states:\n        - Fine\n        - Down\n        - Gone\n');

  const files = {
    'index.md': '# Book\n\n![[Mire Hollow]]\n',
    'Mire Hollow.md': [
      '# Mire Hollow',
      '',
      '> [!encounter] Night watch',
      '> - 2 × [[Fen Hare]] — nibbling reeds',
      '> - 1d4 × [[Bog Wight|wights]]',
      '> - 1 × Lost Pilgrim — no stats',
      '',
    ].join('\n'),
    'Fen Hare.md': '---\nvigour: 11\nmight: 4\nwits: 1\nspeed: 5\nattacks:\n  - "Kick: 2d6"\n---\nFen hares are shy.\n',
    'Bog Wight.md': [
      '---', 'vigour: 20', 'might: 6', 'states: [Fine, Down, Gone]', 'attacks:', '  - "Claw: 3d8"', '  - "Wail: Wits check, 2 successes"', '---', 'Wights.', '',
    ].join('\n'),
  };

  it('US-9.6 AC-10: the output is the page\'s example, exact text (states in the writer\'s block form)', () => {
    const r = new InMemoryVaultCompiler(files, { encounterCalloutType: 'encounter', entryMarkerKeys: ['vigour'] }).compile('index.md');
    assert.equal(r.content, `# Book\n\n## Mire Hollow\n${WRITTEN}`);
    assert.deepEqual(r.warningDetails, []);
  });

  it('US-9.6 AC-10: parsed with yaml 2.9.1, the output block and the page\'s text give the same values', () => {
    const r = new InMemoryVaultCompiler(files, { encounterCalloutType: 'encounter', entryMarkerKeys: ['vigour'] }).compile('index.md');
    const body = (text: string) => text.split('\n').slice(1, -2).join('\n');
    const block = /^```o2t-encounter\n([\s\S]*?)^```$/m.exec(r.content)?.[1] ?? '';
    assert.deepEqual(parse(block), parse(body(PAGE_EXAMPLE)));
    assert.deepEqual((parse(block) as { rows: Array<{ data?: { states?: string[] } }> }).rows[1].data?.states, ['Fine', 'Down', 'Gone']);
  });
});

describe('US-9.6 AC-12: the setting\'s row (SCAR-031, US-7.1 AC-S1, US-7.4)', () => {
  const read = (name: string) => readFileSync(new URL(name, SRC), 'utf8');

  it('US-9.6 AC-12: default encounter, in the section that holds detailMarkerKeys, directly after it', async () => {
    const { DEFAULT_SETTINGS, SETTINGS_SECTIONS } = await import('../../plugin/src/settings-layout.ts');
    assert.equal((DEFAULT_SETTINGS as Record<string, unknown>).encounterCalloutType, 'encounter');
    const section = SETTINGS_SECTIONS.find(s => (s.keys as readonly string[]).includes('detailMarkerKeys'));
    assert.ok(section, 'the section of detailMarkerKeys');
    const keys = section.keys as readonly string[];
    assert.equal(keys[keys.indexOf('detailMarkerKeys') + 1], 'encounterCalloutType');
    assert.equal(SETTINGS_SECTIONS.filter(s => (s.keys as readonly string[]).includes('encounterCalloutType')).length, 1, 'in exactly one section');
  });

  it('US-9.6 AC-12: the strings: name and the description of the story', async () => {
    const { STRINGS } = await import('../../plugin/src/strings.ts');
    const tab = STRINGS.tab as Record<string, unknown>;
    assert.equal(tab.encounterCallout, 'Encounter callout type');
    assert.equal(tab.encounterCalloutDesc, 'Callout type of an encounter list (empty: off)');
  });

  it('US-9.6 AC-12: the row is a text field like detailMarkerKeys (same ROWS table, same commit rule)', () => {
    const tab = read('settings-tab.ts');
    assert.match(tab, /encounterCalloutType: \{ name: STRINGS\.tab\.encounterCallout, desc: STRINGS\.tab\.encounterCalloutDesc \}/);
    assert.match(tab, /detailMarkerKeys: \{ name: STRINGS\.tab\.detailMarker/);
  });

  it('US-9.6 AC-12: main.ts passes the setting unchanged and decides nothing about encounters (SCAR-031)', () => {
    const main = read('main.ts');
    assert.match(main, /encounterCalloutType:\s*this\.settings\.encounterCalloutType\s*,/);
    assert.doesNotMatch(main, /o2t-encounter|parseYaml|from 'yaml'|\[!/);
  });

  it('US-9.6 AC-12: the compiler takes the option (the interface of the story)', () => {
    assert.match(read('compiler.ts'), /encounterCalloutType\?: string/);
  });
});
