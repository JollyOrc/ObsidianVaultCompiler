/**
 * Tests for heading normalisation (US-6.3).
 *
 * Feature: optional `normaliseHeadings` compiler option.
 * When enabled, the numeric prefix of each embedded file's filename determines
 * the absolute heading depth that file occupies in the compiled output.
 * Files without a numeric prefix go one level below the last original heading
 * above the embed, else one below the embedding file (AC-4, OD-2).
 * The first heading of a heading-first file is replaced by the file's title
 * (AC-6, OD-1).
 *
 * All tests use InMemoryVaultCompiler directly; the toggle is passed as a
 * compiler option rather than through the Obsidian settings UI.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compile(
  files: Record<string, string>,
  entry: string,
  normalise = true,
) {
  return new InMemoryVaultCompiler(files, { normaliseHeadings: normalise }).compile(entry);
}

// ---------------------------------------------------------------------------
// Toggle off — existing behaviour unchanged
// ---------------------------------------------------------------------------

describe('heading normalisation: AC-1 toggle', () => {
  it('when off, US-6.1 applies: filename heading, internal headings not shifted', () => {
    /**
     * US-6.3 | AC-1 (OD-4): off means US-6.1. The leading `# Fight` becomes the
     * US-6.1 heading `### Magic`; `## Body Magic` stays h2 (normalised: h4).
     */
    const files = {
      'index.md': '![[1.3.2 Magic.md]]',
      '1.3.2 Magic.md': '# Fight\n\n## Body Magic\n\nContent.',
    };
    const result = compile(files, 'index.md', false);
    assert.match(result.content, /^### Magic$/m);
    assert.match(result.content, /^## Body Magic$/m);
    assert.doesNotMatch(result.content, /Fight/);
  });

  it('when on, the same file is normalised instead', () => {
    /** US-6.3 | AC-1: on → AC-6 applies (title at depth 3, rest shifted). */
    const files = {
      'index.md': '![[1.3.2 Magic.md]]',
      '1.3.2 Magic.md': '# Fight\n\n## Body Magic\n\nContent.',
    };
    const result = compile(files, 'index.md', true);
    assert.match(result.content, /^### Magic$/m);
    assert.match(result.content, /^#### Body Magic$/m);
  });
});

// ---------------------------------------------------------------------------
// Prefix parsing
// ---------------------------------------------------------------------------

describe('heading normalisation: prefix depth parsing', () => {
  it('single-segment prefix → depth 1', () => {
    const files = {
      'index.md': '![[1 Overview.md]]',
      '1 Overview.md': '# Overview\n\nContent.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# Overview/m);
  });

  it('two-segment prefix → depth 2', () => {
    const files = {
      'index.md': '![[1.3 Magic.md]]',
      '1.3 Magic.md': '# Magic\n\nContent.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^## Magic/m);
  });

  it('three-segment prefix → depth 3', () => {
    const files = {
      'index.md': '![[1.3.2 Magic.md]]',
      '1.3.2 Magic.md': '# Magic\n\nContent.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^### Magic/m);
  });

  it('four-segment prefix → depth 4', () => {
    const files = {
      'index.md': '![[1.3.2.1 Body Magic.md]]',
      '1.3.2.1 Body Magic.md': '# Body Magic\n\nContent.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^#### Body Magic/m);
  });

  it('leading zeros are stripped before counting (01.03.02 = depth 3)', () => {
    const files = {
      'index.md': '![[01.03.02 Magic.md]]',
      '01.03.02 Magic.md': '# Magic\n\nContent.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^### Magic/m);
  });

  it('file without numeric prefix inherits parent_depth + 1', () => {
    // root (depth 0) embeds unprefixed → depth 1
    const files = {
      'index.md': '![[Overview.md]]',
      'Overview.md': '# Overview\n\nContent.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# Overview/m);
  });
});

// ---------------------------------------------------------------------------
// Heading replacement (option b)
// ---------------------------------------------------------------------------

describe('heading normalisation: heading replacement', () => {
  it('file first heading is replaced by filename-derived heading at prefix depth', () => {
    const files = {
      'index.md': '![[1.3.2 Magic.md]]',
      '1.3.2 Magic.md': '# Magic\n\nContent.',
    };
    const result = compile(files, 'index.md');
    // The heading text should be preserved (from filename minus prefix+ext)
    assert.match(result.content, /^### Magic/m);
    // Original h1 line must not appear as a bare # heading
    assert.doesNotMatch(result.content, /^# Magic/m);
  });

  it('filename text (prefix and extension stripped) is used as heading text', () => {
    const files = {
      'index.md': '![[2.1 Combat Rules.md]]',
      '2.1 Combat Rules.md': '# Combat Rules\n\nContent.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^## Combat Rules/m);
  });

  it('remaining headings are offset to preserve relative depth', () => {
    const files = {
      'index.md': '![[1.3.2 Magic.md]]',
      '1.3.2 Magic.md': '# Magic\n\n## Body Magic\n\n### Spells\n\nContent.',
    };
    const result = compile(files, 'index.md');
    // # Magic → ### Magic (depth 3, replaces original h1)
    // ## Body Magic → #### Body Magic (depth 4 = 3+1)
    // ### Spells → ##### Spells (depth 5 = 3+2)
    assert.match(result.content, /^### Magic/m);
    assert.match(result.content, /^#### Body Magic/m);
    assert.match(result.content, /^##### Spells/m);
  });

  it('original heading text is not duplicated after replacement', () => {
    const files = {
      'index.md': '![[1.3.2 Magic.md]]',
      '1.3.2 Magic.md': '# Magic\n\nContent.',
    };
    const result = compile(files, 'index.md');
    const matches = result.content.match(/Magic/g) ?? [];
    // Heading text appears once (in the normalised heading) + once in prose = 1 here since no prose
    assert.ok(matches.length <= 1, `"Magic" appeared ${matches.length} times, expected 1`);
  });

  it('headingless prefix file gets title injected at prefix depth (updated by US-6.4)', () => {
    /**
     * US-6.4 | AC-6: Headingless files now receive an injected filename-derived
     * title heading.  This test was originally "file with no headings includes
     * text as-is, no heading injected" under US-6.3; the expectation changed
     * when US-6.4 extended injection to headingless files.
     */
    const files = {
      'index.md': '![[1.3.2 Magic.md]]',
      '1.3.2 Magic.md': 'Just some prose with no headings.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /Just some prose/);
    // US-6.4: title now injected at prefix depth 3
    assert.match(result.content, /^### Magic/m);
  });

  it('preamble prefix file: title injected at prefix depth, text preserved, internal heading below title (updated by US-6.4)', () => {
    /**
     * US-6.4 | AC-1 + AC-4 + AC-5: Prefix preamble file behaviour.
     * This test was originally "text before the first heading is preserved and
     * not affected by normalisation" under US-6.3.  US-6.4 changes the
     * expectation: a title is now injected before the preamble text, and the
     * internal heading shifts to titleDepth + 1.
     *
     * "1.3 Overview.md" (prefix depth 2, preamble file):
     *   Source:  Preamble text.\n\n# Overview\n\nContent.
     *   Output:  ## Overview (injected title at h2)
     *            Preamble text.
     *            ### Overview  (source h1 → h2+1 = h3)
     *            Content.
     */
    const files = {
      'index.md': '![[1.3 Overview.md]]',
      '1.3 Overview.md': 'Preamble text.\n\n# Overview\n\nContent.',
    };
    const result = compile(files, 'index.md');
    // Injected title at prefix depth 2
    assert.match(result.content, /^## Overview/m);
    // Preamble text preserved
    assert.match(result.content, /Preamble text\./);
    // Internal source h1 shifts to titleDepth+1 = h3
    assert.match(result.content, /^### Overview/m);
    // Injected title must precede preamble text
    const titleIdx = result.content.indexOf('## Overview');
    const preambleIdx = result.content.indexOf('Preamble text');
    assert.ok(titleIdx < preambleIdx, 'injected title must precede preamble text');
  });

  it('multiple headings at the same shallowest level are all offset correctly', () => {
    const files = {
      'index.md': '![[1.2 Multi.md]]',
      '1.2 Multi.md': '# First\n\nProse.\n\n# Second\n\nMore prose.',
    };
    const result = compile(files, 'index.md');
    // US-6.3 | AC-6 (OD-1): first heading replaced by the title; second shifts by the same offset.
    assert.match(result.content, /^## Multi$/m);
    assert.match(result.content, /^## Second$/m);
    assert.doesNotMatch(result.content, /First/);
  });
});

// ---------------------------------------------------------------------------
// Absolute depth for prefixed files
// ---------------------------------------------------------------------------

describe('heading normalisation: absolute depth', () => {
  it('a prefixed file embedded from a shallow context uses its own prefix depth', () => {
    // 1 Overview.md (depth 1) embeds 1.3.2 Magic.md (depth 3) — not depth 2
    const files = {
      'index.md': '![[1 Overview.md]]',
      '1 Overview.md': '# Overview\n\n![[1.3.2 Magic.md]]',
      '1.3.2 Magic.md': '# Magic\n\nContent.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# Overview/m);
    assert.match(result.content, /^### Magic/m);
  });
});

// ---------------------------------------------------------------------------
// Unprefixed files — relative (parent_depth + 1)
// ---------------------------------------------------------------------------

describe('heading normalisation: unprefixed file inheritance', () => {
  it('unprefixed file embedded from depth-1 context is placed at depth 2', () => {
    const files = {
      'index.md': '![[1 Overview.md]]',
      '1 Overview.md': '# Overview\n\n![[Details.md]]',
      'Details.md': '# Details\n\nContent.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# Overview/m);
    assert.match(result.content, /^## Details/m);
  });

  it('unprefixed file embedded from depth-3 context is placed at depth 4', () => {
    const files = {
      'index.md': '![[1.3.2 Magic.md]]',
      '1.3.2 Magic.md': '# Magic\n\n![[Appendix.md]]',
      'Appendix.md': '# Appendix\n\nContent.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^### Magic/m);
    assert.match(result.content, /^#### Appendix/m);
  });
});

// ---------------------------------------------------------------------------
// Root file
// ---------------------------------------------------------------------------

describe('heading normalisation: root file', () => {
  it('root file headings are treated as level 1', () => {
    const files = {
      'index.md': '# Rulebook\n\n![[1.3.2 Magic.md]]',
      '1.3.2 Magic.md': '# Magic\n\nContent.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# Rulebook/m);
    assert.match(result.content, /^### Magic/m);
  });
});

// ---------------------------------------------------------------------------
// Recursive embedding
// ---------------------------------------------------------------------------

describe('heading normalisation: recursive embedding', () => {
  it('three levels of prefixed nesting each use their own absolute depth', () => {
    const files = {
      'index.md': '![[1 Chapter.md]]',
      '1 Chapter.md': '# Chapter\n\n![[1.2 Section.md]]',
      '1.2 Section.md': '## Section\n\n![[1.2.3 Subsection.md]]',
      '1.2.3 Subsection.md': '# Subsection\n\nContent.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# Chapter/m);
    assert.match(result.content, /^## Section/m);
    assert.match(result.content, /^### Subsection/m);
  });
});

// ---------------------------------------------------------------------------
// Section embeds — relative normalisation
// ---------------------------------------------------------------------------

describe('heading normalisation: section embed (relative)', () => {
  it('section embed normalises headings relative to the embedding file depth', () => {
    // Embedding context: root (depth 0), so section headings start at depth 1
    const files = {
      'index.md': '![[1.3.2 Magic.md#Body Magic]]',
      '1.3.2 Magic.md': '# Magic\n\n## Body Magic\n\n### Spells\n\nContent.',
    };
    const result = compile(files, 'index.md');
    // US-6.3 | AC-7 (OD-3): root is depth 0 with no heading above the embed,
    // so the section's shallowest heading moves UP to depth 1.
    assert.match(result.content, /^# Body Magic$/m, 'section heading at embedding_depth+1');
    assert.match(result.content, /^## Spells$/m);
  });

  it('same section embedded from a depth-2 file lands at depth 3', () => {
    const files = {
      'index.md': '![[1.2 Rules.md]]',
      '1.2 Rules.md': '# Rules\n\n![[1.3.2 Magic.md#Body Magic]]',
      '1.3.2 Magic.md': '# Magic\n\n## Body Magic\n\n### Spells\n\nContent.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^### Body Magic/m);
    assert.match(result.content, /^#### Spells/m);
  });
});

// ---------------------------------------------------------------------------
// Depth clamping — ceiling (h6)
// ---------------------------------------------------------------------------

describe('heading normalisation: ceiling clamping at h6', () => {
  it('headings that exceed level 6 are clamped to h6', () => {
    const files = {
      'index.md': '![[1.2.3.4.5.6 Deep.md]]',
      '1.2.3.4.5.6 Deep.md': '# Deep\n\n## Deeper\n\nContent.',
    };
    const result = compile(files, 'index.md');
    // depth 6: # → ###### (h6); ## would be h7 → clamped to h6
    assert.match(result.content, /^###### Deep/m);
    assert.match(result.content, /^###### Deeper/m);
  });

  it('ceiling clamping records a WarningDetail', () => {
    const files = {
      'index.md': '![[1.2.3.4.5.6 Deep.md]]',
      '1.2.3.4.5.6 Deep.md': '# Deep\n\n## Deeper\n\nContent.',
    };
    const result = compile(files, 'index.md');
    assert.ok(result.warnings.length > 0, 'expected a clamping warning');
    assert.ok(
      result.warningDetails.some(d => d.message.toLowerCase().includes('clamp')),
      'WarningDetail should mention clamping',
    );
  });
});

// ---------------------------------------------------------------------------
// Depth clamping — floor (inversion)
// ---------------------------------------------------------------------------

describe('heading normalisation: floor clamping (heading inversion)', () => {
  it('a shallow-prefix file embedded in a deep context is clamped upward', () => {
    // 1.3.2 Magic.md (depth 3) embeds 1 Overview.md (depth 1, would invert)
    // → Overview clamped to depth 4 (parent_depth + 1)
    const files = {
      'index.md': '![[1.3.2 Magic.md]]',
      '1.3.2 Magic.md': '# Magic\n\n![[1 Overview.md]]',
      '1 Overview.md': '# Overview\n\nContent.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^### Magic/m);
    // Overview clamped to depth 4 (3+1), not depth 1
    assert.match(result.content, /^#### Overview/m);
    assert.doesNotMatch(result.content, /^# Overview/m);
  });

  it('floor clamping records a WarningDetail', () => {
    const files = {
      'index.md': '![[1.3.2 Magic.md]]',
      '1.3.2 Magic.md': '# Magic\n\n![[1 Overview.md]]',
      '1 Overview.md': '# Overview\n\nContent.',
    };
    const result = compile(files, 'index.md');
    assert.ok(
      result.warningDetails.some(d => d.message.toLowerCase().includes('clamp')),
      'WarningDetail should mention clamping',
    );
  });
});

// ---------------------------------------------------------------------------
// Interaction with auto-heading (US-6.1)
// ---------------------------------------------------------------------------

describe('heading normalisation: interaction with auto-heading', () => {
  it('does not produce a double heading when both normalisation and auto-heading are active', () => {
    const files = {
      'index.md': '![[1.3.2 Magic.md]]',
      '1.3.2 Magic.md': '# Magic\n\nContent.',
    };
    const result = compile(files, 'index.md');
    const headingMatches = (result.content.match(/^#{1,6} Magic/gm) ?? []);
    assert.strictEqual(headingMatches.length, 1, 'heading "Magic" should appear exactly once');
  });
});

// ---------------------------------------------------------------------------
// Decisions of 2026-10-27 (OD-1 to OD-5)
// ---------------------------------------------------------------------------

describe('heading normalisation: AC-3 prefixed files ignore the root heading', () => {
  it('a depth-1 file after the root heading is its sibling', () => {
    /** US-6.3 | AC-3: root `# The Rulebook` + `1 Player Section.md` → `# Player Section`. */
    const result = compile({
      'index.md': '# The Rulebook\n![[1 Player Section.md]]',
      '1 Player Section.md': '# Players\nText.',
    }, 'index.md');
    assert.match(result.content, /^# The Rulebook$/m);
    assert.match(result.content, /^# Player Section$/m);
  });
});

describe('heading normalisation: AC-4 one depth rule for unprefixed files', () => {
  const ROOT = '# Book\n## Chapter\n';

  it('heading-first file goes under the last original heading', () => {
    /** US-6.3 | AC-4 (OD-2): was h1 before 2026-10-27. */
    const result = compile({ 'index.md': ROOT + '![[X.md]]', 'X.md': '# X head\nbody\n## X sub' }, 'index.md');
    assert.match(result.content, /^### X$/m);
    assert.match(result.content, /^#### X sub$/m);
  });

  it('preamble file goes under the last original heading', () => {
    /** US-6.3 | AC-4 / US-6.4 AC-2. */
    const result = compile({ 'index.md': ROOT + '![[X.md]]', 'X.md': 'intro\n# X head' }, 'index.md');
    assert.match(result.content, /^### X$/m);
    assert.match(result.content, /^#### X head$/m);
  });

  it('pass-through wrapper goes under the last original heading', () => {
    /** US-6.3 | AC-4 / US-6.5: was h2 before 2026-10-27. */
    const result = compile({
      'index.md': ROOT + '![[A.md]]', 'A.md': '![[X.md]]', 'X.md': '# X head\n## X sub',
    }, 'index.md');
    assert.match(result.content, /^### X$/m);
    assert.match(result.content, /^#### X sub$/m);
  });

  it('section embed goes under the last original heading', () => {
    /** US-6.3 | AC-4 + AC-7: was h2 (unshifted) before 2026-10-27. */
    const result = compile({
      'index.md': ROOT + '![[X.md#Sec]]', 'X.md': '# Top\n## Sec\nc\n### Deeper',
    }, 'index.md');
    assert.match(result.content, /^### Sec$/m);
    assert.match(result.content, /^#### Deeper$/m);
  });

  it('markdown-syntax section embed follows the same rule', () => {
    /** US-6.3 | AC-7: both embed syntaxes behave identically. */
    const result = compile({
      'index.md': ROOT + '![s](X.md#Sec)', 'X.md': '# Top\n## Sec\nc\n### Deeper',
    }, 'index.md');
    assert.match(result.content, /^### Sec$/m);
    assert.match(result.content, /^#### Deeper$/m);
  });

  it('with no heading above the embed, a root embed lands at h1', () => {
    /** US-6.3 | AC-4: parent depth 0 + 1. */
    const result = compile({ 'index.md': '![[X.md]]', 'X.md': '# X head' }, 'index.md');
    assert.match(result.content, /^# X$/m);
  });

  it('the last heading above the embed counts even after an image or a section embed', () => {
    /**
     * US-6.3 | AC-4: the heading context belongs to each embed's position.
     * An image and a section embed come before `## B`; X must still land at h3.
     */
    const result = compile({
      'index.md': '# A\n![[pic.png]]\n![[M.md#Sec]]\n## B\n![[X.md]]',
      'pic.png': 'PNG',
      'M.md': '# M\n## Sec\nm',
      'X.md': 'x intro',
    }, 'index.md');
    assert.match(result.content, /^### X$/m);
  });
});

describe('heading normalisation: AC-6 the title replaces the first heading', () => {
  it('heading text that differs from the filename is replaced', () => {
    /** US-6.3 | AC-6 (OD-1): `1.2 Combat.md` = `# Fighting` / `## Rounds` → `## Combat` / `### Rounds`. */
    const result = compile({
      'index.md': '![[1.2 Combat.md]]',
      '1.2 Combat.md': '# Fighting\n## Rounds',
    }, 'index.md');
    assert.match(result.content, /^## Combat$/m);
    assert.match(result.content, /^### Rounds$/m);
    assert.doesNotMatch(result.content, /Fighting/);
  });

  it('the title keeps hyphens from the filename', () => {
    /** US-6.3 | AC-6 + US-6.4 title rule. */
    const result = compile({
      'index.md': '![[2.2.2 Third-Level.md]]',
      '2.2.2 Third-Level.md': '# Something else\ntext',
    }, 'index.md');
    assert.match(result.content, /^### Third-Level$/m);
  });
});

describe('heading normalisation: AC-8 and AC-9 clamps leave no comment in the output', () => {
  it('ceiling clamp records a warning but writes no comment', () => {
    /** US-6.3 | AC-8 (OD-5). */
    const result = compile({
      'index.md': '![[1.2.3.4.5.6 Deep.md]]',
      '1.2.3.4.5.6 Deep.md': '# Deep\n\n## Deeper',
    }, 'index.md');
    assert.ok(result.warningDetails.some(d => d.message.includes('clamped')));
    assert.doesNotMatch(result.content, /<!--[^>]*clamp/i);
  });

  it('floor clamp records a warning but writes no comment', () => {
    /** US-6.3 | AC-9 (OD-5). */
    const result = compile({
      'index.md': '![[1.3.2 Magic.md]]',
      '1.3.2 Magic.md': '# Magic\n\n![[1 Overview.md]]',
      '1 Overview.md': '# Overview\n\nContent.',
    }, 'index.md');
    assert.ok(result.warningDetails.some(d => d.message.includes('clamped')));
    assert.doesNotMatch(result.content, /<!--[^>]*clamp/i);
  });
});

describe('heading normalisation: AC-11 composed nesting', () => {
  it('an unprefixed file inside a preamble file goes under that file\'s internal heading', () => {
    /** US-6.3 | AC-11: `## Sec`, `### Inner`, `#### X`. */
    const result = compile({
      'index.md': '![[1.2 Sec.md]]',
      '1.2 Sec.md': 'Intro.\n# Inner\n![[X.md]]',
      'X.md': '# X head',
    }, 'index.md');
    assert.match(result.content, /^## Sec$/m);
    assert.match(result.content, /^### Inner$/m);
    assert.match(result.content, /^#### X$/m);
  });
});
