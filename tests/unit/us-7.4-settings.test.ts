/**
 * US-7.4 | AC-11 (G2, 2026-11-18): the settings in sections, and the reset of
 * one section. Written before the code.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const layout = () => import('../../plugin/src/settings-layout.ts');

describe('US-7.4 AC-11: the sections', () => {
  it('Compile, Maps, Headings, Entry data, in this order', async () => {
    const { SETTINGS_SECTIONS } = await layout();
    assert.deepEqual(SETTINGS_SECTIONS.map((s) => s.name), ['Compile', 'Maps', 'Headings', 'Entry data']);
  });

  it('every setting is in exactly one section (SCAR-017)', async () => {
    const { SETTINGS_SECTIONS, DEFAULT_SETTINGS } = await layout();
    const keys = SETTINGS_SECTIONS.flatMap((s) => s.keys);
    assert.deepEqual([...keys].sort(), Object.keys(DEFAULT_SETTINGS).sort());
    assert.equal(new Set(keys).size, keys.length);
  });

  it('each section holds its keys', async () => {
    const { SETTINGS_SECTIONS } = await layout();
    const of = (name: string) => SETTINGS_SECTIONS.find((s) => s.name === name)?.keys;
    assert.deepEqual(of('Compile'), ['startingFile', 'outputFolder', 'outputFile']);
    assert.deepEqual(of('Maps'), ['enableTextMapper', 'mapFont', 'tidyMapLabels']);
    assert.deepEqual(of('Headings'), ['normaliseHeadings']);
    assert.deepEqual(of('Entry data'), ['entryMarkerKeys', 'entryExcludeKeys', 'entryAssetKeys', 'expectCompiledFolders', 'detailMarkerKeys']);
  });

  it('Maps: a feature row, its toggle enableTextMapper, map font and tidy labels behind the gear', async () => {
    const { SETTINGS_SECTIONS } = await layout();
    assert.deepEqual(SETTINGS_SECTIONS.find((s) => s.name === 'Maps')?.feature, {
      toggle: 'enableTextMapper',
      gear: ['mapFont', 'tidyMapLabels'],
    });
  });

  it('the defaults are those of 0.24.0 (SCAR-027)', async () => {
    const { DEFAULT_SETTINGS } = await layout();
    assert.deepEqual(DEFAULT_SETTINGS, {
      startingFile: 'index2compile.md',
      outputFolder: '',
      outputFile: 'compiledtext.md',
      enableTextMapper: true,
      normaliseHeadings: false,
      mapFont: '',
      tidyMapLabels: true,
      entryMarkerKeys: '',
      entryExcludeKeys: 'aliases, cssclasses, publish',
      entryAssetKeys: 'illustration',
      expectCompiledFolders: '',
      detailMarkerKeys: '',
    });
  });
});

describe('US-7.4 AC-11: the reset of one section', () => {
  it('resetting Compile empties the folder and keeps Tidy map labels (the example)', async () => {
    const { sectionReset, DEFAULT_SETTINGS } = await layout();
    const settings = { ...DEFAULT_SETTINGS, outputFolder: 'Exports', tidyMapLabels: false, startingFile: 'Book.md' };
    const after = sectionReset(settings, 'Compile');
    assert.equal(after.outputFolder, '');
    assert.equal(after.startingFile, 'index2compile.md');
    assert.equal(after.tidyMapLabels, false);
  });

  it('each section resets only its own keys (SCAR-019: every section, values in all)', async () => {
    const { sectionReset, SETTINGS_SECTIONS, DEFAULT_SETTINGS } = await layout();
    const changed = {
      startingFile: 'Book.md', outputFolder: 'Exports', outputFile: 'b.md', enableTextMapper: false,
      normaliseHeadings: true, mapFont: 'Georgia', tidyMapLabels: false, entryMarkerKeys: 'might',
      entryExcludeKeys: 'x', entryAssetKeys: 'y', expectCompiledFolders: 'Creatures', detailMarkerKeys: 'z',
    };
    for (const section of SETTINGS_SECTIONS) {
      const after = sectionReset(changed, section.name) as Record<string, unknown>;
      for (const key of Object.keys(changed)) {
        const expected = section.keys.includes(key as never)
          ? (DEFAULT_SETTINGS as Record<string, unknown>)[key]
          : (changed as Record<string, unknown>)[key];
        assert.equal(after[key], expected, `${section.name}: ${key}`);
      }
    }
  });

  it('the settings passed in are not changed', async () => {
    const { sectionReset, DEFAULT_SETTINGS } = await layout();
    const settings = { ...DEFAULT_SETTINGS, outputFolder: 'Exports' };
    sectionReset(settings, 'Compile');
    assert.equal(settings.outputFolder, 'Exports');
  });

  it('the question: its title, its line, Reset and Cancel', async () => {
    const { resetQuestion } = await layout();
    assert.deepEqual(resetQuestion('Maps'), {
      title: 'Reset "Maps" to its defaults?',
      lines: ['The settings of this section go back to their defaults.'],
      confirmLabel: 'Reset',
      cancelLabel: 'Cancel',
    });
  });
});
