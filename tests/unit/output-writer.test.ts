/**
 * Unit tests for the output writer (US-8.1 AC-8.1-W, AC-8.1-V; US-0.3 AC-OL-2).
 *
 * Every write of a compile goes through `OutputWriter`, which checks each path
 * against the output location before it calls the vault or `fs`. The vault
 * side runs against a fake vault that records every call; the outside side
 * runs against a real temporary folder with Node.js `fs`, the module the
 * plugin passes on the desktop app.
 *
 * The write-call guard at the end (SCAR-017, SCAR-023) reads the plugin
 * sources and fails when a write call bypasses the writer.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveOutputLocation, type OutputLocation } from '../../plugin/src/output-location.ts';
import { OutputWriter, type WriterVault } from '../../plugin/src/output-writer.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A fake vault that records every call and holds files and folders by path. */
class FakeVault implements WriterVault {
  readonly entries = new Map<string, string | ArrayBuffer | 'folder'>();
  readonly writes: string[] = [];

  getAbstractFileByPath(p: string): unknown {
    return this.entries.has(p) ? { path: p } : null;
  }
  async create(p: string, data: string): Promise<unknown> {
    this.writes.push(`create ${p}`);
    this.entries.set(p, data);
    return { path: p };
  }
  async modify(file: unknown, data: string): Promise<void> {
    const p = (file as { path: string }).path;
    this.writes.push(`modify ${p}`);
    this.entries.set(p, data);
  }
  async createBinary(p: string, data: ArrayBuffer): Promise<unknown> {
    this.writes.push(`createBinary ${p}`);
    this.entries.set(p, data);
    return { path: p };
  }
  async createFolder(p: string): Promise<unknown> {
    this.writes.push(`createFolder ${p}`);
    this.entries.set(p, 'folder');
    return { path: p };
  }
}

function location(folder: string, file: string, folderExists = () => true): OutputLocation {
  const result = resolveOutputLocation({
    folder,
    file,
    startingFile: 'index2compile.md',
    configDir: '.obsidian',
    vaultRoot: '/Users/user/Rovers',
    folderExists,
  });
  if (!result.ok) throw new Error(result.reason);
  return result.location;
}

const BYTES = new Uint8Array([1, 2, 3]).buffer;

async function refused(action: Promise<unknown>, p: string): Promise<void> {
  await assert.rejects(action, {
    message: `Refused to write "${p}": not part of the output location.`,
  });
}

// ---------------------------------------------------------------------------
// Vault location
// ---------------------------------------------------------------------------

describe('US-8.1 AC-8.1-W — vault location: folder "Exports", file "Book.md"', () => {
  let vault: FakeVault;
  let writer: OutputWriter;
  beforeEach(() => {
    vault = new FakeVault();
    writer = new OutputWriter(location('Exports', 'Book.md'), vault, null);
  });

  it('writes the output file, creating the output folder first', async () => {
    await writer.writeText('Exports/Book.md', '# Book');
    assert.deepEqual(vault.writes, ['createFolder Exports', 'create Exports/Book.md']);
  });

  it('overwrites an existing output file with modify', async () => {
    vault.entries.set('Exports', 'folder');
    vault.entries.set('Exports/Book.md', 'old');
    await writer.writeText('Exports/Book.md', 'new');
    assert.deepEqual(vault.writes, ['modify Exports/Book.md']);
    assert.equal(vault.entries.get('Exports/Book.md'), 'new');
  });

  it('writes the warnings logfile directly in the output folder', async () => {
    await writer.writeText('Exports/warnings_20261027_1106.md', '# Compilation warnings');
    assert.ok(vault.writes.includes('create Exports/warnings_20261027_1106.md'));
  });

  it('writes assets and TextMapper renders under Exports/assets/, creating each folder', async () => {
    await writer.writeBinaryIfAbsent('Exports/assets/map.png', BYTES);
    await writer.writeBinaryIfAbsent('Exports/assets/textmapper/1a2b_0001.png', BYTES);
    assert.deepEqual(vault.writes, [
      'createFolder Exports',
      'createFolder Exports/assets',
      'createBinary Exports/assets/map.png',
      'createFolder Exports/assets/textmapper',
      'createBinary Exports/assets/textmapper/1a2b_0001.png',
    ]);
  });

  it('keeps an existing asset (no second write)', async () => {
    await writer.writeBinaryIfAbsent('Exports/assets/map.png', BYTES);
    const before = vault.writes.length;
    await writer.writeBinaryIfAbsent('Exports/assets/map.png', BYTES);
    assert.equal(vault.writes.length, before);
  });

  it('creates the output folder and its parents, and the assets folder', async () => {
    const nested = new OutputWriter(location('Exports/2026', 'Book.md'), vault, null);
    await nested.ensureFolder('Exports/2026/assets');
    assert.deepEqual(vault.writes, [
      'createFolder Exports',
      'createFolder Exports/2026',
      'createFolder Exports/2026/assets',
    ]);
  });

  for (const p of [
    'Book.md',
    'Exports/other.md',
    'Exports/warnings.md',
    'Exports/warnings_2026_1106.md',
    'Exports/sub/warnings_20261027_1106.md',
    'Exports/assets/../index2compile.md',
    'Users/user/Desktop/Book.md',
    '/Users/user/Desktop/Book.md',
    'index2compile.md',
  ]) {
    it(`refuses the file "${p}" and makes no call`, async () => {
      await refused(writer.writeText(p, 'x'), p);
      await refused(writer.writeBinaryIfAbsent(p, BYTES), p);
      assert.deepEqual(vault.writes, []);
    });
  }

  for (const p of ['Other', 'Exports/sub', 'Exports/assets/../x', '.obsidian']) {
    it(`refuses the folder "${p}" and makes no call`, async () => {
      await refused(writer.ensureFolder(p), p);
      assert.deepEqual(vault.writes, []);
    });
  }

  it('isOutputPath names exactly the files a compile may leave in the vault', () => {
    assert.equal(writer.isOutputPath('Exports/Book.md'), true);
    assert.equal(writer.isOutputPath('Exports/warnings_20261027_1106.md'), true);
    assert.equal(writer.isOutputPath('Exports/assets/map.png'), true);
    assert.equal(writer.isOutputPath('Exports/other.md'), false);
    assert.equal(writer.isOutputPath('Book.md'), false);
  });
});

describe('US-8.1 AC-8.1-W — vault location at the vault root', () => {
  it('writes Book.md, assets/ and the warnings file at the root and nothing else', async () => {
    const vault = new FakeVault();
    const writer = new OutputWriter(location('', 'Book.md'), vault, null);
    await writer.writeText('Book.md', 'x');
    await writer.writeText('warnings_20261027_1106.md', 'x');
    await writer.writeBinaryIfAbsent('assets/a.png', BYTES);
    assert.deepEqual(vault.writes, [
      'create Book.md',
      'create warnings_20261027_1106.md',
      'createFolder assets',
      'createBinary assets/a.png',
    ]);
    await refused(writer.writeText('Other.md', 'x'), 'Other.md');
  });
});

// ---------------------------------------------------------------------------
// Outside location, with the real Node.js fs
// ---------------------------------------------------------------------------

describe('US-0.3 AC-OL-2 / US-8.1 AC-8.1-W — outside location with Node.js fs', () => {
  let dir: string;
  let vault: FakeVault;
  let writer: OutputWriter;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ovc-outside-'));
    vault = new FakeVault();
    writer = new OutputWriter(location(dir, 'Rovers of Emberdale.md', p => fs.existsSync(p)), vault, fs);
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes the output, assets and warnings into the folder and makes no vault call', async () => {
    await writer.ensureFolder(`${dir}/assets`);
    await writer.writeText(`${dir}/Rovers of Emberdale.md`, '# Rovers');
    await writer.writeText(`${dir}/warnings_20261027_1106.md`, '# Compilation warnings');
    await writer.writeBinaryIfAbsent(`${dir}/assets/map.png`, BYTES);
    await writer.writeBinaryIfAbsent(`${dir}/assets/textmapper/1a2b_0001.png`, BYTES);

    assert.deepEqual(vault.writes, []);
    assert.equal(fs.readFileSync(path.join(dir, 'Rovers of Emberdale.md'), 'utf8'), '# Rovers');
    assert.ok(fs.existsSync(path.join(dir, 'warnings_20261027_1106.md')));
    assert.deepEqual([...fs.readFileSync(path.join(dir, 'assets', 'map.png'))], [1, 2, 3]);
    assert.deepEqual([...fs.readFileSync(path.join(dir, 'assets', 'textmapper', '1a2b_0001.png'))], [1, 2, 3]);
    assert.deepEqual(fs.readdirSync(dir).sort(), ['Rovers of Emberdale.md', 'assets', 'warnings_20261027_1106.md']);
  });

  it('overwrites the output file and reports that it exists', async () => {
    fs.writeFileSync(path.join(dir, 'Rovers of Emberdale.md'), 'old');
    assert.equal(writer.exists(`${dir}/Rovers of Emberdale.md`), true);
    await writer.writeText(`${dir}/Rovers of Emberdale.md`, 'new');
    assert.equal(fs.readFileSync(path.join(dir, 'Rovers of Emberdale.md'), 'utf8'), 'new');
  });

  it('keeps an existing asset', async () => {
    fs.mkdirSync(path.join(dir, 'assets'));
    fs.writeFileSync(path.join(dir, 'assets', 'map.png'), 'keep');
    await writer.writeBinaryIfAbsent(`${dir}/assets/map.png`, BYTES);
    assert.equal(fs.readFileSync(path.join(dir, 'assets', 'map.png'), 'utf8'), 'keep');
  });

  it('refuses a path beside the folder, a parent escape and the vault-relative path', async () => {
    for (const p of [
      `${dir}/other.md`,
      `${dir}/assets/../../escape.md`,
      `${dir}-sibling/Rovers of Emberdale.md`,
      'Rovers of Emberdale.md',
    ]) {
      await refused(writer.writeText(p, 'x'), p);
    }
    await refused(writer.ensureFolder(dir), dir);
    assert.deepEqual(fs.readdirSync(dir), []);
    assert.equal(fs.existsSync(`${dir}-sibling`), false);
    assert.deepEqual(vault.writes, []);
  });

  it('isOutputPath is false for every vault path, so the vault check sees any new vault file (AC-8.1-V)', () => {
    assert.equal(writer.isOutputPath('Users/user/Desktop/Rovers of Emberdale.md'), false);
    assert.equal(writer.isOutputPath('Rovers of Emberdale.md'), false);
    assert.equal(writer.isOutputPath('assets/map.png'), false);
  });

  it('without fs (mobile) every outside write is refused', async () => {
    const noFs = new OutputWriter(writer.location, vault, null);
    await assert.rejects(noFs.writeText(`${dir}/Rovers of Emberdale.md`, 'x'), /needs the desktop app/);
    assert.deepEqual(fs.readdirSync(dir), []);
  });
});

// ---------------------------------------------------------------------------
// Write-call guard over the plugin sources (SCAR-017, SCAR-023)
// ---------------------------------------------------------------------------

describe('US-8.1 AC-8.1-W — no write call bypasses the output writer', () => {
  const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../plugin/src');
  const sources = fs
    .readdirSync(srcDir)
    .filter(name => name.endsWith('.ts') && !name.endsWith('.d.ts'))
    .map(name => ({ name, text: fs.readFileSync(path.join(srcDir, name), 'utf8') }));

  /** Every call that writes to the vault, its adapter or the file system. */
  const WRITE_CALL =
    /\b(?:vault|adapter)\s*\.\s*(?:create|createBinary|modify|modifyBinary|createFolder|process|append|rename|delete|trash|copy|write|writeBinary|mkdir|remove|rmdir)\s*\(|\bfs\s*\.\s*(?:writeFileSync|writeFile|appendFileSync|appendFile|mkdirSync|mkdir|copyFileSync|copyFile|renameSync|rename|rmSync|rm|unlinkSync|unlink|createWriteStream)\s*\(/g;

  function lineOf(text: string, index: number): string {
    const start = text.lastIndexOf('\n', index) + 1;
    const end = text.indexOf('\n', index);
    return text.slice(start, end === -1 ? undefined : end).trim();
  }

  it('finds the expected number of write calls in total', () => {
    const count = sources.reduce((n, s) => n + [...s.text.matchAll(WRITE_CALL)].length, 0);
    // 7 in output-writer.ts (create, modify, createBinary, createFolder,
    // writeFileSync for text and for binary, mkdirSync). The 5 TextMapper
    // temp-folder writes are gone since v0.14.0 (US-4.4 AC-1, T-4.2-B).
    assert.equal(count, 7);
  });

  it('outside output-writer.ts there is no write call at all (US-4.4 AC-1 since v0.14.0)', () => {
    const found: string[] = [];
    for (const { name, text } of sources) {
      if (name === 'output-writer.ts') continue;
      for (const match of text.matchAll(WRITE_CALL)) {
        found.push(`${name}: ${lineOf(text, match.index ?? 0)}`);
      }
    }
    assert.deepEqual(found, []);
  });

  it('in output-writer.ts every write call follows this.assertAllowed(...) in the same method', () => {
    const text = sources.find(s => s.name === 'output-writer.ts')!.text;
    const calls = [...text.matchAll(WRITE_CALL)];
    assert.equal(calls.length, 7);
    for (const call of calls) {
      const index = call.index ?? 0;
      // The method starts at the last line that opens a method body before the call.
      const methodStart = text.lastIndexOf('\n  async ', index);
      const body = text.slice(methodStart, index);
      assert.match(
        body,
        /this\.assertAllowed\((?:path|folder|current), '(?:file|folder)'\);/,
        `unchecked write: ${lineOf(text, index)}`,
      );
      assert.ok(!/\n {2}\}\n/.test(body), `write call is not in the checked method: ${lineOf(text, index)}`);
    }
  });
});
