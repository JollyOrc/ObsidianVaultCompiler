# SCAR-031 — Decisions left in the plugin's entry point, where no test reaches them

**Area:** Architecture / Verification
**Severity:** Medium — no wrong result shipped; four mutants of the code survived

---

## What went wrong

The preset screen's Duplicate, Rename and Delete were wired inline in
`main.ts` (`openDetails`): the refusal notice, the rename that keeps the
active preset active, the dialog that resolves the rename when it closes,
the delete that reports whether it happened. `main.ts` extends Obsidian's
`Plugin` and builds Obsidian objects, so no test ran that code. The mutation
run of US-029 #113 (2026-10-31) found four mutants alive: a cancelled delete
reported as done, a name dialog that never resolves, an active preset that
loses its active status on rename, a silent duplicate refusal. Moved into
`settings/preset-actions.ts` with ten tests over the real preset store, all
were caught; one more line (handing `resolve` to the dialog) needed a text
check.

## Root cause

The architecture rule "side effects only in `src/plugin`" was read as "the
plugin shell may hold any code". Glue that only hands Obsidian objects over
was mixed with decisions (which preset becomes active, what a cancel
returns), and the decisions inherited the shell's untestability.

## Prevention

- The entry point (`main.ts`, a view's constructor) only builds Obsidian
  objects and hands them to functions; every decision (a condition, a
  result, an order of steps) lives in a function whose dependencies are
  passed in, with tests over the real stores or fakes.
- When a ticket adds wiring to the entry point, the mutation run includes it;
  a surviving mutant there is moved out, not explained away.
- The line that remains in the entry point (passing a callback, a dialog) is
  guarded by a text check that names it.
- Applies next to: commands, menu handlers, ribbon actions, settings tab and
  view wiring, event registrations.
