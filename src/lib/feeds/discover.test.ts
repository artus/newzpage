import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFeedLinks, normalizeSiteInput } from "./discover";

describe("normalizeSiteInput", () => {
  it("accepts bare domains and full urls, rejects search terms", () => {
    assert.equal(normalizeSiteInput("theguardian.com"), "https://theguardian.com/");
    assert.equal(normalizeSiteInput(" http://example.org/blog "), "http://example.org/blog");
    assert.equal(normalizeSiteInput("dutch news"), undefined);
    assert.equal(normalizeSiteInput("cycling"), undefined);
    assert.equal(normalizeSiteInput("ftp://example.org"), undefined);
    assert.equal(normalizeSiteInput(""), undefined);
  });
});

describe("extractFeedLinks", () => {
  it("reads announced feeds in any attribute order and resolves relative hrefs", () => {
    const html = `<html><head>
      <link href="/feed.xml" rel="alternate" type="application/rss+xml" title="Everything">
      <link rel='alternate' type='application/atom+xml' href='https://example.org/atom' />
      <link rel="stylesheet" href="/style.css">
      <link rel="alternate" type="application/rss+xml" href="/feed.xml">
      <link rel="alternate" type="text/html" hreflang="fr" href="/fr">
      </head><body></body></html>`;
    assert.deepEqual(extractFeedLinks(html, "https://example.org/news/"), [
      { url: "https://example.org/feed.xml", title: "Everything" },
      { url: "https://example.org/atom", title: undefined },
    ]);
  });

  it("returns nothing for pages without feeds", () => {
    assert.deepEqual(extractFeedLinks("<html><head><title>x</title></head></html>", "https://example.org"), []);
  });
});
