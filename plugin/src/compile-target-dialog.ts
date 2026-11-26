// US-7.5 AC-5, AC-6, AC-7: the dialog `Compile target…` of a note.
import { Modal, Notice, Setting, type App, type TFile } from 'obsidian';
import { destinationLine, dialogKey, type CompileRun } from './compile-dialog-rules.ts';
import { effectiveTarget, noteTargetRefusal, readNoteTarget, type NoteTargetRequest } from './note-target.ts';
import { setNoteProperties, type SetPropertiesResult } from './note-properties.ts';
import { joinOutputPath, type OutputLocationResult } from './output-location.ts';
import { STRINGS } from './strings.ts';
import { splitFrontmatter } from './utils.ts';

/** What the dialog needs of the plugin. */
export interface CompileTargetHost {
  settings: CompileRun;
  resolveOutputLocation(run: CompileRun): OutputLocationResult;
  locationRequest(startingFile: string): NoteTargetRequest;
  outputModified(result: OutputLocationResult): Date | null;
  pickOutputFolder(current: string): Promise<string | null>;
}

/** US-7.5 | AC-5: sets `compile-folder` and `compile-file` of one note. */
export class CompileTargetDialog extends Modal {
  private folder = '';
  private file = '';
  private folderInput: { setValue(v: string): unknown } | null = null;
  private fileInput: { setValue(v: string): unknown } | null = null;
  private refusedEl: HTMLElement | null = null;
  private infoEl: HTMLElement | null = null;

  constructor(
    app: App,
    private readonly host: CompileTargetHost,
    private readonly note: TFile,
  ) {
    super(app);
  }

  /** The note's current values, then the fields, the two lines and the buttons. */
  onOpen(): void {
    this.setTitle(STRINGS.targetDialog.title);
    const { contentEl } = this;
    contentEl.empty();
    new Setting(contentEl)
      .setName(STRINGS.dialog.outputFolder)
      .addText((t) => {
        this.folderInput = t;
        t.onChange((v) => {
          this.folder = v;
          this.update();
        });
      })
      .addButton((b) =>
        b.setButtonText(STRINGS.dialog.chooseFolder).onClick(async () => {
          const chosen = await this.host.pickOutputFolder(this.folder);
          if (chosen === null) return;
          this.folder = chosen;
          this.folderInput?.setValue(chosen);
          this.update();
        }),
      );
    new Setting(contentEl).setName(STRINGS.dialog.outputFile).addText((t) => {
      this.fileInput = t;
      t.onChange((v) => {
        this.file = v;
        this.update();
      });
    });
    this.refusedEl = contentEl.createDiv({ cls: 'vc-dialog-refused' });
    this.infoEl = contentEl.createDiv({ cls: 'vc-dialog-info' });
    new Setting(contentEl)
      .addButton((b) => b.setButtonText(STRINGS.targetDialog.save).setCta().onClick(() => void this.save()))
      .addButton((b) => b.setButtonText(STRINGS.targetDialog.clear).onClick(() => void this.write(null, null)))
      .addButton((b) => b.setButtonText(STRINGS.targetDialog.cancel).onClick(() => this.close()));
    contentEl.addEventListener('keydown', (event) => {
      const action = dialogKey(event, true);
      if (action === 'none') return;
      event.preventDefault();
      if (action === 'cancel') this.close();
      else void this.save();
    });
    void this.load();
  }

  /** Fills the fields from the note, read now. */
  private async load(): Promise<void> {
    const target = readNoteTarget(splitFrontmatter(await this.app.vault.read(this.note)).yaml);
    this.folder = target.folder ?? STRINGS.empty;
    this.file = target.file ?? STRINGS.empty;
    this.folderInput?.setValue(this.folder);
    this.fileInput?.setValue(this.file);
    this.update();
  }

  /** The values as properties: an empty field is not set. */
  private values(): { folder: string | null; file: string | null } {
    return { folder: this.folder.trim() || null, file: this.file.trim() || null };
  }

  /** Shows where a compile of this note would write, with the settings as fallback. */
  private update(): void {
    const { folder, file } = this.values();
    const target = effectiveTarget(this.host.settings, { folder: folder ?? undefined, file: file ?? undefined, problems: [] });
    const result = this.host.resolveOutputLocation({
      startingFile: this.note.path,
      outputFolder: target.outputFolder,
      outputFile: target.outputFile,
    });
    const line = destinationLine(result, this.host.outputModified(result));
    this.refusedEl?.setText(line.kind === 'refused' ? line.text : STRINGS.empty);
    this.infoEl?.setText(line.kind === 'info' ? line.text : STRINGS.empty);
  }

  /** AC-5: both values are checked with the settings' rules before anything is written. */
  private async save(): Promise<void> {
    const { folder, file } = this.values();
    const refusal = noteTargetRefusal(
      { folder: folder ?? undefined, file: file ?? undefined, problems: [] },
      this.host.locationRequest(this.note.path),
    );
    if (refusal !== null) {
      this.refusedEl?.setText(refusal);
      return;
    }
    await this.write(folder, file);
  }

  /** AC-6, AC-7: one `vault.process`; a refused frontmatter leaves the note as it is. */
  private async write(folder: string | null, file: string | null): Promise<void> {
    let failure: string | null = null;
    try {
      await this.app.vault.process(this.note, (text) => {
        const outcome: SetPropertiesResult = setNoteProperties(text, { 'compile-folder': folder, 'compile-file': file });
        if (outcome.ok) return outcome.text;
        failure = outcome.error;
        return text;
      });
    } catch (error) {
      failure = (error as Error).message;
    }
    if (failure !== null) {
      new Notice(STRINGS.notices.compileTargetFailed(failure), 5000);
      return;
    }
    this.close();
    const name = this.note.basename;
    if (folder === null && file === null) {
      new Notice(STRINGS.notices.compileTargetSettings(name), 5000);
    } else {
      const target = effectiveTarget(this.host.settings, { folder: folder ?? undefined, file: file ?? undefined, problems: [] });
      new Notice(STRINGS.notices.compileTargetSet(name, joinOutputPath(target.outputFolder, target.outputFile)), 5000);
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
