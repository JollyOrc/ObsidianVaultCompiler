import { App, TFile } from 'obsidian';

export class ObsidianLinkResolver {
  constructor(private app: App) {}

  resolve(raw: string, currentPath: string): string | null {
    const trimmed = raw.trim();
    let link = trimmed;
    if (link.startsWith('!')) link = link.slice(1);
    if (link.includes('#')) link = link.split('#')[0];
    link = decodeURIComponent(link);

    try {
      const metadataCache = this.app.metadataCache as {
        getFirstLinkpathDest?: (link: string, sourcePath: string) => TFile | null;
      };
      const dest = metadataCache.getFirstLinkpathDest?.(link, currentPath) ?? null;
      if (dest instanceof TFile) {
        return dest.path;
      }
    } catch {
      // Fall back to search.
    }

    const matches = this.app.vault.getFiles().filter(file => file.name.toLowerCase() === this.basename(link).toLowerCase());
    if (matches.length === 0) return null;
    return [...matches].sort((a, b) => a.path.localeCompare(b.path))[0].path;
  }

  private basename(path: string): string {
    const parts = path.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1];
  }
}
