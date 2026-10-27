/**
 * Tests for preamble-file heading injection (US-6.4).
 *
 * When normaliseHeadings is on, any embedded file that does NOT start with a
 * heading line (preamble files, headingless files) receives a filename-derived
 * title heading injected before its content.
 *
 * Title level rules
 * -----------------
 *   Numeric-prefix file  → prefix depth.
 *   No-prefix file       → (last ORIGINAL heading in embedding file, OUTPUT level) + 1;
 *                          defaults to h1 when no prior original heading exists.
 *
 * Internal heading rule (same for both file types)
 * -------------------------------------------------
 *   All internal headings shift uniformly so that the first internal heading
 *   maps to titleDepth + 1.  Headings exceeding h6 are clamped to h6 with a
 *   WarningDetail emitted.
 *
 * "Original heading" means a heading written literally in the embedding file
 * itself — headings brought in by prior embeds do not count.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * US-6.4 | General helper used by all tests in this file.
 *
 * Constructs an InMemoryVaultCompiler with the given file map and compiles
 * from `entry`.  `normalise` defaults to true so that every test exercises
 * the feature unless it is explicitly testing the toggle-off path.
 */
function compile(
  files: Record<string, string>,
  entry: string,
  normalise = true,
) {
  return new InMemoryVaultCompiler(files, { normaliseHeadings: normalise }).compile(entry);
}

// ---------------------------------------------------------------------------
// AC-1: Prefix preamble file — title at prefix depth
// ---------------------------------------------------------------------------

describe('preamble injection: AC-1 prefix preamble — title at prefix depth', () => {
  it('depth-1 prefix preamble file gets title at h1', () => {
    /**
     * US-6.4 | AC-1: Prefix preamble file — title at prefix depth.
     *
     * "1 Chapter.md" has prefix depth 1 and starts with plain text.
     * Expected: title injected as "# Chapter".
     */
    const files = {
      'index.md': '![[1 Chapter.md]]',
      '1 Chapter.md': 'Chapter introduction.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# Chapter/m);
  });

  it('depth-2 prefix preamble file gets title at h2', () => {
    /**
     * US-6.4 | AC-1: Prefix preamble file — title at prefix depth.
     */
    const files = {
      'index.md': '![[1.3 Rules.md]]',
      '1.3 Rules.md': 'Some introductory text.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^## Rules/m);
  });

  it('depth-3 prefix preamble file gets title at h3', () => {
    /**
     * US-6.4 | AC-1: Prefix preamble file — title at prefix depth.
     */
    const files = {
      'index.md': '![[2.2.2 Third-Level.md]]',
      '2.2.2 Third-Level.md': 'Some introductory text.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^### Third-Level/m);
  });
});

// ---------------------------------------------------------------------------
// AC-2: No-prefix preamble file — title at last output heading + 1
// ---------------------------------------------------------------------------

describe('preamble injection: AC-2 no-prefix preamble — last output heading + 1', () => {
  it('last original heading h1 in root → no-prefix preamble title at h2', () => {
    /**
     * US-6.4 | AC-2: No-prefix preamble file title = last output heading + 1.
     *
     * index.md has a literal "# Root" heading (h1).  The embedded no-prefix
     * preamble file "Details.md" therefore gets its title at h2.
     */
    const files = {
      'index.md': '# Root\n\n![[Details.md]]',
      'Details.md': 'Preamble text.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^## Details/m);
  });

  it('last original heading h2 in root → no-prefix preamble title at h3', () => {
    /**
     * US-6.4 | AC-2: No-prefix preamble file title = last output heading + 1.
     */
    const files = {
      'index.md': '# First\n\n## Second\n\n![[Notes.md]]',
      'Notes.md': 'Some notes.',
    };
    const result = compile(files, 'index.md');
    // Last original heading = ## Second (h2) → title h3
    assert.match(result.content, /^### Notes/m);
  });

  it('uses the OUTPUT level of the last heading, not the source level', () => {
    /**
     * US-6.4 | AC-2: No-prefix preamble file title = last output heading + 1.
     *
     * "1.2 Section.md" is a prefix preamble file: source has "# Details" (h1),
     * which is shifted to h3 (title h2, first internal → h3).  "Appendix.md"
     * is embedded after that h3 heading and has no prefix, so its title should
     * be h3 + 1 = h4 — not h1 + 1 = h2.
     */
    const files = {
      'index.md': '![[1.2 Section.md]]',
      '1.2 Section.md': 'Intro.\n# Details\n![[Appendix.md]]',
      'Appendix.md': 'Appendix text only.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^## Section/m);   // prefix depth 2 → title h2
    assert.match(result.content, /^### Details/m);  // source h1 → output h3 (h2+1)
    assert.match(result.content, /^#### Appendix/m); // last output heading h3 → title h4
  });
});

// ---------------------------------------------------------------------------
// AC-3: No prior heading in embedding file — default title to h1
// ---------------------------------------------------------------------------

describe('preamble injection: AC-3 no prior heading — default to h1', () => {
  it('no-prefix preamble with no heading in root defaults to h1', () => {
    /**
     * US-6.4 | AC-3: No prior original heading → injected title defaults to h1.
     *
     * index.md has no headings at all, so "Overview.md" gets title at h1.
     */
    const files = {
      'index.md': '![[Overview.md]]',
      'Overview.md': 'Some overview text.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# Overview/m);
  });

  it('no-prefix preamble after only prose (no heading) in root defaults to h1', () => {
    /**
     * US-6.4 | AC-3: No prior original heading → injected title defaults to h1.
     */
    const files = {
      'index.md': 'Some root prose without any heading.\n\n![[Details.md]]',
      'Details.md': 'Detail text.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# Details/m);
  });
});

// ---------------------------------------------------------------------------
// AC-4: Internal headings shift under the injected title
// ---------------------------------------------------------------------------

describe('preamble injection: AC-4 internal headings shift under injected title', () => {
  it('prefix preamble: single internal heading shifts to titleDepth + 1', () => {
    /**
     * US-6.4 | AC-4: Internal headings shift uniformly; first → titleDepth + 1.
     *
     * Title at h3 (prefix 2.2.2); source internal h1 → h4.
     */
    const files = {
      'index.md': '![[2.2.2 Third-Level.md]]',
      '2.2.2 Third-Level.md': 'Some text\n# Heading',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^### Third-Level/m);
    assert.match(result.content, /^#### Heading/m);
    assert.doesNotMatch(result.content, /^# Heading/m);
  });

  it('prefix preamble: multiple internal headings shift uniformly', () => {
    /**
     * US-6.4 | AC-4: Internal headings shift uniformly; first → titleDepth + 1.
     *
     * Title at h2 (prefix 1.2); source h1→h3, h2→h4, h1→h3.
     */
    const files = {
      'index.md': '![[1.2 Rules.md]]',
      '1.2 Rules.md': 'Intro.\n# First\n\n## Second\n\n# Third',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^## Rules/m);
    assert.match(result.content, /^### First/m);
    assert.match(result.content, /^#### Second/m);
    assert.match(result.content, /^### Third/m);
  });

  it('no-prefix preamble: internal h1 shifts to titleDepth + 1', () => {
    /**
     * US-6.4 | AC-4: Internal headings shift uniformly; first → titleDepth + 1.
     *
     * index.md has "# Root" (h1); Details.md gets title at h2.
     * Internal source h1 → h3 (h2+1).
     */
    const files = {
      'index.md': '# Root\n\n![[Details.md]]',
      'Details.md': 'Preamble.\n# Internal heading',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^## Details/m);
    assert.match(result.content, /^### Internal heading/m);
  });
});

// ---------------------------------------------------------------------------
// AC-5: Preamble text preserved between title and first internal heading
// ---------------------------------------------------------------------------

describe('preamble injection: AC-5 preamble text preserved in correct position', () => {
  it('injected title precedes preamble text, which precedes first internal heading', () => {
    /**
     * US-6.4 | AC-5: Preamble text preserved between title and first internal heading.
     */
    const files = {
      'index.md': '![[1.2 Section.md]]',
      '1.2 Section.md': 'Introductory prose.\n\n# First Heading\n\nBody.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^## Section/m);
    assert.match(result.content, /Introductory prose\./);
    assert.match(result.content, /^### First Heading/m);
    const titleIdx = result.content.indexOf('## Section');
    const preambleIdx = result.content.indexOf('Introductory prose.');
    const internalIdx = result.content.indexOf('### First Heading');
    assert.ok(titleIdx < preambleIdx, 'injected title must come before preamble text');
    assert.ok(preambleIdx < internalIdx, 'preamble text must come before first internal heading');
  });

  it('multi-paragraph preamble text is fully preserved', () => {
    /**
     * US-6.4 | AC-5: Preamble text preserved between title and first internal heading.
     */
    const files = {
      'index.md': '![[1 Chapter.md]]',
      '1 Chapter.md': 'First paragraph.\n\nSecond paragraph.\n\n# Real Heading',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /First paragraph\./);
    assert.match(result.content, /Second paragraph\./);
    assert.match(result.content, /^# Chapter/m);
    assert.match(result.content, /^## Real Heading/m);
  });
});

// ---------------------------------------------------------------------------
// AC-6: Headingless file gets a title
// ---------------------------------------------------------------------------

describe('preamble injection: AC-6 headingless file gets a title', () => {
  it('headingless prefix file gets title at prefix depth', () => {
    /**
     * US-6.4 | AC-6: Headingless files also receive an injected title.
     */
    const files = {
      'index.md': '![[1.3.2 Magic.md]]',
      '1.3.2 Magic.md': 'Just some prose with no headings at all.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^### Magic/m);
    assert.match(result.content, /Just some prose with no headings at all\./);
  });

  it('headingless no-prefix file embedded after h2 gets title at h3', () => {
    /**
     * US-6.4 | AC-6: Headingless files also receive an injected title.
     */
    const files = {
      'index.md': '## Section\n\n![[Notes.md]]',
      'Notes.md': 'Some notes with no headings.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^### Notes/m);
    assert.match(result.content, /Some notes with no headings\./);
  });

  it('headingless no-prefix file with no prior heading defaults to h1', () => {
    /**
     * US-6.4 | AC-6 + AC-3: Headingless file with no prior heading → title at h1.
     */
    const files = {
      'index.md': '![[Notes.md]]',
      'Notes.md': 'Headingless content.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# Notes/m);
    assert.match(result.content, /Headingless content\./);
  });
});

// ---------------------------------------------------------------------------
// AC-7: h6 ceiling clamping with warning
// ---------------------------------------------------------------------------

describe('preamble injection: AC-7 h6 ceiling clamping', () => {
  it('internal heading that would exceed h6 is clamped to h6', () => {
    /**
     * US-6.4 | AC-7: Headings exceeding h6 after shift are clamped to h6.
     *
     * Prefix 1.2.3.4.5 → title at h5.  Internal source h1 → h6 (h5+1).
     * Internal source h2 → h7 → clamped to h6.
     */
    const files = {
      'index.md': '![[1.2.3.4.5 Deep.md]]',
      '1.2.3.4.5 Deep.md': 'Intro.\n# First\n## Second',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^##### Deep/m);
    assert.match(result.content, /^###### First/m);
    assert.match(result.content, /^###### Second/m);
  });

  it('ceiling clamping emits a WarningDetail', () => {
    /**
     * US-6.4 | AC-7: Clamping emits a WarningDetail (same pattern as US-6.3).
     */
    const files = {
      'index.md': '![[1.2.3.4.5 Deep.md]]',
      '1.2.3.4.5 Deep.md': 'Intro.\n# First\n## Second',
    };
    const result = compile(files, 'index.md');
    assert.ok(result.warnings.length > 0, 'expected at least one warning');
    assert.ok(
      result.warningDetails.some(d => d.message.toLowerCase().includes('clamp')),
      'WarningDetail message should mention clamping',
    );
  });

  it('injected title itself is clamped to h6 when prefix depth exceeds 6', () => {
    /**
     * US-6.4 | AC-7: Title itself clamped to h6 when prefix depth > 6.
     */
    const files = {
      'index.md': '![[1.2.3.4.5.6.7 TooDeep.md]]',
      '1.2.3.4.5.6.7 TooDeep.md': 'Intro text.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^###### TooDeep/m);
  });
});

// ---------------------------------------------------------------------------
// AC-8: No injection when normaliseHeadings is false
// ---------------------------------------------------------------------------

describe('preamble injection: AC-8 no injection when toggle off', () => {
  it('preamble prefix file gets the US-6.1 heading and unshifted internal headings when off', () => {
    /**
     * US-6.4 | AC-8 (OD-4): with the toggle off US-6.1 applies instead —
     * `### Magic` (3 segments) before the preamble, and `# Internal Heading`
     * stays h1 (normalised it would be h4).
     */
    const files = {
      'index.md': '![[1.3.2 Magic.md]]',
      '1.3.2 Magic.md': 'Preamble text.\n\n# Internal Heading',
    };
    const result = compile(files, 'index.md', false);
    assert.match(result.content, /^### Magic\n+Preamble text\./m);
    assert.match(result.content, /^# Internal Heading$/m);
  });

  it('headingless unprefixed file gets the US-6.1 h2 heading when off', () => {
    /**
     * US-6.4 | AC-8 (OD-4): US-6.1 gives an unnumbered file `## Notes`, even
     * from the root where US-6.4 would give `# Notes`.
     */
    const files = {
      'index.md': '![[Notes.md]]',
      'Notes.md': 'Just notes.',
    };
    const result = compile(files, 'index.md', false);
    assert.match(result.content, /^## Notes\n+Just notes\./m);
  });
});

// ---------------------------------------------------------------------------
// AC-9: Nested preamble embeds — canonical example
// ---------------------------------------------------------------------------

describe('preamble injection: AC-9 nested preamble embeds use output heading level', () => {
  it('canonical example: 2.2.2 prefix preamble with nested no-prefix preamble', () => {
    /**
     * US-6.4 | AC-9: Nested preamble embeds use the output level of the last
     * heading as context for the next file's title.
     *
     * Expected output:
     *   ### Third-Level           (prefix depth 3 → title h3)
     *   Some text
     *   #### Heading              (source h1, title h3 → first internal h4)
     *   ##### Detailbit           (last output heading h4 → title h5)
     *   Some text inside
     *   Some more text inside
     *   ###### Heading inside Detail  (source h1, title h5 → first internal h6)
     *   last text
     *   Some more text
     */
    const files = {
      'index.md': '![[2.2.2 Third-Level.md]]',
      '2.2.2 Third-Level.md': 'Some text\n# Heading\n![[Detailbit.md]]\nSome more text',
      'Detailbit.md': 'Some text inside\nSome more text inside\n# Heading inside Detail\nlast text',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^### Third-Level/m);
    assert.match(result.content, /^#### Heading/m);
    assert.match(result.content, /^##### Detailbit/m);
    assert.match(result.content, /^###### Heading inside Detail/m);
    assert.match(result.content, /Some text inside/);
    assert.match(result.content, /last text/);
    assert.match(result.content, /Some more text/);
  });
});

// ---------------------------------------------------------------------------
// AC-10: Only ORIGINAL headings count — not headings from prior embeds
// ---------------------------------------------------------------------------

describe('preamble injection: AC-10 only original headings count', () => {
  it('headings introduced by a prior embed do not affect the next preamble title level', () => {
    /**
     * US-6.4 | AC-10: Only headings written literally in the embedding file
     * above the embed point count as "last original heading".  Headings that
     * arrive from a prior embed are excluded.
     *
     * index.md has no original headings; a prior embed of "1.2.3 Deep.md"
     * introduces headings h3 and h4 into the output, but those are "imported"
     * and must not raise the baseline for "Notes.md".
     * → Notes.md title defaults to h1 (no original heading in index.md).
     */
    const files = {
      'index.md': '![[1.2.3 Deep.md]]\n![[Notes.md]]',
      '1.2.3 Deep.md': '# Deep\n\n## Section',
      'Notes.md': 'Just notes.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^### Deep/m);    // Deep.md itself starts with heading → normal
    assert.match(result.content, /^# Notes/m);     // no original heading in index.md → h1
  });

  it('only the LAST original heading above the embed point is used', () => {
    /**
     * US-6.4 | AC-10: The most recent original heading wins, not the first.
     *
     * index.md has "# First" (h1) then "## Second" (h2) before the embed.
     * Last original heading = h2 → Notes title at h3.
     */
    const files = {
      'index.md': '# First\n\n## Second\n\n![[Notes.md]]',
      'Notes.md': 'Some notes.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^### Notes/m);
  });
});

// ---------------------------------------------------------------------------
// Title rule (decided 2026-10-27)
// ---------------------------------------------------------------------------

describe('preamble injection: title rule', () => {
  it('keeps hyphens and underscores and upper-cases only the first character', () => {
    /** US-6.4 | Title rule: `1.2 my-file_name.md` → `My-file_name`. */
    const result = compile({
      'index.md': '![[1.2 my-file_name.md]]',
      '1.2 my-file_name.md': 'text',
    }, 'index.md');
    assert.match(result.content, /^## My-file_name$/m);
  });

  it('does not title-case later words', () => {
    /** US-6.4 | Title rule: `The Songbook (music spells).md` stays as written. */
    const result = compile({
      'index.md': '![[The Songbook (music spells).md]]',
      'The Songbook (music spells).md': 'text',
    }, 'index.md');
    assert.match(result.content, /^# The Songbook \(music spells\)$/m);
  });
});
