/**
 * US-7.4 | AC-10 (G2, 2026-11-18): the notices in the standard's wording.
 * Written before the code.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CompileResult } from '../../plugin/src/compiler.ts';

const result = (messages: string[]): CompileResult =>
  ({
    content: '',
    warnings: [],
    warningDetails: messages.map((message) => ({ message, link: '', file: '', line: 0 })),
    stats: { filesProcessed: 12, assetsCopied: 3, assetsDeduplicated: 0, missingReferences: 0 },
  }) as unknown as CompileResult;

describe('US-7.4 AC-10: the completion notice', () => {
  it('✅ with the output path and the counts', async () => {
    const { completionNotice } = await import('../../plugin/src/entries.ts');
    assert.equal(
      completionNotice(result([]), null, 'Exports/compiledtext.md'),
      '✅ Compiled Exports/compiledtext.md: 12 files, 3 assets, 0 deduplicated.',
    );
  });
  it("US-9.4 AC-5's additions unchanged", async () => {
    const { completionNotice } = await import('../../plugin/src/entries.ts');
    assert.equal(
      completionNotice(result(['Duplicate entry omitted', 'Not compiled', 'Not compiled (quoted only)']), 'warnings_20261107_1530.md', 'Exports/compiledtext.md'),
      '✅ Compiled Exports/compiledtext.md: 12 files, 3 assets, 0 deduplicated. 1 duplicate entry omitted, 2 notes not compiled: see warnings_20261107_1530.md.',
    );
  });
});

describe('US-7.4 AC-10: the failure notice', () => {
  it('❌ Compilation failed: <message>', async () => {
    const { failedNotice } = await import('../../plugin/src/notices.ts');
    assert.equal(failedNotice('Refused to write "x"'), '❌ Compilation failed: Refused to write "x"');
  });
});
