/**
 * Tests for US-9.2 (#108): images named in entry properties are copied like
 * embedded images. Forms and results measured by the link spike of
 * 2026-11-07 with v0.21.0; synthetic files only (SCAR-035).
 *
 * Written before the code (G2, 2026-11-07): red until US-9.2 exists.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';

const VAULT: Record<string, string> = {
  'index.md': '# Book\n\n![[Fen Hare]]\n',
  'images/hare.png': 'bin',
  'images/hare one.png': 'bin',
  'Bestiary/Art/owl.png': 'bin',
  'Other/owl.png': 'bin',
  'docs/sheet.pdf': 'bin',
  'Notes/Quick Step.md': '# Quick Step\n\nText.\n',
};

/** US-9.2 | `Fen Hare.md` in `Bestiary/` with `illustration: <value>` (line 3). */
function compile(value: string, options: Record<string, unknown> = {}, body = 'Shy.'): CompileResult {
  return new InMemoryVaultCompiler({
    ...VAULT,
    'Bestiary/Fen Hare.md': `---\nmight: 3\nillustration: ${value}\n---\n${body}\n`,
  }, { entryMarkerKeys: ['might'], ...options }).compile('index.md');
}

/** The `illustration` line of the block, or null when the key is left out. */
function illustration(content: string): string | null {
  const block = content.match(/^```o2t-entry\n([\s\S]*?)^```$/m);
  assert.ok(block, content);
  return block[1].match(/^illustration: (.*)$/m)?.[1] ?? null;
}

describe('US-9.2 AC-1, AC-2: every form gives the same asset, with its credit', () => {
  const rows: Array<[string, string]> = [
    ['"[[hare.png|Drawn by A. Nobody]]"', '"![Drawn by A. Nobody](assets/hare.png)"'],
    ['"[[images/hare.png]]"', 'assets/hare.png'],
    ['"[Drawn by A. Nobody](images/hare.png)"', '"![Drawn by A. Nobody](assets/hare.png)"'],
    ['images/hare.png', 'assets/hare.png'],
    ['hare.png', 'assets/hare.png'],
    ['"![[hare.png|Drawn by A. Nobody]]"', '"![Drawn by A. Nobody](assets/hare.png)"'],
    ['"![Drawn by A. Nobody](images/hare.png)"', '"![Drawn by A. Nobody](assets/hare.png)"'],
    ['"![](<images/hare.png>)"', 'assets/hare.png'],
    ['"[[Hare.PNG]]"', 'assets/hare.png'],
    ['../images/hare.png', 'assets/hare.png'],
    ['"[[hare.png#x]]"', 'assets/hare.png'],
    ['"[[images/hare one.png]]"', 'assets/hare_one.png'],
    ['"![c](images/hare%20one.png)"', '"![c](assets/hare_one.png)"'],
    ['"![c](<images/hare one.png>)"', '"![c](assets/hare_one.png)"'],
    ['"[[hare.png|Luttrell Psalter, c. 1330]]"', '"![Luttrell Psalter, c. 1330](assets/hare.png)"'],
  ];
  for (const [value, written] of rows) {
    it(`${value} → ${written}`, () => {
      const r = compile(value);
      assert.equal(illustration(r.content), written);
      assert.equal(r.stats.assetsCopied, 1);
      assert.deepEqual(r.warningDetails, [], 'embed forms are read without a warning (decided 2026-11-07)');
    });
  }
});

describe('US-9.2 AC-2: a size is not a credit, in any form', () => {
  const rows: Array<[string, string]> = [
    ['"[[hare.png|300]]"', 'assets/hare.png'],
    ['"![[hare.png|300]]"', 'assets/hare.png'],
    ['"![[hare.png|300x200]]"', 'assets/hare.png'],
    ['"[[hare.png|A. Nobody|300]]"', '"![A. Nobody](assets/hare.png)"'],
    ['"![[hare.png|A. Nobody|300]]"', '"![A. Nobody](assets/hare.png)"'],
    ['"![A. Nobody|300](images/hare.png)"', '"![A. Nobody](assets/hare.png)"'],
    ['"![300](images/hare.png)"', 'assets/hare.png'],
  ];
  for (const [value, written] of rows) {
    it(`${value} → ${written}`, () => assert.equal(illustration(compile(value).content), written));
  }

  it('guard: a body embed keeps its size as alt text (US-2.6 AC-2)', () => {
    const r = compile('"[[hare.png]]"', {}, '![[images/hare.png|200]]');
    assert.match(r.content, /^!\[200\]\(assets\/hare\.png\)$/m);
  });
});

describe('US-9.2 AC-3: shared with body embeds', () => {
  it('the same image in the body and the property → one file', () => {
    const r = compile('"[[hare.png|A. Nobody]]"', {}, '![[images/hare.png]]');
    assert.equal(r.stats.assetsCopied, 1);
    assert.equal(r.stats.assetsDeduplicated, 1);
    assert.equal(illustration(r.content), '"![A. Nobody](assets/hare.png)"');
  });

  it('two different owl.png → owl.png and owl_1.png', () => {
    const r = compile('"[[Other/owl.png]]"', {}, '![[Bestiary/Art/owl.png]]');
    assert.equal(r.stats.assetsCopied, 2);
    assert.match(r.content, /^!\[\]\(assets\/owl\.png\)$/m);
    assert.equal(illustration(r.content), 'assets/owl_1.png');
  });
});

describe('US-9.2 AC-4: a missing image', () => {
  for (const value of ['"[[gone.png]]"', '"![c](images/gone.png)"', 'images/gone.png']) {
    it(`${value} → key left out, Missing asset`, () => {
      const r = compile(value);
      assert.equal(illustration(r.content), null);
      assert.doesNotMatch(r.content, /Warning/, 'nothing written in its place');
      assert.deepEqual(r.warningDetails.map(w => [w.message, w.file, w.line]),
        [['Missing asset', 'Bestiary/Fen Hare.md', 3]]);
    });
  }
});

describe('US-9.2 AC-5: not one local image', () => {
  const rows: Array<[string, string]> = [
    ['["[[a.png]]", "[[b.png]]"]', 'list'],
    ['https://example.com/x.png', 'web address'],
    ['"[[https://example.com/x.png]]"', 'web address'],
    ['"[[Quick Step]]"', 'note'],
    ['"[[sheet.pdf]]"', 'not an image'],
  ];
  for (const [value, reason] of rows) {
    it(`${value} → ${reason}`, () => {
      const r = compile(value);
      assert.equal(illustration(r.content), null);
      assert.doesNotMatch(r.content, /Text\.|Open PDF/, 'no note text, no PDF link');
      assert.equal(r.stats.assetsCopied, 0);
      assert.deepEqual(r.warningDetails.map(w => [w.message, w.file, w.line]),
        [[`Entry image is not a local image (${reason})`, 'Bestiary/Fen Hare.md', 3]]);
    });
  }

  for (const ext of ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']) {
    it(`.${ext} is an image`, () => {
      const r = new InMemoryVaultCompiler({ ...VAULT, [`x.${ext}`]: 'b',
        'Bestiary/Fen Hare.md': `---\nmight: 3\nillustration: x.${ext}\n---\nT.\n` }, { entryMarkerKeys: ['might'] }).compile('index.md');
      assert.equal(illustration(r.content), `assets/x.${ext}`);
    });
  }
});

describe('US-9.2 AC-6: an ambiguous name', () => {
  it('reported with the note and the key\'s line; US-3.1 chooses the file', () => {
    const r = compile('"[[owl.png]]"');
    assert.equal(illustration(r.content), 'assets/owl.png');
    assert.deepEqual(r.warningDetails.map(w => [w.message, w.file, w.line]),
      [['Ambiguous filename owl.png; using Bestiary/Art/owl.png', 'Bestiary/Fen Hare.md', 3]]);
  });
});

describe('US-9.2 settings: entryAssetKeys (SCAR-019)', () => {
  it('[] → the value is text, links flattened, nothing copied', () => {
    const r = compile('"[[hare.png|A. Nobody]]"', { entryAssetKeys: [] });
    assert.equal(illustration(r.content), 'A. Nobody');
    assert.equal(r.stats.assetsCopied, 0);
  });

  it('[illustration, portrait] → both copied', () => {
    const r = new InMemoryVaultCompiler({ ...VAULT,
      'Bestiary/Fen Hare.md': '---\nmight: 3\nillustration: "[[hare.png]]"\nportrait: "[[owl.png]]"\n---\nT.\n',
    }, { entryMarkerKeys: ['might'], entryAssetKeys: ['illustration', 'portrait'] }).compile('index.md');
    assert.equal(r.stats.assetsCopied, 2);
    assert.match(r.content, /^portrait: assets\/owl\.png$/m);
  });
});
