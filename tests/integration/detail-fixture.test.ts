/**
 * The synthetic detail chapter of the fixture vault (#122, US-9.5):
 * `tests/fixtures/basic-vault/Details/`, compiled from `Details/Detail book.md`
 * with the settings of manual check M22. Pins the whole compiled book
 * (`tests/fixtures/detail-book.expected.md`, reviewed 2026-11-09) and the
 * warnings, so the manual check and the automated one read the same output
 * (SCAR-012, SCAR-015).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';

const { parse } = createRequire(new URL('../../plugin/package.json', import.meta.url))('yaml') as typeof import('yaml');

const ROOT = new URL('../fixtures/basic-vault/', import.meta.url).pathname;

/** Every file of the fixture vault except `.obsidian/`, as the plugin passes them (non-notes empty). */
function loadVault(): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else files[relative(ROOT, path)] = /\.md$/.test(entry.name) ? readFileSync(path, 'utf8') : '';
    }
  };
  walk(ROOT);
  return files;
}

/** The settings of M22. */
const M22 = {
  ignoredFolders: ['Export'],
  entryMarkerKeys: ['vigour'],
  detailMarkerKeys: ['pace', 'kind', 'needs', 'starter'],
  normaliseHeadings: true,
};

const compile = (files = loadVault(), options: Record<string, unknown> = M22): CompileResult =>
  new InMemoryVaultCompiler(files, options).compile('Details/Detail book.md');

describe('#122: the detail chapter of the fixture vault', () => {
  it('compiles to the reviewed book', () => {
    const expected = readFileSync(new URL('../fixtures/detail-book.expected.md', import.meta.url), 'utf8');
    assert.equal(compile().content, expected);
  });

  it('gives exactly the three warnings M22 expects, in order', () => {
    assert.deepEqual(compile().warningDetails.map(w => [w.message, w.link, w.file, w.line]), [
      ['Detail value is not text: needs', 'needs', 'Details/Crafts/Net Mending.md', 4],
      ['Entry keys and detail keys in one note: only the entry block is written', 'pace', 'Details/Crafts/Tide Tables.md', 3],
      ['Missing wiki link', 'Missing Craft', 'Details/Crafts/Net Mending.md', 3],
    ]);
  });

  it('every block reads back with yaml 2.9.1 (SCAR-028)', () => {
    const out = compile().content;
    const details = [...out.matchAll(/^```o2t-details\n([\s\S]*?)^```$/gm)].map(m => parse(m[1]));
    assert.deepEqual(details, [
      { pace: 'Brisk', kind: 'craft', needs: '[[#Basket Knots|Basket Knots]]', starter: true },
      { pace: 'Slow', kind: 'craft', starter: false },
      { pace: 'Swift', kind: 'craft', needs: '**Basket Knots**: [[#Tight|tight knots]]' },
      { pace: 'Brisk', kind: 'Missing Craft' },
    ]);
    const entries = [...out.matchAll(/^```o2t-entry\n([\s\S]*?)^```$/gm)].map(m => parse(m[1]));
    assert.deepEqual(entries, [{ vigour: 3, pace: 'Slow' }]);
  });

  it('no view line, no frontmatter, no property of an unlisted key, and the unlisted note is absent', () => {
    const out = compile().content;
    assert.doesNotMatch(out, /dv\.view|dataviewjs|^---$|tags:|Moon Notes|no list/m);
  });

  it('setting off: the book has no block of either kind except the entry (invariant 3)', () => {
    const out = compile(loadVault(), { ...M22, detailMarkerKeys: [] }).content;
    assert.doesNotMatch(out, /o2t-details/);
    assert.match(out, /^```o2t-entry$/m);
    assert.doesNotMatch(out, /dv\.view/);
  });

  it('M22 step 10: detail keys cleared → no block, no warning', () => {
    assert.deepEqual(compile(loadVault(), { ...M22, detailMarkerKeys: [] }).warningDetails, []);
  });

  it('M22 step 11: entry keys cleared → Tide Tables gets a details block, two warnings', () => {
    const r = compile(loadVault(), { ...M22, entryMarkerKeys: [] });
    assert.match(r.content, /### Tide Tables\n```o2t-details\npace: Slow\n```\nTides/);
    assert.doesNotMatch(r.content, /o2t-entry/);
    assert.deepEqual(r.warningDetails.map(w => w.message), ['Detail value is not text: needs', 'Missing wiki link']);
  });

  it('the existing fixture books are unchanged by the chapter (invariants 3 and 4)', () => {
    const files = loadVault();
    for (const start of ['index2compile.md', 'Smoke/Smoke book.md', 'Entries/Entry book.md']) {
      const without = Object.fromEntries(Object.entries(files).filter(([path]) => !path.startsWith('Details/')));
      const options = { normaliseHeadings: true, entryMarkerKeys: ['vigour'], detailMarkerKeys: ['pace', 'kind', 'needs', 'starter'] };
      const withChapter = new InMemoryVaultCompiler(files, options).compile(start);
      const withoutChapter = new InMemoryVaultCompiler(without, options).compile(start);
      assert.equal(withChapter.content, withoutChapter.content, start);
      assert.equal(/o2t-details/.test(withChapter.content), false, `${start}: no note of it has a detail key`);
    }
  });
});
