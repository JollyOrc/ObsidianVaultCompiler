/**
 * Tests for tidying empty lines in the compiled output (US-6.6, 2026-10-27).
 * Lines are joined with \n; `''` is an empty line.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tidyBlankLines } from '../../plugin/src/utils.ts';

const t = (...lines: string[]) => tidyBlankLines(lines.join('\n'));
const lines = (...l: string[]) => l.join('\n') + '\n';

describe('US-6.6 AC-1: at most one empty line', () => {
  it('a run of empty lines becomes one', () => {
    assert.equal(t('Text.', '', '', '', 'More text.'), lines('Text.', '', 'More text.'));
  });

  it('lines with only spaces or tabs count as empty and become empty', () => {
    assert.equal(t('Text.', '   ', '\t', 'More text.'), lines('Text.', '', 'More text.'));
  });

  it('a single empty line between paragraphs stays', () => {
    assert.equal(t('One.', '', 'Two.'), lines('One.', '', 'Two.'));
  });

  it('lines without an empty line between them stay together', () => {
    assert.equal(t('- a', '- b', '| x |'), lines('- a', '- b', '| x |'));
  });
});

describe('US-6.6 AC-2: an empty line before every heading', () => {
  it('after a list item', () => {
    assert.equal(t('- last item', '## Next', 'Text.'), lines('- last item', '', '## Next', 'Text.'));
  });

  it('after text, and several empty lines become one', () => {
    assert.equal(t('Text.', '', '', '### H', 'Body.'), lines('Text.', '', '### H', 'Body.'));
  });

  it('a tag line is not a heading', () => {
    assert.equal(t('Text.', '#monster', 'More.'), lines('Text.', '#monster', 'More.'));
  });

  it('all six levels count, and a tab after the # too', () => {
    assert.equal(t('a', '###### Six', 'b', '#\tTab', 'c'), lines('a', '', '###### Six', 'b', '', '#\tTab', 'c'));
  });
});

describe('US-6.6 AC-3: no empty line after a heading unless a heading follows', () => {
  for (const [kind, next] of [
    ['text', 'Fights are…'], ['list', '- item'], ['table', '| Time | Type |'], ['image', '![m](assets/m.png)'],
    ['callout', '> [!note]'], ['comment', '<!-- Warning: Missing include -->'],
  ] as const) {
    it(`heading then ${kind}`, () => {
      assert.equal(t('## Combat', '', '', next), lines('## Combat', next));
    });
  }
});

describe('US-6.6 AC-4: two headings', () => {
  it('directly after each other get one empty line', () => {
    assert.equal(t('# Part', '## Chapter', 'Text.'), lines('# Part', '', '## Chapter', 'Text.'));
  });

  it('with several empty lines get one', () => {
    assert.equal(t('# Part', '', '', '## Chapter'), lines('# Part', '', '## Chapter'));
  });
});

describe('US-6.6 AC-5: code blocks are left alone', () => {
  it('empty lines and # lines inside a fence stay; the fence follows the rules', () => {
    assert.equal(
      t('## Example', '', '```', '# not a heading', '', '', 'x', '```', '', '', 'After.'),
      lines('## Example', '```', '# not a heading', '', '', 'x', '```', '', 'After.'),
    );
  });

  it('~~~ fences and indented fences count', () => {
    assert.equal(t('a', '  ~~~', '', '', '  ~~~', 'b'), lines('a', '  ~~~', '', '', '  ~~~', 'b'));
  });

  it('a ``` line inside a ~~~ block does not end it', () => {
    assert.equal(t('~~~', '```', '', '', '# x', '~~~', '# H'), lines('~~~', '```', '', '', '# x', '~~~', '', '# H'));
  });
});

describe('US-6.6 AC-6: start and end', () => {
  it('no empty lines at the start, one line break at the end', () => {
    assert.equal(t('', '', '# Title', 'Text.', '', '', ''), lines('# Title', 'Text.'));
  });

  it('an empty document stays empty', () => {
    assert.equal(tidyBlankLines(''), '');
    assert.equal(tidyBlankLines('\n\n  \n'), '');
  });
});
