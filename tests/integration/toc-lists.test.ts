/**
 * Tests for ToC lists (US-1.3, rewritten 2026-10-27).
 *
 * A list is a run of consecutive list-item lines. It is a table of contents
 * only when every item is a ToC item: exactly one link or embed, in either
 * syntax, to a note that exists. Then every item becomes an embed; otherwise
 * the link items are left as written. Embed items lose their bullet in any
 * list.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

const NOTES = {
  'A.md': 'Alpha body.',
  'B.md': 'Bravo body.',
  'Sub/C.md': 'Charlie body.',
};

const compile = (index: string, extra: Record<string, string> = {}) =>
  new InMemoryVaultCompiler({ 'index.md': index, ...NOTES, ...extra }).compile('index.md');

const has = (content: string, text: string) => content.includes(text);

describe('US-1.3 AC-1: both syntaxes expand alike', () => {
  it('the defect: [[…]] items and [text](path) items in one list are all imported, in order', () => {
    // Shape of index2compile.md on 2026-10-27.
    const r = compile('# Book\n- [[A]]\n- [[B]]\n- [Charlie](Sub/C.md)\n');
    assert.ok(has(r.content, 'Alpha body.') && has(r.content, 'Bravo body.') && has(r.content, 'Charlie body.'), r.content);
    assert.ok(r.content.indexOf('Alpha body.') < r.content.indexOf('Bravo body.'));
    assert.ok(r.content.indexOf('Bravo body.') < r.content.indexOf('Charlie body.'), 'AC-3: listed order');
  });

  it('URL-encoded paths with spaces are imported', () => {
    const r = compile('- [4 Glossary](Rulebook/Texts/4%20Glossary.md)\n- [5 Back notes](Rulebook/Texts/5%20Back%20notes.md)\n',
      { 'Rulebook/Texts/4 Glossary.md': 'Glossary body.', 'Rulebook/Texts/5 Back notes.md': 'Back notes body.' });
    assert.ok(has(r.content, 'Glossary body.') && has(r.content, 'Back notes body.'), r.content);
  });

  it('a list of only [text](path) links is imported', () => {
    const r = compile('- [A](A.md)\n- [B](B.md)\n');
    assert.ok(has(r.content, 'Alpha body.') && has(r.content, 'Bravo body.'));
  });

  it('numbered lists and * bullets count as lists', () => {
    const r = compile('1. [[A]]\n2. [B](B.md)\n\n* [[Sub/C]]\n');
    assert.ok(has(r.content, 'Alpha body.') && has(r.content, 'Bravo body.') && has(r.content, 'Charlie body.'));
  });

  it('nested items are imported too', () => {
    const r = compile('- [[A]]\n  - [B](B.md)\n');
    assert.ok(has(r.content, 'Alpha body.') && has(r.content, 'Bravo body.'));
  });

  it('an aliased wiki link item is imported', () => {
    const r = compile('- [[A|The A]]\n- [[B]]\n');
    assert.ok(has(r.content, 'Alpha body.') && has(r.content, 'Bravo body.'));
  });

  it('the expanded list leaves no link to the listed notes', () => {
    const r = compile('- [[A]]\n- [B](B.md)\n');
    assert.doesNotMatch(r.content, /\[A\]\(#|\[B\]\(#/);
  });
});

describe('US-1.3 AC-2: every item must be a ToC item', () => {
  it('a list with a plain-text item is left as written', () => {
    const r = compile('- [[A]]\n- some text\n');
    assert.ok(!has(r.content, 'Alpha body.'), r.content);
    assert.match(r.content, /- some text/);
  });

  it('an item with more than a link counts as text', () => {
    const r = compile('- [[A]] is the first\n- [[B]]\n');
    assert.ok(!has(r.content, 'Alpha body.') && !has(r.content, 'Bravo body.'), r.content);
  });

  it('a link to a website makes the list stay as written', () => {
    const r = compile('- [Inter](https://fonts.google.com/specimen/Inter)\n- [[A]]\n');
    assert.ok(!has(r.content, 'Alpha body.'));
    assert.match(r.content, /\[Inter\]\(https:\/\/fonts\.google\.com\/specimen\/Inter\)/);
  });

  it('a link to a note that does not exist makes the list stay as written', () => {
    const r = compile('- [[Missing Note]]\n- [[A]]\n');
    assert.ok(!has(r.content, 'Alpha body.'));
  });

  it('a link to a non-note file makes the list stay as written', () => {
    const r = compile('- [Sheet](sheet.pdf)\n- [[A]]\n', { 'sheet.pdf': '' });
    assert.ok(!has(r.content, 'Alpha body.'));
  });

  it('a blank line ends a list: each part is judged on its own', () => {
    const r = compile('- [[A]]\n\n- some text\n- [[B]]\n');
    assert.ok(has(r.content, 'Alpha body.'), 'first list is all links');
    assert.ok(!has(r.content, 'Bravo body.'), 'second list has text');
  });

  it('embed items lose their bullet in any list', () => {
    const r = compile('- ![[A]]\n- some text\n');
    assert.ok(has(r.content, 'Alpha body.'));
    assert.doesNotMatch(r.content, /^- [^\n]*Alpha body\./m);
    assert.match(r.content, /- some text/);
  });
});

describe('US-1.3 AC-4, AC-5: nesting and explicit embeds', () => {
  it('a [text](path) ToC inside an imported note expands when that note is processed', () => {
    const r = compile('- [[A]]\n', { 'A.md': 'Alpha body.\n\n- [B](B.md)\n' });
    assert.ok(has(r.content, 'Bravo body.'), r.content);
  });

  it('a [text](path) item whose note is already embedded in the file stays a link', () => {
    const r = compile('![[B]]\n\n- [B](B.md)\n- [[A]]\n');
    assert.equal(r.content.split('Bravo body.').length - 1, 1, 'B once');
    assert.ok(has(r.content, 'Alpha body.'));
  });
});

describe('US-1.3: edge cases found by the mutation check (2026-10-27)', () => {
  it('a link to a heading of the same note ([x](#Heading)) is not a note link', () => {
    const r = compile('# Top\n- [Top](#Top)\n- [[A]]\n');
    assert.ok(!has(r.content, 'Alpha body.'), 'list with an anchor-only item stays as written');
    assert.doesNotMatch(r.content, /Circular dependency/);
  });

  it('…also when the resolver (as Obsidian\'s may) resolves #Heading to the current note', () => {
    const files = { 'index.md': '# Top\n- [Top](#Top)\n- [[A]]\n', ...NOTES };
    const resolve = (raw: string, current: string) =>
      raw.startsWith('#') ? current : (raw === 'A' ? 'A.md' : null);
    const r = new InMemoryVaultCompiler(files, { enableTextMapper: false, assetFolder: 'assets', resolve }).compile('index.md');
    assert.ok(!has(r.content, 'Alpha body.'));
    assert.doesNotMatch(r.content, /Circular dependency/);
  });

  it('AC-1: the expanded lines keep their indentation and drop the bullet', () => {
    const compiler = new InMemoryVaultCompiler({ 'index.md': '', ...NOTES }) as unknown as {
      expandTocLists(content: string, file: string, explicit: Set<string>): string;
    };
    assert.equal(
      compiler.expandTocLists('- [[A]]\n  - [B](B.md)\n1. [[Sub/C]]', 'index.md', new Set()),
      '![[A]]\n  ![B](B.md)\n![[Sub/C]]',
    );
  });
});
