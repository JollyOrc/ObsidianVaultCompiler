# Hex maps (Text Mapper)

[Back to the manual](manual.md)

If your notes contain hex maps written for the **Text Mapper** plugin (blocks
that start with ` ```text-mapper `), the compiler turns each map into a
picture (PNG) in `assets/textmapper/`.

## Contents

- [How maps are drawn](#how-maps-are-drawn)
- [Map font and tidy labels](#map-font-and-tidy-labels)
- [Maps in your own style: no outlines, no glow](#maps-in-your-own-style-no-outlines-no-glow)
- [A caption for a map](#a-caption-for-a-map)
- [Small boxes in the hex corners, with and without a tick](#small-boxes-in-the-hex-corners-with-and-without-a-tick)
- [Problems](#problems)

## How maps are drawn

- The **Text Mapper** plugin must be installed and switched on in the same
  vault. The compiler asks it to draw the map, so the picture looks like what
  you see in Obsidian.
- The picture has a **transparent background** and is up to 2048 pixels on
  its longest side.
- The same map used in several notes is drawn only once.
- The picture has **no caption** unless you give it one (see below).
- With **Enable TextMapper rendering** off (settings tab, section **Maps**),
  the maps are left as text blocks with a hidden note in the document.

Old map pictures are not removed: delete `assets/textmapper/` in the output
folder to clear out pictures of maps you have changed or removed.

## Map font and tidy labels

Two settings behind the gear of **Enable TextMapper rendering** (window
**Settings of the maps**) change how compiled maps look. Maps inside Obsidian
are never changed.

| Setting | Default | What it does |
| --- | --- | --- |
| Map font | empty | The font for place names, as a font list such as `Georgia, serif`. Empty: the font Obsidian shows your notes in. If a font cannot be embedded, a notice says so and the next font in the list is used. |
| Tidy map labels | on | Removes the small hex numbers (like `0402`), centres each place name in its hex, and breaks long names onto several lines so they stay inside the hex. If one single word is too wide for its hex, a notice names the map. |

## Maps in your own style: no outlines, no glow

Text Mapper draws a thin black outline around every hex and a white glow
behind every name. For a map drawn in your own colours (a skill tree, for
example) you can leave both out of the compiled picture. Put this line
anywhere in the map:

```
# vault-compiler: no-outlines no-glow
```

- `no-outlines` leaves out the black hex outlines. Your own colours, symbols,
  paths and names stay.
- `no-glow` leaves out the white glow behind names (also names along paths).
- You can use just one of the two words.
- The line starts with `#`, so Text Mapper treats it as a comment: the map
  inside Obsidian still shows the outlines and the glow. Only the compiled
  picture changes. The `#` must be at the very beginning of the line, with no
  spaces in front.
- A misspelt word (`no-outline`) is ignored, and the warnings file lists it
  with the note it is in.

**Good to know when you style a map yourself:**

- Your own `default attributes`, `glow` or `label` lines in the map have no
  effect: Text Mapper adds its own after yours, and its own win. That is why
  the line above exists.
- Give your own hex types names Text Mapper does not use already. `red`,
  `green` or `water` are taken; `skill-red` or `my-water` are safe.
- If your map defines SVG filters (for rough, hand-drawn edges), add the line
  `option global`, or the filters are not found.

## A caption for a map

A compiled map is written as `![](assets/textmapper/….png)`, with no text, so
a typesetter such as Obsidian2Typst prints it without a caption. To give one
map a caption, put this line anywhere in the map:

```
# vault-compiler: caption Branches of the fighting skills
```

- Everything after `caption` is the caption, as written.
- It can follow the other words:
  `# vault-compiler: no-glow caption Moss and Stone`.
- Like the line above, it starts with `#` at the very beginning of the line,
  and Text Mapper ignores it.
- Avoid `|` in a caption: Obsidian2Typst ends the caption there. The warnings
  file tells you if a caption has one, or if a map has two caption lines (the
  first one is used).

## Small boxes in the hex corners, with and without a tick

A skill tree often has a small box in each hex to tick off. Add these two
lines to the map, once:

```
<g id="box"><polygon points="74,-70 64,-53 44,-53 34,-70 44,-87 64,-87" fill="white" stroke="#4f7d4a" stroke-width="3"/></g>
<g id="check"><path d="M 36,-80 L 50,-62 L 84,-106" fill="none" stroke="black" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></g>
```

Each one must stay on a single line. The first defines `box`, a small white
hex in the top-right corner; the second defines `check`, a tick over that
corner. Then add the words to the hexes:

```
# vault-compiler: no-outlines no-glow
skill-green attributes fill="none" stroke="#4f7d4a" stroke-width="6"
0101 skill-green box "Climbing"
0201 skill-green box check "Swimming"
0102 skill-green "Running"
```

- `box` gives an empty box: *Climbing*.
- `box check` gives a ticked box: *Swimming*.
- Neither gives no box: *Running*.
- Write `box` **before** `check`. Things are drawn in the order you write
  them, so `check box` puts the white box over most of the tick.
- The box covers the hex outline where they meet, like a label sticking out
  of the corner.
- Colours: `fill="white"` is the inside of the box and `stroke="#4f7d4a"` its
  border; use your page colour (for example `fill="#efe6d6"`) if white stands
  out too much. The tick's colour is its `stroke`.
- These positions are for ordinary maps. Maps with `option horizontal` have
  pointed tops, so the box would sit beside the corner, not on it.

## Problems

| You see | Meaning |
| --- | --- |
| Notice *… the Text Mapper plugin is not installed or enabled …* | Each map is replaced by a hidden placeholder. Install or switch on Text Mapper. |
| Notice *… map font "…" could not be embedded …* | That font was not available; the next font in your list is used. |
| Notice *… a label in map "…" has a word too wide for its hex.* | Shorten the word, or use a narrower map font. |
| Notice *… some maps were not tidied …* or *… map directive "…" could not be applied …* | Text Mapper drew a map differently than expected (perhaps a new version); that map keeps its hex numbers, outlines or glow. |
| Warning *TextMapper render failed: …* | One map could not be drawn; it is replaced by a placeholder and the rest of the document is compiled. The warning names the line where the map starts. |

All warnings are listed in [Warnings and messages](warnings.md).
