/**
 * Tests for the "one paragraph" rule of US-1.6 (Definitions, #107).
 *
 * `isOneParagraph(text)` reads a note as stored (frontmatter already
 * removed): heading lines are dropped, then the empty lines at both ends;
 * what is left is one paragraph when it has no empty line and no line that
 * starts a block. One test per block start of the definition.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isOneParagraph } from '../../plugin/src/utils.ts';

describe('US-1.6 Definitions: isOneParagraph', () => {
  const yes: Array<[string, string]> = [
    ['one line', 'Wise words.'],
    ['two lines', 'Wise\nwords.'],
    ['heading-first', '# Wisdom\n\nWise words.'],
    ['a heading in front and behind', '# A\n\nWise words.\n\n## B\n'],
    ['empty', ''],
    ['only headings', '# A\n\n## B'],
    ['empty lines at both ends', '\n\nWise words.\n\n'],
    ['inline markup, links and an image in the text', '**Wise** [[Other]] and ![](pic.png) words.'],
    ['an embed in the text', 'Wise ![[Fool]] words.'],
    ['a single comment line', 'Wise words.\n<!-- note to self -->'],
    ['a line with a hyphen inside', 'Wise - words.'],
    ['indented continuation line', 'Wise\n    words.'],
  ];
  for (const [name, text] of yes) {
    it(`one paragraph: ${name}`, () => {
      /** US-1.6 | Definitions. */
      assert.equal(isOneParagraph(text), true);
    });
  }

  const no: Array<[string, string]> = [
    ['two paragraphs', 'First.\n\nSecond.'],
    ['paragraphs split by a heading', 'First.\n\n## B\n\nSecond.'],
    ['list item -', 'First.\n- a'],
    ['list item *', '* a'],
    ['list item +', '+ a'],
    ['list item 1.', '1. a'],
    ['list item 1)', '1) a'],
    ['quote', '> a'],
    ['callout', '> [!note] a'],
    ['backtick fence', '```\ncode\n```'],
    ['tilde fence', '~~~\ncode\n~~~'],
    ['indented code on the first line', '    code'],
    ['tab-indented code on the first line', '\tcode'],
    ['table row', '| a | b |'],
    ['table delimiter row', 'a | b\n--- | ---'],
    ['thematic break', 'First.\n***'],
    ['setext underline ---', 'Title\n---'],
    ['setext underline ===', 'Title\n==='],
    ['html block', '<div>a</div>'],
    ['a line that is only an embed', 'Intro.\n![[Inner]]'],
    ['a line that is only an image', '![](pic.png)'],
    ['math block', '$$\nx\n$$'],
    ['footnote definition', 'Text.\n[^1]: note'],
    ['link definition', 'Text.\n[x]: https://example.com'],
  ];
  for (const [name, text] of no) {
    it(`not one paragraph: ${name}`, () => {
      /** US-1.6 | Definitions, AC-6. */
      assert.equal(isOneParagraph(text), false);
    });
  }
});
