import { decodeBody, fetchWithTimeout, HttpError, readCapped, USER_AGENT } from "@/lib/util/http";

export interface FeedRequestOptions {
  etag?: string;
  lastModified?: string;
  timeoutMs?: number;
  maxBytes?: number;
}

export type FeedResponse =
  | { status: "ok"; xml: string; etag?: string; lastModified?: string }
  | { status: "not-modified" };

/** Fetches a feed, honouring conditional request headers so unchanged feeds cost nothing to re-check. */
export async function fetchFeed(url: string, options: FeedRequestOptions = {}): Promise<FeedResponse> {
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "application/rss+xml, application/atom+xml, application/rdf+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
  };
  if (options.etag) headers["If-None-Match"] = options.etag;
  if (options.lastModified) headers["If-Modified-Since"] = options.lastModified;

  const response = await fetchWithTimeout(url, { headers }, options.timeoutMs ?? 10_000);
  if (response.status === 304) return { status: "not-modified" };
  if (!response.ok) throw new HttpError(`Feed responded with HTTP ${response.status}`, "http", response.status);

  const bytes = await readCapped(response, options.maxBytes ?? 5 * 1024 * 1024);
  return {
    status: "ok",
    xml: decodeBody(bytes, response.headers.get("content-type")),
    etag: response.headers.get("etag") ?? undefined,
    lastModified: response.headers.get("last-modified") ?? undefined,
  };
}
