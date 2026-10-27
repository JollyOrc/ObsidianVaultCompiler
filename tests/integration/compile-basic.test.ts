import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

describe('basic vault compilation', () => {
  const files = {
    'index2compile.md': '# Index\n- ![[A.md]]\n- ![[B.md]]\n- ![[media.png]]\n',
    'A.md': '# A\nThis is the A section.\nSee [details](B.md) for more information.\n',
    'B.md': '# B\nHello from B.\nThis is additional B content.\n',
    'media.png': 'binary',
  };

  it('embeds all ToC entries in order', () => {
    const result = new InMemoryVaultCompiler(files).compile('index2compile.md');
    assert.match(result.content, /# A/);
    assert.match(result.content, /# B/);
    assert.ok(result.content.indexOf('# A') < result.content.indexOf('# B'));
  });

  it('copies referenced media once', () => {
    const result = new InMemoryVaultCompiler(files).compile('index2compile.md');
    assert.match(result.content, /assets\/media\.png/);
    assert.equal(result.stats.assetsCopied, 1);
  });

  it('converts in-text links to anchors', () => {
    const result = new InMemoryVaultCompiler(files).compile('index2compile.md');
    assert.match(result.content, /\[details\]\(#b\)/i);
  });
});

// ---------------------------------------------------------------------------
// TT-1.2 — Core compilation: embed syntaxes, circular, nested ToC
// ---------------------------------------------------------------------------

describe('embed syntax variants', () => {
  it('![[file.md]] wiki-embed and ![alt](file.md) markdown-embed both inline file content', () => {
    const wikiFiles = {
      'index.md': '- ![[page.md]]\n',
      'page.md': '# Page\nWiki embed content.\n',
    };
    const wikiResult = new InMemoryVaultCompiler(wikiFiles).compile('index.md');
    assert.match(wikiResult.content, /Wiki embed content\./);

    const mdFiles = {
      'index.md': '- ![alt](page.md)\n',
      'page.md': '# Page\nMarkdown embed content.\n',
    };
    const mdResult = new InMemoryVaultCompiler(mdFiles).compile('index.md');
    assert.match(mdResult.content, /Markdown embed content\./);
  });
});

describe('circular dependency detection', () => {
  it('emits <!-- Circular dependency avoided: filename.md --> on the second visit', () => {
    const files = {
      'index.md': '- ![[A.md]]\n',
      'A.md': '# A\n![[B.md]]\n',
      'B.md': '# B\n![[A.md]]\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /<!-- Circular dependency avoided: A\.md -->/);
  });

  it('includes content from all non-circular parts of the graph', () => {
    const files = {
      'index.md': '- ![[A.md]]\n',
      'A.md': '# A\nContent of A.\n![[B.md]]\n',
      'B.md': '# B\nContent of B.\n![[A.md]]\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /Content of A\./);
    assert.match(result.content, /Content of B\./);
  });

  it('does not recurse infinitely on a three-file cycle', () => {
    const files = {
      'index.md': '- ![[A.md]]\n',
      'A.md': '![[B.md]]\n',
      'B.md': '![[C.md]]\n',
      'C.md': '![[A.md]]\n',
    };
    // Should not throw or hang
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.ok(result.content.length > 0);
    assert.match(result.content, /Circular dependency avoided/);
  });
});

describe('nested ToC expansion', () => {
  it('a bullet list of wiki links is expanded as embedded files', () => {
    const files = {
      'index.md': '# TOC\n- [[chapter1.md]]\n- [[chapter2.md]]\n',
      'chapter1.md': '# Chapter 1\nFirst chapter.\n',
      'chapter2.md': '# Chapter 2\nSecond chapter.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /First chapter\./);
    assert.match(result.content, /Second chapter\./);
  });

  it('a bullet list of markdown links is expanded as embedded files too (US-1.3 AC-1)', () => {
    // Until 2026-10-27 this test asserted the opposite (anchor links, no
    // embeds) and so pinned the defect US-1.3 describes; turned around when
    // the defect was fixed.
    const files = {
      'index.md': '# TOC\n- [Ch 1](chapter1.md)\n- [Ch 2](chapter2.md)\n',
      'chapter1.md': '# Chapter 1\nMD link chapter one.\n',
      'chapter2.md': '# Chapter 2\nMD link chapter two.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /MD link chapter one\.[\s\S]*MD link chapter two\./);
    assert.doesNotMatch(result.content, /\[Ch 1\]\(/);
  });

  it('nested ToC expansion recurses into files that themselves contain embedded links', () => {
    const files = {
      'index.md': '# Root\n- [[A.md]]\n',
      'A.md': '# A\nA intro.\n- [[B.md]]\n',
      'B.md': '# B\nDeep B content.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    // Both levels should be embedded
    assert.match(result.content, /A intro\./);
    assert.match(result.content, /Deep B content\./);
  });
});

// ---------------------------------------------------------------------------
// TT-1.6 — Output quality: heading replacement, warning formats, stats
// ---------------------------------------------------------------------------

describe('auto-heading replaces leading file headings', () => {
  it('a file whose first line is an h1 has it replaced by the filename-derived heading', () => {
    const files = {
      'index.md': '- ![[2.1 Introduction.md]]\n',
      '2.1 Introduction.md': '# Old Heading\nBody text here.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    // US-6.1 | AC-1 (title rule, 2026-10-27): prefix removed from the heading text
    assert.match(result.content, /^## Introduction$/m);
    // The original heading text should NOT appear as a heading
    assert.doesNotMatch(result.content, /# Old Heading/);
  });

  it('a file with no leading heading gets an autogenerated heading prepended', () => {
    const files = {
      'index.md': '- ![[3.0 Appendix.md]]\n',
      '3.0 Appendix.md': 'No heading here, just body text.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /^# Appendix$/m);
    assert.match(result.content, /No heading here/);
  });
});

describe('warning comment formats', () => {
  it('a missing include reference produces a Warning comment in the output', () => {
    const files = {
      'index.md': '- ![[definitely-missing.md]]\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /<!--.*Warning.*[Mm]issing.*-->/);
  });

  it('an unreadable file (containing null bytes) produces a Warning: Unreadable file comment', () => {
    const files = {
      'index.md': '- ![[corrupt.md]]\n',
      'corrupt.md': 'start\x00\x01\x02end',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /<!-- Warning: Unreadable file: corrupt\.md -->/);
  });
});

describe('compilation statistics', () => {
  it('stats.filesProcessed counts each embedded markdown file', () => {
    const files = {
      'index.md': '- ![[A.md]]\n- ![[B.md]]\n',
      'A.md': '# A\n',
      'B.md': '# B\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    // index + A + B = 3 files
    assert.equal(result.stats.filesProcessed, 3);
  });

  it('stats.assetsCopied counts each unique asset source', () => {
    const files = {
      'index.md': '![a](img1.png)\n![b](img2.png)\n',
      'img1.png': 'a',
      'img2.png': 'b',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.equal(result.stats.assetsCopied, 2);
  });

  it('stats.assetsDeduplicated counts reused asset references', () => {
    const files = {
      'index.md': '![1](logo.png)\n![2](logo.png)\n![3](logo.png)\n',
      'logo.png': 'binary',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.equal(result.stats.assetsCopied, 1);
    assert.equal(result.stats.assetsDeduplicated, 2);
  });

  it('stats.missingReferences counts each missing include', () => {
    const files = {
      'index.md': '- ![[missing1.md]]\n- ![[missing2.md]]\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.equal(result.stats.missingReferences, 2);
  });

  it('result.stats contains all required top-level fields', () => {
    const files = { 'index.md': '# Index\n' };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.ok('filesProcessed' in result.stats, 'missing stats.filesProcessed');
    assert.ok('assetsCopied' in result.stats, 'missing stats.assetsCopied');
    assert.ok('assetsDeduplicated' in result.stats, 'missing stats.assetsDeduplicated');
    assert.ok('missingReferences' in result.stats, 'missing stats.missingReferences');
    // TextMapper stats — added by T-4.1 / ADR-013:
    // assert.ok('mapsRendered' in result.stats, 'missing stats.mapsRendered');
    // assert.ok('mapsDeduplicated' in result.stats, 'missing stats.mapsDeduplicated');
  });
});

// ---------------------------------------------------------------------------
// TT-2.1 — Repeated non-circular files are re-embedded per ToC order
// ---------------------------------------------------------------------------

describe('repeated non-circular file embedding', () => {
  it('a file listed twice in the ToC is fully embedded at both positions', () => {
    // A.md appears on line 1 and line 3 — no circular path, so both must embed.
    const files = {
      'index.md': '- ![[A.md]]\n- ![[B.md]]\n- ![[A.md]]\n',
      'A.md': '# A\nUnique content of A.\n',
      'B.md': '# B\nContent of B.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    // "Unique content of A." should appear twice — once per ToC entry.
    const occurrences = (result.content.match(/Unique content of A\./g) ?? []).length;
    assert.equal(occurrences, 2, `expected 2 embeddings of A, got ${occurrences}`);
  });

  it('after a circular chain unwinds, the same file is embedded again in a fresh ToC entry', () => {
    // index → A → B → A (circular, avoided) — then index directly embeds A again.
    // After the A→B→A cycle unwinds, A is no longer on the processedStack, so
    // the second ![[A.md]] in index should embed A fully.
    const files = {
      'index.md': '- ![[A.md]]\n- ![[A.md]]\n',
      'A.md': '# A\nContent of A.\n![[B.md]]\n',
      'B.md': '# B\nContent of B.\n![[A.md]]\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    // Circular warning is emitted for the inner visit
    assert.match(result.content, /<!-- Circular dependency avoided: A\.md -->/);
    // Content of A must appear at least twice (both ToC entries)
    const aCount = (result.content.match(/Content of A\./g) ?? []).length;
    assert.ok(aCount >= 2, `expected Content of A at least twice, got ${aCount}`);
  });

  it('a file embedded inside a child is also embedded at its own direct ToC entry', () => {
    // index → A (which embeds B) + index → B directly.
    // B appears once via A and once directly → content must appear twice.
    const files = {
      'index.md': '- ![[A.md]]\n- ![[B.md]]\n',
      'A.md': '# A\nA intro.\n![[B.md]]\n',
      'B.md': '# B\nB body.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    const bCount = (result.content.match(/B body\./g) ?? []).length;
    assert.ok(bCount >= 2, `expected B body to appear at least twice (via A and directly), got ${bCount}`);
  });
});
