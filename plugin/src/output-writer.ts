/**
 * The one place where a compile writes (US-8.1 AC-8.1-W).
 *
 * Every write checks its path against the output location first. A vault
 * location is written with the vault API; an outside location with Node.js
 * fs, which the plugin passes in on the desktop app only. Only type imports,
 * so the tests run this module directly.
 */
import type { OutputLocation } from './output-location.ts';

/** The vault calls the writer uses; `app.vault` satisfies it. */
export interface WriterVault {
  getAbstractFileByPath(path: string): unknown;
  create(path: string, data: string): Promise<unknown>;
  modify(file: never, data: string): Promise<unknown>;
  createBinary(path: string, data: ArrayBuffer): Promise<unknown>;
  createFolder(path: string): Promise<unknown>;
}

/** The Node.js fs calls the writer uses for an outside location. */
export interface WriterFs {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options: { recursive: true }): unknown;
  writeFileSync(path: string, data: string | Uint8Array): void;
}

const WARNINGS_FILE = /^warnings_\d{8}_\d{4}\.md$/;

/**
 * US-8.1 | AC-8.1-W: Splits a path into its folder and its last name at the
 * last `/` (all output paths are joined with `/`).
 */
function splitPath(path: string): { parent: string; name: string } {
  const index = path.lastIndexOf('/');
  return index === -1
    ? { parent: '', name: path }
    : { parent: path.slice(0, index), name: path.slice(index + 1) };
}

export class OutputWriter {
  readonly location: OutputLocation;
  private readonly vault: WriterVault;
  private readonly fs: WriterFs | null;

  /**
   * US-8.1 | AC-8.1-W: A writer for one compile's output location. `fs` is
   * Node.js fs on the desktop app and `null` on mobile.
   */
  constructor(location: OutputLocation, vault: WriterVault, fs: WriterFs | null) {
    this.location = location;
    this.vault = vault;
    this.fs = fs;
  }

  /**
   * US-8.1 | AC-8.1-W: A file a compile may write: the output file, a
   * warnings logfile directly in the output folder, or a file under
   * `assets/`.
   */
  private isAllowedFile(path: string): boolean {
    if (path.split(/[\\/]/).includes('..')) return false;
    const { folder, outputPath, assetsFolder } = this.location;
    if (path === outputPath) return true;
    const { parent, name } = splitPath(path);
    if (parent === folder && WARNINGS_FILE.test(name)) return true;
    return path.startsWith(`${assetsFolder}/`);
  }

  /**
   * US-8.1 | AC-8.1-W: A folder a compile may create: `assets/` and below,
   * and, in the vault, the output folder and its parents.
   */
  private isAllowedFolder(path: string): boolean {
    if (path === '' || path.split(/[\\/]/).includes('..')) return false;
    const { kind, folder, assetsFolder } = this.location;
    if (path === assetsFolder || path.startsWith(`${assetsFolder}/`)) return true;
    return kind === 'vault' && (path === folder || folder.startsWith(`${path}/`));
  }

  /**
   * US-8.1 | AC-8.1-W: Throws before any write to a path outside the output
   * location.
   */
  private assertAllowed(path: string, type: 'file' | 'folder'): void {
    const allowed = type === 'file' ? this.isAllowedFile(path) : this.isAllowedFolder(path);
    if (!allowed) {
      throw new Error(`Refused to write "${path}": not part of the output location.`);
    }
  }

  /**
   * US-0.3 | AC-OL-2: Returns Node.js fs for an outside location, or throws
   * where there is none (mobile).
   */
  private requireFs(): WriterFs {
    if (!this.fs) throw new Error('Writing outside the vault needs the desktop app.');
    return this.fs;
  }

  /**
   * US-8.1 | AC-8.1-V: True for a vault path this compile may leave behind,
   * so the source-vault check skips it. Always false for an outside location.
   */
  isOutputPath(path: string): boolean {
    return this.location.kind === 'vault' && this.isAllowedFile(path);
  }

  /**
   * US-0.3 | AC: confirmation before overwriting — whether a file or folder
   * already exists at `path`, in the vault or outside it.
   */
  exists(path: string): boolean {
    if (this.location.kind === 'vault') return this.vault.getAbstractFileByPath(path) !== null;
    return this.fs !== null && this.fs.existsSync(path);
  }

  /**
   * US-8.1 | AC-8.1-W: Creates an allowed folder and, in the vault, each
   * missing parent. The whole folder is checked before the first call.
   */
  async ensureFolder(folder: string): Promise<void> {
    this.assertAllowed(folder, 'folder');
    if (this.location.kind === 'outside') {
      const fs = this.requireFs();
      fs.mkdirSync(folder, { recursive: true });
      return;
    }
    let current = '';
    for (const part of folder.split('/')) {
      current = current ? `${current}/${part}` : part;
      this.assertAllowed(current, 'folder');
      if (this.vault.getAbstractFileByPath(current) === null) {
        await this.vault.createFolder(current);
      }
    }
  }

  /**
   * US-8.1 | AC-8.1-W: Creates the parent folder of an allowed file unless it
   * is the vault root or the outside output folder (which must exist).
   */
  private async ensureParent(path: string): Promise<void> {
    const { parent } = splitPath(path);
    if (parent === '' || (this.location.kind === 'outside' && parent === this.location.folder)) return;
    await this.ensureFolder(parent);
  }

  /**
   * US-0.3, US-8.4 | AC-8.1-W: Writes the output file or the warnings
   * logfile, replacing an existing one.
   */
  async writeText(path: string, content: string): Promise<void> {
    this.assertAllowed(path, 'file');
    if (this.location.kind === 'outside') {
      const fs = this.requireFs();
      await this.ensureParent(path);
      fs.writeFileSync(path, content);
      return;
    }
    await this.ensureParent(path);
    const existing = this.vault.getAbstractFileByPath(path);
    if (existing !== null) {
      await this.vault.modify(existing as never, content);
    } else {
      await this.vault.create(path, content);
    }
  }

  /**
   * US-2.1, US-4.1 | AC-8.1-W: Writes a copied asset or a rendered PNG under
   * `assets/`, keeping a file that already exists.
   */
  async writeBinaryIfAbsent(path: string, data: ArrayBuffer): Promise<void> {
    this.assertAllowed(path, 'file');
    if (this.location.kind === 'outside') {
      const fs = this.requireFs();
      if (fs.existsSync(path)) return;
      await this.ensureParent(path);
      fs.writeFileSync(path, new Uint8Array(data));
      return;
    }
    if (this.vault.getAbstractFileByPath(path) !== null) return;
    await this.ensureParent(path);
    await this.vault.createBinary(path, data);
  }
}
