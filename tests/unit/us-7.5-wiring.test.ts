/**
 * US-7.5 AC-1, AC-3, AC-5, AC-6 (G2, 2026-11-26): the wiring of the Obsidian
 * side, which no unit test reaches: text checks over the sources, as
 * `us-7.4-wiring.test.ts` does. The manual check (AC-9, M25) covers the rest.
 * Red until US-7.5 is implemented (G2, 2026-11-26).
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

describe('US-7.5 AC-1: all three entry points read the note target', () => {
  it('the plain command, the dialog and the file menu go through readNoteTarget/effectiveTarget', () => {
    const main = read('main.ts');
    const dialog = read('compile-dialog.ts');
    assert.match(main + dialog, /readNoteTarget\(/);
    assert.match(main + dialog, /effectiveTarget\(/);
    // The plain command's path (compileVault) must use it, not only the dialog.
    const compileVault = main.slice(main.indexOf('compileVault('));
    assert.match(compileVault, /effectiveTarget\(|readNoteTarget\(|noteTarget/);
  });
  it('the note is read through the vault when the compile starts (SCAR-022: no cache)', () => {
    const main = read('main.ts');
    assert.match(main, /vault\.(read|cachedRead)\(/);
  });
});

describe('US-7.5 AC-3: the dialog', () => {
  it('passes fromNote to settingsAfterCompile', () => {
    assert.match(flat(read('compile-dialog.ts')), /settingsAfterCompile\([^)]*,[^)]*,[^)]+\)/);
  });
  it('says the info line from the string table', () => {
    assert.match(read('strings.ts'), /Output from the note's properties/);
    assert.match(read('compile-dialog.ts'), /STRINGS\.dialog\.\w*[Nn]ote\w*/);
  });
});

describe('US-7.5 AC-2: refusal wording', () => {
  it('the string table has the property prefix and the text-type message', () => {
    const strings = read('strings.ts');
    assert.match(strings, /Property \$\{[^}]+\}: /);
    assert.match(strings, /Property \$\{[^}]+\} must be text/);
  });
});

describe('US-7.5 AC-5: the menu "Compile target…"', () => {
  it('the string table holds the menu title, buttons and notices', () => {
    const strings = read('strings.ts');
    assert.match(strings, /Compile target…/);
    assert.match(strings, /Compile target of "\$\{[^}]+\}": the settings/);
    assert.match(strings, /Could not set the compile target: /);
    for (const word of ['Save', 'Clear', 'Cancel']) assert.match(strings, new RegExp(`'${word}'`));
  });
  it('the file menu of a .md note gets a second item that opens the target dialog', () => {
    const main = flat(read('main.ts'));
    assert.match(main, /setTitle\(STRINGS\.menus\.compileTarget\)[\s\S]{0,300}new \w*Target\w*\(/);
    assert.match(main, /extension\.toLowerCase\(\) === 'md'/);
  });
  it('the dialog file exists, keys go through dialogKey-style Enter/Escape (SCAR-013)', () => {
    const dialog = read('compile-target-dialog.ts');
    assert.match(dialog, /isConfirmKey\(|dialogKey\(/);
    assert.match(dialog, /Escape|'cancel'/);
  });
  it('Save checks with resolveOutputLocation before writing', () => {
    const dialog = read('compile-target-dialog.ts');
    assert.match(dialog, /resolveOutputLocation\(/);
  });
});

describe('US-7.5 AC-6, AC-7: the one write', () => {
  it('the note is changed in one vault.process through setNoteProperties', () => {
    const dialog = read('compile-target-dialog.ts');
    assert.match(flat(dialog), /vault\.process\([^;]*setNoteProperties\(/);
    assert.equal((dialog.match(/vault\.process\(/g) ?? []).length, 1);
    assert.doesNotMatch(dialog, /vault\.(modify|create|append)\(/);
  });
});

// Added at G4 review (2026-11-26): a mutant that wrote without the check
// survived — the text checks did not look at the order inside Save (SCAR-023).
describe('US-7.5 AC-5: Save checks before it writes', () => {
  it('save(): noteTargetRefusal first; a refusal is shown and returns before write()', () => {
    const text = readFileSync(new URL('../../plugin/src/compile-target-dialog.ts', import.meta.url), 'utf8');
    const start = text.indexOf('private async save()');
    assert.ok(start >= 0, 'save() exists');
    const body = text.slice(start, text.indexOf('\n  }\n', start));
    const check = body.indexOf('noteTargetRefusal(');
    const bail = body.search(/if \(refusal !== null\) \{[\s\S]*?return;\s*\}/);
    const write = body.indexOf('this.write(');
    assert.ok(check >= 0 && bail > check && write > bail, body);
  });
});
