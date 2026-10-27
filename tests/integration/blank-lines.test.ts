/**
 * US-6.6 AC-7: the empty-line rules hold for the whole compiled document,
 * with both values of "Normalise headings", in compile() and compileAsync().
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

const FILES: Record<string, string> = {
  'index.md': '\n\n# Book\n\n\n- [[1 Part]]\n- [[Notes]]\n\n\n',
  '1 Part.md': '# Part\n\n\nIntro.\n\n\n\n## Section\n\n| a | b |\n| - | - |\n| 1 | 2 |\n![[Notes#Bit]]\n',
  // The code block has no `#` lines: section extraction and heading
  // normalisation do not know code blocks yet (KD-3, US-6.6), which is not
  // what this test is about; AC-5 with `#` lines is in the unit tests.
  'Notes.md': 'Some notes.\n\n\n# Bit\n\n- one\n- two\n\n\n\n```\nlet x = 1\n\n\nend\n```\n',
};

/** Checks AC-1 to AC-4 and AC-6 over a whole document; returns the number of headings seen. */
function checkRules(content: string): number {
  const lines = content.split('\n');
  assert.ok(content === '' || content.endsWith('\n') && !content.endsWith('\n\n'), 'AC-6: one line break at the end');
  assert.notEqual(lines[0].trim(), '', 'AC-6: no empty line at the start');
  let inFence: string | null = null;
  let headings = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*(```|~~~)/)?.[1];
    if (inFence) { if (fence === inFence) inFence = null; continue; }
    if (fence) { inFence = fence; continue; }
    const empty = line.trim() === '';
    assert.ok(!empty || line === '', `AC-1: whitespace-only line ${i}`);
    if (empty) assert.notEqual(lines[i + 1]?.trim(), '', `AC-1: two empty lines at ${i}`);
    if (/^#{1,6}[ \t]/.test(line)) {
      headings += 1;
      if (i > 0) assert.equal(lines[i - 1], '', `AC-2: no empty line before "${line}"`);
      const next = lines[i + 1] ?? '';
      if (next === '') assert.match(lines[i + 2] ?? '', /^#{1,6}[ \t]/, `AC-3: empty line after "${line}"`);
      else assert.doesNotMatch(next, /^#{1,6}[ \t]/, `AC-4: headings "${line}" / "${next}" without empty line`);
    }
  }
  return headings;
}

describe('US-6.6 AC-7: the whole compiled document follows the rules', () => {
  for (const normaliseHeadings of [true, false]) {
    it(`compile(), normaliseHeadings ${normaliseHeadings}`, () => {
      const r = new InMemoryVaultCompiler(FILES, { normaliseHeadings }).compile('index.md');
      assert.ok(checkRules(r.content) >= 4, r.content);
      assert.match(r.content, /let x = 1\n\n\nend/, 'AC-5: code block untouched');
      assert.match(r.content, /Intro\./);
      assert.match(r.content, /\| 1 \| 2 \|/);
    });

    it(`compileAsync(), normaliseHeadings ${normaliseHeadings}`, async () => {
      const r = await new InMemoryVaultCompiler(FILES, { normaliseHeadings }).compileAsync('index.md');
      assert.ok(checkRules(r.content) >= 4, r.content);
    });
  }

  it('the source notes are not changed', () => {
    const copy = { ...FILES };
    new InMemoryVaultCompiler(copy, { normaliseHeadings: true }).compile('index.md');
    assert.deepEqual(copy, FILES);
  });
});
