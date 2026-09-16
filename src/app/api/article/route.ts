import { NextResponse, type NextRequest } from "next/server";
import { isHttpUrl } from "@/lib/config-schema";
import { getArticle } from "@/lib/edition/build";
import { hasCopy } from "@/lib/edition/types";

export const dynamic = "force-dynamic";
/** Serverless platforms cut functions off after a default of ten seconds; pages can take longer to fetch. */
export const maxDuration = 60;

/** GET /api/article?url=…&feed=…&title=… — the ranked analysis of an article, ready to be cached by the browser. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const url = params.get("url");
  const feed = params.get("feed");
  const title = params.get("title") ?? undefined;
  if (!isHttpUrl(url)) return NextResponse.json({ error: "url must be an http(s) address" }, { status: 400 });
  if (feed && !isHttpUrl(feed)) return NextResponse.json({ error: "feed must be an http(s) address" }, { status: 400 });
  try {
    const article = await getArticle(url, feed ?? undefined, title);
    return NextResponse.json(article, { headers: { "Cache-Control": hasCopy(article) ? "private, max-age=3600" : "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
