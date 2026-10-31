# SCAR-030 — A dependency applies its defaults after the user's input, and the user's settings silently do nothing

**Area:** Requirements / Integration
**Severity:** Medium — a false statement stood in a Done story for four days; a map author's style lines are accepted without a word and ignored

---

## What went wrong

A tool accepts user input and its own built-in definitions in the same
format, and processes them as one list: user input first, defaults after.
When both define the same name, the later definition wins, so every default
overrides the user. Nothing reports it: the user's line is valid, it is
parsed, and it has no effect. A user-defined name that happens to equal a
built-in one is replaced as well, with a result that looks like a bug in the
user's own definition.

In this project: the Text Mapper plugin appends its Gnomeyland and
Apocalypse libraries to the map source. A map's own `default attributes`,
`glow` and `label` lines are overridden, and a custom type called `red` is
replaced by Gnomeyland's debug type `red` (a half-size filled red hex). US-4.9
(Done 2026-10-27) said labels keep the plugin's size "unless the map sets its
own label attributes"; that was never true. Found 2026-10-31 while
prototyping a map style for US-4.10, when the first render showed red filled
hexes instead of red outlines.

## Root cause

"The user can set X" was inferred from the input syntax: the format has a
line for X, so a line for X must take effect. Precedence — which of two
definitions of the same name wins, and in what order the sources are
merged — was not looked up. The tool's docs and syntax describe what can be
written, not what survives the merge.

## Prevention

- When a dependency combines user input with its own defaults, libraries or
  presets, find out the merge order and the rule for a name defined twice
  (first wins, last wins, merged, error), from its source or by measurement,
  and write it into the story that relies on it (SCAR-024).
- For every setting a story says the user can change, measure it with a
  non-default value through the real tool and see the output change
  (SCAR-019); "the line parses" is not "the line has effect".
- List the names the dependency defines by itself. A story that lets users
  define their own names (types, styles, variables, ids) says that those
  names must not be among them, and the test uses a clashing name to show
  what happens.
- When our code can see the user's input and the defaults, prefer a check
  that warns about a clash over a silent override.
- Applies next to: style sheets loaded after a user's CSS, template and theme
  defaults, config files merged with built-in ones, plugin presets, rule
  libraries, any "include" of definitions the user does not see.
