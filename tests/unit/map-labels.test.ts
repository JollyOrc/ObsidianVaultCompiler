/**
 * Tests for tidying labels in compiled maps (US-4.9, decided 2026-10-27).
 *
 * The fixtures reproduce what Text Mapper v1.1.0 draws (read from its source,
 * `region.ts` svgCoordinates/svgLabel and `parser.ts` svgCoordinates/svgLabels)
 * as `XMLSerializer` writes it: a `coordinates-<id>` group with one <text> per
 * hex, and a `labels-<id>` group with one <g> per labelled hex holding the glow
 * <text> and the label <text> (inside <a> for "Link|Label").
 *
 * Text widths come from a fake measure: 0.48 × font size per character, so at
 * 20pt (26.67 units) every character is 12.8 units wide: a line of W = 160
 * holds 12 characters (153.6) and 13 do not fit (166.4), and no example sits
 * exactly on a boundary.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  breakLabel,
  fontSizeToUnits,
  isHorizontalMap,
  mapImageKey,
  tidyMapLabels,
} from '../../plugin/src/textmapper.ts';

const ID = 'vault-compiler-abc123';
const LABEL_ATTRS = 'font-size="20pt" dy="5px"';
const GLOW_ATTRS = 'stroke="white" stroke-width="5pt"';

interface Hex { cx: number; cy: number; num: string; label?: string; link?: string; size?: string }

/** One map as the plugin draws it; `offset` is 69.3 (flat-top) or 58 (pointy-top). */
function pluginSvg(hexes: Hex[], opts: { offset?: number; id?: string; withCoords?: boolean; withLabels?: boolean } = {}): string {
  const offset = opts.offset ?? 86.60254037844386 * 0.8;
  const id = opts.id ?? `-${ID}`;
  const f = (n: number) => n.toFixed(1);
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const coords = hexes.map(h =>
    `<text font-size="20pt" dy="15px" text-anchor="middle" x="${f(h.cx)}" y="${f(h.cy - offset)}">${h.num}</text>`).join('');
  const labels = hexes.filter(h => h.label !== undefined).map(h => {
    const size = h.size ? `font-size="${h.size}" dy="5px"` : LABEL_ATTRS;
    const pos = `text-anchor="middle" x="${f(h.cx)}" y="${f(h.cy + offset)}"`;
    const glow = `<text ${pos} ${size} ${GLOW_ATTRS}>${esc(h.label!)}</text>`;
    const text = `<text ${pos} ${size}>${esc(h.label!)}</text>`;
    const front = h.link
      ? `<a data-tooltip-position="top" aria-label="${h.link}" href="${h.link}" data-href="${h.link}" class="internal-link" target="_blank" rel="noopener">${text}</a>`
      : text;
    return `<g>${glow}${front}</g>`;
  }).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="400 150 600 400">' +
    '<rect x="400" y="150" width="600" height="400" fill="white"/>' +
    `<g id="backgrounds${id}"><polygon fill="#a4f0ff" stroke="black" stroke-width="3" points="500,346.4 550,433 650,433 700,346.4 650,259.8 550,259.8"/></g>` +
    (opts.withCoords === false ? '' : `<g id="coordinates${id}">${coords}</g>`) +
    `<g id="regions${id}"></g><g id="path-labels${id}"></g>` +
    (opts.withLabels === false ? '' : `<g id="labels${id}">${labels}</g>`) +
    '</svg>';
}

/** 0.48 × font size per character (see header). */
const measure = (text: string, fontSize: number) => text.length * fontSize * 0.48;

/** Every <text> of the labels group, with its tspans' lines and y values. */
function labelTexts(svg: string) {
  return [...svg.matchAll(/<text\b([^>]*)>(.*?)<\/text>/g)]
    .filter(m => !/>\d{4}</.test(m[0]))
    .map(m => ({
      attrs: m[1],
      y: m[1].match(/\by="([^"]+)"/)?.[1],
      lines: [...m[2].matchAll(/<tspan\b[^>]*>(.*?)<\/tspan>/g)].map(t => t[1]),
      tspanY: [...m[2].matchAll(/<tspan\b[^>]*\by="([^"]+)"/g)].map(t => t[1]),
      tspanX: [...m[2].matchAll(/<tspan\b[^>]*\bx="([^"]+)"/g)].map(t => t[1]),
      plain: m[2],
      glow: /stroke="white"/.test(m[1]),
    }));
}

const H0402 = { cx: 600, cy: 346.4, num: '0402' };

describe('US-4.9 AC-1: hex numbers are removed', () => {
  it('removes the coordinates group and every hex number in it', () => {
    const svg = pluginSvg([{ ...H0402, label: 'Ice Crystal' }, { cx: 750, cy: 433, num: '0503', label: 'Flame' }]);
    const out = tidyMapLabels(svg, ID, measure, false).svg;
    assert.doesNotMatch(out, /coordinates-/);
    assert.doesNotMatch(out, />0402</);
    assert.doesNotMatch(out, />0503</);
  });

  it('keeps hexes, outlines and labels', () => {
    const svg = pluginSvg([{ ...H0402, label: 'Ice Crystal' }]);
    const out = tidyMapLabels(svg, ID, measure, false).svg;
    assert.match(out, /<polygon fill="#a4f0ff" stroke="black" stroke-width="3"/);
    assert.equal(labelTexts(out).length, 2, 'glow and label');
  });
});

describe('US-4.9 AC-2: labels are centred on the hex', () => {
  it('one line: y moves from centre + 69.3 to the centre, x stays', () => {
    const out = tidyMapLabels(pluginSvg([{ ...H0402, label: 'Ice Crystal' }]), ID, measure, false).svg;
    for (const t of labelTexts(out)) {
      assert.equal(t.y ?? t.tspanY[0], '346.4');
      assert.match(t.attrs + t.plain, /x="600.0"/);
    }
  });

  it('keeps font-size, dy, text-anchor and the glow stroke', () => {
    const out = tidyMapLabels(pluginSvg([{ ...H0402, label: 'Ice Crystal' }]), ID, measure, false).svg;
    const [glow, label] = labelTexts(out);
    assert.ok(glow.glow && !label.glow);
    for (const t of [glow, label]) {
      assert.match(t.attrs, /font-size="20pt"/);
      assert.match(t.attrs, /dy="5px"/);
      assert.match(t.attrs, /text-anchor="middle"/);
    }
    assert.match(glow.attrs, /stroke-width="5pt"/);
  });

  it('two lines at 20pt: line height 32, y 330.4 and 362.4', () => {
    const out = tidyMapLabels(pluginSvg([{ ...H0402, label: 'Limb Regeneration' }]), ID, measure, false).svg;
    for (const t of labelTexts(out)) {
      assert.deepEqual(t.tspanY, ['330.4', '362.4']);
      assert.deepEqual(t.tspanX, ['600.0', '600.0']);
    }
  });

  it('pointy-top maps use the offset 58', () => {
    const svg = pluginSvg([{ cx: 433, cy: 450, num: '0303', label: 'Flame' }], { offset: 58 });
    const out = tidyMapLabels(svg, ID, measure, true).svg;
    for (const t of labelTexts(out)) assert.equal(t.y ?? t.tspanY[0], '450.0');
  });
});

describe('US-4.9 AC-3: line breaks at spaces', () => {
  it('Limb Regeneration → Limb / Regeneration, in glow and label alike', () => {
    const out = tidyMapLabels(pluginSvg([{ ...H0402, label: 'Limb Regeneration' }]), ID, measure, false).svg;
    const texts = labelTexts(out);
    assert.equal(texts.length, 2);
    for (const t of texts) assert.deepEqual(t.lines, ['Limb', 'Regeneration']);
  });

  it('a label that fits stays one line', () => {
    const out = tidyMapLabels(pluginSvg([{ ...H0402, label: 'Ice Crystal' }]), ID, measure, false).svg;
    for (const t of labelTexts(out)) assert.ok(t.lines.length <= 1 && /Ice Crystal/.test(t.plain));
  });

  it('words fill a line while it fits: Above the Elements → Above the / Elements', () => {
    assert.deepEqual(breakLabel('Above the Elements', 160, t => measure(t, 26.67)).lines, ['Above the', 'Elements']);
  });

  it('a trailing space in the label (as written in the vault) adds no empty line', () => {
    assert.deepEqual(breakLabel('Ice Armour ', 160, t => measure(t, 26.67)).lines, ['Ice Armour']);
  });

  it('pointy-top lines are at most 138.6 wide', () => {
    // 11 characters = 140.8: fits 160 but not 138.6.
    const flat = tidyMapLabels(pluginSvg([{ ...H0402, label: 'Fire Spirit' }]), ID, measure, false).svg;
    const pointy = tidyMapLabels(pluginSvg([{ ...H0402, label: 'Fire Spirit' }], { offset: 58 }), ID, measure, true).svg;
    assert.ok(labelTexts(flat).every(t => t.lines.length <= 1));
    assert.ok(labelTexts(pointy).every(t => t.lines.join('|') === 'Fire|Spirit'));
  });

  it('a label with its own size is measured and spaced at that size', () => {
    const calls: number[] = [];
    const out = tidyMapLabels(pluginSvg([{ ...H0402, label: 'Limb Regeneration', size: '15pt' }]), ID,
      (t, size) => { calls.push(size); return measure(t, size); }, false).svg;
    assert.ok(calls.every(s => Math.abs(s - 20) < 0.01), `sizes measured: ${calls}`);
    // 15pt = 20 units; 17 chars × 9.6 = 163.2 > 160 → two lines;
    // L = 1.2 × 20 = 24 → 334.4 / 358.4.
    for (const t of labelTexts(out)) assert.deepEqual(t.tspanY, ['334.4', '358.4']);
  });
});

describe('US-4.9 AC-4: words wider than a line are hyphenated', () => {
  const m = (t: string) => measure(t, 26.67);

  it('Inconvenience → Inconvenien- / ce (longest prefix that fits with its hyphen)', () => {
    assert.deepEqual(breakLabel('Inconvenience', 160, m).lines, ['Inconvenien-', 'ce']);
  });

  it('a word with & breaks after it, without a hyphen', () => {
    assert.deepEqual(breakLabel('Repair&Manipulate', 160, m).lines, ['Repair&', 'Manipulate']);
  });

  it('a word with - breaks after it, without a second hyphen', () => {
    assert.deepEqual(breakLabel('Spell-breaker', 160, m).lines, ['Spell-', 'breaker']);
  });

  it('a word that fits is not hyphenated (Regeneration, 153.6)', () => {
    assert.deepEqual(breakLabel('Regeneration', 160, m).lines, ['Regeneration']);
  });

  it('keeps at least 2 characters on the second line', () => {
    // 13 letters do not fit; the longest prefix with hyphen is 11 + "-",
    // which leaves 2 letters for the second line.
    const lines = breakLabel('Inconveniencx', 160, m).lines;
    assert.ok(lines[lines.length - 1].length >= 2, lines.join('|'));
  });

  it('the rest of a long word is split again if still too wide', () => {
    const lines = breakLabel('Abcdefghijklmnopqrstuvwxyz', 160, m).lines;
    assert.deepEqual(lines, ['Abcdefghijk-', 'lmnopqrstuv-', 'wxyz']);
  });

  it('a word whose first 2 characters + hyphen do not fit stays whole and is reported', () => {
    const r = breakLabel('Huge', 30, m);
    assert.deepEqual(r.lines, ['Huge']);
    assert.equal(r.overflow, true);
  });

  it('a map with such a word reports it once', () => {
    const svg = pluginSvg([{ ...H0402, label: 'Huge Huge', size: '200pt' }, { cx: 750, cy: 433, num: '0503', label: 'Huge', size: '200pt' }]);
    const r = tidyMapLabels(svg, ID, measure, false);
    assert.equal(r.unbreakable, true);
  });

  it('& in a label that fits on one line is written escaped too', () => {
    const out = tidyMapLabels(pluginSvg([{ ...H0402, label: 'Ice & Fire' }]), ID, measure, false).svg;
    const texts = labelTexts(out);
    assert.equal(texts.length, 2);
    for (const t of texts) assert.equal(t.plain, 'Ice &amp; Fire');
  });

  it('& is measured unescaped and written escaped', () => {
    const seen: string[] = [];
    const out = tidyMapLabels(pluginSvg([{ ...H0402, label: 'Repair&Manipulate' }]), ID,
      (t, size) => { seen.push(t); return measure(t, size); }, false).svg;
    assert.ok(seen.some(t => t.includes('&') && !t.includes('&amp;')));
    for (const t of labelTexts(out)) assert.deepEqual(t.lines, ['Repair&amp;', 'Manipulate']);
  });
});

describe('US-4.9 AC-5: linked labels keep their link', () => {
  it('the <a href> stays around the label text, the glow stays outside it', () => {
    const out = tidyMapLabels(pluginSvg([{ ...H0402, label: 'Limb Regeneration', link: 'Limb regeneration' }]), ID, measure, false).svg;
    assert.match(out, /<a [^>]*href="Limb regeneration"[^>]*><text\b[^>]*>(?:<tspan[^>]*>[^<]*<\/tspan>){2}<\/text><\/a>/);
    assert.match(out, /<g><text\b[^>]*stroke="white"[^>]*>(?:<tspan[^>]*>[^<]*<\/tspan>){2}<\/text><a /);
  });
});

describe('US-4.9 AC-6: unknown structure is left alone', () => {
  it('no labels group: the map keeps its labels as drawn, and the step is reported', () => {
    const svg = pluginSvg([{ ...H0402, label: 'Ice Crystal' }], { withLabels: false });
    const r = tidyMapLabels(svg, ID, measure, false);
    assert.deepEqual(r.skipped, ['labels']);
    assert.doesNotMatch(r.svg, /coordinates-/, 'the other step still runs');
  });

  it('no coordinates group: reported, labels still tidied', () => {
    const svg = pluginSvg([{ ...H0402, label: 'Limb Regeneration' }], { withCoords: false });
    const r = tidyMapLabels(svg, ID, measure, false);
    assert.deepEqual(r.skipped, ['coordinates']);
    assert.ok(labelTexts(r.svg).every(t => t.lines.length === 2));
  });

  it('a labels group whose entries do not have the expected shape is left unchanged', () => {
    const svg = pluginSvg([{ ...H0402, label: 'Limb Regeneration' }]).replace('<g><text', '<g><circle r="1"/><text');
    const r = tidyMapLabels(svg, ID, measure, false);
    assert.deepEqual(r.skipped, ['labels']);
    assert.match(r.svg, /y="415.7"/);
  });

  it('maps written with `option global` (ids without the map id) are recognised', () => {
    const svg = pluginSvg([{ ...H0402, label: 'Limb Regeneration' }], { id: '' });
    const r = tidyMapLabels(svg, ID, measure, false);
    assert.deepEqual(r.skipped, []);
    assert.doesNotMatch(r.svg, />0402</);
  });

  it('a map without any labels is fine', () => {
    const r = tidyMapLabels(pluginSvg([H0402]), ID, measure, false);
    assert.deepEqual(r.skipped, []);
  });
});

describe('US-4.9: helpers', () => {
  it('fontSizeToUnits: pt × 4/3, px and plain numbers as they are, default 20pt', () => {
    assert.ok(Math.abs(fontSizeToUnits('20pt') - 26.667) < 0.01);
    assert.equal(fontSizeToUnits('18px'), 18);
    assert.equal(fontSizeToUnits('24'), 24);
    assert.ok(Math.abs(fontSizeToUnits(undefined) - 26.667) < 0.01);
  });

  it('isHorizontalMap: an `option horizontal` line makes a map pointy-top', () => {
    assert.equal(isHorizontalMap('option horizontal\n0101 grass'), true);
    assert.equal(isHorizontalMap('0101 grass "option horizontal"'), false);
    assert.equal(isHorizontalMap('0101 grass'), false);
  });
});

describe('US-4.9 AC-7: one setting, on by default, read at compile time', () => {
  const root = new URL('../../plugin/', import.meta.url);
  const main = readFileSync(new URL('src/main.ts', root), 'utf8');
  const renderer = readFileSync(new URL('src/textmapper.ts', root), 'utf8');

  it('the setting defaults to true and is passed to the renderer', () => {
    assert.match(main, /tidyMapLabels: true/);
    assert.match(main, /renderTextMapperBlock\(this\.app, code, destinationPath, writer, mapFont, this\.settings\.tidyMapLabels\)/);
  });

  it('the renderer tidies only when the setting is on', () => {
    assert.match(renderer, /if \(tidyLabels\) \{[^}]*tidyMapLabels\(/);
  });
});

describe('US-4.9 AC-9: the PNG name records tidying', () => {
  it('on appends t to the font key, off keeps it', () => {
    assert.equal(mapImageKey('2cb44a0b', true), '2cb44a0bt');
    assert.equal(mapImageKey('2cb44a0b', false), '2cb44a0b');
  });
});
