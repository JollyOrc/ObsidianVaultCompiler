/**
 * US-7.2 | AC-3, US-7.4 | AC-4, AC-12 (amended at G2, 2026-11-18; first
 * written for #81, #82, #104): who may write the plugin settings. The
 * Obsidian side needs Obsidian to run, so these are text checks over its
 * sources (SCAR-017: the class rule in one place); the behaviour in Obsidian
 * is the manual check of US-7.4 (AC-15).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name: string) => readFileSync(new URL(`../../plugin/src/${name}`, import.meta.url), 'utf8');
const MAIN = read('main.ts');
const DIALOG = read('compile-dialog.ts');
const TAB = read('settings-tab.ts');

/** The text of `source` from `start` up to (not including) `end`. */
function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from !== -1 && to !== -1, `${start} … ${end} not found`);
  return source.slice(from, to);
}

const ASSIGNS = /settings\.\w+\s*=(?!=)/g;
const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;

describe('US-7.2 AC-3, US-7.4 AC-4: what a compile from the dialog saves', () => {
  it('the file-menu handler neither assigns nor saves settings', () => {
    const handler = between(MAIN, "'file-menu'", 'this.addSettingTab');
    assert.equal(count(handler, ASSIGNS), 0, handler);
    assert.equal(count(handler, /saveSettings\(/g), 0, handler);
  });

  it('the dialog writes the settings only through settingsAfterCompile, once, on Compile', () => {
    assert.equal(count(DIALOG, ASSIGNS), 0);
    assert.equal(count(DIALOG, /settingsAfterCompile\(/g), 1);
    assert.equal(count(DIALOG, /\.saveSettings\(\)/g), 1, 'one call (the host interface declares it too)');
    assert.match(between(DIALOG, 'private async compile()', '\n  }\n'), /settingsAfterCompile\([\s\S]*saveSettings\(\)[\s\S]*compileVault\(run\)/);
  });

  it('the dialog compiles with its own values and shows the path from them (US-7.3 AC-6 kept)', () => {
    assert.match(DIALOG, /resolveOutputLocation\(this\.run\)/);
    assert.match(DIALOG, /compileVault\(run\)/);
  });

  it('a compile reads its run, not the stored run values', () => {
    const compile = between(MAIN, 'async compileVault(run: CompileRun', '\n  }\n');
    assert.doesNotMatch(compile, /this\.settings\.(?:startingFile|outputFolder|outputFile)/);
    assert.equal(count(compile, /run\.startingFile/g), 2, 'the starting file is looked up and compiled from the run');
  });

  it('main.ts assigns settings only while loading them', () => {
    const plugin = MAIN.slice(MAIN.indexOf('export default class VaultCompilerPlugin'));
    const withoutLoad = plugin.replace(between(MAIN, 'async loadSettings()', 'async saveSettings()'), '');
    assert.equal(count(withoutLoad, ASSIGNS), 0);
  });
});

describe('US-7.4 AC-12 (amends US-7.1 AC-S1): settings text fields commit on Enter or blur', () => {
  it('every text row commits through attachCommit; toggles and Choose folder save at once', () => {
    const textRow = between(TAB, 'private textRow(', '\n  }\n');
    assert.match(textRow, /attachCommit\(t\.inputEl,[\s\S]*saveSettings\(\)/);
    assert.doesNotMatch(between(TAB, 't.onChange(', 'this.commits.push('), /saveSettings\(/, 'typing saves nothing');
    assert.match(between(TAB, 'private toggleRow(', '\n  }\n'), /onChange\(async[\s\S]*saveSettings\(\)/);
  });

  it('US-7.1 AC-S2 kept: the starting file, folder and filename refresh both resolved-path places while typing', () => {
    assert.match(between(TAB, 't.onChange(', 'this.commits.push('), /key === 'startingFile' \|\| key === 'outputFolder' \|\| key === 'outputFile'[\s\S]*this\.showPaths\(\)/);
    assert.match(between(TAB, 'this.showPaths = () => {', '};'), /folderRow\?\.setDesc[\s\S]*resolvedRow\?\.setDesc/);
  });

  it('closing the settings window and switching the plugin off save a value still being typed', () => {
    assert.match(between(TAB, 'hide(): void {', '\n  }\n'), /flushAll\(\)/);
    assert.match(between(MAIN, 'onunload()', '\n  }'), /settingTab\?\.flushAll\(\)/);
  });
});
