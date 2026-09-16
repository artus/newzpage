import { NextResponse, type NextRequest } from "next/server";
import { isHttpUrl } from "@/lib/config-schema";
import { loadFeed, summarizeFeedItems } from "@/lib/edition/build";
import type { FeedResponse } from "@/lib/edition/types";

export const dynamic = "force-dynamic";

/** GET /api/feed?url=…&limit=… — a parsed feed, trimmed to what the page needs. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 10));
  if (!isHttpUrl(url)) return NextResponse.json({ error: "url must be an http(s) address" }, { status: 400 });
  try {
    const loaded = await loadFeed(url);
    const body: FeedResponse = {
      url,
      title: loaded.feed.title,
      link: loaded.feed.link,
      language: loaded.feed.language,
      fetchedAt: loaded.fetchedAt,
      stale: loaded.stale,
      items: summarizeFeedItems(loaded.feed, limit),
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
