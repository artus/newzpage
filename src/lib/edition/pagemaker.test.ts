import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { columnsFor, fitBudgets, planPage } from "./pagemaker";
import type { Story } from "./types";

const story = (n: number, options: { image?: boolean; sentences?: number } = {}): Story => {
  const count = options.sentences ?? 8;
  return {
    id: `story-${n}`,
    title: `Story ${n}: a headline of ordinary length for the page`,
    link: `https://example.com/${n}`,
    lang: "en",
    source: "page",
    wordCount: 400,
    image: options.image ? { url: `https://example.com/${n}.jpg`, source: "og" } : undefined,
    analysis:
      count === 0
        ? null
        : {
            version: 3,
            lang: "en",
            sentences: Array.from({ length: count }, (_, i) => ({ i, p: i, text: `Sentence ${i} of story ${n}.`, words: 18, score: 1 - i / 20 })),
            pick: Array.from({ length: count }, (_, i) => i),
            totalWords: count * 18,
            totalSentences: count,
          },
  };
};

const stories = Array.from({ length: 12 }, (_, i) => story(i + 1, { image: i % 2 === 0, sentences: i === 5 ? 1 : 8 }));

describe("planPage", () => {
  it("places every story once, fills each band to the full width, and leads with a photo story", () => {
    const plan = planPage(stories, { width: 1360, columns: 6 });
    const placed = plan.bands.flatMap((band) => band.slots.flatMap((slot) => slot.stories.map((p) => p.story.id)));
    assert.deepEqual([...placed].sort(), stories.map((s) => s.id).sort());
    assert.equal(new Set(placed).size, placed.length);
    for (const band of plan.bands) assert.equal(band.slots.reduce((sum, slot) => sum + slot.span, 0), 6, JSON.stringify(band.slots.map((s) => s.span)));
    const lead = plan.bands[0].slots[0].stories[0];
    assert.equal(lead.kind, "lead");
    assert.equal(lead.photo, true);
    assert.equal(lead.textColumns, 2);
  });

  it("is deterministic and varies the patterns between bands", () => {
    const a = planPage(stories, { width: 1360, columns: 6 });
    const b = planPage(stories, { width: 1360, columns: 6 });
    assert.deepEqual(a, b);
    const patterns = a.bands.map((band) => band.slots.map((slot) => slot.span).join(","));
    assert.ok(patterns.length >= 2, `bands: ${patterns.join(" | ")}`);
    assert.ok(new Set(patterns).size > 1 || patterns.length < 3, `patterns should vary: ${patterns.join(" | ")}`);
  });

  it("rations photographs and gives every story a budget it can fill", () => {
    const plan = planPage(stories, { width: 1360, columns: 6 });
    const placed = plan.bands.flatMap((band) => band.slots.flatMap((slot) => slot.stories));
    assert.ok(placed.filter((p) => p.photo).length <= Math.ceil(stories.length / 3));
    for (const p of placed) {
      const available = p.story.analysis ? p.story.analysis.sentences.reduce((s, x) => s + x.words, 0) : 0;
      assert.ok(p.budget >= Math.min(20, Math.max(available, 20)) || p.budget === available, `${p.story.id} budget ${p.budget} of ${available}`);
      assert.ok(p.budget <= Math.max(available, 20), `${p.story.id} budget ${p.budget} exceeds ${available}`);
    }
  });

  it("stacks thin stories and demotes stack followers to briefs", () => {
    const thin = Array.from({ length: 9 }, (_, i) => story(i + 1, { image: i === 0, sentences: 2 }));
    const plan = planPage(thin, { width: 1360, columns: 6 });
    const stacks = plan.bands.flatMap((band) => band.slots).filter((slot) => slot.stories.length > 1);
    assert.ok(stacks.length > 0, "thin stories should be stacked");
    assert.ok(stacks.some((slot) => slot.stories.slice(1).some((p) => p.kind === "brief")));
  });

  it("adapts to narrow pages", () => {
    const four = planPage(stories, { width: 900, columns: 4 });
    for (const band of four.bands) assert.equal(band.slots.reduce((sum, slot) => sum + slot.span, 0), 4);
    const single = planPage(stories, { width: 380, columns: 1 });
    assert.equal(single.bands.length, stories.length);
    assert.ok(single.bands.every((band) => band.slots.length === 1 && band.slots[0].span === 1));
    assert.deepEqual(planPage([], { width: 1360, columns: 6 }).bands, []);
  });
});

describe("fitBudgets", () => {
  it("lowers the band to the shortest slot that cannot grow, cutting the others", () => {
    const result = fitBudgets([
      { height: 500, stories: [{ id: "a", budget: 120, words: 118, bodyHeight: 300, exhausted: false, nextWords: 140 }] },
      { height: 380, stories: [{ id: "b", budget: 60, words: 58, bodyHeight: 150, exhausted: false, nextWords: 80 }] },
      { height: 300, stories: [{ id: "c", budget: 60, words: 40, bodyHeight: 100, exhausted: true }] },
    ]);
    assert.equal(result.target, 300, "c has run out of copy, so the band comes down to it");
    assert.equal(result.changed, true);
    assert.ok(result.budgets.a < 118 && result.budgets.a >= 20, `a cut to ${result.budgets.a}`);
    assert.ok(result.budgets.b < 58, `b cut to ${result.budgets.b}`);
    assert.equal(result.budgets.c, undefined, "no more text to add");
  });

  it("never cuts an anchor; the others grow toward it", () => {
    const result = fitBudgets([
      { height: 520, stories: [{ id: "lead", budget: 170, words: 168, bodyHeight: 250, exhausted: false, nextWords: 190, anchor: true }] },
      { height: 300, stories: [{ id: "b", budget: 60, words: 58, bodyHeight: 150, exhausted: false, nextWords: 80 }] },
      { height: 250, stories: [{ id: "c", budget: 40, words: 40, bodyHeight: 100, exhausted: true }] },
    ]);
    assert.equal(result.target, 520);
    assert.equal(result.budgets.lead, undefined);
    assert.equal(result.budgets.b, 80);
  });

  it("asks exactly for the next sentence when it fits the slack, and skips sentences that would overshoot", () => {
    const result = fitBudgets([
      { height: 400, stories: [{ id: "a", budget: 80, words: 80, bodyHeight: 200, exhausted: false, nextWords: 100 }] },
      { height: 400, stories: [{ id: "b", budget: 80, words: 80, bodyHeight: 200, exhausted: false, nextWords: 100 }] },
      { height: 300, stories: [{ id: "c", budget: 30, words: 9, bodyHeight: 25, exhausted: false, nextWords: 45 }] },
      { height: 300, stories: [{ id: "d", budget: 30, words: 30, bodyHeight: 80, exhausted: false, nextWords: 120 }] },
    ]);
    assert.equal(result.target, 400);
    assert.equal(result.budgets.c, 45, "the budget jumps to what the next sentence needs");
    assert.equal(result.budgets.d, undefined, "a ninety-word sentence would overshoot a 100px hole");
  });

  it("never cuts below the fixed parts plus a minimum of copy, and respects the ceiling", () => {
    const cut = fitBudgets([{ height: 800, stories: [{ id: "a", budget: 200, words: 200, bodyHeight: 600, exhausted: false, anchor: true }] }, { height: 600, stories: [{ id: "b", budget: 100, words: 100, bodyHeight: 300, exhausted: false, nextWords: 120 }] }], { maxHeight: 640 });
    assert.equal(cut.target, 800, "an anchor is never cut, even above the ceiling; the band takes its height");
    assert.equal(cut.budgets.a, undefined);
    assert.equal(cut.budgets.b, 120, "the neighbour grows toward the anchor");
    const tall = fitBudgets([{ height: 800, stories: [{ id: "a", budget: 200, words: 200, bodyHeight: 600, exhausted: false }] }, { height: 600, stories: [{ id: "b", budget: 100, words: 100, bodyHeight: 300, exhausted: false, nextWords: 120 }] }], { maxHeight: 640 });
    assert.equal(tall.target, 600, "without an anchor the tallest slot comes down to the second");
    assert.ok(tall.budgets.a < 200 && tall.budgets.a >= 20, `a cut to ${tall.budgets.a}`);
    const floors = fitBudgets([{ height: 300, stories: [{ id: "a", budget: 20, words: 20, bodyHeight: 100, exhausted: true }] }, { height: 120, stories: [{ id: "b", budget: 20, words: 20, bodyHeight: 60, exhausted: true }] }]);
    assert.equal(floors.target, 300, "the tall slot has only its minimum copy, so it stays");
    assert.equal(floors.changed, false);
    const even = fitBudgets([{ height: 400, stories: [{ id: "a", budget: 80, words: 80, bodyHeight: 200, exhausted: false }] }, { height: 392, stories: [{ id: "b", budget: 80, words: 80, bodyHeight: 200, exhausted: false }] }]);
    assert.equal(even.changed, false);
    assert.deepEqual(fitBudgets([]), { budgets: {}, changed: false, target: 0 });
  });
});

describe("columnsFor", () => {
  it("maps widths to column counts", () => {
    assert.equal(columnsFor(1400), 6);
    assert.equal(columnsFor(1000), 4);
    assert.equal(columnsFor(700), 3);
    assert.equal(columnsFor(500), 2);
    assert.equal(columnsFor(380), 1);
  });
});
