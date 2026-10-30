/**
 * Output location rules (US-0.3 AC-OL-1 to AC-OL-7).
 *
 * Turns the output folder and filename from the settings, `Browse` or the
 * export prompt into either a vault-relative location or an absolute folder
 * outside the vault, or a refusal with its reason. Pure functions; no
 * Obsidian or Node.js imports, so the tests run them directly.
 */

/** Where a compile writes: the output file, `assets/` and the warnings logfile. */
export interface OutputLocation {
  /** `vault`: written with the vault API. `outside`: written with Node.js fs. */
  kind: 'vault' | 'outside';
  /** Vault-relative folder (`''` is the vault root) or absolute folder. */
  folder: string;
  outputPath: string;
  assetsFolder: string;
}

export type OutputLocationResult =
  | { ok: true; location: OutputLocation }
  | { ok: false; reason: string };

export interface OutputLocationRequest {
  folder: string;
  file: string;
  startingFile: string;
  /** The vault's config folder, normally `.obsidian`. */
  configDir: string;
  /** Absolute vault root on the desktop app; `null` on mobile. */
  vaultRoot: string | null;
  /** Asked only for an absolute folder outside the vault. */
  folderExists: (absolute: string) => boolean;
}

/**
 * US-0.3 | AC-OL-2: Recognises an absolute OS folder.
 *
 * POSIX `/…`, Windows `C:\…` or `C:/…`, and UNC `\\server\…`.
 */
export function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\');
}

/**
 * US-0.3 | AC-OL-2: Drops trailing separators, but keeps a root (`/`, `C:\`).
 */
function stripTrailingSeparators(path: string): string {
  let result = path;
  while (result.length > 1 && /[\\/]$/.test(result) && !/^[A-Za-z]:[\\/]$/.test(result)) {
    result = result.slice(0, -1);
  }
  return result;
}

/**
 * US-0.3 | AC-OL-1, AC-OL-2: Joins a folder and a name with `/`.
 *
 * An empty folder is the vault root; a folder that already ends with a
 * separator (a filesystem root) gets none added.
 */
export function joinOutputPath(folder: string, name: string): string {
  if (!folder) return name;
  return /[\\/]$/.test(folder) ? `${folder}${name}` : `${folder}/${name}`;
}

/**
 * US-0.3 | AC-OL-3, AC-OL-7: Returns the vault-relative folder for an absolute
 * folder that is the vault root or lies under it, else `null`.
 *
 * "Under" needs a separator after the root, so `/v/Rovers Backup` is not
 * under `/v/Rovers`. Both separators are accepted on both sides.
 */
export function vaultRelativeFromAbsolute(absolute: string, vaultRoot: string): string | null {
  const root = stripTrailingSeparators(vaultRoot.replace(/\\/g, '/'));
  const path = stripTrailingSeparators(absolute.replace(/\\/g, '/'));
  if (path === root) return '';
  if (path.startsWith(`${root}/`)) return path.slice(root.length + 1);
  return null;
}

/**
 * US-0.3 | AC-OL-5: Checks that the filename is a plain file name.
 */
function checkFileName(file: string): string | null {
  if (file === '') return 'Output filename is empty.';
  if (/[\\/]/.test(file)) {
    return `Output filename "${file}" must be a file name without "/" or "\\". Put folders into the output folder.`;
  }
  if (file === '.' || file === '..') return `Output filename "${file}" is not a file name.`;
  return null;
}

/**
 * US-0.3 | AC-OL-1, AC-OL-4, AC-OL-6: Builds a vault location from a
 * vault-relative folder, or refuses it.
 *
 * `shownFolder` is the folder as the user gave it, for the reason text.
 */
function vaultLocation(folder: string, shownFolder: string, request: OutputLocationRequest): OutputLocationResult {
  if (folder.includes('\\')) {
    return { ok: false, reason: `Output folder "${shownFolder}" uses "\\"; use "/" between vault folders.` };
  }
  const normalised = folder.split('/').filter(part => part !== '' && part !== '.').join('/');
  const configDir = request.configDir;
  if (normalised === configDir || normalised.startsWith(`${configDir}/`)) {
    return {
      ok: false,
      reason: `Output folder "${shownFolder}" is inside the Obsidian config folder ${configDir}.`,
    };
  }
  const outputPath = joinOutputPath(normalised, request.file);
  if (outputPath === request.startingFile) {
    return { ok: false, reason: `Output path "${outputPath}" is the starting file.` };
  }
  return {
    ok: true,
    location: {
      kind: 'vault',
      folder: normalised,
      outputPath,
      assetsFolder: joinOutputPath(normalised, 'assets'),
    },
  };
}

/**
 * US-0.3 | AC-OL-1 to AC-OL-6: Resolves the output folder and filename into
 * the location a compile writes to, or the reason it must not run.
 *
 * Checked in this order: filename, `~`, `..`, absolute (inside the vault →
 * vault rules; outside → desktop only and the folder must exist), then the
 * vault rules (backslash, config folder, starting file).
 */
export function resolveOutputLocation(request: OutputLocationRequest): OutputLocationResult {
  const { folder, file } = request;
  const fileProblem = checkFileName(file);
  if (fileProblem) return { ok: false, reason: fileProblem };

  if (folder.startsWith('~')) {
    return {
      ok: false,
      reason: `Output folder "${folder}" starts with "~". Use the full path, e.g. /Users/<name>/Desktop.`,
    };
  }
  if (folder.split(/[\\/]/).includes('..')) {
    return { ok: false, reason: `Output folder "${folder}" must not contain "..".` };
  }

  if (!isAbsolutePath(folder)) return vaultLocation(folder, folder, request);

  const inVault = request.vaultRoot === null ? null : vaultRelativeFromAbsolute(folder, request.vaultRoot);
  if (inVault !== null) return vaultLocation(inVault, folder, request);

  if (request.vaultRoot === null) {
    return {
      ok: false,
      reason: `Output folder "${folder}" is outside the vault; writing outside the vault needs the desktop app.`,
    };
  }
  const absolute = stripTrailingSeparators(folder);
  if (!request.folderExists(absolute)) {
    return { ok: false, reason: `Output folder "${absolute}" does not exist.` };
  }
  return {
    ok: true,
    location: {
      kind: 'outside',
      folder: absolute,
      outputPath: joinOutputPath(absolute, file),
      assetsFolder: joinOutputPath(absolute, 'assets'),
    },
  };
}
