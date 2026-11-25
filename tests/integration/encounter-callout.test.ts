/**
 * Tests for US-9.6 (Epic 9): which callouts become an `o2t-encounter` block,
 * and the setting `encounterCalloutType` (AC-1). The block's format is owned
 * by its reader, Obsidian2Typst (`docs/technical/encounter-block.md`,
 * SCAR-040). Synthetic notes only (SCAR-035): Mire Hollow, Lost Pilgrim.
 *
 * Written before the code (G2, 2026-11-25): red until US-9.6 exists.
 * Interface (`userstories.md`, US-9.6 "Interface (G2, 2026-11-25)"): the
 * option `encounterCalloutType` (string, as typed; the compiler trims it and
 * compares without case; absent or empty = off) is passed to
 * `InMemoryVaultCompiler`. The rows here are plain text lines, so the file
 * needs no creature notes and no `entryMarkerKeys`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';

type Files = Record<string, string>;

/** US-9.6 | AC-10: the reader's parser and the writer of US-9.1, the library itself (installed with the plugin). */
const { parse, Document, Scalar } = createRequire(new URL('../../plugin/package.json', import.meta.url))('yaml') as typeof import('yaml');

function compile(files: Files, options: Record<string, unknown> = {}, start = 'index.md'): CompileResult {
  const r = new InMemoryVaultCompiler(files, { encounterCalloutType: 'encounter', ...options }).compile(start);
  // US-9.6: the placeholder that holds a block's place never reaches the output.
  assert.doesNotMatch(r.content, /__v\w+__/, r.content);
  return r;
}

/** The same compile with the setting off: what v0.25.0 writes. */
const off = (files: Files, start = 'index.md'): CompileResult => new InMemoryVaultCompiler(files, {}).compile(start);

/** US-9.6 | AC-10: every `o2t-encounter` block of the output, as text. */
function blocks(content: string): string[] {
  return [...content.matchAll(/^(`{3,})o2t-encounter\n([\s\S]*?)^\1$/gm)].map(m => m[2]);
}

interface Row { name: string; count: string; note?: string }

/**
 * US-9.6 | AC-6, AC-10: the expected block text, written by the writer of
 * US-9.1 (`yaml` 2.9.1, `nullStr: ''`) with each `count` a double-quoted
 * scalar (the contract: always quoted); the fence line and the final newline included.
 */
function expectedBlock(rows: Row[], title?: string): string {
  const doc = new Document({
    ...(title === undefined ? {} : { title }),
    rows: rows.map(r => ({
      name: r.name,
      count: Object.assign(new Scalar(r.count), { type: 'QUOTE_DOUBLE' as const }),
      ...(r.note === undefined ? {} : { note: r.note }),
    })),
  }, { aliasDuplicateObjects: false }); // #134: the writer never writes YAML anchors (two rows of one creature)
  return '```o2t-encounter\n' + doc.toString({ nullStr: '' }) + '```\n';
}

/** US-9.6 | AC-6, AC-10 (SCAR-028): the output holds one block; its text is exact and parses to the plain values. */
function assertOneBlock(content: string, rows: Row[], title?: string): void {
  const found = blocks(content);
  assert.equal(found.length, 1, content);
  assert.equal(`\`\`\`o2t-encounter\n${found[0]}\`\`\`\n`, expectedBlock(rows, title));
  assert.deepEqual(parse(found[0]), {
    ...(title === undefined ? {} : { title }),
    rows: rows.map(r => ({ name: r.name, count: r.count, ...(r.note === undefined ? {} : { note: r.note }) })),
  });
}

const LOST: Row = { name: 'Lost Pilgrim', count: '1' };
const LINE = '> - 1 × Lost Pilgrim\n';
const book = (embed = '![[Mire Hollow]]') => `# Book\n\n${embed}\n`;

describe('US-9.6 AC-1: a callout of the setting\'s type becomes one block', () => {
  const headers = ['> [!encounter]', '> [!Encounter]', '> [!ENCOUNTER]', '> [!encounter]-', '> [!encounter]+'];
  for (const header of headers) {
    it(`US-9.6 AC-1: ${header} in a whole-note embed → one block in its place`, () => {
      const r = compile({ 'index.md': book(), 'Mire Hollow.md': `# Mire Hollow\n\n${header}\n${LINE}` });
      assert.equal(r.content, `# Book\n\n## Mire Hollow\n${expectedBlock([LOST])}`);
      assertOneBlock(r.content, [LOST]);
      assert.deepEqual(r.warningDetails, []);
    });
  }

  it('US-9.6 AC-1: a folded callout with a title keeps the title', () => {
    const r = compile({ 'index.md': book(), 'Mire Hollow.md': `# Mire Hollow\n\n> [!encounter]- Night watch\n${LINE}` });
    assertOneBlock(r.content, [LOST], 'Night watch');
  });

  it('US-9.6 AC-1: the starting file\'s own callout is replaced', () => {
    const r = compile({ 'index.md': `# Book\n\n> [!encounter]\n${LINE}\nAfter.\n` });
    // Corrected at #134 (SCAR-003, test not code): the compiler drops the blank line after the
    // starting file's title with or without the setting (measured; the Interface paragraph says so).
    assert.equal(r.content, `# Book\n${expectedBlock([LOST])}\nAfter.\n`);
  });

  it('US-9.6 AC-1: the lines around the callout are untouched, the block stands in its lines', () => {
    const r = compile({ 'index.md': `# Book\n\nBefore.\n\n> [!encounter]\n${LINE}\nAfter.\n` });
    // Corrected at #134 (SCAR-003): the blank after the title goes with or without the setting (measured).
    assert.equal(r.content, `# Book\nBefore.\n\n${expectedBlock([LOST])}\nAfter.\n`);
  });
});

describe('US-9.6 AC-1: what stays as written, without a warning', () => {
  const tilde = '~~~md\n> [!encounter]\n' + LINE + '~~~\n';
  const cases: Array<[string, string, RegExp]> = [
    ['a callout at depth 2', `> > [!encounter]\n> ${LINE}`, /> > \[!encounter\]/],
    ['a callout in a list item', `- > [!encounter]\n  ${LINE}`, /- > \[!encounter\]/],
    ['a callout in a code block', '```md\n> [!encounter]\n' + LINE + '```\n', /^> \[!encounter\]$/m],
    ['a callout in a tilde code block', tilde, /^> \[!encounter\]$/m],
    ['[!encounter] written inline', 'Write [!encounter] on the first line.\n' + LINE, /Write \[!encounter\] on the first line\./],
    ['[!encounter] in the middle of a quote line', '> A quote about [!encounter] lists.\n' + LINE, /A quote about \[!encounter\] lists\./],
    ['a callout of another type', `> [!note]\n${LINE}`, /^> \[!note\]$/m],
  ];
  for (const [name, body, visible] of cases) {
    it(`US-9.6 AC-1: ${name} → output equal to the setting off, no warning of this story`, () => {
      const files = { 'index.md': book(), 'Mire Hollow.md': `# Mire Hollow\n\n${body}` };
      const on = compile(files);
      const plain = off(files);
      assert.equal(on.content, plain.content);
      assert.deepEqual(on.warningDetails, plain.warningDetails);
      assert.equal(blocks(on.content).length, 0, on.content);
      assert.match(on.content, visible, 'the text is still there (not a vacuous pass)');
      assert.equal(on.warningDetails.filter(w => w.message.startsWith('Encounter list')).length, 0);
    });
  }

  it('US-9.6 AC-1: a real callout next to the ones that stay is still replaced', () => {
    const body = `- > [!encounter]\n  ${LINE}\n> [!encounter]\n${LINE}\n> > [!encounter]\n> ${LINE}`;
    const r = compile({ 'index.md': book(), 'Mire Hollow.md': `# Mire Hollow\n\n${body}` });
    assert.equal(blocks(r.content).length, 1, r.content);
    assert.match(r.content, /- > \[!encounter\]/);
    assert.match(r.content, /> > \[!encounter\]/);
  });
});

describe('US-9.6: the setting encounterCalloutType (SCAR-019)', () => {
  const room = (type: string) => ({ 'index.md': book(), 'Mire Hollow.md': `# Mire Hollow\n\n> [!${type}]\n${LINE}` });

  for (const value of ['', '   ']) {
    it(`US-9.6 AC-1: ${JSON.stringify(value)} → off: no block is ever written`, () => {
      const r = compile(room('encounter'), { encounterCalloutType: value });
      assert.equal(r.content, off(room('encounter')).content);
      assert.equal(blocks(r.content).length, 0);
    });
  }

  it('US-9.6 AC-1: no option at all → off', () => {
    const r = new InMemoryVaultCompiler(room('encounter'), {}).compile('index.md');
    assert.equal(blocks(r.content).length, 0);
  });

  it('US-9.6 AC-1: encounter → [!encounter] and [!Encounter]', () => {
    for (const type of ['encounter', 'Encounter']) {
      assert.equal(blocks(compile(room(type)).content).length, 1, type);
    }
  });

  it('US-9.6 AC-1: foes → only [!foes]; an [!encounter] callout stays a callout', () => {
    const foes = compile(room('foes'), { encounterCalloutType: 'foes' });
    assertOneBlock(foes.content, [LOST]);
    const enc = compile(room('encounter'), { encounterCalloutType: 'foes' });
    assert.equal(blocks(enc.content).length, 0);
    assert.equal(enc.content, off(room('encounter')).content);
    assert.match(enc.content, /^> \[!encounter\]$/m);
  });

  it('US-9.6 AC-1: the value is trimmed and compared without case', () => {
    const r = compile(room('FOES'), { encounterCalloutType: '  Foes ' });
    assertOneBlock(r.content, [LOST]);
  });
});
