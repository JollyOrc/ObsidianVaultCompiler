/**
 * US-7.1 | Local development workflow: copies the build into an Obsidian
 * vault's plugin folder.
 *
 * Target: OBSIDIAN_PLUGIN_DIR when set (the folder must exist); otherwise the
 * fixture vault's plugin folder
 * `tests/fixtures/basic-vault/.obsidian/plugins/obsidian-vault-compiler/`,
 * created when missing (its `.obsidian/` is ignored by git).
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginDir = dirname(fileURLToPath(import.meta.url));
const fixtureTarget = resolve(
  pluginDir, '../tests/fixtures/basic-vault/.obsidian/plugins/obsidian-vault-compiler');

const target = process.env.OBSIDIAN_PLUGIN_DIR || fixtureTarget;
if (target === fixtureTarget) {
  mkdirSync(target, { recursive: true });
} else if (!existsSync(target)) {
  console.error(`deploy: ${target} does not exist.`);
  process.exit(1);
}
for (const file of ['main.js', 'manifest.json', 'styles.css']) {
  copyFileSync(join(pluginDir, file), join(target, file));
}
console.log(`deploy: copied main.js, manifest.json and styles.css to ${target}`);
