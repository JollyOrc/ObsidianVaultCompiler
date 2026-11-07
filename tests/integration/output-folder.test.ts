/**
 * Tests for US-3.1 "Output folder" and US-0.4 (2026-11-07, #108): files in
 * the output folder don't exist for link resolution.
 *
 * Written before the code (G2, 2026-11-07): red until it exists.
 * Option: `ignoredFolders` (vault-relative output folders; from
 * `foldersToIgnore`, tests/unit/entry-settings.test.ts).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';

function compile(body: string, files: Record<string, string>, options: Record<string, unknown> = {}): CompileResult {
  return new InMemoryVaultCompiler({ 'index.md': `# Index\n\n${body}\n`, ...files },
    { ignoredFolders: ['Out'], ...options }).compile('index.md');
}

const body = (r: CompileResult) => r.content.replace(/^# Index\n/, '').trim();
const messages = (r: CompileResult) => r.warningDetails.map(w => w.message);

describe('US-3.1 output folder: ignored for link resolution', () => {
  it('a copy in Out/assets is not a second candidate', () => {
    const r = compile('![[hare.png]]', { 'images/hare.png': 'b', 'Out/assets/hare.png': 'b' });
    assert.equal(body(r), '![](assets/hare.png)');
    assert.deepEqual(r.warningDetails, []);
  });

  it('the source copied is images/hare.png, not the output copy', () => {
    const c = new InMemoryVaultCompiler({ 'index.md': '# Index\n\n![[hare.png]]\n', 'images/hare.png': 'b', 'Out/assets/hare.png': 'b' }, { ignoredFolders: ['Out'] });
    c.compile('index.md');
    assert.deepEqual([...c.sourceToAssetMap.keys()], ['images/hare.png']);
  });

  it('only in Out/assets → Missing include', () => {
    const r = compile('![[hare.png]]', { 'Out/assets/hare.png': 'b' });
    assert.deepEqual(messages(r), ['Missing include']);
  });

  it('a full path into Out → missing too', () => {
    const r = compile('![[Out/assets/hare.png]]', { 'Out/assets/hare.png': 'b' });
    assert.deepEqual(messages(r), ['Missing include']);
  });

  it('a compiled note in Out → missing', () => {
    const r = compile('![[compiledtext]]', { 'Out/compiledtext.md': 'Old book.' });
    assert.doesNotMatch(r.content, /Old book/);
    assert.deepEqual(messages(r), ['Missing include']);
  });

  it('subfolders: Out/Run/assets/x.png → ignored', () => {
    const r = compile('![[x.png]]', { 'Out/Run/assets/x.png': 'b' });
    assert.deepEqual(messages(r), ['Missing include']);
  });

  it('whole segments: Outline/x.png is not in Out', () => {
    const r = compile('![[x.png]]', { 'Outline/x.png': 'b' });
    assert.equal(body(r), '![](assets/x.png)');
  });

  it('two folders (settings and this run) → both ignored', () => {
    const r = compile('![[a.png]]\n\n![[b.png]]', { 'Out/a.png': 'b', 'Drafts/b.png': 'b' }, { ignoredFolders: ['Out', 'Drafts'] });
    assert.deepEqual(messages(r), ['Missing include', 'Missing include']);
  });

  it('[] → nothing ignored, output as today', () => {
    const r = compile('![[hare.png]]', { 'Out/assets/hare.png': 'b' }, { ignoredFolders: [] });
    assert.equal(body(r), '![](assets/hare.png)');
  });

  it('Obsidian\'s lookup returns a file in Out → the other file is used', () => {
    const c = new InMemoryVaultCompiler({ 'index.md': '# Index\n\n![[hare.png]]\n', 'images/hare.png': 'b', 'Out/assets/hare.png': 'b' },
      { ignoredFolders: ['Out'], resolve: () => 'Out/assets/hare.png' });
    const r = c.compile('index.md');
    assert.equal(body(r), '![](assets/hare.png)');
    assert.deepEqual(r.warningDetails, []);
    // Both files are named hare.png: only the copied source tells them apart (SCAR-023).
    assert.deepEqual([...c.sourceToAssetMap.keys()], ['images/hare.png']);
  });
});
