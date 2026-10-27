/**
 * Integration tests for Obsidian control command removal (TT-1.5).
 *
 * Covers Epic 5: meta-bind-embed, leaflet, calendarium, compressed-json and
 * SerializedQuery fences/markers are removed from compiled output.
 * No supported plugin directive may remain in visible output.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryVaultCompiler } from '../../plugin/src/compiler.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compile(body: string): string {
  return new InMemoryVaultCompiler({
    'index.md': body,
  }).compile('index.md').content;
}

// ---------------------------------------------------------------------------
// Individual fence-language removal
// ---------------------------------------------------------------------------

describe('control command fence removal', () => {
  it('removes a meta-bind-embed fenced block from compiled output', () => {
    const src = 'Before.\n```meta-bind-embed\nFORM[myForm]\n```\nAfter.\n';
    const out = compile(src);
    assert.doesNotMatch(out, /meta-bind-embed/);
    assert.doesNotMatch(out, /FORM\[myForm\]/);
    assert.match(out, /Before\./);
    assert.match(out, /After\./);
  });

  it('removes a leaflet fenced block from compiled output', () => {
    const src = 'Text.\n```leaflet\nid: mymap\nlat: 51\n```\nMore text.\n';
    const out = compile(src);
    assert.doesNotMatch(out, /leaflet/);
    assert.doesNotMatch(out, /id: mymap/);
    assert.match(out, /Text\./);
    assert.match(out, /More text\./);
  });

  it('removes a calendarium fenced block from compiled output', () => {
    const src = 'Event:\n```calendarium\ncalendar: myCalendar\n```\nDone.\n';
    const out = compile(src);
    assert.doesNotMatch(out, /calendarium/);
    assert.doesNotMatch(out, /calendar: myCalendar/);
    assert.match(out, /Event:/);
    assert.match(out, /Done\./);
  });

  it('removes a compressed-json fenced block from compiled output', () => {
    const src = 'Data:\n```compressed-json\n{"x":1}\n```\nEnd.\n';
    const out = compile(src);
    assert.doesNotMatch(out, /compressed-json/);
    assert.doesNotMatch(out, /\{"x":1\}/);
    assert.match(out, /Data:/);
    assert.match(out, /End\./);
  });

  it('removes a dataview fenced block from compiled output', () => {
    const src = 'List:\n```dataview\nTABLE file.name\n```\nFooter.\n';
    const out = compile(src);
    assert.doesNotMatch(out, /TABLE file\.name/);
    assert.match(out, /List:/);
    assert.match(out, /Footer\./);
  });

  it('removes a dataviewjs fenced block from compiled output', () => {
    const src = 'Script:\n```dataviewjs\ndv.list([])\n```\nEnd.\n';
    const out = compile(src);
    assert.doesNotMatch(out, /dv\.list/);
    assert.match(out, /Script:/);
  });

  it('removes multiple control fences of different types from one file', () => {
    const src = [
      'Intro.',
      '```leaflet',
      'id: m',
      '```',
      'Middle.',
      '```calendarium',
      'calendar: c',
      '```',
      'End.',
    ].join('\n') + '\n';
    const out = compile(src);
    assert.doesNotMatch(out, /leaflet/);
    assert.doesNotMatch(out, /calendarium/);
    assert.match(out, /Intro\./);
    assert.match(out, /Middle\./);
    assert.match(out, /End\./);
  });
});

// ---------------------------------------------------------------------------
// SerializedQuery / QueryToSerialize removal
// ---------------------------------------------------------------------------

describe('SerializedQuery marker removal', () => {
  it('removes a SerializedQuery HTML comment block from output', () => {
    const src = [
      'Before.',
      '<!-- SerializedQuery: TABLE file.name FROM "notes" -->',
      '- [[note1]]',
      '- [[note2]]',
      '<!-- SerializedQuery End -->',
      'After.',
    ].join('\n') + '\n';
    const out = compile(src);
    assert.doesNotMatch(out, /SerializedQuery/);
    assert.match(out, /Before\./);
    assert.match(out, /After\./);
  });

  it('removes a QueryToSerialize comment block from output', () => {
    const src = [
      'Header.',
      '<!-- QueryToSerialize: LIST FROM "folder" -->',
      '- [[item]]',
      '<!-- QueryToSerialize End -->',
      'Footer.',
    ].join('\n') + '\n';
    const out = compile(src);
    assert.doesNotMatch(out, /QueryToSerialize/);
    assert.match(out, /Header\./);
    assert.match(out, /Footer\./);
  });
});

// ---------------------------------------------------------------------------
// No directive remains in output
// ---------------------------------------------------------------------------

describe('no control directive remains in compiled output', () => {
  const controlTags = [
    'meta-bind-embed',
    'leaflet',
    'calendarium',
    'compressed-json',
    'SerializedQuery',
    'QueryToSerialize',
  ];

  it('produces output with no known control fence tag after compilation', () => {
    const blocks = [
      '```meta-bind-embed\nFORM[x]\n```',
      '```leaflet\nid: y\n```',
      '```calendarium\ncalendar: z\n```',
      '```compressed-json\n{}\n```',
      '<!-- SerializedQuery: q -->\n- item\n<!-- SerializedQuery End -->',
    ].join('\n');
    const src = `Preamble.\n${blocks}\nPostamble.\n`;
    const out = compile(src);
    for (const tag of controlTags) {
      assert.doesNotMatch(out, new RegExp(tag), `"${tag}" should not appear in compiled output`);
    }
  });

  it('preserves non-control fenced code blocks in the output', () => {
    const src = 'Docs.\n```python\nprint("hello")\n```\nEnd.\n';
    const out = compile(src);
    assert.match(out, /print\("hello"\)/);
  });
});
