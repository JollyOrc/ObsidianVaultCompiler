import { App, TFile } from 'obsidian';
import type { OutputWriter } from './output-writer.ts';

export class ObsidianAssetManager {
  private sourceToAsset = new Map<string, string>();

  constructor(private app: App) {}

  getDestination(sourcePath: string, outputDir: string, usedNames: Set<string>): string {
    if (this.sourceToAsset.has(sourcePath)) {
      return this.sourceToAsset.get(sourcePath)!;
    }

    const source = this.app.vault.getAbstractFileByPath(sourcePath);
    const base = source instanceof TFile ? source.name : sourcePath.split('/').pop() || sourcePath;
    let unique = base;
    if (usedNames.has(unique)) {
      const dotIndex = base.lastIndexOf('.');
      const stem = dotIndex > 0 ? base.slice(0, dotIndex) : base;
      const ext = dotIndex > 0 ? base.slice(dotIndex) : '';
      let i = 1;
      while (usedNames.has(`${stem}_${i}${ext}`)) {
        i += 1;
      }
      unique = `${stem}_${i}${ext}`;
    }
    usedNames.add(unique);
    const relative = `assets/${unique}`;
    const destination = outputDir ? `${outputDir}/${relative}` : relative;
    this.sourceToAsset.set(sourcePath, destination);
    return destination;
  }

  /**
   * US-2.1 | AC-8.1-W: Copies a vault file to `destinationPath` through the
   * output writer, which checks the path; an existing copy is kept.
   */
  async copy(sourcePath: string, destinationPath: string, writer: OutputWriter): Promise<void> {
    if (writer.exists(destinationPath)) return;
    const source = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(source instanceof TFile)) return;
    const data = await this.app.vault.readBinary(source);
    await writer.writeBinaryIfAbsent(destinationPath, data);
  }

  getSourceToAsset(): ReadonlyMap<string, string> {
    return this.sourceToAsset;
  }
}
