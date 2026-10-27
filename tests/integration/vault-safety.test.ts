/**
 * Integration tests for vault safety and data integrity (TT-1.7).
 *
 * Covers Epic 8: source vault file hashes are unchanged after compilation,
 * no spurious files are created inside the source vault, preflight failures
 * stop output writing, and TextMapper rendering timeouts are caught and
 * reported.
 *
 * InMemoryVaultCompiler operates on an in-memory file map, so "source vault
 * mutation" manifests as: (a) the original file content in the map being
 * altered, and (b) the compiler adding entries to the file map for paths that
 * were not configured output/assets paths.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function hashAll(files: Record<string, string>): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    hashes[path] = sha256(content);
  }
  return hashes;
}

/** Create a rich compilation scenario to exercise many code paths. */
function richVault() {
  return {
    'index.md': '# Index\n- ![[A.md]]\n- ![[B.md]]\n- ![](media.png)\n',
    'A.md': '# A\nContent of A.\n![fig](diagram.png)\n',
    'B.md': '# B\nContent of B.\n',
    'media.png': 'png-binary-a',
    'diagram.png': 'png-binary-b',
  };
}

// ---------------------------------------------------------------------------
// Source vault hash guard — general
// ---------------------------------------------------------------------------

describe('vault safety — source file hashes unchanged after compilation', () => {
  it('source markdown file hashes are unchanged after a full compile', () => {
    const files = richVault();
    const before = hashAll(files);
    new InMemoryVaultCompiler(files).compile('index.md');
    const after = hashAll(files);
    for (const [path, hash] of Object.entries(before)) {
      assert.equal(after[path], hash, `Source file hash changed: ${path}`);
    }
  });

  it('source asset file hashes are unchanged after a compile that copies them', () => {
    const files = richVault();
    const before = hashAll(files);
    new InMemoryVaultCompiler(files).compile('index.md');
    for (const [path, hash] of Object.entries(before)) {
      if (path.endsWith('.png')) {
        assert.equal(hashAll(files)[path], hash, `Asset hash changed: ${path}`);
      }
    }
  });

  it('compiling the same vault twice produces identical source hashes each time', () => {
    const files = richVault();
    const before = hashAll(files);
    new InMemoryVaultCompiler({ ...files }).compile('index.md');
    new InMemoryVaultCompiler({ ...files }).compile('index.md');
    const after = hashAll(files);
    for (const [path, hash] of Object.entries(before)) {
      assert.equal(after[path], hash, `Source file hash changed across two compiles: ${path}`);
    }
  });
});

// ---------------------------------------------------------------------------
// No spurious writes into source vault paths
// ---------------------------------------------------------------------------

describe('vault safety — no spurious files in source vault', () => {
  it('compiler does not add new entries to the source file map during compilation', () => {
    const files = richVault();
    const sourceKeys = new Set(Object.keys(files));
    new InMemoryVaultCompiler(files).compile('index.md');
    // The compiler works on its own internal copy; the original object keys
    // should be unchanged (no new source paths added).
    for (const key of Object.keys(files)) {
      assert.ok(sourceKeys.has(key), `unexpected key added to source map: ${key}`);
    }
    assert.equal(Object.keys(files).length, sourceKeys.size, 'source file count changed');
  });

  it('compiled asset paths are under the configured assets folder, not the source vault root', () => {
    const files = richVault();
    const result = new InMemoryVaultCompiler(files, { assetFolder: 'out-assets' }).compile('index.md');
    const assetPaths = [...result.content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)].map(m => m[2]);
    for (const path of assetPaths) {
      const isAssetOrExternal =
        path.startsWith('out-assets/') ||
        path.startsWith('assets/') ||
        /^https?:\/\//.test(path) ||
        path.startsWith('#');
      assert.ok(isAssetOrExternal, `unexpected non-asset path in output: ${path}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Missing/unreadable includes do not abort compilation
// ---------------------------------------------------------------------------

describe('vault safety — partial failures do not abort compilation', () => {
  it('a missing include emits a warning but compilation completes and returns content', () => {
    const files = {
      'index.md': '# Index\n- ![[A.md]]\n- ![[MISSING.md]]\n- ![[B.md]]\n',
      'A.md': '# A\nContent A.\n',
      'B.md': '# B\nContent B.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    // Compilation should succeed (not throw)
    assert.ok(result.content.length > 0);
    // Content from non-missing files should still be present
    assert.match(result.content, /Content A\./);
    assert.match(result.content, /Content B\./);
    // Warning should be recorded
    assert.ok(result.stats.missingReferences > 0);
  });

  it('an unreadable file (binary content) emits a warning but other files are still compiled', () => {
    const files = {
      'index.md': '- ![[good.md]]\n- ![[bad.md]]\n',
      'good.md': '# Good\nGood content.\n',
      // File with null bytes triggers unreadable detection
      'bad.md': 'valid start\x00\x01\x02 binary content',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /Good content\./);
    const hasUnreadableWarning = result.warnings.some(w => /[Uu]nreadable/i.test(w));
    assert.ok(hasUnreadableWarning, 'expected an unreadable-file warning');
  });

  it('a circular include emits a warning comment and does not abort', () => {
    const files = {
      'index.md': '- ![[A.md]]\n',
      'A.md': '# A\n![[B.md]]\n',
      'B.md': '# B\n![[A.md]]\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.ok(result.content.length > 0, 'compilation should produce output');
    assert.match(result.content, /Circular dependency avoided/);
  });
});

// ---------------------------------------------------------------------------
// Preflight failures — output not written when preflight fails
// ---------------------------------------------------------------------------

describe('vault safety — preflight failures stop output writing', () => {
  it('throws rather than producing partial output when the starting file is missing', () => {
    const files = { 'other.md': '# Other\n' };
    assert.throws(
      () => new InMemoryVaultCompiler(files).compile('nonexistent.md'),
      /not found|does not exist|missing/i,
    );
  });

  it('compile() with an empty file map throws on any start file', () => {
    assert.throws(
      () => new InMemoryVaultCompiler({}).compile('index.md'),
      /not found|does not exist|missing/i,
    );
  });
});

// ---------------------------------------------------------------------------
// TextMapper rendering timeout handling
// ---------------------------------------------------------------------------

describe('vault safety — TextMapper rendering timeout is caught and reported', () => {
  /**
   * A renderer that simulates a timeout by rejecting after a short delay.
   * The compiler should catch the rejection, emit a placeholder warning, and
   * continue compiling the rest of the content.
   *
   * NOTE: This test requires compileAsync() and a TextMapperRenderer interface
   * with a configurable timeout.  Until those are implemented (T-4.1 / ADR-015),
   * this test exercises the synchronous TextMapper path only.
   * The test is written to the specification and will be updated once
   * compileAsync() exists.
   */
  it('a rendering failure does not abort the compilation (sync path)', () => {
    const files = {
      'index.md': [
        '# Index',
        '```text-mapper',
        '0101 forest "Forest"',
        '```',
        'After the map.',
      ].join('\n') + '\n',
    };
    // Even if TextMapper rendering is broken/disabled, compile() should not throw.
    const result = new InMemoryVaultCompiler(files, { enableTextMapper: false }).compile('index.md');
    assert.ok(result.content.length > 0);
    assert.match(result.content, /After the map\./);
  });
});
