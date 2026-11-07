/**
 * Tests for US-9.4 (#108): notes in `expectCompiledFolders` that no
 * whole-note embed brought in are listed in the warnings file.
 *
 * Written before the code (G2, 2026-11-07): red until US-9.4 exists.
 * Option: `expectCompiledFolders` (string array, as typed in the setting);
 * `ignoredFolders` (the output folders, US-3.1).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';

const VAULT: Record<string, string> = {
  'index.md': '# Book\n\n![[Hare]]\n\n![[Owl#Signs]]\n\n> ![[Toad]]\n',
  'Creatures/Hare.md': 'Hare.\n',
  'Creatures/Owl.md': '# Owl\n\n## Signs\n\nHoots.\n',
  'Creatures/Toad.md': 'Toad.\n',
  'Creatures/Deep/Rat.md': 'Rat.\n',
  'Creatures/map.excalidraw.md': 'x',
  'Creatures/pic.png': 'b',
  'Creature/Slug.md': 'Slug.\n',
  'Lore/Creatures/Elf.md': 'Elf.\n',
};

function compile(folders: string[], files: Record<string, string> = {}, options: Record<string, unknown> = {}): CompileResult {
  return new InMemoryVaultCompiler({ ...VAULT, ...files }, { expectCompiledFolders: folders, ...options }).compile('index.md');
}

const rows = (r: CompileResult) => r.warningDetails.map(w => [w.message, w.link, w.file, w.line]);

describe('US-9.4 AC-1 to AC-4: the report', () => {
  it('Creatures → four rows, sorted by path, after the other warnings', () => {
    const r = compile(['Creatures'], { 'index.md': VAULT['index.md'] + '\n![[Gone]]\n' });
    assert.deepEqual(rows(r), [
      ['Missing include', 'Gone', 'index.md', 9],
      ['Not compiled', 'Creatures/Deep/Rat.md', 'Creatures/Deep/Rat.md', 0],
      ['Not compiled (section embed only)', 'Creatures/Owl.md', 'Creatures/Owl.md', 0],
      ['Not compiled (quoted only)', 'Creatures/Toad.md', 'Creatures/Toad.md', 0],
    ]);
  });

  it('works without entryMarkerKeys', () => {
    assert.equal(rows(compile(['Creatures'])).length, 3);
  });
});

describe('US-9.4 AC-1: folder values (SCAR-033)', () => {
  const notCompiled = (r: CompileResult) => r.warningDetails.filter(w => w.message.startsWith('Not compiled')).map(w => w.link);

  it('empty → off', () => assert.deepEqual(rows(compile([])), []));

  for (const value of ['Creatures/', '/Creatures']) {
    it(`${value} = Creatures`, () => assert.deepEqual(notCompiled(compile([value])),
      ['Creatures/Deep/Rat.md', 'Creatures/Owl.md', 'Creatures/Toad.md']));
  }

  it('Lore\\Creatures → Lore/Creatures', () => assert.deepEqual(notCompiled(compile(['Lore\\Creatures'])), ['Lore/Creatures/Elf.md']));

  it('Creature → only Creature/, whole segments', () => assert.deepEqual(notCompiled(compile(['Creature'])), ['Creature/Slug.md']));

  it('/ → the whole vault, without the starting file', () => {
    const listed = notCompiled(compile(['/']));
    assert.ok(listed.includes('Lore/Creatures/Elf.md'));
    assert.ok(!listed.includes('index.md'));
  });

  for (const value of ['creatures', '../x', 'C:\\x', 'Nowhere']) {
    it(`${value} → ignored with a warning`, () => {
      const r = compile([value]);
      assert.deepEqual(rows(r), [[`Folder not found in the vault: ${value}`, value, '', 0]]);
    });
  }
});

describe('US-9.4 AC-2: what is left out', () => {
  it('excalidraw, non-notes, the starting file, the output folder', () => {
    const r = compile(['/'], { 'Out/compiledtext.md': 'x', 'Out/assets/a.md': 'y' }, { ignoredFolders: ['Out'] });
    const listed = r.warningDetails.map(w => w.link);
    assert.ok(listed.includes('Lore/Creatures/Elf.md'), 'the report runs (not vacuous)');
    for (const gone of ['Creatures/map.excalidraw.md', 'Creatures/pic.png', 'index.md', 'Out/compiledtext.md', 'Out/assets/a.md']) {
      assert.ok(!listed.includes(gone), gone);
    }
  });
});

describe('US-9.4 AC-3: what counts as compiled', () => {
  it('a ToC item and a pass-through target count', () => {
    const r = compile(['Creatures'], {
      'index.md': '# Book\n\n- [[Hare]]\n- [[Owl]]\n\n![[W]]\n\n![[Toad]]\n', 'W.md': '![[Rat]]\n',
      'Creatures/Extra.md': 'Extra.\n',
    });
    assert.deepEqual(rows(r), [['Not compiled', 'Creatures/Extra.md', 'Creatures/Extra.md', 0]]);
  });

  it('a note only linked, not embedded → listed', () => {
    const r = compile(['Creature'], { 'index.md': '# Book\n\nSee [[Slug]].\n' });
    assert.deepEqual(r.warningDetails.filter(w => w.message.startsWith('Not compiled')).map(w => w.link), ['Creature/Slug.md']);
  });
});
