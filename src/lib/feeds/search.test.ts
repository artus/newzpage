import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapFeedlyResults } from "./search";

describe("mapFeedlyResults", () => {
  const now = Date.UTC(2026, 8, 16);
  const payload = {
    results: [
      { feedId: "feed/https://www.cyclingnews.com/rss/", title: "Cyclingnews  Latest", website: "https://www.cyclingnews.com", subscribers: 9247, language: "en", description: " All the   latest news ", lastUpdated: now - 1000 },
      { feedId: "feed/http://old.example.com/rss", title: "Old", website: "http://old.example.com", lastUpdated: now - 400 * 24 * 3600 * 1000 },
      { feedId: "feed/ftp://nope", title: "Nope" },
      { title: "No id" },
    ],
  };

  it("maps live feeds and drops stale or unusable ones", () => {
    const proposals = mapFeedlyResults(payload, now);
    assert.equal(proposals.length, 1);
    assert.deepEqual(proposals[0], {
      url: "https://www.cyclingnews.com/rss/",
      name: "Cyclingnews Latest",
      site: "cyclingnews.com",
      description: "All the latest news",
      language: "en",
      source: "feedly",
      subscribers: 9247,
    });
  });

  it("tolerates unexpected payloads", () => {
    assert.deepEqual(mapFeedlyResults(null), []);
    assert.deepEqual(mapFeedlyResults({ results: "nope" }), []);
  });
});
