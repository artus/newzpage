import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Story } from "@/lib/edition/types";
import type { Analysis } from "@/lib/summarize/types";
import { CLIPPINGS_KEY, KEPT_SENTENCES, MAX_CLIPPINGS, Scrapbook, trimAnalysis } from "./scrapbook";
import { MemoryStorage } from "./storage";

function analysisOf(sentences: number): Analysis {
  const list = Array.from({ length: sentences }, (_, i) => ({ i, p: Math.floor(i / 3), text: `Sentence number ${i} of the article.`, words: 6, score: 1 - i / sentences }));
  return { version: 3, lang: "en", sentences: list, pick: list.map((s) => s.i).reverse(), totalWords: sentences * 6, totalSentences: sentences };
}

function storyOf(id: string, sentences = 40): Story {
  return { id, title: `Story ${id}`, link: `https://example.org/${id}`, lang: "en", source: "page", analysis: analysisOf(sentences), wordCount: sentences * 6 };
}

const wire = { name: "Example Wire", url: "https://example.org/feed" };

describe("trimAnalysis", () => {
  it("keeps the best sentences in pick order and nothing else", () => {
    const trimmed = trimAnalysis(analysisOf(40))!;
    assert.equal(trimmed.pick.length, KEPT_SENTENCES);
    assert.equal(trimmed.sentences.length, KEPT_SENTENCES);
    assert.ok(trimmed.sentences.every((sentence) => trimmed.pick.includes(sentence.i)));
    assert.equal(trimAnalysis(null), null);
    assert.equal(trimAnalysis(analysisOf(5))!.sentences.length, 5);
  });
});

describe("Scrapbook", () => {
  it("keeps clippings newest first, once each, and survives a reload", () => {
    const storage = new MemoryStorage();
    const book = new Scrapbook(storage);
    assert.deepEqual(book.add(storyOf("a"), wire, new Date("2026-09-20T10:00:00Z")), { ok: true });
    assert.deepEqual(book.add(storyOf("b"), wire, new Date("2026-09-20T11:00:00Z")), { ok: true });
    assert.deepEqual(book.add(storyOf("a"), wire), { ok: true });
    assert.deepEqual(book.list().map((clipping) => clipping.story.id), ["b", "a"]);
    assert.ok(book.has("a") && !book.has("zzz"));
    assert.equal(book.list()[0].story.analysis!.sentences.length, KEPT_SENTENCES);
    assert.deepEqual(new Scrapbook(storage).list().map((clipping) => clipping.story.id), ["b", "a"]);
  });

  it("refuses a story without copy", () => {
    const book = new Scrapbook(new MemoryStorage());
    const result = book.add({ ...storyOf("x"), analysis: null }, wire);
    assert.equal(result.ok, false);
    assert.equal(book.list().length, 0);
  });

  it("lets a clipping go and can put it back", () => {
    const book = new Scrapbook(new MemoryStorage());
    book.add(storyOf("a"), wire, new Date("2026-09-20T10:00:00Z"));
    book.add(storyOf("b"), wire, new Date("2026-09-20T11:00:00Z"));
    book.add(storyOf("c"), wire, new Date("2026-09-20T12:00:00Z"));
    assert.deepEqual(book.remove("b"), { ok: true });
    assert.equal(book.lastRemoved()?.story.id, "b");
    assert.deepEqual(book.list().map((clipping) => clipping.story.id), ["c", "a"]);
    assert.deepEqual(book.undo(), { ok: true });
    assert.equal(book.lastRemoved(), undefined);
    assert.deepEqual(book.list().map((clipping) => clipping.story.id), ["c", "b", "a"]);
    assert.deepEqual(book.remove("nothing"), { ok: true });
  });

  it("is full at the limit and says so", () => {
    const book = new Scrapbook(new MemoryStorage());
    for (let i = 0; i < MAX_CLIPPINGS; i++) assert.equal(book.add(storyOf(`s${i}`, 3), wire).ok, true);
    const result = book.add(storyOf("one-more", 3), wire);
    assert.equal(result.ok, false);
    assert.match(!result.ok ? result.reason : "", /holds 300/);
  });

  it("reports a browser that will not keep it and changes nothing", () => {
    const book = new Scrapbook(new MemoryStorage(200));
    const result = book.add(storyOf("big"), wire);
    assert.equal(result.ok, false);
    assert.equal(book.list().length, 0);
    assert.equal(new Scrapbook(undefined).add(storyOf("a"), wire).ok, false);
  });

  it("exports a file another browser can paste in, keeping what it already has", () => {
    const here = new Scrapbook(new MemoryStorage());
    here.add(storyOf("a"), wire, new Date("2026-09-20T10:00:00Z"));
    here.add(storyOf("b"), wire, new Date("2026-09-20T11:00:00Z"));
    const file = JSON.parse(JSON.stringify(here.export(new Date("2026-09-21T00:00:00Z"))));
    assert.equal(file.newzpage, "clippings");

    const there = new Scrapbook(new MemoryStorage());
    there.add(storyOf("b", 10), wire, new Date("2026-09-19T00:00:00Z"));
    there.add(storyOf("c"), wire, new Date("2026-09-21T09:00:00Z"));
    assert.deepEqual(there.import(file), { added: 1, total: 3 });
    assert.deepEqual(there.list().map((clipping) => clipping.story.id), ["c", "a", "b"]);
    assert.equal(there.list()[2].story.analysis!.sentences.length, 10);
    assert.deepEqual(there.import([]), { added: 0, total: 3 });
    assert.throws(() => there.import({ title: "Newzpage", feeds: [] }), /not a Newzpage clippings file/);
    assert.throws(() => there.import([{ nonsense: true }]), /none of its clippings/);
  });

  it("ignores unreadable entries in storage and forgets on reload", () => {
    const storage = new MemoryStorage();
    storage.setItem(CLIPPINGS_KEY, JSON.stringify([{ broken: true }, { story: { id: "ok", title: "Fine" }, wire, clippedAt: "2026-09-20T10:00:00Z" }]));
    const book = new Scrapbook(storage);
    assert.deepEqual(book.list().map((clipping) => clipping.story.id), ["ok"]);
    let notified = 0;
    book.subscribe(() => notified++);
    storage.setItem(CLIPPINGS_KEY, "[]");
    book.reload();
    assert.equal(notified, 1);
    assert.deepEqual(book.list(), []);
    assert.deepEqual(book.clear(), { ok: true });
  });
});
