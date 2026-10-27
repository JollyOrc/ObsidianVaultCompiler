# ADR-009: TextMapperRenderer injection interface

## Status
Accepted

## Context
TextMapper rendering requires a live DOM and the canvas API, neither of which
is available in the test environment. Without an abstraction boundary the
compiler and the renderer are tightly coupled, making it impossible to write
deterministic integration tests for compilation logic.

## Decision
Introduce a `TextMapperRenderer` interface with two methods:
`isAvailable(): boolean` and `render(code: string, assetPath: string): Promise<void>`.
`InMemoryVaultCompiler` (and the production `VaultCompiler`) accept this
interface via a `renderer` option. Tests supply a `SpyRenderer` that records
calls without touching the DOM.

## Consequences
- All rendering behaviour is fully testable without Obsidian or a browser.
- The live renderer and the bundled-fallback renderer are interchangeable at
  runtime.
- A new `compileAsync()` method becomes the primary entry point because
  rendering is inherently asynchronous.
