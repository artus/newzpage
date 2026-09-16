import { decodeBody, fetchWithTimeout, HttpError, readCapped, USER_AGENT } from "@/lib/util/http";

export interface FetchedPage {
  url: string;
  finalUrl: string;
  html: string;
}

export interface FetchPageOptions {
  timeoutMs?: number;
  maxBytes?: number;
}

const NON_HTML_EXTENSION = /\.(pdf|zip|gz|tar|rar|7z|mp3|mp4|m4a|mov|avi|webm|ogg|wav|jpe?g|png|gif|webp|svg|exe|dmg|iso|xml|json|csv)(\?.*)?$/i;

/** Downloads an HTML page with a browser-like request and sensible limits. */
export async function fetchPage(url: string, options: FetchPageOptions = {}): Promise<FetchedPage> {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new HttpError("Only http(s) URLs are fetched", "unsupported");
  if (NON_HTML_EXTENSION.test(parsed.pathname)) throw new HttpError("URL does not look like an HTML page", "not-html");

  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        "Accept-Language": "en, nl;q=0.8, de;q=0.7, fr;q=0.7, *;q=0.5",
      },
    },
    options.timeoutMs ?? 12_000,
  );
  if (!response.ok) throw new HttpError(`Page responded with HTTP ${response.status}`, "http", response.status);

  const contentType = response.headers.get("content-type") ?? "text/html";
  if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    await response.body?.cancel().catch(() => undefined);
    throw new HttpError(`Unsupported content type ${contentType}`, "not-html");
  }

  const bytes = await readCapped(response, options.maxBytes ?? 3 * 1024 * 1024);
  return { url, finalUrl: response.url || url, html: decodeBody(bytes, contentType) };
}
