/* eslint-disable @typescript-eslint/no-explicit-any */
import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { InMemoryVaultCompiler } from './compiler.ts';
import { completionNotice, parseListSetting } from './entries.ts';
import { ObsidianLinkResolver } from './resolver.ts';
import { ObsidianAssetManager } from './assets.ts';
import { computeContentHash } from './utils.ts';
import {
  joinOutputPath,
  outputPathText,
  resolveOutputLocation,
  vaultRelativeFromAbsolute,
  type OutputLocationResult,
  foldersToIgnore,
} from './output-location.ts';
import { OutputWriter, type WriterFs } from './output-writer.ts';
import { DelayedSave } from './delayed-save.ts';
import { isConfirmKey } from './prompt-keys.ts';
import {
  getTextMapperPlugin,
  mapImageKey,
  parseMapAssetRef,
  prepareMapFont,
  renderTextMapperBlock,
} from './textmapper.ts';

/**
 * US-0.3 | AC-OL-2: true in the desktop app, where Node's `require` exists.
 */
function isDesktopRuntime(): boolean {
  return typeof (window as any).require === 'function';
}

interface VaultCompilerSettings {
  startingFile: string;
  outputFolder: string;
  outputFile: string;
  enableTextMapper: boolean;
  normaliseHeadings: boolean;
  /** US-4.8 | AC-1: map font; empty means Obsidian's note font. */
  mapFont: string;
  /** US-4.9 | AC-7: no hex numbers, centred and wrapped labels in compiled maps. */
  tidyMapLabels: boolean;
  /** Epic 9 | Settings: comma-separated lists, read with `parseListSetting`. */
  entryMarkerKeys: string;
  entryExcludeKeys: string;
  entryAssetKeys: string;
  expectCompiledFolders: string;
}

/**
 * US-7.2 | AC-3, US-7.3 | AC-3: the values one compile runs with — from the
 * settings, or from the export prompt for that run only.
 */
interface CompileRun {
  startingFile: string;
  outputFolder: string;
  outputFile: string;
}

/** US-7.1 | AC-S1: how long a settings text field waits before it is saved. */
const SAVE_DELAY_MS = 500;

const DEFAULT_SETTINGS: VaultCompilerSettings = {
  startingFile: 'index2compile.md',
  outputFolder: '',
  outputFile: 'compiledtext.md',
  enableTextMapper: true,
  normaliseHeadings: false,
  mapFont: '',
  tidyMapLabels: true,
  entryMarkerKeys: '',
  entryExcludeKeys: 'aliases, cssclasses, publish',
  entryAssetKeys: 'illustration',
  expectCompiledFolders: '',
};

export default class VaultCompilerPlugin extends Plugin {
  settings: VaultCompilerSettings;
  /** US-7.1 | AC-S1: saves the settings text fields after typing stops. */
  settingsSaver = new DelayedSave(() => this.saveSettings(), SAVE_DELAY_MS);

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: 'compile-vault',
      name: 'Compile vault',
      callback: () => void this.compileVault(),
    });

    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (file instanceof TFile && file.extension.toLowerCase() === 'md') {
          menu.addItem(item => {
            item
              .setTitle('Compile vault from this file')
              .setIcon('document')
              .onClick(() => {
                // US-7.2 | AC-3: one-shot — the chosen note is used for this run only.
                new ExportPathModal(this.app, this, { ...this.settingsRun(), startingFile: file.path }).open();
              });
          });
        }
      })
    );

    this.addSettingTab(new VaultCompilerSettingTab(this.app, this));
  }

  /** US-7.1 | AC-S1: a value typed just before switching off is still saved. */
  onunload() {
    void this.settingsSaver.flush();
  }

  /** US-7.2 | AC-3: the run values stored in the settings. */
  settingsRun(): CompileRun {
    return {
      startingFile: this.settings.startingFile,
      outputFolder: this.settings.outputFolder,
      outputFile: this.settings.outputFile,
    };
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (this.settings.outputFile.includes('/') && !this.settings.outputFolder) {
      const parts = this.settings.outputFile.split('/').filter(Boolean);
      this.settings.outputFile = parts.pop() || DEFAULT_SETTINGS.outputFile;
      this.settings.outputFolder = parts.join('/');
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * US-0.3 | AC-OL-1 to AC-OL-6: The output path shown in the settings and
   * the export prompt, or why the current values are refused.
   */
  getOutputPath(run: CompileRun = this.settingsRun()): string {
    return outputPathText(this.resolveOutputLocation(run));
  }

  /**
   * US-0.3 | AC-OL-2, AC-OL-3: The absolute vault root on the desktop app,
   * `null` on mobile.
   */
  private getVaultRoot(): string | null {
    const adapter = this.app.vault.adapter as any;
    return typeof adapter.getBasePath === 'function' ? adapter.getBasePath() : null;
  }

  /**
   * US-0.3 | AC-OL-2: Node.js fs on the desktop app, `null` on mobile.
   */
  private getNodeFs(): WriterFs | null {
    return isDesktopRuntime() ? (window as any).require('fs') : null;
  }

  /**
   * US-0.3 | AC-OL-1 to AC-OL-6: Resolves the configured folder and filename
   * into the output location of this compile, or the reason to refuse it.
   */
  resolveOutputLocation(run: CompileRun = this.settingsRun()): OutputLocationResult {
    const fs = this.getNodeFs();
    return resolveOutputLocation({
      folder: run.outputFolder,
      file: run.outputFile,
      startingFile: run.startingFile,
      configDir: this.app.vault.configDir,
      vaultRoot: fs ? this.getVaultRoot() : null,
      folderExists: absolute => fs !== null && fs.existsSync(absolute),
    });
  }

  /**
   * US-0.3, US-8.1 | AC-OL-1 to AC-OL-6, AC-8.1-W: Compiles the vault into the
   * resolved output location. A refused location stops before anything is
   * read, confirmed or written; every write goes through `OutputWriter`.
   */
  async compileVault(run: CompileRun = this.settingsRun()) {
    const resolved = this.resolveOutputLocation(run);
    if (!resolved.ok) {
      new Notice(`Compilation not started: ${resolved.reason}`);
      return;
    }
    const location = resolved.location;
    const writer = new OutputWriter(location, this.app.vault, this.getNodeFs());

    const startingFile = this.app.vault.getAbstractFileByPath(run.startingFile);
    if (!(startingFile instanceof TFile)) {
      new Notice('Starting file not found.');
      return;
    }

    const outputFile = location.outputPath;
    if (writer.exists(outputFile) && !window.confirm(`Overwrite existing file ${outputFile}?`)) {
      new Notice('Compilation cancelled.');
      return;
    }

    new Notice('Vault compilation started.');

    try {
      const sourceSnapshot = new Map(this.app.vault.getFiles().map(file => [file.path, file.stat.mtime]));
      const files: Record<string, string> = {};
      const vaultFiles = this.app.vault.getFiles();
      for (const file of vaultFiles) {
        if (file.extension.toLowerCase() === 'md') {
          files[file.path] = await this.app.vault.read(file);
        } else {
          files[file.path] = '';
        }
      }

      // US-4.8 | AC-5: the map font is worked out once, before the compile.
      const mapFont = await prepareMapFont(this.settings.mapFont);
      if (this.settings.enableTextMapper) {
        for (const family of mapFont.failed) {
          new Notice(`Vault Compiler: map font "${family}" could not be embedded; maps use the next font in the list.`);
        }
      }

      const resolver = new ObsidianLinkResolver(this.app);
      const compiler = new InMemoryVaultCompiler(files, {
        enableTextMapper: this.settings.enableTextMapper,
        normaliseHeadings: this.settings.normaliseHeadings,
        mapFontKey: mapImageKey(mapFont.key, this.settings.tidyMapLabels),
        assetFolder: 'assets',
        resolve: (raw: string, currentFile: string) => resolver.resolve(raw, currentFile),
        // US-3.1 "Output folder": the settings' folder and this run's.
        ignoredFolders: foldersToIgnore([this.resolveOutputLocation(), resolved]),
        // Epic 9 | Settings (#108).
        entryMarkerKeys: parseListSetting(this.settings.entryMarkerKeys, { lowerCase: true }),
        entryExcludeKeys: parseListSetting(this.settings.entryExcludeKeys, { lowerCase: true }),
        entryAssetKeys: parseListSetting(this.settings.entryAssetKeys, { lowerCase: true }),
        expectCompiledFolders: parseListSetting(this.settings.expectCompiledFolders, { lowerCase: false }),
      });

      const result = compiler.compile(run.startingFile);

      const outputDir = location.folder;
      await writer.ensureFolder(location.assetsFolder);

      const assetManager = new ObsidianAssetManager(this.app);
      const usedAssetNames = new Set(compiler.assetNames);
      for (const [sourcePath, destination] of compiler.sourceToAssetMap) {
        const destPath = joinOutputPath(outputDir, destination);
        assetManager.getDestination(sourcePath, outputDir, usedAssetNames);
        await assetManager.copy(sourcePath, destPath, writer);
      }

      if (this.settings.enableTextMapper) {
        const resultContent = result.content;
        // US-4.8 | AC-6: map PNG names are parsed only by parseMapAssetRef.
        const refs = new Set(
          [...resultContent.matchAll(/\]\((assets\/textmapper\/[^)\s]+\.png)\)/g)]
            .map(match => match[1])
            .filter(ref => parseMapAssetRef(ref) !== null),
        );
        const blockMap = new Map<string, string>();
        for (const file of vaultFiles) {
          if (!file.path.toLowerCase().endsWith('.md')) continue;
          const content = files[file.path];
          for (const match of content.matchAll(/```text-mapper\n([\s\S]*?)\n```/g)) {
            const hash = computeContentHash(match[1]);
            if (!blockMap.has(hash)) {
              blockMap.set(hash, match[1]);
            }
          }
        }

        if (refs.size > 0 && getTextMapperPlugin(this.app) === null) {
          // US-4.2 | AC-5: one notice per compile; each map gets a placeholder below.
          new Notice('Vault Compiler: the Text Mapper plugin is not installed or enabled, so maps are left as placeholders.');
        }
        const skippedSteps = new Set<string>();
        const skippedDirectives = new Set<string>();
        for (const ref of refs) {
          const hash = parseMapAssetRef(ref)?.hash;
          const code = hash ? blockMap.get(hash) : undefined;
          const destinationPath = joinOutputPath(outputDir, ref);
          if (!code) {
            const message = 'source block not found';
            result.content = result.content.replace(
              new RegExp('!\\[[^\\]]*\\]\\(' + this.escapeRegExp(ref) + '\\)', 'g'),
              `<!-- TextMapper Render Failure: ${message} -->`
            );
            continue;
          }
          try {
            const tidy = await renderTextMapperBlock(this.app, code, destinationPath, writer, mapFont, this.settings.tidyMapLabels);
            tidy.skipped.forEach(step => skippedSteps.add(step));
            tidy.skippedDirectives.forEach(directive => skippedDirectives.add(directive));
            if (tidy.unbreakable) {
              // US-4.9 | AC-4: once per map.
              const alt = result.content.match(new RegExp('!\\[([^\\]]*)\\]\\(' + this.escapeRegExp(ref) + '\\)'))?.[1] ?? ref;
              new Notice(`Vault Compiler: a label in map "${alt}" has a word too wide for its hex.`);
            }
          } catch (error) {
            const message = (error as Error).message;
            result.content = result.content.replace(
              new RegExp('!\\[[^\\]]*\\]\\(' + this.escapeRegExp(ref) + '\\)', 'g'),
              `<!-- TextMapper Render Failure: ${message} -->`
            );
          }
        }
        if (skippedSteps.size > 0) {
          // US-4.9 | AC-6: once per compile.
          new Notice(
            `Vault Compiler: some maps were not tidied (${[...skippedSteps].join(', ')}): ` +
            'the Text Mapper plugin drew them differently than expected.',
          );
        }
        for (const directive of skippedDirectives) {
          // US-4.10 | AC-7: once per compile and directive.
          new Notice(`Vault Compiler: map directive "${directive}" could not be applied; the map is drawn as the plugin made it.`);
        }
      }

      await writer.writeText(outputFile, result.content);

      let warningsName: string | null = null;
      if (result.warningDetails?.length) {
        const now = new Date();
        const pad = (value: number) => String(value).padStart(2, '0');
        const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
        warningsName = `warnings_${stamp}.md`;
        const warningPath = joinOutputPath(outputDir, warningsName);
        const escapeCell = (value: unknown) =>
          String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
        const lines = [
          '# Compilation warnings',
          '',
          '| warning | original link | filename of imported file where the original link was | line number within that filename |',
          '|---|---|---|---|',
          ...result.warningDetails.map(detail =>
            `| ${escapeCell(detail.message)} | ${escapeCell(detail.link)} | ${escapeCell(detail.file)} | ${detail.line} |`
          ),
        ];
        await writer.writeText(warningPath, lines.join('\n'));
      }

      await this.verifySourceVaultUnchanged(sourceSnapshot, writer);

      // US-9.4 | AC-5: the wording lives in entries.ts.
      new Notice(completionNotice(result, warningsName));
    } catch (error) {
      new Notice(`Compilation failed: ${(error as Error).message}`);
    }
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * US-8.1 | AC-8.1-V: Fails the compile when a vault file changed or appeared,
   * other than the paths the output writer may write in the vault.
   */
  private async verifySourceVaultUnchanged(snapshot: Map<string, number>, writer: OutputWriter): Promise<void> {
    for (const file of this.app.vault.getFiles()) {
      if (writer.isOutputPath(file.path)) {
        continue;
      }
      const before = snapshot.get(file.path);
      if (before === undefined) {
        throw new Error(`Unexpected new vault file created during compilation: ${file.path}`);
      }
      if (before !== file.stat.mtime) {
        throw new Error(`Source vault file was modified during compilation: ${file.path}`);
      }
    }
  }

  /**
   * US-0.3 | AC-OL-7: Lets the user pick the output folder. A folder inside
   * the vault is given vault-relative, one outside as its absolute path.
   * Returns the folder, or `null` when nothing was chosen. It saves nothing:
   * the settings tab stores it, the export prompt uses it for one run
   * (US-7.3 | AC-4).
   */
  async pickOutputFolder(current: string): Promise<string | null> {
    let remoteDialog: any;
    try {
      remoteDialog = (window as any).require?.('@electron/remote')?.dialog;
    } catch {
      remoteDialog = undefined;
    }

    if (remoteDialog) {
      const result = await remoteDialog.showOpenDialog({ properties: ['openDirectory'], title: 'Choose output folder' });
      if (!result.canceled && result.filePaths?.length) {
        const absolute: string = result.filePaths[0];
        const vaultRoot = this.getVaultRoot();
        const relative = vaultRoot === null ? null : vaultRelativeFromAbsolute(absolute, vaultRoot);
        return relative ?? absolute;
      }
      return null;
    }
    return window.prompt('Output folder', current);
  }
}

/**
 * US-7.2, US-7.3 | AC-1 to AC-6: the export prompt of a file-menu compile.
 * Its values are used for this run only and never saved.
 */
class ExportPathModal extends Modal {
  private plugin: VaultCompilerPlugin;
  private run: CompileRun;

  constructor(app: App, plugin: VaultCompilerPlugin, run: CompileRun) {
    super(app);
    this.plugin = plugin;
    this.run = run;
  }

  /** US-7.3 | AC-1 to AC-6: folder and filename, the live path, Compile and Cancel. */
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Export compiled markdown' });

    const folder = new Setting(contentEl).setName('Output folder');
    // US-7.3 | AC-6: the resolved path is computed from this prompt's values.
    const showPath = () => folder.setDesc(`Resolved output path: ${this.plugin.getOutputPath(this.run)}`);
    showPath();
    let folderInput: { setValue(value: string): unknown } | null = null;
    folder
      .addText(text => {
        folderInput = text;
        text.setValue(this.run.outputFolder).onChange(value => {
          this.run.outputFolder = value;
          showPath();
        });
        this.confirmOnEnter(text.inputEl);
      })
      .addButton(button => button.setButtonText('Browse').onClick(async () => {
        // US-7.3 | AC-4: the picked folder goes into this prompt only.
        const chosen = await this.plugin.pickOutputFolder(this.run.outputFolder);
        if (chosen === null) return;
        this.run.outputFolder = chosen;
        folderInput?.setValue(chosen);
        showPath();
      }));

    new Setting(contentEl)
      .setName('Output filename')
      .addText(text => {
        text.setValue(this.run.outputFile).onChange(value => {
          this.run.outputFile = value;
          showPath();
        });
        this.confirmOnEnter(text.inputEl);
      });

    new Setting(contentEl)
      .addButton(button => button.setButtonText('Compile').setCta().onClick(() => this.compile()))
      .addButton(button => button.setButtonText('Cancel').onClick(() => this.close()));
  }

  /** US-7.3 | AC-3: compiles with this prompt's values; nothing is saved. */
  private compile(): void {
    const run = { ...this.run };
    this.close();
    void this.plugin.compileVault(run);
  }

  /** US-7.3 | AC-5: Enter in a field compiles, not while an input method composes. */
  private confirmOnEnter(input: HTMLInputElement): void {
    input.addEventListener('keydown', event => {
      if (!isConfirmKey(event)) return;
      event.preventDefault();
      this.compile();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class VaultCompilerSettingTab extends PluginSettingTab {
  plugin: VaultCompilerPlugin;

  constructor(app: App, plugin: VaultCompilerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /** US-7.1 | AC-S1: a value typed just before the window closes is still saved. */
  hide() {
    void this.plugin.settingsSaver.flush();
  }

  /**
   * US-0.3, US-7.1 | AC-S1, AC-S2: the settings. Text fields are saved after
   * typing stops; the resolved output path follows every change at once.
   */
  display() {
    const { containerEl } = this;
    containerEl.empty();
    const FOLDER_DESC =
      'Vault-relative folder for the compiled master file, or an absolute folder outside the vault ' +
      '(desktop app only). Resolved output path: ';
    let folder: Setting | null = null;
    let resolved: Setting | null = null;
    // US-7.1 | AC-S2: both places that show the resolved path.
    const showPaths = () => {
      const path = this.plugin.getOutputPath();
      folder?.setDesc(FOLDER_DESC + path);
      resolved?.setDesc(path);
    };

    new Setting(containerEl)
      .setName('Starting file')
      .setDesc('Vault-relative path of the markdown file used as the compilation entry point.')
      .addText(text =>
        text
          .setPlaceholder('index2compile.md')
          .setValue(this.plugin.settings.startingFile)
          .onChange(value => {
            this.plugin.settings.startingFile = value;
            this.plugin.settingsSaver.request();
            showPaths();
          })
      );

    folder = new Setting(containerEl)
      .setName('Output folder')
      .addText(text =>
        text
          .setPlaceholder('')
          .setValue(this.plugin.settings.outputFolder)
          .onChange(value => {
            this.plugin.settings.outputFolder = value;
            this.plugin.settingsSaver.request();
            showPaths();
          })
      )
      .addButton(button => button.setButtonText('Browse').onClick(async () => {
        const chosen = await this.plugin.pickOutputFolder(this.plugin.settings.outputFolder);
        if (chosen === null) return;
        this.plugin.settings.outputFolder = chosen;
        await this.plugin.saveSettings();
        this.display();
      }));

    new Setting(containerEl)
      .setName('Output filename')
      .setDesc('Filename of the compiled master file.')
      .addText(text =>
        text
          .setPlaceholder('compiledtext.md')
          .setValue(this.plugin.settings.outputFile)
          .onChange(value => {
            this.plugin.settings.outputFile = value;
            this.plugin.settingsSaver.request();
            showPaths();
          })
      );

    resolved = new Setting(containerEl).setName('Resolved output path');
    showPaths();

    new Setting(containerEl)
      .setName('Enable TextMapper rendering')
      .setDesc('Render text-mapper code blocks to PNG path references when supported.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enableTextMapper)
          .onChange(async value => {
            this.plugin.settings.enableTextMapper = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Map font')
      .setDesc(
        'Font for the text in compiled TextMapper maps, as a CSS font list (e.g. "Georgia, serif"). ' +
        'Leave empty to use the font Obsidian shows your notes in.'
      )
      .addText(text =>
        text
          .setPlaceholder('Obsidian note font')
          .setValue(this.plugin.settings.mapFont)
          .onChange(value => {
            this.plugin.settings.mapFont = value;
            this.plugin.settingsSaver.request();
          })
      );

    new Setting(containerEl)
      .setName('Tidy map labels')
      .setDesc(
        'In compiled maps, leave out the hex numbers, centre each label in its hex and break ' +
        'long labels into lines. Maps inside Obsidian are not changed.'
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.tidyMapLabels)
          .onChange(async value => {
            this.plugin.settings.tidyMapLabels = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Normalise headings')
      .setDesc(
        'Automatically adjust heading levels when embedding files, so each file\u2019s headings ' +
        'nest correctly within the document hierarchy. Files with a numeric prefix (e.g. "1.3.2 ") ' +
        'are placed at the corresponding depth; unprefixed files inherit depth from their parent.'
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.normaliseHeadings)
          .onChange(async value => {
            this.plugin.settings.normaliseHeadings = value;
            await this.plugin.saveSettings();
          })
      );

    // Epic 9 (#108): entry data from note properties.
    const listSetting = (name: string, desc: string, key: 'entryMarkerKeys' | 'entryExcludeKeys' | 'entryAssetKeys' | 'expectCompiledFolders') =>
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addText(text =>
          text
            .setPlaceholder('')
            .setValue(this.plugin.settings[key])
            .onChange(value => {
              this.plugin.settings[key] = value;
              this.plugin.settingsSaver.request();
            })
        );
    listSetting('Entry marker keys', 'A note with one of these properties (comma-separated) keeps its properties as an entry block. Empty: off.', 'entryMarkerKeys');
    listSetting('Entry exclude keys', 'Properties never written into an entry block (comma-separated).', 'entryExcludeKeys');
    listSetting('Entry image keys', 'Entry properties that name an image to copy (comma-separated).', 'entryAssetKeys');
    listSetting('Expect compiled folders', 'Notes in these folders that are never compiled are listed in the warnings file (comma-separated). Empty: off.', 'expectCompiledFolders');
  }
}
