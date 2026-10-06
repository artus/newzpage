import { NextResponse, type NextRequest } from "next/server";
import { isHttpUrl } from "@/lib/config-schema";
import { getArticle } from "@/lib/edition/build";
import { admitArticle, tooManyRequests } from "@/lib/edition/admission";
import { hasCopy, type ArticleRecord } from "@/lib/edition/types";

export const dynamic = "force-dynamic";
/** Serverless platforms cut functions off after a default of ten seconds; pages can take longer to fetch. */
export const maxDuration = 60;

/**
 * An analysis depends only on the public article, never on who asks, so the CDN may share it between readers: a
 * day for real text, an hour for a feed-description stand-in (the page may be readable next time), never for none.
 */
function cacheControl(article: ArticleRecord): string {
  if (!hasCopy(article)) return "no-store";
  if (article.source === "description") return "public, max-age=3600, s-maxage=3600";
  return "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
}

/** GET /api/article?url=…&feed=…&title=… — the ranked analysis of an article, ready to be cached by the browser. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const url = params.get("url");
  const feed = params.get("feed");
  const title = params.get("title") ?? undefined;
  if (!isHttpUrl(url)) return NextResponse.json({ error: "url must be an http(s) address" }, { status: 400 });
  if (feed && !isHttpUrl(feed)) return NextResponse.json({ error: "feed must be an http(s) address" }, { status: 400 });
  const admission = admitArticle(url, request.headers);
  if (!admission.ok) return tooManyRequests(admission);
  try {
    const article = await getArticle(url, feed ?? undefined, title);
    return NextResponse.json(article, { headers: { "Cache-Control": cacheControl(article) } });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
