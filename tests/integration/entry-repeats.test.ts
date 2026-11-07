/**
 * Tests for US-9.3 (#108): an entry note is compiled once; later whole-note
 * embeds become a comment. Amends US-1.3 AC-6 for entry notes only.
 *
 * Written before the code (G2, 2026-11-07): red until US-9.3 exists.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';

const HARE = '---\nmight: 3\n---\nFen hares are shy.\n';
const COMMENT = '<!-- repeat of "Fen Hare" omitted -->';

function compile(files: Record<string, string>, options: Record<string, unknown> = {}): CompileResult {
  return new InMemoryVaultCompiler({ 'Fen Hare.md': HARE, ...files },
    { entryMarkerKeys: ['might'], normaliseHeadings: true, ...options }).compile('index.md');
}

const count = (text: string, part: string) => text.split(part).length - 1;
const rows = (r: CompileResult) => r.warningDetails.map(w => [w.message, w.link, w.file, w.line]);

describe('US-9.3 AC-1, AC-2: the repeat becomes one comment line', () => {
  it('two ToC lists → the note once, the comment under the second heading', () => {
    const r = compile({ 'index.md': '# Book\n\n## Beasts\n\n- [[Fen Hare]]\n\n## Marsh\n\n- [[Fen Hare]]\n' });
    assert.equal(count(r.content, 'Fen hares are shy.'), 1);
    assert.equal(count(r.content, '```o2t-entry'), 1);
    // US-6.6: no blank line right after a heading.
    assert.ok(r.content.includes(`## Marsh\n${COMMENT}\n`), r.content);
  });

  it('two embed lines → the same', () => {
    const r = compile({ 'index.md': '# Book\n\n![[Fen Hare]]\n\n![x](Fen%20Hare.md)\n' });
    assert.equal(count(r.content, 'Fen hares are shy.'), 1);
    assert.equal(count(r.content, COMMENT), 1);
  });

  it('three embeds → two comments', () => {
    const r = compile({ 'index.md': '# Book\n\n![[Fen Hare]]\n\n![[Fen Hare]]\n\n![[Fen Hare]]\n' });
    assert.equal(count(r.content, COMMENT), 2);
  });

  it('a non-entry note listed twice is compiled twice (US-1.3 AC-6)', () => {
    const r = compile({ 'index.md': '# Book\n\n- [[Spell]]\n\n## Other\n\n- [[Spell]]\n', 'Spell.md': '---\ntags: [x]\n---\nZap.\n' });
    assert.equal(count(r.content, 'Zap.'), 2);
    assert.doesNotMatch(r.content, /repeat of/);
  });

  it('entryMarkerKeys empty → no deduplication', () => {
    const r = compile({ 'index.md': '# Book\n\n![[Fen Hare]]\n\n![[Fen Hare]]\n' }, { entryMarkerKeys: [] });
    assert.equal(count(r.content, 'Fen hares are shy.'), 2);
  });

  it('a "--" in the name is written "- -"', () => {
    const r = new InMemoryVaultCompiler({
      'index.md': '# Book\n\n![[A--B]]\n\n![[A--B]]\n', 'A--B.md': HARE,
    }, { entryMarkerKeys: ['might'] }).compile('index.md');
    assert.ok(r.content.includes('<!-- repeat of "A- -B" omitted -->'), r.content);
  });
});

describe('US-9.3 AC-3: what does not count', () => {
  const NOTE = '---\nmight: 3\n---\n# Fen Hare\n\nShy.\n\n## Signs\n\nTracks.\n';

  it('a section before the whole note → both kept', () => {
    const r = compile({ 'index.md': '# Book\n\n![[Fen Hare#Signs]]\n\n![[Fen Hare]]\n', 'Fen Hare.md': NOTE });
    assert.equal(count(r.content, 'Tracks.'), 2);
    assert.doesNotMatch(r.content, /repeat of/);
  });

  it('a section after the whole note → both kept', () => {
    const r = compile({ 'index.md': '# Book\n\n![[Fen Hare]]\n\n![[Fen Hare#Signs]]\n', 'Fen Hare.md': NOTE });
    assert.equal(count(r.content, 'Tracks.'), 2);
    assert.doesNotMatch(r.content, /repeat of/);
  });

  it('a quoted embed neither counts nor is replaced', () => {
    const r = compile({ 'index.md': '# Book\n\n> ![[Fen Hare]]\n\n![[Fen Hare]]\n\n> ![[Fen Hare]]\n' });
    assert.equal(count(r.content, '> Fen hares are shy.'), 2);
    assert.equal(count(r.content, '```o2t-entry'), 1);
    assert.doesNotMatch(r.content, /repeat of/);
  });

  it('a pass-through whose target was compiled keeps its own heading; the target is the comment', () => {
    const r = compile({ 'index.md': '# Book\n\n![[Fen Hare]]\n\n![[W]]\n', 'W.md': '![[Fen Hare]]\n' }, { normaliseHeadings: false });
    assert.match(r.content, /^## W$/m);
    assert.equal(count(r.content, COMMENT), 1);
    assert.equal(count(r.content, 'Fen hares are shy.'), 1);
  });
});

describe('US-9.3 AC-3: a pass-through with "Normalise headings" on', () => {
  it('the repeated target is the comment, reported on the wrapper\'s line', () => {
    // A wrapper is a pass-through only when its target is heading-first (US-6.5).
    const r = compile({
      'index.md': '# Book\n\n![[Fen Hare]]\n\n![[W]]\n', 'W.md': '![[Fen Hare]]\n',
      'Fen Hare.md': '---\nmight: 3\n---\n# Fen Hare\n\nFen hares are shy.\n',
    });
    assert.equal(count(r.content, 'Fen hares are shy.'), 1);
    assert.equal(count(r.content, COMMENT), 1);
    assert.doesNotMatch(r.content, /^#+ W$/m, 'a pass-through writes no heading of its own');
    assert.deepEqual(rows(r), [['Duplicate entry omitted', '![[Fen Hare]]', 'W.md', 1]]);
  });
});

describe('US-9.3 AC-5: a pass-through wrapper with frontmatter', () => {
  it('the line counts the wrapper\'s frontmatter', () => {
    const r = compile({
      'index.md': '# Book\n\n![[Fen Hare]]\n\n![[W]]\n', 'W.md': '---\ntags: [w]\n---\n![[Fen Hare]]\n',
      'Fen Hare.md': '---\nmight: 3\n---\n# Fen Hare\n\nFen hares are shy.\n',
    });
    assert.deepEqual(rows(r), [['Duplicate entry omitted', '![[Fen Hare]]', 'W.md', 4]]);
  });
});

describe('US-9.3 AC-4: circular embeds come first', () => {
  it('a note embedding itself is circular, not a repeat', () => {
    const r = compile({ 'index.md': '# Book\n\n![[Fen Hare]]\n', 'Fen Hare.md': '---\nmight: 3\n---\nShy.\n\n![[Fen Hare]]\n' });
    assert.match(r.content, /Circular dependency avoided: Fen Hare\.md/);
    assert.doesNotMatch(r.content, /repeat of/);
    assert.equal(r.warningDetails.filter(w => w.message === 'Duplicate entry omitted').length, 0);
  });
});

describe('US-9.3 AC-5, AC-6: report', () => {
  it('one row per repeat, with the embed as written and its place', () => {
    const r = compile({ 'index.md': '# Book\n\n![[Fen Hare]]\n\n![[Fen Hare]]\n' });
    assert.deepEqual(rows(r), [['Duplicate entry omitted', '![[Fen Hare]]', 'index.md', 5]]);
  });

  it('in a note with frontmatter, the line counts the frontmatter (US-8.4 AC-5)', () => {
    const r = compile({
      'index.md': '# Book\n\n![[Fen Hare]]\n\n![[Marsh]]\n',
      'Marsh.md': '---\ntags: [x]\n---\nIntro.\n\n- [[Fen Hare]]\n',
    });
    assert.deepEqual(rows(r), [['Duplicate entry omitted', '[[Fen Hare]]', 'Marsh.md', 6]]);
  });

  it('a repeat inside a nested note names that note', () => {
    const r = compile({
      'index.md': '# Book\n\n![[Fen Hare]]\n\n![[Marsh]]\n',
      'Marsh.md': 'Intro.\n\n- [[Fen Hare]]\n',
    });
    assert.deepEqual(rows(r), [['Duplicate entry omitted', '[[Fen Hare]]', 'Marsh.md', 3]]);
    assert.equal(count(r.content, COMMENT), 1);
  });
});
