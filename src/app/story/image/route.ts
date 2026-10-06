import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { admitArticle, TOO_MANY_REQUESTS } from "@/lib/edition/admission";
import { getArticle } from "@/lib/edition/build";
import { cutStory, cuttingRequest, unreadable } from "@/lib/edition/cutting";
import { cuttingImage, loadImageAssets } from "./cutting-image";

export const dynamic = "force-dynamic";
/** Reading and summarising a page can take a while; serverless platforms cut functions off at ten seconds by default. */
export const maxDuration = 60;

/** GET /story/image?url=…&feed=…&title=… — the link preview of a cutting, 1200 by 630, drawn on the server. */
export async function GET(request: NextRequest) {
  const wanted = cuttingRequest(Object.fromEntries(request.nextUrl.searchParams));
  if (!wanted) return new Response("url must be an http(s) address", { status: 400 });
  const admitted = admitArticle(wanted.url, request.headers).ok;
  const [assets, cutting] = await Promise.all([
    loadImageAssets(),
    admitted
      ? getArticle(wanted.url, wanted.feed, wanted.title)
          .then((record) => cutStory(record, wanted))
          .catch((error: Error) => cutStory(unreadable(wanted, error.message), wanted))
      : cutStory(unreadable(wanted, TOO_MANY_REQUESTS), wanted),
  ]);
  return new ImageResponse(cuttingImage(cutting), {
    width: 1200,
    height: 630,
    fonts: assets.fonts,
    // Previews are fetched by many readers of one chat; the CDN may keep them for a day.
    headers: { "Cache-Control": admitted ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" : "no-store" },
  });
}
