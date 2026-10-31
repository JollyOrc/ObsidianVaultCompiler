/**
 * Tests for source lines in warnings (US-8.4 AC-5, #95).
 *
 * Each case is a row of the story's table: the note text, the warning's
 * expected note and line. The warning tested is always the one for the last
 * line of the note named. Written before the code (#97); `today` marks the
 * cases that were already right.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';


const HERE = { 'Here.md': '# Here\n\nfrom here\n' };
const HERE2 = { 'Here2.md': '# Two\n\nx\ny\n' };

interface Case {
  name: string;
  files: Record<string, string>;
  message: string;
  file: string;
  line: number;
  normaliseHeadings?: boolean;
  today?: boolean;
}

const CASES: Case[] = [
  { name: 'a link with nothing above it', files: { 'index.md': '# Index\n\ntext\n\nSee [[Gone]].\n' }, message: 'Missing wiki link', file: 'index.md', line: 5, today: true },
  { name: 'a link after an embed', files: { 'index.md': '# Index\n\n![[Here]]\n\nSee [[Gone]].\n', ...HERE }, message: 'Missing wiki link', file: 'index.md', line: 5 },
  { name: 'a markdown link after an embed', files: { 'index.md': '# Index\n\n![[Here]]\n\nSee [x](Gone.md).\n', ...HERE }, message: 'Missing markdown link', file: 'index.md', line: 5 },
  { name: 'a link to a note not embedded, after an embed', files: { 'index.md': '# Index\n\n![[Here]]\n\nSee [[Other]].\n', ...HERE, 'Other.md': '# O\n' }, message: "link target 'Other' not embedded in compiled output", file: 'index.md', line: 5 },
  { name: 'a link after two embeds', files: { 'index.md': '# Index\n\n![[Here]]\n\n![[Here2]]\n\nSee [[Gone]].\n', ...HERE, ...HERE2 }, message: 'Missing wiki link', file: 'index.md', line: 7 },
  { name: 'a link after a ToC list', files: { 'index.md': '# Index\n\n- [[Here]]\n- [[Here2]]\n\nSee [[Gone]].\n', ...HERE, ...HERE2 }, message: 'Missing wiki link', file: 'index.md', line: 6 },
  { name: 'a link after a section embed', files: { 'index.md': '# Index\n\n![[Here#Here]]\n\nSee [[Gone]].\n', ...HERE }, message: 'Missing wiki link', file: 'index.md', line: 5 },
  { name: 'a link below frontmatter', files: { 'index.md': '---\ntags: [x]\n---\n# Index\n\ntext\n\nSee [[Gone]].\n' }, message: 'Missing wiki link', file: 'index.md', line: 8 },
  { name: 'a link after a map block', files: { 'index.md': '# Index\n\n```text-mapper\n0101 grass\n0102 grass\n```\n\nSee [[Gone]].\n' }, message: 'Missing wiki link', file: 'index.md', line: 8 },
  { name: 'a link after a Dataview block', files: { 'index.md': '# Index\n\n```dataview\nLIST\nFROM x\n```\n\nSee [[Gone]].\n' }, message: 'Missing wiki link', file: 'index.md', line: 8 },
  { name: 'an embed after a map block', files: { 'index.md': '# Index\n\n```text-mapper\n0101 grass\n0102 grass\n```\n\n![[Gone]]\n' }, message: 'Missing include', file: 'index.md', line: 8 },
  { name: 'an embed after a Dataview block', files: { 'index.md': '# Index\n\n```dataview\nLIST\nFROM x\n```\n\n![[Gone]]\n' }, message: 'Missing include', file: 'index.md', line: 8 },
  { name: 'a link in an embedded note', files: { 'index.md': '# Index\n\n![[Part]]\n', 'Part.md': '# Part\n\nSee [[Gone]].\n' }, message: 'Missing wiki link', file: 'Part.md', line: 3, today: true },
  { name: 'a link in an embedded note, after its own embed', files: { 'index.md': '# Index\n\n![[Part]]\n', 'Part.md': '# Part\n\n![[Here]]\n\nSee [[Gone]].\n', ...HERE }, message: 'Missing wiki link', file: 'Part.md', line: 5 },
  { name: 'a headingless note with "Normalise headings" on (title injected)', files: { 'index.md': '# Index\n\n![[Part]]\n', 'Part.md': 'Intro.\n\n![[Here]]\n\nSee [[Gone]].\n', ...HERE }, normaliseHeadings: true, message: 'Missing wiki link', file: 'Part.md', line: 5 },
  { name: 'the same with "Normalise headings" off', files: { 'index.md': '# Index\n\n![[Part]]\n', 'Part.md': 'Intro.\n\n![[Here]]\n\nSee [[Gone]].\n', ...HERE }, normaliseHeadings: false, message: 'Missing wiki link', file: 'Part.md', line: 5 },
  { name: 'a link brought along by a section embed is reported in its own note', files: { 'index.md': '# Index\n\n![[Here#Here]]\n', 'Here.md': '# Here\n\nfrom here [[Gone]]\n' }, message: 'Missing wiki link', file: 'Here.md', line: 3 },
  { name: 'a link inside a heading reports the heading\'s line', files: { 'index.md': '# Index\n\n## See [[Gone]]\n\ntext\n' }, message: 'Missing wiki link', file: 'index.md', line: 3, today: true },
];

describe('US-8.4 AC-5: warnings name the line in the note as stored', () => {
  for (const c of CASES) {
    it(c.name, () => {
      const r = new InMemoryVaultCompiler(c.files, { enableTextMapper: true, assetFolder: 'assets', normaliseHeadings: c.normaliseHeadings ?? false })
        .compile('index.md');
      const found = r.warningDetails.filter(d => d.message === c.message);
      assert.equal(found.length, 1, JSON.stringify(r.warningDetails));
      assert.deepEqual({ file: found[0].file, line: found[0].line }, { file: c.file, line: c.line });
    });
  }
});

describe('US-8.4 AC-5: the location markers never change which section is found', () => {
  it('a section whose heading holds a link is embedded', () => {
    const r = new InMemoryVaultCompiler({
      'index.md': '# Index\n\n![x](Here.md#Notes on [[Other]])\n',
      'Here.md': '# Here\n\n## Notes on [[Other]]\n\nbody\n',
      'Other.md': '# Other\n',
    }, { enableTextMapper: true, assetFolder: 'assets' }).compile('index.md');
    assert.match(r.content, /\nbody\n/);
    assert.ok(!r.warningDetails.some(d => d.message.startsWith('Missing heading anchor')), JSON.stringify(r.warningDetails));
  });
});

describe('US-8.4 AC-5: the location markers never reach the output', () => {
  it('no marker text in the compiled document', () => {
    const r = new InMemoryVaultCompiler({
      'index.md': '# Index\n\n![[Here]]\n\nSee [[Here]] and [x](Here.md) and [[Gone]].\n\n## About [[Here]]\n',
      ...HERE,
    }, { enableTextMapper: true, assetFolder: 'assets' }).compile('index.md');
    assert.doesNotMatch(r.content, /__v[sel]__/);
  });
});
