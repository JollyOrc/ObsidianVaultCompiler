/**
 * Tests for US-1.6 "Embed a note in a sentence" (#107, decided 2026-11-10).
 *
 * Every case runs with "Normalise headings" on and off (SCAR-019); the
 * expected text is the same for both unless the test says otherwise.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';

const ROOT = '# Book\n\nHe said ![[Sage]] and left.\n';
const SAGE = 'Wise words.\n';
const NOT_ONE = 'Note embedded in a sentence is not one paragraph; embedded as a block';

/** US-1.6: compiles `files` from `index.md`. */
function compile(files: Record<string, string>, normalise: boolean): CompileResult {
  return new InMemoryVaultCompiler(files, { normaliseHeadings: normalise }).compile('index.md');
}

/** US-1.6: runs `check` with the toggle on and off. */
function both(name: string, check: (normalise: boolean) => void): void {
  for (const normalise of [true, false]) {
    it(`${name} (normalise ${normalise ? 'on' : 'off'})`, () => check(normalise));
  }
}

describe('US-1.6 AC-1: one paragraph goes into the sentence', () => {
  both('the KD-5 example', n => {
    const r = compile({ 'index.md': ROOT, 'Sage.md': SAGE }, n);
    assert.equal(r.content, '# Book\nHe said Wise words. and left.\n');
    assert.deepEqual(r.warnings, []);
  });
  both('markdown syntax', n => {
    const r = compile({ 'index.md': '# Book\n\nHe said ![s](Sage.md) and left.\n', 'Sage.md': SAGE }, n);
    assert.equal(r.content, '# Book\nHe said Wise words. and left.\n');
  });
  both('a heading-first note loses its heading', n => {
    const r = compile({ 'index.md': ROOT, 'Sage.md': '# Wisdom\n\nWise words.\n' }, n);
    assert.equal(r.content, '# Book\nHe said Wise words. and left.\n');
  });
  both('two lines of one paragraph are joined by a space', n => {
    const r = compile({ 'index.md': ROOT, 'Sage.md': 'Wise\nwords.\n' }, n);
    assert.equal(r.content, '# Book\nHe said Wise words. and left.\n');
  });
  both('at the end and at the start of the line', n => {
    const r = compile({ 'index.md': '# Book\n\nHe said: ![[Sage]]\n\n![[Sage]] he said.\n', 'Sage.md': SAGE }, n);
    assert.equal(r.content, '# Book\nHe said: Wise words.\n\nWise words. he said.\n');
  });
  both('two embeds in one sentence', n => {
    const r = compile({ 'index.md': '# Book\n\n![[Sage]] and ![[Fool]]\n', 'Sage.md': SAGE, 'Fool.md': 'Silly words.\n' }, n);
    assert.equal(r.content, '# Book\nWise words. and Silly words.\n');
  });
  both('an empty note leaves the spaces as written, no warning', n => {
    const r = compile({ 'index.md': ROOT, 'Sage.md': '# Only\n' }, n);
    assert.equal(r.content, '# Book\nHe said  and left.\n');
    assert.deepEqual(r.warnings, []);
  });
  both('frontmatter is not part of the sentence', n => {
    const r = compile({ 'index.md': ROOT, 'Sage.md': '---\ntags: [x]\n---\nWise words.\n' }, n);
    assert.equal(r.content, '# Book\nHe said Wise words. and left.\n');
  });
});

describe('US-1.6 AC-2: section embed', () => {
  const SECTIONED = '# Wisdom\n\nFirst.\n\n## Detail\n\nMore words.\n';
  both('the section without its heading', n => {
    const r = compile({ 'index.md': '# Book\n\nHe said ![[Sage#Detail]] and left.\n', 'Sage.md': SECTIONED }, n);
    assert.equal(r.content, '# Book\nHe said More words. and left.\n');
  });
  both('a missing heading: the comment in the sentence, one warning', n => {
    const r = compile({ 'index.md': '# Book\n\nHe said ![[Sage#Gone]] and left.\n', 'Sage.md': SECTIONED }, n);
    assert.equal(r.content, '# Book\nHe said <!-- Warning: Missing heading anchor: Sage.md#Gone --> and left.\n');
    assert.deepEqual(r.warningDetails, [{ message: 'Missing heading anchor: Sage.md#Gone', link: 'Sage.md#Gone', file: 'index.md', line: 3 }]);
  });
});

describe('US-1.6 AC-3: containers', () => {
  both('a quote', n => {
    const r = compile({ 'index.md': '# Book\n\n> He said ![[Sage]] and left.\n', 'Sage.md': SAGE }, n);
    assert.equal(r.content, '# Book\n> He said Wise words. and left.\n');
  });
  both('a list item', n => {
    const r = compile({ 'index.md': '# Book\n\n- He said ![[Sage]] and left.\n', 'Sage.md': SAGE }, n);
    assert.equal(r.content, '# Book\n- He said Wise words. and left.\n');
  });
  both('a heading', n => {
    const r = compile({ 'index.md': '# Book\n\n## About ![[Sage]]\n', 'Sage.md': SAGE }, n);
    assert.equal(r.content, '# Book\n\n## About Wise words.\n');
  });
  both('inside a quoted note (US-1.5)', n => {
    const r = compile({ 'index.md': '# Book\n\n> ![[Q]]\n', 'Q.md': 'He said ![[Sage]] and left.\n', 'Sage.md': SAGE }, n);
    assert.equal(r.content, '# Book\n> **Q**\n>\n> He said Wise words. and left.\n');
  });
  both('a sole embed in a list item in a quote is no sentence: v0.23.0 output (guard)', n => {
    /** US-1.6 Definitions (the list marker is not text); US-1.5 "Not in scope". Measured on main. */
    const r = compile({ 'index.md': '# Book\n\n> - ![[Sage]]\n', 'Sage.md': SAGE }, n);
    assert.equal(r.content, n ? '# Book\n> - ## Sage\nWise words.\n' : '# Book\n> - ## Sage\n\nWise words.\n');
    assert.deepEqual(r.warnings, []);
  });
  both('a sole embed is no sentence: today\'s block (guard)', n => {
    const r = compile({ 'index.md': '# Book\n\n![[Sage]]\n', 'Sage.md': SAGE }, n);
    assert.match(r.content, /^## Sage$/m);
  });
});

describe('US-1.6 AC-4: inside the inlined text', () => {
  both('links are converted', n => {
    const r = compile({ 'index.md': `${ROOT}\n![[Other]]\n`, 'Sage.md': 'Read [[Other]] now.\n', 'Other.md': 'O.\n' }, n);
    assert.match(r.content, /^He said Read \[Other\]\(#Other\) now\. and left\.$/m);
    assert.deepEqual(r.warnings, []);
  });
  both('a link warning names Sage and its line', n => {
    const r = compile({ 'index.md': ROOT, 'Sage.md': '---\na: 1\n---\nRead [[Gone]] now.\n' }, n);
    assert.deepEqual(r.warningDetails, [{ message: 'Missing wiki link', link: 'Gone', file: 'Sage.md', line: 4 }]);
  });
  both('an embed in a sentence inside the note', n => {
    const r = compile({ 'index.md': ROOT, 'Sage.md': 'Wise ![[Fool]] words.\n', 'Fool.md': 'Silly words.\n' }, n);
    assert.equal(r.content, '# Book\nHe said Wise Silly words. words. and left.\n');
  });
  both('an image is copied and rewritten', n => {
    const r = new InMemoryVaultCompiler({ 'index.md': ROOT, 'Sage.md': 'Wise ![](pic.png) words.\n', 'pic.png': 'PNG' }, { normaliseHeadings: n, assetFolder: 'assets' }).compile('index.md');
    assert.equal(r.content, '# Book\nHe said Wise ![](assets/pic.png) words. and left.\n');
  });
  both('a circular embed gives the comment in the sentence', n => {
    const r = compile({ 'index.md': ROOT, 'Sage.md': 'x ![[Sage]] y\n' }, n);
    assert.equal(r.content, '# Book\nHe said x <!-- Circular dependency avoided: Sage.md --> y and left.\n');
  });
});

describe('US-1.6 AC-5: not a place in the book', () => {
  both('no heading, links to it are not embedded', n => {
    const r = compile({ 'index.md': `${ROOT}\nSee [[Sage]].\n`, 'Sage.md': SAGE }, n);
    assert.equal(r.content, "# Book\nHe said Wise words. and left.\n\nSee <!-- Warning: link target 'Sage' not embedded in compiled output -->.\n");
  });
  both('embedded elsewhere as a block, links go there', n => {
    const r = compile({ 'index.md': `${ROOT}\n![[Sage]]\n\nSee [[Sage]].\n`, 'Sage.md': SAGE }, n);
    assert.match(r.content, /^See \[Sage\]\(#Sage\)\.$/m);
    assert.deepEqual(r.warnings, []);
  });
  both('no entry block for an entry note', n => {
    const r = new InMemoryVaultCompiler({ 'index.md': ROOT, 'Sage.md': '---\nkind: sage\n---\nWise words.\n' }, { normaliseHeadings: n, entryMarkerKeys: ['kind'] }).compile('index.md');
    assert.equal(r.content, '# Book\nHe said Wise words. and left.\n');
  });
});

describe('US-1.6 AC-6: more than one paragraph — block and a warning', () => {
  const MULTI = '# Wisdom\n\nFirst.\n\n- a\n- b\n';
  it('the v0.23.0 block (normalise on) and one warning', () => {
    const r = compile({ 'index.md': ROOT, 'Sage.md': MULTI }, true);
    assert.equal(r.content, '# Book\nHe said ## Sage\n\nFirst.\n\n- a\n- b\n and left.\n');
    assert.deepEqual(r.warningDetails, [{ message: NOT_ONE, link: 'Sage', file: 'index.md', line: 3 }]);
  });
  it('the v0.23.0 block (normalise off) and one warning', () => {
    const r = compile({ 'index.md': ROOT, 'Sage.md': MULTI }, false);
    assert.equal(r.content, '# Book\nHe said ## Sage\n\nFirst.\n\n- a\n- b\n and left.\n');
    assert.deepEqual(r.warningDetails, [{ message: NOT_ONE, link: 'Sage', file: 'index.md', line: 3 }]);
  });
  both('two paragraphs', n => {
    const r = compile({ 'index.md': ROOT, 'Sage.md': 'First.\n\nSecond.\n' }, n);
    assert.deepEqual(r.warnings, [`Warning: ${NOT_ONE}`]);
  });
  both('nothing inside the note is reported twice', n => {
    const r = compile({ 'index.md': ROOT, 'Sage.md': 'First [[Gone]].\n\nSecond.\n' }, n);
    assert.deepEqual(r.warningDetails.map(d => d.message).sort(), ['Missing wiki link', NOT_ONE].sort());
  });
});
