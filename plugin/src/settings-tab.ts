// US-7.4 AC-11 to AC-13: the settings tab — the header row, the sections, the
// resets; text fields saved on Enter or leaving them (US-7.1 AC-S1 amended).
import { Modal, PluginSettingTab, Setting, type App, type Plugin } from 'obsidian';
import { attachCommit } from './commit.ts';
import { ConfirmModal } from './confirm-modal.ts';
import { outputPathText, type OutputLocationResult } from './output-location.ts';
import type { CompileRun } from './compile-dialog-rules.ts';
import {
  SETTINGS_SECTIONS,
  resetQuestion,
  sectionReset,
  type VaultCompilerSettings,
} from './settings-layout.ts';
import { STRINGS } from './strings.ts';

/** What the tab needs of the plugin. */
export interface SettingsTabHost extends Plugin {
  settings: VaultCompilerSettings;
  saveSettings(): Promise<void>;
  resolveOutputLocation(run?: CompileRun): OutputLocationResult;
  pickOutputFolder(current: string): Promise<string | null>;
  copyDebugInfo(): Promise<void>;
}

type TextKey = {
  [K in keyof VaultCompilerSettings]: VaultCompilerSettings[K] extends string ? K : never;
}[keyof VaultCompilerSettings];
type ToggleKey = {
  [K in keyof VaultCompilerSettings]: VaultCompilerSettings[K] extends boolean ? K : never;
}[keyof VaultCompilerSettings];

/** US-7.4 | AC-11: the rows of each key: name, description, placeholder. */
const ROWS: Record<keyof VaultCompilerSettings, { name: string; desc?: string; placeholder?: string }> = {
  startingFile: { name: STRINGS.dialog.startingFile, desc: STRINGS.tab.startingFileDesc, placeholder: 'index2compile.md' },
  outputFolder: { name: STRINGS.dialog.outputFolder },
  outputFile: { name: STRINGS.dialog.outputFile, desc: STRINGS.tab.outputFileDesc, placeholder: 'compiledtext.md' },
  enableTextMapper: { name: STRINGS.tab.textMapper, desc: STRINGS.tab.textMapperDesc },
  mapFont: { name: STRINGS.tab.mapFont, desc: STRINGS.tab.mapFontDesc, placeholder: STRINGS.tab.mapFontPlaceholder },
  tidyMapLabels: { name: STRINGS.tab.tidyLabels, desc: STRINGS.tab.tidyLabelsDesc },
  normaliseHeadings: { name: STRINGS.tab.normalise, desc: STRINGS.tab.normaliseDesc },
  entryMarkerKeys: { name: STRINGS.tab.entryMarker, desc: STRINGS.tab.entryMarkerDesc },
  entryExcludeKeys: { name: STRINGS.tab.entryExclude, desc: STRINGS.tab.entryExcludeDesc },
  entryAssetKeys: { name: STRINGS.tab.entryImage, desc: STRINGS.tab.entryImageDesc },
  expectCompiledFolders: { name: STRINGS.tab.expectCompiled, desc: STRINGS.tab.expectCompiledDesc },
  detailMarkerKeys: { name: STRINGS.tab.detailMarker, desc: STRINGS.tab.detailMarkerDesc },
  encounterCalloutType: { name: STRINGS.tab.encounterCallout, desc: STRINGS.tab.encounterCalloutDesc },
};

export class VaultCompilerSettingTab extends PluginSettingTab {
  /** US-7.4 | AC-11: open sections, kept for the session. */
  private readonly open = new Set<string>([STRINGS.sections.compile]);
  /** US-7.4 | AC-12: the commits of the drawn text fields, flushed on hide. */
  private commits: { flush(): void }[] = [];
  /** US-7.1 | AC-S2: the values being typed, for the resolved path. */
  private draft: CompileRun = { startingFile: '', outputFolder: '', outputFile: '' };
  private showPaths: () => void = () => undefined;

  constructor(app: App, private readonly plugin: SettingsTabHost) {
    super(app, plugin);
  }

  /** US-7.4 | AC-12: a value typed just before the window closes is still saved. */
  hide(): void {
    this.flushAll();
  }

  /** US-7.4 | AC-12: saves every text field still being typed (also on unload). */
  flushAll(): void {
    for (const c of this.commits) c.flush();
  }

  /** US-7.4 | AC-11: the header row, then the sections. */
  display(): void {
    this.flushAll();
    this.commits = [];
    const { containerEl } = this;
    containerEl.empty();
    const { settings } = this.plugin;
    this.draft = { startingFile: settings.startingFile, outputFolder: settings.outputFolder, outputFile: settings.outputFile };
    // US-7.4 AC-13: the version and Copy debug info in the first line.
    new Setting(containerEl.createDiv({ cls: 'vc-tab-header' }))
      .setDesc(STRINGS.tab.version(this.plugin.manifest.version))
      .addExtraButton((b) =>
        b.setIcon('bug').setTooltip(STRINGS.tab.copyDebugInfo).onClick(() => void this.plugin.copyDebugInfo()),
      );
    let folderRow: Setting | null = null;
    let resolvedRow: Setting | null = null;
    this.showPaths = () => {
      const path = outputPathText(this.plugin.resolveOutputLocation(this.draft));
      folderRow?.setDesc(STRINGS.tab.outputFolderDesc(path));
      resolvedRow?.setDesc(path);
    };
    for (const section of SETTINGS_SECTIONS) {
      const details = containerEl.createEl('details', { cls: 'vc-settings-section' });
      details.open = this.open.has(section.name);
      details.createEl('summary', { text: section.name });
      details.addEventListener('toggle', () => {
        if (details.open) this.open.add(section.name);
        else this.open.delete(section.name);
      });
      const gear = new Set(section.feature?.gear ?? []);
      for (const key of section.keys) {
        if (gear.has(key)) continue;
        if (section.feature?.toggle === key) {
          this.featureRow(details, key as ToggleKey, section.feature.gear);
          continue;
        }
        const row = typeof settings[key] === 'boolean' ? this.toggleRow(details, key as ToggleKey) : this.textRow(details, key as TextKey);
        if (key === 'outputFolder') {
          folderRow = row;
          row.addButton((b) =>
            b.setButtonText(STRINGS.dialog.chooseFolder).onClick(async () => {
              const chosen = await this.plugin.pickOutputFolder(settings.outputFolder);
              if (chosen === null) return;
              settings.outputFolder = chosen;
              await this.plugin.saveSettings();
              this.display();
            }),
          );
        }
        if (key === 'outputFile') resolvedRow = new Setting(details).setName(STRINGS.tab.resolvedPath);
      }
      this.resetRow(details, section.name);
    }
    this.showPaths();
  }

  /** US-7.4 | AC-12: a text row saved on Enter or leaving it; the path follows typing. */
  private textRow(parent: HTMLElement, key: TextKey): Setting {
    const row = ROWS[key];
    const setting = new Setting(parent).setName(row.name);
    if (row.desc) setting.setDesc(row.desc);
    setting.addText((t) => {
      t.setPlaceholder(row.placeholder ?? STRINGS.empty).setValue(this.plugin.settings[key]);
      t.onChange((v) => {
        if (key === 'startingFile' || key === 'outputFolder' || key === 'outputFile') {
          this.draft[key] = v;
          this.showPaths();
        }
      });
      this.commits.push(
        attachCommit(t.inputEl, (v) => {
          this.plugin.settings[key] = v;
          void this.plugin.saveSettings();
        }),
      );
    });
    return setting;
  }

  /** A toggle saved at once (US-7.1, unchanged). */
  private toggleRow(parent: HTMLElement, key: ToggleKey): Setting {
    const row = ROWS[key];
    return new Setting(parent)
      .setName(row.name)
      .setDesc(row.desc ?? STRINGS.empty)
      .addToggle((t) =>
        t.setValue(this.plugin.settings[key]).onChange(async (v) => {
          this.plugin.settings[key] = v;
          await this.plugin.saveSettings();
        }),
      );
  }

  /** US-7.4 | AC-11: a feature row: its toggle, and a gear with the rows behind it. */
  private featureRow(parent: HTMLElement, key: ToggleKey, gear: readonly (keyof VaultCompilerSettings)[]): void {
    this.toggleRow(parent, key).addExtraButton((b) =>
      b.setIcon('gear').setTooltip(STRINGS.tab.mapSettings).onClick(() => {
        const modal = new Modal(this.app);
        modal.setTitle(STRINGS.tab.mapSettings);
        for (const k of gear) {
          if (typeof this.plugin.settings[k] === 'boolean') this.toggleRow(modal.contentEl, k as ToggleKey);
          else this.textRow(modal.contentEl, k as TextKey);
        }
        modal.onClose = () => this.flushAll();
        modal.open();
      }),
    );
  }

  /** US-7.4 | AC-11: `Reset this section to defaults`, behind the question. */
  private resetRow(parent: HTMLElement, name: string): void {
    new Setting(parent).addButton((b) =>
      b.setButtonText(STRINGS.tab.resetSection).onClick(() => {
        new ConfirmModal(this.app, resetQuestion(name), (yes) => {
          if (!yes) return;
          this.plugin.settings = sectionReset(this.plugin.settings, name);
          void this.plugin.saveSettings().then(() => this.display());
        }).open();
      }),
    );
  }
}
