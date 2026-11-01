/**
 * Tests for embedding a note as a quote (US-1.5).
 *
 * Expected values are the story's examples. Written before the code (#106);
 * all but the guards (marked) failed on v0.20.1.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';

const SAGE = '# Wisdom\n\nFirst line.\nSecond line.\n\n## Detail\n\nMore.\n';

/** The quote of `Sage.md` = SAGE, prefix `> ` (US-1.5 AC-1). */
const SAGE_QUOTE = [
  '> **Sage**',
  '>',
  '> # Wisdom',
  '>',
  '> First line.',
  '> Second line.',
  '>',
  '> ## Detail',
  '>',
  '> More.',
].join('\n');

/** US-1.5 | Compiles `index.md` = `# Book` / `` / `body` with `Sage.md` = SAGE and `notes`. */
function compile(body: string, normaliseHeadings: boolean, notes: Record<string, string> = {}): CompileResult {
  return new InMemoryVaultCompiler({ 'index.md': `# Book\n\n${body}\n`, 'Sage.md': SAGE, ...notes }, {
    enableTextMapper: true,
    assetFolder: 'assets',
    normaliseHeadings,
  }).compile('index.md');
}

/** US-1.5 | AC-1: `block` stands in the output as whole lines. */
function assertBlock(r: CompileResult, block: string): void {
  assert.ok(`\n${r.content}`.includes(`\n${block}\n`), `expected\n${block}\n---- in ----\n${r.content}`);
}

const BOTH = [true, false];

describe('US-1.5 AC-1: one quote container', () => {
  for (const on of BOTH) {
    it(`the measured root, wiki syntax (normalise ${on})`, () => {
      const r = compile('## Chapter\n\nAs the sage said:\n\n> ![[Sage]]\n\nAfter.', on);
      assertBlock(r, `As the sage said:\n\n${SAGE_QUOTE}\n\nAfter.`);
      assert.deepEqual(r.warningDetails, []);
    });
    it(`markdown syntax gives the same quote (normalise ${on})`, () => {
      assertBlock(compile('> ![s](Sage.md)\n\nAfter.', on), `${SAGE_QUOTE}\n\nAfter.`);
    });
    it(`no space after the marker: the prefix as written (normalise ${on})`, () => {
      assertBlock(compile('>![[Sage]]', on), SAGE_QUOTE.replace(/^> /gm, '>'));
    });
  }
  it('a nested quote prefix is carried by every line; empty lines are `> >`', () => {
    const r = compile('> > ![[Sage]]', true);
    assertBlock(r, SAGE_QUOTE.split('\n').map(l => (l === '>' ? '> >' : `> ${l}`)).join('\n'));
  });
  it('a quote line in the quoted note becomes a nested quote line', () => {
    const r = compile('> ![[Sage]]', true, { 'Sage.md': 'Intro.\n\n> x\n\nBack.' });
    assertBlock(r, '> **Sage**\n>\n> Intro.\n>\n> > x\n>\n> Back.');
  });
  it('runs of empty lines become one empty quote line; none at start or end', () => {
    const r = compile('Before.\n\n> ![[Sage]]\n\nAfter.', false, { 'Sage.md': '\n\n\nOne.\n\n\n\nTwo.\n\n\n' });
    assertBlock(r, 'Before.\n\n> **Sage**\n>\n> One.\n>\n> Two.\n\nAfter.');
  });
});

describe('US-1.5 AC-2: text around the embed stays in the quote', () => {
  for (const on of BOTH) {
    it(`a callout with a line after the embed (normalise ${on})`, () => {
      const r = compile('> [!quote] The sage\n> ![[Sage]]\n> — said at dawn', on);
      assertBlock(r, `> [!quote] The sage\n${SAGE_QUOTE}\n> — said at dawn`);
    });
  }
});

describe('US-1.5 AC-3: quote title', () => {
  it('a prefixed note: title rule, first heading kept', () => {
    const r = compile('> ![[1.2 Sage]]', true, { '1.2 Sage.md': SAGE });
    assertBlock(r, SAGE_QUOTE);
  });
  it('`*` and `_` in the title are escaped', () => {
    const r = compile('> ![[My *notes*]]\n\n> ![[snake_case_rules]]', false, {
      'My *notes*.md': 'a',
      'snake_case_rules.md': 'b',
    });
    assertBlock(r, '> **My \\*notes\\***\n>\n> a');
    assertBlock(r, '> **Snake\\_case\\_rules**\n>\n> b');
  });
  it('a headingless note', () => {
    assertBlock(compile('> ![[Sage]]', true, { 'Sage.md': 'Wise words.' }), '> **Sage**\n>\n> Wise words.');
  });
});

describe('US-1.5 AC-4: headings as written', () => {
  it('normalise on: the quote is not the last original heading', () => {
    const r = compile('## Chapter\n\n> ![[Sage]]\n\n![[X]]', true, { 'X.md': 'X text.' });
    assertBlock(r, SAGE_QUOTE);
    assert.match(r.content, /^### X$/m);
  });
  it('normalise off: US-6.1 for the next note, the quote as written', () => {
    const r = compile('## Chapter\n\n> ![[Sage]]\n\n![[X]]', false, { 'X.md': 'X text.' });
    assertBlock(r, SAGE_QUOTE);
    assert.match(r.content, /^## X$/m);
  });
  it('a quote line in the root is not a heading (guard)', () => {
    const r = compile('> ## Aside\n\n![[X]]', true, { 'X.md': 'X text.' });
    assert.match(r.content, /^## X$/m);
  });
  it('no shift and no clamp warning for a deep prefixed note', () => {
    const r = compile('> ![[1.2.3.4.5.6 Deep]]', true, { '1.2.3.4.5.6 Deep.md': '# Deep\n\n## Deeper' });
    assertBlock(r, '> **Deep**\n>\n> # Deep\n>\n> ## Deeper');
    assert.deepEqual(r.warningDetails, []);
  });
});

describe('US-1.5 AC-5: section embed', () => {
  for (const on of BOTH) {
    for (const embed of ['![[Sage#Detail]]', '![d](Sage.md#Detail)']) {
      it(`${embed}: no quote title, heading as written (normalise ${on})`, () => {
        const r = compile(`## Chapter\n\n> ${embed}\n\nAfter.`, on);
        // US-6.6 AC-3: no empty line after a heading.
        assertBlock(r, '## Chapter\n> ## Detail\n>\n> More.\n\nAfter.');
        assert.doesNotMatch(r.content, /\*\*Sage\*\*|Wisdom/);
      });
    }
  }
  it('only the note\'s own headings end the section', () => {
    const r = compile('> ![[Sage#Detail]]', true, { 'Sage.md': '## Detail\n\n![[Inner]]\n\n## Next\n\nx', 'Inner.md': '# Inner\n\ntext' });
    assertBlock(r, '> ## Detail\n>\n> **Inner**\n>\n> # Inner\n>\n> text');
    assert.doesNotMatch(r.content, /Next/);
  });
  it('a missing heading gives the US-1.2 warning inside the quote', () => {
    const r = compile('> ![[Sage#Gone]]', true);
    assertBlock(r, '> <!-- Warning: Missing heading anchor: Sage.md#Gone -->');
    assert.equal(r.warningDetails.length, 1);
  });
});

describe('US-1.5 AC-6: embeds inside the quoted note', () => {
  for (const on of BOTH) {
    it(`an inner note is quoted with its own title (normalise ${on})`, () => {
      const r = compile('> ![[Sage]]', on, { 'Sage.md': 'Intro.\n\n![[Inner]]', 'Inner.md': '# Inner\n\ntext' });
      assertBlock(r, '> **Sage**\n>\n> Intro.\n>\n> **Inner**\n>\n> # Inner\n>\n> text');
    });
    it(`a pass-through wrapper shows only its target's title (normalise ${on})`, () => {
      const r = compile('> ![[Sage]]', on, { 'Sage.md': '![[Real]]', 'Real.md': '# R\n\ntext' });
      assertBlock(r, '> **Real**\n>\n> # R\n>\n> text');
      assert.doesNotMatch(r.content, /Sage/);
    });
  }
  it('a wrapper around a preamble note is no pass-through: both titles', () => {
    const r = compile('> ![[Sage]]', true, { 'Sage.md': '![[Real]]', 'Real.md': 'text' });
    assertBlock(r, '> **Sage**\n>\n> **Real**\n>\n> text');
  });
  it('a wrapper around a section embed shows the section without a title', () => {
    const r = compile('> ![[W]]', true, { 'W.md': '![[Sage#Detail]]' });
    assertBlock(r, '> ## Detail\n>\n> More.');
    assert.doesNotMatch(r.content, /\*\*/);
  });
  it('a circular embed gives its comment inside the quote', () => {
    const r = compile('> ![[Sage]]', true, { 'Sage.md': 'Intro.\n\n![[Sage]]' });
    assertBlock(r, '> **Sage**\n>\n> Intro.\n>\n> <!-- Circular dependency avoided: Sage.md -->');
  });
  it('a missing note gives its comment inside the quote, reported at its line', () => {
    const r = compile('> ![[Sage]]', true, { 'Sage.md': 'Intro.\n\n![[Gone]]' });
    assertBlock(r, '> **Sage**\n>\n> Intro.\n>\n> <!-- Warning: Missing include -->');
    assert.deepEqual(r.warningDetails, [{ message: 'Missing include', link: 'Gone', file: 'Sage.md', line: 3 }]);
  });
  it('a missing note on the quote line itself', () => {
    const r = compile('> ![[Gone]]\n\nAfter.', true);
    assertBlock(r, '> <!-- Warning: Missing include -->\n\nAfter.');
  });
});

describe('US-1.5 AC-7: ToC lists are not expanded in a quote', () => {
  const NOTES = { 'A.md': '# A\n\nAAA', 'B.md': '# B\n\nBBB' };
  it('a link list stays a list; its links point at A and B', () => {
    const r = compile('> ![[Sage]]\n\n![[A]]\n\n![[B]]', true, { ...NOTES, 'Sage.md': '- [[A]]\n- [[B]]' });
    assertBlock(r, '> **Sage**\n>\n> - [A](#A)\n> - [B](#B)');
    assert.equal(r.content.split('AAA').length, 2, 'A once, not also inside the quote');
  });
  it('an embed item is still an embed, quoted', () => {
    // Sage = `- ![[A]]` alone would be a pass-through wrapper (US-6.5), as outside quotes.
    const r = compile('> ![[Sage]]', true, { ...NOTES, 'Sage.md': 'Intro.\n\n- ![[A]]' });
    assertBlock(r, '> **Sage**\n>\n> Intro.\n>\n> **A**\n>\n> # A\n>\n> AAA');
  });
});

describe('US-1.5 AC-8: links', () => {
  const NOTES = { 'A.md': '# A\n\nAAA', 'B.md': '# B\n\nBBB' };
  it('a link to a note that is only quoted is a link to a note not in the book', () => {
    const r = compile('> ![[Sage]]\n\nSee [[Sage]]. See [[Sage#Detail]].', true);
    assert.ok(r.content.includes(
      "See <!-- Warning: link target 'Sage' not embedded in compiled output -->. " +
      "See <!-- Warning: link target 'Sage#Detail' not embedded in compiled output -->.",
    ), r.content);
    assert.deepEqual(r.warningDetails.map(w => w.message), [
      "link target 'Sage' not embedded in compiled output",
      "link target 'Sage#Detail' not embedded in compiled output",
    ]);
  });
  it('links inside the quoted content are converted', () => {
    const r = compile('> ![[Sage]]\n\n![[A]]', false, { ...NOTES, 'Sage.md': 'See [[A]].' });
    assertBlock(r, '> **Sage**\n>\n> See [A](#A).');
  });
  for (const on of BOTH) {
    it(`a note quoted and listed in a ToC is embedded from the ToC (normalise ${on})`, () => {
      const r = compile('> ![[A]]\n\n- [[A]]\n- [[B]]', on, NOTES);
      assertBlock(r, '> **A**\n>\n> # A\n>\n> AAA');
      assert.match(r.content, /^## A$/m);
      assert.match(r.content, /^## B$/m);
      assert.equal(r.content.split('AAA').length, 3, 'A in the quote and in full');
    });
    it(`links to a note quoted and in the book go to the book copy (normalise ${on})`, () => {
      const r = compile('> ![[Sage]]\n\nSee [[Sage]] and [[Sage#Detail]].\n\n- [[Sage]]', on);
      assert.ok(r.content.includes('See [Sage](#Sage) and [Detail](#Detail).'), r.content);
      assert.deepEqual(r.warningDetails, []);
    });
    it(`a heading inside a quote is no link target (normalise ${on})`, () => {
      const r = compile('> ![[Q]]\n\n## Chapter\n\nSee [[#Chapter]].', on, { 'Q.md': '## Chapter\n\nx' });
      assert.ok(r.content.includes('See [Chapter](#Chapter).'), r.content);
      assert.deepEqual(r.warningDetails, [], 'the quoted Chapter makes no duplicate');
    });
  }
});

describe('US-1.5 AC-9: everything else applies inside the quote', () => {
  it('frontmatter is removed', () => {
    const r = compile('> ![[Sage]]', true, { 'Sage.md': '---\ntags: x\n---\n# Wisdom\n\nText.' });
    assertBlock(r, '> **Sage**\n>\n> # Wisdom\n>\n> Text.');
    assert.doesNotMatch(r.content, /tags:/);
  });
  it('an image is copied and its link rewritten', () => {
    const r = compile('> ![[Sage]]', true, { 'Sage.md': '![[pic.png]]', 'pic.png': 'binary' });
    assertBlock(r, '> **Sage**\n>\n> ![](assets/pic.png)');
    assert.equal(r.stats.assetsCopied, 1);
  });
  it('an image on the quote line keeps today\'s rule (guard)', () => {
    const r = compile('> ![[pic.png]]', true, { 'pic.png': 'binary' });
    assertBlock(r, '> ![](assets/pic.png)');
  });
  for (const on of BOTH) {
    it(`code is copied as written, fences prefixed (normalise ${on})`, () => {
      const r = compile('> ![[Sage]]', on, { 'Sage.md': 'Intro.\n\n```\n# not a heading\n[[A]]\n![[A]]\n```\n\nAfter.', 'A.md': 'AAA' });
      assertBlock(r, '> **Sage**\n>\n> Intro.\n>\n> ```\n> # not a heading\n> [[A]]\n> ![[A]]\n> ```\n>\n> After.');
      assert.doesNotMatch(r.content, /AAA/);
      assert.deepEqual(r.warningDetails, []);
    });
  }
  it('an unclosed block is closed with the prefix and reported once', () => {
    const r = compile('> ![[Sage]]\n\nAfter.', true, { 'Sage.md': 'Intro.\n\n```\ncode' });
    assertBlock(r, '> **Sage**\n>\n> Intro.\n>\n> ```\n> code\n> ```\n\nAfter.');
    assert.deepEqual(r.warningDetails, [
      { message: 'Code block not closed; closed at the end of the note', link: '```', file: 'Sage.md', line: 3 },
    ]);
  });
});

describe('US-1.5 AC-10: nothing internal reaches the output', () => {
  for (const on of BOTH) {
    it(`no sentinel or marker, also nested (normalise ${on})`, () => {
      const r = compile('> ![[Sage]]\n\n> > ![[Sage#Detail]]', on, { 'Sage.md': 'See [[Sage]].\n\n![[Inner]]\n\n## Detail\n\nMore.', 'Inner.md': '# Inner\n\nx' });
      assert.doesNotMatch(r.content, /__v[sel]__|<!-- __/);
      assert.ok(r.content.split('\n').every(l => !/^>[ >]*$/.test(l) || /^>( >)*$/.test(l)), 'empty quote lines carry no trailing space');
    });
  }
});

describe('US-1.5: compileAsync gives the same quote', () => {
  it('as compile', async () => {
    const files = { 'index.md': '# Book\n\n> ![[Sage]]\n', 'Sage.md': SAGE };
    const r = await new InMemoryVaultCompiler(files, { normaliseHeadings: true }).compileAsync('index.md');
    assertBlock(r, SAGE_QUOTE);
  });
});
