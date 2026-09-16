import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanByline } from "./build";

describe("cleanByline", () => {
  it("strips labels, links and reading-time noise", () => {
    assert.equal(cleanByline("By Jennifer Ouellette"), "Jennifer Ouellette");
    assert.equal(cleanByline("Written by Apple Security Engineering and Architecture (SEAR)"), "Apple Security Engineering and Architecture (SEAR)");
    assert.equal(cleanByline("View all posts by Mark Graham →"), "Mark Graham");
    assert.equal(cleanByline("Kate Whannel · 5 min read"), "Kate Whannel");
    assert.equal(cleanByline("  Harry Farley, Kate Whannel "), "Harry Farley, Kate Whannel");
  });

  it("rejects things that are not names", () => {
    assert.equal(cleanByline(undefined), undefined);
    assert.equal(cleanByline("Published 16 September 2026"), undefined);
    assert.equal(cleanByline("news@example.com"), undefined);
    assert.equal(cleanByline("a".repeat(90)), undefined);
  });
});
