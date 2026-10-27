/**
 * Tests for pass-through embed (US-6.5).
 *
 * When normaliseHeadings is on, a file A whose content (after stripping all
 * whitespace) is exactly one embed — whole-file or anchor — is treated as a
 * "pass-through wrapper" when the embedded content starts with a heading:
 *
 *   – No filename-derived title is injected for A.
 *   – The embedded heading appears at the depth A's injected title would have
 *     occupied (A's assigned targetDepth), and subsequent headings shift
 *     accordingly.
 *   – Anchor embeds (![[B.md#Section]] or ![alt](B.md#anchor)) are also
 *     pass-throughs: the anchored section begins with its own heading by
 *     definition, so the heading-first check is trivially satisfied.
 *   – For whole-file embeds, if B is itself a pass-through to heading-starting
 *     C, the chain collapses recursively.
 *
 * The rule does NOT apply when:
 *   – A contains any non-whitespace content besides the single embed.
 *   – A contains two or more embed markers.
 *   – The target (whole-file embed) does not start with a heading.
 *   – normaliseHeadings is false.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function compile(
  files: Record<string, string>,
  entry: string,
  normalise = true,
) {
  return new InMemoryVaultCompiler(files, { normaliseHeadings: normalise }).compile(entry);
}

// ---------------------------------------------------------------------------
// AC-1 — Whitespace-only wrapper is a pass-through
// ---------------------------------------------------------------------------

describe('pass-through embed: AC-1 whitespace-only wrapper is a pass-through', () => {
  it('bare embed marker triggers pass-through', () => {
    /**
     * US-6.5 | AC-1: A.md contains only the embed marker — no other content.
     * B.md starts with a heading, so A is a pass-through.
     * Expected: B's heading at h1 (A's assigned depth), no "# A" title.
     */
    const files = {
      'index.md': '![[A.md]]',
      'A.md': '![[B.md]]',
      'B.md': '# Real Heading\nContent',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# B$/m);
    assert.doesNotMatch(result.content, /^# A/m);
  });

  it('embed marker surrounded by blank lines triggers pass-through', () => {
    /**
     * US-6.5 | AC-1: Whitespace-only surrounding content counts as no content.
     */
    const files = {
      'index.md': '![[A.md]]',
      'A.md': '\n\n![[B.md]]\n\n',
      'B.md': '# Real Heading\nContent',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# B$/m);
    assert.doesNotMatch(result.content, /^# A/m);
  });

  it('embed marker with mixed tabs and spaces triggers pass-through', () => {
    /**
     * US-6.5 | AC-1: Tabs, spaces, and newlines are all ignored.
     */
    const files = {
      'index.md': '![[A.md]]',
      'A.md': '   \t\n![[B.md]]\n\t   ',
      'B.md': '# Real Heading\nContent',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# B$/m);
    assert.doesNotMatch(result.content, /^# A/m);
  });

  it('markdown-link embed syntax also triggers pass-through', () => {
    /**
     * US-6.5 | AC-1: Both ![[B.md]] and ![alt](B.md) are valid embed markers.
     */
    const files = {
      'index.md': '![[A.md]]',
      'A.md': '![](B.md)',
      'B.md': '# Real Heading\nContent',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# B$/m);
    assert.doesNotMatch(result.content, /^# A/m);
  });
});

// ---------------------------------------------------------------------------
// AC-2 — File with own non-whitespace content is NOT a pass-through
// ---------------------------------------------------------------------------

describe('pass-through embed: AC-2 own content disqualifies pass-through', () => {
  it('file with text before embed gets preamble title, not pass-through', () => {
    /**
     * US-6.5 | AC-2: "Some intro text." disqualifies pass-through.
     * A is treated as a preamble file and gets a title; B normalises below.
     */
    const files = {
      'index.md': '![[A.md]]',
      'A.md': 'Some intro text.\n![[B.md]]',
      'B.md': '# B Heading\nContent',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# A/m);
    assert.match(result.content, /^## B$/m);
  });

  it('file with text after embed gets preamble title, not pass-through', () => {
    /**
     * US-6.5 | AC-2: Trailing text disqualifies pass-through.
     */
    const files = {
      'index.md': '![[A.md]]',
      'A.md': '![[B.md]]\nTrailing text.',
      'B.md': '# B Heading\nContent',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# A/m);
  });
});

// ---------------------------------------------------------------------------
// AC-3 — File with multiple embeds is NOT a pass-through
// ---------------------------------------------------------------------------

describe('pass-through embed: AC-3 multiple embeds disqualify pass-through', () => {
  it('file with two embeds gets preamble title and both targets normalised below', () => {
    /**
     * US-6.5 | AC-3: Two embed markers → not a pass-through.
     * A gets a preamble title; B and C are normalised at A's child depth.
     */
    const files = {
      'index.md': '![[A.md]]',
      'A.md': '![[B.md]]\n![[C.md]]',
      'B.md': '# B Heading',
      'C.md': '# C Heading',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# A/m);
    assert.match(result.content, /^## B$/m);
    assert.match(result.content, /^## C$/m);
  });
});

// ---------------------------------------------------------------------------
// AC-4 — Embed target is preamble-starting → NOT a pass-through
// ---------------------------------------------------------------------------

describe('pass-through embed: AC-4 preamble-starting target disqualifies pass-through', () => {
  it('single-embed file whose target is a preamble file gets its own title', () => {
    /**
     * US-6.5 | AC-4: B does not start with a heading (starts with text) →
     * A is not a pass-through.
     */
    const files = {
      'index.md': '![[A.md]]',
      'A.md': '![[B.md]]',
      'B.md': 'Not a heading.\n# Internal Heading',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# A/m);          // A gets preamble title
    assert.match(result.content, /^## B/m);         // B gets preamble title at h2
    assert.match(result.content, /^### Internal Heading/m); // B's internal heading shifts
  });
});

// ---------------------------------------------------------------------------
// AC-5 — Embed target is headingless → NOT a pass-through
// ---------------------------------------------------------------------------

describe('pass-through embed: AC-5 headingless target disqualifies pass-through', () => {
  it('single-embed file whose target is headingless gets its own title', () => {
    /**
     * US-6.5 | AC-5: B has no headings at all → A is not a pass-through.
     */
    const files = {
      'index.md': '![[A.md]]',
      'A.md': '![[B.md]]',
      'B.md': 'Just some text, no headings at all.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# A/m);
    assert.match(result.content, /^## B/m);
    assert.match(result.content, /Just some text/);
  });
});

// ---------------------------------------------------------------------------
// AC-6 — Anchor embed IS a pass-through
// ---------------------------------------------------------------------------

describe('pass-through embed: AC-6 anchor embed is a pass-through', () => {
  it('single wiki anchor embed suppresses A title and places section heading at targetDepth', () => {
    /**
     * US-6.5 | AC-6: ![[B.md#Section]] — A contains exactly one anchor embed.
     * The anchored section starts with its own heading by definition, so A
     * is a pass-through. No "# A" title is injected; the section heading
     * appears at A's targetDepth (h1 here).
     */
    const files = {
      'index.md': '![[A.md]]',
      'A.md': '![[B.md#Section]]',
      'B.md': '# Intro\n## Section\nContent',
    };
    const result = compile(files, 'index.md');
    assert.doesNotMatch(result.content, /^# A/m);
    assert.match(result.content, /^# Section/m);
    assert.match(result.content, /Content/);
  });

  it('AC-6b — markdown anchor embed syntax is also a pass-through', () => {
    /**
     * US-6.5 | AC-6b: ![Section Title](B.md#Section) — markdown-style anchor embed.
     * Same pass-through rules apply as for wiki-style.
     */
    const files = {
      'index.md': '![[A.md]]',
      'A.md': '![Section Title](B.md#Section)',
      'B.md': '# Intro\n## Section\nContent',
    };
    const result = compile(files, 'index.md');
    assert.doesNotMatch(result.content, /^# A/m);
    assert.match(result.content, /^# Section/m);
    assert.match(result.content, /Content/);
  });

  it('AC-6c — anchor embed with deep section heading normalises to targetDepth', () => {
    /**
     * US-6.5 | AC-6c: The anchored section's original heading level in B
     * (h3 here) is irrelevant — it is normalised to A's targetDepth (h1).
     */
    const files = {
      'index.md': '![[A.md]]',
      'A.md': '![[B.md#DeepSection]]',
      'B.md': '# Top\n## Middle\n### DeepSection\nContent',
    };
    const result = compile(files, 'index.md');
    assert.doesNotMatch(result.content, /^# A/m);
    assert.match(result.content, /^# DeepSection/m);
    assert.match(result.content, /Content/);
  });

  it('anchor embed at non-root depth places section heading at that depth', () => {
    /**
     * US-6.5 | AC-6 + US-6.3 AC-4 (OD-2): A.md is embedded below "## Chapter",
     * so the anchor section heading appears at h3 (was h2 before 2026-10-27).
     */
    const files = {
      'index.md': '# Book\n## Chapter\n![[A.md]]',
      'A.md': '![[B.md#Section]]',
      'B.md': '# Intro\n## Section\nContent',
    };
    const result = compile(files, 'index.md');
    assert.doesNotMatch(result.content, /^## A/m);
    assert.match(result.content, /^### Section$/m);
  });
});

// ---------------------------------------------------------------------------
// AC-7 — Prefix depth is preserved through pass-through
// ---------------------------------------------------------------------------

describe('pass-through embed: AC-7 prefix depth preserved through pass-through', () => {
  it('two-segment prefix pass-through places target heading at prefix depth h2', () => {
    /**
     * US-6.5 | AC-7: "2.3 Overview.md" has prefix depth 2 (two segments).
     * It is a pass-through wrapper to B (heading-first).
     * B's first heading must appear at h2, subsequent headings shifted accordingly.
     * No "## Overview" title is injected.
     */
    const files = {
      'index.md': '![[2.3 Overview.md]]',
      '2.3 Overview.md': '\n![[B.md]]\n',
      'B.md': '# My Heading\nSub content\n## Sub-section',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^## B$/m);
    assert.match(result.content, /^### Sub-section/m);
    assert.doesNotMatch(result.content, /^## Overview/m);
  });

  it('three-segment prefix pass-through places target heading at h3', () => {
    /**
     * US-6.5 | AC-7: "1.2.3 Deep.md" has prefix depth 3.
     * B's heading must appear at h3.
     */
    const files = {
      'index.md': '![[1.2.3 Deep.md]]',
      '1.2.3 Deep.md': '![[Target.md]]',
      'Target.md': '# Target Heading\n## Sub',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^### Target$/m);
    assert.match(result.content, /^#### Sub/m);
    assert.doesNotMatch(result.content, /^### Deep/m);
  });

  it('depth-1 prefix pass-through produces h1 for target heading', () => {
    /**
     * US-6.5 | AC-7: "1 Wrapper.md" has prefix depth 1.
     * B's heading must appear at h1.
     */
    const files = {
      'index.md': '![[1 Wrapper.md]]',
      '1 Wrapper.md': '![[Target.md]]',
      'Target.md': '# Target Heading\nBody',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# Target$/m);
    assert.doesNotMatch(result.content, /^# Wrapper/m);
  });
});

// ---------------------------------------------------------------------------
// AC-8 — Recursive chain A → B → C collapses correctly
// ---------------------------------------------------------------------------

describe('pass-through embed: AC-8 recursive pass-through chain', () => {
  it('A → B → C chain: C heading appears at A\'s assigned depth, no titles for A or B', () => {
    /**
     * US-6.5 | AC-8: A.md → B.md (whitespace + embed) → C.md (heading-first).
     * All three files chain. C's heading surfaces at A's depth (h1).
     */
    const files = {
      'index.md': '![[A.md]]',
      'A.md': '![[B.md]]',
      'B.md': '   ![[C.md]]   ',
      'C.md': '# Deep Heading\nContent\n## Sub',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# C$/m);
    assert.match(result.content, /^## Sub/m);
    assert.doesNotMatch(result.content, /^# A/m);
    assert.doesNotMatch(result.content, /^# B/m);
  });

  it('A → B → C chain with prefix: A\'s prefix depth governs C\'s heading level', () => {
    /**
     * US-6.5 | AC-8: "2.1 Chapter.md" (prefix depth 2) → B (pass-through) → C.
     * C's heading must appear at h2.
     */
    const files = {
      'index.md': '![[2.1 Chapter.md]]',
      '2.1 Chapter.md': '![[B.md]]',
      'B.md': '\n![[C.md]]\n',
      'C.md': '# Chapter Heading\n## Section',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^## C$/m);
    assert.match(result.content, /^### Section/m);
    assert.doesNotMatch(result.content, /^## Chapter$/m); // no "## Chapter" title from prefix file
  });

  it('chain stops when intermediate file has two embeds — A gets preamble title', () => {
    /**
     * US-6.5 | AC-8: A has two embeds → chain stops at A (A is NOT a pass-through).
     */
    const files = {
      'index.md': '![[A.md]]',
      'A.md': '![[B.md]]\n![[C.md]]',
      'B.md': '# B Heading',
      'C.md': '# C Heading',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# A/m);
    assert.match(result.content, /^## B$/m);
    assert.match(result.content, /^## C$/m);
  });

  it('chain stops when intermediate file has non-heading target', () => {
    /**
     * US-6.5 | AC-8: A → B (only embed of C), but C does not start with a heading.
     * A is not a pass-through.
     */
    const files = {
      'index.md': '![[A.md]]',
      'A.md': '![[B.md]]',
      'B.md': '![[C.md]]',
      'C.md': 'Preamble text, no heading.',
    };
    const result = compile(files, 'index.md');
    // A is not a pass-through (B's effective result is preamble)
    assert.match(result.content, /^# A/m);
  });
});

// ---------------------------------------------------------------------------
// AC-9 — Pass-through does not pollute lastOriginalHeadingLevel tracking
// ---------------------------------------------------------------------------

describe('pass-through embed: AC-9 pass-through result does not count as original heading', () => {
  it('heading from pass-through chain does not raise baseline for subsequent preamble title', () => {
    /**
     * US-6.5 | AC-9: index.md has one original heading "# Own Heading" (h1).
     * A.md is a pass-through to B.md (# B Heading → output h1).
     * NoPrefixPreamble.md follows next in index.md.
     * lastOriginalHeadingLevel is still 1 (from "# Own Heading"), not updated by
     * the pass-through output. So NoPrefixPreamble.md gets title at h2.
     */
    const files = {
      'index.md': '# Own Heading\n![[A.md]]\n![[NoPrefixPreamble.md]]',
      'A.md': '![[B.md]]',
      'B.md': '# B Heading',
      'NoPrefixPreamble.md': 'Preamble text.',
    };
    const result = compile(files, 'index.md');
    assert.match(result.content, /^# Own Heading/m);
    assert.match(result.content, /^## B$/m); // pass-through below "# Own Heading" (OD-2, OD-6)
    assert.match(result.content, /^## NoPrefixPreamble/m); // lastOriginalHeadingLevel=1 → title h2
  });
});

// ---------------------------------------------------------------------------
// AC-10 — No pass-through when normaliseHeadings is false
// ---------------------------------------------------------------------------

describe('pass-through embed: AC-10 pass-through disabled when normaliseHeadings is off', () => {
  it('single-embed wrapper gets US-6.1 headings when toggle is off', () => {
    /**
     * US-6.5 | AC-10 (OD-4): normaliseHeadings=false → no pass-through; US-6.1
     * gives A and B their own h2 filename headings, B's `# Real Heading` replaced.
     */
    const files = {
      'index.md': '![[A.md]]',
      'A.md': '![[B.md]]',
      'B.md': '# Real Heading\nContent',
    };
    const result = compile(files, 'index.md', false);
    assert.match(result.content, /^## A$/m);
    assert.match(result.content, /^## B$/m);
    assert.doesNotMatch(result.content, /Real Heading/);
  });
});

// ---------------------------------------------------------------------------
// What a pass-through shows (OD-6, 2026-10-27)
// ---------------------------------------------------------------------------

describe('pass-through embed: the target is shown as if embedded directly at the wrapper depth', () => {
  it('the target\'s own heading text is replaced by the target\'s title, not the wrapper\'s', () => {
    /** US-6.5 | AC-1 (OD-6): `# Real Heading` in B.md → `# B`; no `A`, no `Real Heading`. */
    const result = compile({
      'index.md': '![[A.md]]',
      'A.md': '![[B.md]]',
      'B.md': '# Real Heading\nContent',
    }, 'index.md');
    assert.match(result.content, /^# B$/m);
    assert.doesNotMatch(result.content, /Real Heading/);
    assert.doesNotMatch(result.content, /^#{1,6} A$/m);
  });

  it('a prefixed target takes the wrapper\'s depth, not its own prefix depth', () => {
    /** US-6.5 | "What the pass-through produces": `1 W.md` wraps `1.2.3 T.md` → `# T`. */
    const result = compile({
      'index.md': '![[1 W.md]]',
      '1 W.md': '![[1.2.3 T.md]]',
      '1.2.3 T.md': '# T head\n## T sub',
    }, 'index.md');
    assert.match(result.content, /^# T$/m);
    assert.match(result.content, /^## T sub$/m);
  });

  it('a link to the wrapper points at the heading the pass-through shows', () => {
    /** US-6.5 + US-2.3: the wrapper has no heading of its own, so its anchor is the target's. */
    const result = compile({
      'index.md': '![[A.md]]\n![[C.md]]',
      'A.md': '![[B.md]]',
      'B.md': '# Real Heading\nContent',
      'C.md': 'See [[A]].',
    }, 'index.md');
    assert.match(result.content, /\[B\]\(#b\)/);
    assert.match(result.content, /^# B$/m);
  });
});
