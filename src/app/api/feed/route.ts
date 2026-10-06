import { NextResponse, type NextRequest } from "next/server";
import { isHttpUrl } from "@/lib/config-schema";
import { admitFeed, tooManyRequests } from "@/lib/edition/admission";
import { loadFeed, summarizeFeedItems } from "@/lib/edition/build";
import type { FeedResponse } from "@/lib/edition/types";

export const dynamic = "force-dynamic";
/** Serverless platforms cut functions off after a default of ten seconds; pages can take longer to fetch. */
export const maxDuration = 30;

/** GET /api/feed?url=…&limit=… — a parsed feed, trimmed to what the page needs. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 10));
  if (!isHttpUrl(url)) return NextResponse.json({ error: "url must be an http(s) address" }, { status: 400 });
  const admission = admitFeed(url, request.headers);
  if (!admission.ok) return tooManyRequests(admission);
  try {
    const loaded = await loadFeed(url);
    const body: FeedResponse = {
      url,
      title: loaded.feed.title,
      link: loaded.feed.link,
      description: loaded.feed.description,
      language: loaded.feed.language,
      fetchedAt: loaded.fetchedAt,
      stale: loaded.stale,
      items: summarizeFeedItems(loaded.feed, limit),
    };
    // A feed is the same for every reader, so the CDN may share it for the five minutes the server would keep it
    // anyway; a stale snapshot (the feed failed to refresh) only for a minute.
    const cacheControl = loaded.stale ? "public, max-age=60, s-maxage=60" : "public, max-age=60, s-maxage=300, stale-while-revalidate=600";
    return NextResponse.json(body, { headers: { "Cache-Control": cacheControl } });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
