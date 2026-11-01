/**
 * US-7.1 | AC-S1 (#82): settings text fields are saved half a second after
 * the last key press, and at once on flush (settings window closed, plugin
 * switched off). Written before the code (#104).
 */

import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';


/** US-7.1 | AC-S1: a DelayedSave over a counting save, on mocked timers. */
async function saver(): Promise<{ s: { request(): void; flush(): Promise<void> }; saves: string[]; value: { v: string } }> {
  const { DelayedSave } = await import('../../plugin/src/delayed-save.ts');
  const value = { v: '' };
  const saves: string[] = [];
  const s = new DelayedSave(async () => { saves.push(value.v); }, 500);
  return { s, saves, value };
}

describe('US-7.1 AC-S1: DelayedSave', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }));
  afterEach(() => mock.timers.reset());

  it('typing /Users/me/Exports in one go saves once, with the whole value', async () => {
    const { s, saves, value } = await saver();
    for (const c of '/Users/me/Exports') {
      value.v += c;
      s.request();
      mock.timers.tick(100);
    }
    mock.timers.tick(500);
    await Promise.resolve();
    assert.deepEqual(saves, ['/Users/me/Exports']);
  });

  it('nothing is saved before half a second has passed', async () => {
    const { s, saves, value } = await saver();
    value.v = 'Ex';
    s.request();
    mock.timers.tick(499);
    await Promise.resolve();
    assert.deepEqual(saves, []);
    mock.timers.tick(1);
    await Promise.resolve();
    assert.deepEqual(saves, ['Ex']);
  });

  it('flush saves at once and the timer does not save again', async () => {
    const { s, saves, value } = await saver();
    value.v = 'Ex';
    s.request();
    await s.flush();
    assert.deepEqual(saves, ['Ex']);
    mock.timers.tick(1000);
    await Promise.resolve();
    assert.deepEqual(saves, ['Ex']);
  });

  it('flush with nothing pending saves nothing', async () => {
    const { s, saves } = await saver();
    await s.flush();
    assert.deepEqual(saves, []);
  });

  it('a request after a save starts a new wait', async () => {
    const { s, saves, value } = await saver();
    value.v = 'a';
    s.request();
    mock.timers.tick(500);
    value.v = 'ab';
    s.request();
    mock.timers.tick(500);
    await Promise.resolve();
    assert.deepEqual(saves, ['a', 'ab']);
  });
});
