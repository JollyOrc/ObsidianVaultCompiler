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
      line: 3, // US-8.4 AC-6: the opening fence (was 0 before #56)
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

describe('US-4.11: map caption in the compiled text (#119)', () => {
  /** US-4.11: the image line of a compiled map, alt text included. */
  const mapLine = (content: string) => content.split('\n').find(l => /\]\(assets\/textmapper\//.test(l));
  const captionWarnings = (r: CompileResult) => r.warningDetails.filter(w => w.message.startsWith('Map caption'));

  it('AC-1: a labelled hex gives no label', () => {
    const r = compile({ 'index2compile.md': block('0402 grass "Fog Lantern|Fog Lantern "') });
    assert.match(mapLine(r.content)!, /^!\[\]\(assets\/textmapper\/[0-9a-f]+_0001\.png\)$/);
  });

  it('AC-1: an include line and plain hexes give no label', () => {
    const r = compile({ 'index2compile.md': `${block('include gnomeyland.txt\n0101 forest')}\n${block('0101 forest')}` });
    const lines = r.content.split('\n').filter(l => /\]\(assets\/textmapper\//.test(l));
    assert.equal(lines.length, 2);
    for (const line of lines) assert.match(line, /^!\[\]\(/);
  });

  it('AC-2: the caption line sets the label', () => {
    const r = compile({ 'index2compile.md': `# Index\n\n${block('# vault-compiler: caption Branches of the fighting skills\n0101 forest "Moss"')}` });
    assert.match(mapLine(r.content)!, /^!\[Branches of the fighting skills\]\(assets\/textmapper\/[0-9a-f]+_0001\.png\)$/);
    assert.deepEqual(r.warningDetails, []);
  });

  it('AC-2: caption after no-glow — no unknown-word warning', () => {
    const r = compile({ 'index2compile.md': block('# vault-compiler: no-glow caption Moss and Stone\n0101 forest') });
    assert.match(mapLine(r.content)!, /^!\[Moss and Stone\]\(/);
    assert.deepEqual(r.warningDetails, []);
  });

  it('AC-3: brackets and backslash escaped; one image line', () => {
    const r = compile({ 'index2compile.md': block('# vault-compiler: caption Tree [old] \\ path\n0101 forest') });
    assert.match(mapLine(r.content)!, /^!\[Tree \\\[old\\\] \\\\ path\]\(assets\/textmapper\/[0-9a-f]+_0001\.png\)$/);
  });

  it('AC-3: a | is written as given and reported once at the fence', () => {
    const r = compile({ 'index2compile.md': `# Index\n\n${block('# vault-compiler: caption Moss | Stone\n0101 forest')}` });
    assert.match(mapLine(r.content)!, /^!\[Moss \| Stone\]\(/);
    assert.deepEqual(captionWarnings(r), [{
      message: 'Map caption contains "|"; Obsidian2Typst ends the caption there',
      link: 'Moss | Stone',
      file: 'index2compile.md',
      line: 3,
    }]);
  });

  it('AC-4: a second caption is ignored and reported once at the fence', () => {
    const r = compile({ 'index2compile.md': `# Index\n\n${block('# vault-compiler: caption First\n0101 forest\n# vault-compiler: caption Second\n# vault-compiler: caption Third')}` });
    assert.match(mapLine(r.content)!, /^!\[First\]\(/);
    assert.deepEqual(captionWarnings(r), [{
      message: 'Map caption is given more than once; the first is used',
      link: 'Second',
      file: 'index2compile.md',
      line: 3,
    }]);
  });

  it('AC-5: the caption line changes the PNG name', () => {
    const r = compile({ 'index2compile.md': `${block('0101 forest "Peak"')}\n${block('# vault-compiler: caption Peak\n0101 forest "Peak"')}` });
    const refs = mapRefs(r.content);
    assert.equal(refs.length, 2);
    assert.notEqual(refs[0], refs[1]);
  });

  it('AC-5: the same captioned map in two notes: drawn once, both captioned', () => {
    const map = block('# vault-compiler: caption Shared\n0101 forest');
    const r = compile({ 'index2compile.md': '- [[a]]\n- [[b]]\n', 'a.md': `# A\n\n${map}`, 'b.md': `# B\n\n${map}` });
    const lines = r.content.split('\n').filter(l => /\]\(assets\/textmapper\//.test(l));
    assert.equal(lines.length, 2);
    for (const line of lines) assert.match(line, /^!\[Shared\]\(/);
    assert.equal(new Set(mapRefs(r.content)).size, 1);
  });

  it('AC-5: in a quote the line keeps its prefix', () => {
    const r = compile({ 'index2compile.md': '# Index\n\n> ![[Q]]\n', 'Q.md': block('# vault-compiler: caption Quoted Map\n0101 forest') });
    assert.ok(r.content.split('\n').some(l => /^> !\[Quoted Map\]\(assets\/textmapper\//.test(l)), r.content);
  });

  it('AC-5: maps off keep the fence as written, caption line included', () => {
    const r = compile({ 'index2compile.md': block('# vault-compiler: caption Kept\n0101 forest') }, false);
    assert.match(r.content, /^# vault-compiler: caption Kept$/m);
    assert.equal(mapLine(r.content), undefined);
  });
});
