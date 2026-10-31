import {
  slugify,
  titleFromBasename,
  tidyBlankLines,
  codeBlockMask,
  matchHeading,
  headingLevel,
  startsWithHeading,
  stripLeadingHeading,
  splitFrontmatter,
  isMarkdownFilename,
  computeContentHash,
  encodeAssetPath,
  normalizeAssetFilename,
} from './utils.ts';
import { altForTextMapper, buildPlaceholder, mapAssetName, parseMapAssetRef, parseMapDirectives } from './textmapper.ts';

/**
 * Interface for an external renderer that can convert a text-mapper code block
 * into a PNG asset in the vault.
 */
export interface TextMapperRenderer {
  /** Returns true when the renderer is ready (desktop runtime present, etc.). */
  isAvailable(): boolean;
  /**
   * Render `code` and write the PNG to `assetPath` inside the vault.
   * Should be idempotent: if the asset already exists this is a no-op.
   */
  render(code: string, assetPath: string): Promise<void>;
}

export interface CompilerOptions {
  enableTextMapper: boolean;
  assetFolder: string;
  resolve?: (raw: string, currentFile: string) => string | null;
  /** Optional renderer used by compileAsync to produce PNG assets for text-mapper blocks. */
  renderer?: TextMapperRenderer;
  /** When true, heading levels in embedded files are normalised according to their filename prefixes. */
  normaliseHeadings?: boolean;
  /** US-4.8 | AC-6: font key for map PNG names; absent → the default key of `mapAssetName`. */
  mapFontKey?: string;
}

/** US-6.3 | AC-4: what an embed needs to know about the line it sits on. */
interface EmbedContext {
  /** Depth of the embedding file (0 for the root file). */
  depth: number;
  /** Output level of the last original heading above this line; 0 if none. */
  lastOriginal: number;
  /** Line number in the embedding file's processed content, for warnings. */
  line: number;
}

/** US-6.5 | Definitions: the single embed of a pass-through wrapper. */
interface PassThrough {
  rawPath: string;
  target: string;
  anchor: string | null;
}

export interface WarningDetail {
  message: string;
  link: string;
  file: string;
  line: number;
}

export interface CompileResult {
  content: string;
  warnings: string[];
  warningDetails: WarningDetail[];
  stats: {
    filesProcessed: number;
    assetsCopied: number;
    assetsDeduplicated: number;
    missingReferences: number;
    mapsRendered?: number;
    mapsDeduplicated?: number;
  };
}

interface ResolvedTarget {
  path: string;
  anchor: string | null;
  missing: boolean;
}

export class InMemoryVaultCompiler {
  private files = new Map<string, string>();

  get sourceToAssetMap(): ReadonlyMap<string, string> {
    return this.sourceToAsset;
  }

  get assetNames(): ReadonlySet<string> {
    return this.usedAssetNames;
  }
  private options: CompilerOptions;
  private processedStack: string[] = [];
  private sourceToAsset = new Map<string, string>();
  private usedAssetNames = new Set<string>();
  private headingMap = new Map<string, string>();
  private warnings: string[] = [];
  private warningDetails: WarningDetail[] = [];
  private stats = {
    filesProcessed: 0,
    assetsCopied: 0,
    assetsDeduplicated: 0,
    missingReferences: 0,
  };

  constructor(files: Record<string, string>, options?: Partial<CompilerOptions>) {
    Object.entries(files).forEach(([path, content]) => this.files.set(this.norm(path), content));
    this.options = {
      enableTextMapper: true,
      assetFolder: 'assets',
      ...options,
    };
  }

  compile(startFile: string): CompileResult {
    const root = this.norm(startFile);
    if (!this.files.has(root)) {
      throw new Error(`Starting file not found: ${startFile}`);
    }
    const assembled = this.processMarkdown(root, false);
    const converted = this.sanitizeOutput(this.convertLinks(assembled));
    return {
      content: tidyBlankLines(this.stripSentinels(converted)),
      warnings: this.warnings,
      warningDetails: [...this.warningDetails],
      stats: { ...this.stats },
    };
  }

  /**
   * Like `compile`, but also invokes the optional `renderer` to produce PNG
   * assets for every text-mapper block.  Blocks with the same source hash are
   * only rendered once (deduplicated by hash). Falls back to an HTML comment
   * placeholder when the renderer is unavailable or throws.
   */
  async compileAsync(startFile: string): Promise<CompileResult> {
    const root = this.norm(startFile);
    if (!this.files.has(root)) {
      throw new Error(`Starting file not found: ${startFile}`);
    }

    const assembled = this.processMarkdown(root, false);
    const linked = this.convertLinks(assembled);

    // Collect all text-mapper asset references (assets/textmapper/<hash>_<key>.png)
    // and optionally render them.
    const renderer = this.options.renderer;
    let mapsRendered = 0;
    let mapsDeduplicated = 0;

    // Track which hashes we have already (attempted to) render so we don't
    // call the renderer twice for the same source block.
    const renderedHashes = new Set<string>();

    // Replace each image reference to a textmapper PNG with either the real
    // asset path (after rendering) or a placeholder comment.
    const processed = await this.replaceTextMapperRefs(linked, async (assetRef, code) => {
      // assetRef is e.g. "assets/textmapper/abc123_2cb44a0b.png" (US-4.8 AC-6).
      const parsed = parseMapAssetRef(assetRef);
      const hash = parsed ? `${parsed.hash}_${parsed.key}` : assetRef;

      if (renderedHashes.has(hash)) {
        mapsDeduplicated += 1;
        return assetRef; // already rendered; reuse the same asset path
      }
      renderedHashes.add(hash);

      if (!renderer || !renderer.isAvailable()) {
        this.warnings.push('Warning: TextMapper renderer not available');
        this.warningDetails.push({
          message: 'TextMapper renderer not available',
          link: assetRef,
          file: 'compiled-output',
          line: 0,
        });
        return buildPlaceholder(code, 'TextMapper renderer not available');
      }

      try {
        await renderer.render(code, assetRef);
        mapsRendered += 1;
        return assetRef;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.warnings.push(`Warning: TextMapper render failed: ${msg}`);
        this.warningDetails.push({
          message: `TextMapper render failed: ${msg}`,
          link: assetRef,
          file: 'compiled-output',
          line: 0,
        });
        return buildPlaceholder(code, msg);
      }
    });

    const sanitized = tidyBlankLines(this.stripSentinels(this.sanitizeOutput(processed)));
    return {
      content: sanitized,
      warnings: this.warnings,
      warningDetails: [...this.warningDetails],
      stats: { ...this.stats, mapsRendered, mapsDeduplicated },
    };
  }

  /**
   * Walk over `content` replacing each `![alt](assets/textmapper/<hash>_<key>.png)`
   * reference by calling `replacer(assetRef, code)`.  `code` is recovered from
   * the in-memory text-mapper source map built during processMarkdown.
   */
  private async replaceTextMapperRefs(
    content: string,
    replacer: (assetRef: string, code: string) => Promise<string>,
  ): Promise<string> {
    // Regex matches image embeds that point at a textmapper asset.
    const pattern = /!\[([^\]]*)\]\((assets\/textmapper\/[^)]+\.png)\)/g;
    const parts: (string | Promise<string>)[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(content)) !== null) {
      parts.push(content.slice(last, m.index));
      const alt = m[1];
      const assetRef = m[2];
      const code = this.textMapperSources.get(assetRef) ?? '';
      const replacement = replacer(assetRef, code).then(r => {
        // If the replacer returned a plain asset path, re-wrap as an image tag.
        if (r.startsWith('assets/')) {
          return `![${alt}](${r})`;
        }
        // Otherwise it's a placeholder / comment.
        return r;
      });
      parts.push(replacement);
      last = m.index + m[0].length;
    }
    parts.push(content.slice(last));
    return (await Promise.all(parts)).join('');
  }

  // Maps assetRef → original code block source so compileAsync can invoke the renderer.
  private textMapperSources = new Map<string, string>();

  private norm(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '');
  }

  private basename(path: string): string {
    const parts = this.norm(path).split('/');
    return parts[parts.length - 1];
  }

  private parent(path: string): string {
    const parts = this.norm(path).split('/');
    parts.pop();
    return parts.join('/');
  }

  private join(base: string, relative: string): string {
    if (relative.startsWith('/')) {
      return this.norm(relative);
    }
    const baseParts = this.norm(base).split('/').filter(Boolean);
    const relParts = relative.split('/');
    const result = [...baseParts];
    for (const part of relParts) {
      if (part === '' || part === '.') continue;
      if (part === '..') {
        result.pop();
      } else {
        result.push(part);
      }
    }
    return result.join('/');
  }

  private resolve(raw: string, currentFile: string): ResolvedTarget {
    if (this.options.resolve) {
      const resolvedPath = this.options.resolve(raw.trim(), currentFile);
      if (resolvedPath) {
        let anchor: string | null = null;
        let link = raw.trim();
        if (link.includes('#')) {
          const split = link.split('#');
          link = split[0];
          anchor = decodeURIComponent(split.slice(1).join('#'));
        }
        return { path: this.norm(resolvedPath), anchor, missing: false };
      }
    }

    let link = decodeURIComponent(raw.trim());
    let anchor: string | null = null;
    if (link.includes('#')) {
      const split = link.split('#');
      link = split[0];
      anchor = split.slice(1).join('#');
    }

    const currentDir = this.parent(currentFile);

    // Direct attempts.
    const directCandidates = [link, this.join(currentDir, link), this.join('', link)];
    for (const candidate of directCandidates) {
      const normalized = this.norm(candidate);
      if (this.files.has(normalized)) {
        return { path: normalized, anchor, missing: false };
      }
      // Case-insensitive exact.
      const exactInsensitive = [...this.files.keys()].find(k => k.toLowerCase() === normalized.toLowerCase());
      if (exactInsensitive) {
        return { path: exactInsensitive, anchor, missing: false };
      }
      // Append markdown extension for targets without a recognized extension.
      if (!/\.[A-Za-z0-9]+$/.test(normalized)) {
        const withMd = normalized + '.md';
        if (this.files.has(withMd)) {
          return { path: withMd, anchor, missing: false };
        }
      }
    }

    // Magic search by basename.
    let targetBase = this.basename(link) || link;
    if (!/\.[A-Za-z0-9]+$/.test(targetBase)) {
      targetBase += '.md';
    }
    const matches = [...this.files.keys()].filter(key => this.basename(key).toLowerCase() === targetBase.toLowerCase());
    if (matches.length > 0) {
      const chosen = [...matches].sort()[0];
      if (matches.length > 1) {
        this.warnings.push(`Warning: Ambiguous filename ${targetBase}; using ${chosen}`);
      }
      return { path: chosen, anchor, missing: false };
    }

    this.stats.missingReferences += 1;
    this.warnings.push(`Warning: Missing include`);
    return { path: link, anchor, missing: true };
  }

  /**
   * US-5.2 | AC-1: the text of a note as every rule sees it, with its YAML
   * frontmatter removed. The only place that reads note text from `files`
   * (a text check in the frontmatter tests keeps it so). `lines` is the
   * number of source lines removed, for warning line numbers (AC-12).
   */
  private readNote(path: string): { body: string; lines: number } {
    return splitFrontmatter(this.files.get(path)!);
  }

  private isMarkdownPath(path: string): boolean {
    return isMarkdownFilename(this.basename(path));
  }

  private assetTag(sourcePath: string, alt: string): string {
    if (this.sourceToAsset.has(sourcePath)) {
      const existing = this.sourceToAsset.get(sourcePath)!;
      this.stats.assetsDeduplicated += 1;
      return this.formatAsset(encodeAssetPath(existing), alt, sourcePath);
    }

    const base = this.basename(sourcePath);
    const normalizedBase = normalizeAssetFilename(base);
    let unique = normalizedBase;
    if (this.usedAssetNames.has(unique)) {
      const { stem, ext } = splitExtensionForUnique(normalizedBase);
      let i = 1;
      while (this.usedAssetNames.has(`${stem}_${i}${ext}`)) {
        i += 1;
      }
      unique = `${stem}_${i}${ext}`;
    }
    this.usedAssetNames.add(unique);
    const assetRef = `${this.options.assetFolder}/${unique}`;
    this.sourceToAsset.set(sourcePath, assetRef);
    this.stats.assetsCopied += 1;
    return this.formatAsset(encodeAssetPath(assetRef), alt, sourcePath);
  }

  private formatAsset(assetRef: string, alt: string, sourcePath: string): string {
    const lower = sourcePath.toLowerCase();
    if (/\.(png|jpg|jpeg|gif|svg|webp|bmp|ico)$/.test(lower)) {
      return `![${alt}](${assetRef})`;
    }
    if (/\.(mp4|avi|mov|mkv|webm)$/.test(lower)) {
      const mime = lower.endsWith('.mp4') ? 'video/mp4' : 'video/*';
      return `<video controls><source src="${assetRef}" type="${mime}"></video>`;
    }
    if (/\.(mp3|wav|ogg|flac|aac)$/.test(lower)) {
      const mime = lower.endsWith('.mp3') ? 'audio/mp3' : 'audio/*';
      return `<audio controls><source src="${assetRef}" type="${mime}"></audio>`;
    }
    if (lower.endsWith('.pdf')) {
      return `<a href="${assetRef}">Open PDF</a>`;
    }
    return `<a href="${assetRef}">Download ${this.basename(sourcePath)}</a>`;
  }

  private processMarkdown(
    path: string,
    autoHeading: boolean,
    parentDepth = 0,
    lastOriginalHeadingLevelInParent = 0,
    forcedDepth: number | null = null,
  ): string {
    if (!this.files.has(path)) {
      this.stats.missingReferences += 1;
      this.warnings.push(`Warning: Missing include`);
      return `\n<!-- Warning: Missing include -->\n`;
    }

    if (this.processedStack.includes(path)) {
      return `\n<!-- Circular dependency avoided: ${this.basename(path)} -->\n`;
    }

    this.processedStack.push(path);
    this.stats.filesProcessed += 1;

    const note = this.readNote(path);
    let content = note.body;
    // US-5.2 AC-12: added to embed warning lines so they count source lines.
    let lineOffset = note.lines;
    try {
      // Basic readability check.
      // eslint-disable-next-line no-control-regex
      if (content.match(/[\x00-\x08]/)) {
        throw new Error('binary');
      }
    } catch {
      this.warnings.push(`Warning: Unreadable file: ${this.basename(path)}`);
      this.processedStack.pop();
      return `\n<!-- Warning: Unreadable file: ${this.basename(path)} -->\n`;
    }

    const originalFirstIsHeading = startsWithHeading(content);

    // TextMapper rendering.
    if (this.options.enableTextMapper) {
      content = this.processTextMapperFences(content, (code) => {
        const alt = altForTextMapper(code);
        const hash = computeContentHash(code);
        const filename = mapAssetName(hash, this.options.mapFontKey);
        const assetRef = `${this.options.assetFolder}/textmapper/${filename}`;
        // Record the source so compileAsync can pass it to the renderer.
        this.textMapperSources.set(assetRef, code);
        // US-4.10 | AC-2: one warning per block occurrence and unknown word.
        for (const word of parseMapDirectives(code).unknown) {
          const message = `Map directive "${word}" is unknown and was ignored`;
          this.warnings.push(`Warning: ${message}`);
          this.warningDetails.push({ message, link: word, file: path, line: 0 });
        }
        return `![${alt}](${assetRef})`;
      });
    } else {
      // Keep the raw fence but add a warning comment so readers know rendering is disabled.
      content = this.processTextMapperFences(content, (code) => {
        return `\`\`\`text-mapper\n${code}\n\`\`\`\n<!-- Warning: TextMapper rendering is disabled -->`;
      });
    }

    // Remove Obsidian control command fences.
    const controlLanguages = [
      'meta-bind-embed',
      'leaflet',
      'calendarium',
      'compressed-json',
      'dataview',
      'dataviewjs',
    ];
    for (const lang of controlLanguages) {
      const fence = new RegExp('```' + lang.replace(/-/g, '\\-') + '[\\s\\S]*?```', 'g');
      content = content.replace(fence, '');
    }

    // Remove SerializedQuery comment delimiters while preserving their listed
    // embeds for expansion.
    // Remove Dataview Serializer command markers.
    content = content.replace(/<!--\s*QueryToSerialize:[\s\S]*?-->/g, '');

    // Remove SerializedQuery and Dataview Serializer markers while keeping
    // their nested list entries available for ToC expansion.
    content = content.replace(/<!--\s*QueryToSerialize:[\s\S]*?-->/g, '');
    content = content.replace(/<!--\s*SerializedQuery:[\s\S]*?-->/g, '');

    let inSerializedQuery = false;
    content = content
      .split('\n')
      .map(line => {
        if (/SerializedQuery|QueryToSerialize/i.test(line)) {
          inSerializedQuery = true;
          if (line.includes('-->')) {
            inSerializedQuery = false;
          }
          return '';
        }
        if (inSerializedQuery && line.trim() === '-->') {
          inSerializedQuery = false;
          return '';
        }
        return line;
      })
      .join('\n');

    // Expand simple ToC lists into embeds.
    // First, collect all files that are already explicitly embedded (via ![[...]] or ![alt](file.md))
    // so we can skip bare [[link]] list items that would otherwise duplicate an embed.
    const explicitEmbeds = new Set<string>();
    // Pre-scan: collect explicitly-embedded paths without counting missing refs.
    // Save and restore the counter so this read-only scan doesn't pollute stats.
    const _savedMissing = this.stats.missingReferences;
    content.replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (_, link: string) => {
      const r = this.resolve(link.trim(), path);
      if (!r.missing) explicitEmbeds.add(r.path);
      return '';
    });
    content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_: string, _alt: string, rawPath: string) => {
      const r = this.resolve(rawPath, path);
      if (!r.missing && this.isMarkdownPath(r.path)) explicitEmbeds.add(r.path);
      return '';
    });
    this.stats.missingReferences = _savedMissing; // restore — scan is read-only

    content = this.expandTocLists(content, path, explicitEmbeds);

    // ── Heading normalisation (applied before embed expansion) ──────────────────────
    // When normaliseHeadings is on, compute this file's depth and rewrite its
    // own headings before expanding embeds, so only this file's headings are
    // touched, not the already-normalised embedded content.
    const normalise = this.options.normaliseHeadings === true;
    let effectiveDepth = 0;
    let titleInjected = false; // the first heading line of `content` is this file's title

    if (normalise && autoHeading) {
      const base = this.basename(path);
      const depth = forcedDepth ?? this.fileDepth(base, path, parentDepth, lastOriginalHeadingLevelInParent);

      // US-6.5: a wrapper around one embed adds no heading of its own.
      const passThrough = this.matchPassThrough(content, path);
      if (passThrough !== null) {
        const expanded = this.expandPassThrough(passThrough, path, depth);
        this.processedStack.pop();
        return this.wrapWithSentinel(expanded, path);
      }

      const { content: normContent, clamped, title } = this.applyHeadingNormalisation(content, depth, path);
      // An injected (not replacing) title adds a line above the source text.
      lineOffset -= normContent.split('\n').length - content.split('\n').length;
      content = normContent;
      this.headingMap.set(path, title);
      effectiveDepth = Math.min(6, depth);
      titleInjected = true;
      if (clamped) {
        const message = `Heading depth clamped to h6 in ${base}`;
        this.warnings.push(`Warning: ${message}`);
        this.warningDetails.push({ message, link: base, file: path, line: 0 });
      }
    }

    // Expand embeds line by line, so each embed sees the last ORIGINAL heading
    // above its own line (US-6.3 AC-4, US-6.4 AC-10). Headings arriving from
    // embeds never update the tracker because they are inserted, not scanned;
    // the file's own title is skipped.
    {
      let lastOriginal = 0;
      let skipTitle = titleInjected;
      const contentLines = content.split('\n');
      const inCode = codeBlockMask(contentLines);
      content = contentLines.map((line, index) => {
        // KD-3: a line inside a code block is never a heading.
        const heading = inCode[index] ? null : matchHeading(line);
        if (heading) {
          if (skipTitle) skipTitle = false;
          else lastOriginal = heading.level;
        }
        const context: EmbedContext = { depth: effectiveDepth, lastOriginal, line: index + 1 + lineOffset };
        const withWiki = this.processWikiEmbeds(line, path, context);
        return this.processMarkdownEmbeds(withWiki, path, context);
      }).join('\n');
    }

    if (autoHeading && !normalise) {
      // US-6.1: one filename heading per embedded file when normalisation is off.
      const base = this.basename(path);
      const title = titleFromBasename(base);
      const heading = `${'#'.repeat(headingLevel(base))} ${title}`;
      this.headingMap.set(path, title);
      let body = content;
      if (originalFirstIsHeading) {
        body = stripLeadingHeading(body);
      }
      content = `${heading}\n\n${body.trim()}\n`;
    } else if (!this.headingMap.has(path)) {
      this.headingMap.set(path, titleFromBasename(this.basename(path)));
    }

    this.processedStack.pop();
    // Wrap with provenance sentinel so post-assembly passes can attribute
    // warnings to the correct vault file (stripped from the final output).
    return this.wrapWithSentinel(content, path);
  }


  /**
   * US-1.3 | AC-2: resolves a link without side effects — the missing-reference
   * count and the warnings `resolve` may add are put back. Used to classify
   * list items; the real passes report missing targets themselves.
   */
  private probeResolve(raw: string, currentFile: string): ResolvedTarget {
    const missingBefore = this.stats.missingReferences;
    const warningsBefore = this.warnings.length;
    const result = this.resolve(raw, currentFile);
    this.stats.missingReferences = missingBefore;
    this.warnings.length = warningsBefore;
    return result;
  }

  /**
   * US-1.3 | Definitions: classifies one list-item line.
   *
   * - `embed`: `![[t]]` / `![alt](t)`; `text` is the embed without bullet
   *   (a wiki alias is dropped, as before 2026-10-27).
   * - `link`: `[[t]]`, `[[t|alias]]` or `[x](t)` whose target is a note;
   *   `text` is the link, which becomes an embed with a leading `!`.
   * - `other`: anything else (text, several links, websites, missing notes,
   *   non-note files).
   * `note` is true when the target resolves to a markdown note.
   */
  private classifyTocItem(line: string, currentFile: string): {
    kind: 'embed' | 'link' | 'other'; indent: string; text: string; target: string; note: boolean; line: string;
  } {
    const match = line.match(/^(\s*)(?:[-*]|\d+\.)\s+(.*)$/)!;
    const indent = match[1];
    const rest = match[2].trim();
    const isNote = (raw: string) => {
      const r = this.probeResolve(raw, currentFile);
      return { note: !r.missing && this.isMarkdownPath(r.path), target: r.path };
    };
    const embedWiki = rest.match(/^!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]$/);
    if (embedWiki) {
      return { kind: 'embed', indent, text: `![[${embedWiki[1]}]]`, line, ...isNote(embedWiki[1].trim()) };
    }
    const embedMd = rest.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (embedMd) {
      return { kind: 'embed', indent, text: `![${embedMd[1]}](${embedMd[2]})`, line, ...isNote(embedMd[2]) };
    }
    const wiki = rest.match(/^\[\[([^\]]+)\]\]$/);
    if (wiki) {
      const probe = isNote(wiki[1].split('|')[0].trim());
      return { kind: probe.note ? 'link' : 'other', indent, text: `[[${wiki[1]}]]`, line, ...probe };
    }
    const md = rest.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
    if (md && !/^(?:https?:|mailto:|#)/i.test(md[2].trim())) {
      const probe = isNote(md[2].trim());
      return { kind: probe.note ? 'link' : 'other', indent, text: `[${md[1]}](${md[2]})`, line, ...probe };
    }
    return { kind: 'other', indent, text: rest, target: '', note: false, line };
  }

  /**
   * US-1.3 | AC-1 to AC-5: turns ToC lists into embeds.
   *
   * A list is a run of consecutive list-item lines. When every item is an
   * embed of a note or a link to a note (either syntax), each link item
   * becomes an embed in place, keeping its indentation and dropping the
   * bullet — unless this file already embeds that note explicitly (AC-5).
   * Otherwise link items stay as written. Embed items lose their bullet in any
   * list.
   */
  private expandTocLists(content: string, currentFile: string, explicitEmbeds: Set<string>): string {
    const ITEM = /^\s*(?:[-*]|\d+\.)\s+/;
    const lines = content.split('\n');
    const out: string[] = [];
    let i = 0;
    while (i < lines.length) {
      if (!ITEM.test(lines[i])) {
        out.push(lines[i]);
        i += 1;
        continue;
      }
      const run: string[] = [];
      while (i < lines.length && ITEM.test(lines[i])) run.push(lines[i++]);
      const items = run.map(line => this.classifyTocItem(line, currentFile));
      const isToc = items.every(item => item.kind !== 'other' && item.note);
      for (const item of items) {
        if (item.kind === 'embed') {
          out.push(`${item.indent}${item.text}`);
        } else if (item.kind === 'link' && isToc && !explicitEmbeds.has(item.target)) {
          out.push(`${item.indent}!${item.text}`);
        } else {
          out.push(item.line);
        }
      }
    }
    return out.join('\n');
  }

  // ── Provenance sentinel helpers ─────────────────────────────────────────────
  // A begin/end sentinel pair is injected around each vault file's content block
  // so post-assembly passes (convertLinks, sanitizeOutput) can attribute warnings
  // to the correct source file rather than 'compiled-output'.
  // Sentinels are stripped from the final CompileResult.content.

  private static readonly SB = '<!-- __vs__:';  // sentinel begin prefix
  private static readonly SE = '<!-- __ve__:';  // sentinel end   prefix
  private static readonly SS = ' -->';           // sentinel suffix

  private wrapWithSentinel(content: string, path: string): string {
    const b = InMemoryVaultCompiler.SB + path + InMemoryVaultCompiler.SS;
    const e = InMemoryVaultCompiler.SE + path + InMemoryVaultCompiler.SS;
    return `${b}\n${content}\n${e}`;
  }

  /**
   * Given the assembled content string and a character offset within it, return
   * the vault file path and approximate line number for that position by
   * consulting the nearest enclosing provenance sentinel pair.
   */
  private findSourceLocation(content: string, offset: number): { file: string; line: number } {
    const beginRe = /<!-- __vs__:(.*?) -->/g;
    const endRe   = /<!-- __ve__:(.*?) -->/g;

    type Ev = { pos: number; kind: 'b' | 'e'; path: string };
    const evs: Ev[] = [];

    let m: RegExpExecArray | null;
    while ((m = beginRe.exec(content)) !== null) {
      evs.push({ pos: m.index, kind: 'b', path: m[1] });
    }
    while ((m = endRe.exec(content)) !== null) {
      evs.push({ pos: m.index, kind: 'e', path: m[1] });
    }
    evs.sort((a, b) => a.pos - b.pos);

    // Simulate a stack up to (but not past) the target offset.
    const stack: string[] = [];
    for (const ev of evs) {
      if (ev.pos >= offset) break;
      if (ev.kind === 'b') {
        stack.push(ev.path);
      } else {
        const top = stack.lastIndexOf(ev.path);
        if (top !== -1) stack.splice(top, 1);
      }
    }

    const file = stack[stack.length - 1] ?? 'compiled-output';

    // Compute approximate line within this file's sentinel block.
    if (file !== 'compiled-output') {
      const beginTag = InMemoryVaultCompiler.SB + file + InMemoryVaultCompiler.SS + '\n';
      let search = 0;
      let lastBegin = -1;
      while (true) {
        const p = content.indexOf(beginTag, search);
        if (p === -1 || p >= offset) break;
        lastBegin = p;
        search = p + 1;
      }
      if (lastBegin >= 0) {
        const sectionStart = lastBegin + beginTag.length;
        const line = content.slice(sectionStart, offset).split('\n').length;
        return { file, line };
      }
    }

    return { file: 'compiled-output', line: content.slice(0, offset).split('\n').length };
  }

  /** Strip all provenance sentinel comments from assembled content. */
  private stripSentinels(content: string): string {
    return content
      .replace(/<!-- __vs__:.*? -->\n?/g, '')
      .replace(/\n?<!-- __ve__:.*? -->/g, '');
  }


  /**
   * Process text-mapper fenced code blocks line by line.
   * Handles CRLF endings, empty blocks, and blocks nested inside other fences.
   * Calls `onBlock(code)` for each block and replaces the whole fence with the result.
   */
  private processTextMapperFences(
    content: string,
    onBlock: (code: string) => string
  ): string {
    const rawLines = content.split('\n');
    const result: string[] = [];
    let outerFenceLen = 0;  // >0 means we are inside a non-text-mapper fence
    let outerFenceChar = '';
    let inTm = false;
    let tmLines: string[] = [];

    for (const rawLine of rawLines) {
      const line = rawLine.replace(/\r$/, '');  // strip CRLF \r

      if (inTm) {
        const closeMatch = line.match(/^(`{3,})\s*$/);
        if (closeMatch && closeMatch[1].length === 3) {
          inTm = false;
          result.push(onBlock(tmLines.join('\n')));
          tmLines = [];
        } else {
          tmLines.push(line);
        }
        continue;
      }

      if (outerFenceLen > 0) {
        // Inside a non-text-mapper fence — watch for its closing line
        const closeMatch = line.match(/^(`{3,}|~{3,})\s*$/);
        if (closeMatch) {
          const ch = closeMatch[1][0];
          const len = closeMatch[1].length;
          if (ch === outerFenceChar && len >= outerFenceLen) {
            outerFenceLen = 0;
            outerFenceChar = '';
          }
        }
        result.push(rawLine);
        continue;
      }

      // Not inside any fence — check for a new one
      const fenceMatch = line.match(/^(`{3,}|~{3,})(\S*)/);
      if (fenceMatch) {
        const backticks = fenceMatch[1];
        const lang = fenceMatch[2];
        if (backticks[0] === '`' && backticks.length === 3 && lang === 'text-mapper') {
          // Start of a text-mapper block — consume the opening line
          inTm = true;
          tmLines = [];
        } else {
          // Start of a non-text-mapper outer fence
          outerFenceLen = backticks.length;
          outerFenceChar = backticks[0];
          result.push(rawLine);
        }
        continue;
      }

      result.push(rawLine);
    }

    // Unclosed text-mapper fence at EOF — pass through unchanged
    if (inTm) {
      result.push('```text-mapper');
      result.push(...tmLines);
    }

    return result.join('\n');
  }

  /**
   * Parse the numeric prefix depth from a filename.
   * e.g. "1.3.2 Magic.md" → 3, "01.03 Rules.md" → 2, "Overview.md" → null.
   * Leading zeros are accepted (01 counts as one segment).
   */
  private parsePrefixDepth(filename: string): number | null {
    const base = this.basename(filename);
    const noExt = base.replace(/\.[^.]+$/, '');
    const prefixMatch = noExt.match(/^(\d+(?:\.\d+)*)(?:\s|$)/);
    if (!prefixMatch) return null;
    const segments = prefixMatch[1].split('.');
    return segments.length > 0 ? segments.length : null;
  }

  /**
   * US-6.3 | AC-3, AC-4, AC-9: the depth of an embedded file.
   *
   * A prefixed file is placed at its prefix depth, but never shallower than
   * `parentDepth + 1` (floor clamp, recorded as a warning). An unprefixed file
   * goes one level below the last original heading above the embed, or one
   * below the embedding file when there is none (OD-2).
   */
  private fileDepth(base: string, path: string, parentDepth: number, lastOriginal: number): number {
    const prefixDepth = this.parsePrefixDepth(base);
    if (prefixDepth === null) {
      return lastOriginal > 0 ? lastOriginal + 1 : parentDepth + 1;
    }
    if (prefixDepth < parentDepth + 1) {
      const clampedTo = parentDepth + 1;
      const message = `Heading depth clamped: ${base} prefix depth ${prefixDepth} < parent depth ${parentDepth + 1}, clamped to ${clampedTo}`;
      this.warnings.push(`Warning: ${message}`);
      this.warningDetails.push({ message, link: base, file: path, line: 0 });
      return clampedTo;
    }
    return prefixDepth;
  }

  /**
   * US-6.3 | AC-6, US-6.4 | AC-1 to AC-7: rewrite a file's own headings for `depth`.
   *
   * - Heading-first file: its first heading is replaced by the file's title at
   *   `depth` (OD-1); every other heading shifts by `depth − level of the
   *   replaced heading`.
   * - Preamble or headingless file: the title is put before the content at
   *   `depth`; internal headings shift so the first one lands at `depth + 1`.
   * Levels are clamped to h1–h6; `clamped` is true when anything went past h6.
   * The title comes from `titleFromBasename` (US-6.4 title rule).
   */
  private applyHeadingNormalisation(
    content: string,
    depth: number,
    filePath: string,
  ): { content: string; clamped: boolean; title: string } {
    const lines = content.split('\n');
    const inCode = codeBlockMask(lines);
    const title = titleFromBasename(this.basename(filePath));
    let clamped = depth > 6;
    const titleHeading = '#'.repeat(Math.min(6, Math.max(1, depth))) + ' ' + title;
    // KD-3: lines inside code blocks are never headings and never shifted.
    const headingAt = (i: number) => (inCode[i] ? null : matchHeading(lines[i]));
    const shiftLine = (i: number, shift: number): string => {
      const h = headingAt(i);
      if (!h) return lines[i];
      const raw = h.level + shift;
      if (raw > 6) clamped = true;
      return '#'.repeat(Math.min(6, Math.max(1, raw))) + h.rest;
    };

    const firstNonEmpty = lines.findIndex(l => l.trim() !== '');
    const firstHeading = lines.findIndex((_, i) => headingAt(i) !== null);

    if (firstHeading !== -1 && firstHeading === firstNonEmpty) {
      // Heading-first: the title takes the first heading's place.
      const shift = depth - headingAt(firstHeading)!.level;
      const newLines = lines.map((_, i) => (i === firstHeading ? titleHeading : shiftLine(i, shift)));
      return { content: newLines.join('\n'), clamped, title };
    }

    if (firstHeading === -1) {
      // Headingless: prepend the title only.
      return { content: titleHeading + '\n' + content, clamped, title };
    }

    // Preamble with internal headings: first internal heading → depth + 1.
    const shift = depth + 1 - headingAt(firstHeading)!.level;
    return { content: titleHeading + '\n' + lines.map((_, i) => shiftLine(i, shift)).join('\n'), clamped, title };
  }

  /**
   * US-6.3 | AC-7, US-6.5 | AC-6: move a section so its shallowest heading
   * lands at `depth`, up or down (OD-3); the other headings keep their
   * distance to it. Levels are clamped to h1–h6, and going past h6 records a
   * warning naming `label`. Heading text is never changed.
   */
  private shiftSectionTo(section: string, depth: number, label: string, warnFile: string): string {
    const lines = section.split('\n');
    const inCode = codeBlockMask(lines);
    // KD-3: lines inside code blocks are never headings and never shifted.
    const headings = lines.map((l, i) => (inCode[i] ? null : matchHeading(l)));
    const levels = headings.filter(h => h !== null).map(h => h!.level);
    if (levels.length === 0) return section;

    const shift = depth - Math.min(...levels);
    let clamped = false;
    const shifted = lines.map((line, i) => {
      const h = headings[i];
      if (!h) return line;
      const raw = h.level + shift;
      if (raw > 6) clamped = true;
      return '#'.repeat(Math.min(6, Math.max(1, raw))) + h.rest;
    }).join('\n');
    if (clamped) {
      const message = `Heading depth clamped to h6 in ${label}`;
      this.warnings.push(`Warning: ${message}`);
      this.warningDetails.push({ message, link: label, file: warnFile, line: 0 });
    }
    return shifted;
  }

  /**
   * US-6.5 | Definitions: returns the wrapped embed when `content` is a
   * pass-through wrapper, otherwise null.
   *
   * A wrapper is exactly one markdown embed (wiki or markdown syntax, with or
   * without anchor) once whitespace is ignored. It is a pass-through when the
   * embed is an anchor embed or its target is effectively heading-first.
   */
  private matchPassThrough(content: string, path: string): PassThrough | null {
    const trimmed = content.trim();
    const wiki = trimmed.match(/^!\[\[([^\]|#]+)(?:#([^\]|]*))?(?:\|[^\]]*)?\]\]$/s);
    const md = trimmed.match(/^!\[[^\]]*\]\(([^)#]+\.md)(?:#([^)]*))?\)$/s);
    const match = wiki ?? md;
    if (!match) return null;

    const rawPath = match[1].trim();
    const anchor = match[2] != null ? match[2].trim() : null;
    const resolved = this.resolve(rawPath, path);
    if (resolved.missing || !this.isMarkdownPath(resolved.path)) return null;
    if (anchor === null && !this.isEffectivelyHeadingFirst(resolved.path)) return null;
    return { rawPath, target: resolved.path, anchor };
  }

  /**
   * US-6.5 | AC-1, AC-6 to AC-8, "What the pass-through produces" (OD-6):
   * expand a pass-through at the wrapper's `depth`.
   *
   * A whole-file target is processed as if embedded directly at `depth`: its
   * own prefix is not consulted and its title replaces its first heading. An
   * anchor target is the named section moved to `depth` with its text kept.
   * The wrapper's link anchor is the heading the pass-through shows.
   */
  private expandPassThrough(pt: PassThrough, path: string, depth: number): string {
    const base = this.basename(path);
    if (pt.anchor === null) {
      const inner = this.processMarkdown(pt.target, true, depth - 1, 0, depth);
      this.headingMap.set(path, this.headingMap.get(pt.target) ?? titleFromBasename(this.basename(pt.target)));
      return inner;
    }

    const raw = this.processMarkdown(pt.target, false).replace(/<!-- __v[se]__:[^\s>]+ -->/g, '');
    const section = this.extractSection(raw, pt.anchor);
    if (section === null) {
      const message = `Missing heading anchor: ${pt.target}#${pt.anchor}`;
      this.warnings.push(`Warning: ${message}`);
      this.warningDetails.push({ message, link: pt.rawPath, file: path, line: 0 });
      return '';
    }
    // The section starts with its anchor heading (never inside a code block).
    const shown = section.split('\n').map(l => matchHeading(l)).find(h => h !== null);
    this.headingMap.set(path, shown ? shown.rest.trim() : titleFromBasename(base));
    return '\n' + this.shiftSectionTo(section, depth, base, path) + '\n';
  }

  /**
   * US-6.3 | AC-4, AC-7: the depth a section embed's shallowest heading lands
   * at — one below the last original heading above the embed, else one below
   * the embedding file.
   */
  private sectionDepth(context: EmbedContext): number {
    return context.lastOriginal > 0 ? context.lastOriginal + 1 : context.depth + 1;
  }

  /**
   * Parse the numeric prefix depth from a filename.
   * e.g. "1.3.2 Magic.md" → 3, "01.03 Rules.md" → 2, "Overview.md" → null.
   * Leading zeros are accepted (01 counts as one segment).
   */
  /**
   * Returns true if the given vault file (by resolved path) is "effectively
   * heading-first": its first non-empty line is a heading, OR it is itself a
   * pass-through (single embed) whose target is recursively effectively heading-first.
   * Anchor embeds are trivially heading-first by definition.
   * Uses its own visited-set guard (does NOT touch processedStack).
   */
  private isEffectivelyHeadingFirst(filePath: string, visited: Set<string> = new Set()): boolean {
    if (!this.files.has(filePath)) return false;
    if (visited.has(filePath)) return false;

    const raw = this.readNote(filePath).body;
    const firstNonEmpty = raw.split('\n').find(l => l.trim() !== '');
    if (firstNonEmpty === undefined) return false;
    if (matchHeading(firstNonEmpty) !== null) return true;

    // Not heading-first on its own — check if it is a pass-through.
    const trimmed = raw.trim();
    const wikiM = trimmed.match(/^!\[\[([^\]|#]+)(?:#([^\]|]*))?(?:\|[^\]]*)?\]\]$/s);
    const mdM   = trimmed.match(/^!\[[^\]]*\]\(([^)#]+\.md)(?:#([^)]*))?\)$/s);

    if (!wikiM && !mdM) return false;

    const targetRaw  = wikiM ? wikiM[1].trim() : mdM![1].trim();
    const hasAnchor  = wikiM ? wikiM[2] != null : mdM![2] != null;

    if (hasAnchor) return true; // anchor embed is trivially heading-first

    const resolved = this.resolve(targetRaw, filePath);
    if (resolved.missing || !this.isMarkdownPath(resolved.path)) return false;

    visited.add(filePath);
    return this.isEffectivelyHeadingFirst(resolved.path, visited);
  }

  /**
   * US-1.2 | Recursive embedding; US-6.3 | AC-4, AC-7: expand the wiki embeds
   * of one source line. `context` carries the embedding file's depth, the last
   * original heading above this line and the line number for warnings.
   */
  private processWikiEmbeds(content: string, currentFile: string, context: EmbedContext): string {
    return content.replace(/!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_m, rawLink, display) => {
      const link = rawLink.trim();
      const resolved = this.resolve(link, currentFile);
      if (resolved.missing) {
        const line = context.line;
        const message = `Missing include`;
        this.warnings.push(`Warning: ${message}`);
        this.warningDetails.push({ message, link, file: currentFile, line });
        return `\n<!-- Warning: Missing include -->\n`;
      }
      if (this.isMarkdownPath(resolved.path)) {
        if (resolved.anchor !== null) {
          // Heading-anchored embed: process the whole file without auto-heading so
          // original headings are preserved, then slice out only the matching section.
          const processed = this.processMarkdown(resolved.path, false);
          let section = this.extractSection(processed, resolved.anchor);
          if (section === null) {
            const lineNum = context.line;
            const anchorRef = `${resolved.path}#${resolved.anchor}`;
            const message = `Missing heading anchor: ${anchorRef}`;
            this.warnings.push(`Warning: ${message}`);
            this.warningDetails.push({ message, link: anchorRef, file: currentFile, line: lineNum });
            return `\n<!-- Warning: ${message} -->\n`;
          }
          if (this.options.normaliseHeadings === true) {
            section = this.shiftSectionTo(section, this.sectionDepth(context), this.basename(resolved.path), currentFile);
          }
          return `\n${section}\n`;
        }
        return this.processMarkdown(resolved.path, true, context.depth, context.lastOriginal);
      }
      const alt = display ? display.trim() : '';
      return this.assetTag(resolved.path, alt);
    });
  }

  /**
   * Given fully-processed markdown content (which may contain provenance sentinels)
   * and a heading anchor string, extract the lines from the matching heading up to
   * (but not including) the next heading of equal or higher level.
   *
   * Heading text matching is case-insensitive. Returns null when no heading matches.
   */
  private extractSection(content: string, anchor: string): string | null {
    const lines = content.split('\n');
    const inCode = codeBlockMask(lines);
    const normalizedAnchor = anchor.toLowerCase().trim();

    let startIdx = -1;
    let targetLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      // Ignore provenance sentinel comment lines
      if (/<!-- __v[se]__:[^\s>]+ -->/.test(lines[i])) continue;

      // KD-3: a line inside a code block is never a heading.
      const heading = inCode[i] ? null : matchHeading(lines[i]);
      if (heading && heading.rest.trim() !== '') {
        const level = heading.level;
        const text = heading.rest.trim().toLowerCase();
        if (startIdx === -1 && text === normalizedAnchor) {
          startIdx = i;
          targetLevel = level;
        } else if (startIdx !== -1 && level <= targetLevel) {
          // Next heading of equal or higher importance — stop here
          return lines.slice(startIdx, i).join('\n').trim();
        }
      }
    }

    if (startIdx === -1) return null; // anchor not found
    return lines.slice(startIdx).join('\n').trim();
  }

  /**
   * US-1.2 | Recursive embedding (markdown syntax); US-6.3 | AC-4, AC-7: the
   * markdown-syntax twin of `processWikiEmbeds`, with the same `context`.
   */
  private processMarkdownEmbeds(content: string, currentFile: string, context: EmbedContext): string {
    return content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, rawPath) => {
      // Already-processed asset references (e.g. assets/shared.png from a prior embed pass) — pass through
      // without re-resolving, so the same source is not re-registered by the magic basename search.
      if (/^(?:\.\.\/|\.\/)?assets\//.test(rawPath)) {
        return _m;
      }
      const resolved = this.resolve(rawPath, currentFile);
      if (resolved.missing) {
        if (this.usedAssetNames.has(this.basename(rawPath))) {
          return _m;
        }
        const line = context.line;
        const message = `Missing asset`;
        this.warnings.push(`Warning: ${message}`);
        this.warningDetails.push({ message, link: rawPath, file: currentFile, line });
        return `<!-- Warning: Missing asset -->`;
      }
      if (this.isMarkdownPath(resolved.path)) {
        if (resolved.anchor !== null) {
          // Heading-anchored embed: extract only the matching section.
          const processed = this.processMarkdown(resolved.path, false);
          let section = this.extractSection(processed, resolved.anchor);
          if (section === null) {
            const lineNum = context.line;
            const anchorRef = `${resolved.path}#${resolved.anchor}`;
            const message = `Missing heading anchor: ${anchorRef}`;
            this.warnings.push(`Warning: ${message}`);
            this.warningDetails.push({ message, link: anchorRef, file: currentFile, line: lineNum });
            return `\n<!-- Warning: ${message} -->\n`;
          }
          if (this.options.normaliseHeadings === true) {
            section = this.shiftSectionTo(section, this.sectionDepth(context), this.basename(resolved.path), currentFile);
          }
          return `\n${section}\n`;
        }
        return this.processMarkdown(resolved.path, true, context.depth, context.lastOriginal);
      }
      return this.assetTag(resolved.path, alt);
    });
  }

  private sanitizeOutput(content: string): string {
    const portable = (target: string) =>
      target.startsWith('#') || target.startsWith('assets/') || /^https?:\/\//i.test(target) || target.startsWith('mailto:');
    let result = content.replace(/<a\s+href="([^"]+)"/g, (_m, target, offset, source) => {
      const clean = target.trim();
      if (portable(clean)) return _m;
      const message = 'Invalid output link';
      this.warnings.push(`Warning: ${message}`);
      const loc = this.findSourceLocation(source as string, offset as number);
      this.warningDetails.push({ message, link: clean, file: loc.file, line: loc.line });
      return '<!-- Warning: Invalid output link -->';
    });
    result = result.replace(/(?<!!)\[([^\]]*)\]\(([^)]+)\)/g, (_m, text, target, offset, source) => {
      const clean = target.trim().replace(/^<|>$/g, '');
      if (portable(clean)) return _m;
      const message = 'Invalid markdown link';
      this.warnings.push(`Warning: ${message}`);
      const loc = this.findSourceLocation(source as string, offset as number);
      this.warningDetails.push({ message, link: clean, file: loc.file, line: loc.line });
      return `<!-- Warning: ${message} -->`;
    });
    return result;
  }


  private convertLinks(content: string): string {
    // Convert wiki-style non-embed links.
    content = content.replace(/(?<!!)\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_m, rawLink, display, offset, source) => {
      const resolved = this.resolve(rawLink.trim(), '');
      if (resolved.missing) {
        const loc = this.findSourceLocation(source as string, offset as number);
        const message = `Missing wiki link`;
        this.warnings.push(`Warning: ${message}`);
        this.warningDetails.push({ message, link: rawLink.trim(), file: loc.file, line: loc.line });
        return `<!-- Warning: ${message} -->`;
      }
      if (!this.isMarkdownPath(resolved.path)) {
        return `[[${rawLink.trim()}]]`;
      }
      // US-8.3: if the target file exists in the vault but was never embedded in
      // the compiled output, replace with a warning comment instead of a broken anchor.
      if (!this.headingMap.has(resolved.path)) {
        const loc = this.findSourceLocation(source as string, offset as number);
        const label = rawLink.trim();
        const message = `link target '${label}' not embedded in compiled output`;
        this.warnings.push(`Warning: ${message}`);
        this.warningDetails.push({ message, link: label, file: loc.file, line: loc.line });
        return `<!-- Warning: link target '${label}' not embedded in compiled output -->`;
      }
      const label = display ? display.trim() : this.headingMap.get(resolved.path) || titleFromBasename(this.basename(resolved.path));
      const slug = slugify(this.headingMap.get(resolved.path) || titleFromBasename(this.basename(resolved.path)));
      return `[${label}](#${slug})`;
    });

    // Convert markdown-style non-image links.
    content = content.replace(/(?<!!)\[([^\]]*)\]\(([^)]+)\)/g, (_m, text, rawPath, offset, source) => {
      // Pass through external URLs, anchor-only links, and mailto: unchanged.
      if (/^https?:\/\//i.test(rawPath) || rawPath.startsWith('mailto:') || rawPath.startsWith('#')) {
        return _m;
      }

      const resolved = this.resolve(rawPath, '');
      if (resolved.missing) {
        if (this.isMarkdownPath(rawPath)) {
          const loc = this.findSourceLocation(source as string, offset as number);
          const message = `Missing markdown link`;
          this.warnings.push(`Warning: ${message}`);
          this.warningDetails.push({ message, link: rawPath, file: loc.file, line: loc.line });
          return `<!-- Warning: ${message} -->`;
        }
        // Generated or existing asset references should not be reported as
        // missing source files.
        if (/^(?:\.\.\/|\.\/)assets\//.test(rawPath) || this.usedAssetNames.has(this.basename(rawPath))) {
          return _m;
        }
        // Asset download link.
        const asset = this.sourceToAsset.get(resolved.path);
        if (asset) {
          return `[${text || this.basename(resolved.path)}](${asset})`;
        }
        const loc = this.findSourceLocation(source as string, offset as number);
        const message = `Missing asset link`;
        this.warnings.push(`Warning: ${message}`);
        this.warningDetails.push({ message, link: rawPath, file: loc.file, line: loc.line });
        return `<!-- Warning: ${message} -->`;
      }
      if (this.isMarkdownPath(resolved.path)) {
        const label = text || this.headingMap.get(resolved.path) || titleFromBasename(this.basename(resolved.path));
        const slug = slugify(this.headingMap.get(resolved.path) || titleFromBasename(this.basename(resolved.path)));
        return `[${label}](#${slug})`;
      }
      // For non-markdown assets: ensure registered, then return a portable link.
      // Call assetTag for its side-effect of registering the asset (if not already done).
      this.assetTag(resolved.path, text || this.basename(resolved.path));
      const assetRef = this.sourceToAsset.get(resolved.path)!;
      return `[${text || this.basename(resolved.path)}](${encodeAssetPath(assetRef)})`;
    });

    return content;
  }

}

function splitExtensionForUnique(name: string): { stem: string; ext: string } {
  const match = name.match(/^(.*)(\.[^.]+)$/);
  if (!match) {
    return { stem: name, ext: '' };
  }
  return { stem: match[1], ext: match[2] };
}
