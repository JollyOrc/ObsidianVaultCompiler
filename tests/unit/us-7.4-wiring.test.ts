/**
 * US-7.4 | AC-1 to AC-4, AC-10 to AC-13 (G2, 2026-11-18): the wiring of the
 * Obsidian side, which no unit test reaches (Obsidian's app): text checks over
 * the sources, as `settings-writes.test.ts` does. What they cannot show is the
 * manual check (AC-15). Written before the code.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (name: string): string => {
  const url = new URL(`../../plugin/src/${name}`, import.meta.url);
  assert.ok(existsSync(url), `plugin/src/${name} exists`);
  return readFileSync(url, 'utf8');
};
const flat = (text: string) => text.replace(/\s+/g, ' ');

describe('US-7.4 AC-1: the entries (main.ts)', () => {
  it('the ribbon icon combine opens the dialog from the settings (P2)', () => {
    const main = flat(read('main.ts'));
    assert.match(main, /addRibbonIcon\(\s*'combine',\s*STRINGS\.commands\.ribbon,[\s\S]{0,200}new CompileDialog\([^;]*'settings'/);
  });
  it('"Compile vault" stays direct; "Compile vault…" opens the dialog', () => {
    const main = flat(read('main.ts'));
    assert.match(main, /id: 'compile-vault', name: STRINGS\.commands\.compile, callback: \(\) => void this\.compileVault\(\)/);
    assert.match(main, /id: 'compile-vault-dialog', name: STRINGS\.commands\.compileDialog,[\s\S]{0,160}new CompileDialog\([^;]*'settings'/);
  });
  it('the file menu opens the dialog for the clicked note, as a file-menu run', () => {
    const main = flat(read('main.ts'));
    assert.match(main, /setTitle\(STRINGS\.menus\.compileFromFile\)[\s\S]{0,300}new CompileDialog\([^;]*startingFile: file\.path[^;]*'file-menu'/);
    assert.doesNotMatch(main, /ExportPathModal/);
  });
});

describe('US-7.4 AC-2 to AC-4: the dialog (compile-dialog.ts)', () => {
  it('its title is the modal title; no heading in its content', () => {
    const dialog = read('compile-dialog.ts');
    assert.match(dialog, /this\.setTitle\(STRINGS\.dialog\.title\)/);
    assert.doesNotMatch(dialog, /createEl\(\s*'h\d'/);
  });
  it('the lines come from destinationLine, the keys from dialogKey', () => {
    const dialog = read('compile-dialog.ts');
    assert.match(dialog, /destinationLine\(/);
    assert.match(dialog, /dialogKey\(/);
    // Tightened at T-7.4-C (SCAR-023): the call, not the type annotation of the button field.
    assert.match(dialog, /\.setDisabled\(!this\.enabled\)/, 'Compile is disabled while refused');
  });
  it('Compile saves through settingsAfterCompile; Choose folder saves nothing', () => {
    const dialog = read('compile-dialog.ts');
    assert.match(dialog, /settingsAfterCompile\(/);
    const choose = dialog.slice(dialog.indexOf('STRINGS.dialog.chooseFolder'), dialog.indexOf('STRINGS.dialog.chooseFolder') + 400);
    assert.doesNotMatch(choose, /saveSettings\(/);
  });
  it('the gear of More options opens the settings tab of this plugin', () => {
    const dialog = flat(read('compile-dialog.ts'));
    assert.match(dialog, /STRINGS\.dialog\.moreOptions[\s\S]{0,500}\.openTabById\(this\.host\.manifest\.id\)/);
  });
});

describe('US-7.4 AC-3, AC-10: the compile (main.ts)', () => {
  it('no window.confirm: the tool replaces its own output', () => {
    assert.doesNotMatch(read('main.ts'), /window\.confirm|confirm\(`Overwrite/);
  });
  it('the notices: ✅ through completionNotice with the output path, ❌ through failedNotice, no start notice', () => {
    const main = flat(read('main.ts'));
    assert.match(main, /new Notice\(\s*completionNotice\([^)]*location\.outputPath\)/);
    assert.match(main, /new Notice\(\s*failedNotice\(/);
    assert.doesNotMatch(main, /compilation started|STRINGS\.notices\.started/i);
  });
});

describe('US-7.4 AC-11 to AC-13: the settings tab (settings-tab.ts)', () => {
  it('the header row: the version and the bug button that copies the debug info', () => {
    const tab = flat(read('settings-tab.ts'));
    assert.match(tab, /setDesc\(STRINGS\.tab\.version\(this\.plugin\.manifest\.version\)\)/);
    assert.match(tab, /setIcon\('bug'\)[\s\S]{0,200}copyDebugInfo\(/);
  });
  it('the sections come from SETTINGS_SECTIONS; each ends with its reset behind ConfirmModal', () => {
    const tab = read('settings-tab.ts');
    assert.match(tab, /SETTINGS_SECTIONS/);
    assert.match(flat(tab), /new ConfirmModal\(\s*this\.app,\s*resetQuestion\([\s\S]{0,300}sectionReset\(/);
  });
  it('text fields commit through attachCommit; no delayed save any more', () => {
    const tab = read('settings-tab.ts');
    assert.match(tab, /attachCommit\(/);
    for (const name of ['settings-tab.ts', 'main.ts']) {
      assert.doesNotMatch(read(name), /DelayedSave|settingsSaver/, name);
    }
  });
  it('the confirmation creates Cancel first (F1, SCAR-017)', () => {
    const all = read('confirm-modal.ts');
    const modal = all.slice(all.indexOf('onOpen()'));
    assert.ok(all.includes('onOpen()'), 'the modal draws in onOpen()');
    const cancel = modal.indexOf('cancelLabel');
    const confirm = modal.indexOf('confirmLabel');
    assert.ok(cancel > 0 && confirm > 0 && cancel < confirm, 'Cancel before the confirm button');
  });
  it('the debug info: gathered, copied, then a notice (main.ts)', () => {
    const main = flat(read('main.ts'));
    assert.match(main, /debugInfo\(/);
    assert.match(main, /navigator\.clipboard\.writeText\(text\); new Notice\(STRINGS\.notices\.debugInfoCopied/);
  });
});
