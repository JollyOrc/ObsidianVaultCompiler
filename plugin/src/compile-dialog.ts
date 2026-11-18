// US-7.4 AC-2 to AC-4: the compile dialog. The rules are in
// `compile-dialog-rules.ts`; this file draws and wires them.
import { Modal, Setting, type App } from 'obsidian';
import { destinationLine, dialogKey, settingsAfterCompile, type CompileRun } from './compile-dialog-rules.ts';
import type { OutputLocationResult } from './output-location.ts';
import { STRINGS } from './strings.ts';

/** What the dialog needs of the plugin. */
export interface CompileDialogHost {
  manifest: { id: string };
  settings: CompileRun;
  resolveOutputLocation(run: CompileRun): OutputLocationResult;
  outputModified(result: OutputLocationResult): Date | null;
  pickOutputFolder(current: string): Promise<string | null>;
  saveSettings(): Promise<void>;
  compileVault(run: CompileRun): Promise<void>;
}

/** US-7.4 | AC-2: the modal `Compile vault`. */
export class CompileDialog extends Modal {
  private readonly run: CompileRun;
  private enabled = false;

  constructor(
    app: App,
    private readonly host: CompileDialogHost,
    run: CompileRun,
    private readonly origin: 'settings' | 'file-menu',
  ) {
    super(app);
    this.run = { ...run };
  }

  /** US-7.4 | AC-2: starting file, destination row, the lines, More options. */
  onOpen(): void {
    this.setTitle(STRINGS.dialog.title);
    const { contentEl } = this;
    contentEl.empty();
    new Setting(contentEl).setName(STRINGS.dialog.startingFile).addText((t) =>
      t.setValue(this.run.startingFile).onChange((v) => {
        this.run.startingFile = v;
        this.update();
      }),
    );
    let folderInput: { setValue(v: string): unknown } | null = null;
    new Setting(contentEl)
      .setName(STRINGS.dialog.outputFolder)
      .addText((t) => {
        folderInput = t;
        t.setValue(this.run.outputFolder).onChange((v) => {
          this.run.outputFolder = v;
          this.update();
        });
      })
      .addButton((b) =>
        b.setButtonText(STRINGS.dialog.chooseFolder).onClick(async () => {
          const chosen = await this.host.pickOutputFolder(this.run.outputFolder);
          if (chosen === null) return;
          this.run.outputFolder = chosen;
          folderInput?.setValue(chosen);
          this.update();
        }),
      );
    let compileButton: { setDisabled(d: boolean): unknown } | null = null;
    new Setting(contentEl)
      .setName(STRINGS.dialog.outputFile)
      .addText((t) =>
        t.setValue(this.run.outputFile).onChange((v) => {
          this.run.outputFile = v;
          this.update();
        }),
      )
      .addButton((b) => {
        compileButton = b;
        b.setButtonText(STRINGS.dialog.compile).setCta().onClick(() => void this.compile());
      });
    this.compileButton = compileButton;
    this.refusedEl = contentEl.createDiv({ cls: 'vc-dialog-refused' });
    this.infoEl = contentEl.createDiv({ cls: 'vc-dialog-info' });
    new Setting(contentEl).setName(STRINGS.dialog.moreOptions).addExtraButton((b) =>
      b.setIcon('gear').onClick(() => {
        this.close();
        const setting = (this.app as unknown as { setting?: { open(): void; openTabById(id: string): void } }).setting;
        setting?.open();
        setting?.openTabById(this.host.manifest.id);
      }),
    );
    contentEl.addEventListener('keydown', (event) => {
      const action = dialogKey(event, this.enabled);
      if (action === 'none') return;
      event.preventDefault();
      if (action === 'run') void this.compile();
      else this.close();
    });
    this.update();
  }

  private compileButton: { setDisabled(d: boolean): unknown } | null = null;
  private refusedEl: HTMLElement | null = null;
  private infoEl: HTMLElement | null = null;

  /** US-7.4 | AC-2, AC-3: the lines and Compile, after every change (SCAR-016). */
  private update(): void {
    const result = this.host.resolveOutputLocation(this.run);
    const line = destinationLine(result, this.host.outputModified(result));
    this.enabled = line.kind === 'info';
    this.compileButton?.setDisabled(!this.enabled);
    this.refusedEl?.setText(line.kind === 'refused' ? line.text : STRINGS.empty);
    this.infoEl?.setText(line.kind === 'info' ? line.text : STRINGS.empty);
  }

  /** US-7.4 | AC-4: saves what Compile saves, then compiles this run. */
  private async compile(): Promise<void> {
    if (!this.enabled) return;
    const run = { ...this.run };
    Object.assign(this.host.settings, settingsAfterCompile(run, this.origin));
    await this.host.saveSettings();
    this.close();
    await this.host.compileVault(run);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
