import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { loadConfig } from "./config";
import { moveFeed, normalizeConfig, removeFeed, reorderFeeds, upsertFeed, type FeedConfig } from "./config-schema";

const feeds: FeedConfig[] = [
  { name: "A", url: "https://a.example/rss" },
  { name: "B", url: "https://b.example/rss", limit: 5 },
  { name: "C", url: "https://c.example/rss" },
];

describe("feed list operations", () => {
  it("moves feeds up and down without leaving the list", () => {
    assert.deepEqual(moveFeed(feeds, "https://b.example/rss", "up").map((f) => f.name), ["B", "A", "C"]);
    assert.deepEqual(moveFeed(feeds, "https://b.example/rss", "down").map((f) => f.name), ["A", "C", "B"]);
    assert.equal(moveFeed(feeds, "https://a.example/rss", "up"), feeds);
    assert.equal(moveFeed(feeds, "https://c.example/rss", "down"), feeds);
    assert.equal(moveFeed(feeds, "https://nope.example/rss", "down"), feeds);
  });

  it("removes, upserts and reorders by url", () => {
    assert.deepEqual(removeFeed(feeds, "https://b.example/rss").map((f) => f.name), ["A", "C"]);
    assert.deepEqual(upsertFeed(feeds, { url: "https://d.example/rss" }).map((f) => f.name), ["A", "B", "C", undefined]);
    assert.deepEqual(upsertFeed(feeds, { url: "https://d.example/rss", name: "D" }, 1).map((f) => f.name), ["A", "D", "B", "C"]);
    assert.deepEqual(upsertFeed(feeds, { url: "https://b.example/rss", name: "B2", limit: 9 })[1], { url: "https://b.example/rss", name: "B2", limit: 9 });
    assert.deepEqual(reorderFeeds(feeds, ["https://c.example/rss", "https://a.example/rss", "https://b.example/rss"])?.map((f) => f.name), ["C", "A", "B"]);
    assert.equal(reorderFeeds(feeds, ["https://c.example/rss", "https://a.example/rss"]), undefined);
    assert.equal(reorderFeeds(feeds, ["https://c.example/rss", "https://a.example/rss", "https://x.example/rss"]), undefined);
  });
});

describe("normalizeConfig", () => {
  it("fills defaults and validates feeds", () => {
    const config = normalizeConfig({ title: " The Daily ", feeds: ["https://x.example/rss", { url: "https://y.example/rss", name: "Y", limit: 99 }] });
    assert.equal(config.title, "The Daily");
    assert.equal(config.itemsPerFeed, 10);
    assert.deepEqual(config.feeds, [{ url: "https://x.example/rss" }, { url: "https://y.example/rss", name: "Y", limit: 50 }]);
    assert.deepEqual(normalizeConfig(null).feeds, []);
    assert.throws(() => normalizeConfig({ feeds: ["ftp://nope"] }), /feeds\[0\] needs an http\(s\) "url"/);
  });
});

describe("loadConfig", () => {
  let dir: string;
  before(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), "newzpage-config-"));
    process.env.NEWZPAGE_FEEDS_FILE = path.join(dir, "feeds.json");
    delete process.env.NEWZPAGE_FEEDS;
  });
  after(() => rmSync(dir, { recursive: true, force: true }));

  it("treats a missing file as an empty page with defaults", () => {
    const config = loadConfig();
    assert.equal(config.title, "Newzpage");
    assert.deepEqual(config.feeds, []);
  });

  it("reads the file and lets NEWZPAGE_FEEDS replace the list", () => {
    writeFileSync(process.env.NEWZPAGE_FEEDS_FILE!, JSON.stringify({ title: "The Daily", itemsPerFeed: 7, feeds }));
    assert.deepEqual(loadConfig(), { title: "The Daily", tagline: "All the feeds that are fit to print", itemsPerFeed: 7, feeds });
    process.env.NEWZPAGE_FEEDS = "https://x.example/rss, https://y.example/atom";
    assert.deepEqual(
      loadConfig().feeds.map((f) => f.url),
      ["https://x.example/rss", "https://y.example/atom"],
    );
    delete process.env.NEWZPAGE_FEEDS;
  });
});
