/**
 * US-7.3 | AC-5 (#81, SCAR-013): whether a key press in the export prompt
 * confirms it — Enter, but not while an input method is still composing a
 * character (`isComposing`, or keyCode 229 in older engines).
 */
export function isConfirmKey(event: { key: string; isComposing: boolean; keyCode: number }): boolean {
  return event.key === 'Enter' && !event.isComposing && event.keyCode !== 229;
}
