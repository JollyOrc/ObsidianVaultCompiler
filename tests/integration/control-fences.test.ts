/**
 * Tests for US-5.1 AC-F (2026-11-07, G0-B8, #108): control blocks are
 * removed whatever their fence form. The three failures were measured with
 * v0.21.0 in the #108 step-0 review.
 *
 * Written before the code (G2, 2026-11-07).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

const LANGUAGES = ['dataview', 'dataviewjs', 'meta-bind-embed', 'leaflet', 'calendarium', 'compressed-json'];

const compile = (body: string) =>
  new InMemoryVaultCompiler({ 'index.md': `# Index\n\nLede.\n\n${body}\n\nAfter.\n` }, {}).compile('index.md').content;

/** US-6.6: no blank line between a heading and its first paragraph. */
const EXPECTED = '# Index\nLede.\n\nAfter.\n';

describe('US-5.1 AC-F: every fence form, every control language', () => {
  for (const lang of LANGUAGES) {
    const forms: Array<[string, string]> = [
      ['```', `\`\`\`${lang}\nq\n\`\`\``],
      ['~~~', `~~~${lang}\nq\n~~~`],
      ['````', `\`\`\`\`${lang}\nq\n\`\`\`\``],
      ['```` holding ```', `\`\`\`\`${lang}\n\`\`\`\ninner\n\`\`\`\n\`\`\`\``],
    ];
    for (const [name, block] of forms) {
      it(`${lang} in ${name}`, () => assert.equal(compile(block), EXPECTED));
    }

    it(`${lang} inside a quote → removed with its prefixes, no empty > line`, () => {
      const out = new InMemoryVaultCompiler({
        'index.md': `# Index\n\n> Said.\n> \`\`\`${lang}\n> q\n> \`\`\`\n> More.\n`,
      }, {}).compile('index.md').content;
      assert.equal(out, '# Index\n> Said.\n> More.\n');
    });
  }

  it('a three-backtick fence does not close a four-backtick block', () => {
    const out = compile('````dataviewjs\n```\nstill code\n```\n````');
    assert.doesNotMatch(out, /still code|`{2}/);
  });

  it('a block closed by the end of its quote is removed; the next line stays', () => {
    const out = new InMemoryVaultCompiler({ 'index.md': '# Index\n\n> Said.\n> ```dataview\n> q\nAfter.\n' }, {}).compile('index.md').content;
    assert.equal(out, '# Index\n> Said.\nAfter.\n');
  });

  it('an unclosed control block is kept and reported (US-1.4 AC-6)', () => {
    const r = new InMemoryVaultCompiler({ 'index.md': '# Index\n\nLede.\n\n```dataview\nq\n\nAfter.\n' }, {}).compile('index.md');
    assert.match(r.content, /```dataview\nq/);
    assert.deepEqual(r.warningDetails.map(w => w.message), ['Code block not closed; closed at the end of the note']);
  });

  it('a block between two paragraph lines keeps them apart', () => {
    const out = new InMemoryVaultCompiler({ 'index.md': '# Index\n\nText.\n```dataview\nq\n```\nMore.\n' }, {}).compile('index.md').content;
    assert.equal(out, '# Index\nText.\n\nMore.\n');
  });

  it('a block whose language only starts with a control language is kept', () => {
    assert.match(compile('```dataviewish\nx\n```'), /```dataviewish/);
  });

  it('other languages are kept', () => {
    assert.match(compile('```js\nx\n```'), /```js\nx\n```/);
    assert.match(compile('~~~dataviewish\nx\n~~~'), /~~~dataviewish/);
  });

  it('lede, blank, dataviewjs, blank, heading → one blank line', () => {
    const out = new InMemoryVaultCompiler({ 'index.md': '# Index\n\nLede.\n\n```dataviewjs\nx\n```\n\n### Signs\n' }, {}).compile('index.md').content;
    assert.equal(out, '# Index\nLede.\n\n### Signs\n');
  });

  it('one table of languages (SCAR-017 text check)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../plugin/src/compiler.ts', import.meta.url), 'utf8');
    assert.equal((src.match(/'dataviewjs'/g) ?? []).length, 1, 'dataviewjs is named once, in the table');
  });
});
