/* eslint-disable @typescript-eslint/no-explicit-any */
import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { InMemoryVaultCompiler } from './compiler.ts';
import { ObsidianLinkResolver } from './resolver.ts';
import { ObsidianAssetManager } from './assets.ts';
import { computeContentHash } from './utils.ts';
import {
  joinOutputPath,
  resolveOutputLocation,
  vaultRelativeFromAbsolute,
  type OutputLocationResult,
} from './output-location.ts';
import { OutputWriter, type WriterFs } from './output-writer.ts';
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
}

const DEFAULT_SETTINGS: VaultCompilerSettings = {
  startingFile: 'index2compile.md',
  outputFolder: '',
  outputFile: 'compiledtext.md',
  enableTextMapper: true,
  normaliseHeadings: false,
  mapFont: '',
  tidyMapLabels: true,
};

export default class VaultCompilerPlugin extends Plugin {
  settings: VaultCompilerSettings;

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
                this.settings.startingFile = file.path;
                void this.saveSettings();
                new ExportPathModal(this.app, this).open();
              });
          });
        }
      })
    );

    this.addSettingTab(new VaultCompilerSettingTab(this.app, this));
  }

  onunload() {}

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
  getOutputPath(): string {
    const resolved = this.resolveOutputLocation();
    return resolved.ok ? resolved.location.outputPath : `not usable: ${resolved.reason}`;
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
  resolveOutputLocation(): OutputLocationResult {
    const fs = this.getNodeFs();
    return resolveOutputLocation({
      folder: this.settings.outputFolder,
      file: this.settings.outputFile,
      startingFile: this.settings.startingFile,
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
  async compileVault() {
    const resolved = this.resolveOutputLocation();
    if (!resolved.ok) {
      new Notice(`Compilation not started: ${resolved.reason}`);
      return;
    }
    const location = resolved.location;
    const writer = new OutputWriter(location, this.app.vault, this.getNodeFs());

    const startingFile = this.app.vault.getAbstractFileByPath(this.settings.startingFile);
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
      });

      const result = compiler.compile(this.settings.startingFile);

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

      if (result.warningDetails?.length) {
        const now = new Date();
        const pad = (value: number) => String(value).padStart(2, '0');
        const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
        const warningPath = joinOutputPath(outputDir, `warnings_${stamp}.md`);
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

      new Notice(
        `Compilation complete: ${result.stats.filesProcessed} files, ${result.stats.assetsCopied} assets, ${result.stats.assetsDeduplicated} deduplicated.`
      );
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
   * the vault is stored vault-relative, one outside as its absolute path.
   * Returns the stored folder, or `null` when nothing was chosen.
   */
  async chooseOutputFolder(): Promise<string | null> {
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
        this.settings.outputFolder = relative ?? absolute;
        await this.saveSettings();
        return this.settings.outputFolder;
      }
      return null;
    }
    const entered = window.prompt('Output folder', this.settings.outputFolder);
    if (entered === null) return null;
    this.settings.outputFolder = entered;
    await this.saveSettings();
    return entered;
  }
}

class ExportPathModal extends Modal {
  private plugin: VaultCompilerPlugin;
  private folderInput: any;
  private fileInput: any;

  constructor(app: App, plugin: VaultCompilerPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Export compiled markdown' });

    new Setting(contentEl)
      .setName('Output folder')
      .setDesc(`Resolved output path: ${this.plugin.getOutputPath()}`)
      .addText(text => {
        this.folderInput = text;
        text.setValue(this.plugin.settings.outputFolder);
      })
      .addButton(button => button.setButtonText('Browse').onClick(async () => {
        const chosen = await this.plugin.chooseOutputFolder();
        if (chosen !== null) this.folderInput.setValue(chosen);
      }));

    new Setting(contentEl)
      .setName('Output filename')
      .addText(text => {
        this.fileInput = text;
        text.setValue(this.plugin.settings.outputFile);
      });

    new Setting(contentEl)
      .addButton(button => button.setButtonText('Compile').setCta().onClick(async () => {
        this.plugin.settings.outputFolder = this.folderInput.getValue();
        this.plugin.settings.outputFile = this.fileInput.getValue();
        await this.plugin.saveSettings();
        this.close();
        await this.plugin.compileVault();
      }))
      .addButton(button => button.setButtonText('Cancel').onClick(() => this.close()));
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

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Starting file')
      .setDesc('Vault-relative path of the markdown file used as the compilation entry point.')
      .addText(text =>
        text
          .setPlaceholder('index2compile.md')
          .setValue(this.plugin.settings.startingFile)
          .onChange(async value => {
            this.plugin.settings.startingFile = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Output folder')
      .setDesc(
        'Vault-relative folder for the compiled master file, or an absolute folder outside the vault ' +
        `(desktop app only). Resolved output path: ${this.plugin.getOutputPath()}`
      )
      .addText(text =>
        text
          .setPlaceholder('')
          .setValue(this.plugin.settings.outputFolder)
          .onChange(async value => {
            this.plugin.settings.outputFolder = value;
            await this.plugin.saveSettings();
          })
      )
      .addButton(button => button.setButtonText('Browse').onClick(async () => {
        if ((await this.plugin.chooseOutputFolder()) !== null) this.display();
      }));

    new Setting(containerEl)
      .setName('Output filename')
      .setDesc('Filename of the compiled master file.')
      .addText(text =>
        text
          .setPlaceholder('compiledtext.md')
          .setValue(this.plugin.settings.outputFile)
          .onChange(async value => {
            this.plugin.settings.outputFile = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setName('Resolved output path').setDesc(this.plugin.getOutputPath());

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
          .onChange(async value => {
            this.plugin.settings.mapFont = value;
            await this.plugin.saveSettings();
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
  }
}
