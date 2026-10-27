/**
 * US-7.1: copies the build into an Obsidian vault's plugin folder when
 * OBSIDIAN_PLUGIN_DIR is set; does nothing otherwise.
 */
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const target = process.env.OBSIDIAN_PLUGIN_DIR;
if (!target) {
  console.log('deploy: OBSIDIAN_PLUGIN_DIR is not set, nothing copied.');
  process.exit(0);
}
if (!existsSync(target)) {
  console.error(`deploy: ${target} does not exist.`);
  process.exit(1);
}
for (const file of ['main.js', 'manifest.json', 'styles.css']) {
  copyFileSync(file, join(target, file));
}
console.log(`deploy: copied main.js, manifest.json and styles.css to ${target}`);
