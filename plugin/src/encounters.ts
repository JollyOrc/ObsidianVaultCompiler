/**
 * US-9.6: encounter lists. An `[!encounter]` callout (the type is the
 * setting `encounterCalloutType`) becomes an `o2t-encounter` block whose
 * format is owned by its reader, Obsidian2Typst
 * (`docs/technical/encounter-block.md`, SCAR-040). Pure functions: no
 * Obsidian API and no lookups; the compiler resolves targets and reports.
 */

import { Document, Scalar } from 'yaml';
import { fencedBlock, flattenLinks } from './entries.ts';
import { splitQuote } from './utils.ts';

/** US-9.6 | AC-1: one encounter callout of a note, by line index (0-based). */
export interface EncounterCallout {
  /** The header line `> [!encounter] Title`. */
  start: number;
  /** One past the last line of the callout. */
  end: number;
  /** The title as written after the type, trimmed; '' when none. */
  title: string;
}

/** US-9.6 | AC-3: how a row names its creature. */
export type EncounterTarget =
  | { kind: 'wiki'; link: string }
  | { kind: 'markdown'; destination: string }
  | { kind: 'plain'; text: string };

/** US-9.6 | AC-3: one row line of a callout, as written. */
export interface EncounterLine {
  count: string;
  target: EncounterTarget;
  /** The text after ` — `, links flattened; '' when none. */
  note: string;
}

/** US-9.6 | AC-6: one row of the block. */
export interface EncounterRow {
  name: string;
  count: string;
  note: string;
  data: Record<string, unknown> | null;
}

/**
 * US-9.6 | AC-1: the callout type of the setting, trimmed and lowercased;
 * '' (off) when absent or blank.
 */
export function encounterType(setting: string | undefined): string {
  return (setting ?? '').trim().toLowerCase();
}

/** The body of a callout header after its one quote marker (read by `splitQuote`, SCAR-041). */
const HEADER = /^\[!([^\]\s]+)\]([+-]?)(?:[ \t]+(.*))?$/;

/**
 * US-9.6 | AC-1: the callouts of `type` in `lines` at quote depth 1 (one
 * quote marker as US-1.5 reads it, `splitQuote`; no list marker, no second
 * marker), its type compared without case, a folded `-` / `+` allowed. A
 * header on a line of block code (`code[i]`) is no callout. The callout runs
 * over every following line with at least one quote marker.
 */
export function findEncounterCallouts(lines: readonly string[], type: string, code: readonly boolean[]): EncounterCallout[] {
  if (type === '') return [];
  const found: EncounterCallout[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (code[i]) continue;
    const quote = splitQuote(lines[i], 1);
    // A second marker (`> > [!encounter]`) leaves `> [!…` as the body, which HEADER never matches.
    if (quote.depth !== 1) continue;
    const m = quote.body.match(HEADER);
    if (!m || m[1].toLowerCase() !== type) continue;
    let end = i + 1;
    while (end < lines.length && splitQuote(lines[end], 1).depth === 1) end++;
    found.push({ start: i, end, title: (m[3] ?? '').trim() });
    i = end - 1;
  }
  return found;
}

/** The text of a callout line after its one `>` and one optional space. */
function unquote(line: string): string {
  return splitQuote(line, 1).body;
}

/** `- COUNT × TARGET` with spaces around the sign. */
const ROW_SPACED = /^[-*+][ \t]+(\S+)[ \t]+[×xX][ \t]+(\S.*)$/;
/** `- 2×TARGET`, `- **1d4**x TARGET`: no space before the sign, a numeric count only. */
const ROW_TIGHT = /^[-*+][ \t]+((?:\*\*|__)?\d*d?\d+(?:\*\*|__)?)[ \t]*[×xX][ \t]*(\S.*)$/;
const WIKI = /^\[\[([^\]|]*)(?:\|[^\]]*)?\]\]$/;
const MARKDOWN = /^\[[^\]]*\]\(([^)]*)\)$/;

/**
 * US-9.6 | AC-3: one row line `- COUNT × TARGET — NOTE` (bullet `-`, `*` or
 * `+`; `×`, `x` or `X` with optional spaces), or null. COUNT is kept as
 * written, without bold marks around it (`**2**` → `2`). The note is the
 * text after the first ` — `, its links flattened.
 */
export function readEncounterLine(line: string): EncounterLine | null {
  const text = unquote(line);
  const m = text.match(ROW_SPACED) ?? text.match(ROW_TIGHT);
  if (!m) return null;
  const count = m[1].replace(/^(\*\*|__)(.*)\1$/, '$2').trim();
  if (count === '' || /\s/.test(count)) return null;
  let rest = m[2].trim();
  let note = '';
  const dash = rest.indexOf(' — ');
  if (dash !== -1) {
    note = flattenLinks(rest.slice(dash + 3)).trim();
    rest = rest.slice(0, dash).trim();
  }
  const wiki = rest.match(WIKI);
  if (wiki) return { count, target: { kind: 'wiki', link: wiki[1].trim() }, note };
  const markdown = rest.match(MARKDOWN);
  if (markdown) return { count, target: { kind: 'markdown', destination: markdown[1].trim() }, note };
  return { count, target: { kind: 'plain', text: rest }, note };
}

/**
 * US-9.6 | AC-3: the lines of a callout after its header that are not row
 * lines (blank `>`, paragraphs, lines without `×`, every line of a fenced
 * code block inside it), as indexes into `lines`; and the row lines.
 */
export function readEncounterCallout(lines: readonly string[], callout: EncounterCallout): {
  rows: Array<{ index: number; line: EncounterLine }>;
  unread: number[];
} {
  const rows: Array<{ index: number; line: EncounterLine }> = [];
  const unread: number[] = [];
  let fence: string | null = null;
  for (let i = callout.start + 1; i < callout.end; i++) {
    const text = unquote(lines[i]);
    const opener = text.match(/^[ \t]{0,3}(`{3,}|~{3,})/);
    if (fence !== null) {
      unread.push(i);
      if (opener && opener[1][0] === fence[0] && opener[1].length >= fence.length) fence = null;
      continue;
    }
    if (opener) {
      fence = opener[1];
      unread.push(i);
      continue;
    }
    const line = readEncounterLine(lines[i]);
    if (line === null) unread.push(i);
    else rows.push({ index: i, line });
  }
  return { rows, unread };
}

/**
 * US-9.6 | AC-6, AC-10: the block text in the contract's form: `title` only
 * when set, then `rows`, each row's keys in the order name, count, note,
 * data; `count` always double-quoted; the YAML writer of US-9.1.
 */
export function encounterBlockText(title: string, rows: readonly EncounterRow[]): string {
  // Two rows of one creature hold equal maps; YAML anchors would make the reader see one map (`&a1`).
  const doc = new Document({
    ...(title === '' ? {} : { title }),
    rows: rows.map(row => ({
      name: row.name,
      count: Object.assign(new Scalar(row.count), { type: 'QUOTE_DOUBLE' as const }),
      ...(row.note === '' ? {} : { note: row.note }),
      ...(row.data === null ? {} : { data: row.data }),
    })),
  }, { aliasDuplicateObjects: false });
  return fencedBlock('o2t-encounter', doc.toString({ nullStr: '' }));
}
