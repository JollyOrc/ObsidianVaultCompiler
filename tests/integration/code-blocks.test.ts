/**
 * KD-3 (US-6.6, fixed in v0.16.1): a line inside a code block is never a
 * heading — examples K-1 to K-7 of userstories.md.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

const F = '```';
const compile = (files: Record<string, string>, normaliseHeadings = true) =>
  new InMemoryVaultCompiler(files, { normaliseHeadings }).compile('index.md').content;
/** Every fence opened in the output is closed. */
const fencesBalanced = (text: string) => (text.match(/^\s*```/gm) ?? []).length % 2 === 0;

const NOTES = `# Bit\n- one\n${F}\n# code\n${F}\n# Next\nafter\n`;

describe('KD-3: heading rules skip code blocks', () => {
  it('K-1: a section embed does not end at a # line inside a code block', () => {
    const out = compile({ 'index.md': '![[Notes#Bit]]', 'Notes.md': NOTES });
    assert.ok(out.includes(`${F}\n# code\n${F}`), out);
    assert.ok(!out.includes('after') && !out.includes('Next'), 'stops before # Next');
    assert.ok(fencesBalanced(out), 'no unclosed fence');
  });

  it('K-2: normalisation leaves # lines inside code alone (heading-first note)', () => {
    const out = compile({ 'index.md': '![[1.2 X]]', '1.2 X.md': `# X\n${F}\n# code\n${F}\n## Sub\n` });
    assert.match(out, /^## X$/m);
    assert.ok(out.includes(`${F}\n# code\n${F}`), out);
    assert.match(out, /^### Sub$/m);
  });

  it('K-3: a preamble note takes its first real heading, not the code line', () => {
    const out = compile({ 'index.md': '![[1.2 Y]]', '1.2 Y.md': `Intro.\n${F}\n# code\n${F}\n# Real\n` });
    assert.match(out, /^## Y$/m);
    assert.ok(out.includes(`${F}\n# code\n${F}`), out);
    assert.match(out, /^### Real$/m);
  });

  it('K-4: a note whose only # lines are in code is headingless', () => {
    const out = compile({ 'index.md': '![[1.3.2 H]]', '1.3.2 H.md': `${F}\n# code\n${F}\n` });
    assert.match(out, /^### H\n```\n# code\n```$/m);
  });

  it('K-5: a code line does not count as the last original heading', () => {
    const out = compile({ 'index.md': `# Book\n${F}\n###### not a heading\n${F}\n![[Z]]`, 'Z.md': 'Z text.' });
    assert.match(out, /^## Z$/m);
  });

  it('K-6: moving a section does not shift code lines', () => {
    const out = compile({ 'index.md': '![[M#Sec]]', 'M.md': `# M\n## Sec\n${F}\n# code\n${F}\n` });
    assert.match(out, /^# Sec$/m);
    assert.ok(out.includes(`${F}\n# code\n${F}`), out);
  });

  it('K-7: toggle off — the section embed of K-1 is the same', () => {
    const out = compile({ 'index.md': '![[Notes#Bit]]', 'Notes.md': NOTES }, false);
    assert.ok(out.includes(`${F}\n# code\n${F}`), out);
    assert.ok(!out.includes('after'));
    assert.ok(fencesBalanced(out));
  });

  it('~~~ fences count too, and an unclosed block runs to the end of the note', () => {
    const out = compile({ 'index.md': '![[1.2 X]]', '1.2 X.md': `# X\n~~~\n# tilde\n~~~\n## Sub\n${F}\n# open\n` });
    assert.ok(out.includes('~~~\n# tilde\n~~~'), out);
    assert.match(out, /^### Sub$/m);
    assert.ok(out.includes(`${F}\n# open`), 'the unclosed block is left alone');
  });
});

describe('KD-3: one helper decides what a heading is (SCAR-017)', () => {
  const srcDir = new URL('../../plugin/src/', import.meta.url);
  const sources = readdirSync(srcDir).filter(n => n.endsWith('.ts') && !n.endsWith('.d.ts'))
    .map(name => ({ name, text: readFileSync(new URL(name, srcDir), 'utf8') }));

  it('the heading pattern #{1,6} appears only once, in utils.ts', () => {
    const hits = sources.flatMap(s => [...s.text.matchAll(/#\{1,6\}/g)].map(() => s.name));
    assert.deepEqual(hits, ['utils.ts'], `found in: ${hits.join(', ')}`);
  });

  it('the code-block fence pattern appears only once, in utils.ts', () => {
    const hits = sources.flatMap(s => [...s.text.matchAll(/\(```\|~~~\)/g)].map(() => s.name));
    assert.deepEqual(hits, ['utils.ts'], `found in: ${hits.join(', ')}`);
  });
});
