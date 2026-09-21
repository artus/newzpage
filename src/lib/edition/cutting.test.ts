import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Analysis } from "@/lib/summarize/types";
import { cutStory, cuttingPath, cuttingQuery, cuttingRequest, unreadable } from "./cutting";
import type { ArticleRecord } from "./types";

function analysisOf(sentences: number): Analysis {
  const list = Array.from({ length: sentences }, (_, i) => ({ i, p: Math.floor(i / 2), text: `Sentence ${i} says something about the matter at hand.`, words: 9, score: 1 - i / sentences }));
  return { version: 3, lang: "en", sentences: list, pick: list.map((s) => s.i), totalWords: sentences * 9, totalSentences: sentences };
}

const record = (analysis: Analysis | null): ArticleRecord => ({
  url: "https://example.org/story",
  version: 3,
  fetchedAt: 0,
  source: analysis ? "page" : "none",
  title: "The page's own title",
  byline: "A. Writer",
  lang: "en",
  publishedTime: "2026-09-21T08:00:00Z",
  analysis,
  image: { url: "https://example.org/p.jpg", alt: "A photograph of the matter", width: 800, height: 600, score: 1 } as unknown as ArticleRecord["image"],
  wordCount: 400,
  error: analysis ? undefined : "HTTP 404",
});

describe("cutting addresses", () => {
  it("carry the story, its wire and the headline, and read back", () => {
    const path = cuttingPath({ link: "https://example.org/story?a=1&b=2", title: "Ünïcode & ampersands", feedUrl: "https://example.org/feed" });
    assert.equal(path, "/story?url=https%3A%2F%2Fexample.org%2Fstory%3Fa%3D1%26b%3D2&feed=https%3A%2F%2Fexample.org%2Ffeed&title=%C3%9Cn%C3%AFcode+%26+ampersands");
    const params = Object.fromEntries(new URLSearchParams(path!.slice("/story?".length)));
    assert.deepEqual(cuttingRequest(params), { url: "https://example.org/story?a=1&b=2", feed: "https://example.org/feed", title: "Ünïcode & ampersands" });
    assert.equal(cuttingPath({ title: "No link" }), undefined);
    assert.equal(cuttingQuery({ url: "https://example.org/x" }), "url=https%3A%2F%2Fexample.org%2Fx");
  });

  it("refuse addresses that name no web story and drop what is not usable", () => {
    assert.equal(cuttingRequest({}), undefined);
    assert.equal(cuttingRequest({ url: "file:///etc/passwd" }), undefined);
    assert.equal(cuttingRequest({ url: ["https://a.example", "https://b.example"] }), undefined);
    assert.deepEqual(cuttingRequest({ url: " https://example.org/x ", feed: "not a url", title: "  " }), { url: "https://example.org/x", feed: undefined, title: undefined });
    assert.equal(cuttingRequest({ url: "https://example.org/x", title: "t".repeat(500) })!.title!.length, 160);
  });
});

describe("cutStory", () => {
  it("prefers the headline the reader saw and gives a fuller summary with an excerpt", () => {
    const cutting = cutStory(record(analysisOf(40)), { url: "https://example.org/story", title: "The headline as printed" });
    assert.equal(cutting.title, "The headline as printed");
    assert.equal(cutting.host, "example.org");
    assert.equal(cutting.byline, "A. Writer");
    assert.equal(cutting.missing, false);
    assert.ok(cutting.paragraphs.length >= 2 && cutting.paragraphs.length <= 5);
    assert.ok(cutting.paragraphs.join(" ").split(/\s+/).length <= 320 + 9);
    assert.match(cutting.excerpt, /^Sentence 0 says/);
    assert.ok(cutting.excerpt.endsWith("…") && cutting.excerpt.split(/\s+/).length <= 41);
    assert.equal(cutting.image?.url, "https://example.org/p.jpg");
  });

  it("falls back to the page's title, then the host, and says when there is no copy", () => {
    assert.equal(cutStory(record(analysisOf(4)), { url: "https://example.org/story" }).title, "The page's own title");
    const bare = cutStory({ ...record(null), title: undefined }, { url: "https://example.org/story" });
    assert.equal(bare.title, "example.org");
    assert.equal(bare.missing, true);
    assert.equal(bare.excerpt, "A story from example.org, cut from Newzpage.");
    assert.equal(bare.error, "HTTP 404");
    const gone = cutStory(unreadable({ url: "https://example.org/story", title: "Known headline" }, "fetch failed"), { url: "https://example.org/story", title: "Known headline" });
    assert.equal(gone.title, "Known headline");
    assert.equal(gone.error, "fetch failed");
  });
});
