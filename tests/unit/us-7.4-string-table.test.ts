/**
 * US-7.4 | AC-14 (G2, 2026-11-18): one string table. No file of `plugin/src`
 * but `strings.ts` holds a text a screen, a menu or a notice shows: every
 * string literal that reads like a text (two words, or a capitalised word) is
 * either in `strings.ts` or named below with why it is not such a text.
 * Literals are read with the TypeScript parser (the sources hold regular
 * expressions with backticks, which a text search misreads). Port of
 * Obsidian2Typst's check (US-042 AC-14), the owner's VC-7.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../plugin/package.json', import.meta.url));
const ts = require('typescript') as typeof import('typescript');
const SRC = new URL('../../plugin/src/', import.meta.url);

/** A literal that reads like a text: two words, or a capitalised word. */
const SENTENCE = /[A-Za-z]{2,} [A-Za-z(]|^[A-Z][a-z]/;

/** The texts of the string and template literals of `source` (a template as `a${}b`); imports and CSS classes left out. */
export function literals(source: string): string[] {
  const file = ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true);
  const out: string[] = [];
  const visit = (node: import('typescript').Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isPropertyAssignment(node) && node.name.getText() === 'cls') return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) out.push(node.text);
    else if (ts.isTemplateExpression(node)) {
      out.push(node.head.text + node.templateSpans.map((s) => '${}' + s.literal.text).join(''));
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

/** Files that hold no screen or notice text by their nature, and why. */
const FILES: Record<string, string> = {
  'strings.ts': 'the table itself',
  'compiler.ts': 'the compiled output and the warnings file (owner, VC-7: warning texts stay in the compiler)',
};

/** `file: text` left outside the table, and why. */
const NOT_SCREEN_TEXT: Record<string, string> = {
  'compile-dialog-rules.ts: Escape': 'a key name',
  'prompt-keys.ts: Enter': 'a key name',
  'debug-info.ts: Vault Compiler ${}': "the debug info's own format (AC-13)",
  'debug-info.ts: Obsidian ${}': "the debug info's own format (AC-13)",
  'debug-info.ts: Enabled plugins:': "the debug info's own format (AC-13)",
  'debug-info.ts: Settings file:': "the debug info's own format (AC-13)",
  'debug-info.ts: (no settings file)': "the debug info's own format (AC-13)",
  'entries.ts: Frontmatter is not valid YAML': 'a warning of the warnings file',
  'entries.ts: Entry keys differ only in case: ${} / ${}': 'a warning of the warnings file',
  'entries.ts: Detail keys differ only in case: ${} / ${}': 'a warning of the warnings file',
  'entries.ts: Detail value is not text: ${}': 'a warning of the warnings file',
  'entries.ts: Duplicate entry omitted': 'a warning of the warnings file (also the key the completion notice counts)',
  'entries.ts: Not compiled': 'a warning of the warnings file (also the key the completion notice counts)',
  'output-writer.ts: Refused to write "${}": not part of the output location.': 'a guard against a programming fault (US-8.1)',
  'output-writer.ts: Writing outside the vault needs the desktop app.': 'a guard: the location is refused before (US-0.3 AC-OL-2)',
  'textmapper.ts: TextMapper rendering not available': 'a comment in the compiled output (placeholder)',
  'textmapper.ts: TextMapper plugin is not installed or enabled': 'a comment in the compiled output (placeholder)',
  'textmapper.ts: TextMapper could not draw this map': 'a comment in the compiled output (placeholder)',
  'textmapper.ts: <svg style="font-family: ${}"': 'SVG markup of a map',
  'textmapper.ts: <tspan x="${}" y="${}">${}</tspan>': 'SVG markup of a map',
  'textmapper.ts: Canvas context unavailable': 'a render failure, written as a comment in the compiled output',
  'textmapper.ts: PNG conversion failed': 'a render failure, written as a comment in the compiled output',
  'textmapper.ts: SVG load failed': 'a render failure, written as a comment in the compiled output',
};

function found(): string[] {
  return readdirSync(SRC)
    .filter((name) => name.endsWith('.ts') && !(name in FILES))
    .flatMap((name) =>
      literals(readFileSync(new URL(name, SRC), 'utf8'))
        .filter((text) => SENTENCE.test(text))
        .map((text) => `${name}: ${text}`),
    );
}

describe('US-7.4 AC-14: one string table', () => {
  it('the table exists', () => {
    assert.ok(readdirSync(SRC).includes('strings.ts'));
  });

  it('every text left in plugin/src is a named exemption', () => {
    assert.deepEqual(found().filter((entry) => !(entry in NOT_SCREEN_TEXT) && !isOutputText(entry)), []);
  });

  it('every exemption is still in the source (no stale entry)', () => {
    const all = found();
    assert.deepEqual(Object.keys(NOT_SCREEN_TEXT).filter((entry) => !all.includes(entry)), []);
  });

  // The check checks itself (SCAR-023, SCAR-028).
  const cases: Array<[string, string[]]> = [
    ["new Notice('Starting file not found.');", ['Starting file not found.']],
    ['const t = `Output folder "${f}" does not exist.`;', ['Output folder "${}" does not exist.']],
    ["const re = /```text-mapper\\n/g; const s = 'Compile vault';", ['Compile vault']],
    ["import { x } from './a b.ts'; el.createDiv({cls: 'vc dialog info'});", []],
    ['const k = `a${`Inner text`}b`;', ['a${}b', 'Inner text']],
  ];
  for (const [code, expected] of cases) {
    it(`reads ${JSON.stringify(code)}`, () => {
      assert.deepEqual(literals(code), expected);
    });
  }
});

/** Texts of the compiled output and the warnings file written outside `compiler.ts`, named by their start. */
const OUTPUT_PREFIXES: Record<string, string> = {
  'main.ts: <!-- TextMapper Render Failure': 'a comment in the compiled output',
  'main.ts: # Compilation warnings': 'the warnings file',
  'main.ts: | warning | original link': 'the warnings file',
  'main.ts: source block not found': 'a comment in the compiled output',
  'textmapper.ts: \n<!-- Warning: TextMapper placeholder': 'a comment in the compiled output',
};
function isOutputText(entry: string): boolean {
  return Object.keys(OUTPUT_PREFIXES).some((prefix) => entry.startsWith(prefix));
}
