/**
 * Tests for auto-generated headings (US-6.1) — the headings used when
 * "Normalise headings" (US-6.3) is off.
 *
 * Every test runs twice: with `normaliseHeadings: false`, which is what the
 * plugin passes (OD-4, 2026-10-27), and with the option left out, which only
 * tests do. Both must give the same output (SCAR-023: test every value the
 * real caller passes).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

const MODES = [
  { label: 'normaliseHeadings: false', options: { normaliseHeadings: false } },
  { label: 'option absent', options: {} },
] as const;

for (const mode of MODES) {
  const compile = (files: Record<string, string>, entry = 'index.md') =>
    new InMemoryVaultCompiler(files, mode.options).compile(entry);

  describe(`US-6.1 auto-headings (${mode.label})`, () => {
    it('AC: a leading heading is replaced by the filename heading', () => {
      /** US-6.1 | AC-4: `1.2 Combat.md` = `# Fighting` / `text` → `## Combat` / `text`. */
      const result = compile({
        'index.md': '![[1.2 Combat.md]]',
        '1.2 Combat.md': '# Fighting\ntext',
      });
      assert.match(result.content, /^## Combat$/m);
      assert.doesNotMatch(result.content, /Fighting/);
      assert.match(result.content, /^text$/m);
    });

    it('AC: a file without a leading heading gets the filename heading before its content', () => {
      /** US-6.1 | AC-4: preamble file gets a heading prepended. */
      const result = compile({
        'index.md': '![[3.0 Appendix.md]]',
        '3.0 Appendix.md': 'No heading here.',
      });
      assert.match(result.content, /^# Appendix\n+No heading here\./m);
    });

    it('AC: heading text follows the title rule (prefix removed, hyphens kept)', () => {
      /** US-6.1 | AC-1: `2.2.2 Third-Level.md` → `### Third-Level`. */
      const result = compile({
        'index.md': '![[2.2.2 Third-Level.md]]',
        '2.2.2 Third-Level.md': 'Text.',
      });
      assert.match(result.content, /^### Third-Level$/m);
      assert.doesNotMatch(result.content, /2\.2\.2/);
    });

    it('AC: level counts prefix segments, trailing .0 dropped, up to h6', () => {
      /** US-6.1 | AC-2: 1.0 → h1, 1.1 → h2, 1.1.1.1 → h4 (cap is h6, not h3). */
      const result = compile({
        'index.md': '![[1.0 Intro.md]]\n![[1.1 Part.md]]\n![[1.1.1.1 Detail.md]]\n![[1.1.1.1.1.1.1 Deep.md]]',
        '1.0 Intro.md': 'a',
        '1.1 Part.md': 'b',
        '1.1.1.1 Detail.md': 'c',
        '1.1.1.1.1.1.1 Deep.md': 'd',
      });
      assert.match(result.content, /^# Intro$/m);
      assert.match(result.content, /^## Part$/m);
      assert.match(result.content, /^#### Detail$/m);
      assert.match(result.content, /^###### Deep$/m);
    });

    it('AC: an unnumbered file gets h2', () => {
      /** US-6.1 | AC-3. */
      const result = compile({ 'index.md': '![[notes.md]]', 'notes.md': 'n' });
      assert.match(result.content, /^## Notes$/m);
    });

    it('AC: internal headings stay as written', () => {
      /** US-6.1: only the leading heading is touched; US-6.3 shifting does not apply. */
      const result = compile({
        'index.md': '# Root\n![[1.2 Combat.md]]',
        '1.2 Combat.md': '# Fighting\n## Rounds\n# Aftermath',
      });
      assert.match(result.content, /^## Rounds$/m);
      assert.match(result.content, /^# Aftermath$/m);
    });

    it('AC: the root file gets no heading and keeps its own', () => {
      /** US-6.1 | AC-1: only embedded files get a heading. */
      const result = compile({ 'index.md': '# Rulebook\n![[notes.md]]', 'notes.md': 'n' });
      assert.match(result.content, /^# Rulebook$/m);
      assert.doesNotMatch(result.content, /^#+ Index$/m);
    });
  });
}
