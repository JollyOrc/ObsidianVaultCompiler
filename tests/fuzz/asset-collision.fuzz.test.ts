/**
 * Fuzz tests for asset collision handling (TT-1.8).
 *
 * Generates 50–200 random filenames where many share the same basename and
 * asserts that every output path is unique, no file is silently overwritten,
 * and all collision-suffix filenames follow the name_N.ext convention.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

// ---------------------------------------------------------------------------
// Pseudo-random helpers
// ---------------------------------------------------------------------------

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223;
    return (s >>> 0) / 2 ** 32;
  };
}

const BASE_NAMES = ['icon', 'photo', 'map', 'chart', 'logo'];
const EXTENSIONS = ['.png', '.jpg', '.svg', '.pdf', '.mp3'];
const FOLDERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

/** Generate a vault with many asset files sharing basenames across folders. */
function collisionVault(rand: () => number, assetCount: number): {
  files: Record<string, string>;
  assetRefs: string[];
} {
  const files: Record<string, string> = {};
  const assetRefs: string[] = [];

  for (let i = 0; i < assetCount; i++) {
    const folder = pick(rand, FOLDERS);
    const base = pick(rand, BASE_NAMES);
    const ext = pick(rand, EXTENSIONS);
    // Make many duplicates by not appending the index most of the time
    const unique = rand() < 0.6 ? '' : String(i);
    const sourcePath = `${folder}/${base}${unique}${ext}`;
    if (!files[sourcePath]) {
      files[sourcePath] = `binary-${i}`;
      assetRefs.push(sourcePath);
    }
  }

  // Build an index that references all assets
  const lines = assetRefs.map(p => `![x](${p})`);
  files['index.md'] = `# Index\n${lines.join('\n')}\n`;

  return { files, assetRefs };
}

/** Extract all assets/... paths from compiled output. */
function extractAssetPaths(content: string): string[] {
  return [...content.matchAll(/!\[[^\]]*\]\((assets\/[^)]+)\)/g)].map(m => m[1]);
}

// ---------------------------------------------------------------------------
// Fuzz suite
// ---------------------------------------------------------------------------

const SAMPLES = 50; // fewer samples since each run involves many assets

describe('fuzz — asset collision handling', () => {
  it('every output asset path is unique across a batch of colliding filenames', () => {
    const rand = lcg(0xc0ffee42);
    for (let i = 0; i < SAMPLES; i++) {
      const assetCount = 50 + Math.floor(rand() * 150);
      const { files } = collisionVault(rand, assetCount);

      assert.doesNotThrow(
        () => new InMemoryVaultCompiler(files).compile('index.md'),
        `compile() threw with ${assetCount} assets`,
      );

      const result = new InMemoryVaultCompiler(files).compile('index.md');
      const paths = extractAssetPaths(result.content);
      const uniquePaths = new Set(paths);

      // Each unique source must produce a unique output path
      assert.equal(
        uniquePaths.size,
        paths.length,
        `duplicate output paths detected in run ${i}: ${JSON.stringify([...paths].filter((p, idx) => paths.indexOf(p) !== idx))}`,
      );
    }
  });

  it('collision suffixes follow the name_N.ext convention (not name_01.ext)', () => {
    const rand = lcg(0x1337feed);
    for (let i = 0; i < SAMPLES; i++) {
      const assetCount = 20 + Math.floor(rand() * 80);
      const { files } = collisionVault(rand, assetCount);
      const result = new InMemoryVaultCompiler(files).compile('index.md');

      // Any collision suffix should match _<digits> not _0<digits>
      const withSuffix = extractAssetPaths(result.content).filter(p => /_\d+\./.test(p));
      for (const path of withSuffix) {
        assert.doesNotMatch(
          path,
          /_0\d+\./,
          `path uses zero-padded suffix: ${path}`,
        );
      }
    }
  });

  it('compile() does not throw for any number of colliding assets from 1 to 200', () => {
    const rand = lcg(0xfeedface);
    for (let count = 1; count <= 200; count += 5) {
      const { files } = collisionVault(rand, count);
      assert.doesNotThrow(
        () => new InMemoryVaultCompiler(files).compile('index.md'),
        `compile() threw with ${count} assets`,
      );
    }
  });

  it('stats.assetsCopied equals the number of distinct source paths', () => {
    const rand = lcg(0x42424242);
    for (let i = 0; i < SAMPLES; i++) {
      const assetCount = 10 + Math.floor(rand() * 40);
      const { files, assetRefs } = collisionVault(rand, assetCount);
      const distinctSources = new Set(assetRefs).size;
      const result = new InMemoryVaultCompiler(files).compile('index.md');
      assert.equal(
        result.stats.assetsCopied,
        distinctSources,
        `expected ${distinctSources} distinct copies, got ${result.stats.assetsCopied}`,
      );
    }
  });
});
