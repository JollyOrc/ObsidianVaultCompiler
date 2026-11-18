/**
 * US-7.4 | AC-14 (added at T-7.4-E, 2026-11-18; SCAR-023): every literal of the
 * string table was changed in turn; these 47 were read by no other test.
 * Their wording is pinned here as it stands in `strings.ts` (moved verbatim from
 * 0.24.0, compared by script, or written as US-7.4 states it), so a change of
 * wording is a decision, not an accident.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const TABLE = readFileSync(new URL('../../plugin/src/strings.ts', import.meta.url), 'utf8');

/** The literals as written in `strings.ts`, quotes included. */
const PINNED: readonly string[] = [
  "'Compile vault'",
  "'Compile vault…'",
  "'Compile vault…'",
  "'Compile vault from this file'",
  "'Compile vault'",
  "'Starting file'",
  "'Output folder'",
  "'Output filename'",
  "'Choose folder…'",
  "'Choose output folder'",
  "'Compile'",
  "'More options'",
  "`Compilation not started: ${reason}`",
  "'Starting file not found.'",
  "'Debug info copied.'",
  "`Vault Compiler: map font \"${family}\" could not be embedded; maps use the next font in the list.`",
  "'Vault Compiler: the Text Mapper plugin is not installed or enabled, so maps are left as placeholders.'",
  "`Vault Compiler: a label in map \"${alt}\" has a word too wide for its hex.`",
  "`Vault Compiler: some maps were not tidied (${steps}): the Text Mapper plugin drew them differently than expected.`",
  "`Vault Compiler ${v}`",
  "'Copy debug info'",
  "'Reset this section to defaults'",
  "'Vault-relative path of the markdown file used as the compilation entry point.'",
  "`Vault-relative folder for the compiled master file, or an absolute folder outside the vault (desktop app only). Resolved output path: ${path}`",
  "'Filename of the compiled master file.'",
  "'Resolved output path'",
  "'Enable TextMapper rendering'",
  "'Render text-mapper code blocks to PNG path references when supported.'",
  "'Settings of the maps'",
  "'Map font'",
  "'Font for the text in compiled TextMapper maps, as a CSS font list (e.g. \"Georgia, serif\"). Leave empty to use the font Obsidian shows your notes in.'",
  "'Obsidian note font'",
  "'Tidy map labels'",
  "'In compiled maps, leave out the hex numbers, centre each label in its hex and break long labels into lines. Maps inside Obsidian are not changed.'",
  "'Normalise headings'",
  "'Automatically adjust heading levels when embedding files, so each file’s headings nest correctly within the document hierarchy. Files with a numeric prefix (e.g. \"1.3.2 \") are placed at the corresponding depth; unprefixed files inherit depth from their parent.'",
  "'Entry marker keys'",
  "'A note with one of these properties (comma-separated) keeps its properties as an entry block. Empty: off.'",
  "'Entry exclude keys'",
  "'Properties never written into an entry block (comma-separated).'",
  "'Entry image keys'",
  "'Entry properties that name an image to copy (comma-separated).'",
  "'Expect compiled folders'",
  "'Notes in these folders that are never compiled are listed in the warnings file (comma-separated). Empty: off.'",
  "'A note with one of these properties (comma-separated) gets a details block with only these properties, in this order. Empty: off.'",
  "`Unexpected new vault file created during compilation: ${path}`",
  "`Source vault file was modified during compilation: ${path}`",
];

describe('US-7.4 AC-14: texts that occur twice, or inside another, pinned by key', () => {
  it('the command names, the ribbon tooltip, the dialog title and its button', async () => {
    const { STRINGS } = await import('../../plugin/src/strings.ts');
    assert.deepEqual(
      [STRINGS.commands.compile, STRINGS.commands.compileDialog, STRINGS.commands.ribbon, STRINGS.dialog.title, STRINGS.dialog.compile],
      ['Compile vault', 'Compile vault…', 'Compile vault…', 'Compile vault', 'Compile'],
    );
  });
});

describe('US-7.4 AC-14: the texts no other test reads keep their wording', () => {
  for (const literal of PINNED) {
    it(literal.slice(0, 70), () => {
      assert.ok(TABLE.includes(literal), `strings.ts holds ${literal}`);
    });
  }
});
