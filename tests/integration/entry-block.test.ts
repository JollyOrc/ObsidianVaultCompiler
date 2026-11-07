/**
 * Tests for US-9.1 (#108): an entry note's properties as an `o2t-entry`
 * block. The block's format is owned by its reader, Obsidian2Typst
 * (`docs/technical/entry-block.md`, SCAR-040). Expected values are the
 * story's examples; synthetic notes only (SCAR-035).
 *
 * Written before the code (G2, 2026-11-07): red until US-9.1 exists.
 * Options this file passes (to be added to `CompilerOptions`):
 * `entryMarkerKeys`, `entryExcludeKeys`, `entryAssetKeys` (string arrays,
 * lower case; absent = the defaults of the settings table).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';

type Files = Record<string, string>;

/** US-9.1 | AC-6, AC-13: the reader's parser, the library itself (installed with the plugin). */
const { parse } = createRequire(new URL('../../plugin/package.json', import.meta.url))('yaml') as typeof import('yaml');

const FM = '---\nmight: 3\nattacks:\n  - "Kick: 2d6"\n---\n';
const BLOCK = '```o2t-entry\nmight: 3\nattacks:\n  - "Kick: 2d6"\n```\n';

function compile(files: Files, options: Record<string, unknown> = {}, start = 'index.md'): CompileResult {
  const r = new InMemoryVaultCompiler(files, { entryMarkerKeys: ['might'], ...options }).compile(start);
  // US-9.1 | AC-3: the placeholder that holds a block's place never reaches the output.
  assert.doesNotMatch(r.content, /__ventry__/, r.content);
  return r;
}

/** US-9.1 | AC-13: every `o2t-entry` block of the output, as text. */
function blocks(content: string): string[] {
  return [...content.matchAll(/^(`{3,})o2t-entry\n([\s\S]*?)^\1$/gm)].map(m => m[2]);
}

/** US-9.1 | AC-13 (SCAR-028): the block as exact text and as values. */
function assertBlock(content: string, text: string, values: unknown): void {
  const found = blocks(content);
  assert.equal(found.length, 1, content);
  assert.equal(found[0], text);
  assert.deepEqual(parse(found[0]), values);
}

const messages = (r: CompileResult) => r.warningDetails.map(w => w.message);

describe('US-9.1 AC-1: off by default', () => {
  const files = { 'index.md': '# Book\n\n![[Fen Hare]]\n', 'Fen Hare.md': FM + 'Fen hares are shy.\n' };
  for (const options of [{}, { entryMarkerKeys: [] }]) {
    it(`entryMarkerKeys ${JSON.stringify(options)} → no block, frontmatter removed`, () => {
      const r = new InMemoryVaultCompiler(files, options).compile('index.md');
      assert.equal(r.content, '# Book\n\n## Fen Hare\nFen hares are shy.\n');
    });
  }

  it('invariant 2: keys set, no note has them → same output as off', () => {
    const plain = { 'index.md': '# Book\n\n![[A]]\n', 'A.md': '---\ntags: [x]\n---\nText.\n' };
    const off = new InMemoryVaultCompiler(plain, {}).compile('index.md');
    const on = compile(plain);
    assert.equal(on.content, off.content);
    assert.deepEqual(on.warningDetails, off.warningDetails);
  });
});

describe('US-9.1 AC-2: which notes get a block', () => {
  const hare = '---\nmight: 3\n---\nFen hares are shy.\n';
  const cases: Array<[string, Files, number]> = [
    ['![[Fen Hare]]', { 'index.md': '# Book\n\n![[Fen Hare]]\n' }, 1],
    ['![x](Fen%20Hare.md)', { 'index.md': '# Book\n\n![x](Fen%20Hare.md)\n' }, 1],
    ['ToC list item', { 'index.md': '# Book\n\n- [[Fen Hare]]\n' }, 1],
    ['pass-through target', { 'index.md': '# Book\n\n![[W]]\n', 'W.md': '![[Fen Hare]]\n' }, 1],
    ['section embed', { 'index.md': '# Book\n\n![[Fen Hare#Signs]]\n' }, 0],
    ['quoted embed', { 'index.md': '# Book\n\n> ![[Fen Hare]]\n' }, 0],
    ['callout embed', { 'index.md': '# Book\n\n> [!note]\n> ![[Fen Hare]]\n' }, 0],
  ];
  for (const [name, files, count] of cases) {
    it(`${name} → ${count} block(s)`, () => {
      const body = name === 'section embed' ? '---\nmight: 3\n---\n# Fen Hare\n\nShy.\n\n## Signs\n\nTracks.\n' : hare;
      const r = compile({ ...files, 'Fen Hare.md': body });
      assert.equal(blocks(r.content).length, count, r.content);
      assert.doesNotMatch(r.content, /^---$/m, 'no frontmatter text');
      if (count === 0) assert.doesNotMatch(r.content, /might/, 'no property text at all');
    });
  }

  it('the starting file → no block', () => {
    const r = compile({ 'Fen Hare.md': '---\nmight: 3\n---\n# Fen Hare\n\nShy.\n' }, {}, 'Fen Hare.md');
    assert.equal(blocks(r.content).length, 0);
    assert.doesNotMatch(r.content, /might/);
  });

  const notTriggers: Array<[string, string]> = [
    ['nested key', '---\nstats:\n  might: 3\n---\nText.\n'],
    ['YAML comment', '---\n# might: 3\ntags: [a]\n---\nText.\n'],
    ['inside a multi-line string', '---\ntext: |\n  might: 3\n---\nText.\n'],
  ];
  for (const [name, note] of notTriggers) {
    it(`${name} → no block`, () => {
      const r = compile({ 'index.md': '# Book\n\n![[A]]\n', 'A.md': note });
      assert.equal(blocks(r.content).length, 0, r.content);
      assert.equal(r.content, '# Book\n\n## A\nText.\n');
    });
  }

  it('the trigger key is matched without case', () => {
    const r = compile({ 'index.md': '# Book\n\n![[A]]\n', 'A.md': '---\nMIGHT: 3\n---\nText.\n' });
    assert.equal(blocks(r.content).length, 1);
  });
});

describe('US-9.1 AC-3: directly under the title heading, in every title path', () => {
  const at = (body: string, root = '# Book\n\n## Beasts\n\n![[Fen Hare]]\n', extra: Files = {}) =>
    (normaliseHeadings: boolean) =>
      compile({ 'index.md': root, 'Fen Hare.md': FM + body, ...extra }, { normaliseHeadings }).content;

  it('embed line, on / off', () => {
    const run = at('Fen hares are shy.\n');
    assert.equal(run(true), `# Book\n\n## Beasts\n\n### Fen Hare\n${BLOCK}Fen hares are shy.\n`);
    assert.equal(run(false), `# Book\n\n## Beasts\n\n## Fen Hare\n${BLOCK}Fen hares are shy.\n`);
  });

  it('heading-first note, on / off', () => {
    const run = at('# Fen Hare\n\nFen hares are shy.\n\n## Signs\n\nTracks.\n');
    assert.equal(run(true), `# Book\n\n## Beasts\n\n### Fen Hare\n${BLOCK}Fen hares are shy.\n\n#### Signs\nTracks.\n`);
    assert.equal(run(false), `# Book\n\n## Beasts\n\n## Fen Hare\n${BLOCK}Fen hares are shy.\n\n## Signs\nTracks.\n`);
  });

  it('pass-through: the block follows the target heading, never the wrapper', () => {
    const run = at('# Fen Hare\n\nShy.\n', '# Book\n\n## Beasts\n\n![[W]]\n', { 'W.md': '![[Fen Hare]]\n' });
    assert.equal(run(true), `# Book\n\n## Beasts\n\n### Fen Hare\n${BLOCK}Shy.\n`);
    assert.equal(run(false), `# Book\n\n## Beasts\n\n## W\n\n## Fen Hare\n${BLOCK}Shy.\n`);
  });

  it('nested: under the note\'s own heading at its depth', () => {
    for (const nh of [true, false]) {
      const out = compile({
        'index.md': '# Book\n\n![[Section]]\n',
        'Section.md': 'Intro.\n\n![[Fen Hare]]\n',
        'Fen Hare.md': FM + 'Shy.\n',
      }, { normaliseHeadings: nh }).content;
      assert.match(out, new RegExp(`^#+ Fen Hare\\n${BLOCK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}Shy\\.$`, 'm'), out);
    }
  });

  // SCAR-009: what the body starts with.
  // A body starting with a heading is heading-first: covered above.
  const starts = ['- item', '| a | b |\n|---|---|', '```js\nx\n```', '    code', '> quote'];
  for (const first of starts) {
    it(`body starting with ${JSON.stringify(first.split('\n')[0])}`, () => {
      const out = at(`${first}\n`)(true);
      assert.ok(out.includes(`### Fen Hare\n${BLOCK}${first.split('\n')[0]}`), out);
      assert.equal(blocks(out).length, 1);
    });
  }

  it('a dataviewjs block before the first paragraph is removed; the block stays first', () => {
    const out = at('```dataviewjs\npreview()\n```\n\nFen hares are shy.\n')(true);
    assert.equal(out, `# Book\n\n## Beasts\n\n### Fen Hare\n${BLOCK}Fen hares are shy.\n`);
  });
});

describe('US-9.1 AC-4: content', () => {
  const note = '---\naliases: [Hare]\nmight: 3\ntags: [beast]\ncssclasses: [wide]\npublish: true\n---\nShy.\n';
  const run = (options: Record<string, unknown> = {}) =>
    compile({ 'index.md': '# B\n\n![[Fen Hare]]\n', 'Fen Hare.md': note }, options).content;

  it('default exclusions; tags included; note order', () => {
    assertBlock(run(), 'might: 3\ntags:\n  - beast\n', { might: 3, tags: ['beast'] });
  });

  it('entryExcludeKeys [] → nothing excluded (SCAR-019)', () => {
    assertBlock(run({ entryExcludeKeys: [] }),
      'aliases:\n  - Hare\nmight: 3\ntags:\n  - beast\ncssclasses:\n  - wide\npublish: true\n',
      { aliases: ['Hare'], might: 3, tags: ['beast'], cssclasses: ['wide'], publish: true });
  });

  it('entryExcludeKeys [aliases, tags] → tags left out too', () => {
    assertBlock(run({ entryExcludeKeys: ['aliases', 'tags'] }),
      'might: 3\ncssclasses:\n  - wide\npublish: true\n', { might: 3, cssclasses: ['wide'], publish: true });
  });

  it('keys written in lower case, in the note\'s order', () => {
    const out = compile({ 'index.md': '# B\n\n![[A]]\n', 'A.md': '---\nVigour: "11"\nMight: 3\n---\nT.\n' }).content;
    assertBlock(out, 'vigour: "11"\nmight: 3\n', { vigour: '11', might: 3 });
  });
});

describe('US-9.1 AC-5: keys that differ only in case', () => {
  it('the first is written; one warning with the second key\'s line', () => {
    const r = compile({ 'index.md': '# B\n\n![[A]]\n', 'A.md': '---\nMight: 3\nmight: 4\n---\nT.\n' });
    assertBlock(r.content, 'might: 3\n', { might: 3 });
    assert.deepEqual(r.warningDetails, [
      { message: 'Entry keys differ only in case: Might / might', link: 'might', file: 'A.md', line: 3 },
    ]);
  });
});

describe('US-9.1 AC-6: the fixed YAML form', () => {
  const rows: Array<[string, string, unknown]> = [
    ['might: 3', 'might: 3\n', 3],
    ['might: "11"', 'might: "11"\n', '11'],
    ['might: yes', 'might: yes\n', 'yes'],
    ['might:', 'might:\n', null],
    ["might: ['A: 1d6']", 'might:\n  - "A: 1d6"\n', ['A: 1d6']],
    ['might: "Run first: ask later"', 'might: "Run first: ask later"\n', 'Run first: ask later'],
    ['might: "Bite 1d6 #fire"', 'might: "Bite 1d6 #fire"\n', 'Bite 1d6 #fire'],
    ['might: 2026-11-07', 'might: 2026-11-07\n', '2026-11-07'],
    ['might:\n  - B: 2d6', 'might:\n  - B: 2d6\n', [{ B: '2d6' }]],
  ];
  for (const [source, text, value] of rows) {
    it(JSON.stringify(source), () => {
      const r = compile({ 'index.md': '# B\n\n![[A]]\n', 'A.md': `---\n${source}\n---\nT.\n` });
      assertBlock(r.content, text, { might: value });
      assert.deepEqual(r.warningDetails, [], 'no warning, also for a map (decided 2026-11-07)');
    });
  }

  it('same values in different quoting and list style → the same block', () => {
    const a = compile({ 'index.md': '# B\n\n![[A]]\n', 'A.md': "---\nmight: ['A: 1d6', 'B']\n---\nT.\n" }).content;
    const b = compile({ 'index.md': '# B\n\n![[A]]\n', 'A.md': '---\nmight:\n    - "A: 1d6"\n    - B\n---\nT.\n' }).content;
    assert.equal(blocks(a).length, 1, a);
    assert.deepEqual(blocks(a), blocks(b));
  });
});

describe('US-9.1 AC-7: fence length', () => {
  it('a value holding ``` → a four-backtick fence', () => {
    const out = compile({ 'index.md': '# B\n\n![[A]]\n', 'A.md': '---\nmight: "a ``` b"\n---\nT.\n' }).content;
    assert.ok(out.includes('## A\n````o2t-entry\nmight: a ``` b\n````\nT.'), out);
  });

  it('a value with single backticks → three', () => {
    const out = compile({ 'index.md': '# B\n\n![[A]]\n', 'A.md': '---\nmight: Uses `code` here\n---\nT.\n' }).content;
    assert.ok(out.includes('## A\n```o2t-entry\nmight: Uses `code` here\n```\nT.'), out);
  });
});

describe('US-9.1 AC-8: links flattened by the reader\'s rule', () => {
  const rows: Array<[string, string]> = [
    ['"[[Quick Step]]"', 'Quick Step'],
    ['"[[Skills/Keen Nose|Keen Nose]]"', 'Keen Nose'],
    ['"[[Skills/Keen Nose]]"', 'Skills/Keen Nose'],
    ['"[[Rules#Grappling]]"', 'Rules > Grappling'],
    ['"[[#Grappling]]"', 'Grappling'],
    ['"[x](https://example.com)"', 'x'],
    ['"**Bite** [[Teeth]]: 1d6"', '**Bite** Teeth: 1d6'],
    ['"![[hare.png|Drawn]]"', 'Drawn'],
    ['"![Drawn](images/hare.png)"', 'Drawn'],
  ];
  for (const [source, shown] of rows) {
    it(`${source} → ${shown}`, () => {
      const r = compile({ 'index.md': '# B\n\n![[A]]\n', 'A.md': `---\nmight: 1\nskills:\n  - ${source}\n---\nT.\n` });
      assert.deepEqual(parse(blocks(r.content)[0]), { might: 1, skills: [shown] });
      assert.equal(r.stats.assetsCopied, 0, 'a non-asset key copies nothing');
    });
  }
});

describe('US-9.1 AC-8: inside a map value too', () => {
  it('- B: "[[Teeth]]" → B: Teeth', () => {
    const r = compile({ 'index.md': '# B\n\n![[A]]\n', 'A.md': '---\nmight:\n  - B: "[[Teeth]]"\n---\nT.\n' });
    assert.deepEqual(parse(blocks(r.content)[0]), { might: [{ B: 'Teeth' }] });
  });
});

describe('US-9.1 AC-9: frontmatter that is not valid YAML', () => {
  it('no block, frontmatter removed, one warning', () => {
    const r = compile({ 'index.md': '# B\n\n![[A]]\n', 'A.md': '---\nmight: [3\n---\nT.\n' });
    assert.equal(r.content, '# B\n\n## A\nT.\n');
    assert.deepEqual(messages(r), ['Frontmatter is not valid YAML']);
    assert.equal(r.warningDetails[0].file, 'A.md');
  });

  it('with entryMarkerKeys empty → no warning (AC-1)', () => {
    const r = compile({ 'index.md': '# B\n\n![[A]]\n', 'A.md': '---\nmight: [3\n---\nT.\n' }, { entryMarkerKeys: [] });
    assert.deepEqual(r.warningDetails, []);
  });
});

describe('US-9.1 AC-11: other steps leave the block alone (SCAR-039)', () => {
  const note = [
    '---',
    'might: 1',
    'skills:',
    '  - "- A"',
    '  - "%20"',
    '  - "<!-- x -->"',
    '  - "# Not a heading"',
    '  - "![c](assets/hare.png)"',
    '---',
    'T.',
    '',
  ].join('\n');
  // `yaml` writes `<!-- x -->` unquoted (measured with 2.9.1); the rest needs quotes.
  const text = 'might: 1\nskills:\n  - "- A"\n  - "%20"\n  - <!-- x -->\n  - "# Not a heading"\n  - c\n';

  for (const nh of [true, false]) {
    it(`byte for byte, normaliseHeadings ${nh}`, () => {
      const r = compile({ 'index.md': '# B\n\n![[A]]\n', 'A.md': note, 'assets/hare.png': 'b' }, { normaliseHeadings: nh });
      assertBlock(r.content, text, { might: 1, skills: ['- A', '%20', '<!-- x -->', '# Not a heading', 'c'] });
      assert.deepEqual(r.warningDetails, []);
    });
  }

  it('inside a quoted note the embed still gets no block and the quote is intact', () => {
    const r = compile({ 'index.md': '# B\n\n> ![[A]]\n', 'A.md': note });
    assert.equal(blocks(r.content).length, 0);
    assert.match(r.content, /^> \*\*A\*\*$/m);
  });
});

describe('US-9.1 AC-10: read from the note text, not the metadata cache', () => {
  it('the compiler uses no metadata cache for properties (text check)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../plugin/src/compiler.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(src, /metadataCache|getFileCache/);
  });
});
