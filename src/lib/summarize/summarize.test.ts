import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyze, compose } from "./index";

const article = [
  "The city council approved a new bicycle bridge across the harbour on Monday, ending a decade of debate about the crossing.",
  "The bridge will connect the old docks with the university district and is expected to carry ten thousand cyclists a day. Construction of the bicycle bridge starts next spring and should take two years.",
  "Council members voted 31 to 14 in favour of the bridge after a heated four-hour session. Opponents argued that the harbour crossing would spoil the view from the historic quay.",
  "Supporters said the bicycle bridge would cut commuting times for students by twenty minutes. The university has campaigned for the crossing since 2016.",
  "The mayor called the vote a milestone for the city. She said the harbour had divided the city for too long.",
  "We use cookies to improve your experience. Read more at https://example.com/cookies.",
  "SUBSCRIBE TO OUR NEWSLETTER",
  "The bridge budget is 48 million euros, of which the region pays a third. Critics doubt the budget will hold.",
];

describe("analyze", () => {
  const analysis = analyze(article, { title: "Council approves bicycle bridge across the harbour" });

  it("detects the language and drops boilerplate", () => {
    assert.equal(analysis.lang, "en");
    const texts = analysis.sentences.map((sentence) => sentence.text);
    assert.ok(texts.every((text) => !/cookies|newsletter|https?:/i.test(text)));
    assert.ok(analysis.totalSentences >= 10);
  });

  it("ranks the topical lead sentence first", () => {
    const first = analysis.sentences.find((sentence) => sentence.i === analysis.pick[0]);
    assert.ok(first);
    assert.match(first.text, /bicycle bridge/);
    assert.equal(first.score, 1);
  });

  it("is deterministic", () => {
    assert.deepEqual(analyze(article, { title: "Council approves bicycle bridge across the harbour" }), analysis);
  });

  it("drops the dangling half of a split quotation", () => {
    const result = analyze(["“Tool transfers thus appear to be a form of teaching, together with observation and practice. The findings were clear,” the authors wrote in the journal."]);
    const texts = result.sentences.map((sentence) => sentence.text);
    assert.ok(texts.includes("Tool transfers thus appear to be a form of teaching, together with observation and practice."), texts.join(" | "));
    assert.ok(texts.includes("The findings were clear, the authors wrote in the journal."), texts.join(" | "));
  });

  it("drops fragments and whole author-bio paragraphs", () => {
    const result = analyze([
      "The council approved the bridge on Monday after a long debate about the cost of the crossing.",
      "is a senior editor following news across tech, culture, policy, and entertainment. He joined the paper in 2021 after several years covering news elsewhere.",
      "Richard Lawler is a senior editor following news across tech, culture, policy, and entertainment. He joined the paper in 2021 after several years covering news elsewhere.",
      "Opponents of the bridge said the harbour view from the historic quay would be spoiled forever.",
    ]);
    const texts = result.sentences.map((sentence) => sentence.text);
    assert.equal(texts.length, 2, texts.join(" | "));
    assert.ok(texts.every((text) => !/senior editor|joined the paper/.test(text)));
  });

  it("respects the language hint for short texts", () => {
    assert.equal(analyze(["Kort bericht over de brug."], { langHint: "nl" }).lang, "nl");
  });
});

describe("compose", () => {
  const analysis = analyze(article, { title: "Council approves bicycle bridge across the harbour" });

  it("stays within the word budget and keeps reading order", () => {
    const composed = compose(analysis, { maxWords: 60 });
    assert.ok(composed.words <= 60, `used ${composed.words} words`);
    assert.ok(composed.sentences >= 2);
    const order = composed.paragraphs.join(" ");
    const positions = analysis.sentences
      .filter((sentence) => order.includes(sentence.text))
      .map((sentence) => order.indexOf(sentence.text));
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  });

  it("limits the number of paragraphs", () => {
    const composed = compose(analysis, { maxWords: 200, maxSentences: 10, maxParagraphs: 2 });
    assert.ok(composed.paragraphs.length <= 2);
    assert.ok(composed.sentences >= 6);
  });

  it("returns a single sentence when the budget is tiny", () => {
    const composed = compose(analysis, { maxWords: 12 });
    assert.equal(composed.sentences, 1);
  });

  it("handles missing analyses", () => {
    assert.deepEqual(compose(null, { maxWords: 100 }), { paragraphs: [], words: 0, sentences: 0, exhausted: true });
  });
});
