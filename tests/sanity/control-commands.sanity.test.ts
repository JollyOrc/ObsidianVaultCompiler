import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InMemoryVaultCompiler } from "../../plugin/src/compiler.ts";

describe("control command sanity", () => {
  const files = {
    "index2compile.md": "# Index\n<!-- QueryToSerialize: LIST FROM #foo -->\n- ![[A.md]]\n",
    "A.md": "# A\nHello from A.\n",
  };

  it("removes all QueryToSerialize markers", () => {
    const result = new InMemoryVaultCompiler(files).compile("index2compile.md");
    assert.equal(result.content.includes("<!-- QueryToSerialize:"), false);
  });

  it("removes the original ToC list from output", () => {
    const result = new InMemoryVaultCompiler(files).compile("index2compile.md");
    assert.doesNotMatch(result.content, /^- !\[\[/m);
  });
});
