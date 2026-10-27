/**
 * US-7.1 | T-7.1-B: Keeps manifest.json and versions.json in step with the
 * package.json version.
 *
 * Run by `npm version <x.y.z>` through the `version` script, after npm has
 * written the new version to package.json. Sets `version` in manifest.json and
 * adds `<version>: <minAppVersion>` to versions.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const targetVersion = process.env.npm_package_version;
if (!targetVersion) {
  console.error('version-bump.mjs: npm_package_version is not set; run it through npm.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
manifest.version = targetVersion;
writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n');

const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
versions[targetVersion] = manifest.minAppVersion;
writeFileSync('versions.json', JSON.stringify(versions, null, 2) + '\n');
