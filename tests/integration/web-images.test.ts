/**
 * Tests for images from the web and image titles (US-2.6, #94) and for image
 * items in lists (US-1.3 AC-2, decided 2026-10-31).
 *
 * Expected values are the stories' examples. Written before the code (#96).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';


/** US-2.6 | Compiles `body` under `# Index`, with local images and note `A`. */
function compile(body: string): CompileResult {
  return new InMemoryVaultCompiler({
    'index.md': `# Index\n\n${body}\n`,
    'pic.png': 'binary',
    'my pic.png': 'binary',
    'A.md': '# A\n\nNote A.\n',
  }, { enableTextMapper: true, assetFolder: 'assets' }).compile('index.md');
}

/** US-2.6 | The compiled text below the `# Index` heading, trimmed. */
const body = (r: CompileResult) => r.content.replace(/^# Index\n/, '').trim();

describe('US-2.6 AC-1: web images stay as written, without a warning', () => {
  const KEPT = [
    '![logo](https://example.com/x.png)',
    '![logo](http://example.com/x.png)',
    '![logo](HTTPS://example.com/x.png)',
    '![](https://example.com/x.png)',
    '![logo](https://example.com/x.png?size=2&v=1)',
    '![logo](https://example.com/a%20b.png)',
    '![logo](<https://example.com/a b.png>)',
    '![logo](https://example.com/x.png "Logo")',
    'Look: ![logo](https://example.com/x.png) here.',
  ];
  for (const embed of KEPT) {
    it(embed, () => {
      const r = compile(embed);
      assert.equal(body(r), embed);
      assert.deepEqual(r.warningDetails, []);
      assert.deepEqual(r.warnings, []);
      assert.equal(r.stats.assetsCopied, 0);
    });
  }
});

describe('US-2.6 AC-2: wiki embeds of a web address', () => {
  it('![[url]] becomes ![](url)', () => {
    const r = compile('![[https://example.com/x.png]]');
    assert.equal(body(r), '![](https://example.com/x.png)');
    assert.deepEqual(r.warningDetails, []);
  });

  it('an alias becomes the alt text, as for local images', () => {
    assert.equal(body(compile('![[https://example.com/x.png|200]]')), '![200](https://example.com/x.png)');
    assert.equal(body(compile('![[pic.png|200]]')), '![200](assets/pic.png)', 'the local rule it follows');
  });
});

describe('US-2.6 AC-3: titles are kept', () => {
  it('double quotes', () => {
    const r = compile('![logo](pic.png "Logo")');
    assert.equal(body(r), '![logo](assets/pic.png "Logo")');
    assert.deepEqual(r.warningDetails, []);
  });

  it('single quotes', () => {
    assert.equal(body(compile("![logo](pic.png 'Logo')")), "![logo](assets/pic.png 'Logo')");
  });

  it('angle brackets around a path with a space', () => {
    assert.equal(body(compile('![x](<my pic.png>)')), '![x](assets/my_pic.png)');
  });

  it('a missing image with a title is reported by its path', () => {
    const r = compile('![x](gone.png "T")');
    assert.equal(body(r), '<!-- Warning: Missing asset -->');
    assert.deepEqual(r.warningDetails, [{ message: 'Missing asset', link: 'gone.png', file: 'index.md', line: 3 }]);
  });

  it('a local image without a title is unchanged (guard)', () => {
    assert.equal(body(compile('![x](my%20pic.png)')), '![x](assets/my_pic.png)');
  });
});

describe('US-2.6 AC-4: one parser for every step', () => {
  it('a note embedded with a title is recognised as a note', () => {
    const r = compile('![A](A.md "the note")');
    assert.match(r.content, /Note A\./);
    assert.deepEqual(r.warningDetails, []);
  });

  it('a note embedded with a title counts as already embedded for a ToC (US-1.3 AC-5)', () => {
    const r = new InMemoryVaultCompiler({
      'index.md': '# Index\n\n![A](A.md "the note")\n\n- [[A]]\n- [[B]]\n',
      'A.md': '# A\n\nNote A.\n',
      'B.md': '# B\n\nNote B.\n',
    }, { enableTextMapper: true, assetFolder: 'assets' }).compile('index.md');
    assert.equal((r.content.match(/Note A\./g) ?? []).length, 1);
    assert.match(r.content, /Note B\./);
  });
});

describe('US-1.3 AC-2: list items that embed a file that is not a note keep their bullet', () => {
  it('local images', () => {
    assert.equal(body(compile('- ![a](pic.png)\n- ![b](pic.png)')), '- ![a](assets/pic.png)\n- ![b](assets/pic.png)');
  });

  it('a wiki image with a size keeps its alias', () => {
    assert.equal(body(compile('- ![[pic.png|200]]')), '- ![200](assets/pic.png)');
  });

  it('a web image', () => {
    assert.equal(body(compile('- ![logo](https://example.com/x.png)')), '- ![logo](https://example.com/x.png)');
  });

  it('a web image without an extension', () => {
    const item = '- ![chart](https://example.com/render?id=3)';
    assert.equal(body(compile(item)), item);
  });

  it('a missing image', () => {
    assert.equal(body(compile('- ![](gone.png)')), '- <!-- Warning: Missing asset -->');
  });

  it('a note and an image in one list: the note loses its bullet, the image keeps it', () => {
    const out = body(compile('- ![[A]]\n- ![a](pic.png)'));
    assert.match(out, /Note A\./);
    assert.match(out, /\n- !\[a\]\(assets\/pic\.png\)$/);
    assert.doesNotMatch(out, /^- .*A/m, 'the note is not on a list marker');
  });

  it('a missing note keeps today\'s form (guard)', () => {
    assert.equal(body(compile('- ![[Gone]]')), '<!-- Warning: Missing include -->');
  });
});
