import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

describe('output sanity', () => {
  const files = {
    'index2compile.md': '# Index\n- ![[A.md]]\n',
    'A.md': '# A\nHello world, this is enough text to stabilize the size check and avoid minor markup variations affecting the sanity result.\nAnother long sentence to keep the ratio stable.\n',
  };

  it('keeps compiled size within 10% of source markdown size', () => {
    const sourceSize = Object.values(files).reduce((sum, content) => sum + Buffer.byteLength(content, 'utf8'), 0);
    const result = new InMemoryVaultCompiler(files).compile('index2compile.md');
    const compiledSize = Buffer.byteLength(result.content, 'utf8');
    assert.ok(compiledSize >= sourceSize * 0.9, `${compiledSize} < ${sourceSize * 0.9}`);
    assert.ok(compiledSize <= sourceSize * 1.1, `${compiledSize} > ${sourceSize * 1.1}`);
  });

  it('has no dangling source references after compilation', () => {
    const result = new InMemoryVaultCompiler(files).compile('index2compile.md');
    assert.doesNotMatch(result.content, /Missing include/);
  });
});
