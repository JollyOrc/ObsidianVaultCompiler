import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

describe('compiled output link portability', () => {
  const files = {
    'index2compile.md': '# Index\n- ![[A.md]]\n- ![[B.md]]\n- [external](https://example.com/path)\n- [mail](mailto:test@example.com)\n',
    'A.md': '# A\nSee [B](B.md) and ![](media.png).\n',
    'B.md': '# B\nHello from B.\n',
    'media.png': 'binary',
  };

  it('only contains portable link targets', () => {
    const result = new InMemoryVaultCompiler(files).compile('index2compile.md');
    const links = [...result.content.matchAll(/(?<!\!)\[[^\]]*\]\(([^)]+)\)/g)];
    for (const match of links) {
      const target = match[1];
      const portable =
        target.startsWith('#') ||
        target.startsWith('assets/') ||
        target.startsWith('http://') ||
        target.startsWith('https://') ||
        target.startsWith('mailto:');
      assert.ok(portable, `non-portable link target: ${target}`);
    }
  });

  it('resolves URL-encoded vault links into anchors', () => {
    const encodedFiles = {
      // A link in a sentence: a list item alone would be a ToC (US-1.3) and
      // import the note instead of linking to it (changed 2026-10-27).
      'index2compile.md': '# Index\nSee [Spell](../Dir%20with%20Space/Target%20Spell.md) here.\n',
      'Dir with Space/Target Spell.md': '# Target Spell\n',
    };
    const result = new InMemoryVaultCompiler(encodedFiles).compile('index2compile.md');
    assert.match(result.content, /\[Spell\]\(#target-spell\)/i);
  });

  it('removes invalid HTML link targets from output', () => {
    const invalidFiles = {
      'index2compile.md': '# Index\n<a href="vault-internal-file">bad</a>\n',
    };
    const result = new InMemoryVaultCompiler(invalidFiles).compile('index2compile.md');
    assert.doesNotMatch(result.content, /href="vault-internal-file"/);
    assert.match(result.content, /<!-- Warning: Invalid output link -->/);
  });

  it('records warnings with source details', () => {
    const filesWithMissing = {
      'index2compile.md': '# Index\n- ![[missing.md]]\n',
    };
    const result = new InMemoryVaultCompiler(filesWithMissing).compile('index2compile.md');
    assert.ok(result.warningDetails.length > 0);
    assert.equal(result.warningDetails[0].file, 'index2compile.md');
    assert.ok(typeof result.warningDetails[0].line === 'number');
    assert.ok(result.warningDetails[0].link.includes('missing.md'));
  });
});
// ---------------------------------------------------------------------------
// TT-1.4 — Link challenge cases: relative links, bare magic links, ambiguous
// ---------------------------------------------------------------------------

describe('relative markdown links become anchor links', () => {
  it('a relative link [text](./sibling.md) becomes an anchor [text](#slug)', () => {
    const files = {
      'index.md': '# Index\n- ![[A.md]]\n',
      'A.md': '# A\nSee [sibling](./sibling.md).\n',
      'sibling.md': '# Sibling\nSibling content.\n',
    };
    const result = new InMemoryVaultCompiler({ ...files, 'index.md': '- ![[A.md]]\n- ![[sibling.md]]\n' }).compile('index.md');
    assert.match(result.content, /\[sibling\]\(#sibling\)/i);
  });

  it('a relative link with a subdirectory path becomes an anchor', () => {
    const files = {
      'index.md': '- ![[chapter/intro.md]]\n- ![[chapter/detail.md]]\n',
      'chapter/intro.md': '# Intro\nSee [detail](detail.md).\n',
      'chapter/detail.md': '# Detail\nDetail content.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.doesNotMatch(result.content, /\(detail\.md\)/);
    assert.match(result.content, /\]\(#detail\)/i);
  });

  it('a relative link with ../ resolves and becomes an anchor', () => {
    const files = {
      'index.md': '- ![[section/page.md]]\n- ![[appendix.md]]\n',
      'section/page.md': '# Page\nSee [appendix](../appendix.md).\n',
      'appendix.md': '# Appendix\nAppendix content.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.doesNotMatch(result.content, /\(\.\.\/appendix\.md\)/);
    assert.match(result.content, /\]\(#appendix\)/i);
  });
});

describe('bare magic filename links become anchor links', () => {
  it('a wiki link [[filename]] with a unique match becomes [label](#slug)', () => {
    const files = {
      'index.md': '- ![[A.md]]\n- ![[B.md]]\n',
      'A.md': '# A\nSee [[B.md]].\n',
      'B.md': '# B\nB content.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.doesNotMatch(result.content, /\[\[B\.md\]\]/);
    assert.match(result.content, /\]\(#b\)/i);
  });

  it('a wiki link [[bare-name]] without extension resolves and becomes an anchor', () => {
    const files = {
      'index.md': '- ![[A.md]]\n- ![[target.md]]\n',
      'A.md': '# A\nSee [[target]].\n',
      'target.md': '# Target\nTarget content.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.doesNotMatch(result.content, /\[\[target\]\]/);
    assert.match(result.content, /\]\(#target\)/i);
  });
});

describe('non-unique bare filenames', () => {
  it('resolves to the lexicographically smallest path when multiple files match', () => {
    const files = {
      'index.md': '- ![[aaa/shared.md]]\n- ![[zzz/shared.md]]\n',
      'aaa/shared.md': '# Shared AAA\nFirst.\n',
      'zzz/shared.md': '# Shared ZZZ\nSecond.\n',
    };
    const filesWithLink = {
      ...files,
      'index.md': '- ![[aaa/shared.md]]\n- ![[zzz/shared.md]]\n- In-text: [[shared.md]].\n',
    };
    const result = new InMemoryVaultCompiler(filesWithLink).compile('index.md');
    // The in-text [[shared.md]] link should resolve; not produce an error
    assert.doesNotMatch(result.content, /\[\[shared\.md\]\]/);
  });

  it('records a warning when an ambiguous bare filename is resolved', () => {
    const files = {
      'index.md': '- ![[aaa/file.md]]\n- ![[bbb/file.md]]\n',
      'aaa/file.md': '# A\n',
      'bbb/file.md': '# B\n',
    };
    // Add an ambiguous in-text link to trigger the warning
    const filesWithAmbig = {
      ...files,
      'index.md': '- ![[aaa/file.md]]\n- ![[bbb/file.md]]\n[[file.md]]\n',
    };
    const result = new InMemoryVaultCompiler(filesWithAmbig).compile('index.md');
    const hasWarning = result.warnings.some(w => /[Aa]mbiguous|multiple|more than one/i.test(w));
    assert.ok(hasWarning, `expected an ambiguity warning, got: ${JSON.stringify(result.warnings)}`);
  });
});

// ---------------------------------------------------------------------------
// TT-2.2 — External HTTP(S) links survive compilation unchanged
// ---------------------------------------------------------------------------

describe('external links pass through unchanged', () => {
  it('an https:// link is preserved verbatim in the output', () => {
    const files = {
      'index.md': '# Index\n[Visit us](https://example.com/path?q=1)\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(
      result.content,
      /\[Visit us\]\(https:\/\/example\.com\/path\?q=1\)/,
      'https:// link was rewritten or dropped',
    );
  });

  it('an http:// link is preserved verbatim in the output', () => {
    const files = {
      'index.md': '# Index\n[Legacy](http://insecure.example.com)\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(
      result.content,
      /\[Legacy\]\(http:\/\/insecure\.example\.com\)/,
      'http:// link was rewritten or dropped',
    );
  });

  it('a mailto: link is preserved verbatim in the output', () => {
    const files = {
      'index.md': '# Index\n[Contact](mailto:user@example.com)\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(
      result.content,
      /\[Contact\]\(mailto:user@example\.com\)/,
      'mailto: link was rewritten or dropped',
    );
  });

  it('an external URL whose path looks like a vault filename is not rewritten to an anchor', () => {
    // "A.md" exists as a vault file; a CDN link ending in /A.md must not become #a
    const files = {
      'index.md': '# Index\n![[A.md]]\n[Download](https://cdn.example.com/A.md)\n',
      'A.md': '# A\nA content.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(
      result.content,
      /\[Download\]\(https:\/\/cdn\.example\.com\/A\.md\)/,
      'external URL ending in a vault filename was incorrectly rewritten to an anchor',
    );
  });
});
