import { collapseWhitespace, countWords, decodeEntities, htmlToText } from "@/lib/util/text";
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

/**
 * Runs Readability over a page and returns clean paragraphs plus image candidates. The DOM implementation
 * is loaded on demand: it is heavy, and only the article route needs it.
 */
export async function extractArticle(html: string, url: string): Promise<ExtractedArticle> {
  const [{ JSDOM, VirtualConsole }, { Readability }] = await Promise.all([import("jsdom"), import("@mozilla/readability")]);
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

function metaContent(html: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta\\b[^>]*(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta\\b[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const found = html.match(pattern)?.[1];
    if (found) return decodeEntities(found).trim() || undefined;
  }
  return undefined;
}

/**
 * Extraction without a DOM, for when the DOM implementation cannot be loaded: the paragraphs of the page's
 * <article> (or <main>, or body). Cruder than Readability, but the summariser's junk filters do the rest.
 */
export function extractArticleLite(html: string, url: string): ExtractedArticle {
  const clean = stripInert(html);
  const images: ImageCandidate[] = [];
  const og = absolute(metaContent(clean, "og:image") ?? metaContent(clean, "og:image:url"), url);
  if (og) images.push({ url: og, alt: metaContent(clean, "og:image:alt"), source: "og" });
  const twitter = absolute(metaContent(clean, "twitter:image") ?? metaContent(clean, "twitter:image:src"), url);
  if (twitter) images.push({ url: twitter, source: "twitter" });

  const scope =
    clean.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ?? clean.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? clean.match(/<body\b[\s\S]*<\/body>/i)?.[0] ?? clean;
  const paragraphs = Array.from(scope.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi), (match) => collapseWhitespace(htmlToText(match[1]))).filter(
    (paragraph) => countWords(paragraph) >= 8,
  );
  const title = metaContent(clean, "og:title") ?? (decodeEntities(clean.match(/<title[^>]*>([^<]*)</i)?.[1] ?? "").trim() || undefined);
  return {
    title,
    siteName: metaContent(clean, "og:site_name"),
    lang: clean.match(/<html\b[^>]*\slang=["']([^"']+)/i)?.[1],
    publishedTime: metaContent(clean, "article:published_time"),
    paragraphs,
    images,
    wordCount: paragraphs.reduce((sum, paragraph) => sum + countWords(paragraph), 0),
  };
}
