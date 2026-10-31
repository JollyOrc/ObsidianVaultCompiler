/* eslint-disable @typescript-eslint/no-explicit-any */
import type { OutputWriter } from './output-writer.ts';
import { computeContentHash } from './utils.ts';

/**
 * US-4.2 | AC-1, AC-2: the part of the installed Text Mapper plugin the
 * compiler uses — its markdown code-block processor (v1.1.0 `main.js`).
 */
export interface TextMapperPluginLike {
  processMarkdown(
    source: string,
    el: HTMLElement,
    ctx: { docId: string; addChild(child: unknown): void },
  ): unknown;
}

/** US-4.2 | AC-2, US-4.4 | AC-2: DOM helpers, injected so tests can fake them. */
export interface MapDom {
  /** A fresh element the plugin draws into; never attached to the document. */
  createContainer(): HTMLElement;
  /** The drawn `<svg>` as text, with its namespace. */
  serialize(svg: Element): string;
}

export function altForTextMapper(code: string): string {
  const labeled = code.match(/\d{4}\s+\S+(?:\s+"([^"]+)")?/);
  if (labeled && labeled[1]) return labeled[1];
  const includeMatch = code.match(/include\s+(\S+)/);
  if (includeMatch) {
    return includeMatch[1].replace(/\.[^.]+$/, '') + ' Map';
  }
  return 'TextMapper Map';
}

/**
 * Extract all `include <filename>` directives from a text-mapper block.
 * Returns filenames in the order they appear.
 */
export function extractIncludes(code: string): string[] {
  const result: string[] = [];
  for (const line of code.split('\n')) {
    const match = line.match(/^include\s+(\S+)/i);
    if (match) result.push(match[1].trim());
  }
  return result;
}

/**
 * Build a placeholder comment for a text-mapper block that could not be rendered.
 * Never emits the raw block source or starts a code fence.
 */
export function buildPlaceholder(code: string, message = 'TextMapper rendering not available'): string {
  // code parameter intentionally ignored — we must not leak it into the output
  void code;
  return `\n<!-- Warning: TextMapper placeholder — ${message} -->\n`;
}

/**
 * Parse the intrinsic dimensions from an SVG string.
 * Prefers viewBox over explicit width/height attributes.
 * Falls back to 1024×1024 when no dimension information is present.
 */
export function parseSvgDimensions(svg: string): { width: number; height: number } {
  // Try viewBox first (most reliable for text-mapper SVG output)
  const viewBoxMatch = svg.match(/viewBox\s*=\s*["']([^"']+)["']/);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/);
    if (parts.length >= 4) {
      const w = parseFloat(parts[2]);
      const h = parseFloat(parts[3]);
      if (w > 0 && h > 0) return { width: Math.round(w), height: Math.round(h) };
    }
  }
  // Fall back to explicit width/height attributes
  const widthMatch = svg.match(/\bwidth\s*=\s*["']([0-9.]+)["']/);
  const heightMatch = svg.match(/\bheight\s*=\s*["']([0-9.]+)["']/);
  if (widthMatch && heightMatch) {
    const w = parseFloat(widthMatch[1]);
    const h = parseFloat(heightMatch[1]);
    if (w > 0 && h > 0) return { width: Math.round(w), height: Math.round(h) };
  }
  return { width: 1024, height: 1024 };
}

/**
 * Compute PNG output dimensions from SVG intrinsic dimensions.
 * Scales so that the longer edge equals `maxLong` (default 2048), preserving
 * the aspect ratio. Returns integer pixel values (no fractional pixels).
 */
export function computePngDimensions(
  svgWidth: number,
  svgHeight: number,
  maxLong = 2048
): { width: number; height: number } {
  const long = Math.max(svgWidth, svgHeight);
  const scale = maxLong / long;
  return {
    width: Math.round(svgWidth * scale),
    height: Math.round(svgHeight * scale),
  };
}

/**
 * US-4.2 | AC-1: the installed and enabled Text Mapper plugin, or null.
 *
 * Obsidian lists only enabled plugins in `app.plugins.plugins`; an entry
 * without `processMarkdown` is not a usable engine.
 */
export function getTextMapperPlugin(app: any): TextMapperPluginLike | null {
  const plugin = app?.plugins?.plugins?.['text-mapper'];
  return plugin && typeof plugin.processMarkdown === 'function' ? plugin : null;
}

/**
 * US-4.2 | AC-2, AC-5; US-4.6 | AC-1: draws one map with the plugin and returns
 * its `<svg>` as text.
 *
 * Calls `processMarkdown(code, container, ctx)` with the source unchanged on a
 * container that is never attached to the document; the plugin draws at once
 * in its render child's constructor, so `addChild` only has to accept the
 * child. No plugin, or no `<svg>` after the call (the plugin's parse error),
 * is a render failure.
 */
export async function renderMapSvg(
  plugin: TextMapperPluginLike | null,
  code: string,
  dom: MapDom,
): Promise<string> {
  if (plugin === null) {
    throw new Error('TextMapper plugin is not installed or enabled');
  }
  const container = dom.createContainer();
  const ctx = { docId: mapDocId(code), addChild: () => undefined };
  await plugin.processMarkdown(code, container, ctx);
  const svg = container.querySelector('svg');
  if (!svg) {
    throw new Error('TextMapper could not draw this map');
  }
  return dom.serialize(svg);
}

/**
 * US-4.2 | AC-4; US-4.8 | AC-3: makes the plugin's SVG ready for the PNG.
 *
 * Applies exactly these transforms (SCAR-001):
 *   1. removes the first `<rect>` when it is the plugin's background: `fill`
 *      white and `x`, `y`, `width`, `height` equal to the root `viewBox`
 *      (so the PNG is transparent); no other `rect` is touched;
 *   2. adds `font-family: <font>` to the root `<svg>` `style` (appended to an
 *      existing style), with `&`, `"` and `<` escaped for the attribute;
 *   3. US-4.8 | AC-3: when `faceCss` is not empty, inserts
 *      `<style><![CDATA[faceCss]]></style>` as the first child of the root.
 */
export function prepareMapSvg(svg: string, font: string, faceCss = ''): string {
  let out = svg;
  const viewBox = out.match(/^<svg\b[^>]*\bviewBox="([^"]+)"/)?.[1]?.trim().split(/[\s,]+/).map(Number);
  const firstRect = out.match(/<rect\b[^>]*\/?>/);
  if (viewBox && viewBox.length === 4 && firstRect) {
    const attr = (name: string) => firstRect[0].match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
    const isWhite = ['white', '#fff', '#ffffff'].includes((attr('fill') ?? '').toLowerCase());
    const covers = ['x', 'y', 'width', 'height'].every((name, i) => Number(attr(name)) === viewBox[i]);
    if (isWhite && covers) {
      out = out.slice(0, firstRect.index!) + out.slice(firstRect.index! + firstRect[0].length);
    }
  }

  const escaped = font.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const rootMatch = out.match(/^<svg\b[^>]*>/);
  if (!rootMatch) return out;
  const root = rootMatch[0];
  const styled = /\bstyle="([^"]*)"/.test(root)
    ? root.replace(/\bstyle="([^"]*)"/, (_m, style: string) => `style="${style.replace(/;?\s*$/, '')}; font-family: ${escaped}"`)
    : root.replace(/^<svg\b/, `<svg style="font-family: ${escaped}"`);
  const style = faceCss === '' ? '' : `<style><![CDATA[${faceCss.replace(/]]>/g, ']]]]><![CDATA[>')}]]></style>`;
  return styled + style + out.slice(root.length);
}

/** US-4.8 | AC-2: the CSS generic font families. */
const GENERIC_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong',
]);

/**
 * US-4.8 | AC-2: the family names of a CSS font list, without quotes.
 *
 * Splits on commas outside quotes, trims each name and removes one pair of
 * surrounding single or double quotes. Empty names are dropped.
 */
export function parseFontList(list: string): string[] {
  const names: string[] = [];
  let current = '';
  let quote: string | null = null;
  for (const ch of list) {
    if (quote !== null) {
      if (ch === quote) quote = null;
      current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === ',') {
      names.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  names.push(current);
  return names
    .map(name => name.trim().replace(/^(["'])(.*)\1$/, '$2').trim())
    .filter(name => name !== '');
}

/**
 * US-4.8 | AC-1, AC-2: the font list for compiled maps.
 *
 * A non-empty setting is used as written (trimmed); otherwise the font list
 * Obsidian's maps inherit, read only then. A list without a generic family
 * gets `, sans-serif` appended; nothing readable gives `sans-serif`.
 */
export function resolveMapFont(setting: string, readObsidianFont: () => string | null): string {
  const chosen = setting.trim();
  const list = chosen !== '' ? chosen : (readObsidianFont() ?? '').trim();
  if (list === '') return 'sans-serif';
  const hasGeneric = parseFontList(list).some(name => GENERIC_FAMILIES.has(name.toLowerCase()));
  return hasGeneric ? list : `${list}, sans-serif`;
}

/** US-4.8 | AC-3: one `@font-face` rule as found in Obsidian's style sheets. */
export interface FontFaceSource {
  /** `font-family` as written in the rule (may be quoted). */
  family: string;
  /** `src` as written in the rule; empty for a rule without a source. */
  src: string;
  /** URL that relative `url(…)` values resolve against. */
  baseUrl: string;
  /** Other descriptors to keep, e.g. `font-weight`, `font-style`. */
  descriptors: Record<string, string>;
}

const FONT_MIME: Record<string, string> = {
  woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf',
};

/** US-4.8 | AC-3: base64 of bytes, without Node's Buffer (works on mobile). */
function toBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 0x8000) {
    binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * US-4.8 | AC-3, AC-4: `@font-face` rules for every family of `list` that the
 * style sheets define, with every source turned into a `data:` URL.
 *
 * Faces are matched by family name without quotes, ignoring case; a face with
 * an empty `src` is skipped. `data:` sources are kept; other sources are
 * resolved against the face's `baseUrl` and read with `fetchBytes`. A face
 * whose file cannot be read is left out, and its family is reported once
 * (ignoring case) in `failed`.
 */
export async function embedFontFaces(
  list: string,
  faces: FontFaceSource[],
  fetchBytes: (url: string) => Promise<ArrayBuffer>,
): Promise<{ css: string; failed: string[] }> {
  const wanted = new Set(parseFontList(list).map(name => name.toLowerCase()));
  const rules: string[] = [];
  const failed: string[] = [];
  for (const face of faces) {
    const family = parseFontList(face.family)[0] ?? '';
    if (!wanted.has(family.toLowerCase()) || face.src.trim() === '') continue;
    try {
      let src = face.src;
      for (const match of face.src.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)) {
        const target = match[2];
        if (target.startsWith('data:')) continue;
        const absolute = new URL(target, face.baseUrl).href;
        const ext = absolute.split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? '';
        const mime = FONT_MIME[ext] ?? 'application/octet-stream';
        const data = `data:${mime};base64,${toBase64(await fetchBytes(absolute))}`;
        src = src.replace(match[0], `url("${data}")`);
      }
      const descriptors = Object.entries(face.descriptors)
        .filter(([, value]) => value.trim() !== '')
        .map(([name, value]) => `${name}: ${value}; `)
        .join('');
      rules.push(`@font-face { font-family: "${family}"; src: ${src}; ${descriptors}}`);
    } catch {
      if (!failed.some(name => name.toLowerCase() === family.toLowerCase())) failed.push(family);
    }
  }
  return { css: rules.join('\n'), failed };
}

/**
 * US-4.8 | AC-3: every `@font-face` rule of the document's style sheets.
 * Sheets that cannot be read (cross-origin) are skipped.
 */
export function collectFontFaces(doc: Document): FontFaceSource[] {
  const faces: FontFaceSource[] = [];
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const style = rule.style;
      const descriptors: Record<string, string> = {};
      for (const name of ['font-weight', 'font-style', 'font-stretch', 'unicode-range']) {
        descriptors[name] = style.getPropertyValue(name);
      }
      faces.push({
        family: style.getPropertyValue('font-family'),
        src: style.getPropertyValue('src'),
        baseUrl: sheet.href ?? doc.baseURI,
        descriptors,
      });
    }
  }
  return faces;
}

/** US-4.8 | AC-6: the font key of a font list (its content hash). */
export function mapFontKey(list: string): string {
  return computeContentHash(list);
}

/**
 * US-4.1, US-4.8 | AC-6: the file name of a map PNG, `<hash>_<key>.png`;
 * without a key, `<hash>_0001.png`. The only place map names are built.
 */
export function mapAssetName(hash: string, key?: string): string {
  return `${hash}_${key ?? '0001'}.png`;
}

/**
 * US-4.1, US-4.8 | AC-6: reads `<hash>_<key>.png` at the end of a
 * `textmapper/` path; null for any other path. The only place map names are
 * parsed.
 */
export function parseMapAssetRef(ref: string): { hash: string; key: string } | null {
  const match = ref.match(/textmapper\/([0-9a-fA-F]+)_([0-9a-zA-Z]+)\.png$/);
  return match ? { hash: match[1].toLowerCase(), key: match[2] } : null;
}

/** US-4.8 | AC-5: the map font of one compile. */
export interface MapFont {
  /** Font list written on every map. */
  family: string;
  /** Embedded `@font-face` rules, or ''. */
  css: string;
  /** Font key for map PNG names. */
  key: string;
  /** Families whose files could not be read (AC-4). */
  failed: string[];
}

/**
 * US-4.8 | AC-2 to AC-6: works out the map font once per compile — the list,
 * the embedded faces and the key.
 */
export async function prepareMapFont(setting: string): Promise<MapFont> {
  const family = resolveMapFont(setting, readObsidianNoteFont);
  const { css, failed } = await embedFontFaces(family, collectFontFaces(document), async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.arrayBuffer();
  });
  return { family, css, key: mapFontKey(family), failed };
}

/**
 * US-4.8 | AC-2: Obsidian's note font, from the computed `font-family` of a
 * `.markdown-rendered` probe element that is added for the reading only.
 */
export function readObsidianNoteFont(): string | null {
  const probe = document.body.createDiv({ cls: 'markdown-rendered' });
  probe.setCssStyles({ position: 'absolute', visibility: 'hidden' });
  try {
    return getComputedStyle(probe).fontFamily || null;
  } finally {
    probe.remove();
  }
}

/**
 * US-4.1, US-4.2, US-4.4, US-4.5, US-4.8, US-4.9, US-4.10 | AC-6: draws one
 * map with the installed plugin and writes it as a PNG with a transparent
 * background and the map font prepared for this compile (`prepareMapFont`).
 * Labels are tidied when `tidyLabels` is on, then the map's own directives
 * are applied; `skippedDirectives` names directives the map's shape did not
 * allow (US-4.10 AC-7).
 */
export async function renderTextMapperBlock(
  app: any,
  code: string,
  destinationPath: string,
  writer: OutputWriter,
  mapFont: MapFont,
  tidyLabels: boolean,
): Promise<{ skipped: string[]; unbreakable: boolean; skippedDirectives: string[] }> {
  let svg = await renderMapSvg(getTextMapperPlugin(app), code, {
    createContainer: () => document.createElement('div'),
    serialize: element => new XMLSerializer().serializeToString(element),
  });
  let report = { skipped: [] as string[], unbreakable: false };
  if (tidyLabels) {
    const tidied = tidyMapLabels(svg, mapDocId(code), canvasMeasure(mapFont.family), isHorizontalMap(code));
    svg = tidied.svg;
    report = { skipped: tidied.skipped, unbreakable: tidied.unbreakable };
  }
  // US-4.10 | AC-6: directives after tidying, with tidying on and off.
  const directives = applyMapDirectives(svg, mapDocId(code), parseMapDirectives(code));
  svg = directives.svg;
  const prepared = prepareMapSvg(svg, mapFont.family, mapFont.css);
  const { width, height } = computePngDimensions(...Object.values(parseSvgDimensions(prepared)) as [number, number]);
  await writePngFromSvg(writer, prepared, destinationPath, width, height);
  return { ...report, skippedDirectives: directives.skipped };
}

/**
 * US-4.2 | AC-2; US-4.9: the `docId` given to the plugin for one map; the
 * plugin suffixes its group ids with it (`labels-<docId>`).
 */
export function mapDocId(code: string): string {
  return `vault-compiler-${computeContentHash(code)}`;
}

/**
 * US-4.9 | AC-9: the key in map PNG names — the font key (US-4.8 AC-6), with
 * `t` appended when labels are tidied.
 */
export function mapImageKey(fontKey: string, tidy: boolean): string {
  return tidy ? `${fontKey}t` : fontKey;
}

/** US-4.9 | AC-2, AC-3: hex geometry of the plugin (Text Mapper v1.1.0). */
const FLAT_DY = (100 * Math.sqrt(3)) / 2;
const HEX = {
  flat: { labelOffset: FLAT_DY * 0.8, width: 200 },
  pointy: { labelOffset: 100 * 0.58, width: 2 * FLAT_DY },
};
/** US-4.9 | AC-3: share of the hex width a line may use (OD-L3). */
const LINE_WIDTH_SHARE = 0.8;
/** US-4.9 | AC-2: line height as a multiple of the font size (OD-L3). */
const LINE_HEIGHT = 1.2;

/**
 * US-4.9 | AC-2: true for maps with an `option horizontal` line, which the
 * plugin draws pointy-top.
 */
export function isHorizontalMap(code: string): boolean {
  return /^\s*option\s+horizontal\b/m.test(code);
}

/**
 * US-4.9 | AC-3: an SVG `font-size` in user units: `pt` × 4/3, `px` and plain
 * numbers as they are; anything else (or nothing) counts as the plugin's
 * default label size, 20pt.
 */
export function fontSizeToUnits(attr: string | undefined): number {
  const match = attr?.trim().match(/^(\d+(?:\.\d+)?)\s*(pt|px)?$/);
  if (!match) return (20 * 4) / 3;
  const value = Number(match[1]);
  return match[2] === 'pt' ? (value * 4) / 3 : value;
}

/**
 * US-4.9 | AC-4: splits one word that is wider than `width` into a first part
 * that fits and the rest, or null when not even 2 characters fit.
 *
 * Prefers the longest part ending in an existing `-` or `&` (no hyphen added);
 * otherwise the longest prefix that fits with a hyphen. Both parts keep at
 * least 2 characters.
 */
function splitWord(word: string, width: number, measure: (text: string) => number): [string, string] | null {
  for (let i = word.length - 3; i >= 1; i--) {
    if ((word[i] === '-' || word[i] === '&') && measure(word.slice(0, i + 1)) <= width) {
      return [word.slice(0, i + 1), word.slice(i + 1)];
    }
  }
  for (let p = word.length - 2; p >= 2; p--) {
    const head = `${word.slice(0, p)}-`;
    if (measure(head) <= width) return [head, word.slice(p)];
  }
  return null;
}

/**
 * US-4.9 | AC-3, AC-4: breaks a label into lines of at most `width`.
 *
 * Words (split at whitespace) fill a line while it fits; a word wider than a
 * line on its own is split by `splitWord` and its rest carries on as the next
 * word. A word that cannot be split stays whole and sets `overflow`.
 */
export function breakLabel(
  label: string,
  width: number,
  measure: (text: string) => number,
): { lines: string[]; overflow: boolean } {
  const pending = label.split(/\s+/).filter(word => word !== '');
  const lines: string[] = [];
  let line = '';
  let overflow = false;
  while (pending.length > 0) {
    const word = pending.shift()!;
    const candidate = line === '' ? word : `${line} ${word}`;
    if (measure(candidate) <= width) {
      line = candidate;
    } else if (line !== '') {
      lines.push(line);
      line = '';
      pending.unshift(word);
    } else {
      const parts = splitWord(word, width, measure);
      if (parts === null) {
        lines.push(word);
        overflow = true;
      } else {
        lines.push(parts[0]);
        pending.unshift(parts[1]);
      }
    }
  }
  if (line !== '') lines.push(line);
  return { lines, overflow };
}

const unescapeXml = (text: string) =>
  text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * US-4.9 | AC-6; US-4.10 | AC-7: finds `<g id="<name>-<docId>">` (or
 * `<g id="<name>">` for maps with `option global`) and the index just after
 * its matching `</g>`. An empty group written self-closed by `XMLSerializer`
 * (`<g id="labels-…"/>`) is found too, with an empty inner range (#91).
 */
function findGroup(svg: string, name: string, docId: string): { start: number; innerStart: number; innerEnd: number; end: number } | null {
  const open = new RegExp(`<g id="${name}(?:-${docId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})?"(/?)>`).exec(svg);
  if (!open) return null;
  if (open[1] === '/') {
    const end = open.index + open[0].length;
    return { start: open.index, innerStart: end, innerEnd: end, end };
  }
  let depth = 1;
  const tags = /<(\/?)g\b[^>]*?(\/?)>/g;
  tags.lastIndex = open.index + open[0].length;
  for (let m = tags.exec(svg); m !== null; m = tags.exec(svg)) {
    if (m[2] === '/') continue;
    depth += m[1] === '/' ? -1 : 1;
    if (depth === 0) {
      return { start: open.index, innerStart: open.index + open[0].length, innerEnd: m.index, end: m.index + m[0].length };
    }
  }
  return null;
}

/**
 * US-4.9 | AC-1 to AC-6: tidies the labels of one map drawn by the plugin.
 *
 * Applies exactly these transforms (SCAR-001):
 *   1. removes the `coordinates` group (hex numbers) with everything in it;
 *   2. for every entry of the `labels` group — `<g>` + glow `<text>` + label
 *      `<text>` (the latter optionally inside `<a>`) — breaks the label into
 *      lines (`breakLabel`, width 80 % of the hex) and writes the same lines
 *      into both texts, centred on the hex: one line keeps the text and moves
 *      `y` to the centre; several lines become `<tspan x y>` with line height
 *      1.2 × the label's font size. All other attributes and the `<a>` stay.
 * A step whose group is missing or does not have this shape is skipped and
 * named in `skipped`; the labels are then left exactly as drawn.
 */
export function tidyMapLabels(
  svg: string,
  docId: string,
  measure: (text: string, fontSize: number) => number,
  horizontal: boolean,
): { svg: string; skipped: string[]; unbreakable: boolean } {
  const skipped: string[] = [];
  let out = svg;
  let unbreakable = false;

  const coords = findGroup(out, 'coordinates', docId);
  if (coords) {
    out = out.slice(0, coords.start) + out.slice(coords.end);
  } else {
    skipped.push('coordinates');
  }

  const geometry = horizontal ? HEX.pointy : HEX.flat;
  const lineWidth = geometry.width * LINE_WIDTH_SHARE;
  const labels = findGroup(out, 'labels', docId);
  const TEXT = String.raw`<text\b[^>]*>[^<]*<\/text>`;
  const ENTRY = new RegExp(String.raw`<g>(${TEXT})((?:<a\b[^>]*>)?)(${TEXT})((?:<\/a>)?)<\/g>`, 'y');
  if (!labels) {
    skipped.push('labels');
  } else {
    const inner = out.slice(labels.innerStart, labels.innerEnd);
    const rebuilt: string[] = [];
    let ok = true;
    ENTRY.lastIndex = 0;
    while (ENTRY.lastIndex < inner.length) {
      const m = ENTRY.exec(inner);
      if (!m || (m[2] === '') !== (m[4] === '')) {
        ok = false;
        break;
      }
      const [, glow, aOpen, text, aClose] = m;
      const label = unescapeXml(text.replace(/^<text\b[^>]*>|<\/text>$/g, ''));
      const attrs = text.match(/^<text\b([^>]*)>/)![1];
      const x = attrs.match(/\bx="([^"]+)"/)?.[1];
      const y = Number(attrs.match(/\by="([^"]+)"/)?.[1]);
      if (x === undefined || Number.isNaN(y)) {
        ok = false;
        break;
      }
      const size = fontSizeToUnits(attrs.match(/\bfont-size="([^"]+)"/)?.[1]);
      const centre = y - geometry.labelOffset;
      const broken = breakLabel(label, lineWidth, t => measure(t, size));
      unbreakable = unbreakable || broken.overflow;
      const n = broken.lines.length;
      const lineY = (k: number) => (centre + (k - (n + 1) / 2) * size * LINE_HEIGHT).toFixed(1);
      const rewrite = (el: string) => {
        const open = el.match(/^<text\b[^>]*>/)![0].replace(/\by="[^"]*"/, `y="${lineY(1)}"`);
        const body = n <= 1
          ? escapeXml(broken.lines[0] ?? '')
          : broken.lines.map((l, i) => `<tspan x="${x}" y="${lineY(i + 1)}">${escapeXml(l)}</tspan>`).join('');
        return `${open}${body}</text>`;
      };
      rebuilt.push(`<g>${rewrite(glow)}${aOpen}${rewrite(text)}${aClose}</g>`);
    }
    if (ok) {
      out = out.slice(0, labels.innerStart) + rebuilt.join('') + out.slice(labels.innerEnd);
    } else {
      skipped.push('labels');
    }
  }
  return { svg: out, skipped, unbreakable };
}

/** US-4.10: the switches a map's directive lines set. */
export interface MapDirectives {
  noOutlines: boolean;
  noGlow: boolean;
  /** Unknown words, each once, as first written (AC-2). */
  unknown: string[];
}

/**
 * US-4.10 | AC-1: a directive line — `#` in the first column, optional
 * spaces, `vault-compiler:` in any case, then the words.
 */
const DIRECTIVE_LINE = /^#\s*vault-compiler:(.*)$/i;

/**
 * US-4.10 | AC-1, AC-2: reads the directive lines of a map source.
 *
 * Words of all directive lines add up and are compared ignoring case;
 * `no-outlines` and `no-glow` switch, every other word is listed in `unknown`
 * once (by its lower-case form), in the spelling it first had. Lines with
 * leading spaces are no directive lines.
 */
export function parseMapDirectives(code: string): MapDirectives {
  const result: MapDirectives = { noOutlines: false, noGlow: false, unknown: [] };
  const seen = new Set<string>();
  for (const line of code.split('\n')) {
    const match = DIRECTIVE_LINE.exec(line.replace(/\r$/, ''));
    if (!match) continue;
    for (const word of match[1].trim().split(/\s+/).filter(w => w !== '')) {
      const key = word.toLowerCase();
      if (key === 'no-outlines') {
        result.noOutlines = true;
      } else if (key === 'no-glow') {
        result.noGlow = true;
      } else if (!seen.has(key)) {
        seen.add(key);
        result.unknown.push(word);
      }
    }
  }
  return result;
}

/**
 * US-4.10 | AC-4, AC-7: removes the glow `<text>` from every entry of the
 * `labels` and `path-labels` groups, or returns null — leaving the map as it
 * is — when a group is missing or an entry is not `<g>` + a first `<text>`
 * with `stroke="white"` + the rest. The label `<text>`, its `<a>`, `<tspan>`s
 * and `<textPath>` stay.
 */
function removeGlow(svg: string, docId: string): string | null {
  const ENTRY = /<g>(<text\b([^>]*)>(?:(?!<\/text>)[\s\S])*<\/text>)((?:(?!<\/g>)[\s\S])*)<\/g>/y;
  let out = svg;
  for (const name of ['path-labels', 'labels']) {
    const group = findGroup(out, name, docId);
    if (!group) return null;
    const inner = out.slice(group.innerStart, group.innerEnd);
    const rebuilt: string[] = [];
    ENTRY.lastIndex = 0;
    while (ENTRY.lastIndex < inner.length) {
      const m = ENTRY.exec(inner);
      if (!m || !/\bstroke="white"/.test(m[2])) return null;
      rebuilt.push(`<g>${m[3]}</g>`);
    }
    out = out.slice(0, group.innerStart) + rebuilt.join('') + out.slice(group.innerEnd);
  }
  return out;
}

/**
 * US-4.10 | AC-3 to AC-8: applies a map's directives to the SVG the plugin
 * drew (after tidying, before `prepareMapSvg`).
 *
 * Applies exactly these transforms (SCAR-001):
 *   1. `noOutlines`: removes the `regions` group with everything in it;
 *   2. `noGlow`: removes the glow `<text>` of every hex and path label.
 * A step whose groups do not have the measured shape is skipped for the whole
 * map and named in `skipped` (`no-outlines`, `no-glow`); with no directive
 * the SVG is returned unchanged.
 */
export function applyMapDirectives(
  svg: string,
  docId: string,
  directives: { noOutlines: boolean; noGlow: boolean },
): { svg: string; skipped: string[] } {
  const skipped: string[] = [];
  let out = svg;
  if (directives.noOutlines) {
    const regions = findGroup(out, 'regions', docId);
    if (regions) {
      out = out.slice(0, regions.start) + out.slice(regions.end);
    } else {
      skipped.push('no-outlines');
    }
  }
  if (directives.noGlow) {
    const without = removeGlow(out, docId);
    if (without === null) {
      skipped.push('no-glow');
    } else {
      out = without;
    }
  }
  return { svg: out, skipped };
}

/**
 * US-4.9 | AC-3: measures text with the map font on a canvas that is never
 * attached to the document (US-4.4 AC-3); sizes are in SVG user units (px).
 */
function canvasMeasure(family: string): (text: string, fontSize: number) => number {
  const context = document.createElement('canvas').getContext('2d');
  return (text, fontSize) => {
    if (!context) return text.length * fontSize * 0.5;
    context.font = `${fontSize}px ${family}`;
    return context.measureText(text).width;
  };
}

/**
 * US-4.5 | AC-8.1-W: Converts the SVG to PNG and writes it through the output
 * writer, which checks the path; an existing PNG is kept.
 */
async function writePngFromSvg(writer: OutputWriter, svg: string, destinationPath: string, width = 1024, height = 1024): Promise<void> {
  if (writer.exists(destinationPath)) return;
  const bytes = await svgToPngBytes(svg, width, height);
  await writer.writeBinaryIfAbsent(destinationPath, bytes);
}

async function svgToPngBytes(svg: string, width: number, height: number): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context unavailable');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => {
          if (!blob) {
            reject(new Error('PNG conversion failed'));
            return;
          }
          blob.arrayBuffer().then(resolve).catch(reject);
        }, 'image/png');
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => reject(new Error('SVG load failed'));
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  });
}
