// US-7.4 AC-2 to AC-4: the compile dialog's rules. No Obsidian import.
import type { OutputLocationResult } from './output-location.ts';
import { isConfirmKey } from './prompt-keys.ts';
import { STRINGS } from './strings.ts';

/** US-7.2, US-7.3, US-7.4: the values one compile runs with. */
export interface CompileRun {
  startingFile: string;
  outputFolder: string;
  outputFile: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * US-7.4 | AC-2, AC-3: The line under the destination: the refusal's reason
 * (red), or what the compile does to the output file (grey); `modified` is
 * the existing file's modification time, local, `YYYY-MM-DD HH:MM`.
 */
export function destinationLine(
  result: OutputLocationResult,
  modified: Date | null,
): { kind: 'refused' | 'info'; text: string } {
  if (!result.ok) return { kind: 'refused', text: result.reason };
  const path = result.location.outputPath;
  if (modified === null) return { kind: 'info', text: STRINGS.dialog.willWrite(path) };
  const when =
    `${modified.getFullYear()}-${pad(modified.getMonth() + 1)}-${pad(modified.getDate())} ` +
    `${pad(modified.getHours())}:${pad(modified.getMinutes())}`;
  return { kind: 'info', text: STRINGS.dialog.willReplace(path, when) };
}

/**
 * US-7.4 | AC-2: What a key does in the dialog: Enter runs only while Compile
 * is enabled and no input method composes (SCAR-013); Escape cancels.
 */
export function dialogKey(
  event: { key: string; isComposing: boolean; keyCode: number },
  enabled: boolean,
): 'run' | 'cancel' | 'none' {
  if (event.key === 'Escape') return 'cancel';
  if (isConfirmKey(event)) return enabled ? 'run' : 'none';
  return 'none';
}

/**
 * US-7.4 | AC-4 (P1), US-7.5 | AC-3: What Compile saves: folder and filename
 * always, unless the note gave them (`fromNote`: this run only); the starting
 * file only when the dialog came from the settings' values (ribbon,
 * `Compile vault…`), not from the file menu (US-7.2 AC-3). A new object.
 */
export function settingsAfterCompile(
  run: CompileRun,
  origin: 'settings' | 'file-menu',
  fromNote: boolean,
): Partial<CompileRun> {
  const saved: Partial<CompileRun> = {};
  if (origin === 'settings') saved.startingFile = run.startingFile;
  if (!fromNote) {
    saved.outputFolder = run.outputFolder;
    saved.outputFile = run.outputFile;
  }
  return saved;
}
