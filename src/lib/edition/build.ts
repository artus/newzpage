import { extractArticle, extractArticleLite, type ExtractedArticle } from "@/lib/articles/extract";
import { fetchPage } from "@/lib/articles/fetch-page";
import { chooseImage, feedImageCandidates, type ImageCandidate } from "@/lib/articles/images";
import { MemoryCache } from "@/lib/cache/memory";
import { fetchFeed } from "@/lib/feeds/fetch-feed";
import { parseFeed, type FeedItem, type ParsedFeed } from "@/lib/feeds/parse-feed";
import { analyze, SUMMARIZER_VERSION } from "@/lib/summarize";
import { createLimiter } from "@/lib/util/limit";
import { log } from "@/lib/util/log";
import { collapseWhitespace, countWords, htmlToParagraphs } from "@/lib/util/text";
import { hasCopy, type ArticleRecord, type ArticleSource, type FeedItemSummary } from "./types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Feeds tell us how often to poll; we clamp what they ask for. */
function feedTtl(feed: ParsedFeed): number {
  const requested = (feed.ttlMinutes ?? 15) * MINUTE;
  return Math.min(Math.max(requested, 5 * MINUTE), 6 * HOUR);
}

/** How long an analysis is kept: real articles a month, a feed-description fallback an hour, failures not at all. */
export const ARTICLE_TTL: Record<ArticleSource, number> = {
  page: 30 * DAY,
  content: 30 * DAY,
  description: HOUR,
  none: 0,
};

/** Feed text has to be this long before we trust it instead of fetching the page. */
const FULL_CONTENT_WORDS = 150;

interface FeedSnapshot {
  feed: ParsedFeed;
  fetchedAt: number;
  freshUntil: number;
  etag?: string;
  lastModified?: string;
}

export interface LoadedFeed {
  feed: ParsedFeed;
  fetchedAt: number;
  stale: boolean;
}

// Process memory only: the server stores nothing about its readers.
const feeds = new MemoryCache<FeedSnapshot>(300);
const articles = new MemoryCache<ArticleRecord>(3000);
const inflightFeeds = new Map<string, Promise<LoadedFeed>>();
const inflightArticles = new Map<string, Promise<ArticleRecord>>();
const limitPageFetches = createLimiter(Number(process.env.NEWZPAGE_CONCURRENCY) || 6);

async function refreshFeed(url: string, cached: FeedSnapshot | undefined): Promise<LoadedFeed> {
  const now = Date.now();
  try {
    const response = await fetchFeed(url, { etag: cached?.etag, lastModified: cached?.lastModified });
    if (response.status === "not-modified" && cached) {
      feeds.set(url, { ...cached, fetchedAt: now, freshUntil: now + feedTtl(cached.feed) }, DAY, now);
      return { feed: cached.feed, fetchedAt: now, stale: false };
    }
    const fresh = response.status === "ok" ? response : await fetchFeed(url);
    if (fresh.status !== "ok") throw new Error("Feed reported not-modified without a cached copy");
    const feed = parseFeed(fresh.xml);
    feeds.set(url, { feed, fetchedAt: now, freshUntil: now + feedTtl(feed), etag: fresh.etag, lastModified: fresh.lastModified }, DAY, now);
    return { feed, fetchedAt: now, stale: false };
  } catch (error) {
    if (!cached) throw error;
    log.warn(`Could not refresh ${url}, serving the snapshot from ${new Date(cached.fetchedAt).toISOString()}`, error);
    return { feed: cached.feed, fetchedAt: cached.fetchedAt, stale: true };
  }
}

/** A parsed feed: from memory while fresh, refreshed with a conditional request otherwise. */
export async function loadFeed(url: string): Promise<LoadedFeed> {
  const cached = feeds.get(url);
  if (cached && cached.freshUntil > Date.now()) return { feed: cached.feed, fetchedAt: cached.fetchedAt, stale: false };
  let pending = inflightFeeds.get(url);
  if (!pending) {
    pending = refreshFeed(url, cached).finally(() => inflightFeeds.delete(url));
    inflightFeeds.set(url, pending);
  }
  return pending;
}

/** Whether a feed would be served from memory, without fetching anything. */
export function isFeedFresh(url: string): boolean {
  const cached = feeds.get(url);
  return !!cached && cached.freshUntil > Date.now();
}

/** Whether an article's analysis would be served from memory, without fetching or ranking anything. */
export function isArticleCached(url: string): boolean {
  return articles.get(url) !== undefined;
}

/** Bylines scraped from pages carry labels and links around the name; keep only something name-like. */
export function cleanByline(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const text = collapseWhitespace(value)
    .replace(/^(?:by|written by|posted by|story by|author|view all posts by)\b\s*:?\s*/i, "")
    .replace(/^(?:by|written by)\b\s*/i, "")
    .replace(/\s*[→»›|]+\s*$/, "")
    .replace(/\s*[·|•]\s*\d+\s*min(?:ute)?s? read.*$/i, "")
    .replace(/^[-–—:|·]+\s*|\s*[-–—:|·]+$/g, "");
  if (text.length < 2 || text.length > 80) return undefined;
  if (/\d{4}|https?:|@|\bposts?\b/i.test(text)) return undefined;
  return text;
}

function ensureTerminated(text: string): string {
  return /[.!?…]["”’')\]]*$/.test(text) ? text : `${text}.`;
}

function record(url: string, fields: Omit<ArticleRecord, "url" | "version" | "fetchedAt" | "expiresAt">): ArticleRecord {
  const now = Date.now();
  return { url, version: SUMMARIZER_VERSION, fetchedAt: now, expiresAt: now + ARTICLE_TTL[fields.source], ...fields };
}

/** Produces the analysis of one feed item: feed content if it is complete, otherwise the page. */
export async function summarizeItem(item: FeedItem, url: string, feedLanguage?: string): Promise<ArticleRecord> {
  const candidates: ImageCandidate[] = feedImageCandidates(item);
  const contentParagraphs = item.content ? htmlToParagraphs(item.content) : [];
  const contentWords = contentParagraphs.reduce((sum, paragraph) => sum + countWords(paragraph), 0);

  if (contentWords >= FULL_CONTENT_WORDS) {
    const analysis = analyze(contentParagraphs, { title: item.title, langHint: feedLanguage });
    return record(url, { source: "content", byline: cleanByline(item.author), lang: analysis.lang, analysis, image: chooseImage(candidates), wordCount: contentWords });
  }

  let error: string | undefined;
  try {
    const page = await limitPageFetches(() => fetchPage(url));
    let extracted: ExtractedArticle;
    try {
      extracted = await extractArticle(page.html, page.finalUrl);
    } catch (domError) {
      // Typically the DOM implementation failing to load on an old Node runtime; the page is still usable.
      log.warn(`Readability unavailable for ${url}, using the lightweight extractor`, domError);
      extracted = extractArticleLite(page.html, page.finalUrl);
    }
    candidates.push(...extracted.images);
    if (extracted.paragraphs.length >= 2 && extracted.wordCount >= 60) {
      const analysis = analyze(extracted.paragraphs, { title: item.title, langHint: extracted.lang ?? feedLanguage });
      return record(url, {
        source: "page",
        title: extracted.title,
        byline: cleanByline(extracted.byline) ?? cleanByline(item.author),
        siteName: extracted.siteName,
        lang: analysis.lang,
        publishedTime: extracted.publishedTime,
        analysis,
        image: chooseImage(candidates),
        wordCount: extracted.wordCount,
      });
    }
    error = "The page had no readable article text";
  } catch (caught) {
    error = (caught as Error).message;
  }

  const fallback = contentParagraphs.length > 0 ? contentParagraphs : item.summary ? [ensureTerminated(item.summary)] : [];
  const fallbackWords = fallback.reduce((sum, paragraph) => sum + countWords(paragraph), 0);
  if (fallbackWords >= 8) {
    const analysis = analyze(fallback, { title: item.title, langHint: feedLanguage });
    return record(url, {
      source: contentParagraphs.length > 0 ? "content" : "description",
      byline: cleanByline(item.author),
      lang: analysis.lang,
      analysis,
      image: chooseImage(candidates),
      wordCount: fallbackWords,
      error,
    });
  }
  return record(url, { source: "none", lang: feedLanguage ?? "en", analysis: null, image: chooseImage(candidates), wordCount: 0, error });
}

/**
 * The analysis of an article, computed once per process lifetime (bounded, expiring). The feed it came from
 * lets full-text feeds skip the page fetch; without it the page is fetched directly.
 */
export async function getArticle(url: string, feedUrl?: string, title?: string): Promise<ArticleRecord> {
  const cached = articles.get(url);
  if (cached) return cached;
  let pending = inflightArticles.get(url);
  if (!pending) {
    pending = (async () => {
      const started = Date.now();
      let item: FeedItem | undefined;
      let language: string | undefined;
      if (feedUrl) {
        try {
          const loaded = await loadFeed(feedUrl);
          item = loaded.feed.items.find((candidate) => candidate.link === url);
          language = loaded.feed.language;
        } catch (error) {
          log.warn(`Feed ${feedUrl} unavailable while summarising ${url}`, error);
        }
      }
      const article = await summarizeItem(item ?? { id: url, title: title ?? url, link: url, images: [], categories: [] }, url, language);
      // A placeholder is not remembered anywhere: the next request tries the page again.
      if (hasCopy(article)) articles.set(url, article, Math.min(ARTICLE_TTL[article.source], 6 * HOUR));
      log.info(`Summarised ${url} from ${article.source} in ${Date.now() - started}ms${article.error ? ` (${article.error})` : ""}`);
      return article;
    })().finally(() => inflightArticles.delete(url));
    inflightArticles.set(url, pending);
  }
  return pending;
}

/** The items of a feed as the browser needs them: deduplicated, trimmed, without HTML. */
export function summarizeFeedItems(feed: ParsedFeed, limit: number): FeedItemSummary[] {
  const seen = new Set<string>();
  const items: FeedItemSummary[] = [];
  for (const item of feed.items) {
    const key = item.link ?? item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ id: item.id, title: item.title, link: item.link, commentsLink: item.commentsLink, published: item.published, author: cleanByline(item.author) });
    if (items.length >= limit) break;
  }
  return items;
}
