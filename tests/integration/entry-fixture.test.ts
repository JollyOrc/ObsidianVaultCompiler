/**
 * The synthetic entry chapter of the fixture vault (#115, Epic 9):
 * `tests/fixtures/basic-vault/Entries/`, compiled from `Entries/Entry book.md`
 * with the settings of manual check M21. Pins the whole compiled book
 * (`tests/fixtures/entry-book.expected.md`, reviewed 2026-11-07) and the
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

/** The settings of M21. */
const M21 = {
  ignoredFolders: ['Export'],
  entryMarkerKeys: ['vigour', 'attacks', 'illustration', 'layout'],
  expectCompiledFolders: ['Entries/Creatures'],
};

const compile = (normaliseHeadings: boolean): CompileResult =>
  new InMemoryVaultCompiler(loadVault(), { normaliseHeadings, ...M21 }).compile('Entries/Entry book.md');

describe('#115: the entry chapter of the fixture vault', () => {
  it('compiles to the reviewed book ("Normalise headings" on)', () => {
    const expected = readFileSync(new URL('../fixtures/entry-book.expected.md', import.meta.url), 'utf8');
    assert.equal(compile(true).content, expected);
  });

  it('gives exactly the three warnings M21 expects, in order', () => {
    assert.deepEqual(compile(true).warningDetails.map(w => [w.message, w.link, w.file, w.line]), [
      ['Duplicate entry omitted', '[[Fen Hare]]', 'Entries/Entry book.md', 10],
      ['Entry image is not a local image (note)', '[[Quick Step]]', 'Entries/Creatures/Reed Toad.md', 8],
      ['Not compiled', 'Entries/Creatures/Bog Rat.md', 'Entries/Creatures/Bog Rat.md', 0],
    ]);
  });

  it('every block reads back with yaml 2.9.1 (SCAR-028)', () => {
    const blocks = [...compile(true).content.matchAll(/^```o2t-entry\n([\s\S]*?)^```$/gm)].map(m => parse(m[1]));
    assert.equal(blocks.length, 3);
    assert.deepEqual(blocks[0].skills, ['Quick Step', 'Keen Nose']);
    assert.equal(blocks[0].illustration, '![Drawn by A. Nobody](assets/hare.png)');
    assert.equal(blocks[1].illustration, 'assets/owl.png');
    assert.equal(blocks[2].illustration, undefined);
    assert.equal('aliases' in blocks[0], false);
  });

  it('copies the two images once each', () => {
    const r = compile(true);
    assert.equal(r.stats.assetsCopied, 2);
    assert.equal(r.stats.assetsDeduplicated, 0);
  });

  it('with "Normalise headings" off the entries sit beside the chapter heading (why M21 runs with it on)', () => {
    const out = compile(false).content;
    assert.match(out, /^## Beasts\n\n## Fen Hare\n```o2t-entry$/m);
  });

  it('the existing fixture books are unchanged by the chapter (invariant 1)', () => {
    const files = loadVault();
    for (const start of ['index2compile.md', 'Smoke/Smoke book.md']) {
      const without = Object.fromEntries(Object.entries(files).filter(([path]) => !path.startsWith('Entries/')));
      assert.equal(
        new InMemoryVaultCompiler(files, { normaliseHeadings: true }).compile(start).content,
        new InMemoryVaultCompiler(without, { normaliseHeadings: true }).compile(start).content,
        start,
      );
    }
  });
});
