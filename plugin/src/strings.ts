// US-7.4 AC-14: the one string table of the plugin's screens, menus and notices.
// Every text a control or a notice shows comes from here (a tooling test checks
// `plugin/src`); texts built from values are functions. The compiled output and
// the warnings file keep their texts in the compiler (owner, VC-7).

export const STRINGS = {
  empty: '',
  commands: {
    compile: 'Compile vault',
    compileDialog: 'Compile vault…',
    ribbon: 'Compile vault…',
  },
  menus: {
    compileFromFile: 'Compile vault from this file',
  },
  dialog: {
    title: 'Compile vault',
    startingFile: 'Starting file',
    outputFolder: 'Output folder',
    outputFile: 'Output filename',
    chooseFolder: 'Choose folder…',
    pickerTitle: 'Choose output folder',
    compile: 'Compile',
    moreOptions: 'More options',
    willWrite: (path: string): string => `${path} will be written.`,
    willReplace: (path: string, when: string): string =>
      `${path} exists (from ${when}) and will be replaced.`,
  },
  notices: {
    notStarted: (reason: string): string => `Compilation not started: ${reason}`,
    noStartingFile: 'Starting file not found.',
    compiled: (path: string, files: number, assets: number, deduplicated: number): string =>
      `✅ Compiled ${path}: ${files} files, ${assets} assets, ${deduplicated} deduplicated.`,
    failed: (message: string): string => `❌ Compilation failed: ${message}`,
    debugInfoCopied: 'Debug info copied.',
    repeatsOmitted: (n: number): string => `${n} duplicate ${n === 1 ? 'entry' : 'entries'} omitted`,
    notCompiled: (n: number): string => `${n} ${n === 1 ? 'note' : 'notes'} not compiled`,
    seeWarnings: (file: string): string => `: see ${file}.`,
    mapFontFailed: (family: string): string =>
      `Vault Compiler: map font "${family}" could not be embedded; maps use the next font in the list.`,
    noTextMapper:
      'Vault Compiler: the Text Mapper plugin is not installed or enabled, so maps are left as placeholders.',
    wideLabel: (alt: string): string => `Vault Compiler: a label in map "${alt}" has a word too wide for its hex.`,
    notTidied: (steps: string): string =>
      `Vault Compiler: some maps were not tidied (${steps}): the Text Mapper plugin drew them differently than expected.`,
    directiveSkipped: (directive: string): string =>
      `Vault Compiler: map directive "${directive}" could not be applied; the map is drawn as the plugin made it.`,
  },
  tab: {
    version: (v: string): string => `Vault Compiler ${v}`,
    copyDebugInfo: 'Copy debug info',
    resetSection: 'Reset this section to defaults',
    startingFileDesc: 'Vault-relative path of the markdown file used as the compilation entry point.',
    outputFolderDesc: (path: string): string =>
      `Vault-relative folder for the compiled master file, or an absolute folder outside the vault (desktop app only). Resolved output path: ${path}`,
    outputFileDesc: 'Filename of the compiled master file.',
    resolvedPath: 'Resolved output path',
    pathNotUsable: (reason: string): string => `not usable: ${reason}`,
    textMapper: 'Enable TextMapper rendering',
    textMapperDesc: 'Render text-mapper code blocks to PNG path references when supported.',
    mapSettings: 'Settings of the maps',
    mapFont: 'Map font',
    mapFontDesc:
      'Font for the text in compiled TextMapper maps, as a CSS font list (e.g. "Georgia, serif"). Leave empty to use the font Obsidian shows your notes in.',
    mapFontPlaceholder: 'Obsidian note font',
    tidyLabels: 'Tidy map labels',
    tidyLabelsDesc:
      'In compiled maps, leave out the hex numbers, centre each label in its hex and break long labels into lines. Maps inside Obsidian are not changed.',
    normalise: 'Normalise headings',
    normaliseDesc:
      'Automatically adjust heading levels when embedding files, so each file’s headings nest correctly within the document hierarchy. Files with a numeric prefix (e.g. "1.3.2 ") are placed at the corresponding depth; unprefixed files inherit depth from their parent.',
    entryMarker: 'Entry marker keys',
    entryMarkerDesc: 'A note with one of these properties (comma-separated) keeps its properties as an entry block. Empty: off.',
    entryExclude: 'Entry exclude keys',
    entryExcludeDesc: 'Properties never written into an entry block (comma-separated).',
    entryImage: 'Entry image keys',
    entryImageDesc: 'Entry properties that name an image to copy (comma-separated).',
    expectCompiled: 'Expect compiled folders',
    expectCompiledDesc: 'Notes in these folders that are never compiled are listed in the warnings file (comma-separated). Empty: off.',
    detailMarker: 'Detail marker keys',
    detailMarkerDesc:
      'A note with one of these properties (comma-separated) gets a details block with only these properties, in this order. Empty: off.',
    encounterCallout: 'Encounter callout type',
    encounterCalloutDesc: 'Callout type of an encounter list (empty: off)',
  },
  errors: {
    newVaultFile: (path: string): string => `Unexpected new vault file created during compilation: ${path}`,
    vaultFileModified: (path: string): string => `Source vault file was modified during compilation: ${path}`,
  },
  reasons: {
    fileEmpty: 'Output filename is empty.',
    fileHasFolder: (file: string): string =>
      `Output filename "${file}" must be a file name without "/" or "\\". Put folders into the output folder.`,
    fileNotAName: (file: string): string => `Output filename "${file}" is not a file name.`,
    backslash: (folder: string): string => `Output folder "${folder}" uses "\\"; use "/" between vault folders.`,
    configFolder: (folder: string, configDir: string): string =>
      `Output folder "${folder}" is inside the Obsidian config folder ${configDir}.`,
    isStartingFile: (path: string): string => `Output path "${path}" is the starting file.`,
    tilde: (folder: string): string =>
      `Output folder "${folder}" starts with "~". Use the full path, e.g. /Users/<name>/Desktop.`,
    dotDot: (folder: string): string => `Output folder "${folder}" must not contain "..".`,
    needsDesktop: (folder: string): string =>
      `Output folder "${folder}" is outside the vault; writing outside the vault needs the desktop app.`,
    missingFolder: (folder: string): string => `Output folder "${folder}" does not exist.`,
  },
  sections: {
    compile: 'Compile',
    maps: 'Maps',
    headings: 'Headings',
    entryData: 'Entry data',
  },
  questions: {
    resetTitle: (name: string): string => `Reset "${name}" to its defaults?`,
    resetLine: 'The settings of this section go back to their defaults.',
    reset: 'Reset',
    cancel: 'Cancel',
  },
} as const;
