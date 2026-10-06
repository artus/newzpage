import { NextResponse } from "next/server";
import { clientAddress, RateLimiter, type Admission } from "@/lib/util/rate-limit";
import { isArticleCached, isFeedFresh } from "./build";

// A first visit to a large paper (20 wires of 10 stories) asks for about 200 articles in a few seconds; after that
// a reader only asks for new stories. The buckets allow that burst, then a pace no reader comes near.
const articles = new RateLimiter(300, 1);
const feeds = new RateLimiter(100, 0.5);
const searches = new RateLimiter(40, 0.5);

const ADMITTED: Admission = { ok: true };

/** Only work the server has not done yet is counted: handing out what it already holds costs next to nothing. */
export function admitArticle(url: string, headers: Headers): Admission {
  return isArticleCached(url) ? ADMITTED : articles.take(clientAddress(headers));
}

export function admitFeed(url: string, headers: Headers): Admission {
  return isFeedFresh(url) ? ADMITTED : feeds.take(clientAddress(headers));
}

export function admitSearch(headers: Headers): Admission {
  return searches.take(clientAddress(headers));
}

export const TOO_MANY_REQUESTS = "Too many requests from this address; try again shortly";

export function tooManyRequests(admission: Extract<Admission, { ok: false }>): NextResponse {
  return NextResponse.json(
    { error: TOO_MANY_REQUESTS },
    { status: 429, headers: { "Retry-After": String(admission.retryAfterSeconds), "Cache-Control": "no-store" } },
  );
}
