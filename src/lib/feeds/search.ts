import { fetchWithTimeout, readCapped, USER_AGENT } from "@/lib/util/http";
import { collapseWhitespace } from "@/lib/util/text";
import { searchDirectory } from "./directory";
import { discoverFeeds, normalizeSiteInput } from "./discover";

export type ProposalSource = "site" | "directory" | "feedly";

export interface FeedProposal {
  url: string;
  name: string;
  site: string;
  description?: string;
  language?: string;
  category?: string;
  source: ProposalSource;
  /** Readers on Feedly, when known. */
  subscribers?: number;
}

export interface FeedSearch {
  query: string;
  proposals: FeedProposal[];
  /** Present when the query was a web address that was probed for feeds. */
  site?: { host: string; error?: string };
  /** Whether the wider (feedly.com) search ran. */
  wider: "off" | "ok" | "unavailable";
}

/** Set NEWZPAGE_FEED_SEARCH=directory to keep searches on this machine. */
export function widerSearchEnabled(): boolean {
  return (process.env.NEWZPAGE_FEED_SEARCH ?? "feedly").toLowerCase() !== "directory";
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Feed URLs compared without scheme, "www." or a trailing slash. */
const sameFeed = (a: string, b: string) => a.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") === b.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

interface FeedlyResult {
  feedId?: string;
  title?: string;
  website?: string;
  description?: string;
  language?: string;
  subscribers?: number;
  lastUpdated?: number;
}

/** Maps a feedly.com search response to proposals, dropping feeds that stopped updating a year ago. */
export function mapFeedlyResults(payload: unknown, now = Date.now()): FeedProposal[] {
  const results = (payload as { results?: FeedlyResult[] })?.results;
  if (!Array.isArray(results)) return [];
  const proposals: FeedProposal[] = [];
  for (const result of results) {
    const url = result.feedId?.startsWith("feed/") ? result.feedId.slice(5) : undefined;
    if (!url || !/^https?:\/\//.test(url) || !result.title) continue;
    if (result.lastUpdated && now - result.lastUpdated > 365 * 24 * 3600 * 1000) continue;
    proposals.push({
      url,
      name: collapseWhitespace(result.title),
      site: host(result.website || url),
      description: result.description ? collapseWhitespace(result.description).slice(0, 180) : undefined,
      language: result.language,
      source: "feedly",
      subscribers: result.subscribers,
    });
  }
  return proposals;
}

async function searchFeedly(query: string): Promise<FeedProposal[] | undefined> {
  try {
    const url = `https://cloud.feedly.com/v3/search/feeds?${new URLSearchParams({ query, count: "10" })}`;
    const response = await fetchWithTimeout(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } }, 8_000);
    if (!response.ok) return undefined;
    const body = new TextDecoder().decode(await readCapped(response, 1024 * 1024));
    return mapFeedlyResults(JSON.parse(body));
  } catch {
    return undefined;
  }
}

/**
 * Proposes feeds for free-text search terms: the site's own feeds when the terms are a web address, then
 * matches from the bundled directory, then (unless switched off) results from feedly.com's search.
 */
export async function searchFeeds(query: string): Promise<FeedSearch> {
  const trimmed = collapseWhitespace(query);
  const result: FeedSearch = { query: trimmed, proposals: [], wider: "off" };
  if (!trimmed) return result;

  const siteUrl = normalizeSiteInput(trimmed);
  const [discovered, wider] = await Promise.all([
    siteUrl ? discoverFeeds(siteUrl) : undefined,
    !siteUrl && widerSearchEnabled() ? searchFeedly(trimmed) : undefined,
  ]);

  if (discovered) {
    result.site = { host: discovered.site, error: discovered.error };
    for (const feed of discovered.feeds) {
      result.proposals.push({ url: feed.url, name: feed.title, site: discovered.site, description: feed.description, language: feed.language, source: "site" });
    }
  }
  for (const entry of searchDirectory(trimmed, 10)) {
    if (result.proposals.some((p) => sameFeed(p.url, entry.url))) continue;
    result.proposals.push({
      url: entry.url,
      name: entry.name,
      site: entry.site,
      description: entry.description || undefined,
      language: entry.language,
      category: entry.category,
      source: "directory",
    });
  }
  if (!siteUrl && widerSearchEnabled()) {
    result.wider = wider ? "ok" : "unavailable";
    for (const proposal of wider ?? []) {
      if (result.proposals.some((p) => sameFeed(p.url, proposal.url))) continue;
      result.proposals.push(proposal);
    }
  }
  return result;
}
