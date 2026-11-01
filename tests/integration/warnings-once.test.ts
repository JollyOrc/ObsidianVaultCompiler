/**
 * Tests for "each problem is reported once, where it was written" (US-8.5,
 * from #88, decided 2026-10-31).
 *
 * Expected values come from the story's examples, which were measured with
 * v0.17.0 for the "today" column; the AC-5 hashes are the compiled text of the
 * fixture vault before the change. Written before the code (#93).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';
import type { CompileResult } from '../../plugin/src/compiler.ts';


/** US-8.5 | Compiles `files` from `index.md`. */
function compile(files: Record<string, string>, normaliseHeadings = false): CompileResult {
  return new InMemoryVaultCompiler(files, { enableTextMapper: true, assetFolder: 'assets', normaliseHeadings }).compile('index.md');
}

const DUP = { 'a/dup.md': '# A\n\nfrom a\n', 'b/dup.md': '# B\n\nfrom b\n' };
const AMBIGUOUS = 'Ambiguous filename dup.md; using a/dup.md';

describe('US-8.5 AC-1, AC-2: one problem, one entry', () => {
  it('A: a map block gives no warning at all', () => {
    const r = compile({ 'index.md': '# Index\n\n```text-mapper\n0101 grass "Vale"\n```\n' });
    assert.deepEqual(r.warnings, []);
    assert.deepEqual(r.warningDetails, []);
    assert.equal(r.stats.missingReferences, 0);
  });

  it('B: a missing embed is reported once', () => {
    const r = compile({ 'index.md': '# Index\n\n![[Gone]]\n' });
    assert.deepEqual(r.warnings, ['Warning: Missing include']);
    assert.deepEqual(r.warningDetails, [{ message: 'Missing include', link: 'Gone', file: 'index.md', line: 3 }]);
    assert.equal(r.stats.missingReferences, 1);
  });

  it('C: a missing wiki link is reported once, as a wiki link', () => {
    const r = compile({ 'index.md': '# Index\n\nSee [[Gone]] here.\n' });
    assert.deepEqual(r.warnings, ['Warning: Missing wiki link']);
    assert.deepEqual(r.warningDetails, [{ message: 'Missing wiki link', link: 'Gone', file: 'index.md', line: 3 }]);
    assert.equal(r.stats.missingReferences, 1);
  });

  it('F: a missing image is reported once, as an asset', () => {
    const r = compile({ 'index.md': '# Index\n\n![](gone.png)\n' });
    assert.deepEqual(r.warnings, ['Warning: Missing asset']);
    assert.deepEqual(r.warningDetails, [{ message: 'Missing asset', link: 'gone.png', file: 'index.md', line: 3 }]);
    assert.equal(r.stats.missingReferences, 1);
  });

  it('a link that is found gives nothing', () => {
    const r = compile({ 'index.md': '# Index\n\n![[Here]]\n\nSee [[Here]].\n', 'Here.md': '# Here\n\nText.\n' });
    assert.deepEqual(r.warnings, []);
    assert.deepEqual(r.warningDetails, []);
  });

  it('the lookup itself never warns or counts (text check over resolve)', () => {
    const src = readFileSync(new URL('../../plugin/src/compiler.ts', import.meta.url), 'utf8');
    const body = src.match(/\n {2}private resolve\([^)]*\)[^{]*\{([\s\S]*?)\n {2}\}\n/);
    assert.ok(body, 'resolve exists');
    assert.doesNotMatch(body[1], /this\.warnings\.push|this\.warningDetails\.push|missingReferences/);
  });
});

describe('US-8.5 AC-3: ambiguous names are reported per link', () => {
  const E = { 'index.md': '# Index\n\n![[dup]]\n\nSee [[dup]].\n', ...DUP };

  it('E: an embed and a wiki link each report once', () => {
    const r = compile(E);
    assert.deepEqual(r.warnings, [`Warning: ${AMBIGUOUS}`, `Warning: ${AMBIGUOUS}`]);
    assert.deepEqual(r.warningDetails.map(d => ({ ...d, line: 0 })), [
      { message: AMBIGUOUS, link: 'dup', file: 'index.md', line: 0 },
      { message: AMBIGUOUS, link: 'dup', file: 'index.md', line: 0 },
    ]);
    assert.equal(r.warningDetails[0].line, 3, 'the embed');
    assert.match(r.content, /from a/);
    assert.doesNotMatch(r.content, /from b/);
  });

  it('E: the wiki link reports its own line, 5 (#95)', () => {
    assert.equal(compile(E).warningDetails[1].line, 5);
  });

  for (const normaliseHeadings of [true, false]) {
    it(`E2: a wrapper around an ambiguous embed reports once ("Normalise headings" ${normaliseHeadings ? 'on: pass-through' : 'off'})`, () => {
      const r = compile({ 'index.md': '# Index\n\n- [[Wrapper]]\n', 'Wrapper.md': '![[dup]]\n', ...DUP }, normaliseHeadings);
      assert.deepEqual(r.warningDetails, [{ message: AMBIGUOUS, link: 'dup', file: 'Wrapper.md', line: 1 }]);
      assert.deepEqual(r.warnings, [`Warning: ${AMBIGUOUS}`]);
    });
  }

  for (const normaliseHeadings of [true, false]) {
    it(`E2: with frontmatter above the embed, the line counts source lines ("Normalise headings" ${normaliseHeadings ? 'on' : 'off'})`, () => {
      const r = compile({ 'index.md': '# Index\n\n- [[Wrapper]]\n', 'Wrapper.md': '---\ntags: [x]\n---\n![[dup]]\n', ...DUP }, normaliseHeadings);
      assert.deepEqual(r.warningDetails, [{ message: AMBIGUOUS, link: 'dup', file: 'Wrapper.md', line: 4 }]);
    });
  }

  it('E3: an ambiguous image reports once and keeps the first path', () => {
    const r = compile({ 'index.md': '# Index\n\n![](logo.png)\n', 'x/logo.png': '', 'y/logo.png': '' });
    const message = 'Ambiguous filename logo.png; using x/logo.png';
    assert.deepEqual(r.warningDetails, [{ message, link: 'logo.png', file: 'index.md', line: 3 }]);
    assert.deepEqual(r.warnings, [`Warning: ${message}`]);
    assert.match(r.content, /!\[\]\(assets\/logo\.png\)/);
  });
});

describe('US-8.5 AC-3: what counts as ambiguous, and Obsidian\'s choice', () => {
  it('a name found relative to the note is not ambiguous', () => {
    const r = new InMemoryVaultCompiler({ 'a/index.md': '# Index\n\n![[dup]]\n', ...DUP }, { enableTextMapper: true, assetFolder: 'assets' })
      .compile('a/index.md');
    assert.match(r.content, /from a/);
    assert.deepEqual(r.warnings, []);
    assert.deepEqual(r.warningDetails, []);
  });

  it('with a link lookup like Obsidian\'s, the ambiguity is still reported, naming the path it chose', () => {
    const r = new InMemoryVaultCompiler({ 'index.md': '# Index\n\n![[dup]]\n', ...DUP }, {
      enableTextMapper: true,
      assetFolder: 'assets',
      resolve: (raw: string) => (raw === 'dup' ? 'b/dup.md' : null),
    }).compile('index.md');
    const message = 'Ambiguous filename dup.md; using b/dup.md';
    assert.match(r.content, /from b/);
    assert.deepEqual(r.warningDetails, [{ message, link: 'dup', file: 'index.md', line: 3 }]);
    assert.deepEqual(r.warnings, [`Warning: ${message}`]);
  });
});

describe('US-8.5 AC-3: Obsidian\'s lookup and a file next to the note', () => {
  it('a lookup that finds the file next to the note reports nothing', () => {
    const r = new InMemoryVaultCompiler({ 'a/index.md': '# Index\n\n![[dup]]\n', ...DUP }, {
      enableTextMapper: true,
      assetFolder: 'assets',
      resolve: (raw: string) => (raw === 'dup' ? 'a/dup.md' : null),
    }).compile('a/index.md');
    assert.match(r.content, /from a/);
    assert.deepEqual(r.warningDetails, []);
  });
});

describe('US-8.5 AC-4: composed cases', () => {
  it('a ToC item reports once, from the embed it becomes', () => {
    const r = compile({ 'index.md': '# Index\n\n- [[dup]]\n', ...DUP });
    assert.equal(r.warningDetails.length, 1);
    assert.equal(r.warningDetails[0].message, AMBIGUOUS);
    assert.equal(r.warnings.length, 1);
  });

  it('a note embedded twice reports its problem twice, once per place (as today)', () => {
    const r = compile({ 'index.md': '# Index\n\n![[Part]]\n\n![[Part]]\n', 'Part.md': '# Part\n\n![[Gone]]\n' });
    const detail = { message: 'Missing include', link: 'Gone', file: 'Part.md', line: 3 };
    assert.deepEqual(r.warningDetails, [detail, detail]);
    assert.deepEqual(r.warnings, ['Warning: Missing include', 'Warning: Missing include']);
    assert.equal(r.stats.missingReferences, 2);
  });
});

const VAULT_DIR = resolve(new URL('../../', import.meta.url).pathname, 'tests/fixtures/basic-vault');

/** US-8.5 | The fixture vault as Obsidian sees it (dot folders skipped). */
function loadVault(dir: string, files: Record<string, string> = {}): Record<string, string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) loadVault(path, files);
    else files[relative(VAULT_DIR, path)] = entry.name.endsWith('.md') ? readFileSync(path, 'utf8') : '';
  }
  return files;
}

/** US-8.5 | Compiles a fixture start note. */
function compileFixture(start: string, normaliseHeadings: boolean): CompileResult {
  return new InMemoryVaultCompiler(loadVault(VAULT_DIR), { enableTextMapper: true, assetFolder: 'assets', normaliseHeadings }).compile(start);
}

const sha = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16);

describe('US-8.5 AC-5: the compiled text does not change', () => {
  // Measured 2026-10-31 with v0.17.0, before the change. The index2compile.md
  // hashes changed once on purpose with #96 (v0.18.0): its `- ![[media.png]]`
  // keeps the bullet (US-1.3 AC-2); asserted below. They changed again with
  // #99 (v0.19.0): only `[B](#b)` → `[B](#B)` (US-2.3 AC-2), asserted below.
  // The smoke book gained `3 Heading links.md` for M17; a line diff against
  // v0.18.0 showed only that note's six links (US-2.3) and no other change.
  // #103 (v0.20.0) added `4 Code examples.md` for M18; a line diff against
  // v0.19.0 showed only that note and the start note's list of checks.
  const BEFORE: Array<[string, boolean, string]> = [
    ['index2compile.md', false, '6f08f48986a530b4'],
    ['index2compile.md', true, '61fc2cd03fc90d87'],
    ['Smoke/Smoke book.md', false, 'f563479e034c9b27'],
    ['Smoke/Smoke book.md', true, '435e9a13b67cc075'],
  ];
  for (const [start, normaliseHeadings, hash] of BEFORE) {
    it(`${start}, "Normalise headings" ${normaliseHeadings ? 'on' : 'off'}: byte-identical`, () => {
      assert.equal(sha(compileFixture(start, normaliseHeadings).content), hash);
    });
  }

  it('#99: the one intended change of v0.19.0 — anchors are heading text', () => {
    for (const normaliseHeadings of [false, true]) {
      const lines = compileFixture('index2compile.md', normaliseHeadings).content.split('\n');
      assert.equal(lines.filter(l => l === '- [B](#B)').length, 2);
      assert.ok(!lines.includes('- [B](#b)'));
    }
  });

  it('#96: the one intended change — the image item keeps its bullet', () => {
    for (const normaliseHeadings of [false, true]) {
      const lines = compileFixture('index2compile.md', normaliseHeadings).content.split('\n');
      assert.ok(lines.includes('- ![](assets/media.png)'));
      assert.ok(!lines.includes('![](assets/media.png)'));
    }
  });

  it('fixture warnings: index2compile.md has only its real missing note', () => {
    const index = compileFixture('index2compile.md', false);
    assert.deepEqual(index.warnings, ['Warning: Missing include']);
    assert.deepEqual(index.warningDetails, [{ message: 'Missing include', link: 'missing.md', file: 'index2compile.md', line: 6 }]);
  });

  it('fixture warnings: the smoke book has only the unclosed block of its code note (US-1.4 AC-6)', () => {
    const smoke = compileFixture('Smoke/Smoke book.md', false);
    assert.deepEqual(smoke.warnings, ['Warning: Code block not closed; closed at the end of the note']);
    assert.deepEqual(smoke.warningDetails, [
      { message: 'Code block not closed; closed at the end of the note', link: '```', file: 'Smoke/4 Code examples.md', line: 33 },
    ]);
  });
});
