// US-7.4 AC-12: a settings text field is saved on Enter or leaving it, not while typing.
import { isConfirmKey } from './prompt-keys.ts';

/** The part of an input element the rule uses. */
export interface CommitInput {
  value: string;
  addEventListener(type: string, listener: (event: any) => void): void; // eslint-disable-line @typescript-eslint/no-explicit-any -- a DOM event, typed by the caller
}

/**
 * US-7.4 | AC-12: Saves the input's value on Enter (not while an input method
 * composes) and on blur, only when it changed since the last save; `flush`
 * saves a value still being typed (the tab closing, the plugin unloading).
 */
export function attachCommit(input: CommitInput, save: (value: string) => void): { flush(): void } {
  let saved = input.value;
  const commit = () => {
    if (input.value === saved) return;
    saved = input.value;
    save(saved);
  };
  input.addEventListener('keydown', (event) => {
    if (isConfirmKey(event)) commit();
  });
  input.addEventListener('blur', () => commit());
  return { flush: commit };
}
