// US-7.4 AC-2 to AC-4: the compile dialog. The rules are in
// `compile-dialog-rules.ts`; this file draws and wires them.
import { Modal, Setting, type App } from 'obsidian';
import { destinationLine, dialogKey, settingsAfterCompile, type CompileRun } from './compile-dialog-rules.ts';
import { effectiveTarget, noteTargetRefusal, type NoteTarget, type NoteTargetRequest } from './note-target.ts';
import type { OutputLocationResult } from './output-location.ts';
import { STRINGS } from './strings.ts';

/** What the dialog needs of the plugin. */
export interface CompileDialogHost {
  manifest: { id: string };
  settings: CompileRun;
  resolveOutputLocation(run: CompileRun): OutputLocationResult;
  locationRequest(startingFile: string): NoteTargetRequest;
  readStartingNoteTarget(path: string): Promise<NoteTarget>;
  outputModified(result: OutputLocationResult): Date | null;
  pickOutputFolder(current: string): Promise<string | null>;
  saveSettings(): Promise<void>;
  compileVault(run: CompileRun): Promise<void>;
}

/** US-7.4 | AC-2: the modal `Compile vault`. */
export class CompileDialog extends Modal {
  private readonly run: CompileRun;
  private enabled = false;
  /** US-7.5 | AC-3: the starting note's target and the values it filled in. */
  private noteTarget: NoteTarget = { problems: [] };
  private fromNote = false;
  private filled = { folder: '', file: '' };
  private folderInput: { setValue(v: string): unknown } | null = null;
  private fileInput: { setValue(v: string): unknown } | null = null;

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
    new Setting(contentEl).setName(STRINGS.dialog.startingFile).addText((t) => {
      t.setValue(this.run.startingFile).onChange((v) => {
        this.run.startingFile = v;
        this.update();
      });
      // US-7.5 | AC-3: leaving the field refills the output fields from that note.
      t.inputEl.addEventListener('blur', () => void this.fillFromNote());
    });
    new Setting(contentEl)
      .setName(STRINGS.dialog.outputFolder)
      .addText((t) => {
        this.folderInput = t;
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
          this.folderInput?.setValue(chosen);
          this.update();
        }),
      );
    let compileButton: { setDisabled(d: boolean): unknown } | null = null;
    new Setting(contentEl)
      .setName(STRINGS.dialog.outputFile)
      .addText((t) => {
        this.fileInput = t;
        t.setValue(this.run.outputFile).onChange((v) => {
          this.run.outputFile = v;
          this.update();
        });
      })
      .addButton((b) => {
        compileButton = b;
        b.setButtonText(STRINGS.dialog.compile).setCta().onClick(() => void this.compile());
      });
    this.compileButton = compileButton;
    this.refusedEl = contentEl.createDiv({ cls: 'vc-dialog-refused' });
    this.infoEl = contentEl.createDiv({ cls: 'vc-dialog-info' });
    this.noteEl = contentEl.createDiv({ cls: 'vc-dialog-info' });
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
    void this.fillFromNote();
  }

  /**
   * US-7.5 | AC-3: reads the starting note and fills the output fields from
   * its keys, or from the settings when it has none; this run only.
   */
  private async fillFromNote(): Promise<void> {
    this.noteTarget = await this.host.readStartingNoteTarget(this.run.startingFile);
    const target = effectiveTarget(this.host.settings, this.noteTarget);
    this.fromNote = target.fromNote;
    this.run.outputFolder = target.outputFolder;
    this.run.outputFile = target.outputFile;
    this.filled = { folder: target.outputFolder, file: target.outputFile };
    this.folderInput?.setValue(target.outputFolder);
    this.fileInput?.setValue(target.outputFile);
    this.update();
  }

  private compileButton: { setDisabled(d: boolean): unknown } | null = null;
  private refusedEl: HTMLElement | null = null;
  private infoEl: HTMLElement | null = null;
  private noteEl: HTMLElement | null = null;

  /** US-7.4 | AC-2, AC-3: the lines and Compile, after every change (SCAR-016). */
  private update(): void {
    const result = this.host.resolveOutputLocation(this.run);
    let line = destinationLine(result, this.host.outputModified(result));
    // US-7.5 | AC-2: a refusal of the note's own values names the property.
    const untouched = this.run.outputFolder === this.filled.folder && this.run.outputFile === this.filled.file;
    if (this.fromNote && untouched) {
      const named = noteTargetRefusal(this.noteTarget, this.host.locationRequest(this.run.startingFile));
      if (named !== null) line = { kind: 'refused', text: named };
    }
    this.enabled = line.kind === 'info';
    this.compileButton?.setDisabled(!this.enabled);
    this.refusedEl?.setText(line.kind === 'refused' ? line.text : STRINGS.empty);
    this.infoEl?.setText(line.kind === 'info' ? line.text : STRINGS.empty);
    this.noteEl?.setText(this.fromNote ? STRINGS.dialog.outputFromNote : STRINGS.empty);
  }

  /** US-7.4 | AC-4: saves what Compile saves, then compiles this run. */
  private async compile(): Promise<void> {
    if (!this.enabled) return;
    const run = { ...this.run };
    Object.assign(this.host.settings, settingsAfterCompile(run, this.origin, this.fromNote));
    await this.host.saveSettings();
    this.close();
    await this.host.compileVault(run);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
