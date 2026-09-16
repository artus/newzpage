/** The configuration shape shared by the server (defaults from feeds.json) and the browser (localStorage). */

export interface FeedConfig {
  /** Section name printed above the stories; defaults to the feed's own title. */
  name?: string;
  url: string;
  /** How many stories of this feed make the page. */
  limit?: number;
}

export interface NewzpageConfig {
  title: string;
  tagline: string;
  itemsPerFeed: number;
  /** Printed in this order. */
  feeds: FeedConfig[];
}

export const CONFIG_DEFAULTS = {
  title: "Newzpage",
  tagline: "All the feeds that are fit to print",
  /** Two bands per wire on a desktop page: the lead package and one more. */
  itemsPerFeed: 7,
} as const;

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toFeed(entry: unknown, position: number): FeedConfig {
  if (typeof entry === "string") entry = { url: entry };
  if (!isRecord(entry) || !isHttpUrl(entry.url)) throw new Error(`feeds[${position}] needs an http(s) "url"`);
  const feed: FeedConfig = { url: entry.url };
  if (typeof entry.name === "string" && entry.name.trim()) feed.name = entry.name.trim();
  if (typeof entry.limit === "number" && entry.limit > 0) feed.limit = Math.min(50, Math.floor(entry.limit));
  return feed;
}

/** Fills in defaults for missing fields; throws when a feed entry is unusable. */
export function normalizeConfig(raw: unknown): NewzpageConfig {
  const data = isRecord(raw) ? raw : {};
  return {
    title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : CONFIG_DEFAULTS.title,
    tagline: typeof data.tagline === "string" ? data.tagline.trim() : CONFIG_DEFAULTS.tagline,
    itemsPerFeed:
      typeof data.itemsPerFeed === "number" && data.itemsPerFeed > 0 ? Math.min(50, Math.floor(data.itemsPerFeed)) : CONFIG_DEFAULTS.itemsPerFeed,
    feeds: Array.isArray(data.feeds) ? data.feeds.map(toFeed) : [],
  };
}

/** Moves the feed with `url` one place up or down; returns a new list. */
export function moveFeed(feeds: FeedConfig[], url: string, direction: "up" | "down"): FeedConfig[] {
  const from = feeds.findIndex((feed) => feed.url === url);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= feeds.length) return feeds;
  const next = [...feeds];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function removeFeed(feeds: FeedConfig[], url: string): FeedConfig[] {
  return feeds.filter((feed) => feed.url !== url);
}

/** Replaces the feed with the same URL in place, or inserts it at `position` (the end by default). */
export function upsertFeed(feeds: FeedConfig[], feed: FeedConfig, position?: number): FeedConfig[] {
  const existing = feeds.findIndex((entry) => entry.url === feed.url);
  const next = [...feeds];
  if (existing >= 0) {
    next[existing] = feed;
    return next;
  }
  const at = position === undefined ? next.length : Math.max(0, Math.min(position, next.length));
  next.splice(at, 0, feed);
  return next;
}

/** Reorders by a complete list of URLs; returns undefined when the URLs do not match the current list. */
export function reorderFeeds(feeds: FeedConfig[], urls: string[]): FeedConfig[] | undefined {
  const known = new Map(feeds.map((feed) => [feed.url, feed]));
  if (new Set(urls).size !== urls.length || urls.length !== feeds.length || urls.some((url) => !known.has(url))) return undefined;
  return urls.map((url) => known.get(url)!);
}
