/**
 * Tests for map directives: no hex outlines, no label glow (US-4.10, decided
 * 2026-10-31), and the empty-group case of US-4.9 AC-6 found while writing
 * them.
 *
 * The SVG constants are the output of Text Mapper v1.1.0's own `main.js`, run
 * in Node with a DOM stand-in on 2026-10-31 (SCAR-023: inputs the real
 * producer gives), serialised the way `XMLSerializer` writes it: childless
 * elements self-closed. Only the `<defs>` content is cut to the one type the
 * map defines; the plugin also puts its whole Gnomeyland and Apocalypse
 * library there.
 *
 * Map of COMPOSITE (map id `vault-compiler-abc123`):
 *   skill-moss attributes fill="none" stroke="#c4574f" stroke-width="7"
 *   0101 skill-moss "Moss"
 *   0102 skill-moss "Fog Lantern|Lantern"
 *   0103 skill-moss
 *   0101-0103 trail "Old Road"
 * The plugin skips `#` lines, so the same map with a directive line draws the
 * same SVG (measured).
 *
 * Written before the code (#91, #92); every test failed for the missing code
 * only, then passed with it.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyMapDirectives as apply, parseMapDirectives as parse, prepareMapSvg, tidyMapLabels } from '../../plugin/src/textmapper.ts';

const ID = 'vault-compiler-abc123';

const COMPOSITE =
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="-10 -59.999999999999986 320 640"><rect x="-10" y="-59.999999999999986" width="320" height="640" fill="white"/><defs>' +
  '<g id="skill-moss-vault-compiler-abc123"><polygon fill="none" stroke="#c4574f" stroke-width="7" points="-100.0,0.0 -50.0,86.6 50.0,86.6 100.0,0.0 50.0,-86.6 -50.0,-86.6"/></g></defs>' +
  '<g id="backgrounds-vault-compiler-abc123"><use x="150.0" y="86.6" href="#skill-moss-vault-compiler-abc123"/><use x="150.0" y="259.8" href="#skill-moss-vault-compiler-abc123"/><use x="150.0" y="433.0" href="#skill-moss-vault-compiler-abc123"/></g>' +
  '<g id="paths-vault-compiler-abc123"><path id="path-1-vault-compiler-abc123" type="trail" stroke="#e3bea3" stroke-width="6" fill="none" d="M150.0,138.6 C150.0,173.2 150.0,138.6 150.0,173.2 S150.0,311.8 150.0,346.4 L150.0,381.1"/></g>' +
  '<g id="things-vault-compiler-abc123"/>' +
  '<g id="coordinates-vault-compiler-abc123"><text font-size="20pt" dy="15px" text-anchor="middle" x="150.0" y="17.3">0101</text><text font-size="20pt" dy="15px" text-anchor="middle" x="150.0" y="190.5">0102</text><text font-size="20pt" dy="15px" text-anchor="middle" x="150.0" y="363.7">0103</text></g>' +
  '<g id="regions-vault-compiler-abc123"><polygon fill="none" stroke="black" stroke-width="3" id="hex.1.1-vault-compiler-abc123" points="50.0,86.6 100.0,173.2 200.0,173.2 250.0,86.6 200.0,0.0 100.0,0.0"/><polygon fill="none" stroke="black" stroke-width="3" id="hex.1.2-vault-compiler-abc123" points="50.0,259.8 100.0,346.4 200.0,346.4 250.0,259.8 200.0,173.2 100.0,173.2"/><polygon fill="none" stroke="black" stroke-width="3" id="hex.1.3-vault-compiler-abc123" points="50.0,433.0 100.0,519.6 200.0,519.6 250.0,433.0 200.0,346.4 100.0,346.4"/></g>' +
  '<g id="path-labels-vault-compiler-abc123"><g><text font-size="20pt" dy="5px" stroke="white" stroke-width="5pt"><textPath href="#path-1-vault-compiler-abc123">Old Road</textPath></text><text font-size="20pt" dy="5px"><textPath href="#path-1-vault-compiler-abc123">Old Road</textPath></text></g></g>' +
  '<g id="labels-vault-compiler-abc123"><g><text text-anchor="middle" x="150.0" y="155.9" font-size="20pt" dy="5px" stroke="white" stroke-width="5pt">Moss</text><text text-anchor="middle" x="150.0" y="155.9" font-size="20pt" dy="5px">Moss</text></g><g><text text-anchor="middle" x="150.0" y="329.1" font-size="20pt" dy="5px" stroke="white" stroke-width="5pt">Lantern</text><a data-tooltip-position="top" aria-label="Fog Lantern" href="Fog Lantern" data-href="Fog Lantern" class="internal-link" target="_blank" rel="noopener"><text text-anchor="middle" x="150.0" y="329.1" font-size="20pt" dy="5px">Lantern</text></a></g></g></svg>';

/** A map without labels or paths: `0101 skill-moss` only. */
const NO_LABELS =
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="-10 -59.999999999999986 320 293"><rect x="-10" y="-59.999999999999986" width="320" height="293" fill="white"/><defs>' +
  '<g id="skill-moss-vault-compiler-abc123"><polygon fill="none" stroke="#c4574f" stroke-width="7" points="-100.0,0.0 -50.0,86.6 50.0,86.6 100.0,0.0 50.0,-86.6 -50.0,-86.6"/></g></defs>' +
  '<g id="backgrounds-vault-compiler-abc123"><use x="150.0" y="86.6" href="#skill-moss-vault-compiler-abc123"/></g>' +
  '<g id="paths-vault-compiler-abc123"/>' +
  '<g id="things-vault-compiler-abc123"/>' +
  '<g id="coordinates-vault-compiler-abc123"><text font-size="20pt" dy="15px" text-anchor="middle" x="150.0" y="17.3">0101</text></g>' +
  '<g id="regions-vault-compiler-abc123"><polygon fill="none" stroke="black" stroke-width="3" id="hex.1.1-vault-compiler-abc123" points="50.0,86.6 100.0,173.2 200.0,173.2 250.0,86.6 200.0,0.0 100.0,0.0"/></g>' +
  '<g id="path-labels-vault-compiler-abc123"/>' +
  '<g id="labels-vault-compiler-abc123"/></svg>';

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const OUTLINE = /<polygon fill="none" stroke="black" stroke-width="3" id="hex\./g;
const GLOW = /<text\b[^>]*stroke="white" stroke-width="5pt"/g;

describe('US-4.10 AC-1: directive lines', () => {
  it('both words in one line', () => {
    assert.deepEqual(parse('# vault-compiler: no-outlines no-glow\n0101 forest "Peak"'),
      { noOutlines: true, noGlow: true, unknown: [] });
  });

  it('several lines anywhere add up; key and words ignore case', () => {
    const code = '# vault-compiler: no-outlines\n0101 forest\n0102 forest\n#Vault-Compiler: NO-GLOW';
    assert.deepEqual(parse(code), { noOutlines: true, noGlow: true, unknown: [] });
  });

  it('spaces after `#` and between words are allowed', () => {
    assert.deepEqual(parse('#   vault-compiler:   no-glow   \n0101 forest'),
      { noOutlines: false, noGlow: true, unknown: [] });
  });

  it('a line with leading spaces is not a directive line, and is not reported', () => {
    assert.deepEqual(parse('  # vault-compiler: no-glow\n0101 forest'),
      { noOutlines: false, noGlow: false, unknown: [] });
  });

  it('`vault compiler` without the hyphen is an ordinary comment', () => {
    assert.deepEqual(parse('# vault compiler: no-glow\n0101 forest'),
      { noOutlines: false, noGlow: false, unknown: [] });
  });

  it('a map without directive lines switches nothing', () => {
    assert.deepEqual(parse('# a comment\n0101 forest "Peak"'),
      { noOutlines: false, noGlow: false, unknown: [] });
  });

  it('a directive word in a label or a non-comment line is not a directive', () => {
    assert.deepEqual(parse('0101 forest "vault-compiler: no-glow"'),
      { noOutlines: false, noGlow: false, unknown: [] });
  });
});

describe('US-4.10 AC-2: unknown words', () => {
  it('an unknown word is listed and switches nothing', () => {
    assert.deepEqual(parse('# vault-compiler: no-outline\n0101 forest'),
      { noOutlines: false, noGlow: false, unknown: ['no-outline'] });
  });

  it('words joined by a comma are one unknown word', () => {
    assert.deepEqual(parse('# vault-compiler: no-outlines,no-glow\n0101 forest'),
      { noOutlines: false, noGlow: false, unknown: ['no-outlines,no-glow'] });
  });

  it('the same unknown word twice in one map is listed once; known words still apply', () => {
    const code = '# vault-compiler: no-outline no-glow\n# vault-compiler: no-outline';
    assert.deepEqual(parse(code), { noOutlines: false, noGlow: true, unknown: ['no-outline'] });
  });

  it('an empty word list switches nothing and lists nothing', () => {
    assert.deepEqual(parse('# vault-compiler:\n0101 forest'),
      { noOutlines: false, noGlow: false, unknown: [] });
  });
});

describe('US-4.10 AC-3: no-outlines', () => {
  it('removes the regions group with all three outlines, and nothing else', () => {
    assert.equal(count(COMPOSITE, OUTLINE), 3, 'fixture has three outlines');
    const r = apply(COMPOSITE, ID, { noOutlines: true, noGlow: false });
    assert.deepEqual(r.skipped, []);
    assert.equal(count(r.svg, OUTLINE), 0);
    const group = COMPOSITE.match(/<g id="regions-vault-compiler-abc123">.*?<\/g>/)![0];
    assert.equal(r.svg, COMPOSITE.replace(group, ''), 'only the regions group is gone');
  });

  it('keeps the hex fills, the path and the labels', () => {
    const r = apply(COMPOSITE, ID, { noOutlines: true, noGlow: false });
    assert.equal(count(r.svg, /<use x="150.0" y="[\d.]+" href="#skill-moss-/g), 3);
    assert.match(r.svg, /<path id="path-1-vault-compiler-abc123" type="trail"/);
    assert.equal(count(r.svg, GLOW), 3);
  });
});

describe('US-4.10 AC-4: no-glow', () => {
  it('removes exactly the three glow texts (two hex labels, one path label)', () => {
    assert.equal(count(COMPOSITE, GLOW), 3, 'fixture has three glows');
    const r = apply(COMPOSITE, ID, { noOutlines: false, noGlow: true });
    assert.deepEqual(r.skipped, []);
    assert.equal(count(r.svg, GLOW), 0);
    assert.equal(count(r.svg, /<text\b/g), count(COMPOSITE, /<text\b/g) - 3);
  });

  it('a plain label keeps its text', () => {
    const r = apply(COMPOSITE, ID, { noOutlines: false, noGlow: true });
    assert.ok(r.svg.includes('<g><text text-anchor="middle" x="150.0" y="155.9" font-size="20pt" dy="5px">Moss</text></g>'));
  });

  it('a linked label keeps its <a> and text', () => {
    const r = apply(COMPOSITE, ID, { noOutlines: false, noGlow: true });
    assert.match(r.svg, /<g><a [^>]*href="Fog Lantern"[^>]*><text [^>]*>Lantern<\/text><\/a><\/g>/);
  });

  it('a path label keeps its text and textPath', () => {
    const r = apply(COMPOSITE, ID, { noOutlines: false, noGlow: true });
    assert.ok(r.svg.includes('<g><text font-size="20pt" dy="5px"><textPath href="#path-1-vault-compiler-abc123">Old Road</textPath></text></g>'));
  });

  it('keeps the outlines', () => {
    const r = apply(COMPOSITE, ID, { noOutlines: false, noGlow: true });
    assert.equal(count(r.svg, OUTLINE), 3);
  });
});

describe('US-4.10 AC-5: each switch alone', () => {
  const cases: Array<[string, { noOutlines: boolean; noGlow: boolean }, number, number]> = [
    ['none', { noOutlines: false, noGlow: false }, 3, 3],
    ['no-outlines', { noOutlines: true, noGlow: false }, 0, 3],
    ['no-glow', { noOutlines: false, noGlow: true }, 3, 0],
    ['no-outlines no-glow', { noOutlines: true, noGlow: true }, 0, 0],
  ];
  for (const [name, d, outlines, glows] of cases) {
    it(`${name}: ${outlines} outlines, ${glows} glows`, () => {
      const r = apply(COMPOSITE, ID, d);
      assert.equal(count(r.svg, OUTLINE), outlines);
      assert.equal(count(r.svg, GLOW), glows);
    });
  }
});

describe('US-4.10 AC-6: with "Tidy map labels" (US-4.9)', () => {
  /** 0.48 × font size per character, as in map-labels.test.ts. */
  const measure = (text: string, fontSize: number) => text.length * fontSize * 0.48;
  const LONG = COMPOSITE.replace(/>Moss<\/text>/g, '>Moss Germinations</text>');

  it('tidy on, then no-glow: one text with two tspans, centred; no glow', () => {
    const tidied = tidyMapLabels(LONG, ID, measure, false);
    const r = apply(tidied.svg, ID, { noOutlines: false, noGlow: true });
    assert.equal(count(r.svg, GLOW), 0);
    const entry = r.svg.match(/<g><text [^>]*>(<tspan[^>]*>[^<]*<\/tspan>)+<\/text><\/g>/);
    assert.ok(entry, 'the Moss entry is one text with tspans');
    const ys = [...entry[0].matchAll(/<tspan x="150.0" y="([\d.]+)">/g)].map(m => Number(m[1]));
    assert.deepEqual(ys, [70.6, 102.6]);
  });

  it('tidy off, no-glow: the label stays at the plugin\'s position, one line', () => {
    const r = apply(LONG, ID, { noOutlines: false, noGlow: true });
    assert.ok(r.svg.includes('<g><text text-anchor="middle" x="150.0" y="155.9" font-size="20pt" dy="5px">Moss Germinations</text></g>'));
  });

  it('no-outlines does not depend on tidying', () => {
    const tidied = tidyMapLabels(COMPOSITE, ID, measure, false).svg;
    assert.equal(count(apply(tidied, ID, { noOutlines: true, noGlow: false }).svg, OUTLINE), 0);
    assert.equal(count(apply(COMPOSITE, ID, { noOutlines: true, noGlow: false }).svg, OUTLINE), 0);
  });

  it('renderTextMapperBlock tidies, then applies directives, then prepares the SVG', () => {
    const src = readFileSync(new URL('../../plugin/src/textmapper.ts', import.meta.url), 'utf8');
    const body = src.slice(src.indexOf('export async function renderTextMapperBlock'));
    const at = (needle: string) => body.indexOf(needle);
    assert.ok(at('tidyMapLabels(') > 0);
    assert.ok(at('applyMapDirectives(') > at('tidyMapLabels('), 'directives after tidying');
    assert.ok(at('prepareMapSvg(') > at('applyMapDirectives('), 'prepare after directives');
    assert.ok(at('parseMapDirectives(code)') > 0, 'directives read from the block source');
    // SCAR-023: the whole statement, at function level (two spaces), so the
    // directives run with tidying on and off and always read the block source.
    assert.match(body, /\n {2}const directives = applyMapDirectives\(svg, mapDocId\(code\), parseMapDirectives\(code\)\);\n/,
      'directives also run with tidying off');
  });
});

describe('US-4.10 AC-7: unknown structure', () => {
  it('no regions group: no-outlines is skipped, the map is unchanged', () => {
    const svg = COMPOSITE.replace(/<g id="regions-vault-compiler-abc123">.*?<\/g>/, '');
    const r = apply(svg, ID, { noOutlines: true, noGlow: false });
    assert.deepEqual(r.skipped, ['no-outlines']);
    assert.equal(r.svg, svg);
  });

  it('one entry without a white glow first: no glow is removed anywhere in the map', () => {
    const svg = COMPOSITE.replace('stroke="white" stroke-width="5pt">Moss<', 'stroke="black" stroke-width="5pt">Moss<');
    const r = apply(svg, ID, { noOutlines: false, noGlow: true });
    assert.deepEqual(r.skipped, ['no-glow']);
    assert.equal(r.svg, svg);
  });

  it('no labels group: no-glow is skipped; no-outlines still applies', () => {
    const svg = COMPOSITE.replace(/<g id="labels-vault-compiler-abc123">.*<\/g><\/svg>$/, '</svg>');
    assert.notEqual(svg, COMPOSITE);
    const r = apply(svg, ID, { noOutlines: true, noGlow: true });
    assert.deepEqual(r.skipped, ['no-glow']);
    assert.equal(count(r.svg, OUTLINE), 0);
    assert.equal(count(svg, GLOW), 1, 'without the labels group only the path-label glow is left');
    assert.equal(count(r.svg, GLOW), 1, 'the path-label glow stays: no half-changed map');
  });

  it('no path-labels group: no-glow is skipped', () => {
    const svg = COMPOSITE.replace(/<g id="path-labels-vault-compiler-abc123">.*?<\/g><\/g>/, '');
    assert.notEqual(svg, COMPOSITE);
    assert.deepEqual(apply(svg, ID, { noOutlines: false, noGlow: true }).skipped, ['no-glow']);
  });

  it('empty groups, self-closed as XMLSerializer writes them, are the right shape', () => {
    assert.match(NO_LABELS, /<g id="labels-vault-compiler-abc123"\/>/, 'fixture has the self-closed form');
    const r = apply(NO_LABELS, ID, { noOutlines: true, noGlow: true });
    assert.deepEqual(r.skipped, []);
    assert.equal(count(r.svg, OUTLINE), 0);
  });

  it('`option global` ids (no map id) are recognised', () => {
    const svg = COMPOSITE.replaceAll('-vault-compiler-abc123"', '"');
    const r = apply(svg, ID, { noOutlines: true, noGlow: true });
    assert.deepEqual(r.skipped, []);
    assert.equal(count(r.svg, OUTLINE), 0);
    assert.equal(count(r.svg, GLOW), 0);
  });

  it('main shows one notice per compile with the agreed text', () => {
    const main = readFileSync(new URL('../../plugin/src/main.ts', import.meta.url), 'utf8');
    assert.match(main, /`Vault Compiler: map directive "\$\{[^}]+\}" could not be applied; the map is drawn as the plugin made it\.`/);
  });
});

describe('US-4.10 AC-8: what stays', () => {
  it('no directive: the SVG is returned unchanged', () => {
    const r = apply(COMPOSITE, ID, { noOutlines: false, noGlow: false });
    assert.equal(r.svg, COMPOSITE);
    assert.deepEqual(r.skipped, []);
  });

  it('directives leave the background rect to prepareMapSvg (US-4.2 AC-4)', () => {
    const r = apply(COMPOSITE, ID, { noOutlines: true, noGlow: true });
    assert.match(r.svg, /<rect x="-10" y="-59.999999999999986" width="320" height="640" fill="white"\/>/);
    assert.doesNotMatch(prepareMapSvg(r.svg, 'sans-serif'), /fill="white"\/>/);
  });
});

describe('US-4.9 AC-6: an empty labels group as XMLSerializer writes it', () => {
  it('a map without labels is not reported as "not tidied"', () => {
    const r = tidyMapLabels(NO_LABELS, ID, () => 10, false);
    assert.deepEqual(r.skipped, []);
    assert.doesNotMatch(r.svg, /coordinates-/);
  });
});
