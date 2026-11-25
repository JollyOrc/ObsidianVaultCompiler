/**
 * Tests for US-9.6 (Epic 9): how the lines of an encounter callout are read
 * (AC-3) and the block they give (AC-6, AC-9, AC-10). Format owned by its
 * reader, Obsidian2Typst (`docs/technical/encounter-block.md`, SCAR-040).
 * Synthetic notes only (SCAR-035): Fen Hare, Bog Wight, Lost Pilgrim, Mire Hollow.
 *
 * Written before the code (G2, 2026-11-25): red until US-9.6 exists.
 * Options: `encounterCalloutType` and `entryMarkerKeys` (see the "Interface"
 * paragraph of US-9.6). Warnings: message / link / file / line as fixed there.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';

type Files = Record<string, string>;

/** US-9.6 | AC-10: the reader's parser and the writer of US-9.1, the library itself (installed with the plugin). */
const { parse, Document, Scalar } = createRequire(new URL('../../plugin/package.json', import.meta.url))('yaml') as typeof import('yaml');

function compile(files: Files, options: Record<string, unknown> = {}, start = 'index.md'): CompileResult {
  const r = new InMemoryVaultCompiler(files, { encounterCalloutType: 'encounter', entryMarkerKeys: ['vigour'], ...options }).compile(start);
  assert.doesNotMatch(r.content, /__v\w+__/, r.content);
  return r;
}

function blocks(content: string): string[] {
  return [...content.matchAll(/^(`{3,})o2t-encounter\n([\s\S]*?)^\1$/gm)].map(m => m[2]);
}

interface Row { name: string; count: string; note?: string; data?: Record<string, unknown> }

/** US-9.6 | AC-6, AC-10: the expected block text, from the writer of US-9.1 with each `count` double-quoted; see `encounter-callout.test.ts`. */
function expectedBlock(rows: Row[], title?: string): string {
  const doc = new Document({
    ...(title === undefined ? {} : { title }),
    rows: rows.map(r => ({
      name: r.name,
      count: Object.assign(new Scalar(r.count), { type: 'QUOTE_DOUBLE' as const }),
      ...(r.note === undefined ? {} : { note: r.note }),
      ...(r.data === undefined ? {} : { data: r.data }),
    })),
  }, { aliasDuplicateObjects: false }); // #134: the writer never writes YAML anchors (two rows of one creature)
  return '```o2t-encounter\n' + doc.toString({ nullStr: '' }) + '```\n';
}

/** US-9.6 | AC-6, AC-10 (SCAR-028): exact text, and the values parsed back. */
function assertOneBlock(content: string, rows: Row[], title?: string): void {
  const found = blocks(content);
  assert.equal(found.length, 1, content);
  assert.equal(`\`\`\`o2t-encounter\n${found[0]}\`\`\`\n`, expectedBlock(rows, title));
  assert.deepEqual(parse(found[0]), {
    ...(title === undefined ? {} : { title }),
    rows: rows.map(r => ({
      name: r.name, count: r.count,
      ...(r.note === undefined ? {} : { note: r.note }),
      ...(r.data === undefined ? {} : { data: r.data }),
    })),
  });
}

const FEN = { vigour: 11, might: 4, attacks: ['Kick: 2d6'] };
const BOG = { vigour: 20, attacks: ['Claw: 3d8'] };
const NOTES: Files = {
  'Fen Hare.md': '---\nvigour: 11\nmight: 4\nattacks:\n  - "Kick: 2d6"\n---\nFen hares are shy.\n',
  'Bog Wight.md': '---\nvigour: 20\nattacks:\n  - "Claw: 3d8"\n---\nWights.\n',
};
const room = (callout: string, extra: Files = {}, prefix = ''): Files => ({
  'index.md': '# Book\n\n![[Mire Hollow]]\n',
  'Mire Hollow.md': `${prefix}# Mire Hollow\n\n${callout}`,
  ...NOTES,
  ...extra,
});
const encounterLines = (r: CompileResult) => r.warningDetails.filter(w => w.message.startsWith('Encounter list'));

describe('US-9.6 AC-3: the line forms (the story\'s table)', () => {
  const cases: Array<[string, Row]> = [
    ['> - 2 × [[Fen Hare]] — nibbling reeds', { name: 'Fen Hare', count: '2', note: 'nibbling reeds', data: FEN }],
    ['> - 1d4 x [[Bog Wight|wights]]', { name: 'Bog Wight', count: '1d4', data: BOG }],
    ['> * 1 × Lost Pilgrim — no stats', { name: 'Lost Pilgrim', count: '1', note: 'no stats' }],
    ['> - 3 × [hares](Fen%20Hare.md)', { name: 'Fen Hare', count: '3', data: FEN }],
    ['> - **2** × [[Fen Hare]]', { name: 'Fen Hare', count: '2', data: FEN }],
    ['> - two × [[Fen Hare]]', { name: 'Fen Hare', count: 'two', data: FEN }],
    // The rest of "`×`, `x` or `X`, spaces around it optional; `*` and `+` bullets too", and the count forms.
    ['> + 1 X Lost Pilgrim', { name: 'Lost Pilgrim', count: '1' }],
    ['> - 2×[[Fen Hare]]', { name: 'Fen Hare', count: '2', data: FEN }],
    ['> - 3x[[Bog Wight]]', { name: 'Bog Wight', count: '3', data: BOG }],
    ['> - d6 × Lost Pilgrim', { name: 'Lost Pilgrim', count: 'd6' }],
    ['> - 12 × Lost Pilgrim', { name: 'Lost Pilgrim', count: '12' }],
    ['> - 3d6 × Lost Pilgrim', { name: 'Lost Pilgrim', count: '3d6' }],
    ['> - 1 ×   Lost Pilgrim  — no stats  ', { name: 'Lost Pilgrim', count: '1', note: 'no stats' }],
  ];
  for (const [line, row] of cases) {
    it(`US-9.6 AC-3: ${line.trim()} → ${row.name}, count "${row.count}"`, () => {
      const r = compile(room(`> [!encounter]\n${line}\n`));
      assertOneBlock(r.content, [row]);
      assert.deepEqual(r.warningDetails, []);
    });
  }

  it('US-9.6 AC-3: a link into a folder → the note\'s name, not its path', () => {
    const files = room('> [!encounter]\n> - 1 × [[Bestiary/Fen Hare]]\n', { 'Bestiary/Fen Hare.md': NOTES['Fen Hare.md'] });
    delete files['Fen Hare.md'];
    const r = compile(files);
    assertOneBlock(r.content, [{ name: 'Fen Hare', count: '1', data: FEN }]);
  });

  it('US-9.6 AC-3: the rows keep the order of the lines, the same creature twice is two rows', () => {
    const r = compile(room('> [!encounter]\n> - 1 × Lost Pilgrim\n> - 2 × [[Fen Hare]]\n> - 1 × [[Fen Hare]]\n> - 1d4 × [[Bog Wight]]\n'));
    assertOneBlock(r.content, [
      { name: 'Lost Pilgrim', count: '1' },
      { name: 'Fen Hare', count: '2', data: FEN },
      { name: 'Fen Hare', count: '1', data: FEN },
      { name: 'Bog Wight', count: '1d4', data: BOG },
    ]);
  });

  it('US-9.6 AC-6: the story\'s example, the whole output, with the exact text of the block', () => {
    const r = compile({
      'index2compile.md': '![[Mire Hollow]]\n',
      'Mire Hollow.md': '# 3. Mire Hollow\n\n> [!encounter]\n> - 2 × [[Fen Hare]] — nibbling reeds\n> - 1d4 × [[Bog Wight|wights]]\n> - 1 × Lost Pilgrim — no stats\n',
      ...NOTES,
    }, {}, 'index2compile.md');
    const text = [
      '```o2t-encounter',
      'rows:',
      '  - name: Fen Hare',
      '    count: "2"',
      '    note: nibbling reeds',
      '    data:',
      '      vigour: 11',
      '      might: 4',
      '      attacks:',
      '        - "Kick: 2d6"',
      '  - name: Bog Wight',
      '    count: "1d4"',
      '    data:',
      '      vigour: 20',
      '      attacks:',
      '        - "Claw: 3d8"',
      '  - name: Lost Pilgrim',
      '    count: "1"',
      '    note: no stats',
      '```',
      '',
    ].join('\n');
    assert.equal(r.content, `## Mire Hollow\n${text}`);
    // The same text from the writer of US-9.1 (how the expected text was fixed, SCAR-023).
    assert.equal(text, expectedBlock([
      { name: 'Fen Hare', count: '2', note: 'nibbling reeds', data: FEN },
      { name: 'Bog Wight', count: '1d4', data: BOG },
      { name: 'Lost Pilgrim', count: '1', note: 'no stats' },
    ]));
    assert.deepEqual(r.warningDetails, [], 'no "link target not embedded" warning for Fen Hare or Bog Wight (AC-2)');
  });
});

describe('US-9.6 AC-3: the title', () => {
  it('US-9.6 AC-3: [!encounter] Night watch → title: Night watch, before rows', () => {
    const r = compile(room(`> [!encounter] Night watch\n> - 1 × Lost Pilgrim\n`));
    assertOneBlock(r.content, [{ name: 'Lost Pilgrim', count: '1' }], 'Night watch');
    assert.ok(blocks(r.content)[0].startsWith('title: Night watch\nrows:\n'));
  });

  it('US-9.6 AC-3: a folded callout\'s fold mark is not part of the title', () => {
    for (const mark of ['-', '+']) {
      const r = compile(room(`> [!encounter]${mark} Night watch\n> - 1 × Lost Pilgrim\n`));
      assertOneBlock(r.content, [{ name: 'Lost Pilgrim', count: '1' }], 'Night watch');
    }
  });

  it('US-9.6 AC-3: a title the YAML writer must quote reads back unchanged', () => {
    const r = compile(room(`> [!encounter] Night: the long watch\n> - 1 × Lost Pilgrim\n`));
    assertOneBlock(r.content, [{ name: 'Lost Pilgrim', count: '1' }], 'Night: the long watch');
  });

  for (const header of ['> [!encounter]', '> [!encounter]   ']) {
    it(`US-9.6 AC-3: ${JSON.stringify(header)} → no title key`, () => {
      const r = compile(room(`${header}\n> - 1 × Lost Pilgrim\n`));
      assertOneBlock(r.content, [{ name: 'Lost Pilgrim', count: '1' }]);
      assert.ok(blocks(r.content)[0].startsWith('rows:\n'));
    });
  }
});

describe('US-9.6 AC-3, AC-9: lines that are not rows', () => {
  const lines = (r: CompileResult) => encounterLines(r).map(w => [w.message, w.link, w.file, w.line]);

  it('US-9.6 AC-3: two lines left out → one warning, the story\'s example (lines 5 and 7, callout on line 3)', () => {
    const r = compile(room('> [!encounter]\n> - 2 × [[Fen Hare]]\n>\n> - 1 × Lost Pilgrim\n> Watch the reeds.\n'));
    assertOneBlock(r.content, [{ name: 'Fen Hare', count: '2', data: FEN }, { name: 'Lost Pilgrim', count: '1' }]);
    assert.deepEqual(lines(r), [['Encounter list: 2 lines not read (lines 5, 7)', '', 'Mire Hollow.md', 3]]);
    assert.deepEqual(r.warnings.filter(w => w.includes('Encounter list')), ['Warning: Encounter list: 2 lines not read (lines 5, 7)']);
  });

  it('US-9.6 AC-3: one line left out → the singular form', () => {
    const r = compile(room('> [!encounter]\n> - 1 × Lost Pilgrim\n>\n'));
    assert.deepEqual(lines(r), [['Encounter list: 1 line not read (line 5)', '', 'Mire Hollow.md', 3]]);
  });

  it('US-9.6 AC-9: lines are the lines as stored, frontmatter included', () => {
    const r = compile(room('> [!encounter]\n> - 2 × [[Fen Hare]]\n>\n> - 1 × Lost Pilgrim\n> Watch the reeds.\n', {}, '---\ntags: [x]\n---\n'));
    assert.deepEqual(lines(r), [['Encounter list: 2 lines not read (lines 8, 10)', '', 'Mire Hollow.md', 6]]);
  });

  const unread: Array<[string, string]> = [
    ['a blank quote line', '>'],
    ['a paragraph', '> Watch the reeds.'],
    ['a list line without ×', '> - Lost Pilgrim'],
    ['a list line with a count but no ×', '> - 2 Lost Pilgrim'],
  ];
  for (const [name, line] of unread) {
    it(`US-9.6 AC-3: ${name} → left out and counted`, () => {
      const r = compile(room(`> [!encounter]\n> - 1 × Lost Pilgrim\n${line}\n`));
      assertOneBlock(r.content, [{ name: 'Lost Pilgrim', count: '1' }]);
      assert.deepEqual(lines(r), [['Encounter list: 1 line not read (line 5)', '', 'Mire Hollow.md', 3]]);
    });
  }

  it('US-9.6 AC-3: the title line is not an unread line; a callout of rows only has no warning', () => {
    const r = compile(room('> [!encounter] Night watch\n> - 1 × Lost Pilgrim\n> - 2 × [[Fen Hare]]\n'));
    assert.deepEqual(r.warningDetails, []);
  });

  it('US-9.6 AC-6: a callout with no line → no block, the callout removed, "no rows"', () => {
    const r = compile(room('> [!encounter]\n\nAfter.\n'));
    assert.equal(blocks(r.content).length, 0);
    assert.doesNotMatch(r.content, /\[!encounter\]|o2t-encounter/);
    assert.match(r.content, /^## Mire Hollow\n+After\.\n$/m);
    assert.deepEqual(lines(r), [['Encounter list: no rows', '', 'Mire Hollow.md', 3]]);
    assert.deepEqual(r.warnings.filter(w => w.includes('Encounter list')), ['Warning: Encounter list: no rows']);
  });

  it('US-9.6 AC-6: a titled callout with no row → "no rows" too, no title written', () => {
    const r = compile(room('> [!encounter] Night watch\n\nAfter.\n'));
    assert.equal(blocks(r.content).length, 0);
    assert.deepEqual(lines(r), [['Encounter list: no rows', '', 'Mire Hollow.md', 3]]);
  });

  it('US-9.6 AC-3, AC-6: a callout with only a paragraph → both warnings (order not fixed)', () => {
    const r = compile(room('> [!encounter]\n> Watch the reeds.\n\nAfter.\n'));
    assert.equal(blocks(r.content).length, 0);
    assert.deepEqual(lines(r).sort(), [
      ['Encounter list: 1 line not read (line 4)', '', 'Mire Hollow.md', 3],
      ['Encounter list: no rows', '', 'Mire Hollow.md', 3],
    ]);
  });
});
