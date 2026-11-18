/**
 * US-7.4 | AC-6 (G2, 2026-11-18): the UI change leaves the compiled book
 * unchanged (SCAR-040: Obsidian2Typst reads it). The whole fixture vault,
 * subfolders included, compiled from index2compile.md; the expected output was
 * written by 0.24.0 before any US-7.4 code (`basic-vault.compiled.expected.md`
 * and its warnings, `basic-vault.warnings.expected.json`).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

const FIXTURES = new URL('../fixtures/', import.meta.url).pathname;
const VAULT = join(FIXTURES, 'basic-vault');

/** Every file below the vault (hidden folders left out), Markdown with its text. */
export function loadWholeVault(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files[relative(root, full).replace(/\\/g, '/')] = entry.name.toLowerCase().endsWith('.md') ? readFileSync(full, 'utf8') : '';
    }
  };
  walk(root);
  return files;
}

describe('US-7.4 AC-6: the compiled book is unchanged', () => {
  it('the fixture vault compiles to the output of 0.24.0, byte for byte, with the same warnings', () => {
    const result = new InMemoryVaultCompiler(loadWholeVault(VAULT), { enableTextMapper: true, assetFolder: 'assets' }).compile('index2compile.md');
    assert.equal(result.content, readFileSync(join(FIXTURES, 'basic-vault.compiled.expected.md'), 'utf8'));
    assert.deepEqual(
      { warnings: result.warnings, warningDetails: result.warningDetails, stats: result.stats },
      JSON.parse(readFileSync(join(FIXTURES, 'basic-vault.warnings.expected.json'), 'utf8')),
    );
  });
});
