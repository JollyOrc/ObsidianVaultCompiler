/** KD-3 (US-6.6): the shared helpers for headings and code blocks. */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { codeBlockMask, matchHeading } from '../../plugin/src/utils.ts';

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
