// US-7.4 AC-13: the text of Copy debug info. No Obsidian import: the plugin
// gathers the facts and copies the text.

/** What the debug info names. */
export interface DebugFacts {
  pluginVersion: string;
  obsidianVersion: string;
  /** The settings file's text, or null when there is none. */
  settingsText: string | null;
  plugins: readonly { id: string; version: string }[];
}

/**
 * US-7.4 | AC-13: The debug info as plain text: the versions, the enabled
 * plugins sorted by id, the settings file; it ends with a line break.
 */
export function debugInfo(facts: DebugFacts): string {
  const plugins = [...facts.plugins]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((p) => `- ${p.id} ${p.version}`);
  return [
    `Vault Compiler ${facts.pluginVersion}`,
    `Obsidian ${facts.obsidianVersion}`,
    'Enabled plugins:',
    ...plugins,
    'Settings file:',
    facts.settingsText ?? '(no settings file)',
    '',
  ].join('\n');
}
