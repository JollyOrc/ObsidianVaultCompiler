import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encodeAssetPath, normalizeAssetFilename } from "../../plugin/src/utils.ts";

describe("asset path encoding", () => {
  it("encodes spaces as %20", () => {
    assert.equal(encodeAssetPath("assets/file name.png"), "assets/file%20name.png");
  });

  it("preserves path separators", () => {
    assert.equal(encodeAssetPath("assets/sub/file name.png"), "assets/sub/file%20name.png");
  });
});


describe("asset filename normalization", () => {
  it("normalizes case, spaces and special characters", () => {
    assert.equal(normalizeAssetFilename("Cover Draft 1000.PNG"), "cover_draft_1000.png");
  });

  it("handles dots and multiple separators", () => {
    assert.equal(normalizeAssetFilename("Simple   Head Runner 01.png"), "simple_head_runner_01.png");
  });
});
