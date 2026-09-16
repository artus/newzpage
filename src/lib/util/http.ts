import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Newzpage/0.3 (+https://newz.page)";

export type HttpErrorCode = "timeout" | "network" | "http" | "too-large" | "not-html" | "unsupported";

export class HttpError extends Error {
  constructor(
    message: string,
    readonly code: HttpErrorCode,
    readonly status?: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Loopback, link-local, private and carrier-grade NAT ranges, in IPv4 and IPv6 notation. */
export function isPrivateAddress(address: string): boolean {
  const lower = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
  if (isIP(lower) === 4) {
    const [a, b] = lower.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  if (isIP(lower) === 6) return lower === "::1" || lower === "::" || /^f[cd]/.test(lower) || lower.startsWith("fe80");
  return false;
}

/**
 * The server fetches addresses that readers typed in, so it must never reach the machine it runs on or the
 * network around it. NEWZPAGE_ALLOW_PRIVATE_URLS=1 lifts this for a home network.
 */
export async function assertPublicUrl(url: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpError(`Not a valid URL: ${url}`, "unsupported");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new HttpError("Only http(s) URLs are fetched", "unsupported");
  if (process.env.NEWZPAGE_ALLOW_PRIVATE_URLS === "1") return parsed;
  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".home.arpa")) {
    throw new HttpError("Local addresses are not fetched", "unsupported");
  }
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((entry) => entry.address);
  if (addresses.length === 0) throw new HttpError(`Could not resolve ${host}`, "network");
  if (addresses.some(isPrivateAddress)) throw new HttpError("Private addresses are not fetched", "unsupported");
  return parsed;
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

/** Fetches with a timeout, following redirects by hand so every hop is checked against the address guard. */
export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const signal = AbortSignal.timeout(timeoutMs);
  let current = url;
  for (let hop = 0; hop < 6; hop++) {
    await assertPublicUrl(current);
    let response: Response;
    try {
      response = await fetch(current, { ...init, signal, redirect: "manual" });
    } catch (error) {
      const cause = error as Error & { name?: string };
      if (cause.name === "TimeoutError" || cause.name === "AbortError") throw new HttpError(`Timed out after ${timeoutMs}ms`, "timeout");
      throw new HttpError(cause.message || "Network error", "network");
    }
    const location = response.headers.get("location");
    if (!REDIRECTS.has(response.status) || !location) return response;
    await response.body?.cancel().catch(() => undefined);
    current = new URL(location, current).toString();
  }
  throw new HttpError("Too many redirects", "network");
}

/** Reads a response body but refuses to buffer more than `maxBytes`. */
export async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError(`Body of ${declared} bytes exceeds ${maxBytes}`, "too-large");
  }
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new HttpError(`Body exceeds ${maxBytes} bytes`, "too-large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function sniffCharset(bytes: Uint8Array, contentType: string | null): string {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader;
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 4096));
  const fromMeta =
    head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? head.match(/<\?xml[^>]+encoding=["']([\w-]+)["']/i)?.[1];
  return fromMeta ?? "utf-8";
}

/** Decodes a body using the declared charset, falling back to UTF-8. */
export function decodeBody(bytes: Uint8Array, contentType: string | null): string {
  const charset = sniffCharset(bytes, contentType);
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}
