/**
 * Epic 9 (#108): entry data from note properties. The `o2t-entry` block's
 * format is owned by its reader, Obsidian2Typst
 * (`docs/technical/entry-block.md`, SCAR-040); this module writes it.
 * Pure functions: no Obsidian API, so the tests run them directly.
 */

import { LineCounter, parseDocument, stringify, isMap, isScalar } from 'yaml';
import type { CompileResult } from './compiler.ts';

/**
 * Epic 9 | Settings: a comma-separated setting as a list. Items are trimmed
 * and empty items dropped; key lists (`lowerCase`) are compared without case,
 * folder lists keep their case. `' Might , attacks,,'` → `might`, `attacks`.
 */
export function parseListSetting(text: string, options: { lowerCase: boolean }): string[] {
  return text
    .split(',')
    .map(item => item.trim())
    .filter(item => item !== '')
    .map(item => (options.lowerCase ? item.toLowerCase() : item));
}

/** US-9.1: the entry settings of one compile, lists already parsed. */
export interface EntryOptions {
  markerKeys: readonly string[];
  excludeKeys: readonly string[];
  /** US-9.1 | AC-8: keys whose value is an image (US-9.2); they are not flattened. */
  assetKeys?: readonly string[];
  /**
   * US-9.2: turns the value of an image key into what the block holds, or
   * `undefined` to leave the key out; `line` is the key's line in the note.
   * Absent → the value is written as it is.
   */
  asset?: (value: unknown, line: number) => unknown;
}

/** US-9.2 | AC-2: an alias part that Obsidian reads as a size: `300`, `300x200`. */
const SIZE = /^\d+(?:x\d+)?$/;

/**
 * US-9.2 | AC-1, AC-2: the parts of an image value — its path as written
 * (without brackets) and its credit (alias or link text without size parts;
 * empty when there is none).
 * `[[hare.png|A. Nobody|300]]` → `hare.png`, `A. Nobody`;
 * `![300](images/hare.png)` → `images/hare.png`, ``; `images/hare.png` →
 * itself, ``. `destination` reads a Markdown link's target as the embed
 * steps do (`parseEmbedDestination`).
 */
export function imageLink(value: string, destination: (raw: string) => string): { path: string; credit: string } {
  const text = value.trim();
  const credit = (alias: string | undefined) =>
    (alias ?? '').split('|').map(part => part.trim()).filter(part => part !== '' && !SIZE.test(part)).join('|');
  const wiki = text.match(/^!?\[\[([^\]|]*)(?:\|([^\]]*))?\]\]$/);
  if (wiki) return { path: wiki[1].trim(), credit: credit(wiki[2]) };
  const markdown = text.match(/^!?\[([^\]]*)\]\((.*)\)$/);
  if (markdown) return { path: destination(markdown[2]), credit: credit(markdown[1]) };
  return { path: text, credit: '' };
}

/**
 * US-9.1 | AC-8: the link forms of US-2.3 (wikilinks, Markdown links, one
 * level of brackets in a target), plus their embed twins.
 */
const WIKILINK = /!?\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g;
const IMAGE = /!\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)/g;
const MD_LINK = /\[([^\]]*)\]\((?:[^()]|\([^()]*\))+\)/g;

/**
 * US-9.1 | AC-8 (G0-A7): link markup in `text` becomes its display text by
 * the rule of the block's reader (Obsidian2Typst `flattenLinks`): a wikilink
 * or embed its alias, else its target as written — `File > Heading` with a
 * heading anchor, `Heading` for `[[#Heading]]`; an image its alt text; a
 * Markdown link its text. Bold and italic stay.
 * `**Bite** [[Teeth]]: 1d6` → `**Bite** Teeth: 1d6`.
 */
export function flattenLinks(text: string): string {
  return text
    .replace(WIKILINK, (_m, target: string, alias: string | undefined) => {
      if (alias !== undefined) return alias;
      const hash = target.indexOf('#');
      if (hash === -1) return target;
      const file = target.slice(0, hash);
      const anchor = target.slice(hash + 1);
      return file === '' ? anchor : `${file} > ${anchor}`;
    })
    .replace(IMAGE, (_m, alt: string) => alt)
    .replace(MD_LINK, (_m, label: string) => label);
}

/** US-9.1 | AC-8: `flattenLinks` on every string of a value, lists and maps included. */
function flattenValue(value: unknown): unknown {
  if (typeof value === 'string') return flattenLinks(value);
  if (Array.isArray(value)) return value.map(flattenValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, flattenValue(item)]));
  }
  return value;
}

/** US-9.1 | AC-12: a warning about a note's properties, with its line in the note. */
export interface EntryWarning {
  message: string;
  link: string;
  line: number;
}

/** US-9.1: what a note's frontmatter gives — the block, or none — and its warnings. */
export interface EntryResult {
  block: string | null;
  warnings: EntryWarning[];
}

/**
 * US-9.1 | AC-2 to AC-9: the `o2t-entry` block of a note whose frontmatter
 * is `yaml` (the text between the `---` lines; it starts on line 2 of the
 * note), or `block: null`.
 *
 * - AC-9: YAML that does not parse gives no block and one warning
 *   `Frontmatter is not valid YAML` with the line `yaml` reports.
 * - AC-2: a block only when a **top-level** key is in `markerKeys`
 *   (compared without case); comments, nested keys and text in strings
 *   never trigger.
 * - AC-4: every top-level property except `excludeKeys`, `tags` included,
 *   in the note's order, keys in lower case.
 * - AC-5: of two keys that differ only in case the first is written; the
 *   second gives `Entry keys differ only in case: <first> / <second>`.
 * - AC-6: the text is `stringify(value, {nullStr: ''})` of `yaml` 2.9.1, the
 *   form Obsidian's Properties panel writes; a map value is written as it is.
 * - AC-7: the fence is backticks, one more than the longest run in the
 *   text, at least three.
 */
export function entryBlock(yaml: string, options: EntryOptions): EntryResult {
  if (options.markerKeys.length === 0) return { block: null, warnings: [] };
  const lineCounter = new LineCounter();
  const doc = parseDocument(yaml, { lineCounter, version: '1.2' });
  const lineOf = (offset: number) => 1 + lineCounter.linePos(offset).line;

  if (doc.errors.length > 0) {
    const error = doc.errors[0];
    return {
      block: null,
      warnings: [{ message: 'Frontmatter is not valid YAML', link: '', line: lineOf(error.pos[0]) }],
    };
  }
  if (!isMap(doc.contents)) return { block: null, warnings: [] };

  const pairs = doc.contents.items.map(pair => {
    const key = isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
    const offset = isScalar(pair.key) && pair.key.range ? pair.key.range[0] : 0;
    return { key, lower: key.toLowerCase(), offset, value: pair.value };
  });
  const markers = new Set(options.markerKeys);
  if (!pairs.some(pair => markers.has(pair.lower))) return { block: null, warnings: [] };

  const excluded = new Set(options.excludeKeys);
  const assetKeys = new Set(options.assetKeys ?? []);
  const firstOf = new Map<string, string>();
  const data: Record<string, unknown> = {};
  const warnings: EntryWarning[] = [];
  for (const pair of pairs) {
    const first = firstOf.get(pair.lower);
    if (first !== undefined) {
      warnings.push({
        message: `Entry keys differ only in case: ${first} / ${pair.key}`,
        link: pair.key,
        line: lineOf(pair.offset),
      });
      continue;
    }
    firstOf.set(pair.lower, pair.key);
    if (excluded.has(pair.lower)) continue;
    const value = pair.value === null || pair.value === undefined
      ? null
      : (pair.value as { toJSON: () => unknown }).toJSON();
    if (assetKeys.has(pair.lower)) {
      // US-9.2: an image key is resolved and copied by the caller.
      const written = options.asset ? options.asset(value, lineOf(pair.offset)) : value;
      if (written !== undefined) data[pair.lower] = written;
      continue;
    }
    data[pair.lower] = flattenValue(value);
  }

  const text = stringify(data, { nullStr: '' });
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map(run => run[0].length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return { block: `${fence}o2t-entry\n${text}${fence}`, warnings };
}

/**
 * US-9.4 | AC-5 (G0-B6): the completion Notice — the counts of the compile,
 * then, when there are any, the omitted repeats (US-9.3) and the notes not
 * compiled (US-9.4), with the warnings file that lists them. A count of
 * zero is not shown.
 * `… 0 deduplicated. 1 duplicate entry omitted, 2 notes not compiled: see warnings_….md.`
 */
export function completionNotice(result: CompileResult, warningsFile: string | null): string {
  const { filesProcessed, assetsCopied, assetsDeduplicated } = result.stats;
  const base = `Compilation complete: ${filesProcessed} files, ${assetsCopied} assets, ${assetsDeduplicated} deduplicated.`;
  const messages = result.warningDetails.map(detail => detail.message);
  const repeats = messages.filter(message => message === 'Duplicate entry omitted').length;
  const missing = messages.filter(message => message.startsWith('Not compiled')).length;
  const parts: string[] = [];
  if (repeats > 0) parts.push(`${repeats} duplicate ${repeats === 1 ? 'entry' : 'entries'} omitted`);
  if (missing > 0) parts.push(`${missing} ${missing === 1 ? 'note' : 'notes'} not compiled`);
  if (parts.length === 0) return base;
  return `${base} ${parts.join(', ')}${warningsFile === null ? '.' : `: see ${warningsFile}.`}`;
}
