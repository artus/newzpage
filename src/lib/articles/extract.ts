import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";
import { collapseWhitespace, countWords } from "@/lib/util/text";
import type { ImageCandidate } from "./images";

export interface ExtractedArticle {
  title?: string;
  byline?: string;
  siteName?: string;
  lang?: string;
  publishedTime?: string;
  excerpt?: string;
  paragraphs: string[];
  images: ImageCandidate[];
  wordCount: number;
}

const HIDDEN_LABELS = ['[class*="visually-hidden"]', '[class*="visuallyhidden"]', '[class*="VisuallyHidden"]', '[class*="sr-only"]', '[class*="screen-reader"]'].join(", ");

const toNumber = (value: string | null | undefined) => {
  const parsed = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

function absolute(candidate: string | null | undefined, base: string): string | undefined {
  if (!candidate) return undefined;
  try {
    return new URL(candidate.trim(), base).toString();
  } catch {
    return undefined;
  }
}

function metaImages(document: Document, base: string): ImageCandidate[] {
  const images: ImageCandidate[] = [];
  const meta = (selector: string) => document.querySelector<HTMLMetaElement>(selector)?.getAttribute("content");

  const og = absolute(meta('meta[property="og:image"], meta[property="og:image:url"], meta[name="og:image"]'), base);
  if (og) {
    images.push({
      url: og,
      width: toNumber(meta('meta[property="og:image:width"]')),
      height: toNumber(meta('meta[property="og:image:height"]')),
      alt: meta('meta[property="og:image:alt"]') ?? undefined,
      source: "og",
    });
  }
  const twitter = absolute(meta('meta[name="twitter:image"], meta[name="twitter:image:src"], meta[property="twitter:image"]'), base);
  if (twitter) images.push({ url: twitter, alt: meta('meta[name="twitter:image:alt"]') ?? undefined, source: "twitter" });
  const link = absolute(document.querySelector('link[rel="image_src"]')?.getAttribute("href"), base);
  if (link) images.push({ url: link, source: "link" });
  return images;
}

function contentImages(fragment: DocumentFragment, base: string): ImageCandidate[] {
  const images: ImageCandidate[] = [];
  for (const img of fragment.querySelectorAll("img")) {
    const url = absolute(img.getAttribute("src") ?? img.getAttribute("data-src"), base);
    if (!url) continue;
    images.push({
      url,
      width: toNumber(img.getAttribute("width")),
      height: toNumber(img.getAttribute("height")),
      alt: img.getAttribute("alt")?.trim() || undefined,
      source: "content",
    });
  }
  return images;
}

/** Stylesheets and scripts only slow the DOM parser down; Readability never needs them. */
function stripInert(html: string): string {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi, "");
}

/** Runs Readability over a page and returns clean paragraphs plus image candidates. */
export function extractArticle(html: string, url: string): ExtractedArticle {
  const dom = new JSDOM(stripInert(html), { url, virtualConsole: new VirtualConsole() });
  try {
    const document = dom.window.document;
    const images = metaImages(document, url);
    const lang = document.documentElement.getAttribute("lang") ?? undefined;
    const publishedTime =
      document.querySelector('meta[property="article:published_time"]')?.getAttribute("content") ??
      document.querySelector("time[datetime]")?.getAttribute("datetime") ??
      undefined;

    // Screen-reader-only labels (", external", "opens in new tab") are not part of the copy. This has to
    // happen before Readability runs, because it strips the class attributes we match on.
    for (const hidden of document.querySelectorAll(HIDDEN_LABELS)) hidden.remove();

    const parsed = new Readability(document, { charThreshold: 250 }).parse();
    if (!parsed) return { lang, publishedTime, paragraphs: [], images, wordCount: 0 };

    const fragment = JSDOM.fragment(parsed.content ?? "");
    let paragraphs = Array.from(fragment.querySelectorAll("p, li, dd, td"))
      .filter((element) => !element.closest("figure, figcaption, aside, nav, footer"))
      .map((element) => collapseWhitespace(element.textContent ?? ""))
      .filter((paragraph) => countWords(paragraph) >= 3);
    if (paragraphs.length < 2 && parsed.textContent) {
      paragraphs = parsed.textContent
        .split(/\n+/)
        .map(collapseWhitespace)
        .filter((paragraph) => countWords(paragraph) >= 3);
    }

    return {
      title: parsed.title?.trim() || undefined,
      byline: parsed.byline?.trim() || undefined,
      siteName: parsed.siteName?.trim() || undefined,
      lang: parsed.lang ?? lang,
      publishedTime: parsed.publishedTime ?? publishedTime,
      excerpt: parsed.excerpt?.trim() || undefined,
      paragraphs,
      images: [...images, ...contentImages(fragment, url)],
      wordCount: paragraphs.reduce((sum, paragraph) => sum + countWords(paragraph), 0),
    };
  } finally {
    dom.window.close();
  }
}
