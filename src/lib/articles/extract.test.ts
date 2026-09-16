import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractArticleLite } from "./extract";

const page = `<!doctype html><html lang="en-GB"><head><title>Council approves bridge &amp; more</title>
<meta property="og:image" content="/img/bridge.jpg"><meta content="Example Times" property="og:site_name">
<style>p { color: red }</style><script>var p = "<p>not a paragraph</p>";</script></head>
<body><nav><p>Home News Sport Weather and a lot of navigation words here.</p></nav>
<article><h1>Council approves bridge</h1>
<p>The city council approved a new bicycle bridge across the harbour on Monday, ending a decade of debate.</p>
<p>Short.</p>
<p>Council members voted 31 to 14 in favour after a heated four-hour session about the crossing.</p></article>
<footer><p>Copyright notice with enough words to look like a paragraph of text here.</p></footer></body></html>`;

describe("extractArticleLite", () => {
  it("takes the article's paragraphs and the page's metadata without a DOM", () => {
    const result = extractArticleLite(page, "https://example.org/news/bridge");
    assert.equal(result.title, "Council approves bridge & more");
    assert.equal(result.siteName, "Example Times");
    assert.equal(result.lang, "en-GB");
    assert.deepEqual(result.paragraphs, [
      "The city council approved a new bicycle bridge across the harbour on Monday, ending a decade of debate.",
      "Council members voted 31 to 14 in favour after a heated four-hour session about the crossing.",
    ]);
    assert.equal(result.images[0]?.url, "https://example.org/img/bridge.jpg");
    assert.equal(result.wordCount, 34);
  });

  it("falls back to the whole body when there is no article element", () => {
    const result = extractArticleLite("<html><body><p>One paragraph with a reasonable number of words inside it.</p></body></html>", "https://example.org/");
    assert.equal(result.paragraphs.length, 1);
    assert.equal(result.title, undefined);
  });
});
