/**
 * Tests for code copied as written (US-1.4, #84) and unclosed code blocks
 * (US-1.4 AC-6, #102). The KD-3 heading rules for code are in
 * `code-blocks.test.ts`.
 *
 * Expected values are the story's examples; the indented-code rows are the
 * cases measured in Obsidian (code check H1–H7). Written before the code
 * (#103); all but the guards failed on v0.19.0.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';


const NOTES = {
  'A.md': '# A\n\nAAA text\n',
  'B.md': '# B\n\nBBB text\n',
  'pic.png': 'binary',
};

/** US-1.4 | Compiles `index.md` = `# Book` / `` / `body`, with notes A and B. */
function compile(body: string, normaliseHeadings = false, extra: Record<string, string> = {}): CompileResult {
  return new InMemoryVaultCompiler({ 'index.md': `# Book\n\n${body}\n`, ...NOTES, ...extra }, {
    enableTextMapper: true,
    assetFolder: 'assets',
    normaliseHeadings,
  }).compile('index.md');
}

/** US-1.4 | AC-2: `code` is in the output exactly, nothing was embedded, copied or reported. */
function assertCopied(r: CompileResult, code: string): void {
  assert.ok(r.content.includes(code), r.content);
  assert.doesNotMatch(r.content, /AAA text|BBB text/);
  assert.equal(r.stats.assetsCopied, 0);
  assert.deepEqual(r.warningDetails, []);
}

describe('US-1.4 AC-1/AC-2: nothing happens inside a fenced block', () => {
  const CASES: Array<[string, string]> = [
    ['a ToC list', '```\n- [[A]]\n- [[B]]\n```'],
    ['an embed', '```\n![[A]]\n```'],
    ['an embed, tilde fence', '~~~\n![[A]]\n~~~'],
    ['a picture', '```\n![x](pic.png)\n```'],
    ['a wiki link', '```\nSee [[A]].\n```'],
    ['a missing link', '```\n[[Nope]]\n```'],
    ['a same-note heading link', '```\n[x](#Gone)\n```'],
    ['a markdown note link', '```\n[x](A.md)\n```'],
    ['an HTML link', '```\n<a href="notes">x</a>\n```'],
    ['a link to another scheme', '```\n[x](ftp://example.com/x)\n```'],
    ['a Dataview Serializer marker', '```\n<!-- SerializedQuery: LIST -->\n```'],
    ['a Dataview block shown in a longer fence', '````md\n```dataview\nLIST\n```\n````'],
    ['a map block shown in a longer fence', '````md\n```text-mapper\n0101 grass\n```\n````'],
  ];
  for (const [name, code] of CASES) {
    it(name, () => {
      assertCopied(compile(code), code);
    });
  }
  it('a map shown in a longer fence draws no map (AC-2, guard)', () => {
    assert.doesNotMatch(compile('````md\n```text-mapper\n0101 grass\n```\n````').content, /assets\/textmapper/);
  });
});

describe('US-1.4 AC-1: a longer fence is closed only by one at least as long', () => {
  it('a heading after the inner fence is still inside the block (KD-3 helper)', () => {
    const code = '````md\n```\n# not a heading\n````';
    assertCopied(compile(code, true), code);
  });
});

describe('US-1.4 AC-1/AC-2: inline code', () => {
  const CASES: Array<[string, string]> = [
    ['a wiki link', 'Write `[[A]]` to link.'],
    ['an embed', 'Write `![[A]]` to embed.'],
    ['double backticks', 'Write ``a `[[A]]` b`` here.'],
    ['over two lines of one paragraph (H7)', 'A sentence with `code that starts here\n![[A]] and ends here` in it.'],
  ];
  for (const [name, text] of CASES) {
    it(name, () => {
      assertCopied(compile(text), text);
    });
  }

  it('a backtick never closed is plain text (guard)', () => {
    const r = compile('![[A]]\n\nWrite ` then [[A]].');
    assert.ok(r.content.includes('\nWrite ` then [A](#A).'), r.content);
  });

  it('a blank line ends the paragraph: a backtick does not reach past it', () => {
    const r = compile('One ` here.\n\n![[A]]\n\nTwo ` there.');
    assert.match(r.content, /AAA text/);
  });
});

describe('US-1.4 AC-3: text beside code on the same line is handled as before', () => {
  it('Write `[[A]]`, see [[B]].', () => {
    const r = compile('![[B]]\n\nWrite `[[A]]`, see [[B]].');
    assert.ok(r.content.includes('\nWrite `[[A]]`, see [B](#B).'), r.content);
    assert.deepEqual(r.warningDetails, []);
  });
});

describe('US-1.4 AC-1: indented code, as measured in Obsidian', () => {
  // [case, note body, is code]
  const CASES: Array<[string, string, boolean]> = [
    ['H1 four spaces after a blank line', 'A paragraph.\n\n    ![[A]]', true],
    ['H2 four spaces under a paragraph line', 'A paragraph.\n    ![[A]]', false],
    ['H3 a tab after a blank line', 'A paragraph.\n\n\t![[A]]', true],
    ['H4 a nested item', '- [[B]]\n    - [[A]]', false],
    ['H5 four spaces after a list item and a blank line', '- an item\n\n    ![[A]]', false],
    ['H6 eight spaces after a list item and a blank line', '- an item\n\n        ![[A]]', true],
    ['a numbered item needs seven', '1. an item\n\n       ![[A]]', true],
    ['a numbered item, six spaces', '1. an item\n\n      ![[A]]', false],
    ['a nested ToC with blank lines between the items', '- [[B]]\n\n    - [[A]]', false],
    ['after a list that a paragraph ended', '- an item\n\nText.\n\n    ![[A]]', true],
    ['right under a heading (standard markdown)', '## Notes\n    ![[A]]', true],
  ];
  for (const [name, body, isCode] of CASES) {
    it(`${name}: ${isCode ? 'code' : 'not code'}`, () => {
      const r = compile(body);
      if (isCode) assertCopied(r, body.split('\n').pop()!);
      else assert.match(r.content, /AAA text/);
    });
  }
});

describe('US-1.4 AC-4: composed cases', () => {
  it('an embed in code does not count as already embedded for a ToC', () => {
    const r = compile('```\n![[A]]\n```\n- [[A]]\n- [[B]]');
    assert.ok(r.content.includes('```\n![[A]]\n```'), r.content);
    assert.match(r.content, /AAA text/);
    assert.match(r.content, /BBB text/);
  });

  it('a markdown embed in code does not count as already embedded either', () => {
    const r = compile('```\n![a](A.md)\n```\n- [[A]]\n- [[B]]');
    assert.ok(r.content.includes('```\n![a](A.md)\n```'), r.content);
    assert.match(r.content, /AAA text/);
  });

  it('the root note may start with indented code', () => {
    const r = new InMemoryVaultCompiler({ 'index.md': '    See [[A]].\n\n![[A]]\n', ...NOTES }, { assetFolder: 'assets' }).compile('index.md');
    assert.ok(r.content.startsWith('    See [[A]].'), r.content);
  });

  it('after an embed line, four spaces continue the paragraph (not code)', () => {
    const r = compile('![[A]]\n    See [[B]].\n\n![[B]]');
    assert.ok(r.content.includes('See [B](#B).'), r.content);
  });

  it('a list item holding inline code keeps the list from being a ToC (guard)', () => {
    const r = compile('- `[[A]]`\n- [[B]]');
    assert.doesNotMatch(r.content, /BBB text/);
  });

  for (const normalise of [false, true]) {
    it(`code in an embedded note and in a section embed (normalise ${normalise})`, () => {
      const r = compile('![[C]]\n\n![[D#Part]]', normalise, {
        'C.md': '# C\n\n```\n![[A]]\n```\n',
        'D.md': '# D\n\n## Part\n\nWrite `![[B]]` here.\n',
      });
      assert.ok(r.content.includes('```\n![[A]]\n```'), r.content);
      assert.ok(r.content.includes('Write `![[B]]` here.'), r.content);
      assert.doesNotMatch(r.content, /AAA text|BBB text/);
      assert.deepEqual(r.warningDetails, []);
    });
  }

  it('indented code in a note that gets an injected title (normalise on)', () => {
    const r = compile('![[1 P]]', true, { '1 P.md': 'Intro.\n\n    ![[A]]\n' });
    assert.ok(r.content.includes('    ![[A]]'), r.content);
    assert.doesNotMatch(r.content, /AAA text/);
  });

  it('indented code at the very start of an embedded note', () => {
    const r = compile('![[A]]\n\n![[G]]', false, { 'G.md': '    See [[A]].\n' });
    assert.ok(r.content.includes('    See [[A]].'), r.content);
    assert.deepEqual(r.warningDetails, []);
  });

  it('code in a pass-through target (US-6.5)', () => {
    const r = compile('![[Wrap]]', true, { 'Wrap.md': '![[E]]\n', 'E.md': '# E\n\n```\n![[A]]\n```\n' });
    assert.ok(r.content.includes('```\n![[A]]\n```'), r.content);
    assert.doesNotMatch(r.content, /AAA text/);
  });
});

describe('US-1.4 AC-6: an unclosed code block ends with its note (#102)', () => {
  const U = { 'U.md': '# U\n\n```\n![[A]]\n' };

  it('the closing fence is added at the end of the note; what follows is not code', () => {
    const r = compile('![[U]]\n\nSee [[B]].\n\n![[B]]', false, U);
    assert.ok(r.content.includes('```\n![[A]]\n```\n'), r.content);
    assert.ok(r.content.includes('\nSee [B](#B).'), r.content);
    assert.match(r.content, /BBB text/);
    assert.doesNotMatch(r.content, /AAA text/);
    assert.deepEqual(r.warningDetails, [
      { message: 'Code block not closed; closed at the end of the note', link: '```', file: 'U.md', line: 3 },
    ]);
  });

  it('a longer fence and a tilde fence are closed with their own fence', () => {
    const four = compile('![[F]]\n\nafter', false, { 'F.md': '# F\n\n````md\n![[A]]\n' });
    assert.ok(four.content.includes('````md\n![[A]]\n````\n'), four.content);
    const tilde = compile('![[T]]\n\nafter', false, { 'T.md': '# T\n\n~~~\n![[A]]\n' });
    assert.ok(tilde.content.includes('~~~\n![[A]]\n~~~\n'), tilde.content);
  });

  it('a note embedded twice reports its unclosed block once', () => {
    const r = compile('![[U]]\n\n![[U]]', false, U);
    assert.equal((r.content.match(/```\n!\[\[A\]\]\n```/g) ?? []).length, 2, r.content);
    assert.equal(r.warningDetails.length, 1, JSON.stringify(r.warningDetails));
  });

  it('a section embed is closed at the end of the copied part', () => {
    const r = compile('![[U#U]]\n\nafter [[B]]\n\n![[B]]', true, U);
    assert.ok(r.content.includes('```\n![[A]]\n```\n'), r.content);
    assert.ok(r.content.includes('after [B](#B)'), r.content);
  });

  it('the root note is closed at the end of the document', () => {
    const r = compile('```\n![[A]]');
    assert.ok(r.content.trimEnd().endsWith('```\n![[A]]\n```'), r.content);
  });

  it('a note whose fences are closed is unchanged (guard)', () => {
    const r = compile('![[C]]', false, { 'C.md': '# C\n\n```\ncode\n```\n\nafter\n' });
    assert.ok(r.content.includes('```\ncode\n```\n\nafter'), r.content);
    assert.deepEqual(r.warningDetails, []);
  });
});

describe('US-1.4 AC-7: code inside a quote', () => {
  const CASES: Array<[string, string]> = [
    ['a tilde fence', '> ~~~\n> [[A]]\n> ![[A]]\n> ~~~'],
    ['an empty quote line and a backtick run inside the block', '> ```\n> [[A]]\n>\n> x ``` y\n> [[A]]\n> ```'],
    ['a nested quote', '> > ```\n> > [[A]]\n> > ```'],
    ['a callout', '> [!example]\n> ```\n> [[A]]\n> ```'],
    ['inline code in a quote (guard)', '> `[[A]]`'],
    ['indented code in a quote', '> Text.\n>\n>     [[A]]'],
    ['a quoted embed line inside inline code over three lines', '> Write `start\n> ![[A]]\n> end` here.'],
  ];
  for (const [name, code] of CASES) {
    it(name, () => {
      assertCopied(compile(code), code);
    });
  }
  it('a deeper quote ends the paragraph: backticks in two paragraphs are no inline code', () => {
    const r = compile('> Write `[[A]]\n> > and` [[A]].');
    assert.equal((r.content.match(/not embedded in compiled output -->/g) ?? []).length, 2, r.content);
  });
  it('the quote ends the block: a link after it is converted, nothing reported as unclosed', () => {
    const r = compile('> ```\n> code\n\nSee [[A]].');
    assert.ok(r.content.includes("> ```\n> code\n\nSee <!-- Warning: link target 'A' not embedded in compiled output -->."), r.content);
    assert.deepEqual(r.warningDetails.map(w => w.message), ["link target 'A' not embedded in compiled output"]);
  });
});
