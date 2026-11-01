/**
 * Tests for links to embedded files (US-2.3, US-8.3) after the title rule of
 * 2026-10-27 (US-6.4) — known defect KD-1.
 *
 * Invariant: every `[label](#anchor)` produced for a link to an embedded file
 * points at a heading that exists in the output, with the toggle on and off.
 * Since 2026-11-01 anchors are the heading text as Obsidian finds it
 * (US-2.3 AC-2), no longer slugs.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';


/** US-2.3 | AC-2: all heading texts in the output, as Obsidian compares them. */
function headingTexts(content: string): Set<string> {
  return new Set(
    [...content.matchAll(/^#{1,6}\s+(.+)$/gm)].map(m => m[1].trim().toLowerCase()),
  );
}

/** All internal anchor targets of markdown links (not images). */
function anchorTargets(content: string): string[] {
  return [...content.matchAll(/(?<!!)\[[^\]]*\]\(#([^)]+)\)/g)].map(m => m[1]);
}

// A composed document: preamble file, heading-first file whose heading
// differs from its name, hyphenated name, unprefixed file, pass-through.
const FILES: Record<string, string> = {
  'index.md': '# Book\n![[1.2 Third-Level.md]]\n![[1.3 Combat.md]]\n![[Notes.md]]\n![[Wrap.md]]\n![[Links.md]]',
  '1.2 Third-Level.md': 'intro text',
  '1.3 Combat.md': '# Fighting\nrounds',
  'Notes.md': '# Something\nnotes',
  'Wrap.md': '![[Target.md]]',
  'Target.md': '# Target heading\nbody',
  'Links.md': 'See [[1.2 Third-Level]], [[1.3 Combat]], [[Notes]], [[Wrap]] and [x](Target.md).',
};

for (const normalise of [true, false]) {
  describe(`US-2.3 link anchors exist (normaliseHeadings: ${normalise})`, () => {
    const result = new InMemoryVaultCompiler(FILES, { normaliseHeadings: normalise }).compile('index.md');

    it('every anchor link points at a heading in the output', () => {
      /** US-2.3 / US-8.3 / KD-1: checks all 5 links of Links.md (SCAR-023: count asserted). */
      const targets = anchorTargets(result.content);
      assert.equal(targets.length, 5, `expected 5 anchor links, got ${targets.length}: ${targets.join(', ')}`);
      const texts = headingTexts(result.content);
      for (const t of targets) {
        const text = decodeURIComponent(t).toLowerCase();
        assert.ok(texts.has(text), `anchor #${t} has no heading; headings: ${[...texts].join(', ')}`);
      }
    });

    it('labels and anchors follow the title rule', () => {
      /** US-2.3 AC-3: `[[1.2 Third-Level]]` → `[Third-Level](#Third-Level)`. */
      assert.match(result.content, /\[Third-Level\]\(#Third-Level\)/);
      assert.match(result.content, /\[Combat\]\(#Combat\)/);
      assert.match(result.content, /\[Notes\]\(#Notes\)/);
    });

    it('a link with its own text keeps the text', () => {
      /** US-2.3: `[x](Target.md)` keeps the label `x`. */
      assert.match(result.content, /\[x\]\(#[^)]+\)/);
    });
  });
}
