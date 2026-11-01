/**
 * Tests for anchors that Obsidian finds (US-2.3 AC-1 to AC-7, #83, #85).
 *
 * Expected values are the story's examples. `findInObsidian` models the
 * lookup measured in Obsidian on 2026-11-01 (the table in US-2.3); every
 * anchor written is checked against it as well as against the example.
 * Written before the code (#99); all failed on v0.18.0.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';


interface Heading { level: number; text: string; }

/** US-2.3 | AC-7: the headings of `content`, without code fences. */
function headingsOf(content: string): Heading[] {
  const found: Heading[] = [];
  let fence: string | null = null;
  for (const line of content.split('\n')) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (fence === null) fence = marker[1][0];
      else if (marker[1][0] === fence) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const h = line.match(/^(#{1,6})\s+(.*?)\s*$/);
    if (h) found.push({ level: h[1].length, text: h[2] });
  }
  return found;
}

/** US-2.3 | Text as Obsidian compares it (A9, D7–D10). */
function comparable(text: string): string {
  return text.replace(/\*\*/g, '').replace(/\[\[|\]\]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * US-2.3 | A heading's text as Obsidian compares it: `#`, `:`, `|`, `^`
 * become spaces in the heading only, not in the link (F1–F6; G7 `%3A` is
 * not found).
 */
function comparableHeading(text: string): string {
  return comparable(text.replace(/[#:|^]/g, ' '));
}

/**
 * US-2.3 | AC-6: the heading Obsidian opens for `anchor` (without its `#`),
 * as measured: text case-insensitive, `%` escapes decoded, a path `A#B#C`
 * finds the first `C` whose parents contain `B` and above it `A`, nearest
 * first, parents skippable. Returns the heading's index, or -1.
 */
function findInObsidian(content: string, anchor: string): number {
  const parts = anchor.split('#').filter(p => p !== '').map(p => comparable(decodeURIComponent(p)));
  const all = headingsOf(content);
  for (let i = 0; i < all.length; i++) {
    if (comparableHeading(all[i].text) !== parts[parts.length - 1]) continue;
    const parents: string[] = [];
    let level = all[i].level;
    for (let j = i - 1; j >= 0; j--) {
      if (all[j].level < level) {
        parents.push(comparableHeading(all[j].text));
        level = all[j].level;
      }
    }
    if (isSubsequence(parts.slice(0, -1).reverse(), parents)) return i;
  }
  return -1;
}

/** US-2.3 | AC-6: `wanted` occurs in `list` in order, gaps allowed. */
function isSubsequence(wanted: string[], list: string[]): boolean {
  let k = 0;
  for (const w of wanted) {
    while (k < list.length && list[k] !== w) k++;
    if (k === list.length) return false;
    k++;
  }
  return true;
}

/** US-2.3 | Compiles `index.md` of `files`. */
function compile(files: Record<string, string>, normaliseHeadings = false): CompileResult {
  return new InMemoryVaultCompiler(files, { enableTextMapper: true, assetFolder: 'assets', normaliseHeadings })
    .compile('index.md');
}

/** US-2.3 | The anchors of all markdown links (not images, not block links). */
function anchorsOf(content: string): string[] {
  return [...content.matchAll(/(?<!!)\[[^\]]*\]\(#([^)^][^)]*)\)/g)].map(m => m[1]);
}

/** US-2.3 | Every anchor in `r` opens a heading in Obsidian (model). */
function assertAllFound(r: CompileResult): void {
  for (const a of anchorsOf(r.content)) {
    assert.notEqual(findInObsidian(r.content, a), -1, `#${a} is not found; headings: ${JSON.stringify(headingsOf(r.content))}`);
  }
}

/** US-2.3 | The index of the `n`-th heading (from 0) whose text is `text`. */
function nth(content: string, text: string, n: number): number {
  const all = headingsOf(content);
  let seen = 0;
  for (let i = 0; i < all.length; i++) {
    if (all[i].text === text && seen++ === n) return i;
  }
  return -1;
}

describe('US-2.3: the Obsidian model reproduces the measurement (guard for the tests themselves)', () => {
  const NOTE = [
    '# Zeal', '# The Brawling and Fortune Pools', '# 1.3 Grit & Zeal', '# One', '## Intro', '# Two', '## Intro',
    '# Part A', '## Chapter Three', '### Intro', '# Part B', '## Chapter Four', '### Intro',
    '# Rules (optional)', '# Café Rules', "# Why? Because, it's fine", '# The **bold** rule', '# Notes on [[Other]]',
  ].join('\n\n');
  const at = (a: string) => headingsOf(NOTE)[findInObsidian(NOTE, a)]?.text ?? 'not found';
  const under = (a: string) => {
    const i = findInObsidian(NOTE, a);
    return i === -1 ? 'not found' : headingsOf(NOTE).slice(0, i).reverse().find(h => h.level < headingsOf(NOTE)[i].level)?.text;
  };
  it('A1–A9: text, case-insensitive, encoded; slugs are not found', () => {
    assert.equal(at('zeal'), 'Zeal');
    assert.equal(at('Zeal'), 'Zeal');
    assert.equal(at('The%20Brawling%20and%20Fortune%20Pools'), 'The Brawling and Fortune Pools');
    assert.equal(at('the%20brawling%20and%20fortune%20pools'), 'The Brawling and Fortune Pools');
    assert.equal(at('the-brawling-and-fortune-pools'), 'not found');
    assert.equal(at('1.3%20Grit%20&%20Zeal'), '1.3 Grit & Zeal');
    assert.equal(at('1.3-grit-zeal'), 'not found');
  });
  it('B1–B4, C1–C4: duplicates and paths', () => {
    assert.equal(under('Intro'), 'One');
    assert.equal(at('intro-1'), 'not found');
    assert.equal(under('Two#Intro'), 'Two');
    assert.equal(under('Part%20B#Intro'), 'Chapter Four');
    assert.equal(under('Chapter%20Four#Intro'), 'Chapter Four');
    assert.equal(under('Part%20B#Chapter%20Four#Intro'), 'Chapter Four');
  });
  it('E3, E7, E8: percent, ambiguous path, path case', () => {
    const more = '# 50% off\n\n# Book\n\n## Intro\n\n## Intro\n\n# Chapter One\n\n## Intro\n\n# Chapter Two\n\n## Intro';
    assert.equal(headingsOf(more)[findInObsidian(more, '50%25%20off')].text, '50% off');
    assert.equal(findInObsidian(more, 'Book#Intro'), 2);
    assert.equal(findInObsidian(more, 'chapter%20two#intro'), 7);
  });
  it('F1–F6, G1–G9: # : | ^ as spaces; a converted link in a heading', () => {
    const more = '# C# basics\n\n# Done :)\n\n# Time: noon\n\n## See [Pools](#Pools)\n\n# A | B\n\n# Up ^ down';
    const text = (a: string) => headingsOf(more)[findInObsidian(more, a)]?.text ?? 'not found';
    assert.equal(text('C%20basics'), 'C# basics');
    assert.equal(text('C%20%20basics'), 'C# basics');
    assert.equal(text('Done%20%29'), 'Done :)');
    assert.equal(text('Done%20%20%29'), 'Done :)');
    assert.equal(text('Time%20noon'), 'Time: noon');
    assert.equal(text('Time%3A%20noon'), 'not found');
    assert.equal(text('See%20[Pools]%28%20Pools%29'), 'See [Pools](#Pools)');
    assert.equal(text('See%20Pools'), 'not found');
    assert.equal(text('A%20B'), 'A | B');
    assert.equal(text('Up%20down'), 'Up ^ down');
  });
  it('D1–D10: characters', () => {
    assert.equal(at('Rules%20(optional)'), 'Rules (optional)');
    assert.equal(at('Rules%20%28optional%29'), 'Rules (optional)');
    assert.equal(at('Café%20Rules'), 'Café Rules');
    assert.equal(at('Caf%C3%A9%20Rules'), 'Café Rules');
    assert.equal(at("Why?%20Because,%20it's%20fine"), "Why? Because, it's fine");
    assert.equal(at('The%20bold%20rule'), 'The **bold** rule');
    assert.equal(at('The%20**bold**%20rule'), 'The **bold** rule');
    assert.equal(at('Notes%20on%20Other'), 'Notes on [[Other]]');
    assert.equal(at('Notes%20on%20[[Other]]'), 'Notes on [[Other]]');
  });
});

describe('US-2.3 AC-2: the anchor is the heading text with space and brackets encoded', () => {
  // [heading in the note, the link as Obsidian writes it (F1–F6), anchor]
  const ROWS: Array<[string, string, string]> = [
    ['Zeal', 'Zeal', 'Zeal'],
    ['The Brawling and Fortune Pools', 'The Brawling and Fortune Pools', 'The%20Brawling%20and%20Fortune%20Pools'],
    ['1.3.1 Combat', '1.3.1 Combat', '1.3.1%20Combat'],
    ['Grit & Zeal', 'Grit & Zeal', 'Grit%20&%20Zeal'],
    ['Rules (optional)', 'Rules (optional)', 'Rules%20%28optional%29'],
    ['Café Rules', 'Café Rules', 'Café%20Rules'],
    ['The **bold** rule', 'The **bold** rule', 'The%20**bold**%20rule'],
    ['50% off', '50% off', '50%25%20off'],
    ['C# basics', 'C basics', 'C%20basics'],
    ['Done :)', 'Done )', 'Done%20%29'],
    ['Time: noon', 'Time noon', 'Time%20noon'],
    ['A | B', 'A B', 'A%20B'],
    ['Up ^ down', 'Up down', 'Up%20down'],
  ];
  for (const [heading, link, anchor] of ROWS) {
    it(`## ${heading} → #${anchor}`, () => {
      const r = compile({
        'index.md': `# Book\n\n![[Note]]\n\nSee [[Note#${link}]].\n`,
        'Note.md': `# Note\n\n## ${heading}\n\ntext\n`,
      });
      assert.ok(r.content.includes(`\nSee [${heading}](#${anchor}).\n`), r.content);
      assert.deepEqual(r.warningDetails, []);
      assertAllFound(r);
    });
  }
  it('a converted link in a heading (F4, G8)', () => {
    const r = compile({
      'index.md': '# Book\n\n![[Pools]]\n\n![[Note]]\n\nSee [[Note#See [[Pools]]]].\n',
      'Pools.md': '# Pools\n\np\n',
      'Note.md': '# Note\n\n## See [[Pools]]\n\ntext\n',
    });
    assert.match(r.content, /^## See \[Pools\]\(#Pools\)$/m);
    assert.ok(r.content.includes('](#See%20[Pools]%28%20Pools%29)'), r.content);
    assertAllFound(r);
  });

  it('headings that differ only in # : | ^ are duplicates (AC-6)', () => {
    const r = compile({
      'index.md': '# Book\n\n![[A]]\n\n![[B]]\n\nSee [[B#C basics]].\n',
      'A.md': '# A\n\n## C# basics\n\na\n',
      'B.md': '# B\n\n## C basics\n\nb\n',
    }, true);
    assert.ok(r.content.includes('\nSee [C basics](#B#C%20basics).\n'), r.content);
    assert.equal(findInObsidian(r.content, 'B#C%20basics'), nth(r.content, 'C basics', 0));
  });
});

describe('US-2.3 AC-3: links to a note point at its title in the output', () => {
  const FILES = {
    'index.md': '# Book\n\n![[1.2 Third-Level]]\n\n![[1.3 Grit & Zeal]]\n\nSee [[1.2 Third-Level]], [x](1.2%20Third-Level.md), [[1.3 Grit & Zeal]].\n',
    '1.2 Third-Level.md': 'intro\n',
    '1.3 Grit & Zeal.md': '# Grit\n\ng\n',
  };
  for (const normalise of [false, true]) {
    it(`title rule, own label (normalise ${normalise})`, () => {
      const r = compile(FILES, normalise);
      assert.match(r.content, /\nSee \[Third-Level\]\(#Third-Level\), \[x\]\(#Third-Level\), \[Grit & Zeal\]\(#Grit%20&%20Zeal\)\.\n/);
      assert.deepEqual(r.warningDetails, []);
      assertAllFound(r);
    });
  }

  it('a note embedded twice: the first place, no path, no warning', () => {
    const r = compile({
      'index.md': '# Book\n\n![[1.2 Third-Level]]\n\n![[1.2 Third-Level]]\n\nSee [[1.2 Third-Level]].\n',
      '1.2 Third-Level.md': 'intro\n',
    });
    assert.match(r.content, /\nSee \[Third-Level\]\(#Third-Level\)\.\n/);
    assert.deepEqual(r.warningDetails, []);
  });

  const SECTION_FORMS: Array<[string, Record<string, string>, boolean]> = [
    ['wiki embed', { 'index.md': '# Book\n\n![[Pools#Other]]\n\nSee [[Pools]].\n' }, false],
    ['markdown embed', { 'index.md': '# Book\n\n![o](Pools.md#Other)\n\nSee [[Pools]].\n' }, false],
    ['pass-through wrapper (US-6.5)', { 'index.md': '# Book\n\n![[Wrap]]\n\nSee [[Pools]].\n', 'Wrap.md': '![[Pools#Other]]\n' }, true],
  ];
  for (const [form, files, normalise] of SECTION_FORMS) {
    it(`a note of which only a section is in the output: that section's heading (${form})`, () => {
      const r = compile({ ...files, 'Pools.md': '# The Fighting Pools\n\n## Fighting Pools\n\ntext\n\n## Other\n\no\n' }, normalise);
      assert.ok(r.content.includes('\nSee [Pools](#Other).\n'), r.content);
      assert.deepEqual(r.warningDetails, []);
    });
  }
});

describe('US-2.3 AC-4: links to a heading in another note', () => {
  const POOLS = '# The Fighting Pools\n\n## Fighting Pools\n\ntext\n\n## Other\n\no\n';
  const withLink = (link: string) => compile({ 'index.md': `# Book\n\n![[Pools]]\n\nSee ${link}.\n`, 'Pools.md': POOLS });

  const ROWS: Array<[string, string]> = [
    ['[[Pools#Fighting Pools]]', '[Fighting Pools](#Fighting%20Pools)'],
    ['[x](Pools.md#Fighting%20Pools)', '[x](#Fighting%20Pools)'],
    ['[[Pools#fighting pools]]', '[Fighting Pools](#Fighting%20Pools)'],
    ['[[Pools#Fighting Pools|the pools]]', '[the pools](#Fighting%20Pools)'],
    ['[[Pools#The Fighting Pools]]', '[The Fighting Pools](#Pools)'],
  ];
  for (const [link, out] of ROWS) {
    it(`${link} → ${out}`, () => {
      const r = withLink(link);
      assert.ok(r.content.includes(`\nSee ${out}.\n`), r.content);
      assert.deepEqual(r.warningDetails, []);
      assertAllFound(r);
    });
  }

  it('a heading the note does not have: the note\'s title and a warning', () => {
    const r = withLink('[[Pools#Nope]]');
    assert.ok(r.content.includes('\nSee [Nope](#Pools).\n'), r.content);
    assert.deepEqual(r.warningDetails, [{ message: 'Missing heading anchor: Pools#Nope', link: 'Pools#Nope', file: 'index.md', line: 5 }]);
  });

  it('a heading of the note that is not in the output: where the note starts, and a warning', () => {
    const r = compile({ 'index.md': '# Book\n\n![[Pools#Other]]\n\nSee [[Pools#Fighting Pools]].\n', 'Pools.md': POOLS });
    assert.ok(r.content.includes('\nSee [Fighting Pools](#Other).\n'), r.content);
    assert.deepEqual(r.warningDetails, [{
      message: "heading 'Pools#Fighting Pools' not embedded in compiled output", link: 'Pools#Fighting Pools', file: 'index.md', line: 5,
    }]);
  });

  it('the heading of the only section embedded: found, no warning', () => {
    const r = compile({ 'index.md': '# Book\n\n![[Pools#Other]]\n\nSee [[Pools#Other]].\n', 'Pools.md': POOLS });
    assert.ok(r.content.includes('\nSee [Other](#Other).\n'), r.content);
    assert.deepEqual(r.warningDetails, []);
  });

  it('a note that is not in the output: US-8.3 as today (guard)', () => {
    const r = compile({ 'index.md': '# Book\n\nSee [[Pools#Fighting Pools]].\n', 'Pools.md': POOLS });
    assert.match(r.content, /<!-- Warning: link target 'Pools#Fighting Pools' not embedded in compiled output -->|<!-- Warning: link target 'Pools' not embedded in compiled output -->/);
  });
});

describe('US-2.3 AC-5: links to a heading in the same note (#83)', () => {
  const GRIT = '# Grit\n\nSee [[#Rolling]], [r](#Rolling), [r](#rolling), [[#Two#Intro]].\n\n## Rolling\n\nx\n\n## One\n\n### Intro\n\n## Two\n\n### Intro\n\ny\n';
  for (const normalise of [false, true]) {
    it(`heading, case, author's path (normalise ${normalise})`, () => {
      const r = compile({ 'index.md': '# Book\n\n![[Grit]]\n', 'Grit.md': GRIT }, normalise);
      assert.ok(r.content.includes('\nSee [Rolling](#Rolling), [r](#Rolling), [r](#Rolling), [Intro](#Two#Intro).\n'), r.content);
      assert.deepEqual(r.warningDetails, []);
      assert.equal(findInObsidian(r.content, 'Two#Intro'), nth(r.content, 'Intro', 1));
    });
  }

  it('a link to the note\'s own first heading, replaced by the title', () => {
    const r = compile({
      'index.md': '# Book\n\n![[Pools]]\n',
      'Pools.md': '# The Fighting Pools\n\nSee [r](#The%20Fighting%20Pools).\n',
    });
    assert.ok(r.content.includes('\nSee [r](#Pools).\n'), r.content);
    assert.deepEqual(r.warningDetails, []);
  });

  it('a heading the note does not have: markdown kept, wiki written as markdown, both warned', () => {
    const r = compile({ 'index.md': '# Book\n\n![[Grit]]\n', 'Grit.md': '# Grit\n\nSee [p](#Gone).\n\nSee [[#Gone]].\n' });
    assert.ok(r.content.includes('\nSee [p](#Gone).\n'), r.content);
    const spaced = compile({ 'index.md': '# Book\n\n![[Grit]]\n', 'Grit.md': '# Grit\n\nSee [p](#Gone%20Away).\n' });
    assert.ok(spaced.content.includes('\nSee [p](#Gone%20Away).\n'), spaced.content);
    assert.ok(r.content.includes('\nSee [Gone](#Gone).\n'), r.content);
    assert.deepEqual(r.warningDetails, [
      { message: 'Missing heading anchor: #Gone', link: '#Gone', file: 'Grit.md', line: 3 },
      { message: 'Missing heading anchor: #Gone', link: '#Gone', file: 'Grit.md', line: 5 },
    ]);
  });

  it('the same heading text in another note: the link stays in its own note', () => {
    const r = compile({
      'index.md': '# Book\n\n![[A]]\n\n![[B]]\n',
      'A.md': '# A\n\n## Rolling\n\na\n',
      'B.md': '# B\n\nSee [[#Rolling]].\n\n## Rolling\n\nb\n',
    }, true);
    assert.ok(r.content.includes('\nSee [Rolling](#B#Rolling).\n'), r.content);
    assert.equal(findInObsidian(r.content, 'B#Rolling'), nth(r.content, 'Rolling', 1));
  });

  it('a note embedded twice: each copy\'s links stay in that copy', () => {
    const r = compile({
      'index.md': '# Book\n\n## One\n\n![[G]]\n\n## Two\n\n![[G]]\n',
      'G.md': '# G\n\nSee [[#Rolling]].\n\n## Rolling\n\nx\n',
    }, true);
    const sees = r.content.split('\n').filter(l => l.startsWith('See '));
    assert.deepEqual(sees, ['See [Rolling](#Rolling).', 'See [Rolling](#Two#G#Rolling).']);
    assert.equal(findInObsidian(r.content, 'Two#G#Rolling'), nth(r.content, 'Rolling', 1));
  });

  it('a link brought along by a section embed belongs to the note it is written in', () => {
    const r = compile({
      'index.md': '# Book\n\n## Rolling\n\nbook\n\n![[Grit#Part]]\n',
      'Grit.md': '# Grit\n\n## Part\n\nSee [[#Rolling]].\n\n## Rolling\n\nx\n',
    });
    // Only `## Part` of Grit is in the output; Grit's Rolling is not.
    assert.ok(r.content.includes('\nSee [Rolling](#Part).\n'), r.content);
    assert.deepEqual(r.warningDetails, [{ message: "heading 'Grit#Rolling' not embedded in compiled output", link: '#Rolling', file: 'Grit.md', line: 5 }]);
  });

  it('block links keep today\'s behaviour (out of scope, guard)', () => {
    const r = compile({ 'index.md': '# Book\n\n![[Grit]]\n', 'Grit.md': '# Grit\n\nSee [b](#^blk).\n\ny ^blk\n' });
    assert.ok(r.content.includes('\nSee [b](#^blk).\n'), r.content);
  });
});

describe('US-2.3 AC-6: headings with the same text (#85)', () => {
  const ONE_TWO = { 'One.md': '# One\n\n## Intro\n\nfirst\n', 'Two.md': '# Two\n\n## Intro\n\nsecond\n' };
  const W = (link: string, file: string, line: number) => ({
    message: 'Heading "Intro" occurs 2 times and no heading path tells them apart; the link goes to the first',
    link, file, line,
  });

  it('the first Intro: plain text (normalise on)', () => {
    const r = compile({ 'index.md': '# Book\n\n![[One]]\n\n![[Two]]\n\nSee [[One#Intro]].\n', ...ONE_TWO }, true);
    assert.ok(r.content.includes('\nSee [Intro](#Intro).\n'), r.content);
    assert.deepEqual(r.warningDetails, []);
  });

  it('the second Intro: the parent in front (normalise on)', () => {
    const r = compile({ 'index.md': '# Book\n\n![[One]]\n\n![[Two]]\n\nSee [[Two#Intro]].\n', ...ONE_TWO }, true);
    assert.ok(r.content.includes('\nSee [Intro](#Two#Intro).\n'), r.content);
    assert.equal(findInObsidian(r.content, 'Two#Intro'), nth(r.content, 'Intro', 1));
    assert.deepEqual(r.warningDetails, []);
  });

  it('the second Intro with normalise off: Two is no parent, first match and W', () => {
    const r = compile({ 'index.md': '# Book\n\n![[One]]\n\n![[Two]]\n\nSee [[Two#Intro]].\n', ...ONE_TWO }, false);
    assert.ok(r.content.includes('\nSee [Intro](#Intro).\n'), r.content);
    assert.deepEqual(r.warningDetails, [W('Two#Intro', 'index.md', 7)]);
  });

  it('a parent with spaces', () => {
    const r = compile({
      'index.md': '# Book\n\n![[Chapter One]]\n\n![[Chapter Two]]\n\nSee [[Chapter Two#Intro]].\n',
      'Chapter One.md': '# Chapter One\n\n## Intro\n\nfirst\n',
      'Chapter Two.md': '# Chapter Two\n\n## Intro\n\nsecond\n',
    }, true);
    assert.ok(r.content.includes('\nSee [Intro](#Chapter%20Two#Intro).\n'), r.content);
    assert.equal(findInObsidian(r.content, 'Chapter%20Two#Intro'), nth(r.content, 'Intro', 1));
  });

  it('two parents needed', () => {
    const r = compile({
      'index.md': '# Book\n\n![[Part A]]\n\n![[Part B]]\n\nSee [[Part B#Intro]].\n',
      'Part A.md': '# Part A\n\n## Ch\n\n### Intro\n\na\n',
      'Part B.md': '# Part B\n\n## Ch\n\n### Intro\n\nb\n',
    }, true);
    assert.ok(r.content.includes('\nSee [Intro](#Part%20B#Ch#Intro).\n'), r.content);
    assert.equal(findInObsidian(r.content, 'Part%20B#Ch#Intro'), nth(r.content, 'Intro', 1));
    assert.deepEqual(r.warningDetails, []);
  });

  for (const normalise of [false, true]) {
    it(`two notes with the same title side by side: first match and W (normalise ${normalise})`, () => {
      const r = compile({
        'index.md': '# Book\n\n![[1 Intro]]\n\n![[2 Intro]]\n\nSee [[2 Intro]].\n',
        '1 Intro.md': 'one\n',
        '2 Intro.md': 'two\n',
      }, normalise);
      assert.ok(r.content.includes('\nSee [Intro](#Intro).\n'), r.content);
      assert.deepEqual(r.warningDetails, [W('2 Intro', 'index.md', 7)]);
    });
  }

  it('parents that differ only in case do not tell headings apart (E8)', () => {
    const r = compile({
      'index.md': '# Book\n\n![[A]]\n\n![[B]]\n\nSee [[B#Intro]].\n',
      'A.md': '# A\n\n## Part\n\n### Intro\n\na\n',
      'B.md': '# B\n\n## part\n\n### Intro\n\nb\n',
    }, true);
    assert.ok(r.content.includes('\nSee [Intro](#B#part#Intro).\n') || r.content.includes('\nSee [Intro](#B#Intro).\n'), r.content);
    assert.equal(findInObsidian(r.content, anchorsOf(r.content)[0]), nth(r.content, 'Intro', 1));
  });
});

describe('US-2.3 AC-7: which headings count', () => {
  it('a heading-like line in a code fence is not a duplicate', () => {
    const r = compile({
      'index.md': '# Book\n\n```\n## Intro\n```\n\n## Intro\n\n![[A]]\n',
      'A.md': '# A\n\nSee [[index#Intro]].\n',
    });
    assert.ok(r.content.includes('\nSee [Intro](#Intro).\n'), r.content);
    assert.deepEqual(r.warningDetails, []);
  });

  it('the composed book: every anchor is found, normalise on and off', () => {
    const files = {
      'index.md': '# Book\n\n![[1.2 Third-Level]]\n\n![[Pools]]\n\n![[One]]\n\n![[Two]]\n\nSee [[1.2 Third-Level]], [[Pools#Fighting Pools]], [[Two#Intro]], [[One]].\n',
      '1.2 Third-Level.md': 'intro\n',
      'Pools.md': '# The Fighting Pools\n\n## Fighting Pools\n\nSee [[#Fighting Pools]].\n',
      'One.md': '# One\n\n## Intro\n\nfirst\n',
      'Two.md': '# Two\n\n## Intro\n\nsecond\n',
    };
    for (const normalise of [false, true]) {
      const r = compile(files, normalise);
      assert.equal(anchorsOf(r.content).length, 5, r.content);
      assertAllFound(r);
    }
  });
});
