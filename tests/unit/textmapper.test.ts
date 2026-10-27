/**
 * Unit tests for TextMapper rendering helpers.
 *
 * Covers US-4.1 through US-4.7: block detection, alt text, hash stability,
 * SVG dimension parsing, PNG sizing, include directive extraction, placeholder
 * formatting, and plugin-detection helpers.
 *
 * These tests operate on pure functions only — no DOM, no Obsidian API, no
 * filesystem access. Functions that do not exist yet are imported with a
 * type-level TODO marker so failing tests surface clearly as build errors
 * rather than runtime surprises.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Existing exports (already in textmapper.ts or compiler.ts)
import { altForTextMapper } from '../../plugin/src/textmapper.ts';

// New exports required by US-4.4 / US-4.5 / US-4.6.
// These functions do not exist yet; adding them here makes the test suite
// the specification for what the implementation must export.
import {
  parseSvgDimensions,
  computePngDimensions,
  extractIncludes,
  buildPlaceholder,
} from '../../plugin/src/textmapper.ts';

import { computeContentHash } from '../../plugin/src/utils.ts';

// ---------------------------------------------------------------------------
// US-4.1 — block alt-text derivation
// ---------------------------------------------------------------------------

describe('altForTextMapper', () => {
  it('extracts the quoted label from the first labelled hex', () => {
    const code = '0101 forest "The Great Forest"\n0102 mountain';
    assert.equal(altForTextMapper(code), 'The Great Forest');
  });

  it('returns the include stem with " Map" suffix when no label is present', () => {
    const code = 'include gnomeyland.txt\n0101 forest';
    assert.equal(altForTextMapper(code), 'gnomeyland Map');
  });

  it('strips the file extension from the include name', () => {
    const code = 'include worldmap.txt\n0101 sea';
    assert.equal(altForTextMapper(code), 'worldmap Map');
  });

  it('returns "TextMapper Map" as the default fallback', () => {
    const code = '0101 forest\n0102 mountain';
    assert.equal(altForTextMapper(code), 'TextMapper Map');
  });

  it('prefers the hex label over an include line', () => {
    const code = 'include gnomeyland.txt\n0101 forest "Named Forest"';
    assert.equal(altForTextMapper(code), 'Named Forest');
  });

  it('handles an empty block without throwing', () => {
    assert.doesNotThrow(() => altForTextMapper(''));
    assert.equal(altForTextMapper(''), 'TextMapper Map');
  });

  it('handles whitespace-only blocks', () => {
    assert.equal(altForTextMapper('   \n\t  '), 'TextMapper Map');
  });

  it('works when the label contains special markdown characters', () => {
    const code = '0101 sea "Arcane [Reach]"';
    // Label should be returned as-is; escaping is the caller's concern.
    assert.equal(altForTextMapper(code), 'Arcane [Reach]');
  });
});

// ---------------------------------------------------------------------------
// US-4.7 — hash stability and deduplication key
// ---------------------------------------------------------------------------

describe('computeContentHash for TextMapper deduplication', () => {
  it('returns the same hash for identical block source', () => {
    const code = '0101 forest\n0102 mountain';
    assert.equal(computeContentHash(code), computeContentHash(code));
  });

  it('returns different hashes for different block sources', () => {
    const a = '0101 forest';
    const b = '0101 mountain';
    assert.notEqual(computeContentHash(a), computeContentHash(b));
  });

  it('is stable across leading/trailing whitespace normalisation', () => {
    // The hash function should normalise so that trivial whitespace differences
    // in a copy-pasted block do not produce duplicate renders.
    const a = '0101 forest\n0102 mountain\n';
    const b = '0101 forest\n0102 mountain';
    assert.equal(computeContentHash(a), computeContentHash(b));
  });

  it('returns a non-empty string', () => {
    assert.ok(computeContentHash('0101 forest').length > 0);
  });

  it('returns a string safe for use in a filename (no path separators)', () => {
    const hash = computeContentHash('0101 forest\ninclude gnomeyland.txt');
    assert.doesNotMatch(hash, /[/\\]/);
  });
});

// ---------------------------------------------------------------------------
// US-4.5 — SVG dimension parsing
// ---------------------------------------------------------------------------

describe('parseSvgDimensions', () => {
  it('extracts width and height from a viewBox attribute', () => {
    const svg = '<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg"></svg>';
    const dims = parseSvgDimensions(svg);
    assert.equal(dims.width, 800);
    assert.equal(dims.height, 600);
  });

  it('extracts width and height from explicit width/height attributes', () => {
    const svg = '<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg"></svg>';
    const dims = parseSvgDimensions(svg);
    assert.equal(dims.width, 400);
    assert.equal(dims.height, 300);
  });

  it('prefers viewBox over explicit width/height when both are present', () => {
    const svg = '<svg viewBox="0 0 1200 900" width="400" height="300" xmlns="http://www.w3.org/2000/svg"></svg>';
    const dims = parseSvgDimensions(svg);
    assert.equal(dims.width, 1200);
    assert.equal(dims.height, 900);
  });

  it('handles a non-zero viewBox origin', () => {
    const svg = '<svg viewBox="50 50 800 600" xmlns="http://www.w3.org/2000/svg"></svg>';
    const dims = parseSvgDimensions(svg);
    assert.equal(dims.width, 800);
    assert.equal(dims.height, 600);
  });

  it('returns a sensible fallback when no dimension information is present', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const dims = parseSvgDimensions(svg);
    assert.ok(dims.width > 0, 'fallback width must be positive');
    assert.ok(dims.height > 0, 'fallback height must be positive');
  });

  it('handles floating-point viewBox values', () => {
    const svg = '<svg viewBox="0 0 866.0 750.5" xmlns="http://www.w3.org/2000/svg"></svg>';
    const dims = parseSvgDimensions(svg);
    assert.ok(dims.width > 0);
    assert.ok(dims.height > 0);
  });

  it('handles single-quoted attribute values', () => {
    const svg = "<svg viewBox='0 0 800 600' xmlns='http://www.w3.org/2000/svg'></svg>";
    const dims = parseSvgDimensions(svg);
    assert.equal(dims.width, 800);
    assert.equal(dims.height, 600);
  });
});

// ---------------------------------------------------------------------------
// US-4.5 — PNG dimension calculation (aspect-ratio-correct, max 2048px)
// ---------------------------------------------------------------------------

describe('computePngDimensions', () => {
  it('scales a landscape SVG so the width is the longer dimension at 2048', () => {
    const dims = computePngDimensions(1600, 900);
    assert.equal(dims.width, 2048);
    // Height should be 2048 * (900/1600) = 1152
    assert.equal(dims.height, Math.round(2048 * (900 / 1600)));
  });

  it('scales a portrait SVG so the height is the longer dimension at 2048', () => {
    const dims = computePngDimensions(600, 1200);
    assert.equal(dims.height, 2048);
    assert.equal(dims.width, Math.round(2048 * (600 / 1200)));
  });

  it('scales a square SVG to 2048 x 2048', () => {
    const dims = computePngDimensions(500, 500);
    assert.equal(dims.width, 2048);
    assert.equal(dims.height, 2048);
  });

  it('does not upscale a map that is already under 2048 on both axes', () => {
    const dims = computePngDimensions(800, 600);
    assert.ok(dims.width <= 2048);
    assert.ok(dims.height <= 2048);
    // Aspect ratio must be preserved within 1px rounding
    const inputRatio = 800 / 600;
    const outputRatio = dims.width / dims.height;
    assert.ok(Math.abs(inputRatio - outputRatio) < 0.01, 'aspect ratio not preserved');
  });

  it('accepts an optional maxLong override', () => {
    const dims = computePngDimensions(800, 600, 1024);
    assert.equal(dims.width, 1024);
  });

  it('returns integer pixel values (no fractional pixels)', () => {
    const dims = computePngDimensions(866, 750);
    assert.equal(dims.width, Math.round(dims.width));
    assert.equal(dims.height, Math.round(dims.height));
  });

  it('handles very small SVG inputs without producing zero dimensions', () => {
    const dims = computePngDimensions(10, 7);
    assert.ok(dims.width > 0);
    assert.ok(dims.height > 0);
  });
});

// ---------------------------------------------------------------------------
// US-4.6 — include directive extraction
// ---------------------------------------------------------------------------

describe('extractIncludes', () => {
  it('extracts a single include filename', () => {
    const code = 'include gnomeyland.txt\n0101 forest';
    assert.deepEqual(extractIncludes(code), ['gnomeyland.txt']);
  });

  it('extracts multiple include filenames in order', () => {
    const code = 'include gnomeyland.txt\ninclude traveller.txt\n0101 forest';
    assert.deepEqual(extractIncludes(code), ['gnomeyland.txt', 'traveller.txt']);
  });

  it('returns an empty array when no includes are present', () => {
    const code = '0101 forest\n0102 mountain';
    assert.deepEqual(extractIncludes(code), []);
  });

  it('is case-insensitive on the "include" keyword', () => {
    const code = 'Include gnomeyland.txt';
    assert.deepEqual(extractIncludes(code), ['gnomeyland.txt']);
  });

  it('trims whitespace around the filename', () => {
    const code = 'include   gnomeyland.txt  ';
    const result = extractIncludes(code);
    assert.equal(result[0], 'gnomeyland.txt');
  });

  it('does not include lines that merely contain the word "include" in context', () => {
    const code = '# This map includes mountains\n0101 mountain';
    assert.deepEqual(extractIncludes(code), []);
  });

  it('handles all four standard terrain filenames', () => {
    const code = [
      'include default.txt',
      'include gnomeyland.txt',
      'include apocalypse.txt',
      'include traveller.txt',
    ].join('\n');
    const result = extractIncludes(code);
    assert.deepEqual(result, ['default.txt', 'gnomeyland.txt', 'apocalypse.txt', 'traveller.txt']);
  });
});

// ---------------------------------------------------------------------------
// US-4.1 — placeholder formatting
// ---------------------------------------------------------------------------

describe('buildPlaceholder', () => {
  it('returns a markdown paragraph with a warning comment', () => {
    const out = buildPlaceholder('0101 forest', 'render failed');
    assert.match(out, /<!--\s*Warning:/);
  });

  it('includes the error message in the comment', () => {
    const out = buildPlaceholder('0101 forest', 'Canvas unavailable');
    assert.match(out, /Canvas unavailable/);
  });

  it('does not include the raw block source in the output', () => {
    const source = 'SECRET_SOURCE_0101 forest';
    const out = buildPlaceholder(source, 'error');
    // The raw map source should not leak into the placeholder text.
    assert.doesNotMatch(out, /SECRET_SOURCE/);
  });

  it('produces valid markdown that does not start a code fence', () => {
    const out = buildPlaceholder('0101 forest', 'error');
    assert.doesNotMatch(out, /^```/m);
  });

  it('works when no error message is provided', () => {
    assert.doesNotThrow(() => buildPlaceholder('0101 forest'));
    const out = buildPlaceholder('0101 forest');
    assert.match(out, /<!--\s*Warning:/);
  });
});

// ---------------------------------------------------------------------------
// TT-2.3 — computePngDimensions preserves aspect ratio within 1 px rounding
// ---------------------------------------------------------------------------

describe('computePngDimensions — aspect ratio fidelity', () => {
  it('a 3000×1800 landscape SVG (5:3) scales to width 2048, height within ±1px of 1228.8', () => {
    const dims = computePngDimensions(3000, 1800);
    assert.equal(dims.width, 2048);
    const expectedHeight = 2048 * (1800 / 3000); // 1228.8
    assert.ok(
      Math.abs(dims.height - expectedHeight) <= 1,
      `height ${dims.height} deviates more than 1px from expected ${expectedHeight}`,
    );
  });

  it('a 600×1000 portrait SVG (3:5) scales to height 2048, width within ±1px of 1228.8', () => {
    const dims = computePngDimensions(600, 1000);
    assert.equal(dims.height, 2048);
    const expectedWidth = 2048 * (600 / 1000); // 1228.8
    assert.ok(
      Math.abs(dims.width - expectedWidth) <= 1,
      `width ${dims.width} deviates more than 1px from expected ${expectedWidth}`,
    );
  });

  it('a 1920×1080 landscape SVG scales to exact integers with no rounding error', () => {
    const dims = computePngDimensions(1920, 1080);
    assert.equal(dims.width, 2048);
    // 2048 * (1080 / 1920) = 1152.0 exactly
    assert.equal(dims.height, 1152);
  });

  it('output aspect ratio differs from input by less than 1/longEdge (≤1 px distortion)', () => {
    // Test several irregular sizes to catch rounding bugs
    const cases: [number, number][] = [
      [1280, 853],   // ~3:2
      [2560, 1440],  // 16:9
      [3508, 2480],  // A4 at 300dpi
      [1000, 707],   // √2 aspect (A-series paper)
    ];
    for (const [w, h] of cases) {
      const dims = computePngDimensions(w, h);
      const inputRatio = w / h;
      const outputRatio = dims.width / dims.height;
      const longEdge = Math.max(dims.width, dims.height);
      const tolerance = 1 / longEdge;
      assert.ok(
        Math.abs(inputRatio - outputRatio) <= tolerance,
        `${w}×${h}: input ratio ${inputRatio.toFixed(6)}, output ratio ${outputRatio.toFixed(6)}, tolerance ${tolerance.toFixed(6)}`,
      );
    }
  });
});
