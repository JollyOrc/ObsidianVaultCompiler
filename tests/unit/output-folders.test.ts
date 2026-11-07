/**
 * Unit tests for US-3.1 "Output folder" (#109): which folders link
 * resolution ignores, and that `main.ts` passes them on (SCAR-031).
 * Moved out of `entry-settings.test.ts` on 2026-11-07, unchanged, so they
 * run before `entries.ts` exists.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { foldersToIgnore } from '../../plugin/src/output-location.ts';
import { inIgnoredFolder } from '../../plugin/src/compiler.ts';

describe('US-3.1 output folder: foldersToIgnore', () => {
  const vault = (folder: string) => ({ ok: true as const, location: { kind: 'vault' as const, folder, outputPath: '', assetsFolder: '' } });
  const outside = { ok: true as const, location: { kind: 'outside' as const, folder: '/Users/x/Out', outputPath: '', assetsFolder: '' } };

  it('settings Out, run Drafts → both', () => assert.deepEqual(foldersToIgnore([vault('Out'), vault('Drafts')]), ['Out', 'Drafts']));
  it('the same folder twice → once', () => assert.deepEqual(foldersToIgnore([vault('Out'), vault('Out')]), ['Out']));
  it('the vault root → nothing', () => assert.deepEqual(foldersToIgnore([vault('')]), []));
  it('outside the vault → nothing', () => assert.deepEqual(foldersToIgnore([outside]), []));
  it('a refused location → nothing', () => assert.deepEqual(foldersToIgnore([{ ok: false, reason: 'x' }]), []));
});

describe('US-3.1 output folder: whole path segments', () => {
  it('Out/x and Out are in Out; Outline/x is not', () => {
    assert.equal(inIgnoredFolder('Out/x.png', ['Out']), true);
    assert.equal(inIgnoredFolder('Out', ['Out']), true);
    assert.equal(inIgnoredFolder('Outline/x.png', ['Out']), false);
    assert.equal(inIgnoredFolder('x.png', []), false);
  });
});

describe('US-3.1 output folder: main.ts passes the folders on (SCAR-031)', () => {
  it('the output folders come from foldersToIgnore', () => {
    const src = readFileSync(new URL('../../plugin/src/main.ts', import.meta.url), 'utf8');
    assert.match(src, /ignoredFolders:\s*foldersToIgnore\(/);
  });
});
