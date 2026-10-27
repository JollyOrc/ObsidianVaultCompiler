import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, headingLevel, startsWithHeading, stripLeadingHeading } from '../../plugin/src/utils.ts';

describe('slugify', () => {
  it('preserves numeric prefixes', () => {
    assert.equal(slugify('1.3.1 Combat'), '1.3.1-combat');
  });

  it('handles spaces, underscores and punctuation', () => {
    assert.equal(slugify('A b_c!'), 'a-b-c');
  });
});

describe('headingLevel', () => {
  it('maps numeric prefixes to heading levels', () => {
    assert.equal(headingLevel('1.0 Chapter Title.md'), 1);
    assert.equal(headingLevel('1.1 Section Title.md'), 2);
    assert.equal(headingLevel('1.1.1 Subsection Title.md'), 3);
  });

  it('defaults unnumbered files to level 2', () => {
    assert.equal(headingLevel('Regular Title.md'), 2);
  });
});

describe('leading headings', () => {
  it('detects and strips a leading heading', () => {
    assert.equal(startsWithHeading('# Hello\nbody'), true);
    assert.equal(stripLeadingHeading('# Hello\nbody'), 'body');
  });
});
