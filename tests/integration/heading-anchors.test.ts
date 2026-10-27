/**
 * Tests for links to embedded files (US-2.3, US-8.3) after the title rule of
 * 2026-10-27 (US-6.4) — known defect KD-1.
 *
 * Invariant: every `[label](#slug)` produced for a link to an embedded file
 * points at a heading that exists in the output, with the toggle on and off.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import { slugify } from '../../plugin/src/utils.ts';

/** All heading slugs present in the compiled output. */
function headingSlugs(content: string): Set<string> {
  return new Set(
    [...content.matchAll(/^#{1,6}\s+(.+)$/gm)].map(m => slugify(m[1].trim())),
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
      const slugs = headingSlugs(result.content);
      for (const t of targets) {
        assert.ok(slugs.has(t), `anchor #${t} has no heading; headings: ${[...slugs].join(', ')}`);
      }
    });

    it('labels and slugs follow the title rule', () => {
      /** US-2.3: `[[1.2 Third-Level]]` → `[Third-Level](#third-level)`. */
      assert.match(result.content, /\[Third-Level\]\(#third-level\)/);
      assert.match(result.content, /\[Combat\]\(#combat\)/);
      assert.match(result.content, /\[Notes\]\(#notes\)/);
    });

    it('a link with its own text keeps the text', () => {
      /** US-2.3: `[x](Target.md)` keeps the label `x`. */
      assert.match(result.content, /\[x\]\(#[^)]+\)/);
    });
  });
}
