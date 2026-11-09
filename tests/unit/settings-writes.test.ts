/**
 * US-7.2 | AC-3, US-7.3 | AC-3 to AC-6 (#81); US-7.1 | AC-S1 (#82): who may
 * write the plugin settings. `main.ts` needs Obsidian to run, so these are
 * text checks over its source (SCAR-017: the class rule in one place); the
 * behaviour in Obsidian is manual check M19. Written before the code (#104).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SOURCE = readFileSync(new URL('../../plugin/src/main.ts', import.meta.url), 'utf8');

/** The text from `start` up to (not including) `end`. */
function between(start: string, end: string): string {
  const from = SOURCE.indexOf(start);
  const to = SOURCE.indexOf(end, from + start.length);
  assert.ok(from !== -1 && to !== -1, `${start} … ${end} not found`);
  return SOURCE.slice(from, to);
}

const ASSIGNS = /settings\.\w+\s*=(?!=)/g;
const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;

describe('US-7.2 AC-3, US-7.3 AC-3/AC-4: a compile from the file menu saves nothing', () => {
  it('the file-menu handler neither assigns nor saves settings', () => {
    const handler = between("'file-menu'", 'this.addSettingTab');
    assert.equal(count(handler, ASSIGNS), 0, handler);
    assert.equal(count(handler, /saveSettings\(/g), 0, handler);
  });

  it('the export prompt neither assigns nor saves settings', () => {
    const prompt = between('class ExportPathModal', 'class VaultCompilerSettingTab');
    assert.equal(count(prompt, ASSIGNS), 0);
    assert.equal(count(prompt, /saveSettings\(/g), 0);
  });

  it('the prompt compiles with its own values', () => {
    const prompt = between('class ExportPathModal', 'class VaultCompilerSettingTab');
    assert.match(prompt, /compileVault\(\s*[\w{]/, 'compileVault is called with the run values');
  });

  it('a compile reads its run, not the stored run values', () => {
    const compile = between('async compileVault(run: CompileRun', '\n  }\n');
    assert.doesNotMatch(compile, /this\.settings\.(?:startingFile|outputFolder|outputFile)/);
    assert.equal(count(compile, /run\.startingFile/g), 2, 'the starting file is looked up and compiled from the run');
  });

  it('the plugin assigns settings only while loading them', () => {
    const plugin = between('export default class VaultCompilerPlugin', 'class ExportPathModal');
    const withoutLoad = plugin.replace(between('async loadSettings()', 'async saveSettings()'), '');
    assert.equal(count(withoutLoad, ASSIGNS), 0);
  });
});

describe('US-7.3 AC-5/AC-6: the prompt', () => {
  it('Enter confirms through isConfirmKey', () => {
    const prompt = between('class ExportPathModal', 'class VaultCompilerSettingTab');
    assert.match(
      prompt,
      /addEventListener\('keydown', event => \{\s*if \(!isConfirmKey\(event\)\) return;\s*event\.preventDefault\(\);\s*this\.compile\(\);\s*\}\)/,
    );
    assert.equal(count(prompt, /this\.confirmOnEnter\(text\.inputEl\)/g), 2, 'both fields');
  });

  it('the resolved path is shown from the prompt\'s own values', () => {
    const prompt = between('class ExportPathModal', 'class VaultCompilerSettingTab');
    assert.doesNotMatch(prompt, /getOutputPath\(\)/, 'not from the settings');
    assert.match(prompt, /onChange\(/, 'the fields report their changes');
  });
});

describe('US-7.1 AC-S1: settings text fields save through the delayed saver', () => {
  const tab = () => between('class VaultCompilerSettingTab', '\n}\n');

  it('every text field requests a save; switches and Browse save at once', () => {
    // Four fields of their own, and the five lists (four entry lists of #110, the detail keys of #120) through one helper.
    assert.equal(count(tab(), /\.addText\(/g), 5);
    assert.equal(count(tab(), /settingsSaver\.request\(\)/g), 5);
    assert.equal(count(tab(), /\blistSetting\('/g), 5, 'the four entry lists and the detail keys');
    assert.equal(count(tab(), /saveSettings\(\)/g), 4, 'three switches and Browse');
  });

  it('US-7.1 AC-S2: the starting file, folder and filename fields refresh both resolved-path places', () => {
    const fields = tab().split('.addText(').slice(1, 4);
    assert.equal(fields.length, 3);
    for (const field of fields) assert.match(field.split('.addText(')[0], /showPaths\(\)/);
    assert.match(between('const showPaths = () => {', '};'), /folder\?\.setDesc[\s\S]*resolved\?\.setDesc/);
  });

  it('closing the settings window and switching the plugin off flush the saver', () => {
    assert.match(between('hide()', '\n  }\n'), /settingsSaver\.flush\(\)/);
    assert.match(between('onunload()', '\n  }'), /settingsSaver\.flush\(\)/);
  });
});
