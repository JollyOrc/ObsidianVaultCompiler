// US-7.4 AC-10: the failure notice. No Obsidian import.
import { STRINGS } from './strings.ts';

/** US-7.4 | AC-10: `❌ Compilation failed: <message>`. */
export function failedNotice(message: string): string {
  return STRINGS.notices.failed(message);
}
