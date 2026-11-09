/**
 * Tests for US-9.5 AC-8 (#118): a link in a detail value is converted to the
 * same in-book link as in body text and written in Obsidian's heading form,
 * `[[#<anchor>|<text>]]`, which the reader (Obsidian2Typst, contract
 * `docs/technical/details-block.md`, rule 8) prints as a link. Exempt from
 * US-9.1 AC-8 (flattening). Synthetic notes only (SCAR-035).
 *
 * Written before the code (G2, 2026-11-09): red until US-9.5 exists.
 * Measured with v0.22.0: body links give `[Basket Knots](#Basket%20Knots)`,
 * `[Tight](#Tight)` for `[[Basket Knots#Tight]]`, `[Tight](#Mat%20Knots#Tight)`
 * where two notes have a `Tight` heading, and an HTML comment for a missing
 * note.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';

const { parse } = createRequire(new URL('../../plugin/package.json', import.meta.url))('yaml') as typeof import('yaml');

type Files = Record<string, string>;

const BASKET = 'Knots.\n\n## Tight\n\nTight ones.\n';

/** Reed Weaving holds `needs: <value>`; Basket Knots is in the book with a `Tight` section. */
function run(value: string, extra: Files = {}, options: Record<string, unknown> = {}): CompileResult {
  const files: Files = {
    'index.md': '# Book\n\n![[Reed Weaving]]\n\n![[Basket Knots]]\n',
    'Reed Weaving.md': `---\npace: Brisk\nneeds: ${value}\n---\nYou weave reeds.\n`,
    'Basket Knots.md': BASKET,
    ...extra,
  };
  const r = new InMemoryVaultCompiler(files, { detailMarkerKeys: ['pace', 'needs'], ...options }).compile('index.md');
  assert.doesNotMatch(r.content, /__ventry__|__vdetail__/);
  return r;
}

/** The `needs` value of the only block, as written (text) and parsed. */
function needs(r: CompileResult): { text: string; value: unknown } {
  const found = [...r.content.matchAll(/^(`{3,})o2t-details\n([\s\S]*?)^\1$/gm)].map(m => m[2]);
  assert.equal(found.length, 1, r.content);
  const line = found[0].split('\n').find(l => l.startsWith('needs:'));
  assert.ok(line !== undefined, found[0]);
  return { text: line, value: (parse(found[0]) as Record<string, unknown>).needs };
}

describe('US-9.5 AC-8: links stay in-book links, in the heading form', () => {
  const rows: Array<[string, string]> = [
    ['"[[Basket Knots]]"', '[[#Basket Knots|Basket Knots]]'],
    ['"[[Basket Knots|Knots]]"', '[[#Basket Knots|Knots]]'],
    ['"[[Basket Knots#Tight]]"', '[[#Tight|Tight]]'],
    ['"[[Basket Knots#Tight|tight ones]]"', '[[#Tight|tight ones]]'],
    ['"[Knots](Basket%20Knots.md)"', '[[#Basket Knots|Knots]]'],
    ['"[Knots](Basket%20Knots.md#Tight)"', '[[#Tight|Knots]]'],
    ['"**Needs** [[Basket Knots]]"', '**Needs** [[#Basket Knots|Basket Knots]]'],
    ['"*Needs* [[Basket Knots]] and [[Basket Knots#Tight|more]]"', '*Needs* [[#Basket Knots|Basket Knots]] and [[#Tight|more]]'],
    ['"[x](https://example.com)"', '[x](https://example.com)'],
    ['"![x](a.png)"', '![x](a.png)'],
    ['"![[a.png]]"', '![[a.png]]'],
  ];
  for (const [source, written] of rows) {
    it(`${source} → ${written}`, () => {
      const r = run(source, { 'a.png': '' });
      assert.equal(needs(r).value, written);
      assert.equal(r.stats.assetsCopied, 0);
      assert.deepEqual(r.warningDetails, []);
    });
  }

  it('the written text is the fixed YAML form (quoted: a value with [[ )', () => {
    assert.equal(needs(run('"[[Basket Knots]]"')).text, 'needs: "[[#Basket Knots|Basket Knots]]"');
  });

  it('a link in the same note\'s own section: [[#Tight]] in Basket Knots.md', () => {
    const r = new InMemoryVaultCompiler({
      'index.md': '# Book\n\n![[Basket Knots]]\n',
      'Basket Knots.md': `---\nneeds: "[[#Tight]]"\n---\n${BASKET}`,
    }, { detailMarkerKeys: ['needs'] }).compile('index.md');
    assert.equal(needs(r).value, '[[#Tight|Tight]]');
    assert.deepEqual(r.warningDetails, []);
  });

  it('body links of the same note are unchanged by the detail block (link phase order)', () => {
    const r = run('"[[Basket Knots]]"', {
      'Reed Weaving.md': '---\nneeds: "[[Basket Knots]]"\n---\nSee [[Basket Knots#Tight]].\n',
    });
    assert.match(r.content, /See \[Tight\]\(#Tight\)\./);
    assert.equal(needs(r).value, '[[#Basket Knots|Basket Knots]]');
  });

  it('a same-note link in a note embedded twice goes to the heading of its own part, as the body link does', () => {
    const r = new InMemoryVaultCompiler({
      'index.md': '# Book\n\n## Baskets\n\n![[Knots]]\n\n## Mats\n\n![[Knots]]\n',
      'Knots.md': '---\nneeds: "[[#Tight]]"\n---\nSee [[#Tight]].\n\n## Tight\n\nx\n',
    }, { detailMarkerKeys: ['needs'], normaliseHeadings: true }).compile('index.md');
    const body = [...r.content.matchAll(/See \[Tight\]\(#([^)]*)\)/g)].map(m => decodeURIComponent(m[1]));
    const blocks = [...r.content.matchAll(/needs: "\[\[#([^|]*)\|Tight\]\]"/g)].map(m => m[1]);
    assert.equal(body.length, 2);
    assert.notEqual(body[0], body[1], 'the two parts have different anchors');
    assert.deepEqual(blocks, body);
  });

  it('with "Normalise headings" on, the anchor is the heading as it is written in the book', () => {
    const r = run('"[[Basket Knots#Tight]]"', {}, { normaliseHeadings: true });
    assert.equal(needs(r).value, '[[#Tight|Tight]]');
  });

  it('two notes with a `Tight` section: the heading path, as in body text', () => {
    const files: Files = {
      'index.md': '# Book\n\n## Baskets\n\n![[Basket Knots]]\n\n## Mats\n\n![[Mat Knots]]\n\n![[Reed Weaving]]\n',
      'Basket Knots.md': BASKET,
      'Mat Knots.md': 'Mats.\n\n## Tight\n\nTight mats.\n',
      'Reed Weaving.md': '---\nneeds: "[[Mat Knots#Tight]]"\nkind: "[[Basket Knots#Tight]]"\n---\nT.\n',
    };
    const r = new InMemoryVaultCompiler(files, { detailMarkerKeys: ['needs', 'kind'], normaliseHeadings: true }).compile('index.md');
    const block = [...r.content.matchAll(/^```o2t-details\n([\s\S]*?)^```$/gm)].map(m => parse(m[1]))[0];
    assert.deepEqual(block, { needs: '[[#Mat Knots#Tight|Tight]]', kind: '[[#Tight|Tight]]' });
  });
});

describe('US-9.5 AC-8: a link that has no target in the book keeps its text and gives the body warning', () => {
  it('a missing note', () => {
    const r = run('"[[Missing Note]]"');
    assert.equal(needs(r).value, 'Missing Note');
    assert.deepEqual(r.warningDetails, [
      { message: 'Missing wiki link', link: 'Missing Note', file: 'Reed Weaving.md', line: 3 },
    ]);
    assert.equal(r.stats.missingReferences, 1);
  });

  it('a missing note with an alias keeps the alias', () => {
    assert.equal(needs(run('"[[Missing Note|the missing one]]"')).value, 'the missing one');
  });

  it('a Markdown link to a missing note', () => {
    const r = run('"[the note](Missing%20Note.md)"');
    assert.equal(needs(r).value, 'the note');
    assert.deepEqual(r.warningDetails.map(w => [w.message, w.file, w.line]), [['Missing markdown link', 'Reed Weaving.md', 3]]);
  });

  it('a note that exists but is not in the book', () => {
    const r = run('"[[Unused Note]]"', { 'Unused Note.md': 'Unused.\n' });
    assert.equal(needs(r).value, 'Unused Note');
    assert.deepEqual(r.warningDetails, [
      { message: "link target 'Unused Note' not embedded in compiled output", link: 'Unused Note', file: 'Reed Weaving.md', line: 3 },
    ]);
  });

  it('a heading the note does not have: the link goes to the note, as in body text', () => {
    const r = run('"[[Basket Knots#Nope]]"');
    assert.equal(needs(r).value, '[[#Basket Knots|Nope]]');
    assert.deepEqual(r.warningDetails.map(w => [w.message, w.file, w.line]), [
      ['Missing heading anchor: Basket Knots#Nope', 'Reed Weaving.md', 3],
    ]);
  });

  it('no HTML comment ever reaches a block', () => {
    const r = run('"[[Missing Note]] [[Unused Note]]"', { 'Unused Note.md': 'U.\n' });
    assert.doesNotMatch(needs(r).text, /<!--/);
  });
});

describe('US-9.5 AC-8: link warnings come once per block and name the key\'s line', () => {
  it('two keys with a missing link each → two warnings, at their own lines', () => {
    const r = new InMemoryVaultCompiler({
      'index.md': '# Book\n\n![[A]]\n',
      'A.md': '---\npace: "[[M1]]"\nkind: ok\nneeds: "[[M2]]"\n---\nT.\n',
    }, { detailMarkerKeys: ['pace', 'needs'] }).compile('index.md');
    assert.deepEqual(r.warningDetails.map(w => [w.message, w.link, w.file, w.line]), [
      ['Missing wiki link', 'M1', 'A.md', 2],
      ['Missing wiki link', 'M2', 'A.md', 4],
    ]);
  });

  it('a note embedded twice: two blocks, one warning per problem', () => {
    const r = new InMemoryVaultCompiler({
      'index.md': '# Book\n\n![[A]]\n\n![[A]]\n',
      'A.md': '---\nneeds: "[[Nowhere]]"\n---\nT.\n',
    }, { detailMarkerKeys: ['needs'] }).compile('index.md');
    assert.equal([...r.content.matchAll(/^```o2t-details$/gm)].length, 2);
    assert.deepEqual(r.warningDetails.map(w => [w.message, w.link, w.file, w.line]), [['Missing wiki link', 'Nowhere', 'A.md', 2]]);
    assert.equal(r.warnings.length, 1);
  });

  it('a key that is not listed is never read: its links give no warning', () => {
    const r = new InMemoryVaultCompiler({
      'index.md': '# Book\n\n![[A]]\n',
      'A.md': '---\npace: Brisk\nother: "[[Nowhere]]"\n---\nT.\n',
    }, { detailMarkerKeys: ['pace'] }).compile('index.md');
    assert.deepEqual(r.warningDetails, []);
  });

  it('the exempt rule is only for details: an entry block still flattens (US-9.1 AC-8)', () => {
    const r = new InMemoryVaultCompiler({
      'index.md': '# Book\n\n![[A]]\n\n![[Basket Knots]]\n',
      'A.md': '---\nmight: 1\nskills:\n  - "[[Basket Knots]]"\n---\nT.\n',
      'Basket Knots.md': BASKET,
    }, { entryMarkerKeys: ['might'] }).compile('index.md');
    assert.deepEqual(parse([...r.content.matchAll(/^```o2t-entry\n([\s\S]*?)^```$/gm)][0][1]), { might: 1, skills: ['Basket Knots'] });
  });
});

describe('US-9.5 AC-8: the compileAsync path gives the same text', () => {
  it('compile and compileAsync agree', async () => {
    const files: Files = {
      'index.md': '# Book\n\n![[Reed Weaving]]\n\n![[Basket Knots]]\n',
      'Reed Weaving.md': '---\nneeds: "[[Basket Knots#Tight|tight]]"\n---\nT.\n',
      'Basket Knots.md': BASKET,
    };
    const options = { detailMarkerKeys: ['needs'] };
    const sync = new InMemoryVaultCompiler(files, options).compile('index.md');
    const async = await new InMemoryVaultCompiler(files, options).compileAsync('index.md');
    assert.equal(async.content, sync.content);
    assert.match(sync.content, /needs: "\[\[#Tight\|tight\]\]"/);
  });
});

describe('US-9.5 AC-8, AC-14, AC-15: the reader\'s example and a long value with a link', () => {
  const KEYS = { detailMarkerKeys: ['pace', 'kind', 'needs', 'starter'] };

  it('the reader\'s own example, written exactly', () => {
    const r = new InMemoryVaultCompiler({
      'index.md': '# Book\n\n![[Reed Weaving]]\n\n![[Basket Knots]]\n',
      'Reed Weaving.md': '---\npace: Brisk\nkind: craft\nneeds: "[[Basket Knots]]"\nstarter: true\n---\nYou weave reeds, mats and rope.\n',
      'Basket Knots.md': 'Knots.\n',
    }, KEYS).compile('index.md');
    const text = 'pace: Brisk\nkind: craft\nneeds: "[[#Basket Knots|Basket Knots]]"\nstarter: true\n';
    assert.ok(r.content.includes(`## Reed Weaving\n\`\`\`o2t-details\n${text}\`\`\`\nYou weave reeds, mats and rope.\n`), r.content);
    assert.deepEqual(parse(text), { pace: 'Brisk', kind: 'craft', needs: '[[#Basket Knots|Basket Knots]]', starter: true });
  });

  it('a value with 400 words and a link in the middle keeps every word (SCAR-015)', () => {
    const before = Array.from({ length: 200 }, (_, i) => `a${i}`).join(' ');
    const after = Array.from({ length: 200 }, (_, i) => `b${i}`).join(' ');
    const r = new InMemoryVaultCompiler({
      'index.md': '# Book\n\n![[A]]\n\n![[Basket Knots]]\n',
      'A.md': `---\nneeds: "${before} [[Basket Knots]] ${after}"\n---\nT.\n`,
      'Basket Knots.md': 'K.\n',
    }, KEYS).compile('index.md');
    assert.equal(needs(r).value, `${before} [[#Basket Knots|Basket Knots]] ${after}`);
  });
});
