/**
 * US-7.4 | AC-12 (G2, 2026-11-18): a settings text field is saved on Enter or
 * when it loses the focus, not while typing. Written before the code. A small
 * fake input stands in for Obsidian's (only the two events the rule reads).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

type Listener = (event: { key?: string; isComposing?: boolean; keyCode?: number; preventDefault?: () => void }) => void;
function fakeInput(value = '') {
  const listeners: Record<string, Listener[]> = {};
  return {
    value,
    addEventListener(type: string, fn: Listener) { (listeners[type] ??= []).push(fn); },
    fire(type: string, event: Parameters<Listener>[0] = {}) { for (const fn of listeners[type] ?? []) fn({ preventDefault() {}, ...event }); },
  };
}
const commit = () => import('../../plugin/src/commit.ts');

describe('US-7.4 AC-12: commit on Enter or leaving the field', () => {
  it('typing saves nothing; leaving the field saves the whole value once (the example)', async () => {
    const { attachCommit } = await commit();
    const input = fakeInput('');
    const saved: string[] = [];
    attachCommit(input, (v) => saved.push(v));
    for (const ch of '/Users/me/Exports') { input.value += ch; input.fire('input'); }
    assert.deepEqual(saved, []);
    input.fire('blur');
    assert.deepEqual(saved, ['/Users/me/Exports']);
  });

  it('Enter saves; Enter while composing does not', async () => {
    const { attachCommit } = await commit();
    const input = fakeInput('a');
    const saved: string[] = [];
    attachCommit(input, (v) => saved.push(v));
    input.value = 'ab';
    input.fire('keydown', { key: 'Enter', isComposing: true, keyCode: 229 });
    assert.deepEqual(saved, []);
    input.fire('keydown', { key: 'Enter', isComposing: false, keyCode: 13 });
    assert.deepEqual(saved, ['ab']);
  });

  it('an unchanged value is not saved again (blur after Enter, blur without typing)', async () => {
    const { attachCommit } = await commit();
    const input = fakeInput('x');
    const saved: string[] = [];
    attachCommit(input, (v) => saved.push(v));
    input.fire('blur');
    assert.deepEqual(saved, []);
    input.value = 'y';
    input.fire('keydown', { key: 'Enter', keyCode: 13 });
    input.fire('blur');
    assert.deepEqual(saved, ['y']);
  });

  it('flush saves a value still being typed (closing the tab, unloading)', async () => {
    const { attachCommit } = await commit();
    const input = fakeInput('');
    const saved: string[] = [];
    const handle = attachCommit(input, (v) => saved.push(v));
    input.value = 'Ex';
    handle.flush();
    assert.deepEqual(saved, ['Ex']);
    handle.flush();
    assert.deepEqual(saved, ['Ex']);
  });
});
