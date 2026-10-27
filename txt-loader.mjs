/**
 * Node.js ESM loader hook that handles `.txt` file imports as plain text strings.
 * This mirrors what esbuild's `loader: { '.txt': 'text' }` does at build time,
 * so that the test runner can import textmapper.ts without esbuild.
 *
 * Usage:
 *   node --loader ./txt-loader.mjs --experimental-strip-types --test <file.ts>
 *
 * NOTE: Use --loader (deprecated but functional in Node 22), NOT --import.
 * --import only pre-loads the module without registering the hooks.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function resolve(specifier, context, nextResolve) {
  // Let Node handle non-.txt specifiers normally
  if (!specifier.endsWith('.txt')) {
    return nextResolve(specifier, context);
  }
  return nextResolve(specifier, context);
}

export function load(url, context, nextLoad) {
  if (!url.endsWith('.txt')) {
    return nextLoad(url, context);
  }
  const filePath = fileURLToPath(url);
  const content = readFileSync(filePath, 'utf-8');
  // Export as ESM default export (matches `import foo from './file.txt'`)
  const escaped = JSON.stringify(content);
  return {
    format: 'module',
    shortCircuit: true,
    source: `export default ${escaped};`,
  };
}
