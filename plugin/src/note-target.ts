// US-7.5 AC-1, AC-2, AC-3: the starting note's compile target. Pure; no Obsidian import.
import { parse } from 'yaml';
import { resolveOutputLocation, type OutputLocationRequest } from './output-location.ts';
import { STRINGS } from './strings.ts';

/** The three top-level text keys of a note; an unset key is absent. */
export interface NoteTarget {
  folder?: string;
  file?: string;
  preset?: string;
  problems: string[];
}

/** The target a compile runs with, and whether the note gave it. */
export interface EffectiveTarget {
  outputFolder: string;
  outputFile: string;
  fromNote: boolean;
}

/** What `noteTargetRefusal` needs of the request: everything but the two values. */
export type NoteTargetRequest = Omit<OutputLocationRequest, 'folder' | 'file'>;

const KEYS = [
  ['folder', 'compile-folder'],
  ['file', 'compile-file'],
  ['preset', 'typst-preset'],
] as const;

/** A file name that no check but the target's own can refuse; probes a folder alone. */
const PROBE_FILE = 'compile-target-probe.md';

/**
 * US-7.5 | AC-1: reads the three keys from a note's frontmatter text (the
 * lines between the `---`, or null). Values are trimmed; empty, blank or
 * absent is not set; a value of another type is a problem naming the key.
 * Nested keys, a non-mapping or invalid YAML give nothing (as 0.26.0).
 */
export function readNoteTarget(yaml: string | null): NoteTarget {
  const target: NoteTarget = { problems: [] };
  if (yaml === null) return target;
  let data: unknown;
  try {
    data = parse(yaml);
  } catch {
    return target;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return target;
  const map = data as Record<string, unknown>;
  for (const [field, key] of KEYS) {
    const value = map[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string') {
      target.problems.push(STRINGS.reasons.propertyNotText(key));
      continue;
    }
    const text = value.trim();
    if (text !== '') target[field] = text;
  }
  return target;
}

/**
 * US-7.5 | AC-1, AC-3: the output folder and file name of a compile; an unset
 * key falls back to the setting. `fromNote` is true when either output key is set.
 */
export function effectiveTarget(
  settings: { outputFolder: string; outputFile: string },
  target: NoteTarget,
): EffectiveTarget {
  return {
    outputFolder: target.folder ?? settings.outputFolder,
    outputFile: target.file ?? settings.outputFile,
    fromNote: target.folder !== undefined || target.file !== undefined,
  };
}

/**
 * US-7.5 | AC-2 (SCAR-033): why the note's values are refused, or null. The
 * settings' own checks (`resolveOutputLocation`) decide; the reason gets the
 * property's name in front. A wrong type is refused first.
 */
export function noteTargetRefusal(target: NoteTarget, request: NoteTargetRequest): string | null {
  if (target.problems.length > 0) return target.problems[0];
  const check = (folder: string, file: string) => resolveOutputLocation({ ...request, folder, file });
  if (target.folder !== undefined) {
    const result = check(target.folder, PROBE_FILE);
    if (!result.ok) return STRINGS.reasons.property('compile-folder', result.reason);
  }
  if (target.file !== undefined) {
    const result = check(target.folder ?? '', target.file);
    if (!result.ok) return STRINGS.reasons.property('compile-file', result.reason);
  }
  return null;
}
