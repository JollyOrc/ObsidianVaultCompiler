/**
 * Tests for the title rule (US-6.4 "Title rule"; used by US-6.1, US-6.3,
 * US-6.5 and US-2.3 link labels and anchors).
 *
 * `titleFromBasename` applies exactly these transforms (SCAR-001):
 *   1. removes the extension (the last `.xxx`);
 *   2. removes a numeric prefix (digits and dots) and the whitespace after it;
 *   3. upper-cases the first character.
 * Everything else — hyphens, underscores, case of later words, brackets — is
 * kept as written.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, titleFromBasename } from '../../plugin/src/utils.ts';

describe('US-6.4 title rule: titleFromBasename', () => {
  it('removes the numeric prefix and the extension', () => {
    assert.equal(titleFromBasename('1.2 Combat.md'), 'Combat');
    assert.equal(titleFromBasename('01.03.02 Title.md'), 'Title');
    assert.equal(titleFromBasename('1.0 Intro.md'), 'Intro');
  });

  it('keeps hyphens and underscores (differs from the old titleFromFilename)', () => {
    assert.equal(titleFromBasename('2.2.2 Third-Level.md'), 'Third-Level');
    assert.equal(titleFromBasename('1.2 my-file_name.md'), 'My-file_name');
  });

  it('upper-cases only the first character', () => {
    assert.equal(titleFromBasename('notes.md'), 'Notes');
    assert.equal(titleFromBasename('The Songbook (music spells).md'), 'The Songbook (music spells)');
  });

  it('leaves a name without a prefix unchanged apart from the first character', () => {
    assert.equal(titleFromBasename('Combat Actions and Tracking.md'), 'Combat Actions and Tracking');
  });

  it('does not treat digits followed by a hyphen as a prefix (US-6.3 AC-2)', () => {
    assert.equal(titleFromBasename('2.1-intro.md'), '2.1-intro');
  });

  it('keeps a name that is only a number', () => {
    assert.equal(titleFromBasename('1.2.md'), '1.2');
  });

  it('gives the anchor slug used by links (US-2.3)', () => {
    assert.equal(slugify(titleFromBasename('1.2 Third-Level.md')), 'third-level');
  });
});
