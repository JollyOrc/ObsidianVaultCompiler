/**
 * US-7.4 | AC-13 (G2, 2026-11-18): the text of Copy debug info. Written before
 * the code.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('US-7.4 AC-13: the debug info text', () => {
  it('versions, the enabled plugins sorted by id, the settings file, a closing line break', async () => {
    const { debugInfo } = await import('../../plugin/src/debug-info.ts');
    assert.equal(
      debugInfo({
        pluginVersion: '0.25.0',
        obsidianVersion: '1.15.1',
        settingsText: '{"outputFolder":"Exports"}',
        plugins: [
          { id: 'text-mapper', version: '1.2.0' },
          { id: 'obsidian-vault-compiler', version: '0.25.0' },
          { id: 'dataview', version: '0.5.70' },
        ],
      }),
      [
        'Vault Compiler 0.25.0',
        'Obsidian 1.15.1',
        'Enabled plugins:',
        '- dataview 0.5.70',
        '- obsidian-vault-compiler 0.25.0',
        '- text-mapper 1.2.0',
        'Settings file:',
        '{"outputFolder":"Exports"}',
        '',
      ].join('\n'),
    );
  });

  it('no settings file, no plugins', async () => {
    const { debugInfo } = await import('../../plugin/src/debug-info.ts');
    assert.equal(
      debugInfo({ pluginVersion: '0.25.0', obsidianVersion: '1.15.1', settingsText: null, plugins: [] }),
      'Vault Compiler 0.25.0\nObsidian 1.15.1\nEnabled plugins:\nSettings file:\n(no settings file)\n',
    );
  });
});
