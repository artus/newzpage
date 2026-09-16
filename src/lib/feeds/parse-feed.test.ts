import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseFeed } from "./parse-feed";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("parseFeed", () => {
  it("parses a minimal RSS 2.0 feed (Hacker News)", () => {
    const feed = parseFeed(fixture("hackernews-rss2.xml"));
    assert.equal(feed.title, "Hacker News");
    assert.equal(feed.link, "https://news.ycombinator.com/");
    assert.equal(feed.description, "Links for the intellectually curious, ranked by readers.");
    assert.equal(feed.items.length, 30);
    const [first] = feed.items;
    assert.equal(first.title, "Introducing System One Models and Jev");
    assert.equal(first.link, "https://typesafe.ai/blog/introducing-system-one-models-and-jev");
    assert.match(first.commentsLink ?? "", /news\.ycombinator\.com\/item\?id=/);
    assert.equal(first.published, "2026-09-15T19:25:03.000Z");
    assert.equal(first.content, undefined);
    assert.deepEqual(first.images, []);
  });

  it("parses RSS 2.0 with media thumbnails and CDATA (BBC)", () => {
    const feed = parseFeed(fixture("bbc-rss2-media.xml"));
    assert.equal(feed.title, "BBC News");
    assert.equal(feed.description, "BBC News - News Front Page");
    assert.equal(feed.language, "en-gb");
    assert.equal(feed.ttlMinutes, 15);
    assert.equal(feed.items.length, 37);
    const [first] = feed.items;
    assert.equal(first.title, "OpenAI boss says world 'right to be afraid' but should trust AI firms");
    assert.match(first.summary ?? "", /^Sam Altman/);
    assert.ok(first.images.some((image) => image.source === "thumbnail" && image.width === 240));
    assert.ok(first.link?.startsWith("https://www.bbc.co.uk/news/articles/"));
  });

  it("parses RSS 2.0 with content:encoded and media:content (Ars Technica)", () => {
    const feed = parseFeed(fixture("ars-rss2-content.xml"));
    assert.equal(feed.items.length, 20);
    const [first] = feed.items;
    assert.equal(first.title, "How chimps teach their kids tool tricks");
    assert.equal(first.author, "Jennifer Ouellette");
    assert.ok(first.content && first.content.includes("<p>"));
    assert.ok(first.categories.includes("Science"));
    const media = first.images.find((image) => image.source === "media");
    assert.ok(media && media.width === 1152 && media.height === 648);
  });

  it("parses Atom with HTML content and inline images (The Verge)", () => {
    const feed = parseFeed(fixture("verge-atom.xml"));
    assert.match(feed.description ?? "", /^The Verge is about technology/);
    assert.equal(feed.title, "The Verge");
    assert.equal(feed.link, "https://www.theverge.com");
    assert.equal(feed.language, "en-US");
    assert.equal(feed.items.length, 10);
    const [first] = feed.items;
    assert.equal(first.title, "The Boox Palma 3 gets stylus support and a sleek redesign");
    assert.equal(first.link, "https://www.theverge.com/tech/995826/boox-palma-3-e-ink-reader-pocket-smartphone-android-16");
    assert.equal(first.author, "Andrew Liszewski");
    assert.equal(first.published, "2026-09-16T02:00:00.000Z");
    assert.ok(first.content && first.content.length > 500);
    const content = first.images.find((image) => image.source === "content");
    assert.ok(content?.url.startsWith("https://platform.theverge.com/"));
    assert.match(content?.alt ?? "", /Boox Palma 3/);
    assert.ok(first.categories.includes("Gadgets"));
  });

  it("parses RSS 1.0 (RDF)", () => {
    const feed = parseFeed(`<?xml version="1.0"?>
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
        <channel rdf:about="https://example.org/"><title>Example</title><link>https://example.org/</link><dc:language>nl</dc:language></channel>
        <item rdf:about="https://example.org/a"><title>Eerste &amp; beste</title><link>https://example.org/a</link><dc:date>2026-01-02T03:04:05Z</dc:date><description>Tekst</description></item>
      </rdf:RDF>`);
    assert.equal(feed.title, "Example");
    assert.equal(feed.language, "nl");
    assert.equal(feed.items[0].title, "Eerste & beste");
    assert.equal(feed.items[0].published, "2026-01-02T03:04:05.000Z");
  });

  it("uses a permalink guid when there is no link and rejects unknown formats", () => {
    const feed = parseFeed(`<rss version="2.0"><channel><title>T</title><item><title>A</title><guid>https://example.org/x</guid></item></channel></rss>`);
    assert.equal(feed.items[0].link, "https://example.org/x");
    assert.throws(() => parseFeed("<html><body>nope</body></html>"), /Unrecognised feed format/);
  });
});
