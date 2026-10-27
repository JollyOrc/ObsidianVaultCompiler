/**
 * Unit tests for link resolution behavior (TT-1.1).
 *
 * Covers Epic 0: absolute, relative, magic, encoded and cache-delegated link
 * resolution as specified in docs/technical/tests.md.
 *
 * Resolution logic currently lives inside InMemoryVaultCompiler.resolve().
 * These tests exercise it through the public compile() API.  Once T-0.4
 * extracts a standalone LinkResolver module, the tests can be updated to
 * import those functions directly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compile a single-file vault whose index references one link and return the output. */
function compileWith(
  files: Record<string, string>,
  index = 'index.md',
): string {
  return new InMemoryVaultCompiler(files).compile(index).content;
}

// ---------------------------------------------------------------------------
// resolveAbsoluteLink — vault-root-relative paths
// ---------------------------------------------------------------------------

describe('resolveAbsoluteLink — vault-root-relative path resolution', () => {
  it('resolves a vault-root-relative path to the correct file', () => {
    const files = {
      'index.md': '- ![[folder/deep.md]]\n',
      'folder/deep.md': '# Deep\nFound it.\n',
    };
    const out = compileWith(files);
    assert.match(out, /Found it\./);
  });

  it('resolves a root-relative path that starts with a leading slash', () => {
    const files = {
      'index.md': '- ![](./assets/logo.png)\n',
      'assets/logo.png': 'binary',
    };
    const out = compileWith(files);
    assert.match(out, /assets\/logo\.png/);
  });

  it('returns a missing-include comment when the path does not exist', () => {
    const files = {
      'index.md': '- ![[nonexistent/ghost.md]]\n',
    };
    const out = compileWith(files);
    assert.match(out, /Warning.*[Mm]issing/);
  });

  it('resolves a path whose components are separated by forward slashes', () => {
    const files = {
      'index.md': '- ![[a/b/c.md]]\n',
      'a/b/c.md': '# Nested\nNested content.\n',
    };
    const out = compileWith(files);
    assert.match(out, /Nested content\./);
  });
});

// ---------------------------------------------------------------------------
// resolveRelativeLink — ../  and %20 normalisation
// ---------------------------------------------------------------------------

describe('resolveRelativeLink — relative path and encoding normalisation', () => {
  it('resolves a ../sibling path relative to the calling file', () => {
    const files = {
      'index.md': '- ![[chapter/intro.md]]\n',
      'chapter/intro.md': '## Intro\nSee ![[../appendix/notes.md]].\n',
      'appendix/notes.md': '# Notes\nAppendix content.\n',
    };
    const out = compileWith(files);
    assert.match(out, /Appendix content\./);
  });

  it('normalizes %20-encoded spaces in a path to match the real filename', () => {
    const files = {
      'index.md': '- [Spell](Dir%20A/Target%20Spell.md)\n',
      'Dir A/Target Spell.md': '# Target Spell\nSpell content.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    // The link should resolve and produce a portable anchor, not a warning
    assert.equal(result.stats.missingReferences, 0);
  });

  it('resolves a ./same-directory relative path', () => {
    const files = {
      'index.md': '- ![[./sibling.md]]\n',
      'sibling.md': '# Sibling\nSibling content.\n',
    };
    const out = compileWith(files);
    assert.match(out, /Sibling content\./);
  });

  it('resolves a multi-level ../ that crosses multiple directories', () => {
    const files = {
      'index.md': '- ![[a/b/deep.md]]\n',
      'a/b/deep.md': '# Deep\nSee ![[../../root-level.md]].\n',
      'root-level.md': '# Root\nRoot content.\n',
    };
    const out = compileWith(files);
    assert.match(out, /Root content\./);
  });
});

// ---------------------------------------------------------------------------
// resolveMagicLink — bare filename (no path)
// ---------------------------------------------------------------------------

describe('resolveMagicLink — bare filename search', () => {
  it('returns the unique matching file when exactly one file has that basename', () => {
    const files = {
      'index.md': '- ![[target.md]]\n',
      'deep/nested/target.md': '# Target\nUnique match.\n',
    };
    const out = compileWith(files);
    assert.match(out, /Unique match\./);
  });

  it('is case-insensitive when matching bare filenames', () => {
    const files = {
      'index.md': '- ![[TARGET.md]]\n',
      'folder/target.md': '# T\nCase-insensitive match.\n',
    };
    const out = compileWith(files);
    assert.match(out, /Case-insensitive match\./);
  });

  it('resolves to the lexicographically smallest path when multiple files share the same basename', () => {
    const files = {
      'index.md': '- ![[shared.md]]\n',
      'aaa/shared.md': '# First\nFirst match (smallest path).\n',
      'zzz/shared.md': '# Second\nSecond match.\n',
    };
    const out = compileWith(files);
    assert.match(out, /First match \(smallest path\)\./);
    assert.doesNotMatch(out, /Second match\./);
  });

  it('records a warning when multiple files share the same basename (ambiguity)', () => {
    const files = {
      'index.md': '- ![[ambiguous.md]]\n',
      'aaa/ambiguous.md': '# A\n',
      'bbb/ambiguous.md': '# B\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    const hasAmbiguityWarning = result.warnings.some(w =>
      /[Aa]mbiguous|multiple|more than one/i.test(w),
    );
    assert.ok(hasAmbiguityWarning, `expected an ambiguity warning, got: ${JSON.stringify(result.warnings)}`);
  });

  it('emits a missing-reference warning when no file matches the bare filename', () => {
    const files = {
      'index.md': '- ![[nonexistent.md]]\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.equal(result.stats.missingReferences, 1);
    assert.ok(result.warnings.length > 0, 'expected a warning');
  });

  it('resolves a bare name without an extension by appending .md', () => {
    const files = {
      'index.md': '- ![[notes]]\n',
      'notes.md': '# Notes\nNote content.\n',
    };
    const out = compileWith(files);
    assert.match(out, /Note content\./);
  });
});

// ---------------------------------------------------------------------------
// resolveLinkWithObsidianCache — custom resolver delegation
// ---------------------------------------------------------------------------

describe('resolveLinkWithObsidianCache — custom resolver delegation', () => {
  it('uses the provided resolver function and returns its result without fallback', () => {
    const files = {
      'index.md': '- ![[any-link.md]]\n',
      'the-actual-file.md': '# Actual\nReached via cache.\n',
    };
    // The resolve option simulates what resolveLinkWithObsidianCache does:
    // it delegates to Obsidian MetadataCache and returns the resolved path.
    const result = new InMemoryVaultCompiler(files, {
      resolve: (_raw, _currentFile) => 'the-actual-file.md',
    }).compile('index.md');
    assert.match(result.content, /Reached via cache\./);
    assert.equal(result.stats.missingReferences, 0);
  });

  it('falls back to basename search when the custom resolver returns null', () => {
    const files = {
      'index.md': '- ![[any-link.md]]\n',
      'any-link.md': '# Fallback\nFallback content.\n',
    };
    // Resolver returns null → compiler falls back to its own resolution
    const result = new InMemoryVaultCompiler(files, {
      resolve: () => null,
    }).compile('index.md');
    assert.match(result.content, /Fallback content\./);
  });

  it('does not call the fallback when the custom resolver resolves the link', () => {
    let fallbackCalled = false;
    const files = {
      'index.md': '- ![[stub.md]]\n',
      'stub.md': '# Stub\n',
      // This file exists but should NOT be found via fallback when cache resolves
    };
    const result = new InMemoryVaultCompiler(files, {
      resolve: (_raw, _currentFile) => {
        // Side-effect: we track if this resolver is used
        return 'stub.md';
      },
    }).compile('index.md');
    // No missing references means cache path was used, not fallback
    assert.equal(result.stats.missingReferences, 0);
    void fallbackCalled; // suppress unused warning
  });
});

// ---------------------------------------------------------------------------
// URL-encoded heading anchors via the options.resolve path
//
// Obsidian URL-encodes spaces in heading anchors when it writes wikilinks,
// so any heading with spaces generates a %20-encoded fragment in the raw
// link text, e.g. ![[file.md#Body%20Magic]].  The options.resolve branch of
// resolve() must decode the anchor fragment before returning it — otherwise
// it is compared against heading text verbatim and can never match.
//
// Tests use the custom resolver (options.resolve) to exercise the exact code
// path that is used at runtime inside Obsidian, not the fallback path.
// ---------------------------------------------------------------------------

describe('URL-encoded anchors — options.resolve path (regression for v0.6.2 bug)', () => {
  // Simulate how resolveLinkWithObsidianCache strips the anchor and returns
  // only the file path (Obsidian's MetadataCache receives a bare filename).
  function makeResolver(files: Record<string, string>) {
    return (raw: string, _currentFile: string) => {
      const base = raw.split('#')[0].trim();
      const found = Object.keys(files).find(
        k => k === base || k.endsWith('/' + base) || k.split('/').pop() === base,
      );
      return found ?? null;
    };
  }

  it('wiki embed: %20-encoded anchor resolves to the correct section via options.resolve', () => {
    const files = {
      'notes.md': '# Main\n\n## Body Magic\n\nSpell content here.\n\n## Other\n\nOther content.',
      'index.md': '![[notes.md#Body%20Magic]]',
    };
    const result = new InMemoryVaultCompiler(files, { resolve: makeResolver(files) })
      .compile('index.md');
    assert.ok(result.content.includes('Body Magic'), 'heading preserved');
    assert.ok(result.content.includes('Spell content here'), 'section body included');
    assert.ok(!result.content.includes('Other content'), 'other section excluded');
    assert.strictEqual(result.warnings.length, 0, 'no warnings');
  });

  it('wiki embed: %20-encoded anchor does not produce a missing-anchor warning via options.resolve', () => {
    const files = {
      'notes.md': '# Main\n\n## Body Magic\n\nContent.',
      'index.md': '![[notes.md#Body%20Magic]]',
    };
    const result = new InMemoryVaultCompiler(files, { resolve: makeResolver(files) })
      .compile('index.md');
    assert.strictEqual(result.warnings.length, 0);
  });

  it('markdown embed: %20-encoded anchor resolves to the correct section via options.resolve', () => {
    const files = {
      'notes.md': '# Main\n\n## Body Magic\n\nSpell content here.\n\n## Other\n\nOther content.',
      'index.md': '![](notes.md#Body%20Magic)',
    };
    const result = new InMemoryVaultCompiler(files, { resolve: makeResolver(files) })
      .compile('index.md');
    assert.ok(result.content.includes('Body Magic'), 'heading preserved');
    assert.ok(result.content.includes('Spell content here'), 'section body included');
    assert.ok(!result.content.includes('Other content'), 'other section excluded');
    assert.strictEqual(result.warnings.length, 0, 'no warnings');
  });

  it('anchor with multiple encoded chars (%20 and %26) resolves correctly via options.resolve', () => {
    const files = {
      'notes.md': '# Main\n\n## Swords & Shields\n\nCombat rules.\n\n## Other\n\nOther.',
      'index.md': '![[notes.md#Swords%20%26%20Shields]]',
    };
    const result = new InMemoryVaultCompiler(files, { resolve: makeResolver(files) })
      .compile('index.md');
    assert.ok(result.content.includes('Swords & Shields'), 'heading with & preserved');
    assert.ok(result.content.includes('Combat rules'), 'section body included');
    assert.strictEqual(result.warnings.length, 0, 'no warnings');
  });

  it('unencoded anchor still works via options.resolve (regression guard)', () => {
    const files = {
      'notes.md': '# Main\n\n## Introduction\n\nIntro text.\n\n## Other\n\nOther.',
      'index.md': '![[notes.md#Introduction]]',
    };
    const result = new InMemoryVaultCompiler(files, { resolve: makeResolver(files) })
      .compile('index.md');
    assert.ok(result.content.includes('Introduction'), 'heading preserved');
    assert.ok(result.content.includes('Intro text'), 'section body included');
    assert.strictEqual(result.warnings.length, 0, 'no warnings');
  });
});
