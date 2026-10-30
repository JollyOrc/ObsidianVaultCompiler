/**
 * Tests for heading-anchored embeds: ![[file.md#Heading]]
 *
 * Covers US-1.2 (amended) and US-3.1 (amended):
 *   - Only the named section is embedded (not the whole file)
 *   - Section boundary is the next heading of equal or higher level
 *   - Subheadings beneath the target are included
 *   - Last section (no following heading) embeds to EOF
 *   - Heading match is case-insensitive
 *   - Auto-heading injection (US-6.1) is suppressed for anchored embeds
 *   - Missing heading anchor → warning comment + WarningDetail
 *   - Plain ![[file.md]] still embeds the whole file (regression guard)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

// ---------------------------------------------------------------------------
// Section extraction — what IS included
// ---------------------------------------------------------------------------

describe('heading-anchored embed: section content is included', () => {
  it('embeds the named heading line itself', () => {
    const files = {
      'index.md': '![[spells.md#Fireball]]\n',
      'spells.md': '# Spells\n\n## Fireball\n\nDeals 8d6 fire damage.\n\n## Ice Storm\n\nDeals 4d8 cold damage.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /Fireball/);
  });

  it('embeds content directly below the named heading', () => {
    const files = {
      'index.md': '![[spells.md#Fireball]]\n',
      'spells.md': '# Spells\n\n## Fireball\n\nDeals 8d6 fire damage.\n\n## Ice Storm\n\nDeals 4d8 cold damage.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /Deals 8d6 fire damage/);
  });

  it('embeds subheadings beneath the target section', () => {
    const files = {
      'index.md': '![[rules.md#Combat]]\n',
      'rules.md': '# Rules\n\n## Combat\n\nBattle rules.\n\n### Initiative\n\nRoll 1d20.\n\n### Attacks\n\nMake an attack roll.\n\n## Magic\n\nSpell rules.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /Battle rules/);
    assert.match(result.content, /Initiative/);
    assert.match(result.content, /Roll 1d20/);
    assert.match(result.content, /Make an attack roll/);
  });

  it('embeds to end of file when the target is the last heading', () => {
    const files = {
      'index.md': '![[rules.md#Appendix]]\n',
      'rules.md': '## Intro\n\nIntroduction.\n\n## Appendix\n\nThis is the appendix.\nIt continues to end of file.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /This is the appendix/);
    assert.match(result.content, /It continues to end of file/);
  });

  it('wiki embed syntax ![[file.md#Heading]] works', () => {
    const files = {
      'index.md': '![[chapter.md#Overview]]\n',
      'chapter.md': '# Chapter\n\n## Overview\n\nOverview content here.\n\n## Details\n\nDetail content.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /Overview content here/);
  });
});

// ---------------------------------------------------------------------------
// Section extraction — what is NOT included
// ---------------------------------------------------------------------------

describe('heading-anchored embed: content outside the section is excluded', () => {
  it('does not include content from before the named heading', () => {
    const files = {
      'index.md': '![[spells.md#Fireball]]\n',
      'spells.md': '# Spells\n\nThis intro text is before Fireball.\n\n## Fireball\n\nDeals 8d6 fire damage.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.doesNotMatch(result.content, /This intro text is before Fireball/);
  });

  it('stops at the next heading of equal level', () => {
    const files = {
      'index.md': '![[spells.md#Fireball]]\n',
      'spells.md': '## Fireball\n\nDeals 8d6 fire damage.\n\n## Ice Storm\n\nDeals 4d8 cold damage.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.doesNotMatch(result.content, /Deals 4d8 cold damage/);
    assert.doesNotMatch(result.content, /Ice Storm/);
  });

  it('stops at the next heading of higher level (lower heading number)', () => {
    const files = {
      'index.md': '![[doc.md#Sub Section]]\n',
      'doc.md': '# Chapter One\n\n## Sub Section\n\nSub content here.\n\n# Chapter Two\n\nChapter two body.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.doesNotMatch(result.content, /Chapter two body/);
    assert.doesNotMatch(result.content, /Chapter Two/);
  });

  it('does not include a same-level sibling heading', () => {
    const files = {
      'index.md': '![[doc.md#Alpha]]\n',
      'doc.md': '## Alpha\n\nAlpha body.\n\n## Beta\n\nBeta body.\n\n## Gamma\n\nGamma body.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.doesNotMatch(result.content, /Beta body/);
    assert.doesNotMatch(result.content, /Gamma body/);
  });
});

// ---------------------------------------------------------------------------
// Heading matching rules
// ---------------------------------------------------------------------------

describe('heading-anchored embed: heading matching', () => {
  it('matches the heading case-insensitively', () => {
    const files = {
      'index.md': '![[about.md#links are first-class citizens]]\n',
      'about.md': '# About\n\n## Links Are First-Class Citizens\n\nLinks matter in Obsidian.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /Links matter in Obsidian/);
  });

  it('matches when anchor uses different capitalisation than the heading', () => {
    const files = {
      'index.md': '![[rules.md#COMBAT RULES]]\n',
      'rules.md': '## Combat Rules\n\nFight content.\n\n## Magic Rules\n\nSpell content.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /Fight content/);
    assert.doesNotMatch(result.content, /Spell content/);
  });

  it('matches the first heading when multiple headings normalise to the same text', () => {
    // Both "Magic" headings normalise identically — first occurrence wins
    const files = {
      'index.md': '![[doc.md#Magic]]\n',
      'doc.md': '## Magic\n\nFirst magic section.\n\n## Other\n\nOther.\n\n## Magic\n\nSecond magic section.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /First magic section/);
    assert.doesNotMatch(result.content, /Second magic section/);
  });
});

// ---------------------------------------------------------------------------
// Auto-heading suppression (US-6.1)
// ---------------------------------------------------------------------------

describe('heading-anchored embed: auto-heading suppression', () => {
  it('does not prepend a filename-derived auto-heading when an anchor is used', () => {
    // Without anchor: ![[2.1-intro.md]] would add "## 2.1 Intro"
    // With anchor:    ![[2.1-intro.md#Overview]] should NOT add "## 2.1 Intro"
    const files = {
      'index.md': '![[2.1-intro.md#Overview]]\n',
      '2.1-intro.md': '## Overview\n\nOverview text.\n\n## Details\n\nDetails text.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    // The section heading itself should appear...
    assert.match(result.content, /Overview/);
    // ...but the auto-generated filename heading must NOT appear
    assert.doesNotMatch(result.content, /2\.1[ -]Intro/i);
    assert.doesNotMatch(result.content, /2\.1[ -]intro/i);
  });

  it('the section heading from the file itself is present in the output', () => {
    const files = {
      'index.md': '![[equipment.md#Armour]]\n',
      'equipment.md': '# Equipment\n\n## Weapons\n\nSword, axe.\n\n## Armour\n\nChain mail, plate.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /## Armour/);
    assert.match(result.content, /Chain mail, plate/);
    // No auto-heading for "Equipment" filename; its # heading is before the target anchor
    assert.doesNotMatch(result.content, /# Equipment/);
  });

  it('plain ![[file.md]] without anchor still gets an auto-heading (regression)', () => {
    const files = {
      'index.md': '![[2.1-intro.md]]\n',
      '2.1-intro.md': '## Old Heading\n\nBody text.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    // Auto-heading from filename should appear; old heading replaced
    assert.match(result.content, /2\.1/);
    assert.doesNotMatch(result.content, /Old Heading/);
  });
});

// ---------------------------------------------------------------------------
// Missing heading anchor
// ---------------------------------------------------------------------------

describe('heading-anchored embed: missing heading produces a warning', () => {
  it('emits a warning comment when the heading does not exist in the file', () => {
    const files = {
      'index.md': '![[rules.md#NonExistentSection]]\n',
      'rules.md': '## Existing Section\n\nContent here.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(
      result.content,
      /<!-- Warning: Missing heading anchor: rules\.md#NonExistentSection -->/,
    );
  });

  it('does not include any content from the target file when the heading is missing', () => {
    const files = {
      'index.md': '![[rules.md#GhostSection]]\n',
      'rules.md': '## Real Section\n\nReal content should not appear.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.doesNotMatch(result.content, /Real content should not appear/);
  });

  it('records a WarningDetail with the source file and link', () => {
    const files = {
      'index.md': '![[spells.md#Nonexistent]]\n',
      'spells.md': '## Real\n\nContent.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    const detail = result.warningDetails.find(d => d.link.includes('Nonexistent'));
    assert.ok(detail, 'expected a WarningDetail for the missing anchor');
    assert.equal(detail!.file, 'index.md');
    assert.ok(typeof detail!.line === 'number');
  });

  it('records a WarningDetail whose file is the vault source, not "compiled-output"', () => {
    const files = {
      'index.md': '![[chapter.md#MissingHeading]]\n',
      'chapter.md': '## Present\n\nContent.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    const detail = result.warningDetails.find(d => d.link.includes('MissingHeading'));
    assert.ok(detail, 'expected a WarningDetail');
    assert.notEqual(detail!.file, 'compiled-output');
  });

  it('still embeds the whole file when no anchor is given (regression)', () => {
    const files = {
      'index.md': '![[rules.md]]\n',
      'rules.md': '## Section A\n\nA content.\n\n## Section B\n\nB content.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /A content/);
    assert.match(result.content, /B content/);
  });
});

// ---------------------------------------------------------------------------
// Integration: heading embed within a larger document
// ---------------------------------------------------------------------------

describe('heading-anchored embed: integration with surrounding content', () => {
  it('can embed two different sections from the same file separately', () => {
    const files = {
      'index.md': '# Index\n\n![[rules.md#Weapons]]\n\n---\n\n![[rules.md#Armour]]\n',
      'rules.md': '## Weapons\n\nSword and axe.\n\n## Armour\n\nChain mail.\n\n## Magic\n\nSpells.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /Sword and axe/);
    assert.match(result.content, /Chain mail/);
    assert.doesNotMatch(result.content, /Spells\./);
  });

  it('heading embed does not prevent later plain embeds of the same file', () => {
    const files = {
      'index.md': '![[doc.md#Section A]]\n\n![[doc.md]]\n',
      'doc.md': '## Section A\n\nA content.\n\n## Section B\n\nB content.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    // Section A partial embed
    assert.match(result.content, /A content/);
    // Full file embed — both sections visible
    assert.match(result.content, /B content/);
  });

  it('warnings from surrounding plain embeds are unaffected', () => {
    const files = {
      'index.md': '![[good.md#Section]]\n![[missing.md]]\n',
      'good.md': '## Section\n\nGood content.\n',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.match(result.content, /Good content/);
    const missingWarn = result.warningDetails.find(d => d.link.includes('missing.md'));
    assert.ok(missingWarn, 'plain missing-embed warning should still appear');
  });
});

describe('URL-encoded heading anchors', () => {
  it('wiki embed with %20-encoded anchor resolves to correct section', () => {
    const files = {
      'notes.md': '# Main\n\n## Leaf Craft\n\nSpell content here.\n\n## Other\n\nOther content.',
      'index.md': '![[notes.md#Leaf%20Craft]]',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.ok(result.content.includes('Leaf Craft'), 'heading preserved');
    assert.ok(result.content.includes('Spell content here'), 'section body included');
    assert.ok(!result.content.includes('Other content'), 'other section excluded');
    assert.strictEqual(result.warnings.length, 0, 'no warnings');
  });

  it('wiki embed with %20-encoded anchor does not produce missing-anchor warning', () => {
    const files = {
      'notes.md': '# Main\n\n## Leaf Craft\n\nContent.',
      'index.md': '![[notes.md#Leaf%20Craft]]',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.strictEqual(result.warnings.length, 0);
  });

  it('markdown embed with %20-encoded anchor resolves to correct section', () => {
    const files = {
      'notes.md': '# Main\n\n## Leaf Craft\n\nSpell content here.\n\n## Other\n\nOther content.',
      'index.md': '![](notes.md#Leaf%20Craft)',
    };
    const result = new InMemoryVaultCompiler(files).compile('index.md');
    assert.ok(result.content.includes('Leaf Craft'), 'heading preserved');
    assert.ok(result.content.includes('Spell content here'), 'section body included');
    assert.ok(!result.content.includes('Other content'), 'other section excluded');
    assert.strictEqual(result.warnings.length, 0, 'no warnings');
  });
});
