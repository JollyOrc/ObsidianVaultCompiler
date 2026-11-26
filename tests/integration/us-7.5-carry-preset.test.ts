/**
 * US-7.5 AC-4, AC-8, AC-1 (embedded notes): the compiled output starts with a
 * frontmatter of the one key `typst-preset` when the starting note has it, and
 * is byte-identical to 0.26.0 otherwise. Invented notes only.
 * SCAR-019: with the key, without, empty, with other keys, embedded note with
 * the key; heading normalisation on and off.
 * Red until US-7.5 is implemented (G2, 2026-11-26).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

const { parse } = createRequire(new URL('../../plugin/package.json', import.meta.url))('yaml') as typeof import('yaml');

type Files = Record<string, string>;
const compile = (files: Files, normalise: boolean): string =>
  new InMemoryVaultCompiler(files, { normaliseHeadings: normalise }).compile('index.md').content;

/** The frontmatter block of `content` parsed, or null when it does not start with one. */
function frontmatter(content: string): unknown {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(content);
  return m ? parse(m[1]) : null;
}

for (const normalise of [true, false]) {
  const tag = `normalise ${normalise ? 'on' : 'off'}`;

  describe(`US-7.5 AC-4: the preset travels (${tag})`, () => {
    it('output starts with exactly the one key', () => {
      const out = compile({ 'index.md': '---\ntypst-preset: A4 Sheets\n---\n# Lantern Rules\n\nText.\n' }, normalise);
      assert.ok(out.startsWith('---\ntypst-preset: A4 Sheets\n---\n'), out);
      assert.deepEqual(frontmatter(out), { 'typst-preset': 'A4 Sheets' });
    });
    it('no other key is copied (tags, compile-folder, compile-file)', () => {
      const out = compile({
        'index.md': '---\ntags: [x]\ncompile-folder: Sheets\ncompile-file: Keep.md\ntypst-preset: A4\n---\n# Lantern Rules\n\nText.\n',
      }, normalise);
      assert.deepEqual(frontmatter(out), { 'typst-preset': 'A4' });
      assert.doesNotMatch(out, /compile-folder|compile-file|tags:/);
    });
    it('a value YAML needs quoted is quoted, and parses back to the value', () => {
      const out = compile({ 'index.md': '---\ntypst-preset: "A4: Sheets # wide"\n---\n# Lantern Rules\n\nText.\n' }, normalise);
      assert.deepEqual(frontmatter(out), { 'typst-preset': 'A4: Sheets # wide' });
    });
    it('the value is trimmed', () => {
      const out = compile({ 'index.md': '---\ntypst-preset: "  A4  "\n---\n# Lantern Rules\n\nText.\n' }, normalise);
      assert.deepEqual(frontmatter(out), { 'typst-preset': 'A4' });
    });
    it('empty value = no frontmatter in the output', () => {
      for (const v of ['', '""', '"  "']) {
        const out = compile({ 'index.md': `---\ntypst-preset: ${v}\n---\n# Lantern Rules\n\nText.\n` }, normalise);
        assert.ok(!out.startsWith('---'), v);
      }
    });
    it('a preset key in an embedded note is not carried', () => {
      const out = compile({
        'index.md': '# Lantern Rules\n\nText.\n\n![[Side.md]]',
        'Side.md': '---\ntypst-preset: Wide\n---\nSide text.',
      }, normalise);
      assert.ok(!out.startsWith('---'), out);
      assert.doesNotMatch(out, /typst-preset|Wide/);
    });
    it('the starting note\'s key is carried while an embedded note\'s is not', () => {
      const out = compile({
        'index.md': '---\ntypst-preset: A4\n---\n# Lantern Rules\n\n![[Side.md]]',
        'Side.md': '---\ntypst-preset: Wide\n---\nSide text.',
      }, normalise);
      assert.deepEqual(frontmatter(out), { 'typst-preset': 'A4' });
      assert.doesNotMatch(out, /Wide/);
    });
    it('the body after the frontmatter is the same as without the key', () => {
      const body = '# Lantern Rules\n\nText.\n';
      const without = compile({ 'index.md': body }, normalise);
      const withKey = compile({ 'index.md': '---\ntypst-preset: A4\n---\n' + body }, normalise);
      assert.equal(withKey, '---\ntypst-preset: A4\n---\n' + without);
    });
  });
}

describe('US-7.5 AC-4, AC-8: without the key, byte-identical to 0.26.0', () => {
  // pinned at G2 (2026-11-26) from 0.26.0
  it('a plain starting note', () => {
    assert.equal(compile({ 'index.md': '# Lantern Rules\n\nText.\n' }, true), '# Lantern Rules\nText.\n');
  });
  it('a starting note with other frontmatter, the compile keys and an embedded note', () => {
    const files = {
      'index.md': '---\ntags: [x]\ncompile-folder: Sheets\n---\n# Lantern Rules\n\nText.\n\n![[Side.md]]',
      'Side.md': '---\nfoo: bar\n---\nSide text.',
    };
    // pinned at G2 (2026-11-26) from 0.26.0
    assert.equal(compile(files, true), '# Lantern Rules\nText.\n\n## Side\nSide text.\n');
  });
});
