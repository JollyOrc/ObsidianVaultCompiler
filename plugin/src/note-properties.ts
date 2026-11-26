// US-7.5 AC-5, AC-6: writes keys into a note's frontmatter. Pure; no Obsidian import.
import { isMap, parseDocument } from 'yaml';
import { STRINGS } from './strings.ts';
import { splitFrontmatter } from './utils.ts';

export type SetPropertiesResult = { ok: true; text: string } | { ok: false; error: string };

/**
 * US-7.5 | AC-6: sets each key to its text, or removes it (`null`). Other keys
 * keep order, values and comments (the `yaml` Document API, no flow padding);
 * every byte outside the frontmatter stays. A note without frontmatter gets
 * one; a frontmatter left empty is removed with its `---` lines. An unclosed,
 * invalid or non-mapping frontmatter is refused and nothing changes.
 */
export function setNoteProperties(text: string, values: Record<string, string | null>): SetPropertiesResult {
  const { body, yaml } = splitFrontmatter(text);
  const unclosed = yaml === null && /^---[ \t]*\r?\n/.test(text);
  if (unclosed) return { ok: false, error: STRINGS.reasons.frontmatterUnclosed };

  const doc = parseDocument(yaml ?? '');
  if (doc.errors.length > 0) return { ok: false, error: doc.errors[0].message };
  if (doc.contents !== null && !isMap(doc.contents)) return { ok: false, error: STRINGS.reasons.frontmatterNotMapping };

  for (const [key, value] of Object.entries(values)) {
    if (value !== null) doc.set(key, value);
    else if (doc.contents !== null) doc.delete(key);
  }
  const emptied = isMap(doc.contents) && doc.contents.items.length === 0;
  if (yaml === null) {
    return { ok: true, text: doc.contents === null || emptied ? text : `---\n${dump(doc, '\n')}---\n${text}` };
  }
  const block = text.slice(0, text.length - body.length);
  if (emptied) return { ok: true, text: body };
  const eol = block.startsWith('---\r\n') ? '\r\n' : '\n';
  const opening = /^---[ \t]*\r?\n/.exec(block)?.[0] ?? '';
  const closing = /---[ \t]*(?:\r?\n|$)$/.exec(block)?.[0] ?? '';
  return { ok: true, text: opening + dump(doc, eol) + closing + body };
}

/** The document as text with the note's line ending; flow collections keep their bytes. */
function dump(doc: ReturnType<typeof parseDocument>, eol: string): string {
  return doc.toString({ flowCollectionPadding: false }).replace(/\r?\n/g, eol);
}
