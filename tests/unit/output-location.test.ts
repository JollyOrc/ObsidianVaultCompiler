/**
 * Unit tests for the output location rules (US-0.3 AC-OL-1 to AC-OL-7).
 *
 * Found 2026-10-27: the folder `/Users/user/Desktop`, chosen with Browse,
 * was used as the vault path `Users/user/Desktop`, so the compile wrote
 * into the vault. Every row of the AC-OL tables is tested here with the
 * values the real callers pass: the settings tab and the export prompt pass
 * the field text as typed, Browse passes the picker's absolute path, and on
 * mobile there is no vault root.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveOutputLocation,
  vaultRelativeFromAbsolute,
  type OutputLocationRequest,
} from '../../plugin/src/output-location.ts';

const VAULT_ROOT = '/Users/user/Vault';

/** The request the plugin builds on the desktop app, with overrides. */
function request(overrides: Partial<OutputLocationRequest>): OutputLocationRequest {
  return {
    folder: '',
    file: 'Book.md',
    startingFile: 'index2compile.md',
    configDir: '.obsidian',
    vaultRoot: VAULT_ROOT,
    folderExists: () => true,
    ...overrides,
  };
}

function resolveOk(overrides: Partial<OutputLocationRequest>) {
  const result = resolveOutputLocation(request(overrides));
  assert.equal(result.ok, true, result.ok ? '' : result.reason);
  return result.ok ? result.location : (undefined as never);
}

function resolveReason(overrides: Partial<OutputLocationRequest>): string {
  const result = resolveOutputLocation(request(overrides));
  assert.equal(result.ok, false, 'expected a refusal');
  return result.ok ? '' : result.reason;
}

describe('US-0.3 AC-OL-1 — vault-relative folder', () => {
  const rows: Array<[string, string, string, string]> = [
    ['', 'Book.md', 'Book.md', 'assets'],
    ['Exports', 'Book.md', 'Exports/Book.md', 'Exports/assets'],
    ['Exports/', 'Book.md', 'Exports/Book.md', 'Exports/assets'],
    ['./Exports//2026', 'Book.md', 'Exports/2026/Book.md', 'Exports/2026/assets'],
  ];
  for (const [folder, file, outputPath, assetsFolder] of rows) {
    it(`folder "${folder}" + "${file}" → ${outputPath} in the vault`, () => {
      const location = resolveOk({ folder, file });
      assert.equal(location.kind, 'vault');
      assert.equal(location.outputPath, outputPath);
      assert.equal(location.assetsFolder, assetsFolder);
    });
  }
});

describe('US-0.3 AC-OL-2 — absolute folder outside the vault', () => {
  it('the 2026-10-27 case: /Users/user/Desktop writes on the Desktop, not into the vault', () => {
    const location = resolveOk({ folder: '/Users/user/Desktop', file: 'My Book.md' });
    assert.equal(location.kind, 'outside');
    assert.equal(location.folder, '/Users/user/Desktop');
    assert.equal(location.outputPath, '/Users/user/Desktop/My Book.md');
    assert.equal(location.assetsFolder, '/Users/user/Desktop/assets');
    assert.notEqual(location.outputPath, 'Users/user/Desktop/My Book.md');
  });

  it('a trailing separator is dropped', () => {
    const location = resolveOk({ folder: '/Users/user/Desktop/' });
    assert.equal(location.outputPath, '/Users/user/Desktop/Book.md');
  });

  it('Windows drive paths with either separator and UNC paths are outside', () => {
    for (const folder of ['C:\\Users\\me\\Desktop', 'C:/Users/me/Desktop', '\\\\server\\share\\out']) {
      const location = resolveOk({ folder, vaultRoot: 'D:\\Vaults\\Vault' });
      assert.equal(location.kind, 'outside', folder);
      assert.equal(location.outputPath, `${folder}/Book.md`);
    }
  });

  it('the filesystem root is joined without a double separator', () => {
    assert.equal(resolveOk({ folder: '/' }).outputPath, '/Book.md');
  });

  it('a folder that does not exist is refused and is checked with the folder as typed', () => {
    const asked: string[] = [];
    const reason = resolveReason({
      folder: '/Users/user/Desktp',
      folderExists: path => {
        asked.push(path);
        return false;
      },
    });
    assert.equal(reason, 'Output folder "/Users/user/Desktp" does not exist.');
    assert.deepEqual(asked, ['/Users/user/Desktp']);
  });

  it('on mobile (no vault root) an absolute folder is refused', () => {
    const reason = resolveReason({ folder: '/Users/user/Desktop', vaultRoot: null });
    assert.equal(
      reason,
      'Output folder "/Users/user/Desktop" is outside the vault; writing outside the vault needs the desktop app.',
    );
  });

  it('a vault-relative folder never asks whether a folder exists', () => {
    let asked = false;
    resolveOk({ folder: 'Exports', folderExists: () => (asked = true) });
    assert.equal(asked, false);
  });
});

describe('US-0.3 AC-OL-3 — absolute folder inside the vault', () => {
  it('the vault root becomes the empty vault folder', () => {
    const location = resolveOk({ folder: VAULT_ROOT });
    assert.equal(location.kind, 'vault');
    assert.equal(location.outputPath, 'Book.md');
  });

  it('a folder under the vault root becomes vault-relative', () => {
    const location = resolveOk({ folder: `${VAULT_ROOT}/Exports` });
    assert.equal(location.kind, 'vault');
    assert.equal(location.outputPath, 'Exports/Book.md');
  });

  it('a sibling whose name starts with the vault name is outside, not " Backup/out"', () => {
    const location = resolveOk({ folder: '/Users/user/Vault Backup/out' });
    assert.equal(location.kind, 'outside');
    assert.equal(location.outputPath, '/Users/user/Vault Backup/out/Book.md');
  });

  it('an absolute folder in the config folder is still refused', () => {
    const reason = resolveReason({ folder: `${VAULT_ROOT}/.obsidian/plugins` });
    assert.match(reason, /inside the Obsidian config folder \.obsidian/);
  });

  it('vaultRelativeFromAbsolute handles both separators and trailing ones', () => {
    assert.equal(vaultRelativeFromAbsolute('/v/Vault/', '/v/Vault'), '');
    assert.equal(vaultRelativeFromAbsolute('/v/Vault/A/B', '/v/Vault/'), 'A/B');
    assert.equal(vaultRelativeFromAbsolute('/v/VaultX', '/v/Vault'), null);
    assert.equal(vaultRelativeFromAbsolute('D:\\V\\Vault\\Out', 'D:\\V\\Vault'), 'Out');
  });
});

describe('US-0.3 AC-OL-4 — refused folders', () => {
  for (const folder of ['../Exports', 'Exports/../../x', '/Users/user/../x', '..']) {
    it(`"${folder}" is refused for ".."`, () => {
      assert.equal(resolveReason({ folder }), `Output folder "${folder}" must not contain "..".`);
    });
  }

  it('"~/Desktop" is refused with the full-path hint', () => {
    assert.equal(
      resolveReason({ folder: '~/Desktop' }),
      'Output folder "~/Desktop" starts with "~". Use the full path, e.g. /Users/<name>/Desktop.',
    );
  });

  it('a vault-relative folder with a backslash is refused', () => {
    assert.equal(
      resolveReason({ folder: 'Exports\\Sub' }),
      'Output folder "Exports\\Sub" uses "\\"; use "/" between vault folders.',
    );
  });

  for (const folder of ['.obsidian', '.obsidian/plugins/obsidian-vault-compiler', './.obsidian/']) {
    it(`"${folder}" is refused as the config folder`, () => {
      assert.equal(
        resolveReason({ folder }),
        `Output folder "${folder}" is inside the Obsidian config folder .obsidian.`,
      );
    });
  }

  it('the config folder name is read from the vault, not assumed', () => {
    assert.match(resolveReason({ folder: '.config/x', configDir: '.config' }), /config folder \.config/);
    assert.equal(resolveOk({ folder: '.obsidian-exports', configDir: '.obsidian' }).kind, 'vault');
  });
});

describe('US-0.3 AC-OL-5 — refused filenames', () => {
  it('an empty filename is refused', () => {
    assert.equal(resolveReason({ file: '' }), 'Output filename is empty.');
  });

  for (const file of ['sub/Book.md', '/tmp/Book.md', '..\\Book.md']) {
    it(`"${file}" is refused as a path`, () => {
      assert.equal(
        resolveReason({ file }),
        `Output filename "${file}" must be a file name without "/" or "\\". Put folders into the output folder.`,
      );
    });
  }

  for (const file of ['.', '..']) {
    it(`"${file}" is not a file name`, () => {
      assert.equal(resolveReason({ file }), `Output filename "${file}" is not a file name.`);
    });
  }
});

describe('US-0.3 AC-OL-6 — the starting file is never the output', () => {
  it('folder "" + index2compile.md is refused', () => {
    assert.equal(
      resolveReason({ folder: '', file: 'index2compile.md' }),
      'Output path "index2compile.md" is the starting file.',
    );
  });

  it('a starting file chosen from the context menu in a subfolder is protected too', () => {
    assert.equal(
      resolveReason({ folder: 'Rules/', file: 'Combat.md', startingFile: 'Rules/Combat.md' }),
      'Output path "Rules/Combat.md" is the starting file.',
    );
  });

  it('the same name in another folder is allowed', () => {
    assert.equal(resolveOk({ folder: 'Exports', file: 'index2compile.md' }).outputPath, 'Exports/index2compile.md');
  });
});
