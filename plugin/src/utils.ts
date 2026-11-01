export function splitExtension(name: string): { stem: string; ext: string } {
  const match = name.match(/^(.*)(\.[^.]+)$/);
  if (!match) {
    return { stem: name, ext: '' };
  }
  return { stem: match[1], ext: match[2] };
}

/**
 * US-6.4 | Title rule (also US-6.1 AC-1, US-6.3 AC-6, US-6.5, US-2.3).
 *
 * Derives the heading title of an embedded file from its basename. Applies
 * exactly these transforms, in order (SCAR-001):
 *   1. removes the extension (the last `.xxx`);
 *   2. removes a numeric prefix — digits and dots followed by whitespace — and
 *      that whitespace (`1.2 Combat` → `Combat`; `2.1-intro` is not a prefix);
 *   3. upper-cases the first character.
 * Nothing else changes: hyphens, underscores, brackets and the case of later
 * words are kept. Every heading the compiler writes for a file, and every link
 * label that points at one, must come from this function, so that links
 * always find their heading (anchors: `anchors.ts`, US-2.3).
 */
export function titleFromBasename(basename: string): string {
  const stem = basename.replace(/\.[^.]+$/, '').replace(/^[\d.]+\s+/, '');
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

export function headingLevel(filename: string): number {
  const base = filename.replace(/\.[^.]+$/, '');
  const numeric = base.match(/^([\d.]+)\s/)?.[1] ?? base.match(/^([\d.]+)$/)?.[1];
  if (!numeric) {
    return 2;
  }
  const normalized = numeric.replace(/\.0+$/, '');
  const dots = (normalized.match(/\./g) || []).length;
  return Math.min(dots + 1, 6);
}

/**
 * US-5.2 | Definition, AC-10, AC-11: splits a note into its YAML frontmatter
 * and the text after it.
 *
 * Applies exactly these transforms (SCAR-001):
 *   1. when the first line is `---` (trailing spaces or tabs allowed) and a
 *      later line is `---` (same allowance), removes everything up to and
 *      including the first such closing line and its line break (`\n` or
 *      `\r\n`);
 *   2. returns in `lines` how many source lines were removed (0 when there is
 *      no frontmatter).
 * Nothing else changes: blank lines after the frontmatter and later `---`
 * rules are kept, and a first-line `---` without a closing line is not
 * frontmatter.
 */
export function splitFrontmatter(text: string): { body: string; lines: number } {
  const match = text.match(/^---[ \t]*\r?\n(?:[^\n]*\n)*?---[ \t]*(?:\r?\n|$)/);
  if (!match) {
    return { body: text, lines: 0 };
  }
  const block = match[0];
  const lines = block.split('\n').length - (block.endsWith('\n') ? 1 : 0);
  return { body: text.slice(block.length), lines };
}

/**
 * KD-3 (US-6.6): the only definition of a heading line — 1 to 6 `#` at the
 * start, then a space or tab. Returns the level and the rest of the line
 * (with its leading space), or null. Callers that scan several lines skip
 * lines inside code blocks (`codeBlockMask`).
 */
export function matchHeading(line: string): { level: number; rest: string } | null {
  const m = line.match(/^(#{1,6})([ \t].*)$/);
  return m ? { level: m[1].length, rest: m[2] } : null;
}

/** KD-3 (US-6.6): a line that opens or closes a code block, and its fence. */
const FENCE = /^\s*(```|~~~)/;

/**
 * KD-3 (US-6.6); US-1.4 | AC-1: the fence a line opens or closes with — its
 * character and how many of them — or null.
 */
function fenceOf(line: string): { char: string; length: number } | null {
  if (!FENCE.test(line)) return null;
  const run = line.trimStart().match(/^(`+|~+)/)![1];
  return { char: run[0], length: run.length };
}

/** US-1.5 | Definitions: one quote marker — at most three spaces, `>`, one optional space or tab. */
const QUOTE_MARKER = /^ {0,3}>[ \t]?/;

/**
 * US-1.5 | Definitions; US-1.4 | AC-7: the only reader of a line's quote
 * prefix. Removes up to `max` quote markers from the start of `line` and
 * returns them (`prefix`), how many there were (`depth`) and the rest
 * (`body`). Nothing else changes: `> > x` → `> > `, 2, `x`; `>>x` → `>>`, 2,
 * `x`; `x` → ``, 0, `x`.
 */
export function splitQuote(line: string, max = Infinity): { prefix: string; depth: number; body: string } {
  let depth = 0;
  let at = 0;
  while (depth < max) {
    const marker = line.slice(at).match(QUOTE_MARKER);
    if (marker === null) break;
    at += marker[0].length;
    depth += 1;
  }
  return { prefix: line.slice(0, at), depth, body: line.slice(at) };
}

/**
 * KD-3 (US-6.6); US-1.4 | AC-1, AC-7: walks the fenced blocks of `lines`,
 * calls `onLine` with whether each line is inside one, and returns the block
 * still open after the last line (its opening line, fence and quote depth),
 * or null. See `codeBlockMask` for the rule.
 */
function walkFences(
  lines: string[],
  onLine: (inside: boolean) => void,
): { line: number; char: string; length: number; depth: number } | null {
  let open: { line: number; char: string; length: number; depth: number } | null = null;
  lines.forEach((line, index) => {
    if (open !== null) {
      const quote = splitQuote(line, open.depth);
      if (quote.depth === open.depth) {
        onLine(true);
        const fence = fenceOf(quote.body);
        if (fence !== null && fence.char === open.char && fence.length >= open.length) open = null;
        return;
      }
      open = null;
    }
    onLine(false);
    const quote = splitQuote(line);
    const fence = fenceOf(quote.body);
    open = fence === null ? null : { line: index, ...fence, depth: quote.depth };
  });
  return open;
}

/**
 * KD-3 (US-6.6); US-1.4 | AC-1, AC-7: the only definition of "inside a fenced
 * code block". For each line, true when it lies after a line opening a block
 * (``` or ~~~ after optional spaces) up to and including the line closing it
 * — the next line starting with the same character at least as many times,
 * so ```` holds an inner ``` — an unclosed block runs to the end. Opening
 * lines are not inside. A line is read by what follows its quote prefix
 * (`splitQuote`): `> ~~~` opens a block at quote depth 1, and a later line
 * with fewer markers than its block's depth ends the block (the quote ended);
 * inside a block opened outside a quote, `>` lines are code text.
 */
export function codeBlockMask(lines: string[]): boolean[] {
  const mask: boolean[] = [];
  walkFences(lines, inside => mask.push(inside));
  return mask;
}

/**
 * US-1.4 | AC-6, AC-7: the fenced block `lines` leave open at their end — the
 * index of its opening line and the fence that closes it (its character, as
 * many times) — or null when every block is closed. A block inside a quote
 * is closed by its quote, so it is never left open.
 */
export function unclosedFence(lines: string[]): { line: number; fence: string } | null {
  const open = walkFences(lines, () => undefined);
  return open === null || open.depth > 0 ? null : { line: open.line, fence: open.char.repeat(open.length) };
}

/** US-1.4 | AC-1: the width of a line's leading whitespace, a tab as four. */
function indentWidth(text: string): number {
  return [...(text.match(/^[ \t]*/)?.[0] ?? '')].reduce((width, c) => width + (c === '\t' ? 4 : 1), 0);
}

/**
 * US-1.4 | AC-1: reads which parts of `text` are code, as Obsidian shows them
 * (measured 2026-11-01):
 * - block code, by line (`lines`): the lines inside a fenced block
 *   (`codeBlockMask`), not its opening line; and indented code — a line
 *   indented by four or more (a tab as four) after a blank line, a heading,
 *   a fenced block or indented code — not under a paragraph line; inside a list (from an item to the first line after a blank line
 *   indented less than the item's text) four more than the item's text;
 * - inline code (`inline`, sorted `[start, end)` ranges): a run of backticks
 *   up to the next run of exactly as many in the same paragraph (lines up to
 *   a blank line, a heading, a list item or a block); a run never closed is
 *   text.
 * Lines for which `blank` is true (provenance comments in the assembled
 * document) count as blank lines. A line inside a quote is read by what
 * follows its quote prefix (`splitQuote`; `>` alone is a blank line), and a
 * change of quote depth ends a paragraph and a list (US-1.4 AC-7).
 */
function scanCode(text: string, blank: (line: string) => boolean): { lines: boolean[]; inline: Array<[number, number]> } {
  const textLines = text.split('\n');
  const fenced = codeBlockMask(textLines);
  const lines: boolean[] = [];
  const inline: Array<[number, number]> = [];
  let paragraph: [number, number] | null = null;
  const endParagraph = () => {
    if (paragraph !== null) inline.push(...inlineCode(text, paragraph[0], paragraph[1]));
    paragraph = null;
  };
  let afterBlank = true;
  let afterCode = false;
  let itemText: number | null = null;
  let depth = 0;
  let offset = 0;
  textLines.forEach((rawLine, i) => {
    const start = offset;
    const end = offset + rawLine.length;
    offset = end + 1;
    lines.push(false);
    if (fenced[i]) {
      endParagraph();
      lines[i] = true;
      afterBlank = true;
      afterCode = false;
      return;
    }
    // US-1.4 | AC-7: a line is read by what follows its quote prefix; a
    // change of quote depth ends the paragraph and any list.
    const quote = splitQuote(rawLine);
    if (quote.depth !== depth) {
      endParagraph();
      itemText = null;
      depth = quote.depth;
    }
    const line = quote.body;
    if (fenceOf(line) !== null) {
      endParagraph();
      // A block is no paragraph: indented code may follow it directly.
      afterBlank = true;
      afterCode = false;
      return;
    }
    if (line.trim() === '' || blank(rawLine)) {
      endParagraph();
      afterBlank = true;
      return;
    }
    const indent = indentWidth(line);
    if ((afterBlank || afterCode) && indent >= (itemText === null ? 4 : itemText + 4)) {
      endParagraph();
      lines[i] = true;
      afterBlank = false;
      afterCode = true;
      return;
    }
    afterCode = false;
    const item = line.match(/^([ \t]*)([-*+]|\d+[.)])([ \t]+)\S/);
    if (item !== null) {
      endParagraph();
      itemText = indentWidth(item[1]) + item[2].length + item[3].length;
    } else if (itemText !== null && afterBlank && indent < itemText) {
      itemText = null;
    }
    afterBlank = false;
    if (matchHeading(line) !== null) {
      endParagraph();
      inline.push(...inlineCode(text, start, end));
      // A heading is no paragraph: indented code may follow it directly.
      afterBlank = true;
      return;
    }
    paragraph = paragraph === null ? [start, end] : [paragraph[0], end];
  });
  endParagraph();
  return { lines, inline };
}

/** US-1.4 | AC-1: for each line of `text`, whether it is block code (fenced or indented). */
export function codeLines(text: string, blank: (line: string) => boolean = () => false): boolean[] {
  return scanCode(text, blank).lines;
}

/** US-1.4 | AC-1: the inline code spans of `text`, sorted `[start, end)` ranges. */
export function inlineCodeRanges(text: string, blank: (line: string) => boolean = () => false): Array<[number, number]> {
  return scanCode(text, blank).inline;
}

/**
 * US-1.4 | AC-1: every part of `text` that is code — whole lines of block
 * code and inline spans — as sorted `[start, end)` character ranges.
 */
export function codeRanges(text: string, blank: (line: string) => boolean = () => false): Array<[number, number]> {
  const { lines, inline } = scanCode(text, blank);
  const ranges: Array<[number, number]> = [...inline];
  let offset = 0;
  text.split('\n').forEach((line, i) => {
    if (lines[i]) ranges.push([offset, offset + line.length]);
    offset += line.length + 1;
  });
  return ranges.sort((a, b) => a[0] - b[0]);
}

/** US-1.4 | AC-1: the inline code spans of `text` between `start` and `end`. */
function inlineCode(text: string, start: number, end: number): Array<[number, number]> {
  const runs = [...text.slice(start, end).matchAll(/`+/g)];
  const spans: Array<[number, number]> = [];
  for (let k = 0; k < runs.length; k++) {
    let m = k + 1;
    while (m < runs.length && runs[m][0].length !== runs[k][0].length) m++;
    if (m < runs.length) {
      spans.push([start + (runs[k].index ?? 0), start + (runs[m].index ?? 0) + runs[m][0].length]);
      k = m;
    }
  }
  return spans;
}

/** US-1.4 | AC-2: whether `pos` lies in one of the sorted `ranges`. */
export function inRanges(ranges: Array<[number, number]>, pos: number): boolean {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ranges[mid][1] <= pos) lo = mid + 1;
    else if (ranges[mid][0] > pos) hi = mid - 1;
    else return true;
  }
  return false;
}

/**
 * US-6.1: true when the first non-empty line (leading spaces ignored) is a
 * heading. The first line can never be inside a code block (KD-3).
 */
export function startsWithHeading(text: string): boolean {
  return matchHeading(text.replace(/^\s+/, '').split('\n')[0]) !== null;
}

/**
 * US-6.1: removes leading white space and, when the first line is then a
 * heading, that line with its line break.
 */
export function stripLeadingHeading(text: string): string {
  const rest = text.replace(/^\s+/, '');
  const first = rest.split('\n')[0];
  if (matchHeading(first) === null) return text;
  return rest.slice(first.length + (rest.length > first.length ? 1 : 0));
}

export function isMarkdownFilename(name: string): boolean {
  return /\.(md|markdown)$/i.test(name);
}

export function isAssetFilename(name: string): boolean {
  return !isMarkdownFilename(name);
}

export function encodeAssetPath(path: string): string {
  return path
    .split('/')
    .map(part => encodeURIComponent(part))
    .join('/');
}

export function normalizeAssetFilename(name: string): string {
  const lower = name.toLowerCase();
  const dotIndex = lower.lastIndexOf('.');
  const stem = dotIndex > 0 ? lower.slice(0, dotIndex) : lower;
  const ext = dotIndex > 0 ? lower.slice(dotIndex) : '';
  const safeStem = stem.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `${safeStem || 'asset'}${ext}`;
}

export function computeContentHash(content: string): string {
  // Lightweight deterministic hash for environments without Node crypto.
  let hash = 0;
  const normalized = content.trim().replace(/\r\n/g, '\n');
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

/**
 * US-6.6 | AC-1 to AC-6: the empty-line rules of the compiled output.
 *
 * Applies exactly these transforms (SCAR-001), outside code blocks only (a
 * block runs from a line starting with ``` or ~~~, after optional spaces, to
 * the next line starting with the same fence; lines inside it stay as they
 * are):
 *   1. a line of only spaces or tabs becomes empty, and a run of empty lines
 *      becomes one empty line;
 *   2. a heading (1–6 `#` and a space or tab) gets exactly one empty line
 *      before it, unless it is the first line;
 *   3. the empty lines after a heading are removed, unless a heading follows;
 *   4. empty lines at the start are removed, and the text ends with one line
 *      break (an empty text stays empty).
 */
export function tidyBlankLines(text: string): string {
  const lines = text.split('\n');
  const inCode = codeBlockMask(lines);
  const out: string[] = [];
  let pendingEmpty = false;
  let afterHeading = false;
  lines.forEach((raw, i) => {
    if (inCode[i]) {
      out.push(raw);
      return;
    }
    if (raw.trim() === '') {
      pendingEmpty = true;
      return;
    }
    const isHeading = matchHeading(raw) !== null;
    if (out.length > 0 && (isHeading || (pendingEmpty && !afterHeading))) out.push('');
    out.push(raw);
    afterHeading = isHeading;
    pendingEmpty = false;
  });
  return out.length > 0 ? `${out.join('\n')}\n` : '';
}

/**
 * US-3.1 (#101): decodes the `%` escapes of a link (`%20`, `%25`, `%C3%A9`)
 * and keeps any other `%` as written, so `50% off` stays `50% off` instead of
 * aborting with "URI malformed". The only place that decodes a link.
 */
export function decodeLink(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text.replace(/(?:%[0-9A-Fa-f]{2})+/g, run => {
      try {
        return decodeURIComponent(run);
      } catch {
        return run;
      }
    });
  }
}
