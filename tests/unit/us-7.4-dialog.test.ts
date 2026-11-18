/**
 * US-7.4 | AC-2 to AC-4 (G2, 2026-11-18): the compile dialog's rules — the red
 * and grey lines, the keys, what Compile saves. Written before the code.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const rules = () => import('../../plugin/src/compile-dialog-rules.ts');
const ok = (outputPath: string) =>
  ({ ok: true, location: { kind: 'vault', folder: '', outputPath, assetsFolder: 'assets' } }) as const;

describe('US-7.4 AC-2, AC-3: the lines under the destination', () => {
  it('a refused location shows its reason as the red line', async () => {
    const { destinationLine } = await rules();
    assert.deepEqual(destinationLine({ ok: false, reason: 'Output filename is empty.' }, null), {
      kind: 'refused',
      text: 'Output filename is empty.',
    });
  });

  it('a new file: "<path> will be written."', async () => {
    const { destinationLine } = await rules();
    assert.deepEqual(destinationLine(ok('Exports/compiledtext.md'), null), {
      kind: 'info',
      text: 'Exports/compiledtext.md will be written.',
    });
  });

  it('an existing file: its local modification time, YYYY-MM-DD HH:MM, and "will be replaced."', async () => {
    const { destinationLine } = await rules();
    assert.deepEqual(destinationLine(ok('Exports/compiledtext.md'), new Date(2026, 10, 17, 14, 2, 59)), {
      kind: 'info',
      text: 'Exports/compiledtext.md exists (from 2026-11-17 14:02) and will be replaced.',
    });
    // SCAR-019: single digits are padded; midnight and the first of January.
    assert.equal(
      destinationLine(ok('a.md'), new Date(2027, 0, 1, 0, 5)).text,
      'a.md exists (from 2027-01-01 00:05) and will be replaced.',
    );
  });
});

describe('US-7.4 AC-2: the keys', () => {
  const key = (k: string, extra: object = {}) => ({ key: k, isComposing: false, keyCode: k === 'Enter' ? 13 : 0, ...extra });
  it('Enter runs when Compile is enabled, does nothing when it is not', async () => {
    const { dialogKey } = await rules();
    assert.equal(dialogKey(key('Enter'), true), 'run');
    assert.equal(dialogKey(key('Enter'), false), 'none');
  });
  it('Enter while an input method composes does nothing (SCAR-013)', async () => {
    const { dialogKey } = await rules();
    assert.equal(dialogKey(key('Enter', { isComposing: true }), true), 'none');
    assert.equal(dialogKey(key('Enter', { keyCode: 229 }), true), 'none');
  });
  it('Escape cancels, enabled or not; other keys do nothing', async () => {
    const { dialogKey } = await rules();
    assert.equal(dialogKey(key('Escape'), true), 'cancel');
    assert.equal(dialogKey(key('Escape'), false), 'cancel');
    assert.equal(dialogKey(key('a'), true), 'none');
  });
});

describe('US-7.4 AC-4 (P1): what Compile saves', () => {
  const run = { startingFile: 'Chapter 2.md', outputFolder: 'Drafts', outputFile: 'compiledtext.md' };
  it('from the file menu: folder and filename, not the starting file', async () => {
    const { settingsAfterCompile } = await rules();
    assert.deepEqual(settingsAfterCompile(run, 'file-menu'), { outputFolder: 'Drafts', outputFile: 'compiledtext.md' });
  });
  it('from the ribbon or "Compile vault…": the starting file too', async () => {
    const { settingsAfterCompile } = await rules();
    assert.deepEqual(settingsAfterCompile(run, 'settings'), run);
  });
  it('the run is not changed (a copy is returned)', async () => {
    const { settingsAfterCompile } = await rules();
    const copy = { ...run };
    const saved = settingsAfterCompile(copy, 'settings');
    assert.notEqual(saved, copy);
    assert.deepEqual(copy, run);
  });
});
