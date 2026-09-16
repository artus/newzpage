import { NextResponse, type NextRequest } from "next/server";
import { searchFeeds } from "@/lib/feeds/search";

export const dynamic = "force-dynamic";
/** Serverless platforms cut functions off after a default of ten seconds; pages can take longer to fetch. */
export const maxDuration = 30;

/** GET /api/search?q=… — proposed feeds for search terms or a site address. */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
  if (!query) return NextResponse.json({ error: "q is required" }, { status: 400 });
  try {
    return NextResponse.json(await searchFeeds(query), { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
