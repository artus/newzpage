import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contentTokens, splitSentences, stem, tokenize } from "./segment";
import { detectLanguage } from "./stopwords";

describe("splitSentences", () => {
  it("keeps abbreviations, initials and numbered months together", () => {
    const sentences = splitSentences(
      "Dr. Smith went to Washington D.C. on Jan. 5 with J. K. Rowling. He met the U.S. president. It cost $3.5 million!",
    );
    assert.deepEqual(sentences, [
      "Dr. Smith went to Washington D.C. on Jan. 5 with J. K. Rowling.",
      "He met the U.S. president.",
      "It cost $3.5 million!",
    ]);
  });

  it("repairs sentences that were glued together while scraping", () => {
    assert.deepEqual(splitSentences("The vote passed.Opponents were furious."), ["The vote passed.", "Opponents were furious."]);
  });

  it("handles quotes and question marks", () => {
    assert.deepEqual(splitSentences('"Is it over?" she asked. Nobody answered.'), ['"Is it over?" she asked.', "Nobody answered."]);
  });

  it("returns nothing for blank input", () => {
    assert.deepEqual(splitSentences("   \n "), []);
  });
});

describe("tokenize and stem", () => {
  it("lower-cases, drops punctuation and possessives, keeps numbers", () => {
    assert.deepEqual(tokenize("The company's 3 new e-readers arrived, finally!"), ["the", "company", "3", "new", "e", "readers", "arrived", "finally"].filter((t) => t !== "e"));
  });

  it("stems consistently", () => {
    assert.equal(stem("companies", "en"), "company");
    assert.equal(stem("running", "en"), "run");
    assert.equal(stem("stopped", "en"), "stop");
    assert.equal(stem("watches", "en"), "watch");
    assert.equal(stem("readers", "en"), "reader");
    assert.equal(stem("bus", "en"), "bus");
    assert.equal(stem("2026", "en"), "2026");
    assert.equal(stem("huizen", "nl"), "huizen");
  });

  it("removes stopwords and stems content tokens", () => {
    assert.deepEqual(contentTokens("The companies were running quickly", "en"), ["company", "run", "quick"]);
  });
});

describe("detectLanguage", () => {
  const english =
    "The government said on Tuesday that it would not raise taxes this year, but the opposition argued that the plan was not credible and that the numbers did not add up at all.";
  const dutch =
    "De regering zei dinsdag dat ze de belastingen dit jaar niet zou verhogen, maar de oppositie stelde dat het plan niet geloofwaardig was en dat de cijfers niet klopten.";
  const german =
    "Die Regierung sagte am Dienstag, dass sie die Steuern in diesem Jahr nicht erhöhen werde, aber die Opposition meinte, dass der Plan nicht glaubwürdig sei und die Zahlen nicht stimmen.";
  const french =
    "Le gouvernement a déclaré mardi qu'il n'augmenterait pas les impôts cette année, mais l'opposition a soutenu que le plan n'était pas crédible et que les chiffres ne tenaient pas.";

  it("recognises the supported languages", () => {
    assert.equal(detectLanguage(tokenize(english)), "en");
    assert.equal(detectLanguage(tokenize(dutch)), "nl");
    assert.equal(detectLanguage(tokenize(german)), "de");
    assert.equal(detectLanguage(tokenize(french)), "fr");
  });

  it("falls back to the declared language for short or unknown text", () => {
    assert.equal(detectLanguage(tokenize("Kort bericht."), "nl-BE"), "nl");
    assert.equal(detectLanguage(tokenize("Kort bericht.")), "en");
    assert.equal(detectLanguage(tokenize("Ceci n'est pas un texte"), "ja"), "en");
  });
});
