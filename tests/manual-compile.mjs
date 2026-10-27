/**
 * Compiles a vault folder outside Obsidian for a quick look at the output.
 *
 * Usage (from plugin/):
 *   node --loader ../txt-loader.mjs --experimental-strip-types ../tests/manual-compile.mjs <vault folder> [start note] [output file]
 */
import fs from 'node:fs';
import path from 'node:path';
import { InMemoryVaultCompiler } from '../plugin/src/compiler.ts';

const [vault, start = 'index2compile.md', outFile = 'compiled.md'] = process.argv.slice(2);
if (!vault) {
  console.error('Usage: manual-compile.mjs <vault folder> [start note] [output file]');
  process.exit(1);
}
const root = path.resolve(vault);
const files = {};
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files[path.relative(root, full).replace(/\\/g, '/')] =
      entry.name.toLowerCase().endsWith('.md') ? fs.readFileSync(full, 'utf8') : '';
  }
}
walk(root);

const result = new InMemoryVaultCompiler(files, { enableTextMapper: true, assetFolder: 'assets' }).compile(start);
fs.writeFileSync(path.resolve(outFile), result.content, 'utf8');
console.log('filesProcessed:', result.stats.filesProcessed);
console.log('warnings:', result.warnings.length);
console.log('outputFile:', path.resolve(outFile));
