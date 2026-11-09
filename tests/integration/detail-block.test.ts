/**
 * Tests for US-9.5 (#118): a note's detail properties as an `o2t-details`
 * block. The block's format is owned by its reader, Obsidian2Typst
 * (`docs/technical/details-block.md`, SCAR-040). Synthetic notes only
 * (SCAR-035); expected values are the story's examples.
 *
 * Written before the code (G2, 2026-11-09): red until US-9.5 exists.
 * Option this file passes (to be added to `CompilerOptions`):
 * `detailMarkerKeys` (string array, lower case, in the order to write;
 * absent or `[]` = off). Links in values: `detail-links.test.ts`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';

type Files = Record<string, string>;

/** US-9.5 | AC-6, AC-14: the reader's parser, the library itself. */
const { parse } = createRequire(new URL('../../plugin/package.json', import.meta.url))('yaml') as typeof import('yaml');

const KEYS = ['pace', 'kind', 'needs', 'starter'];
const FM = '---\npace: Brisk\n---\n';
const BLOCK = '```o2t-details\npace: Brisk\n```\n';

function compile(files: Files, options: Record<string, unknown> = {}, start = 'index.md'): CompileResult {
  const r = new InMemoryVaultCompiler(files, { detailMarkerKeys: KEYS, ...options }).compile(start);
  // US-9.5 | AC-12: the placeholder that holds a block's place never reaches the output.
  assert.doesNotMatch(r.content, /__ventry__|__vdetail__/, r.content);
  return r;
}

/** US-9.5 | AC-14: every `o2t-details` block of the output, as text. */
function blocks(content: string): string[] {
  return [...content.matchAll(/^(`{3,})o2t-details\n([\s\S]*?)^\1$/gm)].map(m => m[2]);
}

/** US-9.5 | AC-14 (SCAR-028): the block as exact text and as values. */
function assertBlock(content: string, text: string, values: unknown): void {
  const found = blocks(content);
  assert.equal(found.length, 1, content);
  assert.equal(found[0], text);
  assert.deepEqual(parse(found[0]), values);
}

const messages = (r: CompileResult) => r.warningDetails.map(w => w.message);
const note = (yaml: string, body = 'Text.\n') => `---\n${yaml}\n---\n${body}`;
const book = (embed: string) => `# Book\n\n${embed}\n`;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('US-9.5 AC-1: off by default', () => {
  const files = { 'index.md': '# Book\n\n![[Reed Weaving]]\n', 'Reed Weaving.md': FM + 'You weave reeds.\n' };
  for (const options of [{}, { detailMarkerKeys: [] }]) {
    it(`detailMarkerKeys ${JSON.stringify(options)} → no block, frontmatter removed`, () => {
      const r = new InMemoryVaultCompiler(files, options).compile('index.md');
      assert.equal(r.content, '# Book\n\n## Reed Weaving\nYou weave reeds.\n');
    });
  }

  it('invariant 4: keys set, no note has them → same output and warnings as off', () => {
    const plain = { 'index.md': '# Book\n\n![[A]]\n', 'A.md': '---\ntags: [x]\nother: 1\n---\nText.\n' };
    const off = new InMemoryVaultCompiler(plain, {}).compile('index.md');
    const on = compile(plain);
    assert.equal(on.content, off.content);
    assert.deepEqual(on.warningDetails, off.warningDetails);
  });

  it('invariant 3: the note with the keys compiles as before when the setting is empty, entry setting on', () => {
    const entry = new InMemoryVaultCompiler(files, { entryMarkerKeys: ['pace'] }).compile('index.md');
    const both = new InMemoryVaultCompiler(files, { entryMarkerKeys: ['pace'], detailMarkerKeys: [] }).compile('index.md');
    assert.equal(both.content, entry.content);
  });
});

describe('US-9.5 AC-2: which notes get a block', () => {
  const cases: Array<[string, Files, number]> = [
    ['![[Reed Weaving]]', { 'index.md': book('![[Reed Weaving]]') }, 1],
    ['![x](Reed%20Weaving.md)', { 'index.md': book('![x](Reed%20Weaving.md)') }, 1],
    ['ToC list item', { 'index.md': book('- [[Reed Weaving]]') }, 1],
    ['pass-through target', { 'index.md': book('![[W]]'), 'W.md': '![[Reed Weaving]]\n' }, 1],
    ['section embed', { 'index.md': book('![[Reed Weaving#Knots]]') }, 0],
    ['quoted embed', { 'index.md': book('> ![[Reed Weaving]]') }, 0],
    ['callout embed', { 'index.md': book('> [!note]\n> ![[Reed Weaving]]') }, 0],
    ['embedded twice', { 'index.md': book('![[Reed Weaving]]\n\n![[Reed Weaving]]') }, 2],
  ];
  for (const [name, files, count] of cases) {
    it(`${name} → ${count} block(s)`, () => {
      const body = name === 'section embed'
        ? FM + '# Reed Weaving\n\nShy.\n\n## Knots\n\nTight.\n'
        : FM + 'You weave reeds.\n';
      const r = compile({ ...files, 'Reed Weaving.md': body });
      assert.equal(blocks(r.content).length, count, r.content);
      assert.doesNotMatch(r.content, /^---$/m, 'no frontmatter text');
      if (count === 0) assert.doesNotMatch(r.content, /pace|Brisk/, 'no property text at all');
    });
  }

  it('pass-through: none for the wrapper', () => {
    const r = compile({ 'index.md': book('![[W]]'), 'W.md': note('tags: [a]', '![[Reed Weaving]]\n'), 'Reed Weaving.md': FM + '# Reed Weaving\n\nT.\n' },
      { normaliseHeadings: true });
    assert.equal(r.content, `# Book\n\n## Reed Weaving\n${BLOCK}T.\n`);
  });

  it('the starting file → no block', () => {
    const r = compile({ 'Reed Weaving.md': FM + '# Reed Weaving\n\nT.\n' }, {}, 'Reed Weaving.md');
    assert.equal(blocks(r.content).length, 0);
    assert.doesNotMatch(r.content, /pace/);
  });

  const notTriggers: Array<[string, string]> = [
    ['nested key', note('stats:\n  pace: Brisk')],
    ['YAML comment, other keys', note('# pace: Brisk\ntags: [a]\nother: 1')],
    ['inside a multi-line string', note('text: |\n  pace: Brisk')],
  ];
  for (const [name, text] of notTriggers) {
    it(`${name} → no block`, () => {
      const r = compile({ 'index.md': book('![[A]]'), 'A.md': text });
      assert.equal(r.content, '# Book\n\n## A\nText.\n');
    });
  }

  it('an empty property is a trigger and is written empty', () => {
    const r = compile({ 'index.md': book('![[A]]'), 'A.md': note('pace:') });
    assertBlock(r.content, 'pace:\n', { pace: null });
  });

  it('the trigger key is matched without case, written in lower case', () => {
    const r = compile({ 'index.md': book('![[A]]'), 'A.md': note('PACE: Brisk') });
    assertBlock(r.content, 'pace: Brisk\n', { pace: 'Brisk' });
  });
});

describe('US-9.5 AC-3: directly under the title heading, in every title path', () => {
  const at = (body: string, root = '# Book\n\n## Crafts\n\n![[Reed Weaving]]\n', extra: Files = {}) =>
    (normaliseHeadings: boolean) =>
      compile({ 'index.md': root, 'Reed Weaving.md': FM + body, ...extra }, { normaliseHeadings }).content;

  it('embed line, on / off', () => {
    const run = at('You weave reeds.\n');
    assert.equal(run(true), `# Book\n\n## Crafts\n\n### Reed Weaving\n${BLOCK}You weave reeds.\n`);
    assert.equal(run(false), `# Book\n\n## Crafts\n\n## Reed Weaving\n${BLOCK}You weave reeds.\n`);
  });

  it('heading-first note, on / off', () => {
    const run = at('# Reed Weaving\n\nText.\n\n## Knots\n\nTight.\n');
    assert.equal(run(true), `# Book\n\n## Crafts\n\n### Reed Weaving\n${BLOCK}Text.\n\n#### Knots\nTight.\n`);
    assert.equal(run(false), `# Book\n\n## Crafts\n\n## Reed Weaving\n${BLOCK}Text.\n\n## Knots\nTight.\n`);
  });

  it('pass-through: the block follows the target heading, never the wrapper', () => {
    const run = at('# Reed Weaving\n\nShy.\n', '# Book\n\n## Crafts\n\n![[W]]\n', { 'W.md': '![[Reed Weaving]]\n' });
    assert.equal(run(true), `# Book\n\n## Crafts\n\n### Reed Weaving\n${BLOCK}Shy.\n`);
    assert.equal(run(false), `# Book\n\n## Crafts\n\n## W\n\n## Reed Weaving\n${BLOCK}Shy.\n`);
  });

  it('nested: under the note\'s own heading at its depth', () => {
    for (const nh of [true, false]) {
      const out = compile({
        'index.md': '# Book\n\n![[Section]]\n',
        'Section.md': 'Intro.\n\n![[Reed Weaving]]\n',
        'Reed Weaving.md': FM + 'Shy.\n',
      }, { normaliseHeadings: nh }).content;
      assert.match(out, new RegExp(`^#+ Reed Weaving\\n${escape(BLOCK)}Shy\\.$`, 'm'), out);
    }
  });

  // SCAR-009: what the body starts with.
  const starts = ['- item', '| a | b |\n|---|---|', '```js\nx\n```', '    code', '> quote', '> [!note]\n> text'];
  for (const first of starts) {
    it(`body starting with ${JSON.stringify(first.split('\n')[0])}`, () => {
      const out = at(`${first}\n`)(true);
      assert.ok(out.includes(`### Reed Weaving\n${BLOCK}${first.split('\n')[0]}`), out);
      assert.equal(blocks(out).length, 1);
    });
  }

  it('the block is the first thing of the document when the note is the first line', () => {
    const out = compile({ 'index.md': '![[Reed Weaving]]\n', 'Reed Weaving.md': FM + 'T.\n' }).content;
    assert.equal(out, `## Reed Weaving\n${BLOCK}T.\n`);
  });
});

describe('US-9.5 AC-4: the listed keys only, in the setting\'s order', () => {
  const text = note('pace: Brisk\nkind: craft\ntags: [x]\nother: 1');
  const run = (options: Record<string, unknown>, files: Files = {}) =>
    compile({ 'index.md': book('![[A]]'), 'A.md': text, ...files }, options);

  it('setting kind, pace → kind first, no tags, no other', () => {
    assertBlock(run({ detailMarkerKeys: ['kind', 'pace'] }).content, 'kind: craft\npace: Brisk\n', { kind: 'craft', pace: 'Brisk' });
  });

  it('setting pace, kind → the other order', () => {
    assertBlock(run({ detailMarkerKeys: ['pace', 'kind'] }).content, 'pace: Brisk\nkind: craft\n', { pace: 'Brisk', kind: 'craft' });
  });

  it('tags are never written unless listed; listed, a tag list is a list and is left out with the warning (AC-5)', () => {
    const r = run({ detailMarkerKeys: ['tags', 'pace'] });
    assertBlock(r.content, 'pace: Brisk\n', { pace: 'Brisk' });
    assert.deepEqual(messages(r), ['Detail value is not text: tags']);
  });

  it('a tags property that is one text is written when listed', () => {
    const r = run({ detailMarkerKeys: ['tags'] }, { 'A.md': note('tags: beast') });
    assertBlock(r.content, 'tags: beast\n', { tags: 'beast' });
  });

  it('a listed key the note does not have is left out', () => {
    assertBlock(run({ detailMarkerKeys: ['needs', 'pace', 'starter'] }).content, 'pace: Brisk\n', { pace: 'Brisk' });
  });

  it('the order of the setting holds for any key name, also one that looks like a number', () => {
    const r = compile({ 'index.md': book('![[A]]'), 'A.md': note('a: 1\n"1": 2\nb: 3') }, { detailMarkerKeys: ['b', '1', 'a'] });
    assert.equal(blocks(r.content)[0], 'b: 3\n"1": 2\na: 1\n');
  });

  it('a setting that lists a key twice writes it once', () => {
    assertBlock(run({ detailMarkerKeys: ['pace', 'pace'] }).content, 'pace: Brisk\n', { pace: 'Brisk' });
  });

  it('a note with none of the listed keys gets no block', () => {
    const r = run({ detailMarkerKeys: ['needs'] });
    assert.equal(r.content, '# Book\n\n## A\nText.\n');
  });

  it('the first of two keys that differ only in case is written, with one warning at the second', () => {
    const r = compile({ 'index.md': book('![[A]]'), 'A.md': note('Pace: Brisk\npace: Slow') });
    assertBlock(r.content, 'pace: Brisk\n', { pace: 'Brisk' });
    assert.deepEqual(r.warningDetails, [
      { message: 'Detail keys differ only in case: Pace / pace', link: 'pace', file: 'A.md', line: 3 },
    ]);
  });
});

describe('US-9.5 AC-5: values — text, number, flag, empty; no list, no map', () => {
  it('a list is left out with one warning at its key', () => {
    const r = compile({ 'index.md': book('![[A]]'), 'A.md': note('pace: Brisk\nneeds:\n  - A\n  - B') });
    assertBlock(r.content, 'pace: Brisk\n', { pace: 'Brisk' });
    assert.deepEqual(r.warningDetails, [{ message: 'Detail value is not text: needs', link: 'needs', file: 'A.md', line: 3 }]);
  });

  it('a map is left out with one warning at its key', () => {
    const r = compile({ 'index.md': book('![[A]]'), 'A.md': note('kind:\n  a: 1\npace: Brisk') });
    assertBlock(r.content, 'pace: Brisk\n', { pace: 'Brisk' });
    assert.deepEqual(r.warningDetails, [{ message: 'Detail value is not text: kind', link: 'kind', file: 'A.md', line: 2 }]);
  });

  it('nothing left → no block, the warning stays, the frontmatter is gone', () => {
    const r = compile({ 'index.md': book('![[A]]'), 'A.md': note('needs: [A]') });
    assert.equal(r.content, '# Book\n\n## A\nText.\n');
    assert.deepEqual(messages(r), ['Detail value is not text: needs']);
  });

  it('an empty list is a list too', () => {
    const r = compile({ 'index.md': book('![[A]]'), 'A.md': note('needs: []\npace: Slow') });
    assertBlock(r.content, 'pace: Slow\n', { pace: 'Slow' });
    assert.deepEqual(messages(r), ['Detail value is not text: needs']);
  });
});

describe('US-9.5 AC-13: a note embedded twice reports each problem once', () => {
  it('a list value in a twice-embedded note → one warning, two blocks', () => {
    const r = compile({ 'index.md': book('![[A]]\n\n![[A]]'), 'A.md': note('pace: Brisk\nneeds: [x]') });
    assert.equal(blocks(r.content).length, 2);
    assert.deepEqual(messages(r), ['Detail value is not text: needs']);
  });
});

describe('US-9.5 AC-6: the fixed YAML form', () => {
  const rows: Array<[string, string, unknown]> = [
    ['pace: Brisk', 'pace: Brisk\n', 'Brisk'],
    ['pace: 3', 'pace: 3\n', 3],
    ['pace: "3"', 'pace: "3"\n', '3'],
    ['starter: true', 'starter: true\n', true],
    ['starter: false', 'starter: false\n', false],
    ['pace:', 'pace:\n', null],
    ['pace: "Run first: ask later"', 'pace: "Run first: ask later"\n', 'Run first: ask later'],
    ['pace: "Bite #fire"', 'pace: "Bite #fire"\n', 'Bite #fire'],
    ['pace: 2026-11-07', 'pace: 2026-11-07\n', '2026-11-07'],
    ["pace: 'Brisk'", 'pace: Brisk\n', 'Brisk'],
    ['pace: yes', 'pace: yes\n', 'yes'],
  ];
  for (const [source, text, value] of rows) {
    it(JSON.stringify(source), () => {
      const key = source.split(':')[0];
      const r = compile({ 'index.md': book('![[A]]'), 'A.md': note(source) });
      assertBlock(r.content, text, { [key]: value });
      assert.deepEqual(r.warningDetails, []);
    });
  }
});

describe('US-9.5 AC-7: fence length', () => {
  it('a value holding ``` → a four-backtick fence', () => {
    const out = compile({ 'index.md': book('![[A]]'), 'A.md': note('pace: "a ``` b"') }).content;
    assert.ok(out.includes('## A\n````o2t-details\npace: a ``` b\n````\nText.'), out);
  });

  it('a value with single backticks → three', () => {
    const out = compile({ 'index.md': book('![[A]]'), 'A.md': note('pace: Uses `code` here') }).content;
    assert.ok(out.includes('## A\n```o2t-details\npace: Uses `code` here\n```\nText.'), out);
  });
});

describe('US-9.5 AC-9: entry keys and detail keys in one note', () => {
  const both = { 'index.md': book('![[A]]'), 'A.md': note('might: 3\npace: Brisk') };
  it('only the entry block, one warning at the first detail key', () => {
    const r = new InMemoryVaultCompiler(both, { entryMarkerKeys: ['might'], detailMarkerKeys: ['pace'] }).compile('index.md');
    assert.equal(blocks(r.content).length, 0);
    const entries = [...r.content.matchAll(/^```o2t-entry\n([\s\S]*?)^```$/gm)].map(m => parse(m[1]));
    assert.deepEqual(entries, [{ might: 3, pace: 'Brisk' }]);
    assert.deepEqual(r.warningDetails, [{
      message: 'Entry keys and detail keys in one note: only the entry block is written',
      link: 'pace', file: 'A.md', line: 3,
    }]);
  });

  it('a note with only entry keys, or only detail keys, in the same compile: no warning', () => {
    const r = new InMemoryVaultCompiler({
      'index.md': book('![[E]]\n\n![[D]]'),
      'E.md': note('might: 3'),
      'D.md': note('pace: Brisk'),
    }, { entryMarkerKeys: ['might'], detailMarkerKeys: ['pace'] }).compile('index.md');
    assert.equal(blocks(r.content).length, 1);
    assert.match(r.content, /^```o2t-entry$/m);
    assert.deepEqual(r.warningDetails, []);
  });

  it('a note with entry keys is a repeat candidate only as an entry; a detail note is written twice', () => {
    const r = compile({ 'index.md': book('![[D]]\n\n![[D]]'), 'D.md': note('pace: Brisk') });
    assert.equal(blocks(r.content).length, 2);
    assert.ok(!messages(r).includes('Duplicate entry omitted'));
  });
});

describe('US-9.5 AC-10: frontmatter that is not valid YAML', () => {
  const files = { 'index.md': book('![[A]]'), 'A.md': note('pace: [3') };
  it('detail setting only: no block, one warning with the note', () => {
    const r = compile(files);
    assert.equal(r.content, '# Book\n\n## A\nText.\n');
    assert.deepEqual(messages(r), ['Frontmatter is not valid YAML']);
    assert.equal(r.warningDetails[0].file, 'A.md');
  });

  it('both settings set: the warning is given once', () => {
    const r = new InMemoryVaultCompiler(files, { entryMarkerKeys: ['might'], detailMarkerKeys: ['pace'] }).compile('index.md');
    assert.deepEqual(messages(r), ['Frontmatter is not valid YAML']);
  });

  it('with both settings empty → no warning', () => {
    const r = compile(files, { detailMarkerKeys: [] });
    assert.deepEqual(r.warningDetails, []);
  });
});

describe('US-9.5 AC-11: the view line is removed without a gap', () => {
  const view = (fence: string) => `${fence}dataviewjs\ndv.view("Templates/views/craft-details")\n${fence}\n`;
  const run = (body: string, options: Record<string, unknown> = {}) =>
    compile({ 'index.md': book('![[Reed Weaving]]'), 'Reed Weaving.md': FM + body }, options).content;

  for (const [name, fence] of [['three backticks', '```'], ['four backticks', '````'], ['tilde', '~~~']]) {
    it(`${name}, before the text: block, then the text (setting on)`, () => {
      assert.equal(run(view(fence) + 'You weave reeds.\n'), `# Book\n\n## Reed Weaving\n${BLOCK}You weave reeds.\n`);
    });

    it(`${name}, before the text: title, then the text (setting off)`, () => {
      assert.equal(run(view(fence) + 'You weave reeds.\n', { detailMarkerKeys: [] }), '# Book\n\n## Reed Weaving\nYou weave reeds.\n');
    });
  }

  it('after a blank line and before the text → no gap either', () => {
    assert.equal(run('\n' + view('```') + '\nYou weave reeds.\n'), `# Book\n\n## Reed Weaving\n${BLOCK}You weave reeds.\n`);
  });

  it('heading-first note with the line under the heading', () => {
    assert.equal(run('# Reed Weaving\n' + view('```') + '\nText.\n'), `# Book\n\n## Reed Weaving\n${BLOCK}Text.\n`);
  });

  it('a note that is only the properties and the view line → the block, the next heading directly after it (as US-9.1)', () => {
    const out = compile({ 'index.md': book('![[Reed Weaving]]\n\n![[Basket Knots]]'), 'Reed Weaving.md': FM + view('```'), 'Basket Knots.md': 'K.\n' }).content;
    assert.equal(out, `# Book\n\n## Reed Weaving\n${BLOCK}## Basket Knots\nK.\n`);
  });

  it('inline code with the same text is code and stays (US-1.4)', () => {
    const out = run('`dv.view("Templates/views/craft-details")`\nText.\n');
    assert.ok(out.includes('`dv.view("Templates/views/craft-details")`'), out);
  });
});

describe('US-9.5 AC-12: other steps leave the block alone (SCAR-039)', () => {
  const text = 'pace: "- A"\nkind: "%20"\nneeds: <!-- x -->\nstarter: "# Not a heading"\n';
  const yaml = 'pace: "- A"\nkind: "%20"\nneeds: "<!-- x -->"\nstarter: "# Not a heading"';
  for (const nh of [true, false]) {
    it(`byte for byte, normaliseHeadings ${nh}`, () => {
      const r = compile({ 'index.md': book('![[A]]'), 'A.md': note(yaml) }, { normaliseHeadings: nh });
      assertBlock(r.content, text, { pace: '- A', kind: '%20', needs: '<!-- x -->', starter: '# Not a heading' });
      assert.deepEqual(r.warningDetails, []);
    });
  }

  it('an image or an embed in a value stays as written; no asset is copied', () => {
    const r = compile({ 'index.md': book('![[A]]'), 'A.md': note('pace: "![c](assets/x.png)"\nkind: "![[x.png]]"'), 'x.png': '' });
    assertBlock(r.content, 'pace: "![c](assets/x.png)"\nkind: "![[x.png]]"\n', { pace: '![c](assets/x.png)', kind: '![[x.png]]' });
    assert.equal(r.stats.assetsCopied, 0);
  });

  it('a ToC-looking value does not expand its note', () => {
    const r = compile({ 'index.md': book('![[A]]'), 'A.md': note('pace: "- [[Other]]"'), 'Other.md': 'Other text.\n' });
    assert.doesNotMatch(r.content, /Other text/);
    assert.equal(blocks(r.content).length, 1);
  });

  it('inside a quoted note the embed gets no block and the quote is intact', () => {
    const r = compile({ 'index.md': book('> ![[A]]'), 'A.md': note(yaml) });
    assert.equal(blocks(r.content).length, 0);
    assert.match(r.content, /^> \*\*A\*\*$/m);
  });

  it('a block text in a note body is code as written, not a second block', () => {
    const r = compile({ 'index.md': book('![[A]]'), 'A.md': note('pace: Brisk', '````\n```o2t-details\npace: x\n```\n````\n') });
    assert.equal(blocks(r.content).length, 2, 'the real one and the one inside the four-backtick code (as written)');
    assert.ok(r.content.includes('````\n```o2t-details\npace: x\n```\n````'), r.content);
  });
});

describe('US-9.5 AC-13: warnings name the note and the key\'s line', () => {
  it('a list value in a later note, frontmatter lines counted', () => {
    const r = compile({
      'index.md': book('![[A]]\n\n![[B]]'),
      'A.md': note('pace: Brisk'),
      'B.md': note('# a comment\ntags: [x]\nkind: craft\nneeds:\n  - A'),
    });
    assert.deepEqual(r.warningDetails, [{ message: 'Detail value is not text: needs', link: 'needs', file: 'B.md', line: 5 }]);
  });
});

describe('US-9.5 AC-15: a long value reaches the block whole (SCAR-015)', () => {
  it('400 words in one line, in order', () => {
    const words = Array.from({ length: 400 }, (_, i) => `w${i}`).join(' ');
    const r = compile({ 'index.md': book('![[A]]'), 'A.md': note(`needs: "${words}"`, 'T.\n') });
    const found = blocks(r.content);
    assert.equal(found.length, 1);
    assert.equal(parse(found[0]).needs, words);
    assert.deepEqual(r.warningDetails, []);
  });
});

describe('US-9.5 AC-14 / SCAR-028: the compiler reads no metadata cache', () => {
  it('the compiler source names no metadata cache (text check)', () => {
    const src = readFileSync(new URL('../../plugin/src/compiler.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(src, /metadataCache|getFileCache/);
  });
});
