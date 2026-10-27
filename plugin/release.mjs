/**
 * release.mjs — Post-build release packager
 *
 * 1. Creates releases/<plugin-id>-v<version>.zip containing main.js,
 *    manifest.json, styles.css — everything needed to install the plugin
 *    into any Obsidian vault's .obsidian/plugins/<id>/ directory.
 *
 * 2. Keeps hand-written releases/v<version>.md notes (adding the download link
 *    if missing); writes a stub only when no notes exist for this version.
 *
 * 3. Rewrites releases/RELEASES.md listing the last 5 versions with links
 *    to their release notes and zip files.
 *
 * Usage: called automatically by `npm run build` → `npm run release`.
 *   Can also be run standalone: node release.mjs
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const root        = resolve(__dirname, '..');
const pluginDir   = __dirname;
const releasesDir = join(root, 'releases');

// ─── helpers ──────────────────────────────────────────────────────────────────

function readJson(p) { return JSON.parse(readFileSync(p, 'utf8')); }

/** Minimal pure-JS ZIP writer (no dependencies). Stores files uncompressed. */
function buildZip(entries) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const crc       = crc32(data);
    const size      = data.length;
    const date      = dosDateTime(new Date());

    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
    local.writeUInt32LE(date, 10); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18); local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBytes.length, 26); local.writeUInt16LE(0, 28);
    nameBytes.copy(local, 30);

    localHeaders.push({ local, data, nameBytes, crc, size, date, offset });
    offset += local.length + size;
  }

  for (const e of localHeaders) {
    const cd = Buffer.alloc(46 + e.nameBytes.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8); cd.writeUInt16LE(0, 10);
    cd.writeUInt32LE(e.date, 12); cd.writeUInt32LE(e.crc, 16);
    cd.writeUInt32LE(e.size, 20); cd.writeUInt32LE(e.size, 24);
    cd.writeUInt16LE(e.nameBytes.length, 28);
    cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38); cd.writeUInt32LE(e.offset, 42);
    e.nameBytes.copy(cd, 46);
    centralHeaders.push(cd);
  }

  const centralOffset = offset;
  const centralSize   = centralHeaders.reduce((s, b) => s + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(localHeaders.length, 8);
  eocd.writeUInt16LE(localHeaders.length, 10);
  eocd.writeUInt32LE(centralSize, 12); eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([
    ...localHeaders.flatMap(e => [e.local, e.data]),
    ...centralHeaders,
    eocd,
  ]);
}

function dosDateTime(d) {
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() >> 1) & 0x1f);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  return (date << 16) | time;
}

function crc32(buf) {
  if (!crc32.table) {
    crc32.table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      crc32.table[i] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crc32.table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function sortVersions(vs) {
  return [...vs].sort((a, b) => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) { if (pa[i] !== pb[i]) return pb[i] - pa[i]; }
    return 0;
  });
}

// ─── main ─────────────────────────────────────────────────────────────────────

const manifest     = readJson(join(pluginDir, 'manifest.json'));
const { id, name: pluginName, version } = manifest;
const today        = new Date().toISOString().slice(0, 10);
const zipName      = `${id}-v${version}.zip`;
const notesName    = `v${version}.md`;
const zipPath      = join(releasesDir, zipName);
const notesPath    = join(releasesDir, notesName);

mkdirSync(releasesDir, { recursive: true });

// 1. Build zip ----------------------------------------------------------------
const entries = ['main.js', 'manifest.json', 'styles.css']
  .filter(f => existsSync(join(pluginDir, f)))
  .map(f => ({ name: f, data: readFileSync(join(pluginDir, f)) }));

writeFileSync(zipPath, buildZip(entries));
console.log(`  📦 releases/${zipName}`);

// 2. Write release notes ------------------------------------------------------
// If releases/v<version>.md already exists, leave it alone (hand-written notes
// take precedence). Only write an auto-generated stub when the file is absent.
if (!existsSync(notesPath)) {
  const stub = `# v${version} Release Notes

**Released:** ${today}
**[⬇ Download ${zipName}](${zipName})**

---

*(Add release notes here.)*
`;
  writeFileSync(notesPath, stub);
  console.log(`  📝 releases/${notesName} (stub — edit before publishing)`);
} else {
  // Ensure the zip download link is present in the existing notes
  let notes = readFileSync(notesPath, 'utf8');
  const linkLine = `**[⬇ Download ${zipName}](${zipName})**`;
  if (!notes.includes(zipName)) {
    // Insert the download link after the first heading line
    notes = notes.replace(/^(# .+)$/m, `$1\n\n${linkLine}`);
    writeFileSync(notesPath, notes);
    console.log(`  📝 releases/${notesName} (download link added)`);
  } else {
    console.log(`  📝 releases/${notesName} (unchanged)`);
  }
}

// 3. Rewrite RELEASES.md -------------------------------------------------------
const allVersions = sortVersions(
  Object.keys(readJson(join(pluginDir, 'versions.json')))
).slice(0, 5);

const rows = allVersions.map(v => {
  const zn   = `${id}-v${v}.zip`;
  const nn   = `v${v}.md`;
  const hasZ = existsSync(join(releasesDir, zn));
  const hasN = existsSync(join(releasesDir, nn));
  const zip  = hasZ ? `[⬇ zip](${zn})` : '*(no zip)*';
  const notes = hasN ? `[release notes](${nn})` : '*(no notes)*';
  return `| v${v} | ${notes} | ${zip} |`;
});

const releasesMd = `# Releases

Last 5 releases of **${pluginName}**.

| Version | Release Notes | Download |
|---------|---------------|----------|
${rows.join('\n')}

## Installation

1. Download the zip for the version you want.
2. Extract it into your vault's \`.obsidian/plugins/${id}/\` directory.
3. In Obsidian, open **Settings → Community Plugins** and enable **${pluginName}**.
`;

writeFileSync(join(releasesDir, 'RELEASES.md'), releasesMd);
console.log(`  📋 releases/RELEASES.md updated`);
