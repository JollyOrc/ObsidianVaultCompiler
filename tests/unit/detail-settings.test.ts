/**
 * Unit tests for the decisions of US-9.5 that `main.ts` needs (SCAR-031), and
 * for the pure functions of `entries.ts` the block writer uses.
 * Written before the code (G2, 2026-11-09, #118). Synthetic data only.
 *
 * New functions this file expects in `entries.ts`:
 * `headingForm(link)`: `[text](#anchor)` → `[[#anchor|text]]` (the anchor
 * decoded), anything else unchanged.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { headingForm, parseListSetting } from '../../plugin/src/entries.ts';

describe('US-9.5: detailMarkerKeys is read as an ordered key list (SCAR-019)', () => {
  const keys = (text: string) => parseListSetting(text, { lowerCase: true });
  it('empty → off', () => assert.deepEqual(keys(''), []));
  it('one key', () => assert.deepEqual(keys('pace'), ['pace']));
  it('trimmed, case folded, empty items dropped', () => assert.deepEqual(keys(' Pace , kind,,'), ['pace', 'kind']));
  it('the order of the setting is kept', () => assert.deepEqual(keys('kind, pace'), ['kind', 'pace']));
});

describe('US-9.5 AC-8: headingForm', () => {
  const rows: Array<[string, string]> = [
    ['[Basket Knots](#Basket%20Knots)', '[[#Basket Knots|Basket Knots]]'],
    ['[tight](#Tight)', '[[#Tight|tight]]'],
    ['[Tight](#Mat%20Knots#Tight)', '[[#Mat Knots#Tight|Tight]]'],
    ['[a % b](#100%25)', '[[#100%|a % b]]'],
    ['[x](https://example.com)', '[x](https://example.com)'],
    ['[t](assets/a.pdf)', '[t](assets/a.pdf)'],
    ['plain text', 'plain text'],
    ['**Bold** [x](#Y)', '**Bold** [x](#Y)'],
    ['[x](#bad%zz)', '[[#bad%zz|x]]'],
  ];
  for (const [input, expected] of rows) {
    it(`${input} → ${expected}`, () => assert.equal(headingForm(input), expected));
  }
});

describe('US-9.5: main.ts decides nothing about details (SCAR-031)', () => {
  const src = readFileSync(new URL('../../plugin/src/main.ts', import.meta.url), 'utf8');

  it('the setting is read with parseListSetting, lower case', () => {
    assert.match(src, /detailMarkerKeys:\s*parseListSetting\(\s*this\.settings\.detailMarkerKeys,\s*\{\s*lowerCase:\s*true/);
  });

  it('the default is empty (off)', () => {
    assert.match(src, /detailMarkerKeys:\s*''/);
  });

  it('the settings row exists and saves through the delayed saver', () => {
    assert.match(src, /listSetting\('Detail marker keys'/);
    assert.match(src, /'detailMarkerKeys'/);
  });

  it('no YAML and no o2t-details in main.ts', () => {
    assert.doesNotMatch(src, /o2t-details|parseYaml|from 'yaml'/);
  });
});
