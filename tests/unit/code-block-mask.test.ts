/** KD-3 (US-6.6): the shared helpers for headings and code blocks. */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { codeBlockMask, codeLines, matchHeading, unclosedFence } from '../../plugin/src/utils.ts';

describe('KD-3: codeBlockMask', () => {
  it('marks the lines after an opening fence up to and including the closing one', () => {
    assert.deepEqual(codeBlockMask(['a', '```', '# x', '```', 'b']), [false, false, true, true, false]);
  });

  it('~~~ and indented fences count; ``` inside ~~~ does not close it', () => {
    assert.deepEqual(codeBlockMask(['  ~~~', '```', '# x', '~~~', '# y']), [false, true, true, true, false]);
  });

  it('a fence with a language counts', () => {
    assert.deepEqual(codeBlockMask(['```ts', 'x', '```']), [false, true, true]);
  });

  it('an unclosed block runs to the end', () => {
    assert.deepEqual(codeBlockMask(['a', '```', '# x', 'y']), [false, false, true, true]);
  });

  it('two blocks one after the other', () => {
    assert.deepEqual(codeBlockMask(['```', 'a', '```', '```', 'b', '```']), [false, true, true, false, true, true]);
  });

  it('a longer fence is closed only by one at least as long (US-1.4 AC-1)', () => {
    assert.deepEqual(
      codeBlockMask(['````md', '```dataview', 'LIST', '```', '````', 'after']),
      [false, true, true, true, true, false],
    );
    assert.deepEqual(codeBlockMask(['```', 'x', '````']), [false, true, true], 'a longer fence closes a shorter one');
  });
});

describe('US-1.4 AC-7: code inside a quote', () => {
  it('a fence after a quote prefix opens and closes a block', () => {
    assert.deepEqual(codeBlockMask(['> ~~~', '> x', '> ~~~', 'b']), [false, true, true, false]);
    assert.deepEqual(codeBlockMask(['>```', '>x', '>```']), [false, true, true]);
    assert.deepEqual(codeBlockMask(['> > ```', '> > x', '> > ```']), [false, true, true]);
  });
  it('a change of quote depth ends an open block', () => {
    assert.deepEqual(codeBlockMask(['> ```', '> x', '', 'y']), [false, true, false, false]);
    assert.deepEqual(codeBlockMask(['> > ```', '> x']), [false, false]);
    assert.deepEqual(codeBlockMask(['```', '> x', '```']), [false, true, true], 'outside a quote, `>` lines are code text');
  });
  it('a block the quote ends is not unclosed', () => {
    assert.equal(unclosedFence(['> ```', '> code', '', 'text']), null);
    assert.equal(unclosedFence(['> ```', '> code']), null);
    assert.deepEqual(unclosedFence(['```', '> code']), { line: 0, fence: '```' });
  });
  it('codeLines: an empty quote line does not end the block', () => {
    assert.deepEqual(codeLines('> ```\n> [[A]]\n>\n> x ``` y\n> [[A]]\n> ```'), [false, true, true, true, true, true]);
  });
});

describe('KD-3: matchHeading', () => {
  it('reads level and text of 1 to 6 # followed by a space or tab', () => {
    assert.deepEqual(matchHeading('## Combat Rules'), { level: 2, rest: ' Combat Rules' });
    assert.deepEqual(matchHeading('#\tTab'), { level: 1, rest: '\tTab' });
    assert.deepEqual(matchHeading('###### Six'), { level: 6, rest: ' Six' });
  });

  it('a tag, seven #, or # without a space is not a heading', () => {
    assert.equal(matchHeading('#monster'), null);
    assert.equal(matchHeading('####### Seven'), null);
    assert.equal(matchHeading(' # indented'), null);
    assert.equal(matchHeading('#'), null);
  });
});
