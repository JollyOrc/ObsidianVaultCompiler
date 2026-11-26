/**
 * US-7.5 AC-1, AC-2, AC-3 (target part), AC-8: reading the starting note's
 * `compile-folder`, `compile-file`, `typst-preset`, and which target a compile
 * uses. Pure modules, no Obsidian. Invented note names only.
 * SCAR-019: each key alone, both, none, empty, wrong type.
 * SCAR-033: every refusal reason of the settings also applies to the property.
 * Red until US-7.5 is implemented (G2, 2026-11-26).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOutputLocation } from '../../plugin/src/output-location.ts';
import { STRINGS } from '../../plugin/src/strings.ts';

const target = () => import('../../plugin/src/note-target.ts');
const rules = () => import('../../plugin/src/compile-dialog-rules.ts');

const SETTINGS = { outputFolder: 'Exports', outputFile: 'Book.md' };

describe('US-7.5 AC-1: readNoteTarget', () => {
  it('no frontmatter (null): nothing set, no problems', async () => {
    const { readNoteTarget } = await target();
    assert.deepEqual(readNoteTarget(null), { problems: [] });
  });
  it('compile-folder alone', async () => {
    const { readNoteTarget } = await target();
    const r = readNoteTarget('compile-folder: Sheets');
    assert.equal(r.folder, 'Sheets');
    assert.equal(r.file, undefined);
    assert.equal(r.preset, undefined);
    assert.deepEqual(r.problems, []);
  });
  it('compile-file alone', async () => {
    const { readNoteTarget } = await target();
    const r = readNoteTarget('compile-file: Keep.md');
    assert.equal(r.file, 'Keep.md');
    assert.equal(r.folder, undefined);
  });
  it('typst-preset alone', async () => {
    const { readNoteTarget } = await target();
    const r = readNoteTarget('typst-preset: A4 Sheets');
    assert.equal(r.preset, 'A4 Sheets');
    assert.equal(r.folder, undefined);
    assert.equal(r.file, undefined);
  });
  it('all three, with other keys around them', async () => {
    const { readNoteTarget } = await target();
    const r = readNoteTarget('tags: [a]\ncompile-folder: Sheets\ncompile-file: Keep.md\ntypst-preset: A4\n');
    assert.deepEqual(r, { folder: 'Sheets', file: 'Keep.md', preset: 'A4', problems: [] });
  });
  it('values are trimmed', async () => {
    const { readNoteTarget } = await target();
    const r = readNoteTarget('compile-folder: "  Sheets  "\ncompile-file: "\\tKeep.md "');
    assert.equal(r.folder, 'Sheets');
    assert.equal(r.file, 'Keep.md');
  });
  it('empty or blank = not set, no problem (each key)', async () => {
    const { readNoteTarget } = await target();
    for (const key of ['compile-folder', 'compile-file', 'typst-preset']) {
      for (const value of ['', '""', '"   "', '~']) {
        const r = readNoteTarget(`${key}: ${value}`);
        assert.equal(r.folder, undefined, `${key}: ${value}`);
        assert.equal(r.file, undefined, `${key}: ${value}`);
        assert.equal(r.preset, undefined, `${key}: ${value}`);
        assert.deepEqual(r.problems, [], `${key}: ${value}`);
      }
    }
  });
  it('a non-text value is refused with the property named (each key, list/number/map)', async () => {
    const { readNoteTarget } = await target();
    for (const key of ['compile-folder', 'compile-file', 'typst-preset']) {
      for (const value of ['[a, b]', '42', '{ a: 1 }', 'true']) {
        const r = readNoteTarget(`${key}: ${value}`);
        assert.deepEqual(r.problems, [`Property ${key} must be text`], `${key}: ${value}`);
      }
    }
  });
  it('only top-level keys count: a nested key is not read', async () => {
    const { readNoteTarget } = await target();
    const r = readNoteTarget('meta:\n  compile-folder: Sheets\n');
    assert.equal(r.folder, undefined);
    assert.deepEqual(r.problems, []);
  });
});

describe('US-7.5 AC-1, AC-8: effectiveTarget', () => {
  const eff = async (t: object) => (await target()).effectiveTarget(SETTINGS, { problems: [], ...t });
  it('both set: Sheets/Keep.md from the note', async () => {
    assert.deepEqual(await eff({ folder: 'Sheets', file: 'Keep.md' }), {
      outputFolder: 'Sheets', outputFile: 'Keep.md', fromNote: true,
    });
  });
  it('only the file: the folder falls back to the setting', async () => {
    assert.deepEqual(await eff({ file: 'Keep.md' }), { outputFolder: 'Exports', outputFile: 'Keep.md', fromNote: true });
  });
  it('only the folder: the file falls back to the setting', async () => {
    assert.deepEqual(await eff({ folder: 'Sheets' }), { outputFolder: 'Sheets', outputFile: 'Book.md', fromNote: true });
  });
  it('neither: the settings, not from the note', async () => {
    assert.deepEqual(await eff({}), { outputFolder: 'Exports', outputFile: 'Book.md', fromNote: false });
  });
  it('typst-preset alone does not make the target come from the note (AC-3 says either key)', async () => {
    assert.deepEqual(await eff({ preset: 'A4' }), { outputFolder: 'Exports', outputFile: 'Book.md', fromNote: false });
  });
});

describe('US-7.5 AC-2 (SCAR-033): the property values meet the settings\' rules', () => {
  const base = { startingFile: 'Keep Notes.md', configDir: '.obsidian', vaultRoot: '/vault', folderExists: () => false };
  const refusals: Array<[string, string, string, string]> = [
    ['dotDot', '../out', 'Book.md', STRINGS.reasons.dotDot('../out')],
    ['tilde', '~/out', 'Book.md', STRINGS.reasons.tilde('~/out')],
    ['missing absolute folder', '/nowhere/at/all', 'Book.md', STRINGS.reasons.missingFolder('/nowhere/at/all')],
  ];
  for (const [name, folder, file, reason] of refusals) {
    it(`a note's folder "${folder}" is refused as the setting is (${name})`, async () => {
      const { readNoteTarget, effectiveTarget } = await target();
      const t = effectiveTarget(SETTINGS, readNoteTarget(`compile-folder: "${folder}"`));
      assert.equal(t.outputFolder, folder);
      const r = resolveOutputLocation({ ...base, folder: t.outputFolder, file: t.outputFile });
      assert.deepEqual(r, { ok: false, reason });
      assert.equal(file, t.outputFile);
    });
  }
  // Fixed at G2 review (2026-11-26, SCAR-023): the first version compared one
  // call with itself. The refusal of a property names it before the settings'
  // own reason (AC-2): the named seam `noteTargetRefusal(target, request)`.
  it('a refusal names the property, then gives the settings\' own reason (bad file name, config folder, the starting note itself, ..)', async () => {
    const mod = (await target()) as unknown as {
      readNoteTarget: (y: string | null) => unknown;
      noteTargetRefusal: (t: unknown, r: typeof base) => string | null;
    };
    const cases: Array<[string, string, string]> = [
      ['compile-file: "a/b.md"', 'compile-file', resolveOutputLocation({ ...base, folder: '', file: 'a/b.md' }) .ok ? '' : (resolveOutputLocation({ ...base, folder: '', file: 'a/b.md' }) as { reason: string }).reason],
      ['compile-file: "Keep Notes.md"', 'compile-file', (resolveOutputLocation({ ...base, folder: '', file: 'Keep Notes.md' }) as { reason: string }).reason],
      ['compile-folder: .obsidian/plugins', 'compile-folder', (resolveOutputLocation({ ...base, folder: '.obsidian/plugins', file: 'Book.md' }) as { reason: string }).reason],
      ['compile-folder: "../out"', 'compile-folder', STRINGS.reasons.dotDot('../out')],
    ];
    for (const [yaml, key, reason] of cases) {
      assert.ok(reason.length > 0, `the settings refuse ${yaml}`);
      assert.equal(mod.noteTargetRefusal(mod.readNoteTarget(yaml), base), `Property ${key}: ${reason}`, yaml);
    }
    assert.equal(mod.noteTargetRefusal(mod.readNoteTarget('compile-folder: Sheets\ncompile-file: Keep.md'), base), null);
  });
});

describe('US-7.5 AC-3: settingsAfterCompile(run, origin, fromNote)', () => {
  const run = { startingFile: 'Keep Notes.md', outputFolder: 'Sheets', outputFile: 'Keep.md' };
  it('fromNote: no outputFolder or outputFile key at all (settings origin)', async () => {
    const { settingsAfterCompile } = await rules();
    assert.deepEqual(settingsAfterCompile(run, 'settings', true), { startingFile: 'Keep Notes.md' });
  });
  it('fromNote: nothing saved from the file menu', async () => {
    const { settingsAfterCompile } = await rules();
    assert.deepEqual(settingsAfterCompile(run, 'file-menu', true), {});
  });
  it('not from the note: as today (AC-8)', async () => {
    const { settingsAfterCompile } = await rules();
    assert.deepEqual(settingsAfterCompile(run, 'settings', false), run);
    assert.deepEqual(settingsAfterCompile(run, 'file-menu', false), { outputFolder: 'Sheets', outputFile: 'Keep.md' });
  });
  it('the result does not carry the keys even as undefined', async () => {
    const { settingsAfterCompile } = await rules();
    const r = settingsAfterCompile(run, 'settings', true);
    assert.equal('outputFolder' in r, false);
    assert.equal('outputFile' in r, false);
  });
});
