import { normalizeConfig, type NewzpageConfig } from "@/lib/config-schema";
import type { ArticleRecord, FeedResponse } from "@/lib/edition/types";
import type { FeedSearch } from "@/lib/feeds/search";

async function getJson<T>(path: string, params: Record<string, string | number | undefined>, signal?: AbortSignal): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") query.set(key, String(value));
  const response = await fetch(query.size > 0 ? `${path}?${query}` : path, { signal, headers: { Accept: "application/json" } });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? `The server answered with HTTP ${response.status}`);
  return body as T;
}

/** The processing the browser cannot do itself: fetching feeds and pages, extracting and ranking text. */
export const api = {
  feed: (url: string, limit: number, signal?: AbortSignal) => getJson<FeedResponse>("/api/feed", { url, limit }, signal),
  article: (url: string, feed: string | undefined, title: string | undefined, signal?: AbortSignal) =>
    getJson<ArticleRecord>("/api/article", { url, feed, title }, signal),
  search: (q: string, signal?: AbortSignal) => getJson<FeedSearch>("/api/search", { q }, signal),
  defaults: async (signal?: AbortSignal): Promise<NewzpageConfig> => normalizeConfig(await getJson<unknown>("/api/defaults", {}, signal)),
};
