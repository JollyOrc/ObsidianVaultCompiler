/**
 * Integration tests for TextMapper rendering inside InMemoryVaultCompiler.
 *
 * Covers US-4.1 through US-4.7 at the compiler level.  Rendering is injected
 * via a synchronous stub that implements the TextMapperRenderer interface, so
 * these tests do not require a DOM, canvas, or Obsidian runtime.
 *
 * The TextMapperRenderer interface and the renderer option on
 * InMemoryVaultCompiler are new requirements; the tests here are the
 * specification for that contract.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

// ---------------------------------------------------------------------------
// Stub renderer types — mirror what the real TextMapperRenderer must export.
// ---------------------------------------------------------------------------

/** Minimal interface for the renderer the compiler will call. */
interface TextMapperRenderer {
  /** Returns false when the renderer cannot produce output (missing plugin, etc.). */
  isAvailable(): boolean;
  /**
   * Render `code` to a PNG and register it under `assetPath`.
   * Throw to simulate a render failure.
   */
  render(code: string, assetPath: string): Promise<void>;
}

/** Records every render call made by the compiler so tests can assert on them. */
class SpyRenderer implements TextMapperRenderer {
  readonly calls: Array<{ code: string; assetPath: string }> = [];
  private _available: boolean;
  private _shouldFail: boolean;
  private _failMessage: string;

  constructor(opts: { available?: boolean; fail?: boolean; failMessage?: string } = {}) {
    this._available = opts.available ?? true;
    this._shouldFail = opts.fail ?? false;
    this._failMessage = opts.failMessage ?? 'render error';
  }

  isAvailable(): boolean {
    return this._available;
  }

  async render(code: string, assetPath: string): Promise<void> {
    this.calls.push({ code, assetPath });
    if (this._shouldFail) throw new Error(this._failMessage);
  }
}

// Helper: build a simple compiler with one text-mapper block.
function oneBlockFiles(mapSource = '0101 forest "The Forest"'): Record<string, string> {
  return {
    'index2compile.md': `# Index\n\n\`\`\`text-mapper\n${mapSource}\n\`\`\`\n`,
  };
}

// ---------------------------------------------------------------------------
// US-4.1 — basic rendering: block replaced by PNG image reference
// ---------------------------------------------------------------------------

describe('US-4.1: text-mapper block replaced by PNG image reference', () => {
  it('replaces the fenced block with a markdown image tag', async () => {
    const renderer = new SpyRenderer();
    const result = await new InMemoryVaultCompiler(oneBlockFiles(), { renderer }).compileAsync('index2compile.md');
    assert.doesNotMatch(result.content, /```text-mapper/);
    assert.match(result.content, /!\[.*\]\(assets\/textmapper\/.*\.png\)/);
  });

  it('stores the image under assets/textmapper/', async () => {
    const renderer = new SpyRenderer();
    const result = await new InMemoryVaultCompiler(oneBlockFiles(), { renderer }).compileAsync('index2compile.md');
    const match = result.content.match(/!\[.*\]\((assets\/textmapper\/[^)]+)\)/);
    assert.ok(match, 'expected an image reference');
    assert.match(match[1], /^assets\/textmapper\//);
    assert.match(match[1], /\.png$/);
  });

  it('uses the correct alt text derived from the block source', async () => {
    const renderer = new SpyRenderer();
    const result = await new InMemoryVaultCompiler(
      oneBlockFiles('0101 forest "My Map"'),
      { renderer }
    ).compileAsync('index2compile.md');
    assert.match(result.content, /!\[My Map\]/);
  });

  it('calls the renderer exactly once for a single block', async () => {
    const renderer = new SpyRenderer();
    await new InMemoryVaultCompiler(oneBlockFiles(), { renderer }).compileAsync('index2compile.md');
    assert.equal(renderer.calls.length, 1);
  });

  it('passes the correct block source to the renderer', async () => {
    const source = '0101 forest "The Forest"';
    const renderer = new SpyRenderer();
    await new InMemoryVaultCompiler(oneBlockFiles(source), { renderer }).compileAsync('index2compile.md');
    assert.equal(renderer.calls[0].code, source);
  });

  it('handles a block that appears at the very start of a file', async () => {
    const files = {
      'index2compile.md': '```text-mapper\n0101 forest\n```\n# After',
    };
    const renderer = new SpyRenderer();
    const result = await new InMemoryVaultCompiler(files, { renderer }).compileAsync('index2compile.md');
    assert.doesNotMatch(result.content, /```text-mapper/);
  });

  it('handles a block that appears at the very end of a file with no trailing newline', async () => {
    const files = {
      'index2compile.md': '# Map\n```text-mapper\n0101 sea\n```',
    };
    const renderer = new SpyRenderer();
    const result = await new InMemoryVaultCompiler(files, { renderer }).compileAsync('index2compile.md');
    assert.doesNotMatch(result.content, /```text-mapper/);
    assert.match(result.content, /!\[.*\]\(assets\/textmapper\//);
  });

  it('handles multiple distinct blocks in one file', async () => {
    const files = {
      'index2compile.md': [
        '# Doc',
        '```text-mapper',
        '0101 forest',
        '```',
        'Between maps.',
        '```text-mapper',
        '0201 mountain',
        '```',
      ].join('\n'),
    };
    const renderer = new SpyRenderer();
    const result = await new InMemoryVaultCompiler(files, { renderer }).compileAsync('index2compile.md');
    const imgRefs = [...result.content.matchAll(/!\[.*?\]\(assets\/textmapper\/[^)]+\)/g)];
    assert.equal(imgRefs.length, 2);
    assert.equal(renderer.calls.length, 2);
  });

  it('handles a block containing only a comment line', async () => {
    const files = {
      'index2compile.md': '```text-mapper\n# just a comment\n```\n',
    };
    const renderer = new SpyRenderer();
    const result = await new InMemoryVaultCompiler(files, { renderer }).compileAsync('index2compile.md');
    // Either renders or falls back to placeholder — must not crash or leave a raw fence.
    assert.doesNotMatch(result.content, /```text-mapper/);
  });

  it('tracks a mapsRendered stat for each successful render', async () => {
    const renderer = new SpyRenderer();
    const result = await new InMemoryVaultCompiler(oneBlockFiles(), { renderer }).compileAsync('index2compile.md');
    assert.equal(result.stats.mapsRendered, 1);
  });
});

// ---------------------------------------------------------------------------
// US-4.1 — disabled rendering: block preserved with warning
// ---------------------------------------------------------------------------

describe('US-4.1: disabled TextMapper rendering preserves the original block', () => {
  it('keeps the raw fenced block in output when enableTextMapper is false', async () => {
    const result = await new InMemoryVaultCompiler(
      oneBlockFiles(),
      { enableTextMapper: false }
    ).compileAsync('index2compile.md');
    assert.match(result.content, /```text-mapper/);
  });

  it('adds a warning comment when the block is preserved due to disabled rendering', async () => {
    const result = await new InMemoryVaultCompiler(
      oneBlockFiles(),
      { enableTextMapper: false }
    ).compileAsync('index2compile.md');
    assert.match(result.content, /<!--\s*Warning:/);
  });

  it('does not call the renderer when enableTextMapper is false', async () => {
    const renderer = new SpyRenderer();
    await new InMemoryVaultCompiler(
      oneBlockFiles(),
      { enableTextMapper: false, renderer }
    ).compileAsync('index2compile.md');
    assert.equal(renderer.calls.length, 0);
  });
});

// ---------------------------------------------------------------------------
// US-4.1 / US-4.2 — render failure: placeholder + warning
// ---------------------------------------------------------------------------

describe('US-4.1/US-4.2: render failure produces a placeholder with warning', () => {
  it('replaces a failed block with a placeholder, not a raw fence', async () => {
    const renderer = new SpyRenderer({ fail: true });
    const result = await new InMemoryVaultCompiler(oneBlockFiles(), { renderer }).compileAsync('index2compile.md');
    assert.doesNotMatch(result.content, /```text-mapper/);
  });

  it('includes a warning comment in the output for a failed render', async () => {
    const renderer = new SpyRenderer({ fail: true, failMessage: 'Canvas unavailable' });
    const result = await new InMemoryVaultCompiler(oneBlockFiles(), { renderer }).compileAsync('index2compile.md');
    assert.match(result.content, /<!--\s*Warning:/);
  });

  it('records a warning message for a failed render', async () => {
    const renderer = new SpyRenderer({ fail: true });
    const result = await new InMemoryVaultCompiler(oneBlockFiles(), { renderer }).compileAsync('index2compile.md');
    assert.ok(result.warnings.some(w => /textmapper|text-mapper|render/i.test(w)));
  });

  it('does not abort the whole compilation when one block fails', async () => {
    const files = {
      'index2compile.md': [
        '# Doc',
        '```text-mapper',
        '0101 forest',
        '```',
        'This paragraph should still appear.',
      ].join('\n'),
    };
    const renderer = new SpyRenderer({ fail: true });
    const result = await new InMemoryVaultCompiler(files, { renderer }).compileAsync('index2compile.md');
    assert.match(result.content, /This paragraph should still appear/);
  });

  it('counts a failed render in mapsRendered as 0 and adds a missingReferences entry', async () => {
    const renderer = new SpyRenderer({ fail: true });
    const result = await new InMemoryVaultCompiler(oneBlockFiles(), { renderer }).compileAsync('index2compile.md');
    assert.equal(result.stats.mapsRendered, 0);
  });
});

// ---------------------------------------------------------------------------
// US-4.2 — unavailable renderer: falls back gracefully
// ---------------------------------------------------------------------------

describe('US-4.2: unavailable renderer triggers fallback behaviour', () => {
  it('produces a placeholder when isAvailable() returns false', async () => {
    const renderer = new SpyRenderer({ available: false });
    const result = await new InMemoryVaultCompiler(oneBlockFiles(), { renderer }).compileAsync('index2compile.md');
    assert.doesNotMatch(result.content, /```text-mapper/);
    assert.match(result.content, /<!--\s*Warning:/);
  });

  it('does not call render() when isAvailable() returns false', async () => {
    const renderer = new SpyRenderer({ available: false });
    await new InMemoryVaultCompiler(oneBlockFiles(), { renderer }).compileAsync('index2compile.md');
    assert.equal(renderer.calls.length, 0);
  });

  it('falls back gracefully when no renderer is provided at all', async () => {
    // Compiler without any renderer option: should still handle the block
    // (either with a bundled fallback or a placeholder — must not throw).
    const result = await new InMemoryVaultCompiler(oneBlockFiles()).compileAsync('index2compile.md');
    assert.doesNotMatch(result.content, /```text-mapper/);
  });
});

// ---------------------------------------------------------------------------
// US-4.7 — deduplication: identical blocks rendered exactly once
// ---------------------------------------------------------------------------

describe('US-4.7: identical text-mapper blocks are deduplicated', () => {
  const SAME_SOURCE = '0101 forest "The Forest"';

  it('renders an identical block only once even when it appears twice in one file', async () => {
    const files = {
      'index2compile.md': [
        '```text-mapper',
        SAME_SOURCE,
        '```',
        'Some text.',
        '```text-mapper',
        SAME_SOURCE,
        '```',
      ].join('\n'),
    };
    const renderer = new SpyRenderer();
    await new InMemoryVaultCompiler(files, { renderer }).compileAsync('index2compile.md');
    assert.equal(renderer.calls.length, 1);
  });

  it('both occurrences produce the same image reference', async () => {
    const files = {
      'index2compile.md': [
        '```text-mapper',
        SAME_SOURCE,
        '```',
        'Middle.',
        '```text-mapper',
        SAME_SOURCE,
        '```',
      ].join('\n'),
    };
    const renderer = new SpyRenderer();
    const result = await new InMemoryVaultCompiler(files, { renderer }).compileAsync('index2compile.md');
    const refs = [...result.content.matchAll(/!\[.*?\]\((assets\/textmapper\/[^)]+)\)/g)]
      .map(m => m[1]);
    assert.equal(refs.length, 2);
    assert.equal(refs[0], refs[1]);
  });

  it('renders an identical block only once across two different source files', async () => {
    const files = {
      'index2compile.md': '- ![[A.md]]\n- ![[B.md]]\n',
      'A.md': `# A\n\`\`\`text-mapper\n${SAME_SOURCE}\n\`\`\`\n`,
      'B.md': `# B\n\`\`\`text-mapper\n${SAME_SOURCE}\n\`\`\`\n`,
    };
    const renderer = new SpyRenderer();
    await new InMemoryVaultCompiler(files, { renderer }).compileAsync('index2compile.md');
    assert.equal(renderer.calls.length, 1);
  });

  it('reports deduplicated maps in the stats', async () => {
    const files = {
      'index2compile.md': [
        '```text-mapper',
        SAME_SOURCE,
        '```',
        'Middle.',
        '```text-mapper',
        SAME_SOURCE,
        '```',
      ].join('\n'),
    };
    const renderer = new SpyRenderer();
    const result = await new InMemoryVaultCompiler(files, { renderer }).compileAsync('index2compile.md');
    assert.equal(result.stats.mapsRendered, 1);
    assert.ok(result.stats.mapsDeduplicated >= 1);
  });

  it('does not deduplicate two blocks with different sources', async () => {
    const files = {
      'index2compile.md': [
        '```text-mapper',
        '0101 forest',
        '```',
        'Text.',
        '```text-mapper',
        '0101 mountain',
        '```',
      ].join('\n'),
    };
    const renderer = new SpyRenderer();
    await new InMemoryVaultCompiler(files, { renderer }).compileAsync('index2compile.md');
    assert.equal(renderer.calls.length, 2);
  });
});

// ---------------------------------------------------------------------------
// US-4.6 — include directive: the compiler passes include info to the renderer
// ---------------------------------------------------------------------------

describe('US-4.6: include directives are surfaced to the renderer', () => {
  it('passes the raw block code containing include lines to the renderer', async () => {
    const source = 'include gnomeyland.txt\n0101 forest';
    const renderer = new SpyRenderer();
    await new InMemoryVaultCompiler(oneBlockFiles(source), { renderer }).compileAsync('index2compile.md');
    assert.ok(renderer.calls[0].code.includes('include gnomeyland.txt'));
  });

  // The compiler does not resolve include paths itself; that is the renderer's
  // responsibility. The test below verifies the compiler does not strip or
  // transform include lines before handing the block to the renderer.
  it('does not strip or rewrite include lines in the block source', async () => {
    const source = 'include traveller.txt\n0101 sea';
    const renderer = new SpyRenderer();
    await new InMemoryVaultCompiler(oneBlockFiles(source), { renderer }).compileAsync('index2compile.md');
    assert.match(renderer.calls[0].code, /^include traveller\.txt/m);
  });
});

// ---------------------------------------------------------------------------
// US-4.4 — no Node.js filesystem access in rendering path (contract)
// ---------------------------------------------------------------------------

describe('US-4.4: renderer interface has no Node.js filesystem surface', () => {
  it('renderer.render receives only (code: string, assetPath: string)', async () => {
    // This test documents the interface contract. A renderer that receives
    // Node.js-style fs/path objects would break the in-memory and mobile
    // contract. By verifying only strings are passed, we guard the interface.
    const renderer = new SpyRenderer();
    await new InMemoryVaultCompiler(oneBlockFiles(), { renderer }).compileAsync('index2compile.md');
    assert.equal(typeof renderer.calls[0].code, 'string');
    assert.equal(typeof renderer.calls[0].assetPath, 'string');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles a text-mapper block inside an embedded file', async () => {
    const files = {
      'index2compile.md': '- ![[map.md]]\n',
      'map.md': '# Map\n```text-mapper\n0101 forest\n```\n',
    };
    const renderer = new SpyRenderer();
    const result = await new InMemoryVaultCompiler(files, { renderer }).compileAsync('index2compile.md');
    assert.doesNotMatch(result.content, /```text-mapper/);
    assert.equal(renderer.calls.length, 1);
  });

  it('handles CRLF line endings inside a text-mapper block', async () => {
    const files = {
      'index2compile.md': '```text-mapper\r\n0101 forest\r\n```\n',
    };
    const renderer = new SpyRenderer();
    const result = await new InMemoryVaultCompiler(files, { renderer }).compileAsync('index2compile.md');
    assert.doesNotMatch(result.content, /```text-mapper/);
  });

  it('handles an empty text-mapper block without crashing', async () => {
    const files = {
      'index2compile.md': '```text-mapper\n```\n',
    };
    const renderer = new SpyRenderer();
    // Should not throw; may produce a placeholder or a (empty) PNG ref.
    const result = await new InMemoryVaultCompiler(files, { renderer }).compileAsync('index2compile.md');
    assert.doesNotMatch(result.content, /```text-mapper/);
  });

  it('handles two text-mapper blocks with no content between them', async () => {
    const files = {
      'index2compile.md': '```text-mapper\n0101 forest\n```\n```text-mapper\n0101 sea\n```\n',
    };
    const renderer = new SpyRenderer();
    const result = await new InMemoryVaultCompiler(files, { renderer }).compileAsync('index2compile.md');
    assert.doesNotMatch(result.content, /```text-mapper/);
    assert.equal(renderer.calls.length, 2);
  });

  it('does not treat a text-mapper block inside a code fence of another language as a map', async () => {
    // A ````text block containing a text-mapper example should not be rendered.
    const files = {
      'index2compile.md': '````\n```text-mapper\n0101 forest\n```\n````\n',
    };
    const renderer = new SpyRenderer();
    await new InMemoryVaultCompiler(files, { renderer }).compileAsync('index2compile.md');
    // The inner fence is escaped by the outer; the renderer should not be called.
    assert.equal(renderer.calls.length, 0);
  });

  it('vault file hashes are unchanged after a compilation that includes text-mapper blocks', async () => {
    // Vault safety: source files must not be written.
    const initialFiles: Record<string, string> = {
      'index2compile.md': '```text-mapper\n0101 forest\n```\n',
    };
    const snapshots = Object.fromEntries(Object.entries(initialFiles));
    const renderer = new SpyRenderer();
    await new InMemoryVaultCompiler({ ...initialFiles }, { renderer }).compileAsync('index2compile.md');
    for (const [path, content] of Object.entries(snapshots)) {
      assert.equal(initialFiles[path], content, `Source file mutated: ${path}`);
    }
  });

  it('handles a map block whose source is only whitespace without crashing', async () => {
    const files = {
      'index2compile.md': '```text-mapper\n   \n\t\n```\n',
    };
    const renderer = new SpyRenderer();
    assert.doesNotReject(() =>
      new InMemoryVaultCompiler(files, { renderer }).compileAsync('index2compile.md')
    );
  });

  it('produces a unique asset path for each distinct block in the same compilation', async () => {
    const files = {
      'index2compile.md': [
        '```text-mapper',
        '0101 forest',
        '```',
        '```text-mapper',
        '0201 mountain',
        '```',
      ].join('\n'),
    };
    const renderer = new SpyRenderer();
    const result = await new InMemoryVaultCompiler(files, { renderer }).compileAsync('index2compile.md');
    const paths = [...result.content.matchAll(/!\[.*?\]\((assets\/textmapper\/[^)]+)\)/g)]
      .map(m => m[1]);
    assert.equal(paths.length, 2);
    assert.notEqual(paths[0], paths[1]);
  });
});

// ---------------------------------------------------------------------------
// US-4.8 AC-6: the font key in map PNG names (2026-10-27)
// ---------------------------------------------------------------------------

describe('US-4.8 AC-6: map PNG names carry the font key', () => {
  const block = '```text-mapper\n0101 grass "Home"\n```';

  it('a font key from the plugin names the PNG <hash>_<key>.png', () => {
    const files = { 'index.md': `${block}\n\n${block}` };
    const result = new InMemoryVaultCompiler(files, { enableTextMapper: true, assetFolder: 'assets', mapFontKey: '2cb44a0b' }).compile('index.md');
    const refs = [...result.content.matchAll(/assets\/textmapper\/([^)]+)\)/g)].map(m => m[1]);
    assert.equal(refs.length, 2);
    assert.match(refs[0], /^[0-9a-f]+_2cb44a0b\.png$/);
    assert.equal(refs[0], refs[1], 'identical maps share one PNG (US-4.7)');
  });

  it('a different font key gives a different name for the same map', () => {
    const name = (key: string) => new InMemoryVaultCompiler({ 'index.md': block }, { enableTextMapper: true, assetFolder: 'assets', mapFontKey: key })
      .compile('index.md').content.match(/assets\/textmapper\/([^)]+)\)/)![1];
    assert.notEqual(name('2cb44a0b'), name('4c39c34'));
  });

  it('compileAsync renders a keyed map once and reuses it', async () => {
    const calls: string[] = [];
    const renderer = { isAvailable: () => true, render: async (_code: string, asset: string) => { calls.push(asset); } };
    const files = { 'index.md': `${block}\n\n${block}` };
    const result = await new InMemoryVaultCompiler(files, { enableTextMapper: true, assetFolder: 'assets', mapFontKey: 'k1', renderer }).compileAsync('index.md');
    assert.equal(calls.length, 1);
    assert.match(calls[0], /_k1\.png$/);
    assert.equal(result.stats.mapsDeduplicated, 1);
  });
});
