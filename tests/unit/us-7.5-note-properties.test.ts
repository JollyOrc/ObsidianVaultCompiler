/**
 * US-7.5 AC-5, AC-6: writing the two target keys into a note's frontmatter.
 * Pure `setNoteProperties`; the `vault.process` single write is in the wiring
 * test. Invented note texts only.
 * SCAR-019: each key alone, both, none, removal, no frontmatter, broken frontmatter.
 * Red until US-7.5 is implemented (G2, 2026-11-26).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const props = () => import('../../plugin/src/note-properties.ts');
const set = async (text: string, values: Record<string, string | null>) =>
  (await props()).setNoteProperties(text, values);

describe('US-7.5 AC-6: setting keys', () => {
  it('adds one key and keeps other keys, their order, comments and the body', async () => {
    const text = '---\ntags: [a, b]\n# keep me\naliases:\n  - Lamp\n---\nBody line.\n\n# Heading\n';
    const r = await set(text, { 'compile-folder': 'Sheets' });
    assert.deepEqual(r, {
      ok: true,
      text: '---\ntags: [a, b]\n# keep me\naliases:\n  - Lamp\ncompile-folder: Sheets\n---\nBody line.\n\n# Heading\n',
    });
  });
  it('sets both keys', async () => {
    const r = await set('---\ntitle: Keep\n---\nText', { 'compile-folder': 'Sheets', 'compile-file': 'Keep.md' });
    assert.deepEqual(r, { ok: true, text: '---\ntitle: Keep\ncompile-folder: Sheets\ncompile-file: Keep.md\n---\nText' });
  });
  it('replaces an existing value in place (order kept)', async () => {
    const r = await set('---\ncompile-folder: Old\ntitle: Keep\n---\nText', { 'compile-folder': 'New' });
    assert.deepEqual(r, { ok: true, text: '---\ncompile-folder: New\ntitle: Keep\n---\nText' });
  });
  it('a value YAML needs quoted is quoted', async () => {
    const r = await set('---\ntitle: Keep\n---\nText', { 'compile-file': 'a: b.md' });
    assert.equal(r.ok, true);
    if (r.ok) assert.match(r.text, /compile-file: ["']a: b\.md["']/);
  });
  it('a note without frontmatter gets one; every body byte stays', async () => {
    const body = 'First line\r\n\r\nSecond  \n';
    const r = await set(body, { 'compile-folder': 'Sheets' });
    assert.deepEqual(r, { ok: true, text: '---\ncompile-folder: Sheets\n---\n' + body });
  });
  it('an empty note gets a frontmatter', async () => {
    const r = await set('', { 'compile-file': 'Keep.md' });
    assert.deepEqual(r, { ok: true, text: '---\ncompile-file: Keep.md\n---\n' });
  });
});

describe('US-7.5 AC-6: other keys keep their bytes (yaml 2.9.1 default would pad flow collections)', () => {
  it('flow collections, maps, dates, quotes and a leading comment stay byte for byte', async () => {
    const fm = '# leading comment\ntags: [x, y]\nsolo: [x]\nmeta: {a: 1}\ndate: 2026-11-26\nlong: "quoted text"\nsingle: \'s\'\n';
    const r = await set('---\n' + fm + '---\nBody\n', { 'compile-folder': 'Sheets' });
    assert.deepEqual(r, { ok: true, text: '---\n' + fm + 'compile-folder: Sheets\n---\nBody\n' });
  });
  it('removing a key leaves the same bytes for the rest', async () => {
    const fm = 'solo: [x]\nmeta: {a: 1}\n';
    const r = await set('---\n' + fm + 'compile-file: K.md\n---\nBody\n', { 'compile-file': null });
    assert.deepEqual(r, { ok: true, text: '---\n' + fm + '---\nBody\n' });
  });
  it('a value that reads as another type is written quoted', async () => {
    const r = await set('---\ntitle: Keep\n---\nText', { 'compile-file': 'yes: no' });
    assert.deepEqual(r, { ok: true, text: '---\ntitle: Keep\ncompile-file: "yes: no"\n---\nText' });
  });
});

describe('US-7.5 AC-5, AC-6: removing keys', () => {
  it('null removes one key, the other stays', async () => {
    const r = await set('---\ncompile-folder: Sheets\ncompile-file: Keep.md\n---\nText', { 'compile-folder': null });
    assert.deepEqual(r, { ok: true, text: '---\ncompile-file: Keep.md\n---\nText' });
  });
  it('removing both keeps unrelated keys', async () => {
    const r = await set('---\ncompile-folder: S\ntitle: Keep\ncompile-file: K.md\n---\nText', {
      'compile-folder': null, 'compile-file': null,
    });
    assert.deepEqual(r, { ok: true, text: '---\ntitle: Keep\n---\nText' });
  });
  it('a frontmatter left empty is removed with its --- lines', async () => {
    const r = await set('---\ncompile-folder: S\ncompile-file: K.md\n---\nText\n', {
      'compile-folder': null, 'compile-file': null,
    });
    assert.deepEqual(r, { ok: true, text: 'Text\n' });
  });
  it('removing an absent key from a note without frontmatter changes nothing', async () => {
    assert.deepEqual(await set('Text\n', { 'compile-folder': null }), { ok: true, text: 'Text\n' });
  });
});

describe('US-7.5 AC-6: broken frontmatter is not changed', () => {
  it('an unclosed frontmatter: ok false with a reason', async () => {
    const r = await set('---\ntitle: Keep\nText without end', { 'compile-folder': 'S' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.error.length > 0);
  });
  it('a non-mapping frontmatter (a list): ok false with a reason', async () => {
    const r = await set('---\n- a\n- b\n---\nText', { 'compile-folder': 'S' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.error.length > 0);
  });
  it('invalid YAML: ok false', async () => {
    const r = await set('---\ntitle: [unclosed\n---\nText', { 'compile-folder': 'S' });
    assert.equal(r.ok, false);
  });
});

// Added at G4 review (2026-11-26): a mutant that dropped the frontmatter's
// line ends survived — no test had \r\n inside the frontmatter (SCAR-023).
describe('US-7.5 AC-6: Windows line ends inside the frontmatter are kept', () => {
  it('set and remove keep \\r\\n in the block and the body', async () => {
    const { setNoteProperties } = await props();
    assert.deepEqual(
      setNoteProperties('---\r\ntags: [x]\r\n---\r\nText\r\n', { 'compile-file': 'Keep.md' }),
      { ok: true, text: '---\r\ntags: [x]\r\ncompile-file: Keep.md\r\n---\r\nText\r\n' },
    );
    assert.deepEqual(
      setNoteProperties('---\r\ntags: [x]\r\ncompile-file: Keep.md\r\n---\r\nText\r\n', { 'compile-file': null }),
      { ok: true, text: '---\r\ntags: [x]\r\n---\r\nText\r\n' },
    );
  });
});
