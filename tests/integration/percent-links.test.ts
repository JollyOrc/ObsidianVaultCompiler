/**
 * Tests for a `%` in links and embeds (US-3.1, #101).
 *
 * Expected values are the story's examples; every case aborted the whole
 * compilation in v0.18.0 ("URI malformed"). Written before the code.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';

/** US-3.1 | Compiles `body` under `# Book`, with notes and a picture named with `%`. */
function compile(body: string): CompileResult {
  return new InMemoryVaultCompiler({
    'index.md': `# Book\n\n${body}\n`,
    '50% off.md': '# Sale\n\nsale text\n',
    'Note.md': '# Note\n\n## 50% off\n\nnote text\n',
    '50%.png': 'binary',
  }, { enableTextMapper: true, assetFolder: 'assets' }).compile('index.md');
}

describe('US-3.1: a % that is not an escape is taken as written', () => {
  it('[[50% off]] finds 50% off.md', () => {
    const r = compile('![[50% off]]\n\nSee [[50% off]].');
    assert.match(r.content, /sale text/);
    assert.ok(r.content.includes('\nSee [50% off](#50%25%20off).\n'), r.content);
    assert.deepEqual(r.warningDetails, []);
  });

  it('[x](50%25%20off.md), a valid escape, finds the same note', () => {
    const r = compile('![[50% off]]\n\nSee [x](50%25%20off.md).');
    assert.ok(r.content.includes('\nSee [x](#50%25%20off).\n'), r.content);
    assert.deepEqual(r.warningDetails, []);
  });

  it('[x](50%%20off.md): a lone % before an escape finds the same note', () => {
    const r = compile('![[50% off]]\n\nSee [x](50%%20off.md).');
    assert.ok(r.content.includes('\nSee [x](#50%25%20off).\n'), r.content);
    assert.deepEqual(r.warningDetails, []);
  });

  it('[[Note#50% off]] finds the heading', () => {
    const r = compile('![[Note]]\n\nSee [[Note#50% off]].');
    assert.ok(r.content.includes('\nSee [50% off](#50%25%20off).\n'), r.content);
    assert.deepEqual(r.warningDetails, []);
  });

  it('![x](50%.png) is copied', () => {
    const r = compile('![x](50%.png)');
    // The copy's name follows US-2.5 (`50%.png` → `50.png`).
    assert.ok(r.content.includes('![x](assets/50.png)'), r.content);
    assert.equal(r.stats.assetsCopied, 1);
    assert.deepEqual(r.warningDetails, []);
  });

  it('a missing note with % is reported, not a crash', () => {
    const r = compile('See [[90% gone]].');
    assert.deepEqual(r.warningDetails.map(d => d.link), ['90% gone']);
  });
});

describe('US-3.1: one decode function (SCAR-017)', () => {
  it('no decodeURIComponent outside utils.ts', () => {
    const dir = new URL('../../plugin/src/', import.meta.url).pathname;
    for (const name of readdirSync(dir).filter(n => n.endsWith('.ts') && n !== 'utils.ts')) {
      assert.doesNotMatch(readFileSync(join(dir, name), 'utf8'), /decodeURIComponent/, name);
    }
  });
});
