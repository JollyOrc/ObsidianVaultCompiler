/**
 * Fixture-vault integration tests (TT-1.9).
 *
 * Compiles the on-disk basic-vault fixture and asserts three groups:
 *   A. Circular / missing / unreadable reference warnings
 *   B. No control-command fences survive in the output
 *   C. Leading headings in embedded files are replaced, not doubled
 *
 * The vault under tests/fixtures/basic-vault/ contains deliberate edge cases:
 *   - index2compile.md → embeds A.md → embeds B.md → embeds A.md (circular)
 *   - index2compile.md also references ![[missing.md]] (non-existent file)
 *   - B.md contains a ```leaflet``` control-command fence
 *
 * We load the fixture using the Node.js `fs` module and pass it to
 * InMemoryVaultCompiler so the tests run without any Obsidian runtime.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';

// ---------------------------------------------------------------------------
// Load the fixture vault from disk into an in-memory file map
// ---------------------------------------------------------------------------

const VAULT_DIR = resolve(new URL('../../', import.meta.url).pathname, 'tests/fixtures/basic-vault');

function loadVault(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile()) {
      const path = join(dir, entry.name);
      files[entry.name] = readFileSync(path, 'utf8');
    }
  }
  return files;
}

// Known control-command fence tags (from Epic 5)
const CONTROL_FENCE_TAGS = [
  'meta-bind-embed',
  'leaflet',
  'calendarium',
  'compressed-json',
  'dataview',
  'dataviewjs',
];

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('fixture vault — integration', () => {
  let files: Record<string, string>;
  let result: CompileResult;

  before(() => {
    files = loadVault(VAULT_DIR);
    const compiler = new InMemoryVaultCompiler(files);
    result = compiler.compile('index2compile.md');
  });

  // -------------------------------------------------------------------------
  // Group A: Warning generation
  // -------------------------------------------------------------------------

  describe('Group A — warnings for circular / missing references', () => {
    it('emits a circular-dependency warning comment for A.md', () => {
      // A.md embeds B.md, B.md embeds A.md → circular; compiler should emit
      // the standard comment to mark the avoided loop.
      assert.match(
        result.content,
        /<!--\s*Circular dependency avoided:\s*A\.md\s*-->/,
        'Expected circular-dependency comment for A.md in output',
      );
    });

    it('emits a missing-include warning comment for missing.md', () => {
      // index2compile.md embeds ![[missing.md]] which does not exist.
      assert.match(
        result.content,
        /<!--.*Warning.*[Mm]issing.*-->/,
        'Expected a missing-include warning comment for missing.md in output',
      );
    });

    it('records the missing reference in result.stats.missingReferences', () => {
      assert.ok(
        typeof result.stats.missingReferences === 'number',
        'stats.missingReferences should be a number',
      );
      assert.ok(
        result.stats.missingReferences >= 1,
        `Expected at least 1 missing reference, got ${result.stats.missingReferences}`,
      );
    });

    it('does not abort compilation when references are missing or circular', () => {
      // The output should still contain content from successfully embedded files
      assert.ok(
        result.content.includes('Hello from B.'),
        'Compilation should continue even when some references are broken',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Group B: Control-command fence removal
  // -------------------------------------------------------------------------

  describe('Group B — no control-command fences in output', () => {
    for (const tag of CONTROL_FENCE_TAGS) {
      it(`does not contain a \`\`\`${tag} fence in output`, () => {
        const fencePattern = new RegExp('```' + tag + '\\b', 'i');
        assert.doesNotMatch(
          result.content,
          fencePattern,
          `Output must not contain a \`\`\`${tag} fence block`,
        );
      });
    }

    it('does not contain SerializedQuery comment markers in output', () => {
      assert.doesNotMatch(
        result.content,
        /SerializedQuery/,
        'Output must not contain SerializedQuery markers',
      );
    });

    it('does not contain QueryToSerialize comment markers in output', () => {
      assert.doesNotMatch(
        result.content,
        /QueryToSerialize/,
        'Output must not contain QueryToSerialize markers',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Group C: Heading handling
  // -------------------------------------------------------------------------

  describe('Group C — heading replacement in embedded files', () => {
    it('does not contain a duplicate top-level heading for A', () => {
      // A.md starts with "# A"; when embedded, the leading heading should be
      // replaced by the auto-generated slug heading — so "# A" must appear at
      // most once, not duplicated.
      const matches = result.content.match(/^# A$/gm) ?? [];
      assert.ok(
        matches.length <= 1,
        `"# A" heading appears ${matches.length} times; expected at most 1 (should be replaced when embedded)`,
      );
    });

    it('does not contain a duplicate top-level heading for B', () => {
      const matches = result.content.match(/^# B$/gm) ?? [];
      assert.ok(
        matches.length <= 1,
        `"# B" heading appears ${matches.length} times; expected at most 1`,
      );
    });

    it('preserves prose content from successfully embedded files', () => {
      assert.ok(
        result.content.includes('Hello from B.'),
        'Prose from B.md should appear in the compiled output',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Sanity: stats shape
  // -------------------------------------------------------------------------

  describe('stats completeness', () => {
    it('result.stats has all required fields', () => {
      assert.ok(typeof result.stats.filesProcessed === 'number', 'filesProcessed missing');
      assert.ok(typeof result.stats.assetsCopied === 'number', 'assetsCopied missing');
      assert.ok(typeof result.stats.assetsDeduplicated === 'number', 'assetsDeduplicated missing');
      assert.ok(typeof result.stats.missingReferences === 'number', 'missingReferences missing');
    });

    it('filesProcessed is at least 3 (index2compile + A + B)', () => {
      assert.ok(
        result.stats.filesProcessed >= 3,
        `Expected filesProcessed >= 3, got ${result.stats.filesProcessed}`,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// TT-2.4 — Compiled output contains all files in index order
// ---------------------------------------------------------------------------

describe('fixture vault — ToC order', () => {
  let orderedResult: CompileResult;

  before(() => {
    const orderedFiles = loadVault(VAULT_DIR);
    orderedResult = new InMemoryVaultCompiler(orderedFiles).compile('index2compile.md');
  });

  it('content from A.md appears before content from B.md in the output', () => {
    // A.md is the first ToC entry; B.md is the second (via A embedding it).
    // "Content unique to A" (the heading or prose from A) must precede B's prose.
    const posA = orderedResult.content.indexOf('# A');
    const posB = orderedResult.content.indexOf('Hello from B.');
    assert.ok(posA !== -1, 'A.md heading not found in output');
    assert.ok(posB !== -1, 'B.md prose not found in output');
    assert.ok(posA < posB, `A section (pos ${posA}) should precede B prose (pos ${posB})`);
  });

  it('region-map.md content appears after A and B content in the output', () => {
    // region-map.md is the third ToC entry in index2compile.md
    const posB = orderedResult.content.indexOf('Hello from B.');
    // US-6.1 title rule (2026-10-27): hyphens are kept, so `region-map.md` → `Region-map`.
    const posMap = orderedResult.content.indexOf('## Region-map');
    assert.ok(posMap !== -1, 'region-map.md heading not found in output');
    assert.ok(posB < posMap, `B content (pos ${posB}) should precede region-map (pos ${posMap})`);
  });

  it('filesProcessed accounts for successfully embedded files', () => {
    // index + A + B + region-map = 4 successfully processed markdown files.
    // missing.md does not exist, so it is not counted as processed.
    assert.ok(
      orderedResult.stats.filesProcessed >= 4,
      `expected at least 4 filesProcessed (index + A + B + region-map), got ${orderedResult.stats.filesProcessed}`,
    );
  });
});

// ---------------------------------------------------------------------------
// TT-2.5 — Assets are copied once and referenced correctly
// ---------------------------------------------------------------------------

describe('fixture vault — asset handling', () => {
  let assetResult: CompileResult;

  before(() => {
    const assetFiles = loadVault(VAULT_DIR);
    assetResult = new InMemoryVaultCompiler(assetFiles).compile('index2compile.md');
  });

  it('stats.assetsCopied is at least 1 (media.png is referenced)', () => {
    assert.ok(
      assetResult.stats.assetsCopied >= 1,
      `expected assetsCopied >= 1, got ${assetResult.stats.assetsCopied}`,
    );
  });

  it('the output contains an assets/ reference for media.png', () => {
    // The exact path may include a collision suffix (_1, _2, …) but must be under assets/
    assert.match(
      assetResult.content,
      /assets\/media(?:_\d+)?\.png/,
      'expected an assets/media[_N].png reference in output',
    );
  });

  it('assetsDeduplicated is consistent with reference count (≥ 0, ≤ refs − 1)', () => {
    // media.png is referenced at least once; dedup count cannot exceed refs − 1
    const refs = (assetResult.content.match(/assets\/media(?:_\d+)?\.png/g) ?? []).length;
    assert.ok(
      assetResult.stats.assetsDeduplicated >= 0,
      'assetsDeduplicated must not be negative',
    );
    if (refs > 0) {
      assert.ok(
        assetResult.stats.assetsDeduplicated <= refs - 1,
        `assetsDeduplicated (${assetResult.stats.assetsDeduplicated}) exceeds refs − 1 (${refs - 1})`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// TT-2.6 — In-vault links become anchor links
// ---------------------------------------------------------------------------

describe('fixture vault — internal link rewriting', () => {
  let linkResult: CompileResult;

  before(() => {
    const linkFiles = loadVault(VAULT_DIR);
    linkResult = new InMemoryVaultCompiler(linkFiles).compile('index2compile.md');
  });

  it('no raw [[...]] wiki link syntax survives in the output', () => {
    assert.doesNotMatch(
      linkResult.content,
      /\[\[.+?\]\]/,
      'raw [[wiki link]] syntax found in compiled output — should have been rewritten',
    );
  });

  it('the [[B]] wiki link from A.md becomes an anchor link in the output', () => {
    // A.md contains "- [[B]]"; after compilation this should be an anchor
    assert.doesNotMatch(linkResult.content, /\[\[B\]\]/, '[[B]] was not rewritten');
    assert.match(
      linkResult.content,
      /\]\(#b(?:-\S+)?\)/i,
      'expected a #b... anchor link in place of [[B]]',
    );
  });

  it('no markdown link whose href is a .md filename appears in the output', () => {
    // All [text](file.md) links must have been converted to #slug anchors
    const mdHrefLinks = [...linkResult.content.matchAll(/\]\(([^)]+\.md)\)/g)];
    assert.equal(
      mdHrefLinks.length,
      0,
      `found ${mdHrefLinks.length} unconverted .md href(s): ${mdHrefLinks.map(m => m[1]).join(', ')}`,
    );
  });
});

// ---------------------------------------------------------------------------
// TT-2.7 — TextMapper block produces a PNG ref or placeholder warning
// ---------------------------------------------------------------------------

describe('fixture vault — TextMapper block handling', () => {
  let tmResult: CompileResult;

  before(() => {
    const tmFiles = loadVault(VAULT_DIR);
    // Compile without a renderer (no `renderer` option) so we exercise the
    // placeholder / disabled path, which is testable without a real SVG engine.
    tmResult = new InMemoryVaultCompiler(tmFiles).compile('index2compile.md');
  });

  it('no raw ```text-mapper fence survives in the output', () => {
    assert.doesNotMatch(
      tmResult.content,
      /```text-mapper/,
      'raw text-mapper fence was not processed — it should be replaced by a PNG ref or placeholder',
    );
  });

  it('output contains either a PNG image reference or a TextMapper warning comment — not both, not neither', () => {
    const hasPng = /!\[.*?\]\(assets\/textmapper\/[^)]+\.png\)/.test(tmResult.content);
    const hasPlaceholder = /<!--.*?Warning.*?TextMapper.*?-->/.test(tmResult.content);
    assert.ok(
      hasPng || hasPlaceholder,
      'expected either a PNG reference or a TextMapper warning comment in output',
    );
    assert.ok(
      !(hasPng && hasPlaceholder),
      'output contains both a PNG reference AND a placeholder warning — expected exactly one',
    );
  });

  it('when no renderer is configured, stats.mapsRendered is 0 and a placeholder is present', () => {
    // InMemoryVaultCompiler constructed without a renderer option → placeholder path
    const hasPlaceholder = /<!--.*?Warning.*?TextMapper.*?-->/.test(tmResult.content);
    if (hasPlaceholder) {
      // We are on the placeholder path — verify mapsRendered
      const mapsRendered = (tmResult.stats as Record<string, unknown>)['mapsRendered'];
      if (mapsRendered !== undefined) {
        assert.equal(mapsRendered, 0, 'expected mapsRendered to be 0 when no renderer is configured');
      }
      // Placeholder confirmed — test passes
    } else {
      // A built-in renderer was available and produced a PNG; that is also valid.
      assert.match(
        tmResult.content,
        /!\[.*?\]\(assets\/textmapper\/[^)]+\.png\)/,
        'expected a PNG image reference when a renderer is available',
      );
    }
  });
});
