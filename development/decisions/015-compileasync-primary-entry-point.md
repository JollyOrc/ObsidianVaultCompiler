# ADR-015: compileAsync() as the primary compile entry point

## Status
Accepted

## Context
The original `compile()` method on `InMemoryVaultCompiler` is synchronous.
TextMapper rendering requires async I/O (writing PNG assets via the Vault
adapter) and at minimum one browser paint tick (canvas draw). Adding async work
inside a synchronous method is not possible without blocking APIs that are
unavailable in the browser runtime.

## Decision
A new `compileAsync()` method is added to `InMemoryVaultCompiler` and to the
production `VaultCompiler`. It performs all the same steps as `compile()` and
additionally awaits any renderer calls. The synchronous `compile()` is kept for
callers that do not use TextMapper, but new code and all tests that cover
rendering must use `compileAsync()`.

## Consequences
- Rendering integrates cleanly without hacks.
- Existing tests that call `compile()` continue to pass unmodified.
- The command palette action and any UI trigger in `main.ts` must be updated to
  `await compileAsync()`.
