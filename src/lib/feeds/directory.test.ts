import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { seededRandom } from "../util/hash";
import { CATEGORIES, DIRECTORY, randomEntry, searchDirectory } from "./directory";

describe("searchDirectory", () => {
  it("finds feeds by topic, language and site", () => {
    assert.ok(searchDirectory("dutch news").some((entry) => entry.name === "NOS Nieuws"));
    assert.ok(searchDirectory("python").some((entry) => entry.name === "Python Insider"));
    assert.ok(searchDirectory("prompt engineering").some((entry) => entry.site === "blog.prompty.tools"));
    assert.ok(searchDirectory("bbc").every((entry) => entry.site.includes("bbc")));
    assert.equal(searchDirectory("climate")[0].category, "environment");
  });

  it("requires every term to match and ranks names above descriptions", () => {
    const results = searchDirectory("guardian football");
    assert.equal(results.length, 1);
    assert.equal(results[0].name, "The Guardian Football");
    assert.equal(searchDirectory("science")[0].category, "science");
  });

  it("matches prefixes and ignores punctuation and case", () => {
    assert.ok(searchDirectory("Cycl!").some((entry) => entry.name === "Cyclingnews"));
    assert.deepEqual(searchDirectory(""), []);
    assert.deepEqual(searchDirectory("zzzz-nothing-here"), []);
  });

  it("ships a directory with unique urls and known categories", () => {
    assert.ok(DIRECTORY.length >= 150);
    assert.equal(new Set(DIRECTORY.map((entry) => entry.url)).size, DIRECTORY.length);
    assert.ok(CATEGORIES.includes("news") && CATEGORIES.includes("programming"));
  });
});

describe("randomEntry", () => {
  it("draws from the whole directory and stays within it at the edges", () => {
    assert.equal(randomEntry(() => 0), DIRECTORY[0]);
    assert.equal(randomEntry(() => 0.999999), DIRECTORY[DIRECTORY.length - 1]);
    assert.equal(randomEntry(() => 1), DIRECTORY[DIRECTORY.length - 1]);
    const random = seededRandom(7);
    const drawn = new Set(Array.from({ length: 600 }, () => randomEntry(random).url));
    assert.ok(drawn.size > DIRECTORY.length / 2);
  });
});
