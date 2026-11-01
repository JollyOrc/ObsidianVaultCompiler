/**
 * Heading anchors as Obsidian finds them (US-2.3, decided 2026-11-01).
 *
 * Measured in Obsidian (the table in US-2.3): a heading is found by its text,
 * case-insensitively; in the heading, `#`, `:`, `|` and `^` count as spaces
 * and runs of spaces as one; a path `A#B#C` finds the first heading `C` whose
 * parents (headings before it with a smaller level) contain `B` and, above
 * it, `A`, parents skippable.
 */

import { decodeLink } from './utils.ts';

/** A heading of a document: its level and its text as written. */
export interface Heading {
  level: number;
  text: string;
}

/**
 * US-2.3 | AC-2: a heading's text the way Obsidian writes it in a link —
 * `#`, `:`, `|`, `^` as spaces, runs of spaces as one, ends trimmed.
 */
export function anchorText(heading: string): string {
  return heading.replace(/[#:|^]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * US-2.3 | AC-2: encodes the four characters a markdown link target cannot
 * carry as they are: `%` (first), space, `(` and `)`. Everything else is kept.
 */
export function encodeAnchor(text: string): string {
  return text.replace(/%/g, '%25').replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
}

/** US-2.3 | AC-6: text as Obsidian compares it (case, `**`, `[[ ]]`, spaces). */
function compareKey(text: string): string {
  return text.replace(/\*\*/g, '').replace(/\[\[|\]\]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** US-2.3 | AC-6: a heading's text as Obsidian compares it. */
export function headingKey(heading: string): string {
  return compareKey(anchorText(heading));
}

/**
 * US-2.3 | AC-4, AC-5: one part of a link's heading path as Obsidian compares
 * it. `%` escapes are decoded; `#`, `:` … are not turned into spaces here (a
 * link with `%3A` is not found, measured G7).
 */
export function linkKey(part: string): string {
  return compareKey(decodeLink(part));
}

/** US-2.3 | AC-6: headings with their compare keys and parents, built once. */
export class Outline {
  readonly headings: Heading[];
  readonly keys: string[];
  /** The nearest parent of each heading (smaller level, before it), or -1. */
  readonly parent: number[];

  constructor(headings: Heading[]) {
    this.headings = headings;
    this.keys = headings.map(h => headingKey(h.text));
    this.parent = [];
    const stack: number[] = [];
    headings.forEach((h, i) => {
      while (stack.length > 0 && headings[stack[stack.length - 1]].level >= h.level) stack.pop();
      this.parent.push(stack.length > 0 ? stack[stack.length - 1] : -1);
      stack.push(i);
    });
  }

  /**
   * US-2.3 | AC-6: the heading Obsidian opens for a path of compare keys
   * (outermost first, target last), or -1.
   */
  find(keys: string[]): number {
    const target = keys[keys.length - 1];
    const wanted = keys.slice(0, -1).reverse();
    for (let i = 0; i < this.headings.length; i++) {
      if (this.keys[i] !== target) continue;
      let k = 0;
      for (let p = this.parent[i]; p !== -1 && k < wanted.length; p = this.parent[p]) {
        if (this.keys[p] === wanted[k]) k++;
      }
      if (k === wanted.length) return i;
    }
    return -1;
  }

  /**
   * US-2.3 | AC-2, AC-6: the anchor (without `#`) that opens heading
   * `target`: its own text, or its parents nearest first in front of it until
   * the path finds it. When no path does, the plain text and the number of
   * headings with that text (`duplicates`), else `duplicates` is 0.
   */
  anchorFor(target: number): { anchor: string; duplicates: number } {
    const own = encodeAnchor(anchorText(this.headings[target].text));
    if (this.find([this.keys[target]]) === target) return { anchor: own, duplicates: 0 };
    const path = [target];
    for (let p = this.parent[target]; p !== -1; p = this.parent[p]) {
      path.unshift(p);
      if (this.find(path.map(i => this.keys[i])) === target) {
        return { anchor: path.map(i => encodeAnchor(anchorText(this.headings[i].text))).join('#'), duplicates: 0 };
      }
    }
    return { anchor: own, duplicates: this.keys.filter(k => k === this.keys[target]).length };
  }
}
