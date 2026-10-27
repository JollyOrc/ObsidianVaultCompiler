import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InMemoryVaultCompiler } from "../../plugin/src/compiler.ts";

describe("first-line cover asset", () => {
  const files = {
    "index2compile.md": "![](Rulebook/Rulebook images/Artist/Cover Draft 1000.png)\n\n# The Rulebook\n- ![[A.md]]\n",
    "Rulebook/Rulebook images/Artist/Cover Draft 1000.png": "",
    "A.md": "# A\nHello from A.\n",
  };

  it("embeds the cover image as the first reference", () => {
    const result = new InMemoryVaultCompiler(files).compile("index2compile.md");
    assert.match(result.content, /^!\[\]\(assets\/cover_draft_1000.png\)/);
  });

  it("records the asset as copied", () => {
    const compiler = new InMemoryVaultCompiler(files);
    const result = compiler.compile("index2compile.md");
    assert.ok(result.stats.assetsCopied >= 1);
    assert.ok([...compiler.sourceToAssetMap.values()].includes("assets/cover_draft_1000.png"));
  });
});
