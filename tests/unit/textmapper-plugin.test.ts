/**
 * Tests for rendering maps through the installed Text Mapper plugin
 * (US-4.2, US-4.4, US-4.6, US-4.8; decided 2026-10-27).
 *
 * The plugin itself only runs inside Obsidian, so its behaviour is replaced by
 * a fake that does what its v1.1.0 `main.js` does: draw one <svg> into a new
 * child of the element it is given, or an error element on a parse error.
 * The SVG text below has the shape the plugin draws (header, background rect,
 * defs, regions, labels) as XMLSerializer writes it.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  embedFontFaces,
  getTextMapperPlugin,
  mapAssetName,
  mapFontKey,
  parseFontList,
  parseMapAssetRef,
  prepareMapSvg,
  renderMapSvg,
  resolveMapFont,
} from '../../plugin/src/textmapper.ts';

const PLUGIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="-30 -40 600 700">' +
  '<rect x="-30" y="-40" width="600" height="700" fill="white"/>' +
  '<defs><g id="x"><rect x="-5" y="-5" width="10" height="10" fill="white"/></g></defs>' +
  '<g id="regions"><polygon fill="#9bf6ff" stroke="black" stroke-width="3" points="0,0 1,1"/></g>' +
  '<g id="labels"><text x="10" y="20">Ice Armour</text></g>' +
  '</svg>';

describe('US-4.2 AC-4: prepareMapSvg', () => {
  it('removes the plugin\'s background rect so the PNG is transparent', () => {
    const out = prepareMapSvg(PLUGIN_SVG, 'sans-serif');
    assert.doesNotMatch(out, /<rect x="-30" y="-40" width="600" height="700" fill="white"\/>/);
  });

  it('keeps every other rect, including small white ones inside defs', () => {
    const out = prepareMapSvg(PLUGIN_SVG, 'sans-serif');
    assert.match(out, /<rect x="-5" y="-5" width="10" height="10" fill="white"\/>/);
  });

  it('keeps hex fills, black outlines and labels unchanged', () => {
    const out = prepareMapSvg(PLUGIN_SVG, 'sans-serif');
    assert.match(out, /<polygon fill="#9bf6ff" stroke="black" stroke-width="3" points="0,0 1,1"\/>/);
    assert.match(out, /<text x="10" y="20">Ice Armour<\/text>/);
  });

  it('does not remove a first rect that does not cover the viewBox', () => {
    const svg = PLUGIN_SVG.replace('width="600" height="700" fill="white"', 'width="60" height="70" fill="white"');
    const out = prepareMapSvg(svg, 'sans-serif');
    assert.match(out, /<rect x="-30" y="-40" width="60" height="70" fill="white"\/>/);
  });

  it('does not remove a covering first rect that is not white', () => {
    const svg = PLUGIN_SVG.replace('height="700" fill="white"', 'height="700" fill="#fff8e7"');
    const out = prepareMapSvg(svg, 'sans-serif');
    assert.match(out, /fill="#fff8e7"/);
  });

  it('writes the map font on the root svg (US-4.8 AC-3)', () => {
    const out = prepareMapSvg(PLUGIN_SVG, 'Georgia, serif');
    assert.match(out, /^<svg [^>]*style="font-family: Georgia, serif"/);
  });

  it('escapes quotes in the font list so the attribute stays valid', () => {
    const out = prepareMapSvg(PLUGIN_SVG, '"Inter", -apple-system, sans-serif');
    assert.match(out, /^<svg [^>]*style="font-family: &quot;Inter&quot;, -apple-system, sans-serif"/);
  });

  it('adds the font to an existing style attribute instead of a second one', () => {
    const svg = PLUGIN_SVG.replace('<svg ', '<svg style="color: red" ');
    const out = prepareMapSvg(svg, 'Georgia');
    const root = out.match(/^<svg [^>]*>/)![0];
    assert.equal((root.match(/style=/g) ?? []).length, 1);
    assert.match(root, /style="color: red; font-family: Georgia"/);
  });
});

describe('US-4.8: resolveMapFont', () => {
  it('AC-3: a value is used as written (trimmed)', () => {
    assert.equal(resolveMapFont('  Georgia, serif ', () => 'Inter'), 'Georgia, serif');
  });

  it('AC-2: empty means Obsidian\'s note font', () => {
    assert.equal(resolveMapFont('', () => '"Inter", sans-serif'), '"Inter", sans-serif');
  });

  it('AC-2: a field with only spaces counts as empty', () => {
    assert.equal(resolveMapFont('   ', () => 'Inter, sans-serif'), 'Inter, sans-serif');
  });

  it('AC-2: a list without a generic family gets sans-serif appended', () => {
    assert.equal(
      resolveMapFont('', () => '"??", its-Bookerly, Bookerly, Inter'),
      '"??", its-Bookerly, Bookerly, Inter, sans-serif',
    );
    assert.equal(resolveMapFont('Georgia', () => null), 'Georgia, sans-serif');
  });

  it('AC-2: a list with a generic family is kept as written', () => {
    assert.equal(resolveMapFont('Georgia, serif', () => null), 'Georgia, serif');
    assert.equal(resolveMapFont('Fira Code, ui-monospace', () => null), 'Fira Code, ui-monospace');
  });

  it('AC-4: nothing readable falls back to sans-serif', () => {
    assert.equal(resolveMapFont('', () => null), 'sans-serif');
    assert.equal(resolveMapFont('', () => ''), 'sans-serif');
  });

  it('AC-1: the reader is only asked when the field is empty', () => {
    let asked = 0;
    resolveMapFont('Georgia', () => { asked += 1; return 'Inter'; });
    assert.equal(asked, 0);
  });
});

/** A container that remembers the svg a fake plugin drew into it. */
function fakeContainer() {
  const drawn: { svg: unknown } = { svg: null };
  return {
    drawn,
    el: { querySelector: (sel: string) => (sel === 'svg' ? drawn.svg : null) } as unknown as HTMLElement,
  };
}

describe('US-4.2 AC-1, AC-2, AC-5: renderMapSvg', () => {
  it('calls processMarkdown with the source unchanged and a docId from the content hash', async () => {
    const calls: Array<{ source: string; docId: string; hasAddChild: boolean }> = [];
    const box = fakeContainer();
    const plugin = {
      processMarkdown: async (source: string, _el: HTMLElement, ctx: { docId: string; addChild(c: unknown): void }) => {
        calls.push({ source, docId: ctx.docId, hasAddChild: typeof ctx.addChild === 'function' });
        box.drawn.svg = { tag: 'svg' };
      },
    };
    const code = 'include gnomeyland.txt\n0101 grass "A|B"';
    const svg = await renderMapSvg(plugin, code, { createContainer: () => box.el, serialize: () => PLUGIN_SVG });
    assert.equal(svg, PLUGIN_SVG);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].source, code, 'US-4.6 AC-1: include lines are passed on unchanged');
    assert.match(calls[0].docId, /^vault-compiler-[0-9a-f]+$/);
    assert.ok(calls[0].hasAddChild);
  });

  it('a plugin that draws no svg (parse error) is a render failure', async () => {
    const box = fakeContainer();
    const plugin = { processMarkdown: async () => { /* draws an error element only */ } };
    await assert.rejects(
      renderMapSvg(plugin, '0101 x', { createContainer: () => box.el, serialize: () => '' }),
      /TextMapper could not draw this map/,
    );
  });

  it('AC-5: no plugin is a render failure with the agreed message', async () => {
    await assert.rejects(
      renderMapSvg(null, '0101 x', { createContainer: () => fakeContainer().el, serialize: () => '' }),
      /TextMapper plugin is not installed or enabled/,
    );
  });
});

describe('US-4.2 AC-1: getTextMapperPlugin', () => {
  it('returns the enabled plugin', () => {
    const plugin = { processMarkdown() {} };
    assert.equal(getTextMapperPlugin({ plugins: { plugins: { 'text-mapper': plugin } } }), plugin);
  });

  it('returns null when the plugin is missing or has no processMarkdown', () => {
    assert.equal(getTextMapperPlugin({ plugins: { plugins: {} } }), null);
    assert.equal(getTextMapperPlugin({ plugins: { plugins: { 'text-mapper': {} } } }), null);
    assert.equal(getTextMapperPlugin({}), null);
  });
});

describe('US-4.4 / US-4.3 withdrawn: no Node file access, no npm text-mapper', () => {
  const root = new URL('../../plugin/', import.meta.url);
  const renderer = readFileSync(new URL('src/textmapper.ts', root), 'utf8');
  const main = readFileSync(new URL('src/main.ts', root), 'utf8');
  const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

  it('AC-1: the renderer uses no require, fs, os, path or temp files', () => {
    for (const pattern of [/\brequire\s*\(/, /window\.require/, /\btmpdir\b/, /from ['"]node:/, /requireFn/]) {
      assert.doesNotMatch(renderer, pattern, `found ${pattern}`);
    }
  });

  it('the npm package text-mapper and the bundled terrain files are gone', () => {
    assert.doesNotMatch(renderer, /from ['"]text-mapper['"]/);
    assert.doesNotMatch(renderer, /\.\.\/resources\//);
    assert.equal(pkg.dependencies?.['text-mapper'], undefined);
    assert.equal(existsSync(new URL('resources/gnomeyland.txt', root)), false);
  });

  it('AC-4: rendering is not refused on mobile', () => {
    assert.doesNotMatch(main, /desktop runtime required/);
    assert.doesNotMatch(renderer, /requires the desktop runtime/);
  });

  it('AC-2: the svg is serialised with XMLSerializer', () => {
    assert.match(renderer, /new XMLSerializer\(\)\.serializeToString\(/);
  });

  it('US-4.8 AC-1: main passes the map font setting, read at compile time', () => {
    assert.match(main, /mapFont: ''/);
    assert.match(main, /prepareMapFont\(this\.settings\.mapFont\)/);
  });
});

describe('US-4.8 AC-2: parseFontList', () => {
  it('splits on commas outside quotes and removes the quotes', () => {
    assert.deepEqual(parseFontList('"??", its-Bookerly, Bookerly, Inter'), ['??', 'its-Bookerly', 'Bookerly', 'Inter']);
    assert.deepEqual(parseFontList("'Open Sans', serif"), ['Open Sans', 'serif']);
    assert.deepEqual(parseFontList('"A, B", serif'), ['A, B', 'serif']);
  });
});

describe('US-4.8 AC-3, AC-4: embedFontFaces', () => {
  const LIST = '"??", its-Bookerly, Bookerly, Inter, sans-serif';
  const BASE = 'app://obsidian.md/app.css';
  const faces = [
    { family: '"Source Code Pro"', src: 'url("public/fonts/scp.ttf")', baseUrl: BASE, descriptors: {} },
    { family: 'Inter', src: 'url("public/fonts/c504.woff2") format("woff2")', baseUrl: BASE, descriptors: { 'font-weight': '100 900', 'font-style': 'normal' } },
    { family: 'INTER', src: 'url("public/fonts/01dc.woff2")', baseUrl: BASE, descriptors: { 'font-style': 'italic', 'unicode-range': 'U+0000-00FF' } },
    { family: '"??"', src: '', baseUrl: BASE, descriptors: {} },
    { family: 'Assistant', src: 'url("data:font/woff2;base64,AAAA")', baseUrl: BASE, descriptors: {} },
  ];

  it('embeds every face of a listed family, case-insensitively, as data URLs', async () => {
    const fetched: string[] = [];
    const { css, failed } = await embedFontFaces(LIST, faces, async url => { fetched.push(url); return new Uint8Array([1, 2, 3]).buffer; });
    assert.deepEqual(failed, []);
    assert.deepEqual(fetched.sort(), ['app://obsidian.md/public/fonts/01dc.woff2', 'app://obsidian.md/public/fonts/c504.woff2']);
    const rules = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
    assert.equal(rules.length, 2, css);
    assert.match(css, /src: url\("data:font\/woff2;base64,AQID"\) format\("woff2"\)/);
    assert.match(css, /font-weight: 100 900/);
    assert.match(css, /unicode-range: U\+0000-00FF/);
    assert.doesNotMatch(css, /Source Code Pro|Assistant/);
  });

  it('never embeds a face with an empty src (the "??" rule)', async () => {
    const { css } = await embedFontFaces('"??", sans-serif', faces, async () => new ArrayBuffer(1));
    assert.equal(css, '');
  });

  it('uses a data: source as it is, without fetching', async () => {
    let calls = 0;
    const { css } = await embedFontFaces('Assistant, sans-serif', faces, async () => { calls += 1; return new ArrayBuffer(1); });
    assert.equal(calls, 0);
    assert.match(css, /src: url\("data:font\/woff2;base64,AAAA"\)/);
  });

  it('AC-4: a face that cannot be fetched is left out and its family reported once', async () => {
    const { css, failed } = await embedFontFaces(LIST, faces, async () => { throw new Error('blocked'); });
    assert.equal(css, '');
    assert.deepEqual(failed, ['Inter']);
  });

  it('a system font such as Georgia embeds nothing', async () => {
    const { css, failed } = await embedFontFaces('Georgia, serif', faces, async () => new ArrayBuffer(1));
    assert.equal(css, '');
    assert.deepEqual(failed, []);
  });
});

describe('US-4.8 AC-3: prepareMapSvg embeds the font faces', () => {
  it('puts the faces in a <style> as the first child of the root svg', () => {
    const out = prepareMapSvg(PLUGIN_SVG, 'Inter, sans-serif', '@font-face { font-family: "Inter"; src: url("data:font/woff2;base64,AQID"); }');
    assert.match(out, /^<svg [^>]*><style><!\[CDATA\[@font-face \{ font-family: "Inter"; src: url\("data:font\/woff2;base64,AQID"\); \}\]\]><\/style>/);
  });

  it('adds no <style> when there is nothing to embed', () => {
    assert.doesNotMatch(prepareMapSvg(PLUGIN_SVG, 'Georgia, serif', ''), /<style/);
  });
});

describe('US-4.8 AC-6: the font key in map PNG names', () => {
  it('the key is the content hash of the font list', () => {
    assert.equal(mapFontKey('Georgia, serif'), '2cb44a0b');
    assert.equal(mapFontKey('"??", its-Bookerly, Bookerly, Inter, sans-serif'), '4c39c34');
  });

  it('names and parses <hash>_<key>.png', () => {
    assert.equal(mapAssetName('4df49e48', '2cb44a0b'), '4df49e48_2cb44a0b.png');
    assert.deepEqual(parseMapAssetRef('Export/assets/textmapper/4df49e48_2cb44a0b.png'), { hash: '4df49e48', key: '2cb44a0b' });
  });

  it('without a key the name stays <hash>_0001.png', () => {
    assert.equal(mapAssetName('4df49e48'), '4df49e48_0001.png');
    assert.deepEqual(parseMapAssetRef('assets/textmapper/4df49e48_0001.png'), { hash: '4df49e48', key: '0001' });
  });

  it('a path that is not a map PNG gives null', () => {
    assert.equal(parseMapAssetRef('assets/picture.png'), null);
  });
});

describe('US-4.8 AC-5, AC-6: one place builds and parses map names; fonts are prepared once', () => {
  const root = new URL('../../plugin/', import.meta.url);
  const compiler = readFileSync(new URL('src/compiler.ts', root), 'utf8');
  const main = readFileSync(new URL('src/main.ts', root), 'utf8');

  it('no _0001 literal or textmapper name regex outside textmapper.ts', () => {
    for (const [name, text] of [['compiler.ts', compiler], ['main.ts', main]] as const) {
      assert.doesNotMatch(text, /_0001/, `${name} still builds or parses _0001 names`);
    }
  });

  it('main prepares the map font once, before the compiler is created, and passes its key', () => {
    const calls = [...main.matchAll(/await prepareMapFont\(this\.settings\.mapFont\)/g)];
    assert.equal(calls.length, 1);
    assert.ok(calls[0].index! < main.indexOf('new InMemoryVaultCompiler('));
    // Narrowed by T-4.9-A: the key now also records tidying (US-4.9 AC-9).
    assert.match(main, /mapFontKey: mapImageKey\(mapFont\.key, this\.settings\.tidyMapLabels\)/);
    assert.match(main, /renderTextMapperBlock\(this\.app, code, destinationPath, writer, mapFont, /);
  });
});
