/**
 * Fuzz tests for slugification (TT-1.8).
 *
 * Generates 1,000 random strings containing Unicode, spaces, underscores,
 * punctuation and numeric prefixes and asserts that slugify():
 *   - returns a non-empty string
 *   - contains no path separator characters (/, \, :)
 *   - is deterministic (same input → same output)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../../plugin/src/utils.ts';

// ---------------------------------------------------------------------------
// Deterministic pseudo-random generator (no external dependencies)
// ---------------------------------------------------------------------------

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223;
    return (s >>> 0) / 2 ** 32;
  };
}

function randomString(rand: () => number, maxLen = 40): string {
  const pools = [
    'abcdefghijklmnopqrstuvwxyz',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    '0123456789',
    ' _-.',
    '!@#$%^&*()[]{}',
    'éäüöàèê',  // accented
    '中文',                                   // CJK
    '😀',                                   // emoji
  ];
  const len = Math.max(1, Math.floor(rand() * maxLen));
  let s = '';
  for (let i = 0; i < len; i++) {
    const pool = pools[Math.floor(rand() * pools.length)];
    s += pool[Math.floor(rand() * pool.length)];
  }
  return s;
}

function numericPrefix(rand: () => number): string {
  const depth = 1 + Math.floor(rand() * 3);
  const parts = Array.from({ length: depth }, () => 1 + Math.floor(rand() * 9));
  return parts.join('.') + ' ';
}

// ---------------------------------------------------------------------------
// Fuzz suite
// ---------------------------------------------------------------------------

const SAMPLES = 1000;

describe('fuzz — slugify', () => {
  it('returns a non-empty string for any non-empty input', () => {
    const rand = lcg(0xdeadbeef);
    for (let i = 0; i < SAMPLES; i++) {
      const input = randomString(rand);
      const result = slugify(input);
      assert.ok(
        typeof result === 'string' && result.length > 0,
        `slugify(${JSON.stringify(input)}) returned empty or non-string: ${JSON.stringify(result)}`,
      );
    }
  });

  it('never contains path separator characters (/, \\, :)', () => {
    const rand = lcg(0xcafebabe);
    for (let i = 0; i < SAMPLES; i++) {
      const input = randomString(rand);
      const result = slugify(input);
      assert.doesNotMatch(
        result,
        /[/\\:]/,
        `slugify(${JSON.stringify(input)}) contains a path separator: ${JSON.stringify(result)}`,
      );
    }
  });

  it('is deterministic — same input always produces the same output', () => {
    const rand = lcg(0x12345678);
    for (let i = 0; i < SAMPLES; i++) {
      const input = randomString(rand);
      assert.equal(
        slugify(input),
        slugify(input),
        `slugify(${JSON.stringify(input)}) is not deterministic`,
      );
    }
  });

  it('handles numeric prefixes without throwing', () => {
    const rand = lcg(0xabcdef01);
    for (let i = 0; i < SAMPLES; i++) {
      const input = numericPrefix(rand) + randomString(rand, 20);
      let result: string;
      assert.doesNotThrow(() => {
        result = slugify(input);
      }, `slugify threw for numeric prefix input: ${JSON.stringify(input)}`);
      assert.ok(result!.length > 0, `slugify returned empty for: ${JSON.stringify(input)}`);
    }
  });

  it('handles empty string without throwing', () => {
    // Edge case: empty input
    assert.doesNotThrow(() => slugify(''));
  });

  it('handles a string of only whitespace without throwing', () => {
    const rand = lcg(0xffffffff);
    for (let i = 0; i < 50; i++) {
      const spaces = ' '.repeat(1 + Math.floor(rand() * 20));
      assert.doesNotThrow(
        () => slugify(spaces),
        `slugify threw for whitespace-only input of length ${spaces.length}`,
      );
    }
  });
});
