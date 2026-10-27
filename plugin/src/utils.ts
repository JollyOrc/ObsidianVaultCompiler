export function slugify(text: string): string {
  // Decompose accented characters (è → e + combining grave) then strip diacritics
  // so that non-ASCII input produces a meaningful, non-empty slug.
  const slug = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9.-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  // Guard: never return an empty string (fuzz requirement).
  return slug || '_';
}

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
 * label and anchor slug that points at one, must come from this function, so
 * that links always find their heading.
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
 * KD-3 (US-6.6): the only definition of "inside a code block". For each line,
 * true when it lies after a line opening a block (``` or ~~~ after optional
 * spaces) up to and including the line closing it (the next line starting
 * with the same fence); an unclosed block runs to the end. Opening lines are
 * not inside.
 */
export function codeBlockMask(lines: string[]): boolean[] {
  const mask: boolean[] = [];
  let fence: string | null = null;
  for (const line of lines) {
    if (fence !== null) {
      mask.push(true);
      if (line.match(FENCE)?.[1] === fence) fence = null;
      continue;
    }
    mask.push(false);
    fence = line.match(FENCE)?.[1] ?? null;
  }
  return mask;
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
