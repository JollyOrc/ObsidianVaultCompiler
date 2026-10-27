/**
 * Syntax-parity tests: markdown embed syntax ![alt](file.md#Heading)
 *
 * US-1.2 (amended) and the global requirement "both embed syntaxes are treated
 * identically" mandate that every behaviour verified for ![[file.md#Heading]]
 * (wiki syntax) in heading-embed.test.ts is equally true for the standard
 * markdown syntax ![alt](file.md#Heading).
 *
 * These tests are a focused parity mirror, not an exhaustive duplicate. They
 * confirm that processMarkdownEmbeds applies the same section-extraction logic
 * as processWikiEmbeds. Wherever a heading-embed.test.ts describe block is
 * referenced, this file contains at least one representative test for that
 * block using markdown syntax.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

// ---------------------------------------------------------------------------
// Section extraction — content IS included
// ---------------------------------------------------------------------------

describe('syntax-parity: markdown embed ![](file#Heading) includes the named section', () => {
  it('includes the named heading line', () => {
    const files = {
      'index.md': '![](spells.md#Fireball)\n',
      'spells.md': '# Spells\n\n## Fireball\n\nDeals 8d6 fire damage.\n\n## Ice Storm\n\nDeals 4d8 cold damage.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /Fireball/);
    assert.match(result.content, /Deals 8d6 fire damage/);
  });

  it('includes subheadings beneath the target', () => {
    const files = {
      'index.md': '![](rules.md#Combat)\n',
      'rules.md': '## Combat\n\nBattle rules.\n\n### Initiative\n\nRoll 1d20.\n\n## Magic\n\nSpell rules.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /Battle rules/);
    assert.match(result.content, /Initiative/);
    assert.match(result.content, /Roll 1d20/);
  });

  it('embeds to end of file when the target is the last heading', () => {
    const files = {
      'index.md': '![](rules.md#Appendix)\n',
      'rules.md': '## Intro\n\nIntroduction.\n\n## Appendix\n\nThis is the appendix.\nIt continues to end of file.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /This is the appendix/);
    assert.match(result.content, /It continues to end of file/);
  });
});

// ---------------------------------------------------------------------------
// Section extraction — content is NOT included
// ---------------------------------------------------------------------------

describe('syntax-parity: markdown embed excludes content outside the section', () => {
  it('does not include content before the named heading', () => {
    const files = {
      'index.md': '![](spells.md#Fireball)\n',
      'spells.md': '# Spells\n\nThis intro is before Fireball.\n\n## Fireball\n\nDeals 8d6 fire damage.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.doesNotMatch(result.content, /This intro is before Fireball/);
  });

  it('stops at the next heading of equal level', () => {
    const files = {
      'index.md': '![](spells.md#Fireball)\n',
      'spells.md': '## Fireball\n\nDeals 8d6 fire damage.\n\n## Ice Storm\n\nDeals 4d8 cold damage.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.doesNotMatch(result.content, /Ice Storm/);
    assert.doesNotMatch(result.content, /Deals 4d8 cold damage/);
  });

  it('stops at the next heading of higher level', () => {
    const files = {
      'index.md': '![](doc.md#Sub Section)\n',
      'doc.md': '# Chapter One\n\n## Sub Section\n\nSub content here.\n\n# Chapter Two\n\nChapter two body.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.doesNotMatch(result.content, /Chapter Two/);
    assert.doesNotMatch(result.content, /Chapter two body/);
  });
});

// ---------------------------------------------------------------------------
// Heading matching
// ---------------------------------------------------------------------------

describe('syntax-parity: markdown embed heading matching is case-insensitive', () => {
  it('matches regardless of capitalisation', () => {
    const files = {
      'index.md': '![](about.md#links are first-class citizens)\n',
      'about.md': '## Links Are First-Class Citizens\n\nLinks matter in Obsidian.\n\n## Other\n\nOther content.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /Links matter in Obsidian/);
    assert.doesNotMatch(result.content, /Other content/);
  });
});

// ---------------------------------------------------------------------------
// Auto-heading suppression
// ---------------------------------------------------------------------------

describe('syntax-parity: markdown embed suppresses auto-heading when anchor is used', () => {
  it('does not prepend a filename-derived auto-heading', () => {
    const files = {
      'index.md': '![](2.1-intro.md#Overview)\n',
      '2.1-intro.md': '## Overview\n\nOverview text.\n\n## Details\n\nDetails text.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /Overview/);
    assert.doesNotMatch(result.content, /2\.1[ -]Intro/i);
    assert.doesNotMatch(result.content, /Details text/);
  });

  it('the section heading from the file itself is present', () => {
    const files = {
      'index.md': '![](equipment.md#Armour)\n',
      'equipment.md': '# Equipment\n\n## Weapons\n\nSword.\n\n## Armour\n\nChain mail.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /## Armour/);
    assert.match(result.content, /Chain mail/);
    assert.doesNotMatch(result.content, /# Equipment/);
  });

  it('plain ![alt](file.md) without anchor still gets an auto-heading (regression)', () => {
    const files = {
      'index.md': '![](2.1-intro.md)\n',
      '2.1-intro.md': '## Old Heading\n\nBody text.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /2\.1/);
    assert.doesNotMatch(result.content, /Old Heading/);
  });
});

// ---------------------------------------------------------------------------
// Missing heading anchor
// ---------------------------------------------------------------------------

describe('syntax-parity: markdown embed emits warning for missing heading', () => {
  it('emits a warning comment for a non-existent heading', () => {
    const files = {
      'index.md': '![](rules.md#NonExistentSection)\n',
      'rules.md': '## Existing Section\n\nContent here.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(
      result.content,
      /<!-- Warning: Missing heading anchor: rules\.md#NonExistentSection -->/,
    );
  });

  it('does not include any content from the file when heading is missing', () => {
    const files = {
      'index.md': '![](rules.md#GhostSection)\n',
      'rules.md': '## Real Section\n\nReal content should not appear.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.doesNotMatch(result.content, /Real content should not appear/);
  });

  it('records a WarningDetail attributed to the source file', () => {
    const files = {
      'index.md': '![](spells.md#Nonexistent)\n',
      'spells.md': '## Real\n\nContent.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    const detail = result.warningDetails.find(d => d.link.includes('Nonexistent'));
    assert.ok(detail, 'expected a WarningDetail for the missing anchor');
    assert.equal(detail!.file, 'index.md');
    assert.notEqual(detail!.file, 'compiled-output');
    assert.ok(typeof detail!.line === 'number');
  });

  it('still embeds the whole file when no anchor is given (regression)', () => {
    const files = {
      'index.md': '![](rules.md)\n',
      'rules.md': '## Section A\n\nA content.\n\n## Section B\n\nB content.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /A content/);
    assert.match(result.content, /B content/);
  });
});

// ---------------------------------------------------------------------------
// Integration: mixed wiki + markdown syntax in same document
// ---------------------------------------------------------------------------

describe('syntax-parity: wiki and markdown anchor syntax coexist in one document', () => {
  it('wiki ![[file#A]] and markdown ![](file#B) can both extract from the same file', () => {
    const files = {
      'index.md': '![[rules.md#Weapons]]\n\n![](rules.md#Armour)\n',
      'rules.md': '## Weapons\n\nSword and axe.\n\n## Armour\n\nChain mail.\n\n## Magic\n\nSpells.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /Sword and axe/);
    assert.match(result.content, /Chain mail/);
    assert.doesNotMatch(result.content, /Spells\./);
  });

  it('wiki ![[file]] and markdown ![](file#Section) can appear together', () => {
    const files = {
      'index.md': '![[doc.md]]\n\n![](doc.md#Section B)\n',
      'doc.md': '## Section A\n\nA content.\n\n## Section B\n\nB content.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    // Full wiki embed: both sections
    assert.match(result.content, /A content/);
    // Markdown anchor embed: just B
    assert.match(result.content, /B content/);
  });

  it('markdown anchor embed warning does not suppress other embeddings', () => {
    const files = {
      'index.md': '![](good.md#Section)\n![](missing.md)\n',
      'good.md': '## Section\n\nGood content.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /Good content/);
    const missingWarn = result.warningDetails.find(d => d.link.includes('missing.md'));
    assert.ok(missingWarn, 'missing-file warning should still appear');
  });
});
