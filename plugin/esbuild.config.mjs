import esbuild from 'esbuild';
import process from 'process';
import { builtinModules } from 'node:module';
import { readFileSync } from 'node:fs';

// US-9.1 | AC-6 (SCAR-036): the bundled `yaml` package is ISC-licensed; its
// copyright and permission notice must appear in every copy, so it heads
// main.js — the only file Obsidian installs — and survives minification.
const yamlLicence = readFileSync(new URL('./node_modules/yaml/LICENSE', import.meta.url), 'utf8').trim();
const banner = `/*\nThis plugin bundles yaml 2.9.1 (https://github.com/eemeli/yaml), ISC licence:\n\n${yamlLicence}\n*/`;

const prod = process.argv[2] === 'production';

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...builtinModules,
  ],
  format: 'cjs',
  target: 'es2021',
  loader: { '.txt': 'text' },
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
  minify: prod,
  banner: { js: banner },
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
