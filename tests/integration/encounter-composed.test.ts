/**
 * Tests for US-9.6 (Epic 9): composed cases (AC-7, SCAR-002, SCAR-041), that
 * other steps leave the block alone (AC-8, SCAR-039) and that warnings name
 * the note and the line (AC-9). Format owned by its reader, Obsidian2Typst
 * (`docs/technical/encounter-block.md`, SCAR-040). Synthetic notes only
 * (SCAR-035): Fen Hare, Bog Wight, Lost Pilgrim, Mire Hollow.
 *
 * Written before the code (G2, 2026-11-25): red until US-9.6 exists.
 * Options: `encounterCalloutType`, `entryMarkerKeys`, `normaliseHeadings`.
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

const off = (files: Files, start = 'index.md'): CompileResult =>
  new InMemoryVaultCompiler(files, { entryMarkerKeys: ['vigour'] }).compile(start);

function blocks(content: string, language = 'o2t-encounter'): string[] {
  return [...content.matchAll(new RegExp('^(`{3,})' + language + '\\n([\\s\\S]*?)^\\1$', 'gm'))].map(m => m[2]);
}

interface Row { name: string; count: string; note?: string; data?: Record<string, unknown> }

/** US-9.6 | AC-6, AC-10: the expected block text, from the writer of US-9.1 with each `count` double-quoted; `fence` is the backtick run. */
function expectedBlock(rows: Row[], title?: string, fence = '```'): string {
  const doc = new Document({
    ...(title === undefined ? {} : { title }),
    rows: rows.map(r => ({
      name: r.name,
      count: Object.assign(new Scalar(r.count), { type: 'QUOTE_DOUBLE' as const }),
      ...(r.note === undefined ? {} : { note: r.note }),
      ...(r.data === undefined ? {} : { data: r.data }),
    })),
  }, { aliasDuplicateObjects: false }); // #134: the writer never writes YAML anchors (two rows of one creature)
  return `${fence}o2t-encounter\n` + doc.toString({ nullStr: '' }) + `${fence}\n`;
}

/** US-9.6 | AC-10 (SCAR-028): the block `index` of the output as exact text, and its values parsed back. */
function assertBlock(content: string, index: number, rows: Row[], title?: string, fence = '```'): void {
  const found = blocks(content);
  assert.equal(`${fence}o2t-encounter\n${found[index]}${fence}\n`, expectedBlock(rows, title, fence));
  assert.deepEqual(parse(found[index]), {
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
const LOST: Row = { name: 'Lost Pilgrim', count: '1' };
const FEN_ROW: Row = { name: 'Fen Hare', count: '2', data: FEN };
const withRoom = (room: string, book = '# Book\n\n![[Mire Hollow]]\n', extra: Files = {}): Files =>
  ({ 'index.md': book, 'Mire Hollow.md': room, ...NOTES, ...extra });
const encounterWarnings = (r: CompileResult) => r.warningDetails.filter(w => w.message.startsWith('Encounter list'));

describe('US-9.6 AC-7: composed cases', () => {
  it('US-9.6 AC-7: two callouts in one room → two blocks, in order, the text between them kept', () => {
    const room = '# Mire Hollow\n\n> [!encounter] Night watch\n> - 1 × Lost Pilgrim\n\nBetween.\n\n> [!encounter] Day watch\n> - 2 × [[Fen Hare]]\n';
    const r = compile(withRoom(room));
    assert.equal(blocks(r.content).length, 2);
    assertBlock(r.content, 0, [LOST], 'Night watch');
    assertBlock(r.content, 1, [FEN_ROW], 'Day watch');
    assert.equal(r.content, `# Book\n\n## Mire Hollow\n${expectedBlock([LOST], 'Night watch')}\nBetween.\n\n${expectedBlock([FEN_ROW], 'Day watch')}`);
    assert.deepEqual(r.warningDetails, []);
  });

  it('US-9.6 AC-7: a room embedded twice → its block twice, its warning once', () => {
    const room = '# Mire Hollow\n\n> [!encounter]\n> - 1 × [[Fen Hair]]\n';
    const r = compile(withRoom(room, '# Book\n\n![[Mire Hollow]]\n\n![[Mire Hollow]]\n'));
    assert.equal(blocks(r.content).length, 2);
    const row = { name: 'Fen Hair', count: '1' };
    assertBlock(r.content, 0, [row]);
    assertBlock(r.content, 1, [row]);
    assert.deepEqual(encounterWarnings(r).map(w => [w.message, w.file, w.line]), [['Encounter list: no note "Fen Hair"', 'Mire Hollow.md', 4]]);
  });

  it('US-9.6 AC-7: a callout in a section embed → replaced; the rest of the note is not brought in', () => {
    const room = '# Mire Hollow\n\nIntro.\n\n## Night\n\n> [!encounter]\n> - 1 × Lost Pilgrim\n\n## Day\n\nSun.\n\n> [!encounter]\n> Nothing here.\n';
    const r = compile(withRoom(room, '# Book\n\n![[Mire Hollow#Night]]\n'));
    assert.equal(blocks(r.content).length, 1, r.content);
    assertBlock(r.content, 0, [LOST]);
    assert.doesNotMatch(r.content, /Sun\.|Intro\./);
    assert.deepEqual(encounterWarnings(r), [], 'a callout that is not in the book is not reported');
  });

  it('US-9.6 AC-9: a warning from a section embed names the note and the line as stored', () => {
    const room = '# Mire Hollow\n\nIntro.\n\n## Night\n\n> [!encounter]\n> - 1 × [[Fen Hair]]\n';
    const r = compile(withRoom(room, '# Book\n\n![[Mire Hollow#Night]]\n'));
    assert.deepEqual(encounterWarnings(r).map(w => [w.message, w.link, w.file, w.line]), [
      ['Encounter list: no note "Fen Hair"', 'Fen Hair', 'Mire Hollow.md', 8],
    ]);
  });

  it('US-9.6 AC-7: the room is the starting file → replaced, the warning names the starting file', () => {
    const r = compile({
      'Mire Hollow.md': '# Mire Hollow\n\n> [!encounter]\n> - 2 × [[Fen Hare]]\n> - 1 × [[Fen Hair]]\n', ...NOTES,
    }, {}, 'Mire Hollow.md');
    assert.equal(blocks(r.content).length, 1);
    assertBlock(r.content, 0, [FEN_ROW, { name: 'Fen Hair', count: '1' }]);
    assert.deepEqual(encounterWarnings(r).map(w => [w.file, w.line]), [['Mire Hollow.md', 5]]);
  });

  it('US-9.6 AC-7: through a chapter that embeds the room, the warning still names the room (AC-9)', () => {
    const r = compile({
      'index.md': '# Book\n\n![[Chapter]]\n',
      'Chapter.md': '# Chapter\n\nText.\n\n![[Mire Hollow]]\n',
      'Mire Hollow.md': '# Mire Hollow\n\n> [!encounter]\n> - 1 × [[Fen Hair]]\n',
    });
    assert.deepEqual(encounterWarnings(r).map(w => [w.file, w.line]), [['Mire Hollow.md', 4]]);
  });

  it('US-9.6 AC-7: a callout inside a list item or a quote → left as it is', () => {
    const room = '# Mire Hollow\n\n- > [!encounter]\n  > - 1 × Lost Pilgrim\n\n> > [!encounter]\n> > - 1 × Lost Pilgrim\n';
    const files = withRoom(room);
    const r = compile(files);
    assert.equal(r.content, off(files).content);
    assert.equal(blocks(r.content).length, 0);
    assert.deepEqual(encounterWarnings(r), []);
  });

  it('US-9.6 AC-7: a callout with a fenced code block in it → the fence\'s lines are not rows', () => {
    const room = '# Mire Hollow\n\n> [!encounter]\n> - 2 × [[Fen Hare]]\n> ```md\n> - 5 × [[Bog Wight]]\n> ```\n> - 1 × Lost Pilgrim\n';
    const r = compile(withRoom(room));
    assertBlock(r.content, 0, [FEN_ROW, LOST]);
    assert.equal(blocks(r.content).length, 1);
    assert.doesNotMatch(r.content, /Bog Wight|```md/);
    assert.deepEqual(encounterWarnings(r).map(w => [w.message, w.file, w.line]), [
      ['Encounter list: 3 lines not read (lines 5, 6, 7)', 'Mire Hollow.md', 3],
    ]);
    assert.deepEqual(r.warningDetails.filter(w => w.message.startsWith('link target')), []);
  });

  it('US-9.6 AC-7: the same creature twice in one callout → two rows, not merged', () => {
    const room = '# Mire Hollow\n\n> [!encounter]\n> - 2 × [[Fen Hare]] — by the reeds\n> - 1d4 × [[Fen Hare]] — in the mist\n';
    const r = compile(withRoom(room));
    assertBlock(r.content, 0, [
      { name: 'Fen Hare', count: '2', note: 'by the reeds', data: FEN },
      { name: 'Fen Hare', count: '1d4', note: 'in the mist', data: FEN },
    ]);
  });
});

describe('US-9.6 AC-7: a creature that is also an entry of the same compile', () => {
  const room = '# Mire Hollow\n\n> [!encounter]\n> - 2 × [[Fen Hare]]\n';
  for (const [name, book] of [
    ['the room first', '# Book\n\n![[Mire Hollow]]\n\n![[Fen Hare]]\n'],
    ['the entry first', '# Book\n\n![[Fen Hare]]\n\n![[Mire Hollow]]\n'],
  ] as const) {
    it(`US-9.6 AC-7: ${name} → the entry is compiled as usual, once, and the row still has data`, () => {
      const r = compile(withRoom(room, book));
      assertBlock(r.content, 0, [FEN_ROW]);
      assert.equal(blocks(r.content, 'o2t-entry').length, 1, r.content);
      assert.deepEqual(parse(blocks(r.content, 'o2t-entry')[0]), FEN);
      assert.match(r.content, /^#+ Fen Hare\n```o2t-entry\n/m);
      assert.match(r.content, /Fen hares are shy\./);
      assert.doesNotMatch(r.content, /repeat of/);
      assert.deepEqual(r.warningDetails, [], 'no "Duplicate entry omitted", no "Not compiled"');
    });
  }
});

describe('US-9.6 AC-8: other steps leave the block alone (SCAR-039)', () => {
  const tricky = [
    '---',
    'vigour: 1',
    'skills:',
    '  - "- [[A]]"',
    '  - "<!-- x -->"',
    '  - "# Not a heading"',
    '  - "![c](x.png)"',
    '  - "%20"',
    '---',
    'Text.',
    '',
  ].join('\n');
  // Read as AC-4 and AC-8 together (see the "Interface" paragraph): the values US-9.1 writes, links flattened.
  const data = { vigour: 1, skills: ['- A', '<!-- x -->', '# Not a heading', 'c', '%20'] };
  const room = '# Mire Hollow\n\n> [!encounter]\n> - 1 × [[Imp]]\n';

  for (const normaliseHeadings of [true, false]) {
    it(`US-9.6 AC-8: tricky values byte for byte, no warning, normaliseHeadings ${normaliseHeadings}`, () => {
      const r = compile(withRoom(room, '# Book\n\n![[Mire Hollow]]\n', { 'Imp.md': tricky }), { normaliseHeadings });
      assertBlock(r.content, 0, [{ name: 'Imp', count: '1', data }]);
      assert.equal(blocks(r.content).length, 1);
      assert.deepEqual(r.warningDetails, []);
      assert.doesNotMatch(r.content, /^# Not a heading$/m);
    });
  }

  it('US-9.6 AC-8: the value text is the one the entry block writes for the same note', () => {
    const asEntry = compile(withRoom(room, '# Book\n\n![[Imp]]\n', { 'Imp.md': tricky }));
    assert.deepEqual(parse(blocks(asEntry.content, 'o2t-entry')[0]), data);
  });

  it('US-9.6 AC-7: a value holding ``` → a four-backtick fence (the fence rule of US-9.1 AC-7)', () => {
    const note = '---\nvigour: 1\nskills:\n  - "a ``` b"\n---\nT.\n';
    const r = compile(withRoom(room, '# Book\n\n![[Mire Hollow]]\n', { 'Imp.md': note }));
    assertBlock(r.content, 0, [{ name: 'Imp', count: '1', data: { vigour: 1, skills: ['a ``` b'] } }], undefined, '````');
    assert.match(r.content, /^## Mire Hollow\n````o2t-encounter\n/m);
  });
});

describe('US-9.6 AC-1, AC-7 (#134 mutation round)', () => {
  it('US-9.6 AC-1: a room embedded inside a quote keeps its callout (depth 2 in the book), no block, no warning', () => {
    const f: Record<string, string> = {
      'index.md': '# Book\n\n> ![[Mire Hollow]]\n',
      'Mire Hollow.md': '# Mire Hollow\n\n> [!encounter]\n> - 1 × Lost Pilgrim\n',
    };
    const on = new InMemoryVaultCompiler(f, { encounterCalloutType: 'encounter', entryMarkerKeys: ['vigour'] }).compile('index.md');
    const off = new InMemoryVaultCompiler(f, { entryMarkerKeys: ['vigour'] }).compile('index.md');
    assert.equal(on.content, off.content);
    assert.doesNotMatch(on.content, /o2t-encounter|__v\w+__/);
  });

  it('US-9.6 AC-6: a callout without rows is removed with its line; the text around it stays as it was', () => {
    const r = new InMemoryVaultCompiler({ 'index.md': '# Book\n\nBefore.\n> [!encounter]\n> Nothing here.\nAfter.\n' }, { encounterCalloutType: 'encounter' }).compile('index.md');
    assert.equal(r.content, '# Book\nBefore.\nAfter.\n');
  });
});

