import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chooseImage, isUsableImage } from "./images";

describe("chooseImage", () => {
  it("prefers the Open Graph image over inline content images", () => {
    const chosen = chooseImage([
      { url: "https://cdn.example.com/inline.jpg", source: "content", width: 800, height: 600 },
      { url: "https://cdn.example.com/hero.jpg", source: "og", width: 1200, height: 630 },
    ]);
    assert.equal(chosen?.url, "https://cdn.example.com/hero.jpg");
  });

  it("skips tracking pixels, logos, vector graphics and tiny images", () => {
    assert.equal(isUsableImage({ url: "https://example.com/pixel.gif", source: "content" }), false);
    assert.equal(isUsableImage({ url: "https://example.com/assets/logo.png", source: "content" }), false);
    assert.equal(isUsableImage({ url: "https://example.com/img/diagram.svg", source: "og" }), false);
    assert.equal(isUsableImage({ url: "https://example.com/a.jpg", source: "content", width: 100, height: 100 }), false);
    assert.equal(isUsableImage({ url: "https://example.com/close-encounter.jpg", source: "content" }), true);
    assert.equal(isUsableImage({ url: "data:image/png;base64,AAAA", source: "content" }), false);
  });

  it("penalises extreme aspect ratios and rewards width", () => {
    const chosen = chooseImage([
      { url: "https://example.com/banner.jpg", source: "media", width: 2000, height: 200 },
      { url: "https://example.com/photo.jpg", source: "thumbnail", width: 640, height: 480 },
    ]);
    assert.equal(chosen?.url, "https://example.com/photo.jpg");
  });

  it("returns undefined when nothing is usable", () => {
    assert.equal(chooseImage([{ url: "https://example.com/spacer.gif", source: "content" }]), undefined);
    assert.equal(chooseImage([]), undefined);
  });
});
