import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { looksLikeOpml, parseOpml, toOpml } from "./opml";

const FEEDLY = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head><title>Artus subscriptions in feedly Cloud</title></head>
  <body>
    <outline text="Tech" title="Tech">
      <outline type="rss" text="Ars Technica" title="Ars Technica" xmlUrl="https://feeds.arstechnica.com/arstechnica/index" htmlUrl="https://arstechnica.com"/>
      <outline type="rss" text="Reuters via Google" xmlUrl="https://news.google.com/rss/search?q=site:reuters.com&amp;hl=en-US" htmlUrl="https://news.google.com"/>
    </outline>
    <outline text="Science">
      <outline type='rss' TEXT='Nature &amp; Co' XMLURL='https://www.nature.com/nature.rss' />
      <outline type="rss" text="Ars Technica again" xmlUrl="https://feeds.arstechnica.com/arstechnica/index"/>
      <outline type="rss" text="Local file" xmlUrl="file:///etc/passwd"/>
      <outline type="rss" title="Only a title" xmlUrl="https://example.org/feed"/>
    </outline>
  </body>
</opml>`;

describe("parseOpml", () => {
  it("flattens folders, decodes entities, ignores duplicates and non-http addresses", () => {
    const { title, feeds } = parseOpml(FEEDLY);
    assert.equal(title, "Artus subscriptions in feedly Cloud");
    assert.deepEqual(feeds, [
      { url: "https://feeds.arstechnica.com/arstechnica/index", name: "Ars Technica" },
      { url: "https://news.google.com/rss/search?q=site:reuters.com&hl=en-US", name: "Reuters via Google" },
      { url: "https://www.nature.com/nature.rss", name: "Nature & Co" },
      { url: "https://example.org/feed", name: "Only a title" },
    ]);
  });

  it("refuses what is not OPML and tolerates an empty body", () => {
    assert.throws(() => parseOpml('{"title":"Newzpage","feeds":[]}'), /not an OPML file/);
    assert.throws(() => parseOpml("<rss><channel/></rss>"), /not an OPML file/);
    assert.deepEqual(parseOpml("<opml version=\"2.0\"><body></body></opml>"), { title: undefined, feeds: [] });
    assert.ok(looksLikeOpml("\n<opml>") && !looksLikeOpml("<html>"));
  });
});

describe("toOpml", () => {
  it("writes OPML 2.0 that reads back the same, with names escaped and hosts standing in for missing names", () => {
    const config = {
      title: "Artus & the <Daily>",
      feeds: [
        { url: "https://example.org/a.xml", name: "A \"quoted\" wire" },
        { url: "https://news.google.com/rss/search?q=site:reuters.com&hl=en-US" },
      ],
    };
    const xml = toOpml(config, new Date("2026-09-21T08:00:00Z"));
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<opml version="2\.0">/);
    assert.match(xml, /<title>Artus &amp; the &lt;Daily&gt;<\/title>/);
    assert.match(xml, /<dateCreated>Mon, 21 Sep 2026 08:00:00 GMT<\/dateCreated>/);
    assert.match(xml, /text="A &quot;quoted&quot; wire"/);
    assert.match(xml, /text="news\.google\.com" title="news\.google\.com" type="rss" xmlUrl="https:\/\/news\.google\.com\/rss\/search\?q=site:reuters\.com&amp;hl=en-US"/);
    const back = parseOpml(xml);
    assert.equal(back.title, config.title);
    assert.deepEqual(back.feeds, [
      { url: "https://example.org/a.xml", name: 'A "quoted" wire' },
      { url: "https://news.google.com/rss/search?q=site:reuters.com&hl=en-US", name: "news.google.com" },
    ]);
  });
});
