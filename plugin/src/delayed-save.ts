/**
 * US-7.1 | AC-S1 (#82): saves a short while after the last request instead
 * of on every key press, and at once on `flush` (settings window closed,
 * plugin switched off), so nothing typed is lost.
 */
export class DelayedSave {
  private readonly save: () => Promise<void>;
  private readonly delayMs: number;
  private timer: ReturnType<typeof setTimeout> | null = null;

  /**
   * US-7.1 | AC-S1: `save` writes the current values; `delayMs` is the wait
   * after the last request.
   */
  constructor(save: () => Promise<void>, delayMs: number) {
    this.save = save;
    this.delayMs = delayMs;
  }

  /** US-7.1 | AC-S1: (re)starts the wait; the save runs when it ends. */
  request(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.save();
    }, this.delayMs);
  }

  /** US-7.1 | AC-S1: saves at once if a save is waiting; otherwise nothing. */
  async flush(): Promise<void> {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
    await this.save();
  }
}
