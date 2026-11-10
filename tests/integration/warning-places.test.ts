/**
 * Tests for US-8.4 AC-6 (#56, decided 2026-11-10): warnings that are not
 * about a link also name a vault note and a line of it as stored — never
 * `compiled-output`, never line 0.
 *
 *   - Map warnings (renderer not available, render failed, unknown
 *     directive): the note and the line of the map's opening fence. A map
 *     drawn once for several places (US-4.7) reports at its first place.
 *   - "Clamped to h6" for a note's own heading: that note and the line of the
 *     first clamped heading.
 *   - "Clamped" for the title (injected or replacing the first heading), for
 *     a prefix depth, and for a section embed: the embedding note and the
 *     line of the embed.
 *   - `<a href>` in a note: the note and the line it is written on.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompilerOptions, CompileResult } from '../../plugin/src/compiler.ts';

const MAP = '```text-mapper\n0101 grass "Vale"\n```';
const PART = `# Part\n\nText.\n\n${MAP}\n`; // fence on line 5
const ROOT = '# Book\n\n![[Part]]\n';

/** US-8.4 | AC-6: compiles `files` from `index.md` the way the plugin does (async, with maps). */
async function compile(files: Record<string, string>, options: Partial<CompilerOptions> = {}): Promise<CompileResult> {
  return new InMemoryVaultCompiler(files, options).compileAsync('index.md');
}

/** US-8.4 | AC-6: the place of every warning, without message text. */
const places = (r: CompileResult) => r.warningDetails.map(d => ({ file: d.file, line: d.line }));

const failing = { isAvailable: () => true, render: async () => { throw new Error('boom'); } };
const working = { isAvailable: () => true, render: async () => {} };

describe('US-8.4 AC-6: map warnings name the note and the line of the opening fence', () => {
  it('renderer not available → Part.md, line 5', async () => {
    /** US-8.4 | AC-6, row 1. */
    const r = await compile({ 'index.md': ROOT, 'Part.md': PART }, { enableTextMapper: true });
    assert.deepEqual(r.warningDetails, [{
      message: 'TextMapper renderer not available',
      link: 'assets/textmapper/487d3d84_0001.png',
      file: 'Part.md',
      line: 5,
    }]);
  });

  it('render failed → Part.md, line 5', async () => {
    /** US-8.4 | AC-6, row 2. */
    const r = await compile({ 'index.md': ROOT, 'Part.md': PART }, { enableTextMapper: true, renderer: failing });
    assert.deepEqual(r.warningDetails, [{
      message: 'TextMapper render failed: boom',
      link: 'assets/textmapper/487d3d84_0001.png',
      file: 'Part.md',
      line: 5,
    }]);
  });

  it('frontmatter above the fence counts (line 8)', async () => {
    /** US-8.4 | AC-6 with AC-5: lines of the note as stored. */
    const r = await compile({ 'index.md': ROOT, 'Part.md': `---\ntags: [x]\n---\n${PART}` }, { enableTextMapper: true });
    assert.deepEqual(places(r), [{ file: 'Part.md', line: 8 }]);
  });

  it('the same map in two places is drawn once and reported once, at the first place', async () => {
    /** US-8.4 | AC-6, row 3; US-4.7. */
    const r = await compile({ 'index.md': `# Book\n\n${MAP}\n\n![[Part]]\n`, 'Part.md': PART }, { enableTextMapper: true });
    assert.deepEqual(places(r), [{ file: 'index.md', line: 3 }]);
  });

  it('the first place is the first in the document, not the first fence read', async () => {
    /**
     * US-8.4 | AC-6: `index.md` reads its own fence (line 5) before it expands
     * the embed on line 3, but Part's map (line 5) comes first in the book.
     */
    const r = await compile({ 'index.md': `# Book\n\n![[Part]]\n\n${MAP}\n`, 'Part.md': PART }, { enableTextMapper: true });
    assert.deepEqual(places(r), [{ file: 'Part.md', line: 5 }]);
  });

  it('an unknown directive → Part.md, line 5', async () => {
    /** US-8.4 | AC-6, row 4; US-4.10 AC-2. */
    const part = '# Part\n\nText.\n\n```text-mapper\n# vault-compiler: no-glw\n0101 grass "Vale"\n```\n';
    const r = await compile({ 'index.md': ROOT, 'Part.md': part }, { enableTextMapper: true, renderer: working });
    assert.deepEqual(r.warningDetails, [{
      message: 'Map directive "no-glw" is unknown and was ignored',
      link: 'no-glw',
      file: 'Part.md',
      line: 5,
    }]);
  });
});

describe('US-8.4 AC-6: clamp warnings', () => {
  const UNDER_H5 = '# Book\n\n## A\n\n### B\n\n#### C\n\n##### D\n\n![[Deep]]\n'; // embed on line 11
  const UNDER_H6 = '# Book\n\n###### Deepest\n\n![[Deep]]\n'; // embed on line 5

  it('a note\'s own heading past h6 → that note, line of the first clamped heading', async () => {
    /** US-8.4 | AC-6, row 5: `Deep.md` is a preamble note, its title lands at h6, `# One` at h7. */
    const r = await compile({ 'index.md': UNDER_H5, 'Deep.md': 'Intro.\n\n# One\n\n## Two\n' }, { normaliseHeadings: true });
    assert.deepEqual(r.warningDetails, [{ message: 'Heading depth clamped to h6 in Deep.md', link: 'Deep.md', file: 'Deep.md', line: 3 }]);
  });

  it('a heading-first note: its second heading is the first clamped one', async () => {
    /** US-8.4 | AC-6, row 6: the title replaces `# Top` at h6; `## Two` (line 3) goes to h7. */
    const r = await compile({ 'index.md': UNDER_H5, 'Deep.md': '# Top\n\n## Two\n' }, { normaliseHeadings: true });
    assert.deepEqual(places(r), [{ file: 'Deep.md', line: 3 }]);
  });

  it('the title itself past h6 → the embedding note, line of the embed', async () => {
    /** US-8.4 | AC-6, row 7: under `######` the title would be h7. */
    const r = await compile({ 'index.md': UNDER_H6, 'Deep.md': 'Flat text.\n' }, { normaliseHeadings: true });
    assert.deepEqual(r.warningDetails, [{ message: 'Heading depth clamped to h6 in Deep.md', link: 'Deep.md', file: 'index.md', line: 5 }]);
  });

  it('a replacing title past h6 → the embedding note too, not line 1 of the note', async () => {
    /** US-8.4 | AC-6, row 7: the title stands for the embed, whether injected or replacing. */
    const r = await compile({ 'index.md': UNDER_H6, 'Deep.md': '# Top\n\nText.\n' }, { normaliseHeadings: true });
    assert.deepEqual(places(r), [{ file: 'index.md', line: 5 }]);
  });

  it('a prefix depth clamped → the embedding note, line of the embed', async () => {
    /** US-8.4 | AC-6, row 8. */
    const r = await compile({
      'index.md': '# Book\n\n- [[2 Chapter]]\n',
      '2 Chapter.md': 'Chapter text.\n\n![[2.1 Sub]]\n\n![[3 Wrong]]\n',
      '2.1 Sub.md': 'Sub.\n',
      '3 Wrong.md': 'Wrong.\n',
    }, { normaliseHeadings: true });
    assert.deepEqual(r.warningDetails, [{
      message: 'Heading depth clamped: 3 Wrong.md prefix depth 1 < parent depth 2, clamped to 2',
      link: '3 Wrong.md',
      file: '2 Chapter.md',
      line: 5,
    }]);
  });

  it('a section embed past h6 → the embedding note, line of the embed', async () => {
    /** US-8.4 | AC-6, row 9. */
    const r = await compile({
      'index.md': '# Book\n\n###### Deep\n\n![[Rules#Combat]]\n',
      'Rules.md': '# Rules\n\n## Combat\n\n### Moves\n\nx\n',
    }, { normaliseHeadings: true });
    assert.deepEqual(r.warningDetails, [{ message: 'Heading depth clamped to h6 in Rules.md', link: 'Rules.md', file: 'index.md', line: 5 }]);
  });

  it('a section embed through a pass-through wrapper → the wrapper, line of its embed', async () => {
    /** US-8.4 | AC-6, row 9 composed with US-6.5. */
    const r = await compile({
      'index.md': '# Book\n\n###### Deep\n\n![[W]]\n',
      'W.md': '\n![[Rules#Combat]]\n',
      'Rules.md': '# Rules\n\n## Combat\n\n### Moves\n\nx\n',
    }, { normaliseHeadings: true });
    assert.deepEqual(places(r), [{ file: 'W.md', line: 2 }]);
  });
});

describe('US-8.4 AC-6: <a href> is reported where it is written', () => {
  it('after frontmatter and an embed → Part.md, line 8', async () => {
    /** US-8.4 | AC-6, row 10: the processed block has other lines than the note. */
    const part = '---\ntags: [x]\n---\n# Part\n\n![[Inner]]\n\nSee <a href="file:///x">x</a>.\n';
    const r = await compile({ 'index.md': ROOT, 'Part.md': part, 'Inner.md': 'One.\n\nTwo.\n\nThree.\n' });
    assert.deepEqual(r.warningDetails, [{ message: 'Invalid output link', link: 'file:///x', file: 'Part.md', line: 8 }]);
  });
});

describe('US-8.4 AC-6: no warning names compiled-output or line 0', () => {
  it('text check: the compiler never writes `compiled-output` or `line: 0` into a detail', async () => {
    /** US-8.4 | AC-6 (SCAR-017): the class, not the seven instances. */
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../plugin/src/compiler.ts', import.meta.url), 'utf8');
    assert.equal(src.match(/compiled-output/g), null);
    assert.equal(src.match(/line: 0\b/g), null);
  });
});
