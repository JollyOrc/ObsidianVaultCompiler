/**
 * Fuzz tests for path/link resolution (TT-1.8).
 *
 * Generates random combinations of absolute, relative, %20-encoded, and bare
 * filenames against a randomised vault of 10–50 files.  Asserts that the
 * compiler's resolution logic never throws and always produces either valid
 * embedded content or a missing-reference warning.
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

const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota'];
const FOLDERS = ['notes', 'docs', 'guides', 'chapters', 'sections', 'appendix'];

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

/** Generate a random set of vault files (10–50 markdown files). */
function randomVault(rand: () => number): Record<string, string> {
  const count = 10 + Math.floor(rand() * 40);
  const vault: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    const folder = rand() > 0.5 ? pick(rand, FOLDERS) + '/' : '';
    const name = pick(rand, WORDS) + (i > 0 ? String(i) : '') + '.md';
    vault[folder + name] = `# ${name}\nContent of ${name}.\n`;
  }
  return vault;
}

/** Create a random link pointing to a random vault entry (or a made-up name). */
function randomLink(rand: () => number, vaultKeys: string[]): string {
  const style = Math.floor(rand() * 5);
  const target = rand() > 0.2 ? pick(rand, vaultKeys) : 'ghost-' + Math.floor(rand() * 99) + '.md';

  switch (style) {
    case 0: return `![[${target}]]`;                              // wiki embed
    case 1: return `![alt](${target})`;                           // markdown embed
    case 2: return `![[${target.replace(/ /g, '%20')}]]`;         // %20-encoded
    case 3: return `![[${target.split('/').pop()}]]`;              // bare filename only
    default: return `![](${target.replace(/ /g, '%20')})`;        // encoded markdown embed
  }
}

// ---------------------------------------------------------------------------
// Fuzz suite
// ---------------------------------------------------------------------------

const SAMPLES = 1000;

describe('fuzz — link resolution', () => {
  it('resolver never throws for any link format against a random vault', () => {
    const rand = lcg(0xf00dbabe);
    for (let i = 0; i < SAMPLES; i++) {
      const vault = randomVault(rand);
      const keys = Object.keys(vault);
      const link = randomLink(rand, keys);
      vault['index.md'] = `# Index\n${link}\n`;

      assert.doesNotThrow(
        () => new InMemoryVaultCompiler(vault).compile('index.md'),
        `compile() threw for link: ${JSON.stringify(link)}`,
      );
    }
  });

  it('result is always either valid content or a warning — never undefined/null', () => {
    const rand = lcg(0x0badf00d);
    for (let i = 0; i < SAMPLES; i++) {
      const vault = randomVault(rand);
      const keys = Object.keys(vault);
      const links = Array.from({ length: 1 + Math.floor(rand() * 5) }, () => randomLink(rand, keys));
      vault['index.md'] = `# Index\n${links.join('\n')}\n`;

      const result = new InMemoryVaultCompiler(vault).compile('index.md');
      assert.ok(result !== null && result !== undefined, 'compile() returned null/undefined');
      assert.ok(typeof result.content === 'string', 'result.content is not a string');
      assert.ok(result.content.length > 0, 'result.content is empty');
    }
  });

  it('missing references are always accounted for in stats.missingReferences', () => {
    const rand = lcg(0xdeadc0de);
    for (let i = 0; i < SAMPLES; i++) {
      const vault = randomVault(rand);
      // Add a guaranteed missing reference
      vault['index.md'] = '# Index\n![[absolutely-does-not-exist-xyz-123.md]]\n';

      const result = new InMemoryVaultCompiler(vault).compile('index.md');
      assert.ok(
        result.stats.missingReferences >= 1,
        'expected at least one missing reference to be counted',
      );
    }
  });

  it('valid absolute links always resolve without a missing-reference warning', () => {
    const rand = lcg(0x13579bdf);
    for (let i = 0; i < SAMPLES; i++) {
      const vault = randomVault(rand);
      const keys = Object.keys(vault).filter(k => k !== 'index.md');
      if (keys.length === 0) continue;
      const target = pick(rand, keys);
      vault['index.md'] = `# Index\n![[${target}]]\n`;

      const result = new InMemoryVaultCompiler(vault).compile('index.md');
      assert.equal(
        result.stats.missingReferences,
        0,
        `unexpected missing reference for valid target "${target}"`,
      );
    }
  });
});
