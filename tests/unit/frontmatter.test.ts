/**
 * Tests for the frontmatter rule (US-5.2 "Definition").
 *
 * `splitFrontmatter` applies exactly these transforms (SCAR-001):
 *   1. when the first line is `---` (trailing spaces or tabs allowed) and a
 *      later line is `---` (same allowance), removes everything up to and
 *      including the first such closing line and its line break;
 *   2. reports how many source lines were removed.
 * Nothing else changes: text after the frontmatter, including blank lines and
 * later `---` rules, is returned as written.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { splitFrontmatter } from '../../plugin/src/utils.ts';

describe('US-5.2 frontmatter rule: splitFrontmatter', () => {
  it('removes a tags block and reports its line count', () => {
    const r = splitFrontmatter('---\ntags:\n  - ElementalMagic\n  - Wizardry\n---\nSpell text.');
    assert.deepEqual(r, { body: 'Spell text.', lines: 5 });
  });

  it('removes an empty frontmatter block', () => {
    assert.deepEqual(splitFrontmatter('---\n---\nText.'), { body: 'Text.', lines: 2 });
  });

  it('accepts trailing spaces and tabs on both delimiters', () => {
    assert.deepEqual(splitFrontmatter('--- \t\ntags: a\n---  \nText.'), { body: 'Text.', lines: 3 });
  });

  it('accepts CRLF line breaks (AC-11)', () => {
    assert.deepEqual(splitFrontmatter('---\r\ntags: a\r\n---\r\nText.'), { body: 'Text.', lines: 3 });
  });

  it('removes a file that is only frontmatter, with or without a final line break', () => {
    assert.deepEqual(splitFrontmatter('---\ntags: a\n---'), { body: '', lines: 3 });
    assert.deepEqual(splitFrontmatter('---\ntags: a\n---\n'), { body: '', lines: 3 });
  });

  it('stops at the first closing line and keeps a later rule (AC-10)', () => {
    const r = splitFrontmatter('---\ntags: [x]\n---\nIntro.\n\n---\n\nMore.');
    assert.deepEqual(r, { body: 'Intro.\n\n---\n\nMore.', lines: 3 });
  });

  it('keeps blank lines after the frontmatter', () => {
    assert.deepEqual(splitFrontmatter('---\na: 1\n---\n\n# H'), { body: '\n# H', lines: 3 });
  });

  it('leaves a first-line rule without a closing line unchanged (AC-10)', () => {
    const text = '---\nText after a rule.';
    assert.deepEqual(splitFrontmatter(text), { body: text, lines: 0 });
  });

  it('leaves a `---` that is not on the first line unchanged (AC-10)', () => {
    const text = '\n---\ntags: x\n---\nText.';
    assert.deepEqual(splitFrontmatter(text), { body: text, lines: 0 });
  });

  it('does not treat `----` or `--- x` as a delimiter', () => {
    assert.deepEqual(splitFrontmatter('----\na: 1\n----\nT'), { body: '----\na: 1\n----\nT', lines: 0 });
    assert.deepEqual(splitFrontmatter('---\na: 1\n--- x\nT'), { body: '---\na: 1\n--- x\nT', lines: 0 });
  });

  it('leaves a note without frontmatter unchanged', () => {
    assert.deepEqual(splitFrontmatter('# Title\n\n---\n'), { body: '# Title\n\n---\n', lines: 0 });
    assert.deepEqual(splitFrontmatter(''), { body: '', lines: 0 });
  });
});
