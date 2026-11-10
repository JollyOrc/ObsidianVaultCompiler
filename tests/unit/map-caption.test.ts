/**
 * Unit tests for US-4.11 "Map caption: none unless the map sets one" (#119).
 *
 * `parseMapDirectives(code).captions` lists the caption texts of the
 * directive lines, in order; `mapAlt(code)` is the alt text written for the
 * map: the first caption, with `\`, `[` and `]` escaped, else empty.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapAlt, parseMapDirectives } from '../../plugin/src/textmapper.ts';

describe('US-4.11 AC-1: no label by default', () => {
  const cases: Array<[string, string]> = [
    ['a labelled hex (the #119 example)', '0402 grass "Fog Lantern|Fog Lantern "'],
    ['an include line', 'include gnomeyland.txt\n0101 forest'],
    ['plain hexes', '0101 forest\n0102 mountain'],
    ['an ordinary comment', '# caption: Not a directive\n0101 forest'],
    ['a directive without caption', '# vault-compiler: no-glow\n0101 forest "Peak"'],
    ['empty', ''],
  ];
  for (const [name, code] of cases) {
    it(`${name} → empty alt text`, () => {
      assert.equal(mapAlt(code), '');
    });
  }
});

describe('US-4.11 AC-2: caption line', () => {
  it('the rest of the line after `caption`, trimmed', () => {
    const code = '# vault-compiler: caption Branches of the fighting skills  \n0101 forest "Moss"';
    assert.equal(mapAlt(code), 'Branches of the fighting skills');
  });
  it('the word in any case, the text as written', () => {
    assert.equal(mapAlt('#Vault-Compiler: CAPTION Mixed Case Kept'), 'Mixed Case Kept');
  });
  it('after other words: they switch, the caption words are no unknown words', () => {
    const code = '# vault-compiler: no-glow caption Moss and Stone';
    const parsed = parseMapDirectives(code);
    assert.equal(parsed.noGlow, true);
    assert.deepEqual(parsed.unknown, []);
    assert.deepEqual(parsed.captions, ['Moss and Stone']);
    assert.equal(mapAlt(code), 'Moss and Stone');
  });
  it('`caption` with nothing after it: no caption', () => {
    assert.deepEqual(parseMapDirectives('# vault-compiler: caption').captions, []);
    assert.equal(mapAlt('# vault-compiler: caption   '), '');
  });
  it('leading spaces: not a directive line', () => {
    assert.equal(mapAlt('  # vault-compiler: caption X'), '');
  });
  it('a word that only contains "caption" is an unknown word, not a caption', () => {
    const parsed = parseMapDirectives('# vault-compiler: no-caption X');
    assert.deepEqual(parsed.captions, []);
    assert.deepEqual(parsed.unknown, ['no-caption', 'X']);
  });
  it('CRLF line endings are not part of the caption', () => {
    assert.equal(mapAlt('# vault-compiler: caption Moss\r\n0101 forest'), 'Moss');
  });
});

describe('US-4.11 AC-3, AC-4: characters and repeats', () => {
  it('\\, [ and ] are escaped', () => {
    assert.equal(mapAlt('# vault-compiler: caption Tree [old] \\ path'), 'Tree \\[old\\] \\\\ path');
  });
  it('| is written as given', () => {
    assert.equal(mapAlt('# vault-compiler: caption Moss | Stone'), 'Moss | Stone');
  });
  it('every caption line is listed, the first is the alt text', () => {
    const code = '# vault-compiler: caption First\n0101 forest\n# vault-compiler: caption Second';
    assert.deepEqual(parseMapDirectives(code).captions, ['First', 'Second']);
    assert.equal(mapAlt(code), 'First');
  });
});
