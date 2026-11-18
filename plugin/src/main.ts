/* eslint-disable @typescript-eslint/no-explicit-any */
import { Notice, Plugin, TFile, apiVersion, normalizePath } from 'obsidian';
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
import { CompileDialog } from './compile-dialog.ts';
import type { CompileRun } from './compile-dialog-rules.ts';
import { debugInfo } from './debug-info.ts';
import { failedNotice } from './notices.ts';
import { DEFAULT_SETTINGS, type VaultCompilerSettings } from './settings-layout.ts';
import { VaultCompilerSettingTab } from './settings-tab.ts';
import { STRINGS } from './strings.ts';
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

export default class VaultCompilerPlugin extends Plugin {
  settings: VaultCompilerSettings;
  /** US-7.4 | AC-12: the settings tab, flushed on unload. */
  private settingTab: VaultCompilerSettingTab | null = null;

  async onload() {
    await this.loadSettings();

    // US-7.4 AC-1: the direct command, the dialog command and the ribbon icon.
    this.addCommand({
      id: 'compile-vault',
      name: STRINGS.commands.compile,
      callback: () => void this.compileVault(),
    });
    this.addCommand({
      id: 'compile-vault-dialog',
      name: STRINGS.commands.compileDialog,
      callback: () => new CompileDialog(this.app, this, this.settingsRun(), 'settings').open(),
    });
    this.addRibbonIcon('combine', STRINGS.commands.ribbon, () =>
      new CompileDialog(this.app, this, this.settingsRun(), 'settings').open(),
    );

    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (file instanceof TFile && file.extension.toLowerCase() === 'md') {
          menu.addItem(item => {
            item
              .setTitle(STRINGS.menus.compileFromFile)
              .setIcon('document')
              .onClick(() => {
                // US-7.2 | AC-3, US-7.4 AC-1: the dialog; the note is this run's starting file.
                new CompileDialog(this.app, this, { ...this.settingsRun(), startingFile: file.path }, 'file-menu').open();
              });
          });
        }
      })
    );

    this.settingTab = new VaultCompilerSettingTab(this.app, this);
    this.addSettingTab(this.settingTab);
  }

  /** US-7.4 | AC-12: a value typed just before switching off is still saved. */
  onunload() {
    this.settingTab?.flushAll();
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
      new Notice(STRINGS.notices.notStarted(resolved.reason), 5000);
      return;
    }
    const location = resolved.location;
    const writer = new OutputWriter(location, this.app.vault, this.getNodeFs());

    const startingFile = this.app.vault.getAbstractFileByPath(run.startingFile);
    if (!(startingFile instanceof TFile)) {
      new Notice(STRINGS.notices.noStartingFile, 5000);
      return;
    }

    // US-7.4 AC-3: the tool replaces its own output; no question, no start notice.
    const outputFile = location.outputPath;

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
          new Notice(STRINGS.notices.mapFontFailed(family), 5000);
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
        detailMarkerKeys: parseListSetting(this.settings.detailMarkerKeys, { lowerCase: true }),
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
          new Notice(STRINGS.notices.noTextMapper, 5000);
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
              new Notice(STRINGS.notices.wideLabel(alt), 5000);
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
          new Notice(STRINGS.notices.notTidied([...skippedSteps].join(', ')), 5000);
        }
        for (const directive of skippedDirectives) {
          // US-4.10 | AC-7: once per compile and directive.
          new Notice(STRINGS.notices.directiveSkipped(directive), 5000);
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
      new Notice(completionNotice(result, warningsName, location.outputPath), 5000);
    } catch (error) {
      new Notice(failedNotice((error as Error).message), 5000);
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
        throw new Error(STRINGS.errors.newVaultFile(file.path));
      }
      if (before !== file.stat.mtime) {
        throw new Error(STRINGS.errors.vaultFileModified(file.path));
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
      const result = await remoteDialog.showOpenDialog({ properties: ['openDirectory'], title: STRINGS.dialog.pickerTitle });
      if (!result.canceled && result.filePaths?.length) {
        const absolute: string = result.filePaths[0];
        const vaultRoot = this.getVaultRoot();
        const relative = vaultRoot === null ? null : vaultRelativeFromAbsolute(absolute, vaultRoot);
        return relative ?? absolute;
      }
      return null;
    }
    return window.prompt(STRINGS.dialog.outputFolder, current);
  }

  /**
   * US-7.4 | AC-3: The existing output file's modification time, or null when
   * there is none (or the location is refused).
   */
  outputModified(result: OutputLocationResult): Date | null {
    if (!result.ok) return null;
    const { location } = result;
    if (location.kind === 'vault') {
      const file = this.app.vault.getAbstractFileByPath(location.outputPath);
      return file instanceof TFile ? new Date(file.stat.mtime) : null;
    }
    const fs = this.getNodeFs() as unknown as { existsSync(p: string): boolean; statSync(p: string): { mtime: Date } } | null;
    return fs && fs.existsSync(location.outputPath) ? fs.statSync(location.outputPath).mtime : null;
  }

  /**
   * US-7.4 | AC-13: Gathers the debug info at the click, copies it, then a
   * notice. The enabled plugins are private API: a structural type.
   */
  async copyDebugInfo(): Promise<void> {
    const adapter = this.app.vault.adapter;
    const file = normalizePath(`${this.manifest.dir ?? ''}/data.json`);
    const plugins = (this.app as unknown as {
      plugins?: { enabledPlugins?: Set<string>; manifests?: Record<string, { version: string }> };
    }).plugins;
    const text = debugInfo({
      pluginVersion: this.manifest.version,
      obsidianVersion: apiVersion,
      settingsText: (await adapter.exists(file)) ? await adapter.read(file) : null,
      plugins: [...(plugins?.enabledPlugins ?? [])].map((id) => ({ id, version: plugins?.manifests?.[id]?.version ?? '?' })),
    });
    await navigator.clipboard.writeText(text);
    new Notice(STRINGS.notices.debugInfoCopied, 5000);
  }
}
