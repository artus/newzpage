import { decodeBody, fetchWithTimeout, readCapped, USER_AGENT } from "@/lib/util/http";
import { createLimiter } from "@/lib/util/limit";
import { collapseWhitespace, decodeEntities } from "@/lib/util/text";
import { fetchFeed } from "./fetch-feed";
import { parseFeed } from "./parse-feed";

export interface DiscoveredFeed {
  url: string;
  title: string;
  description?: string;
  language?: string;
  items: number;
}

export interface DiscoveryResult {
  site: string;
  feeds: DiscoveredFeed[];
  error?: string;
}

/** Turns "theguardian.com" or "https://example.org/blog" into a URL; anything with spaces or no dot is not one. */
export function normalizeSiteInput(input: string): string | undefined {
  const text = input.trim();
  if (!text || /\s/.test(text)) return undefined;
  const candidate = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(candidate);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

const FEED_TYPES = /rss|atom|xml/i;

/** The feeds a page announces in its head, in document order. */
export function extractFeedLinks(html: string, base: string): Array<{ url: string; title?: string }> {
  const found: Array<{ url: string; title?: string }> = [];
  const seen = new Set<string>();
  const head = html.slice(0, 200_000);
  for (const match of head.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const attribute = (name: string) => tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i"));
    const value = (name: string) => {
      const found = attribute(name);
      return found ? decodeEntities(found[2] ?? found[3] ?? found[4] ?? "") : undefined;
    };
    const rel = value("rel")?.toLowerCase() ?? "";
    const type = value("type") ?? "";
    const href = value("href");
    if (!rel.split(/\s+/).includes("alternate") || !FEED_TYPES.test(type) || !href) continue;
    try {
      const url = new URL(href, base).toString();
      if (seen.has(url)) continue;
      seen.add(url);
      found.push({ url, title: value("title") });
    } catch {
      // ignore unusable hrefs
    }
  }
  return found;
}

const COMMON_PATHS = ["/feed", "/rss", "/rss.xml", "/feed.xml", "/atom.xml", "/index.xml", "/feeds/posts/default", "/?feed=rss2"];

const looksLikeFeed = (text: string) => /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<(rss|feed|rdf:RDF)\b/i.test(text);

const limit = createLimiter(4);

async function probe(url: string): Promise<DiscoveredFeed | undefined> {
  try {
    const response = await fetchFeed(url, { timeoutMs: 8_000 });
    if (response.status !== "ok") return undefined;
    const feed = parseFeed(response.xml);
    return { url, title: feed.title, description: feed.description || undefined, language: feed.language, items: feed.items.length };
  } catch {
    return undefined;
  }
}

/** Finds the feeds of a website: the address itself, its announced feeds, then the usual paths. */
export async function discoverFeeds(siteUrl: string): Promise<DiscoveryResult> {
  const site = new URL(siteUrl).hostname.replace(/^www\./, "");
  let html: string;
  let finalUrl = siteUrl;
  try {
    const response = await fetchWithTimeout(
      siteUrl,
      { headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.5" } },
      10_000,
    );
    if (!response.ok) return { site, feeds: [], error: `${site} answered with HTTP ${response.status}` };
    finalUrl = response.url || siteUrl;
    html = decodeBody(await readCapped(response, 3 * 1024 * 1024), response.headers.get("content-type"));
  } catch (error) {
    return { site, feeds: [], error: (error as Error).message };
  }

  if (looksLikeFeed(html)) {
    try {
      const feed = parseFeed(html);
      return { site, feeds: [{ url: finalUrl, title: feed.title, description: feed.description || undefined, language: feed.language, items: feed.items.length }] };
    } catch {
      // fall through to discovery
    }
  }

  const announced = extractFeedLinks(html, finalUrl).slice(0, 8);
  const origin = new URL(finalUrl).origin;
  const guesses = announced.length > 0 ? [] : COMMON_PATHS.map((path) => origin + path);
  const candidates = [...announced.map((link) => link.url), ...guesses];
  const feeds = (await Promise.all(candidates.map((url) => limit(() => probe(url))))).filter((feed): feed is DiscoveredFeed => !!feed);
  const unique = feeds.filter((feed, index) => feeds.findIndex((other) => other.url === feed.url) === index);
  return { site, feeds: unique.map((feed) => ({ ...feed, title: collapseWhitespace(feed.title) })) };
}
