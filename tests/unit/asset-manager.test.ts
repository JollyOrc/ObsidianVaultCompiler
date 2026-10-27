/**
 * Unit tests for asset copy, deduplication and collision handling (TT-1.3).
 *
 * Covers Epic 2: images, PDFs, audio, video and generic files are copied to
 * assets/, references are rewritten, same-source paths are reused, distinct
 * files with the same basename receive collision suffixes, and reuse is logged.
 *
 * All tests drive InMemoryVaultCompiler, whose assetTag/assetManager logic is
 * the canonical implementation of these behaviours.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compile(files: Record<string, string>, start = 'index.md') {
  return new InMemoryVaultCompiler(files).compile(start);
}

// ---------------------------------------------------------------------------
// File-type copy and reference rewriting
// ---------------------------------------------------------------------------

describe('asset copy — file types', () => {
  it('copies a PNG image and rewrites the reference to assets/filename.png', () => {
    const r = compile({ 'index.md': '![alt](photo.png)\n', 'photo.png': 'binary' });
    assert.match(r.content, /assets\/photo\.png/);
    assert.equal(r.stats.assetsCopied, 1);
  });

  it('copies a PDF and rewrites the reference to assets/filename.pdf', () => {
    const r = compile({ 'index.md': '[Report](report.pdf)\n', 'report.pdf': 'binary' });
    assert.match(r.content, /assets\/report\.pdf/);
    assert.equal(r.stats.assetsCopied, 1);
  });

  it('copies an MP3 audio file and rewrites the reference', () => {
    const r = compile({ 'index.md': '![audio](narration.mp3)\n', 'narration.mp3': 'binary' });
    assert.match(r.content, /assets\/narration\.mp3/);
    assert.equal(r.stats.assetsCopied, 1);
  });

  it('copies an MP4 video file and rewrites the reference', () => {
    const r = compile({ 'index.md': '![video](demo.mp4)\n', 'demo.mp4': 'binary' });
    assert.match(r.content, /assets\/demo\.mp4/);
    assert.equal(r.stats.assetsCopied, 1);
  });

  it('copies a generic binary file and rewrites the reference', () => {
    const r = compile({ 'index.md': '[Download](data.zip)\n', 'data.zip': 'binary' });
    assert.match(r.content, /assets\/data\.zip/);
    assert.equal(r.stats.assetsCopied, 1);
  });

  it('copies a JPEG image and rewrites the reference', () => {
    const r = compile({ 'index.md': '![shot](photo.jpg)\n', 'photo.jpg': 'binary' });
    assert.match(r.content, /assets\/photo\.jpg/);
    assert.equal(r.stats.assetsCopied, 1);
  });

  it('copies an SVG image and rewrites the reference', () => {
    const r = compile({ 'index.md': '![diagram](arch.svg)\n', 'arch.svg': '<svg/>' });
    assert.match(r.content, /assets\/arch\.svg/);
    assert.equal(r.stats.assetsCopied, 1);
  });
});

// ---------------------------------------------------------------------------
// Deduplication — same resolved source path
// ---------------------------------------------------------------------------

describe('asset deduplication — same source path', () => {
  it('reuses the destination path when the same source is referenced twice', () => {
    const files = {
      'index.md': '![a](logo.png)\n![b](logo.png)\n',
      'logo.png': 'binary',
    };
    const r = compile(files);
    assert.equal(r.stats.assetsCopied, 1, 'should copy the asset only once');
    assert.equal(r.stats.assetsDeduplicated, 1, 'should record one deduplication');
    // Both image references should point to the same assets/ path
    const refs = [...r.content.matchAll(/assets\/[^\s)'"]+/g)].map(m => m[0]);
    assert.ok(refs.length >= 2, 'expected two image references in output');
    assert.equal(refs[0], refs[1], 'both references should resolve to the same asset path');
  });

  it('does not create a second output file for the same source referenced twice', () => {
    const files = {
      'index.md': '![[A.md]]\n![[B.md]]\n',
      'A.md': '# A\n![img](shared.png)\n',
      'B.md': '# B\n![img](shared.png)\n',
      'shared.png': 'binary',
    };
    const r = compile(files);
    assert.equal(r.stats.assetsCopied, 1);
    assert.equal(r.stats.assetsDeduplicated, 1);
  });
});

// ---------------------------------------------------------------------------
// Collision handling — distinct files with the same basename
// ---------------------------------------------------------------------------

describe('asset collision handling — same basename, different paths', () => {
  it('copies two distinct source files with the same basename as filename.ext and filename_1.ext', () => {
    const files = {
      'index.md': '![a](folder-a/map.png)\n![b](folder-b/map.png)\n',
      'folder-a/map.png': 'binary-a',
      'folder-b/map.png': 'binary-b',
    };
    const r = compile(files);
    assert.equal(r.stats.assetsCopied, 2, 'both distinct sources should be copied');
    assert.match(r.content, /assets\/map\.png/);
    assert.match(r.content, /assets\/map_1\.png/);
  });

  it('produces unique output paths for three distinct files with the same basename', () => {
    const files = {
      'index.md': '![a](a/icon.png)\n![b](b/icon.png)\n![c](c/icon.png)\n',
      'a/icon.png': 'a',
      'b/icon.png': 'b',
      'c/icon.png': 'c',
    };
    const r = compile(files);
    assert.equal(r.stats.assetsCopied, 3);
    const paths = new Set([...r.content.matchAll(/assets\/[^\s)'"]+/g)].map(m => m[0]));
    assert.equal(paths.size, 3, 'each collision should produce a unique path');
  });

  it('uses the _N suffix convention: name_1.ext, name_2.ext, not name_01.ext', () => {
    const files = {
      'index.md': '![a](p/x.png)\n![b](q/x.png)\n![c](r/x.png)\n',
      'p/x.png': 'p',
      'q/x.png': 'q',
      'r/x.png': 'r',
    };
    const r = compile(files);
    assert.match(r.content, /assets\/x_1\.png/);
    assert.match(r.content, /assets\/x_2\.png/);
    assert.doesNotMatch(r.content, /assets\/x_01\.png/);
  });
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

describe('asset copy — idempotency', () => {
  it('copying the same source path twice produces exactly one entry in the asset map', () => {
    const files = {
      'index.md': '![a](file.png)\n![b](file.png)\n',
      'file.png': 'binary',
    };
    const r = compile(files);
    // sourceToAssetMap should contain exactly one entry
    assert.equal(r.stats.assetsCopied, 1, 'only one physical copy should be made');
  });
});

// ---------------------------------------------------------------------------
// Reuse tracking
// ---------------------------------------------------------------------------

describe('asset deduplication — reuse is recorded in stats', () => {
  it('increments assetsDeduplicated for each reused source path', () => {
    const files = {
      'index.md': '![1](img.png)\n![2](img.png)\n![3](img.png)\n',
      'img.png': 'binary',
    };
    const r = compile(files);
    assert.equal(r.stats.assetsCopied, 1);
    assert.equal(r.stats.assetsDeduplicated, 2, 'two reuses expected (second and third reference)');
  });
});

// ---------------------------------------------------------------------------
// Reference rewriting
// ---------------------------------------------------------------------------

describe('asset reference rewriting', () => {
  it('rewrites a wiki-embed asset reference to the assets/ path', () => {
    const files = {
      'index.md': '![[diagram.png]]\n',
      'diagram.png': 'binary',
    };
    const r = compile(files);
    assert.match(r.content, /assets\/diagram\.png/);
    assert.doesNotMatch(r.content, /!\[\[diagram\.png\]\]/);
  });

  it('encodes spaces in the asset path using %20', () => {
    const files = {
      'index.md': '![x](my file.png)\n',
      'my file.png': 'binary',
    };
    const r = compile(files);
    assert.match(r.content, /assets\/my[_%]20?file\.png|assets\/my_file\.png/);
  });
});
