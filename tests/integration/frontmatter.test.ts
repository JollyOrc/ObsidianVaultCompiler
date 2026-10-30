/**
 * Tests for frontmatter removal in the compiler (US-5.2).
 *
 * Every acceptance criterion is run with "Normalise headings" on and off
 * (SCAR-019, SCAR-023: the plugin always passes `true` or `false`). Inputs are
 * chosen so that keeping the frontmatter gives a different output from
 * removing it (SCAR-023): YAML lines that look like headings or ToC entries,
 * and wrappers that stop being pass-throughs when their frontmatter counts.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

/**
 * US-5.2 | General helper: compile `files` from `entry` with the heading
 * toggle set to `normalise`.
 */
function compile(files: Record<string, string>, entry: string, normalise: boolean) {
  return new InMemoryVaultCompiler(files, { normaliseHeadings: normalise }).compile(entry);
}

/** US-5.2 | General helper: the non-blank lines of `content`, trimmed. */
function lines(content: string): string[] {
  return content.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
}

const ICE = '---\ntags:\n  - SeasonalCharms\n  - Wizardry\n---\nSpell text.';

describe('US-5.2 AC-2: preamble note with frontmatter', () => {
  it('toggle on: title, then the text; no YAML', () => {
    const r = compile({ 'index.md': '![[Fog Lantern.md]]', 'Fog Lantern.md': ICE }, 'index.md', true);
    assert.deepEqual(lines(r.content), ['# Fog Lantern', 'Spell text.']);
  });

  it('toggle off: US-6.1 heading, then the text; no YAML', () => {
    const r = compile({ 'index.md': '![[Fog Lantern.md]]', 'Fog Lantern.md': ICE }, 'index.md', false);
    assert.deepEqual(lines(r.content), ['## Fog Lantern', 'Spell text.']);
  });

  for (const normalise of [true, false]) {
    it(`toggle ${normalise ? 'on' : 'off'}: no tags:, tag value or --- in the output`, () => {
      const r = compile({ 'index.md': '![[Fog Lantern.md]]', 'Fog Lantern.md': ICE }, 'index.md', normalise);
      assert.doesNotMatch(r.content, /tags:/);
      assert.doesNotMatch(r.content, /SeasonalCharms/);
      assert.doesNotMatch(r.content, /^---/m);
    });
  }
});

describe('US-5.2 AC-3: heading-first note after its frontmatter', () => {
  const files = {
    'index.md': '![[1.2 Combat.md]]',
    '1.2 Combat.md': '---\ntags: [rules]\n---\n# Fighting\n## Rounds',
  };

  it('toggle on: the first heading after the frontmatter is replaced (US-6.3 AC-6)', () => {
    assert.deepEqual(lines(compile(files, 'index.md', true).content), ['## Combat', '### Rounds']);
  });

  it('toggle off: the first heading after the frontmatter is replaced (US-6.1 AC-4)', () => {
    assert.deepEqual(lines(compile(files, 'index.md', false).content), ['## Combat', '## Rounds']);
  });
});

describe('US-5.2 AC-4: a YAML comment is not a heading', () => {
  const files = {
    'index.md': '![[X.md]]',
    'X.md': '---\n# reviewed 2026\ntags: [a]\n---\nText.',
  };

  it('toggle on: preamble file, comment not output', () => {
    assert.deepEqual(lines(compile(files, 'index.md', true).content), ['# X', 'Text.']);
  });

  it('toggle off: comment not output', () => {
    assert.deepEqual(lines(compile(files, 'index.md', false).content), ['## X', 'Text.']);
  });
});

describe('US-5.2 AC-5: pass-through wrapper with frontmatter (US-6.5)', () => {
  const files = {
    'index.md': '![[A.md]]',
    'A.md': '---\ntags: [wrapper]\n---\n![[B.md]]',
    'B.md': '---\ntags: [b]\n---\n# Real Heading\nContent',
  };

  it('toggle on: the wrapper is a pass-through; the target shows its title', () => {
    assert.deepEqual(lines(compile(files, 'index.md', true).content), ['# B', 'Content']);
  });

  it('toggle off: US-6.1 heading for both files', () => {
    assert.deepEqual(lines(compile(files, 'index.md', false).content), ['## A', '## B', 'Content']);
  });
});

describe('US-5.2 AC-6: section embed of a note with frontmatter (US-6.3 AC-7)', () => {
  const files = {
    'index.md': '![[M.md#Leaf Craft]]',
    'M.md': '---\ntags: [magic]\n---\n# Magic\n## Leaf Craft\n### Spells',
  };

  it('toggle on: the section moves to h1', () => {
    assert.deepEqual(lines(compile(files, 'index.md', true).content), ['# Leaf Craft', '## Spells']);
  });

  it('toggle off: the section as written', () => {
    assert.deepEqual(lines(compile(files, 'index.md', false).content), ['## Leaf Craft', '### Spells']);
  });
  for (const normalise of [true, false]) {
    it(`toggle ${normalise ? 'on' : 'off'}: a YAML comment with the anchor text is not the section`, () => {
      const r = compile({
        'index.md': '![[M.md#Leaf Craft]]',
        'M.md': '---\n# Leaf Craft\ntags: [magic]\n---\n# Magic\n## Leaf Craft\n### Spells',
      }, 'index.md', normalise);
      assert.deepEqual(lines(r.content), normalise ? ['# Leaf Craft', '## Spells'] : ['## Leaf Craft', '### Spells']);
      assert.doesNotMatch(r.content, /tags:/);
    });
  }
});

describe('US-5.2 AC-7: root file with frontmatter', () => {
  const files = {
    'index.md': '---\ntitle: Rulebook\n---\n# Rulebook\n![[1.3.2 Magic.md]]',
    '1.3.2 Magic.md': '# Magic',
  };

  for (const normalise of [true, false]) {
    it(`toggle ${normalise ? 'on' : 'off'}: output starts with the root heading`, () => {
      const r = compile(files, 'index.md', normalise);
      assert.deepEqual(lines(r.content), ['# Rulebook', '### Magic']);
      assert.match(r.content, /^\s*# Rulebook/);
    });
  }
});

describe('US-5.2 AC-8: nested notes with frontmatter', () => {
  const files = {
    'index.md': '![[1.2 Sec.md]]',
    '1.2 Sec.md': '---\ntags: [s]\n---\nIntro.\n![[Spell.md]]',
    'Spell.md': '---\ntags: [x]\n---\n# Spell heading\nText.',
  };

  it('toggle on', () => {
    assert.deepEqual(lines(compile(files, 'index.md', true).content), ['## Sec', 'Intro.', '### Spell', 'Text.']);
  });

  it('toggle off', () => {
    assert.deepEqual(lines(compile(files, 'index.md', false).content), ['## Sec', 'Intro.', '## Spell', 'Text.']);
  });
});

describe('US-5.2 AC-9: a list in the frontmatter is not a ToC (US-1.3)', () => {
  const files = {
    'index.md': '![[Y.md]]',
    'Y.md': '---\nup:\n  - [[Parent]]\n---\nBody.',
    'Parent.md': 'Parent text.',
  };

  for (const normalise of [true, false]) {
    it(`toggle ${normalise ? 'on' : 'off'}: Parent is not embedded`, () => {
      const r = compile(files, 'index.md', normalise);
      assert.ok(r.content.includes('Body.'));
      assert.ok(!r.content.includes('Parent text.'));
      assert.ok(!r.content.includes('[[Parent]]'));
    });
  }
});

describe('US-5.2 AC-10: horizontal rules that are not frontmatter stay', () => {
  for (const normalise of [true, false]) {
    const t = normalise ? 'on' : 'off';

    it(`toggle ${t}: a rule in the middle of a note`, () => {
      const r = compile({ 'index.md': '![[Notes.md]]', 'Notes.md': 'Intro.\n\n---\n\nMore.' }, 'index.md', normalise);
      assert.deepEqual(lines(r.content).slice(1), ['Intro.', '---', 'More.']);
    });

    it(`toggle ${t}: frontmatter removed, the later rule kept`, () => {
      const r = compile({
        'index.md': '![[Notes.md]]',
        'Notes.md': '---\ntags: [x]\n---\nIntro.\n\n---\n\nMore.',
      }, 'index.md', normalise);
      assert.deepEqual(lines(r.content).slice(1), ['Intro.', '---', 'More.']);
      assert.equal((r.content.match(/^---\s*$/gm) ?? []).length, 1);
    });

    it(`toggle ${t}: a first-line rule without a closing line is kept`, () => {
      const r = compile({ 'index.md': '![[Rule.md]]', 'Rule.md': '---\nText after a rule.' }, 'index.md', normalise);
      assert.deepEqual(lines(r.content).slice(1), ['---', 'Text after a rule.']);
    });

    it(`toggle ${t}: a block that does not start on the first line is kept`, () => {
      const r = compile({ 'index.md': '![[Late.md]]', 'Late.md': '\n---\ntags: x\n---\nText.' }, 'index.md', normalise);
      assert.deepEqual(lines(r.content).slice(1), ['---', 'tags: x', '---', 'Text.']);
    });
  }
});

describe('US-5.2 AC-11: CRLF frontmatter', () => {
  for (const normalise of [true, false]) {
    it(`toggle ${normalise ? 'on' : 'off'}`, () => {
      const r = compile({ 'index.md': '![[W.md]]', 'W.md': '---\r\ntags: a\r\n---\r\nText.' }, 'index.md', normalise);
      assert.deepEqual(lines(r.content).slice(1), ['Text.']);
      assert.doesNotMatch(r.content, /tags:/);
    });
  }
});

describe('US-5.2 AC-12: warning lines count the frontmatter', () => {
  for (const normalise of [true, false]) {
    it(`toggle ${normalise ? 'on' : 'off'}: missing include on source line 4`, () => {
      const r = compile({ 'index.md': '![[Z.md]]', 'Z.md': '---\ntags: [a]\n---\n![[Missing.md]]' }, 'index.md', normalise);
      const detail = r.warningDetails.find(d => d.message === 'Missing include');
      assert.ok(detail, 'a Missing include warning is recorded');
      assert.equal(detail.file, 'Z.md');
      assert.equal(detail.line, 4);
    });
  }
});

describe('US-5.2 AC-13: the in-memory source is not changed', () => {
  it('the file map passed in is equal before and after a compile', () => {
    const files = { 'index.md': '---\na: 1\n---\n![[Fog Lantern.md]]', 'Fog Lantern.md': ICE };
    const before = JSON.stringify(files);
    compile(files, 'index.md', true);
    compile(files, 'index.md', false);
    assert.equal(JSON.stringify(files), before);
  });
});

describe('US-5.2 AC-1: every note read goes through the frontmatter rule (SCAR-017)', () => {
  it('compiler.ts reads note text in exactly one place, and that place strips frontmatter', () => {
    const src = fs.readFileSync(new URL('../../plugin/src/compiler.ts', import.meta.url), 'utf8');
    const reads = src.match(/this\.files\.get\(/g) ?? [];
    assert.equal(reads.length, 1, 'only readNote may call this.files.get(');
    const readNote = src.match(/private readNote\([^)]*\)[^{]*\{([\s\S]*?)\n  \}/);
    assert.ok(readNote, 'readNote exists');
    assert.match(readNote[1], /splitFrontmatter\(this\.files\.get\(path\)!\)/);
  });
});
