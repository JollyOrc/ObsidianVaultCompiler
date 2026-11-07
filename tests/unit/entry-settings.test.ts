/**
 * Unit tests for the decisions of Epic 9 that `main.ts` needs (SCAR-031):
 * reading the list settings, and the completion Notice (US-9.4 AC-5). The output
 * folders to ignore (US-3.1) are tested in `output-folders.test.ts`.
 *
 * Written before the code (G2, 2026-11-07): red until `entries.ts` and
 * `foldersToIgnore` exist.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { completionNotice, parseListSetting } from '../../plugin/src/entries.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';

describe('Epic 9 settings: parseListSetting (SCAR-019)', () => {
  const rows: Array<[string, boolean, string[]]> = [
    ['', true, []],
    ['might', true, ['might']],
    [' Might , attacks,,', true, ['might', 'attacks']],
    ['aliases, cssclasses, publish', true, ['aliases', 'cssclasses', 'publish']],
    ['Creatures, Lore/Elves ', false, ['Creatures', 'Lore/Elves']],
  ];
  for (const [text, lower, list] of rows) {
    it(`${JSON.stringify(text)} (keys: ${lower}) → ${JSON.stringify(list)}`, () => {
      assert.deepEqual(parseListSetting(text, { lowerCase: lower }), list);
    });
  }
});

describe('US-9.4 AC-5: the completion Notice', () => {
  const result = (messages: string[]): CompileResult => ({
    content: '', warnings: [],
    warningDetails: messages.map(message => ({ message, link: '', file: '', line: 0 })),
    stats: { filesProcessed: 12, assetsCopied: 3, assetsDeduplicated: 0, missingReferences: 0 },
  });
  const base = 'Compilation complete: 12 files, 3 assets, 0 deduplicated.';

  it('nothing to report → unchanged', () => {
    assert.equal(completionNotice(result(['Missing asset']), 'warnings_20261107_1530.md'), base);
  });

  it('both counts', () => {
    assert.equal(completionNotice(result(['Duplicate entry omitted', 'Not compiled', 'Not compiled (quoted only)']), 'warnings_20261107_1530.md'),
      `${base} 1 duplicate entry omitted, 2 notes not compiled: see warnings_20261107_1530.md.`);
  });

  it('one count only; plural forms', () => {
    assert.equal(completionNotice(result(['Duplicate entry omitted', 'Duplicate entry omitted']), 'w.md'),
      `${base} 2 duplicate entries omitted: see w.md.`);
    assert.equal(completionNotice(result(['Not compiled (section embed only)']), 'w.md'),
      `${base} 1 note not compiled: see w.md.`);
  });

  it('main.ts shows completionNotice (text check)', () => {
    const src = readFileSync(new URL('../../plugin/src/main.ts', import.meta.url), 'utf8');
    assert.match(src, /new Notice\(\s*completionNotice\(/);
    assert.doesNotMatch(src, /Compilation complete:/, 'the wording lives in entries.ts');
  });
});

describe('Epic 9: main.ts decides nothing about entries (SCAR-031)', () => {
  const src = readFileSync(new URL('../../plugin/src/main.ts', import.meta.url), 'utf8');

  it('each list setting is read with parseListSetting', () => {
    for (const key of ['entryMarkerKeys', 'entryExcludeKeys', 'entryAssetKeys', 'expectCompiledFolders']) {
      assert.match(src, new RegExp(`${key}:\\s*parseListSetting\\(\\s*this\\.settings\\.${key}`), key);
    }
  });

  it('the defaults are the story\'s', () => {
    assert.match(src, /entryMarkerKeys:\s*''/);
    assert.match(src, /entryExcludeKeys:\s*'aliases, cssclasses, publish'/);
    assert.match(src, /entryAssetKeys:\s*'illustration'/);
    assert.match(src, /expectCompiledFolders:\s*''/);
  });

  it('no YAML and no o2t-entry in main.ts', () => {
    assert.doesNotMatch(src, /o2t-entry|parseYaml|from 'yaml'/);
  });
});
