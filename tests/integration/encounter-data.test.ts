/**
 * Tests for US-9.6 (Epic 9): the creature's data in a row (AC-4), that the
 * creature note is not compiled (AC-5) and that the replacement runs before
 * the link steps (AC-2). Format owned by its reader, Obsidian2Typst
 * (`docs/technical/encounter-block.md`, SCAR-040). Synthetic notes only
 * (SCAR-035): Fen Hare, Bog Wight, Lost Pilgrim, Mire Hollow.
 *
 * Written before the code (G2, 2026-11-25): red until US-9.6 exists.
 * Options: `encounterCalloutType`, `entryMarkerKeys`, `entryExcludeKeys`,
 * `entryAssetKeys`, `expectCompiledFolders`, `normaliseHeadings`.
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

function blocks(content: string, language = 'o2t-encounter'): string[] {
  return [...content.matchAll(new RegExp('^(`{3,})' + language + '\\n([\\s\\S]*?)^\\1$', 'gm'))].map(m => m[2]);
}

interface Row { name: string; count: string; note?: string; data?: Record<string, unknown> }

/** US-9.6 | AC-6, AC-10: the expected block text, from the writer of US-9.1 with each `count` double-quoted; see `encounter-callout.test.ts`. */
function expectedBlock(rows: Row[]): string {
  const doc = new Document({
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
function assertOneBlock(content: string, rows: Row[]): void {
  const found = blocks(content);
  assert.equal(found.length, 1, content);
  assert.equal(`\`\`\`o2t-encounter\n${found[0]}\`\`\`\n`, expectedBlock(rows));
  assert.deepEqual(parse(found[0]), {
    rows: rows.map(r => ({
      name: r.name, count: r.count,
      ...(r.note === undefined ? {} : { note: r.note }),
      ...(r.data === undefined ? {} : { data: r.data }),
    })),
  });
}

const messages = (r: CompileResult) => r.warningDetails.map(w => w.message);
const encounterWarnings = (r: CompileResult) => r.warningDetails.filter(w => w.message.startsWith('Encounter list'));

/** A creature with every kind of property the entry rules treat differently. */
const RICH = [
  '---',
  'aliases: [Hare]',
  'vigour: 11',
  'Might: 4',
  'tags: [beast]',
  'cssclasses: [wide]',
  'skills:',
  '  - "[[Quick Step]]"',
  '  - "[[Skills/Keen Nose|Keen Nose]]"',
  'illustration: "[[hare.png]]"',
  'attacks:',
  '  - "Kick: 2d6"',
  '---',
  'Fen hares are shy.',
  '',
].join('\n');

const files = (callout: string, extra: Files = {}): Files => ({
  'index.md': '# Book\n\n![[Mire Hollow]]\n',
  'Mire Hollow.md': `# Mire Hollow\n\n${callout}`,
  'Fen Hare.md': RICH,
  'hare.png': 'b',
  ...extra,
});
const ONE_HARE = '> [!encounter]\n> - 2 × [[Fen Hare]]\n';

describe('US-9.6 AC-4: the data is what the entry block would write', () => {
  it('US-9.6 AC-4: same keys, same order, default exclusions, tags kept, links flattened, no image key', () => {
    const r = compile(files(ONE_HARE));
    assertOneBlock(r.content, [{
      name: 'Fen Hare', count: '2',
      data: { vigour: 11, might: 4, tags: ['beast'], skills: ['Quick Step', 'Keen Nose'], attacks: ['Kick: 2d6'] },
    }]);
    assert.deepEqual(r.warningDetails, []);
  });

  it('US-9.6 AC-4: equal to the map of the entry block of the same note, without the asset key (same compile settings)', () => {
    const asEntry = compile({ ...files(ONE_HARE), 'index.md': '# Book\n\n![[Fen Hare]]\n' });
    const entry = parse(blocks(asEntry.content, 'o2t-entry')[0]) as Record<string, unknown>;
    delete entry.illustration;
    const r = compile(files(ONE_HARE));
    const data = (parse(blocks(r.content)[0]) as { rows: Array<{ data: Record<string, unknown> }> }).rows[0].data;
    assert.deepEqual(data, entry);
    assert.deepEqual(Object.keys(data), Object.keys(entry), 'the same order');
  });

  it('US-9.6 AC-4: no image is copied and no image text is written (US-9.2 does not run)', () => {
    const r = compile(files(ONE_HARE));
    assert.equal(r.stats.assetsCopied, 0);
    assert.doesNotMatch(r.content, /assets\/|hare\.png|illustration/);
    assert.deepEqual(r.warningDetails, []);
  });

  it('US-9.6 AC-4: entryExcludeKeys [] → nothing excluded (SCAR-019)', () => {
    const r = compile(files(ONE_HARE), { entryExcludeKeys: [] });
    assertOneBlock(r.content, [{
      name: 'Fen Hare', count: '2',
      data: {
        aliases: ['Hare'], vigour: 11, might: 4, tags: ['beast'], cssclasses: ['wide'],
        skills: ['Quick Step', 'Keen Nose'], attacks: ['Kick: 2d6'],
      },
    }]);
  });

  it('US-9.6 AC-4: entryExcludeKeys [aliases, tags] → tags left out too', () => {
    const r = compile(files(ONE_HARE), { entryExcludeKeys: ['aliases', 'tags'] });
    assertOneBlock(r.content, [{
      name: 'Fen Hare', count: '2',
      data: { vigour: 11, might: 4, cssclasses: ['wide'], skills: ['Quick Step', 'Keen Nose'], attacks: ['Kick: 2d6'] },
    }]);
  });

  it('US-9.6 AC-4: entryAssetKeys [] → illustration is no image key, it is written as text, links flattened', () => {
    const r = compile(files(ONE_HARE), { entryAssetKeys: [] });
    assertOneBlock(r.content, [{
      name: 'Fen Hare', count: '2',
      data: { vigour: 11, might: 4, tags: ['beast'], skills: ['Quick Step', 'Keen Nose'], illustration: 'hare.png', attacks: ['Kick: 2d6'] },
    }]);
    assert.equal(r.stats.assetsCopied, 0);
  });

  it('US-9.6 AC-4: entryAssetKeys [illustration, portrait] → both left out', () => {
    const note = RICH.replace('attacks:', 'portrait: "[[hare.png]]"\nattacks:');
    const r = compile(files(ONE_HARE, { 'Fen Hare.md': note }), { entryAssetKeys: ['illustration', 'portrait'] });
    const data = (parse(blocks(r.content)[0]) as { rows: Array<{ data: Record<string, unknown> }> }).rows[0].data;
    assert.deepEqual(Object.keys(data), ['vigour', 'might', 'tags', 'skills', 'attacks']);
    assert.equal(r.stats.assetsCopied, 0);
  });
});

describe('US-9.6 AC-4: rows without data', () => {
  const lost = { name: 'Lost Pilgrim', count: '1', note: 'no stats' };

  it('US-9.6 AC-4: a note without a marker key, and plain text → no data, no warning', () => {
    const r = compile(files('> [!encounter]\n> - 1 × [[Reed Cutter]]\n> - 1 × Lost Pilgrim — no stats\n', {
      'Reed Cutter.md': '---\ntags: [folk]\nmight: 2\n---\nA cutter.\n',
    }));
    assertOneBlock(r.content, [{ name: 'Reed Cutter', count: '1' }, lost]);
    assert.deepEqual(r.warningDetails, []);
  });

  it('US-9.6 AC-4: a note with no frontmatter at all → no data, no warning', () => {
    const r = compile(files('> [!encounter]\n> - 1 × [[Reed Cutter]]\n', { 'Reed Cutter.md': 'A cutter.\n' }));
    assertOneBlock(r.content, [{ name: 'Reed Cutter', count: '1' }]);
    assert.deepEqual(r.warningDetails, []);
  });

  it('US-9.6 AC-4: entryMarkerKeys [] → no row has data, and the row is still written', () => {
    const r = compile(files(ONE_HARE), { entryMarkerKeys: [] });
    assertOneBlock(r.content, [{ name: 'Fen Hare', count: '2' }]);
    assert.deepEqual(r.warningDetails, []);
  });

  it('US-9.6 AC-4: a link that does not resolve → no data, and the warning naming the room and the line', () => {
    const r = compile(files('> [!encounter]\n> - 2 × [[Fen Hare]]\n> - 1 × [[Fen Hair]] — typo\n'));
    assertOneBlock(r.content, [
      { name: 'Fen Hare', count: '2', data: { vigour: 11, might: 4, tags: ['beast'], skills: ['Quick Step', 'Keen Nose'], attacks: ['Kick: 2d6'] } },
      { name: 'Fen Hair', count: '1', note: 'typo' },
    ]);
    assert.deepEqual(r.warningDetails, [
      { message: 'Encounter list: no note "Fen Hair"', link: 'Fen Hair', file: 'Mire Hollow.md', line: 5 },
    ]);
    assert.deepEqual(r.warnings.filter(w => w.includes('Encounter list')), ['Warning: Encounter list: no note "Fen Hair"']);
  });

  it('US-9.6 AC-9: the line of the warning is the line as stored, frontmatter included', () => {
    const f = files('> [!encounter]\n> - 1 × [[Fen Hair]]\n');
    f['Mire Hollow.md'] = '---\ntags: [x]\n---\n' + f['Mire Hollow.md'];
    // Corrected at #134 (SCAR-003): "no note" names the row's line (Interface paragraph), line 7, not the header's.
    assert.deepEqual(encounterWarnings(compile(f)).map(w => [w.file, w.line]), [['Mire Hollow.md', 7]]);
  });

  it('US-9.6 AC-4, AC-2: with entryMarkerKeys [] an existing creature gives neither data nor a warning', () => {
    const r = compile(files('> [!encounter]\n> - 1 × [[Fen Hare]]\n'), { entryMarkerKeys: [] });
    assert.equal(messages(r).length, 0);
  });
});

describe('US-9.6 AC-5: the creature note is not compiled', () => {
  it('US-9.6 AC-5: no heading and no text of the creature in the book', () => {
    const r = compile(files(ONE_HARE));
    assert.doesNotMatch(r.content, /^#+ Fen Hare$/m);
    assert.doesNotMatch(r.content, /Fen hares are shy\./);
    assert.doesNotMatch(r.content, /o2t-entry/);
  });

  it('US-9.6 AC-5: the creature is not an entry of the book: it is read, not counted as processed', () => {
    const withCreature = compile(files(ONE_HARE));
    const withoutLink = compile(files('> [!encounter]\n> - 2 × Lost Pilgrim\n'));
    assert.equal(withCreature.stats.filesProcessed, withoutLink.stats.filesProcessed);
  });

  it('US-9.6 AC-5 (owner Q-A, 2026-11-25): in an expected folder, a creature that only a row reads is still reported "Not compiled", as one nobody names', () => {
    const f = files('> [!encounter]\n> - 2 × [[Fen Hare]]\n', {
      'Creatures/Bog Rat.md': '---\nvigour: 3\n---\nA rat.\n',
    });
    f['Creatures/Fen Hare.md'] = f['Fen Hare.md'];
    delete f['Fen Hare.md'];
    const r = compile(f, { expectCompiledFolders: ['Creatures'] });
    assertOneBlock(r.content, [{
      name: 'Fen Hare', count: '2',
      data: { vigour: 11, might: 4, tags: ['beast'], skills: ['Quick Step', 'Keen Nose'], attacks: ['Kick: 2d6'] },
    }]);
    const notCompiled = r.warningDetails.filter(w => w.message.startsWith('Not compiled')).map(w => w.link);
    assert.deepEqual([...notCompiled].sort(), ['Creatures/Bog Rat.md', 'Creatures/Fen Hare.md'], 'reading a creature is not compiling it');
  });
});

describe('US-9.6 AC-4 (owner Q-B, Q-C, 2026-11-25)', () => {
  it('US-9.6 AC-4 (Q-B): with entryMarkerKeys empty a broken link still warns; no row has data', () => {
    const r = compile(files('> [!encounter]\n> - 2 × [[Fen Hare]]\n> - 1 × [[Fen Hair]]\n'), { entryMarkerKeys: [] });
    assertOneBlock(r.content, [{ name: 'Fen Hare', count: '2' }, { name: 'Fen Hair', count: '1' }]);
    assert.deepEqual(encounterWarnings(r).map(w => w.message), ['Encounter list: no note "Fen Hair"']);
  });

  it('US-9.6 AC-3 (Q-C): a section link names the note and takes its data', () => {
    const r = compile(files('> [!encounter]\n> - 1 × [[Fen Hare#Habits]]\n'));
    assertOneBlock(r.content, [{
      name: 'Fen Hare', count: '1',
      data: { vigour: 11, might: 4, tags: ['beast'], skills: ['Quick Step', 'Keen Nose'], attacks: ['Kick: 2d6'] },
    }]);
  });

  it('US-9.6 AC-3 (Q-C, #134 mutation round): a broken section link is named without its anchor', () => {
    const r = compile(files('> [!encounter]\n> - 1 × [[Fen Hair#Habits]]\n'));
    assertOneBlock(r.content, [{ name: 'Fen Hair', count: '1' }]);
    assert.deepEqual(encounterWarnings(r).map(w => [w.message, w.link]), [['Encounter list: no note "Fen Hair"', 'Fen Hair']]);
  });

  it('US-9.6 AC-3 (Q-C): links in the note are written as their text', () => {
    const r = compile(files('> [!encounter]\n> - 1 × Lost Pilgrim — seen at [[Old Weir]] and [the ford](Ford.md)\n'));
    assertOneBlock(r.content, [{ name: 'Lost Pilgrim', count: '1', note: 'seen at Old Weir and the ford' }]);
  });
});

describe('US-9.6 AC-2: the replacement runs before the link steps', () => {
  const fen = 'Fen hares are shy.\n';

  it('US-9.6 AC-2: no "link target not embedded" warning for a wikilink or a Markdown link in the callout', () => {
    const r = compile(files('> [!encounter]\n> - 2 × [[Fen Hare]]\n> - 3 × [hares](Fen%20Hare.md)\n> - 1d4 × [[Bog Wight|wights]]\n', {
      'Bog Wight.md': '---\nvigour: 20\n---\nWights.\n',
    }));
    assert.deepEqual(r.warningDetails, []);
    assert.doesNotMatch(r.content, /link target|<!-- Warning|\]\(#|\[\[/);
  });

  it('US-9.6 AC-2: a link to a creature that is embedded elsewhere is not turned into an in-book link', () => {
    const r = compile({
      ...files(ONE_HARE),
      'index.md': '# Book\n\n![[Mire Hollow]]\n\n![[Fen Hare]]\n',
    });
    assert.equal(blocks(r.content).length, 1);
    assert.doesNotMatch(blocks(r.content)[0], /#|\[|\]/);
    assert.match(r.content, /^```o2t-entry$/m, 'the entry is compiled as usual');
    assert.match(r.content, new RegExp(fen.trim().replace(/\./g, '\\.')));
  });

  it('US-9.6 AC-2: the same line in a callout of another type still gives today\'s warning (the control)', () => {
    const r = compile(files('> [!note]\n> - 2 × [[Bog Wight]]\n', { 'Bog Wight.md': 'Wights.\n' }));
    assert.deepEqual(messages(r), ["link target 'Bog Wight' not embedded in compiled output"]);
  });
});
