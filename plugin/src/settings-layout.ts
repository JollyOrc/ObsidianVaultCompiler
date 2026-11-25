// US-7.4 AC-11: the settings, their defaults and their sections. No Obsidian import.
import { STRINGS } from './strings.ts';

/** US-0.3, US-4.8, US-4.9, US-6.3, US-7.1, Epic 9: the plugin's settings. */
export interface VaultCompilerSettings {
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
  detailMarkerKeys: string;
  /** US-9.6: the callout type of an encounter list; empty → off. */
  encounterCalloutType: string;
}

export const DEFAULT_SETTINGS: VaultCompilerSettings = {
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
  detailMarkerKeys: '',
  encounterCalloutType: 'encounter',
};

type Key = keyof VaultCompilerSettings;

/** US-7.4 | AC-11: a collapsible section of the settings tab. */
export interface SettingsSection {
  name: string;
  keys: readonly Key[];
  /** A feature row: its toggle, and the keys behind its gear. */
  feature?: { toggle: Key; gear: readonly Key[] };
}

/** US-7.4 | AC-11: the four sections, in order; every key in exactly one. */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { name: STRINGS.sections.compile, keys: ['startingFile', 'outputFolder', 'outputFile'] },
  {
    name: STRINGS.sections.maps,
    keys: ['enableTextMapper', 'mapFont', 'tidyMapLabels'],
    feature: { toggle: 'enableTextMapper', gear: ['mapFont', 'tidyMapLabels'] },
  },
  { name: STRINGS.sections.headings, keys: ['normaliseHeadings'] },
  {
    name: STRINGS.sections.entryData,
    keys: ['entryMarkerKeys', 'entryExcludeKeys', 'entryAssetKeys', 'expectCompiledFolders', 'detailMarkerKeys', 'encounterCalloutType'],
  },
];

/**
 * US-7.4 | AC-11: A copy of `settings` with the keys of the section `name`
 * at their defaults; every other value kept; `settings` is not changed.
 */
export function sectionReset(settings: VaultCompilerSettings, name: string): VaultCompilerSettings {
  const copy: VaultCompilerSettings = { ...settings };
  const section = SETTINGS_SECTIONS.find((s) => s.name === name);
  for (const key of section?.keys ?? []) {
    (copy as unknown as Record<string, unknown>)[key] = DEFAULT_SETTINGS[key];
  }
  return copy;
}

/** US-7.4 | AC-11: the question before a section reset (`Cancel` first: F1). */
export function resetQuestion(name: string): {
  title: string;
  lines: string[];
  confirmLabel: string;
  cancelLabel: string;
} {
  return {
    title: STRINGS.questions.resetTitle(name),
    lines: [STRINGS.questions.resetLine],
    confirmLabel: STRINGS.questions.reset,
    cancelLabel: STRINGS.questions.cancel,
  };
}
