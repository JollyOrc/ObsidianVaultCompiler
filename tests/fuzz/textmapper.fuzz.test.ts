/**
 * Fuzz tests for TextMapper block parsing (TT-1.8).
 *
 * Exercises altForTextMapper, extractIncludes, and buildPlaceholder with
 * empty blocks, comment-only blocks, blocks with 0–10 random terrain labels,
 * and random include lines.  Asserts no exception is thrown and the return
 * type matches the declared signature.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { altForTextMapper } from '../../plugin/src/textmapper.ts';

// New exports required by US-4.6 — imported the same way as textmapper.test.ts
import {
  extractIncludes,
  buildPlaceholder,
} from '../../plugin/src/textmapper.ts';

// ---------------------------------------------------------------------------
// Pseudo-random helpers
// ---------------------------------------------------------------------------

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223;
    return (s >>> 0) / 2 ** 32;
  };
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

// ---------------------------------------------------------------------------
// Block generators
// ---------------------------------------------------------------------------

const TERRAINS = ['forest', 'mountain', 'sea', 'swamp', 'plains', 'desert', 'tundra', 'jungle'];
const INCLUDE_FILES = ['gnomeyland.txt', 'world.txt', 'overland.txt', 'island.txt'];
const LABELS = ['"The Forest"', '"Dark Peak"', '"Sunken Sea"', '"Lost Vale"'];

function randomHex(rand: () => number): string {
  const col = 1 + Math.floor(rand() * 9);
  const row = 1 + Math.floor(rand() * 9);
  const terrain = pick(rand, TERRAINS);
  const label = rand() > 0.7 ? ` ${pick(rand, LABELS)}` : '';
  return `0${col}0${row} ${terrain}${label}`;
}

function randomBlock(rand: () => number): string {
  const lines: string[] = [];

  // Optional comments
  for (let i = 0; i < Math.floor(rand() * 3); i++) {
    lines.push(`# comment line ${i}`);
  }

  // Optional include lines
  for (let i = 0; i < Math.floor(rand() * 4); i++) {
    lines.push(`include ${pick(rand, INCLUDE_FILES)}`);
  }

  // 0–10 terrain lines
  const hexCount = Math.floor(rand() * 11);
  for (let i = 0; i < hexCount; i++) {
    lines.push(randomHex(rand));
  }

  return lines.join('\n');
}

function randomErrorMessage(rand: () => number): string | undefined {
  if (rand() < 0.3) return undefined;
  const msgs = [
    'Renderer not available',
    'Canvas API missing',
    'Timeout exceeded',
    'Plugin not installed',
    '',
  ];
  return pick(rand, msgs);
}

// ---------------------------------------------------------------------------
// Fuzz suite
// ---------------------------------------------------------------------------

const SAMPLES = 1000;

describe('fuzz — altForTextMapper', () => {
  it('never throws for any block content', () => {
    const rand = lcg(0xfacade42);
    for (let i = 0; i < SAMPLES; i++) {
      const block = randomBlock(rand);
      assert.doesNotThrow(
        () => altForTextMapper(block),
        `altForTextMapper threw for block: ${JSON.stringify(block.slice(0, 80))}`,
      );
    }
  });

  it('always returns a non-empty string', () => {
    const rand = lcg(0xc001beef);
    for (let i = 0; i < SAMPLES; i++) {
      const block = randomBlock(rand);
      const result = altForTextMapper(block);
      assert.ok(
        typeof result === 'string' && result.length > 0,
        `altForTextMapper returned empty for block: ${JSON.stringify(block.slice(0, 80))}`,
      );
    }
  });

  it('handles empty and whitespace-only blocks without throwing', () => {
    const empties = ['', ' ', '\n', '\t', '\r\n', '   \n   '];
    for (const block of empties) {
      assert.doesNotThrow(
        () => altForTextMapper(block),
        `altForTextMapper threw for empty/whitespace block: ${JSON.stringify(block)}`,
      );
    }
  });
});

describe('fuzz — extractIncludes', () => {
  it('never throws for any block content', () => {
    const rand = lcg(0x0d15ea5e);
    for (let i = 0; i < SAMPLES; i++) {
      const block = randomBlock(rand);
      assert.doesNotThrow(
        () => extractIncludes(block),
        `extractIncludes threw for block: ${JSON.stringify(block.slice(0, 80))}`,
      );
    }
  });

  it('always returns an array', () => {
    const rand = lcg(0xbaaaaaad);
    for (let i = 0; i < SAMPLES; i++) {
      const block = randomBlock(rand);
      const result = extractIncludes(block);
      assert.ok(Array.isArray(result), `extractIncludes returned non-array for block: ${JSON.stringify(block.slice(0, 80))}`);
    }
  });

  it('never returns an array containing undefined or null', () => {
    const rand = lcg(0xfeedfeed);
    for (let i = 0; i < SAMPLES; i++) {
      const block = randomBlock(rand);
      const result = extractIncludes(block);
      for (const item of result) {
        assert.ok(item !== null && item !== undefined, `extractIncludes returned null/undefined in result`);
        assert.ok(typeof item === 'string', `extractIncludes returned non-string item: ${JSON.stringify(item)}`);
      }
    }
  });
});

describe('fuzz — buildPlaceholder', () => {
  it('never throws for any error message input', () => {
    const rand = lcg(0x1badf00d);
    for (let i = 0; i < SAMPLES; i++) {
      const errMsg = randomErrorMessage(rand);
      assert.doesNotThrow(
        () => buildPlaceholder(errMsg),
        `buildPlaceholder threw for error: ${JSON.stringify(errMsg)}`,
      );
    }
  });

  it('always returns a non-empty string containing a warning comment', () => {
    const rand = lcg(0xdeadf00d);
    for (let i = 0; i < SAMPLES; i++) {
      const errMsg = randomErrorMessage(rand);
      const result = buildPlaceholder(errMsg);
      assert.ok(
        typeof result === 'string' && result.length > 0,
        `buildPlaceholder returned empty for error: ${JSON.stringify(errMsg)}`,
      );
      assert.match(
        result,
        /<!--.*Warning.*-->/s,
        `buildPlaceholder output lacks a warning comment for error: ${JSON.stringify(errMsg)}`,
      );
    }
  });

  it('never starts a code fence in its output', () => {
    const rand = lcg(0xcafed00d);
    for (let i = 0; i < SAMPLES; i++) {
      const errMsg = randomErrorMessage(rand);
      const result = buildPlaceholder(errMsg);
      assert.doesNotMatch(
        result,
        /^```/m,
        `buildPlaceholder output starts a code fence for error: ${JSON.stringify(errMsg)}`,
      );
    }
  });
});
