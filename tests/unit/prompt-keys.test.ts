/**
 * US-7.3 | AC-5, AC-6 (#81): the keys that confirm the export prompt, and the
 * resolved-output-path line. Written before the code (#104).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';


describe('US-7.3 AC-5: Enter confirms, not while an input method composes', () => {
  const CASES: Array<[string, { key: string; isComposing?: boolean; keyCode?: number }, boolean]> = [
    ['Enter', { key: 'Enter' }, true],
    ['Enter while composing', { key: 'Enter', isComposing: true }, false],
    ['Enter reported as keyCode 229 (composition, older engines)', { key: 'Enter', keyCode: 229 }, false],
    ['a letter', { key: 'a' }, false],
    ['Escape (closes the prompt instead)', { key: 'Escape' }, false],
  ];
  for (const [name, event, expected] of CASES) {
    it(name, async () => {
      const { isConfirmKey } = await import('../../plugin/src/prompt-keys.ts');
      assert.equal(isConfirmKey({ isComposing: false, keyCode: 13, ...event }), expected);
    });
  }
});

describe('US-7.3 AC-6, US-7.1 AC-S2: the resolved output path line', () => {
  it('a usable location and a refused one', async () => {
    const { outputPathText } = await import('../../plugin/src/output-location.ts');
    assert.equal(outputPathText({ ok: true, location: { outputPath: 'Drafts/ch2.md' } as never }), 'Drafts/ch2.md');
    assert.equal(
      outputPathText({ ok: false, reason: 'Output folder "/x" does not exist.' }),
      'not usable: Output folder "/x" does not exist.',
    );
  });
});
