// US-7.4 AC-11: the plugin's confirmation. `Cancel` is created first: Obsidian
// focuses a modal's first button after `onOpen` (F1: Game Card Creator #58,
// Obsidian2Typst #174), so Enter cancels.
import { Modal, Setting, type App } from 'obsidian';

export interface Question {
  title: string;
  lines: string[];
  confirmLabel: string;
  cancelLabel: string;
}

/** US-7.4 | AC-11: asks `question`; `answer(true)` only on the confirm button. */
export class ConfirmModal extends Modal {
  private answered = false;
  constructor(app: App, private readonly question: Question, private readonly answer: (yes: boolean) => void) {
    super(app);
  }

  /** US-7.4 | AC-11: the title, the lines, then Cancel and the warning button. */
  onOpen(): void {
    this.setTitle(this.question.title);
    for (const line of this.question.lines) this.contentEl.createEl('p', { text: line });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText(this.question.cancelLabel).onClick(() => this.finish(false)))
      .addButton((b) => b.setButtonText(this.question.confirmLabel).setWarning().onClick(() => this.finish(true)));
  }

  /** Escape, the X and a click outside answer no. */
  onClose(): void {
    this.contentEl.empty();
    if (!this.answered) this.answer(false);
  }

  private finish(yes: boolean): void {
    this.answered = true;
    this.answer(yes);
    this.close();
  }
}
