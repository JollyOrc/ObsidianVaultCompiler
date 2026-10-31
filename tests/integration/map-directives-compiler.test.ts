/**
 * Compiler-level tests for map directives (US-4.10, decided 2026-10-31).
 *
 * AC-9 and AC-10 held before the code of #92 and guard that they keep
 * holding; AC-2 was written before the code.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';


/** US-4.10 | Compiles `files` from `index2compile.md` with maps on or off. */
function compile(files: Record<string, string>, enableTextMapper = true): CompileResult {
  return new InMemoryVaultCompiler(files, { enableTextMapper, assetFolder: 'assets' }).compile('index2compile.md');
}

/** US-4.10 | A note body holding one text-mapper block. */
const block = (source: string) => `\`\`\`text-mapper\n${source}\n\`\`\`\n`;

/** US-4.10 | The map PNG references of a compiled text, in order. */
const mapRefs = (content: string) => [...content.matchAll(/\]\((assets\/textmapper\/[^)]+\.png)\)/g)].map(m => m[1]);

/** US-4.10 | The directive warnings of a compile. */
const directiveWarnings = (r: CompileResult) => r.warningDetails.filter(w => w.message.startsWith('Map directive'));

describe('US-4.10 AC-2: unknown words are reported per map block and file', () => {
  it('one warning with the agreed fields', () => {
    const r = compile({ 'index2compile.md': `# Index\n\n${block('# vault-compiler: no-outline\n0101 forest "Peak"')}` });
    assert.deepEqual(directiveWarnings(r), [{
      message: 'Map directive "no-outline" is unknown and was ignored',
      link: 'no-outline',
      file: 'index2compile.md',
      line: 0,
    }]);
  });

  it('the same unknown word on two lines of one block: one warning', () => {
    const r = compile({ 'index2compile.md': block('# vault-compiler: no-outline\n0101 forest\n# vault-compiler: no-outline') });
    assert.equal(directiveWarnings(r).length, 1);
  });

  it('the same block in two notes: one warning per note, one map', () => {
    const map = block('# vault-compiler: no-outline\n0101 forest "Peak"');
    const r = compile({
      'index2compile.md': '- [[a]]\n- [[b]]\n',
      'a.md': `# A\n\n${map}`,
      'b.md': `# B\n\n${map}`,
    });
    assert.deepEqual(directiveWarnings(r).map(w => w.file).sort(), ['a.md', 'b.md']);
    assert.equal(new Set(mapRefs(r.content)).size, 1, 'US-4.7: drawn once');
  });

  it('known words and no directive give no warning', () => {
    const r = compile({ 'index2compile.md': block('# vault-compiler: no-outlines no-glow\n0101 forest') + block('0101 forest "Peak"') });
    assert.deepEqual(directiveWarnings(r), []);
  });

  it('nothing is reported when maps are not drawn', () => {
    const r = compile({ 'index2compile.md': block('# vault-compiler: no-outline\n0101 forest') }, false);
    assert.deepEqual(directiveWarnings(r), []);
  });
});

describe('US-4.10 AC-9: the directive line is part of the PNG name', () => {
  it('the same map with and without a directive gets two names', () => {
    const r = compile({ 'index2compile.md': block('0101 forest "Peak"') + '\n' + block('# vault-compiler: no-glow\n0101 forest "Peak"') });
    const refs = mapRefs(r.content);
    assert.equal(refs.length, 2);
    assert.notEqual(refs[0], refs[1]);
  });

  it('the same map with the same directive twice shares one name', () => {
    const map = block('# vault-compiler: no-glow\n0101 forest "Peak"');
    const refs = mapRefs(compile({ 'index2compile.md': `${map}\n${map}` }).content);
    assert.equal(refs.length, 2);
    assert.equal(refs[0], refs[1]);
  });
});

describe('US-4.10 AC-10: maps not drawn keep their directive line', () => {
  it('rendering off: the block is kept with the directive line', () => {
    const r = compile({ 'index2compile.md': block('# vault-compiler: no-outlines no-glow\n0101 forest "Peak"') }, false);
    assert.match(r.content, /```text-mapper\n# vault-compiler: no-outlines no-glow\n0101 forest "Peak"\n```/);
  });
});
