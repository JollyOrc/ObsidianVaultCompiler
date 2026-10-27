# SCAR-026 — A path from the user is joined as text, and the write lands somewhere nobody chose

**Area:** Data safety / Specification
**Severity:** High — the compile wrote its output, assets and logfile into the source vault that the plugin promises never to change

---

## What went wrong

The output folder `/Users/user/Desktop`, chosen with the system folder
picker, was joined to the filename as text and then split on `/` with empty
parts dropped. The leading `/` vanished, and the compile wrote
`<vault>/Users/user/Desktop/…` into the vault. The same code took
`/x/Vault Backup/out` for the vault folder ` Backup/out`, because "inside the
vault" was tested with `startsWith(vaultRoot)`. The story said "writes only to
the configured output", and every write had its own copy of "create the
folders, then write" in three files, none of which checked where it wrote.

## Root cause

The story named the target ("the configured output") but not what a
configured value may look like: absolute, relative, with `..`, with `~`, with
the other platform's separator, or inside a protected folder. The picker could
return values the story never imagined, and no single place compared a write's
path with the place the user chose.

## Prevention

- Every path that comes from the user (setting, prompt, picker) is classified
  before use, and the story has a table of example values with their result:
  empty, relative, trailing separator, absolute inside and outside the root,
  a sibling whose name starts with the root's name, `..`, `~`, both
  separators, a protected folder, the input file itself.
- "Inside a folder" is tested as root + separator, never as a bare prefix.
- All writes go through one writer that checks each path against the allowed
  targets before the call, and a text check over the sources fails when a write
  call appears anywhere else (SCAR-017), with a counted list of the allowed
  exceptions (SCAR-023).
- A refusal happens before anything is read, asked or written (SCAR-014:
  refusals before questions).
- Applies next to: export folders, attachment folders, preset folders, any
  setting that names a file or folder, and paths read from notes.
